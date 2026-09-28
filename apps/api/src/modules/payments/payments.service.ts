/**
 * PAYMENTS — money staff have to check.
 *
 *  - Transfers (kind "transfer"): the customer sends money to the shop's bKash / Nagad / Rocket
 *    number or bank account and types the transaction ID. Staff verify it against their statement
 *    (or reject it with a reason the customer sees). The order is paid once verified transfers
 *    cover its total; a pending order then moves to processing.
 *  - Cash on delivery (kind "cod"): each delivered parcel's cash is "with the courier" (or "cash in
 *    hand" for the shop's own riders / walk-ins) until a courier payout (CourierSettlement) or a
 *    cash confirmation marks it received. A payout that is less than the parcels' cash minus the
 *    courier's charges is flagged as a shortfall.
 */
import { staffOrderScope, staffStorefronts } from "../storefronts/storefronts.context";
import { Prisma } from "@prisma/client";
import { logger, prisma, tx } from "../../config";
import { BadRequestError, ConflictError, NotFoundError, type RequestContext } from "../../core";
import { OrdersService } from "../orders/orders.service";
import {
  amountDue,
  canMovePayment,
  isManualCapable,
  normalizeBdMobile,
  normalizeTrxId,
  settle,
  settlementCode,
  transferPaymentStatus,
  trxIdProblem,
} from "./payments.rules";
import type {
  ConfirmCashDto,
  CreateSettlementDto,
  NotCollectedDto,
  PaymentListDto,
  RejectDto,
  SettlementListDto,
  StaffTransferDto,
  SubmitTransferDto,
  UpdatePaymentMethodDto,
  VerifyDto,
} from "./payments.dto";

type T = Prisma.TransactionClient;
type Db = T | typeof prisma;
const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));
const r2 = (n: number) => Math.round(n * 100) / 100;
const METHOD_NAMES: Record<string, string> = { bkash: "bKash", nagad: "Nagad", rocket: "Rocket", bank_transfer: "Bank transfer", cod: "Cash on delivery", cash: "Cash" };
const methodName = (m: string) => METHOD_NAMES[m] ?? m;
const money = (n: number) => `৳${n.toFixed(2)}`;

/** Order fields the payment lists show. */
const ORDER_REF = {
  select: {
    id: true, number: true, status: true, grandTotal: true, paymentGatewayCode: true, paymentStatus: true,
    billingFirstName: true, billingLastName: true, billingPhone: true, shippingPhone: true, createdAt: true,
  },
} as const;

export class PaymentsService {
  constructor(private readonly ctx: RequestContext) {}

  private get storeId(): bigint {
    if (this.ctx.storeId === undefined) throw new BadRequestError("No store for this request", "STORE_REQUIRED");
    return this.ctx.storeId;
  }

  private get adminId(): bigint | null {
    return this.ctx.super || !this.ctx.admin ? null : this.ctx.admin.id;
  }

  private async order(orderId: bigint, db: Db = prisma) {
    const o = await db.order.findFirst({ where: { id: orderId, storeId: this.storeId }, include: { paymentRecords: true } });
    if (!o) throw new NotFoundError("Order", String(orderId));
    return o;
  }

  private async record(id: bigint, db: Db = prisma) {
    const r = await db.paymentRecord.findFirst({ where: { id, storeId: this.storeId }, include: { order: ORDER_REF } });
    if (!r) throw new NotFoundError("Payment", String(id));
    return r;
  }

  private note(t: T, orderId: bigint, status: string, note: string) {
    return t.orderStatusLog.create({ data: { orderId, status: status as never, note, adminId: this.adminId } });
  }

