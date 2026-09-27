/**
 * FULFILMENT — parcels, returns and refunds.
 *
 * An order keeps its main status (pending → … → delivered), and alongside it:
 *  - fulfillmentStatus, worked out from its parcels (unfulfilled, partial, packed, shipped,
 *    delivered, delivery_failed, returned). Parcel changes also move the main status forward
 *    (shipped, out for delivery, delivered), sending the usual emails.
 *  - returnStatus, from its newest return (none, requested, approved, received, refunded, rejected).
 * Every parcel and return keeps its own history (ShipmentEvent / ReturnEvent).
 */
import { Prisma } from "@prisma/client";
import { logger, prisma, tx } from "../../config";
import { BadRequestError, ConflictError, NotFoundError, type RequestContext } from "../../core";
import { getPaymentProvider } from "../../services/payments";
import type { PaymentMethod } from "../../services/payments/types";
import { OrdersService, STATUS_TRANSITIONS } from "../orders/orders.service";
import {
  RETURN_WINDOW_DAYS,
  canMoveParcel,
  canMoveReturn,
  fulfillmentStatus,
  orderStatusForFulfillment,
  orderStatusPath,
  priceRefund,
  returnStatusOf,
  unitRefund,
} from "./fulfilment.rules";
import type { CreateParcelDto, CreateRefundDto, CreateReturnDto, ListQueryDto, MoveParcelDto, MoveReturnDto, UpdateParcelDto } from "./fulfilment.dto";

type T = Prisma.TransactionClient;
const r2 = (n: number) => Math.round(n * 100) / 100;
const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));
/** Orders that are over: no new parcels, returns or refunds. */
const CLOSED = new Set(["CANCELLED", "FAILED"]);
/** Gateways where "refund to the original method" means handing money back by hand. */
const OFFLINE = new Set(["cod", "bank_transfer"]);

export class FulfilmentService {
  constructor(private readonly ctx: RequestContext) {}

  private get storeId(): bigint {
    if (this.ctx.storeId === undefined) throw new BadRequestError("No store for this request", "STORE_REQUIRED");
    return this.ctx.storeId;
  }

  /** The store admin behind the request (null for the platform team or a customer). */
  private get adminId(): bigint | null {
    return this.ctx.super || !this.ctx.admin ? null : this.ctx.admin.id;
  }

  private async order(orderId: bigint, t: T | typeof prisma = prisma) {
    const o = await t.order.findFirst({
      where: { id: orderId, storeId: this.storeId },
      include: {
        items: true,
        shipments: { include: { items: true } },
        returns: { include: { items: true } },
        refunds: { include: { items: true } },
      },
    });
    if (!o) throw new NotFoundError("Order", String(orderId));
    return o;
  }

  /** Puts units back on the shelf inside the caller's transaction. */
  private async restock(t: T, item: { productId: bigint | null; variantId: bigint | null }, qty: number, reason: string, ref: string) {
    if (!item.productId || qty <= 0) return;
    const target = item.variantId
      ? await t.productVariant.findFirst({ where: { id: item.variantId, product: { storeId: this.storeId } } })
      : await t.product.findFirst({ where: { id: item.productId, storeId: this.storeId } });
    if (!target) return; // deleted since the order
    if (item.variantId) await t.productVariant.update({ where: { id: item.variantId }, data: { stockQty: { increment: qty } } });
    else await t.product.update({ where: { id: item.productId }, data: { stockQty: { increment: qty } } });
    await t.inventoryLog.create({
      data: {
        productId: item.productId,
        variantId: item.variantId,
        changeQty: qty,
        reason,
        referenceId: ref,
        qtyBefore: target.stockQty ?? 0,
        qtyAfter: (target.stockQty ?? 0) + qty,
      },
    });
  }

  /** Re-derives the order's fulfilment and return status from its parcels and returns. */
  private async recompute(t: T, orderId: bigint) {
    const o = await t.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { items: true, shipments: { include: { items: true } }, returns: true },
    });
    const ordered = new Map(o.items.map((i) => [String(i.id), i.quantity]));
    const fs = fulfillmentStatus(
      ordered,
      o.shipments.map((s) => ({ status: s.status, items: s.items.map((i) => ({ orderItemId: String(i.orderItemId), quantity: i.quantity })) })),
    );
    const rs = returnStatusOf(o.returns);
    if (fs !== o.fulfillmentStatus || rs !== o.returnStatus) {
      await t.order.update({ where: { id: orderId }, data: { fulfillmentStatus: fs, returnStatus: rs } });
    }
    return { fulfillmentStatus: fs, returnStatus: rs, status: o.status };
  }

  /**
   * Moves the main order status to match the parcels (e.g. PENDING → PROCESSING → SHIPPED), through
   * the normal status change so emails go out; only the last step emails the customer.
   */
  private async syncOrderStatus(orderId: bigint, current: string, target: string | null, note: string) {
    if (!target || CLOSED.has(current)) return;
    const steps = orderStatusPath(current, target, STATUS_TRANSITIONS);
    const orders = new OrdersService(this.ctx);
    for (const [i, step] of steps.entries()) {
      const last = i === steps.length - 1;
      await orders.transitionStatus(orderId, { newStatus: step as never, note: last ? note : null, notifyCustomer: last, sendEmail: false } as never);
    }
  }

  // ================================================================ parcels

  async createParcel(orderId: bigint, dto: CreateParcelDto) {
    const o = await this.order(orderId);
    if (CLOSED.has(o.status) || o.status === "REFUNDED") throw new BadRequestError(`This order is ${o.status.toLowerCase()}`, "VALIDATION_FAILED");

    // What's already in parcels (cancelled parcels, and ones the courier brought back, free their items).
    const packed = new Map<string, number>();
    for (const s of o.shipments) if (s.status !== "cancelled" && s.status !== "returned") for (const i of s.items) packed.set(String(i.orderItemId), (packed.get(String(i.orderItemId)) ?? 0) + i.quantity);
    const lines = dto.items?.length
      ? dto.items
      : o.items.map((i) => ({ orderItemId: i.id, quantity: i.quantity - (packed.get(String(i.id)) ?? 0) })).filter((l) => l.quantity > 0);
    if (!lines.length) throw new BadRequestError("Everything in this order is already in a parcel", "VALIDATION_FAILED");
    for (const l of lines) {
      const item = o.items.find((i) => i.id === BigInt(l.orderItemId));
      if (!item) throw new BadRequestError("That item isn't part of this order", "VALIDATION_FAILED");
      const left = item.quantity - (packed.get(String(item.id)) ?? 0);
      if (l.quantity > left) throw new BadRequestError(`Only ${left} of "${item.productName}" still need a parcel`, "VALIDATION_FAILED");
    }

    // Cash on delivery: this parcel collects whatever the other parcels don't.
    const cod = o.paymentGatewayCode === "cod" && o.paymentStatus === "unpaid";
    const otherCod = o.shipments.filter((s) => s.status !== "cancelled" && s.status !== "returned").reduce((s, p) => s + num(p.codAmount), 0);
    const codAmount = dto.codAmount ?? (cod ? Math.max(0, r2(num(o.grandTotal) - otherCod)) : 0);
    const code = `${o.number}-P${o.shipments.length + 1}`;

    const parcel = await tx(async (t: T) => {
      const s = await t.shipment.create({
        data: {
          storeId: this.storeId,
          orderId,
          code,
          status: "ready",
          providerCode: dto.courierCode,
          providerName: dto.courierName,
          trackingNumber: dto.trackingNumber || null,
          trackingUrl: dto.trackingUrl || null,
          codAmount,
          weightKg: dto.weightKg ?? null,
          notes: dto.note || null,
          adminId: this.adminId,
          items: { create: lines.map((l) => ({ orderItemId: BigInt(l.orderItemId), quantity: l.quantity })) },
          events: { create: { status: "ready", note: dto.note || "Packed", adminId: this.adminId } },
        },
      });
      await this.recompute(t, orderId);
      return s;
    });
    return this.getParcel(parcel.id);
  }

  async getParcel(id: bigint) {
    const s = await prisma.shipment.findFirst({
      where: { id, storeId: this.storeId },
      include: {
        items: { include: { orderItem: { select: { productName: true, productSku: true, variantValues: true } } } },
        events: { orderBy: { createdAt: "asc" } },
        order: { select: { id: true, number: true, status: true, fulfillmentStatus: true, paymentGatewayCode: true, paymentStatus: true } },
      },
    });
    if (!s) throw new NotFoundError("Parcel", String(id));
    return s;
  }

  async updateParcel(id: bigint, dto: UpdateParcelDto) {
    const s = await this.getParcel(id);
    if (["delivered", "returned", "cancelled"].includes(s.status)) throw new BadRequestError(`This parcel is ${s.status}`, "VALIDATION_FAILED");
    await prisma.shipment.update({
      where: { id },
      data: {
        ...(dto.courierCode !== undefined ? { providerCode: dto.courierCode, providerName: dto.courierName ?? dto.courierCode } : {}),
        ...(dto.trackingNumber !== undefined ? { trackingNumber: dto.trackingNumber || null } : {}),
        ...(dto.trackingUrl !== undefined ? { trackingUrl: dto.trackingUrl || null } : {}),
        ...(dto.codAmount !== undefined ? { codAmount: dto.codAmount } : {}),
        ...(dto.note !== undefined ? { notes: dto.note || null } : {}),
      },
    });
    return this.getParcel(id);
  }

  async moveParcel(id: bigint, dto: MoveParcelDto) {
    const s = await this.getParcel(id);
    if (!canMoveParcel(s.status, dto.status)) {
      throw new ConflictError(`A ${s.status.replace(/_/g, " ")} parcel can't become ${dto.status.replace(/_/g, " ")}`, "ORDER_STATUS_INVALID_TRANSITION");
    }
    if (dto.status === "failed" && !dto.note) throw new BadRequestError("Say why the delivery failed", "VALIDATION_FAILED");
    const now = new Date();
    const derived = await tx(async (t: T) => {
      await t.shipment.update({
        where: { id },
        data: {
          status: dto.status,
          ...(dto.trackingNumber ? { trackingNumber: dto.trackingNumber } : {}),
          ...(["picked_up", "in_transit", "out_for_delivery"].includes(dto.status) && !s.shippedAt ? { shippedAt: now } : {}),
          ...(dto.status === "delivered" ? { deliveredAt: now } : {}),
          ...(dto.status === "returned" ? { returnedAt: now } : {}),
          ...(dto.status === "failed" ? { failedReason: dto.note } : {}),
        },
      });
      await t.shipmentEvent.create({ data: { shipmentId: id, status: dto.status, note: dto.note || null, adminId: this.adminId } });
      return this.recompute(t, s.orderId);
    });
    const target = orderStatusForFulfillment(derived.fulfillmentStatus, dto.status);
    const note = `Parcel ${s.code}: ${dto.status.replace(/_/g, " ")}${s.trackingNumber || dto.trackingNumber ? ` (${s.providerName} ${dto.trackingNumber || s.trackingNumber})` : ` (${s.providerName})`}`;
    try {
      await this.syncOrderStatus(s.orderId, derived.status, target, note);
    } catch (e) {
      logger.warn({ err: (e as Error).message, orderId: String(s.orderId) }, "Order status not moved with its parcel");
    }
    return this.getParcel(id);
  }

  async listParcels(q: ListQueryDto) {
    const search = q.search?.trim();
    const where: Prisma.ShipmentWhereInput = {
      storeId: this.storeId,
      ...(q.status ? { status: q.status } : {}),
      ...(search
        ? {
            OR: [
              { code: { contains: search, mode: "insensitive" } },
              { trackingNumber: { contains: search, mode: "insensitive" } },
              { order: { number: { contains: search } } },
              { order: { shippingPhone: { contains: search } } },
              { order: { billingFirstName: { contains: search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };
    const [rows, total, counts] = await Promise.all([
      prisma.shipment.findMany({
        where,
        include: {
          items: { include: { orderItem: { select: { productName: true, variantValues: true } } } },
          order: {
            select: {
              id: true, number: true, status: true, paymentGatewayCode: true, paymentStatus: true,
              billingFirstName: true, billingLastName: true, shippingFirstName: true, shippingLastName: true,
              shippingPhone: true, billingPhone: true, shippingCity: true, shippingUpazila: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (q.page - 1) * q.perPage,
        take: q.perPage,
      }),
      prisma.shipment.count({ where }),
      prisma.shipment.groupBy({ by: ["status"], where: { storeId: this.storeId }, _count: { _all: true } }),
    ]);
    return {
      items: rows,
      counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])),
      meta: { page: q.page, perPage: q.perPage, total, totalPages: Math.max(1, Math.ceil(total / q.perPage)) },
    };
  }

  // ================================================================ returns

  /** What can still be returned per line: ordered minus quantities in returns that are still open or done. */
  private returnable(o: Awaited<ReturnType<FulfilmentService["order"]>>) {
    const taken = new Map<string, number>();
    for (const r of o.returns) {
      if (r.status === "cancelled" || r.status === "rejected") continue;
      for (const i of r.items) taken.set(String(i.orderItemId), (taken.get(String(i.orderItemId)) ?? 0) + i.quantity);
    }
    return o.items.map((i) => ({ item: i, left: i.quantity - (taken.get(String(i.id)) ?? 0) }));
  }

  /** Whether a customer may still ask for a return, and until when. */
  returnWindow(o: { status: string; completedAt: Date | null }) {
    if (!["DELIVERED", "COMPLETED"].includes(o.status) || !o.completedAt) return { open: false, until: null as Date | null };
    const until = new Date(o.completedAt.getTime() + RETURN_WINDOW_DAYS * 86_400_000);
    return { open: until > new Date(), until };
  }

  async createReturn(orderId: bigint, dto: CreateReturnDto, by: "staff" | "customer") {
    const o = await this.order(orderId);
    if (by === "customer") {
      if (o.customerId === null || o.customerId !== this.ctx.customer?.id) throw new NotFoundError("Order", String(orderId));
      const w = this.returnWindow(o);
      if (!w.open) {
        throw new BadRequestError(
          w.until ? `Returns for this order closed on ${w.until.toDateString()}` : "You can ask for a return once the order is delivered",
          "VALIDATION_FAILED",
        );
      }
    } else if (!["SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED", "COMPLETED", "REFUNDED"].includes(o.status)) {
      throw new BadRequestError("Only orders that went out can be returned; cancel it instead", "VALIDATION_FAILED");
    }
    const open = this.returnable(o);
    const lines = dto.items.map((l) => {
      const hit = open.find((x) => x.item.id === BigInt(l.orderItemId));
      if (!hit) throw new BadRequestError("That item isn't part of this order", "VALIDATION_FAILED");
      if (l.quantity > hit.left) throw new BadRequestError(`Only ${hit.left} of "${hit.item.productName}" can be returned`, "VALIDATION_FAILED");
      return { ...l, item: hit.item };
    });
    const amount = r2(lines.reduce((s, l) => s + unitRefund({ quantity: l.item.quantity, lineTotal: num(l.item.lineTotal) }) * l.quantity, 0));
    const created = await tx(async (t: T) => {
      const r = await t.returnRequest.create({
        data: {
          storeId: this.storeId,
          orderId,
          customerId: o.customerId,
          code: `${o.number}-R${o.returns.length + 1}`,
          reason: dto.reason,
          customerNote: dto.note || null,
          requestedAmount: amount,
          requestedBy: by,
          items: {
            create: lines.map((l) => ({
              orderItemId: l.item.id,
              quantity: l.quantity,
              condition: l.condition || null,
              resolutionAmount: r2(unitRefund({ quantity: l.item.quantity, lineTotal: num(l.item.lineTotal) }) * l.quantity),
            })),
          },
          events: { create: { status: "requested", note: by === "customer" ? "Asked by the customer" : dto.note || "Started by staff", adminId: this.adminId } },
        },
      });
      await this.recompute(t, orderId);
      return r;
    });
    return this.getReturn(created.id);
  }

  async getReturn(id: bigint) {
    const r = await prisma.returnRequest.findFirst({
      where: { id, storeId: this.storeId },
      include: {
        items: { include: { orderItem: { select: { productName: true, productSku: true, variantValues: true, quantity: true, lineTotal: true } } } },
        events: { orderBy: { createdAt: "asc" } },
        refunds: { select: { id: true, amount: true, method: true, createdAt: true } },
        order: { select: { id: true, number: true, status: true, billingFirstName: true, billingLastName: true, shippingPhone: true, billingPhone: true } },
      },
    });
    if (!r) throw new NotFoundError("Return", String(id));
    return r;
  }

  async moveReturn(id: bigint, dto: MoveReturnDto) {
    const r = await this.getReturn(id);
    if (dto.status === "refunded") throw new BadRequestError("Refund the return from the order to close it", "VALIDATION_FAILED");
    if (!canMoveReturn(r.status, dto.status)) {
      throw new ConflictError(`A ${r.status} return can't become ${dto.status}`, "ORDER_STATUS_INVALID_TRANSITION");
    }
    if (dto.status === "rejected" && !dto.note) throw new BadRequestError("Say why the return is rejected", "VALIDATION_FAILED");
    const now = new Date();
    await tx(async (t: T) => {
      if (dto.status === "received") {
        // Items come back on the shelf unless staff say they can't be sold again.
        const skip = new Set((dto.noRestockItemIds ?? []).map(String));
        for (const i of r.items) {
          if (dto.restock === false || skip.has(String(i.orderItemId))) continue;
          const oi = await t.orderItem.findUniqueOrThrow({ where: { id: i.orderItemId } });
          await this.restock(t, oi, i.quantity, "RETURN_RECEIVED", r.code ?? String(r.id));
          await t.returnItem.update({ where: { id: i.id }, data: { restocked: true } });
        }
      }
      await t.returnRequest.update({
        where: { id },
        data: {
          status: dto.status,
          ...(dto.status === "approved" ? { approvedAt: now } : {}),
          ...(dto.status === "received" ? { receivedAt: now } : {}),
          ...(["rejected", "cancelled"].includes(dto.status) ? { closedAt: now } : {}),
          ...(dto.note && dto.status === "rejected" ? { adminNotes: dto.note } : {}),
        },
      });
      await t.returnEvent.create({ data: { returnRequestId: id, status: dto.status, note: dto.note || null, adminId: this.adminId } });
      await this.recompute(t, r.orderId);
    });
    return this.getReturn(id);
  }

  async listReturns(q: ListQueryDto) {
    const search = q.search?.trim();
    const where: Prisma.ReturnRequestWhereInput = {
      storeId: this.storeId,
      ...(q.status ? { status: q.status } : {}),
      ...(search
        ? {
            OR: [
              { code: { contains: search, mode: "insensitive" } },
              { order: { number: { contains: search } } },
              { order: { billingFirstName: { contains: search, mode: "insensitive" } } },
              { order: { shippingPhone: { contains: search } } },
            ],
          }
        : {}),
    };
    const [rows, total, counts] = await Promise.all([
      prisma.returnRequest.findMany({
        where,
        include: {
          items: { include: { orderItem: { select: { productName: true, variantValues: true } } } },
          order: { select: { id: true, number: true, billingFirstName: true, billingLastName: true, shippingPhone: true, billingPhone: true, paymentGatewayCode: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (q.page - 1) * q.perPage,
        take: q.perPage,
      }),
      prisma.returnRequest.count({ where }),
      prisma.returnRequest.groupBy({ by: ["status"], where: { storeId: this.storeId }, _count: { _all: true } }),
    ]);
    return {
      items: rows,
      counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])),
      meta: { page: q.page, perPage: q.perPage, total, totalPages: Math.max(1, Math.ceil(total / q.perPage)) },
    };
  }

  // ================================================================ refunds

  async createRefund(orderId: bigint, dto: CreateRefundDto) {
    const o = await this.order(orderId);
    if (!["paid", "partially_refunded"].includes(o.paymentStatus)) {
      throw new BadRequestError("Only paid orders can be refunded (cash on delivery is paid when delivered)", "REFUND_NOT_ALLOWED");
    }
    const ret = dto.returnRequestId ? o.returns.find((r) => r.id === BigInt(dto.returnRequestId!)) : undefined;
    if (dto.returnRequestId && !ret) throw new NotFoundError("Return", String(dto.returnRequestId));
    if (ret && ret.status !== "received") throw new BadRequestError("Mark the return as received before refunding it", "REFUND_NOT_ALLOWED");
    if (dto.method === "store_credit" && !o.customerId) throw new BadRequestError("Store credit needs a customer account", "REFUND_NOT_ALLOWED");

    // A return refunds its own items unless other lines are given.
    const request = dto.items?.length
      ? dto.items.map((i) => ({ orderItemId: String(i.orderItemId), quantity: i.quantity }))
      : ret
        ? ret.items.map((i) => ({ orderItemId: String(i.orderItemId), quantity: i.quantity }))
        : [];
    const refundedQty = new Map<string, number>();
    for (const rf of o.refunds) for (const i of rf.items) refundedQty.set(String(i.orderItemId), (refundedQty.get(String(i.orderItemId)) ?? 0) + i.quantity);
    let priced;
    try {
      priced = priceRefund(
        o.items.map((i) => ({ id: String(i.id), name: i.productName, quantity: i.quantity, lineTotal: num(i.lineTotal) })),
        refundedQty,
        request,
        dto.extraAmount ?? 0,
        num(o.grandTotal),
        num(o.refundedTotal),
      );
    } catch (e) {
      throw new BadRequestError((e as Error).message, "REFUND_AMOUNT_EXCEEDS_PAID");
    }

    // Money back through the gateway when it was paid online and staff chose "original method".
    let gatewayRefunded = false;
    let gatewayTransactionId: string | null = null;
    if (dto.method === "original" && !OFFLINE.has(o.paymentGatewayCode)) {
      try {
        const res = (await getPaymentProvider(o.paymentGatewayCode as PaymentMethod).refund({ orderId, amount: priced.amount, reason: dto.reason } as never)) as {
          success?: boolean;
          refundId?: string;
          transactionId?: string;
        };
        gatewayRefunded = res?.success !== false;
        gatewayTransactionId = res?.refundId ?? res?.transactionId ?? null;
      } catch (e) {
        logger.warn({ err: (e as Error).message, orderId: String(orderId) }, "Gateway refund failed; recorded for manual payout");
      }
    }

    const full = r2(num(o.refundedTotal) + priced.amount) >= r2(num(o.grandTotal)) - 0.001;
    const refund = await tx(async (t: T) => {
      const rf = await t.refund.create({
        data: {
          storeId: this.storeId,
          orderId,
          adminId: this.adminId,
          reason: dto.reason,
          amount: priced.amount,
          method: dto.method,
          restockItems: dto.restock,
          gatewayRefunded,
          gatewayTransactionId,
          noteToCustomer: dto.note || null,
          status: "completed",
          returnRequestId: ret?.id ?? null,
          items: { create: priced.perLine.map((l) => ({ orderItemId: BigInt(l.orderItemId), quantity: l.quantity, amount: l.amount })) },
        },
      });
      // Restock refunded items, except ones a received return already put back.
      if (dto.restock) {
        const backAlready = new Map<string, number>();
        for (const r of o.returns) for (const i of r.items) if (i.restocked) backAlready.set(String(i.orderItemId), (backAlready.get(String(i.orderItemId)) ?? 0) + i.quantity);
        for (const l of priced.perLine) {
          const qty = l.quantity - Math.min(l.quantity, backAlready.get(l.orderItemId) ?? 0);
          const oi = o.items.find((i) => String(i.id) === l.orderItemId)!;
          await this.restock(t, oi, qty, "REFUND_RESTOCK", `refund-${rf.id}`);
        }
      }
      if (dto.method === "store_credit") {
        await t.customer.update({ where: { id: o.customerId! }, data: { storeCredit: { increment: priced.amount } } });
      }
      await t.order.update({
        where: { id: orderId },
        data: {
          refundedTotal: { increment: priced.amount },
          paymentStatus: full ? "refunded" : "partially_refunded",
          ...(full ? { status: "REFUNDED" } : {}),
        },
      });
      await t.orderStatusLog.create({
        data: {
          orderId,
          status: full ? "REFUNDED" : o.status,
          note: `Refunded ৳${priced.amount.toFixed(2)} (${dto.method.replace(/_/g, " ")})${ret ? ` for return ${ret.code}` : ""}: ${dto.reason}`,
          notifyCustomer: false,
          adminId: this.adminId,
        },
      });
      if (ret) {
        await t.returnRequest.update({ where: { id: ret.id }, data: { status: "refunded", closedAt: new Date(), resolution: "refund", resolutionAmount: priced.amount } });
        await t.returnEvent.create({ data: { returnRequestId: ret.id, status: "refunded", note: `৳${priced.amount.toFixed(2)} (${dto.method.replace(/_/g, " ")})`, adminId: this.adminId } });
      }
      await this.recompute(t, orderId);
      return rf;
    });
    return { ...refund, fullyRefunded: full, gatewayRefunded };
  }
}