  /** Payment status and paid date from verified transfers; returns the new status. */
  private async syncTransfers(t: T, orderId: bigint) {
    const o = await t.order.findUniqueOrThrow({ where: { id: orderId }, include: { paymentRecords: { where: { kind: "transfer", status: "verified" }, orderBy: { checkedAt: "desc" } } } });
    const verified = r2(o.paymentRecords.reduce((s, r) => s + num(r.amount), 0));
    const status = transferPaymentStatus(o.paymentStatus, num(o.grandTotal), verified);
    await t.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: status,
        ...(status === "paid" && !o.paidAt ? { paidAt: new Date() } : {}),
        ...(o.paymentRecords[0]?.transactionId ? { transactionId: o.paymentRecords[0].transactionId } : {}),
      },
    });
    return { before: o.paymentStatus, after: status, orderStatus: o.status };
  }

  /** A paid pending order goes to processing (with the usual email). */
  private async startIfPaid(orderId: bigint, sync: { before: string; after: string; orderStatus: string }) {
    if (sync.after !== "paid" || sync.before === "paid" || sync.orderStatus !== "PENDING") return;
    try {
      await new OrdersService(this.ctx).transitionStatus(orderId, { newStatus: "PROCESSING", note: "Payment received", notifyCustomer: true } as never);
    } catch (e) {
      logger.warn({ err: (e as Error).message, orderId: String(orderId) }, "Paid order not moved to processing");
    }
  }

  /** Summary of an order's payments for the customer (what's due, what's pending, rejections). */
  static transferState(o: { grandTotal: unknown; paymentStatus: string; paymentGatewayCode: string; paymentRecords: { kind: string; status: string; amount: unknown }[] }) {
    const transfers = o.paymentRecords.filter((r) => r.kind === "transfer");
    const verified = transfers.filter((r) => r.status === "verified").reduce((s, r) => s + num(r.amount), 0);
    const pending = transfers.some((r) => r.status === "to_verify");
    const due = ["paid", "refunded", "partially_refunded"].includes(o.paymentStatus) ? 0 : amountDue(num(o.grandTotal), verified);
    return { due, pending, canSubmit: isManualCapable(o.paymentGatewayCode) && due > 0 && !pending };
  }

  // ================================================================ transfers

  /**
   * Adds a transfer to check. Customers can have one waiting at a time and only on an order paid
   * by a manual method; a transaction ID can't be used twice in the store. The routes find the
   * order through the signed-in customer or the order's secret key before calling this.
   */
  async submitTransfer(orderId: bigint, dto: SubmitTransferDto | StaffTransferDto, by: "customer" | "staff") {
    const o = await this.order(orderId);
    const method = dto.method ?? o.paymentGatewayCode;
    if (!isManualCapable(method)) throw new BadRequestError(`${methodName(method)} payments aren't checked by hand`, "VALIDATION_FAILED");
    if (["CANCELLED", "FAILED", "REFUNDED"].includes(o.status)) throw new BadRequestError(`This order is ${o.status.toLowerCase()}`, "VALIDATION_FAILED");
    const state = PaymentsService.transferState(o);
    if (by === "customer") {
      if (!isManualCapable(o.paymentGatewayCode)) throw new BadRequestError("This order isn't paid by bKash, Nagad, Rocket or bank transfer", "VALIDATION_FAILED");
      if (state.pending) throw new ConflictError("We're already checking a payment for this order", "VALIDATION_FAILED");
    }
    if (state.due <= 0) throw new BadRequestError("This order is already paid", "VALIDATION_FAILED");

    const problem = trxIdProblem(method, dto.transactionId);
    if (problem) throw new BadRequestError(problem, "VALIDATION_FAILED");
    const trx = method === "bank_transfer" ? dto.transactionId.trim().toUpperCase() : normalizeTrxId(dto.transactionId);
    let sender: string | null = null;
    if (dto.senderNumber) {
      sender = method === "bank_transfer" ? dto.senderNumber.trim() : normalizeBdMobile(dto.senderNumber);
      if (!sender) throw new BadRequestError("Enter the wallet number you paid from, e.g. 01712345678", "VALIDATION_FAILED");
    } else if (by === "customer" && method !== "bank_transfer") {
      throw new BadRequestError("Enter the wallet number you paid from", "VALIDATION_FAILED");
    }
    const used = await prisma.paymentRecord.findFirst({
      where: { storeId: this.storeId, method, transactionId: trx, status: { not: "rejected" } },
      include: { order: { select: { number: true } } },
    });
    if (used) {
      throw new ConflictError(
        by === "staff" ? `Transaction ${trx} is already recorded on order ${used.order.number}` : "This transaction ID has already been used",
        "VALIDATION_FAILED",
      );
    }

    const amount = r2(dto.amount ?? state.due);
    const verifyNow = by === "staff" && (dto as StaffTransferDto).verified;
    const created = await tx(async (t: T) => {
      const r = await t.paymentRecord.create({
        data: {
          storeId: this.storeId, orderId, kind: "transfer", method, amount, transactionId: trx, senderNumber: sender,
          status: verifyNow ? "verified" : "to_verify", moneyIsWith: "customer", submittedBy: by, note: dto.note || null,
          ...(verifyNow ? { checkedById: this.adminId, checkedAt: new Date(), moneyIsWith: "office" } : {}),
        },
      });
      await this.note(t, orderId, o.status, `${methodName(method)} payment ${money(amount)} (${trx}) ${verifyNow ? "recorded and verified" : by === "customer" ? "sent by the customer, to verify" : "recorded, to verify"}`);
      const sync = verifyNow ? await this.syncTransfers(t, orderId) : null;
      return { r, sync };
    });
    if (created.sync) await this.startIfPaid(orderId, created.sync);
    return this.record(created.r.id);
  }

  async verify(id: bigint, dto: VerifyDto) {
    const r = await this.record(id);
    if (!canMovePayment(r.status, "verified")) throw new ConflictError(`This payment is ${r.status.replace(/_/g, " ")}`, "ORDER_STATUS_INVALID_TRANSITION");
    const amount = r2(dto.amount ?? num(r.amount));
    const sync = await tx(async (t: T) => {
      await t.paymentRecord.update({
        where: { id },
        data: { status: "verified", amount, moneyIsWith: "office", checkedById: this.adminId, checkedAt: new Date(), ...(dto.note ? { note: dto.note } : {}) },
      });
      const changed = amount !== num(r.amount) ? ` (reported ${money(num(r.amount))})` : "";
      await this.note(t, r.orderId, r.order.status, `${methodName(r.method)} payment ${money(amount)}${changed} verified (${r.transactionId})`);
      return this.syncTransfers(t, r.orderId);
    });
    await this.startIfPaid(r.orderId, sync);
    return this.record(id);
  }

  async reject(id: bigint, dto: RejectDto) {
    const r = await this.record(id);
    if (!canMovePayment(r.status, "rejected")) throw new ConflictError(`This payment is ${r.status.replace(/_/g, " ")}`, "ORDER_STATUS_INVALID_TRANSITION");
    await tx(async (t: T) => {
      await t.paymentRecord.update({ where: { id }, data: { status: "rejected", rejectReason: dto.reason, checkedById: this.adminId, checkedAt: new Date() } });
      await this.note(t, r.orderId, r.order.status, `${methodName(r.method)} payment ${r.transactionId} not accepted: ${dto.reason}`);
    });
    return this.record(id);
  }

  async listPayments(q: PaymentListDto) {
    const search = q.search?.trim();
    const where: Prisma.PaymentRecordWhereInput = {
      storeId: this.storeId,
      // Staff limited to some storefronts see only their orders' rows.
      ...(staffStorefronts(this.ctx) ? { order: staffOrderScope(this.ctx) } : {}),
      kind: q.kind,
      ...(q.method ? { method: q.method } : {}),
      ...(q.courier ? { courierCode: q.courier } : {}),
      ...(search
        ? {
            OR: [
              { transactionId: { contains: search.replace(/\s/g, ""), mode: "insensitive" } },
              { senderNumber: { contains: search } },
              { order: { number: { contains: search } } },
              { order: { billingFirstName: { contains: search, mode: "insensitive" } } },
              { order: { billingPhone: { contains: search } } },
            ],
          }
        : {}),
    };
    const filtered = { ...where, ...(q.status ? { status: q.status } : {}) };
    const [rows, total, counts] = await Promise.all([
      prisma.paymentRecord.findMany({
        where: filtered,
        include: { order: ORDER_REF, settlement: { select: { id: true, code: true } }, shipment: { select: { code: true, trackingNumber: true } } },
        orderBy: { createdAt: q.status === "to_verify" ? "asc" : "desc" },
        skip: (q.page - 1) * q.perPage,
        take: q.perPage,
      }),
      prisma.paymentRecord.count({ where: filtered }),
      prisma.paymentRecord.groupBy({ by: ["status"], where, _count: { _all: true }, _sum: { amount: true } }),
    ]);
    return {
      items: rows,
      counts: Object.fromEntries(counts.map((c) => [c.status, { count: c._count._all, amount: num(c._sum.amount) }])),
      meta: { page: q.page, perPage: q.perPage, total, totalPages: Math.max(1, Math.ceil(total / q.perPage)) },
    };
  }

  /** Payments of one order (the order page). */
  async orderPayments(orderId: bigint) {
    const o = await this.order(orderId);
    const rows = await prisma.paymentRecord.findMany({
      where: { orderId, storeId: this.storeId },
      include: { settlement: { select: { id: true, code: true } }, shipment: { select: { code: true } } },
      orderBy: { createdAt: "asc" },
    });
    return { ...PaymentsService.transferState(o), records: rows };
  }

  // ================================================================ cash on delivery

  async codSummary() {
    const storeId = this.storeId;
    const [byStatus, byCourier, notShipped, shortSettlements] = await Promise.all([
      prisma.paymentRecord.groupBy({ by: ["status"], where: { storeId, kind: "cod" }, _count: { _all: true }, _sum: { amount: true } }),
      prisma.paymentRecord.groupBy({
        by: ["courierCode", "courierName"],
        where: { storeId, kind: "cod", status: "with_courier" },
        _count: { _all: true },
        _sum: { amount: true },
        _min: { createdAt: true },
      }),
      // COD orders still to go out: the cash isn't with anyone yet.
      prisma.order.aggregate({
        where: { storeId, paymentGatewayCode: "cod", paymentStatus: "unpaid", status: { in: ["PENDING", "PROCESSING", "ON_HOLD", "SHIPPED", "OUT_FOR_DELIVERY"] } },
        _count: { _all: true },
        _sum: { grandTotal: true },
      }),
      prisma.courierSettlement.aggregate({ where: { storeId, status: "short" }, _count: { _all: true }, _sum: { shortfall: true } }),
    ]);
    const stage = (s: string) => {
      const row = byStatus.find((b) => b.status === s);
      return { count: row?._count._all ?? 0, amount: num(row?._sum.amount) };
    };
    const withCourier = stage("with_courier");
    const inHand = stage("cash_in_hand");
    return {
      withCourier,
      cashInHand: inHand,
      received: stage("received"),
      notCollected: stage("not_collected"),
      notShipped: { count: notShipped._count._all, amount: num(notShipped._sum.grandTotal) },
      outstanding: { count: withCourier.count + inHand.count, amount: r2(withCourier.amount + inHand.amount) },
      shortfalls: { count: shortSettlements._count._all, amount: num(shortSettlements._sum.shortfall) },
      byCourier: byCourier
        .map((c) => ({ courierCode: c.courierCode, courierName: c.courierName, count: c._count._all, amount: num(c._sum.amount), oldest: c._min.createdAt }))
        .sort((a, b) => b.amount - a.amount),
    };
  }

  /** Cash counted at the shop (own riders, walk-ins, or a courier's cash brought in by hand). */
  async confirmCash(dto: ConfirmCashDto) {
    const rows = await prisma.paymentRecord.findMany({ where: { id: { in: dto.ids }, storeId: this.storeId, kind: "cod" }, include: { order: ORDER_REF } });
    if (rows.length !== dto.ids.length) throw new NotFoundError("Payment");
    const bad = rows.find((r) => !canMovePayment(r.status, "received"));
    if (bad) throw new ConflictError(`Cash for order ${bad.order.number} is already ${bad.status.replace(/_/g, " ")}`, "ORDER_STATUS_INVALID_TRANSITION");
    await tx(async (t: T) => {
      for (const r of rows) {
        await t.paymentRecord.update({ where: { id: r.id }, data: { status: "received", moneyIsWith: "office", checkedById: this.adminId, checkedAt: new Date(), ...(dto.note ? { note: dto.note } : {}) } });
        await this.note(t, r.orderId, r.order.status, `Cash ${money(num(r.amount))} received${dto.note ? `: ${dto.note}` : ""}`);
      }
    });
    return { received: rows.length, amount: r2(rows.reduce((s, r) => s + num(r.amount), 0)) };
  }

  /** The courier (or rider) didn't get the cash after all, e.g. the customer paid less. */
  async markNotCollected(id: bigint, dto: NotCollectedDto) {
    const r = await this.record(id);
    if (r.kind !== "cod" || !canMovePayment(r.status, "not_collected")) {
      throw new ConflictError(`This payment is ${r.status.replace(/_/g, " ")}`, "ORDER_STATUS_INVALID_TRANSITION");
    }
    await tx(async (t: T) => {
      await t.paymentRecord.update({ where: { id }, data: { status: "not_collected", rejectReason: dto.reason, checkedById: this.adminId, checkedAt: new Date() } });
      await this.note(t, r.orderId, r.order.status, `Cash ${money(num(r.amount))} not collected: ${dto.reason}`);
    });
    return this.record(id);
  }

  // ================================================================ courier payouts

  async createSettlement(dto: CreateSettlementDto) {
    const where: Prisma.PaymentRecordWhereInput = { storeId: this.storeId, kind: "cod", courierCode: dto.courierCode };
    const rows = await prisma.paymentRecord.findMany({
      where: dto.recordIds?.length ? { ...where, id: { in: dto.recordIds } } : { ...where, status: "with_courier" },
      include: { order: ORDER_REF },
      orderBy: { createdAt: "asc" },
    });
    if (dto.recordIds?.length && rows.length !== dto.recordIds.length) throw new BadRequestError("Some of those parcels aren't this courier's", "VALIDATION_FAILED");
    if (!rows.length) throw new BadRequestError("This courier doesn't owe any cash", "VALIDATION_FAILED");
    const done = rows.find((r) => r.status !== "with_courier");
    if (done) throw new ConflictError(`Cash for order ${done.order.number} is already ${done.status.replace(/_/g, " ")}`, "VALIDATION_FAILED");

    const expected = r2(rows.reduce((s, r) => s + num(r.amount), 0));
    if (dto.charges > expected) throw new BadRequestError("Charges can't be more than the cash collected", "VALIDATION_FAILED");
    const { shortfall, status } = settle(expected, dto.charges, dto.receivedAmount);
    const courierName = rows[0]!.courierName ?? dto.courierCode;

    const created = await tx(async (t: T) => {
      const n = await t.courierSettlement.count({ where: { storeId: this.storeId } });
      const s = await t.courierSettlement.create({
        data: {
          storeId: this.storeId, code: settlementCode(n + 1), courierCode: dto.courierCode, courierName,
          reference: dto.reference || null, paidOn: dto.paidOn, expectedAmount: expected, charges: dto.charges,
          receivedAmount: dto.receivedAmount, shortfall, status, note: dto.note || null, adminId: this.adminId,
        },
      });
      for (const r of rows) {
        await t.paymentRecord.update({ where: { id: r.id }, data: { status: "received", moneyIsWith: "office", settlementId: s.id, checkedById: this.adminId, checkedAt: new Date() } });
        await this.note(t, r.orderId, r.order.status, `COD ${money(num(r.amount))} paid out by ${courierName} (${s.code})`);
      }
      return s;
    });
    return this.getSettlement(created.id);
  }

  async getSettlement(id: bigint) {
    const s = await prisma.courierSettlement.findFirst({
      where: { id, storeId: this.storeId },
      include: { records: { include: { order: ORDER_REF, shipment: { select: { code: true, trackingNumber: true } } }, orderBy: { createdAt: "asc" } } },
    });
    if (!s) throw new NotFoundError("Payout", String(id));
    return s;
  }

  async listSettlements(q: SettlementListDto) {
    const base: Prisma.CourierSettlementWhereInput = { storeId: this.storeId, ...(q.courier ? { courierCode: q.courier } : {}) };
    const where = { ...base, ...(q.status ? { status: q.status } : {}) };
    const [rows, total, counts] = await Promise.all([
      prisma.courierSettlement.findMany({
        where,
        include: { _count: { select: { records: true } } },
        orderBy: [{ paidOn: "desc" }, { id: "desc" }],
        skip: (q.page - 1) * q.perPage,
        take: q.perPage,
      }),
      prisma.courierSettlement.count({ where }),
      prisma.courierSettlement.groupBy({ by: ["status"], where: base, _count: { _all: true } }),
    ]);
    return {
      items: rows,
      counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])),
      meta: { page: q.page, perPage: q.perPage, total, totalPages: Math.max(1, Math.ceil(total / q.perPage)) },
    };
  }

  /** Closes a short or over payout once the difference is sorted out with the courier. */
  async resolveSettlement(id: bigint, note: string) {
    const s = await this.getSettlement(id);
    if (!["short", "over"].includes(s.status)) throw new ConflictError("Only a short or over payout needs settling", "VALIDATION_FAILED");
    await prisma.courierSettlement.update({ where: { id }, data: { status: "resolved", resolvedNote: note } });
    return this.getSettlement(id);
  }

  // ================================================================ settings

  async listMethods() {
    const rows = await prisma.paymentGatewayConfig.findMany({ where: { storeId: this.storeId }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] });
    // Merchant API keys never leave the server.
    return rows.map(({ credentials: _c, ...g }) => ({ ...g, manualCapable: isManualCapable(g.code) }));
  }

  async updateMethod(code: string, dto: UpdatePaymentMethodDto) {
    const g = await prisma.paymentGatewayConfig.findFirst({ where: { storeId: this.storeId, code } });
    if (!g) throw new NotFoundError("Payment method", code);
    const mode = code === "bank_transfer" ? "manual" : dto.mode ?? g.mode;
    if (mode === "manual" && !isManualCapable(code)) throw new BadRequestError(`${g.name} can only take payments online`, "VALIDATION_FAILED");
    let accountNumber = dto.accountNumber !== undefined ? dto.accountNumber.trim() || null : g.accountNumber;
    if (accountNumber && mode === "manual" && code !== "bank_transfer") {
      accountNumber = normalizeBdMobile(accountNumber);
      if (!accountNumber) throw new BadRequestError("Enter the wallet number customers send money to, e.g. 01712345678", "VALIDATION_FAILED");
    }
    const enabled = dto.enabled ?? g.enabled;
    if (enabled && mode === "manual" && code !== "bank_transfer" && !accountNumber) {
      throw new BadRequestError(`Add your ${g.name} number before turning it on`, "VALIDATION_FAILED");
    }
    const instructions = dto.instructions !== undefined ? dto.instructions || null : g.instructions;
    if (enabled && code === "bank_transfer" && !instructions) {
      throw new BadRequestError("Add your bank details (bank, branch, account name and number) before turning bank transfer on", "VALIDATION_FAILED");
    }
    if (!enabled && g.enabled) {
      const left = await prisma.paymentGatewayConfig.count({ where: { storeId: this.storeId, enabled: true, code: { not: code } } });
      if (!left) throw new BadRequestError("Keep at least one payment method on, or customers can't check out", "VALIDATION_FAILED");
    }
    await prisma.paymentGatewayConfig.update({
      where: { id: g.id },
      data: {
        enabled,
        mode,
        accountNumber,
        instructions,
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description || null } : {}),
        ...(dto.accountType !== undefined ? { accountType: dto.accountType } : {}),
        ...(dto.feeFixed !== undefined ? { feeFixed: dto.feeFixed } : {}),
        ...(dto.feePercent !== undefined ? { feePercent: dto.feePercent } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      },
    });
    return (await this.listMethods()).find((m) => m.code === code);
  }
}

