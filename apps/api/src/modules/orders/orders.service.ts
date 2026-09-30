import { prisma, tx, cacheGet, cacheSet, cacheDel, CACHE_KEYS } from "../../config";
import { recordOrderCash } from "../payments/payments.records";
import { BaseService, ConflictError, NotFoundError, BadRequestError, ForbiddenError, type RequestContext } from "../../core";
import { OrderRepository, CartRepository } from "./orders.repository";
import type { TransitionStatusDto, OrderSearchQueryDto, CreateCartDto, ExportOrdersDto } from "./orders.dto";
import { newId, slugify } from "@ecom/utils";
import { Prisma } from "@prisma/client";
import { emitOrderStatusChanged } from "../notifications";
import { releaseOrderStock } from "../stock";
import { onOrderClosed, onOrderDelivered } from "../loyalty/loyalty.ledger";

export const STATUS_TRANSITIONS: Record<string, string[]> = {
  PENDING: ["PROCESSING", "ON_HOLD", "CANCELLED"],
  PROCESSING: ["ON_HOLD", "SHIPPED", "CANCELLED"],
  ON_HOLD: ["PROCESSING", "CANCELLED"],
  SHIPPED: ["OUT_FOR_DELIVERY", "CANCELLED"],
  OUT_FOR_DELIVERY: ["DELIVERED", "CANCELLED"],
  DELIVERED: ["COMPLETED", "REFUNDED", "FAILED"],
  COMPLETED: ["REFUNDED", "FAILED"],
  CANCELLED: [],
  REFUNDED: [],
  FAILED: ["PENDING"],
};

/** A cancelled order gives its flash-sale units back, so others can buy them at the sale price. */
async function releaseFlashSaleUnits(t: Prisma.TransactionClient, items: { quantity: number; meta: Prisma.JsonValue }[]) {
  for (const oi of items) {
    const meta = oi.meta as { flashSale?: { itemId?: string | null } } | null;
    const itemId = meta?.flashSale?.itemId;
    if (!itemId) continue;
    await t.flashSaleItem.updateMany({
      where: { id: BigInt(itemId), soldCount: { gte: oi.quantity } },
      data: { soldCount: { decrement: oi.quantity } },
    });
  }
}

export class OrdersService extends BaseService {
  private orders: OrderRepository;
  private carts: CartRepository;

  constructor(ctx: RequestContext) {
    super(ctx);
    this.orders = new OrderRepository();
    this.carts = new CartRepository();
  }

  async transitionStatus(orderId: bigint, dto: TransitionStatusDto) {
    const oid = BigInt(orderId);
    const order = await this.orders.findById(this.ctx, oid);
    if (!order) throw new NotFoundError("order", oid);

    const currentStatus = (order as { status: string }).status;
    const newStatus = dto.newStatus;
    const allowed = STATUS_TRANSITIONS[currentStatus] ?? [];
    if (!allowed.includes(newStatus)) {
      throw new ConflictError(
        `Cannot transition ${currentStatus} → ${newStatus}`,
        "ORDER_STATUS_INVALID_TRANSITION",
      );
    }

    const result = await tx(async (t: Prisma.TransactionClient) => {
      if (newStatus === "CANCELLED" || newStatus === "REFUNDED" || newStatus === "FAILED") {
        const orderItems = await t.orderItem.findMany({ where: { orderId: oid } });
        // Stock still held for the order goes back on sale; packed parcels are unpacked on cancel.
        // Units already with a courier or the customer come back through a returned parcel or a return.
        if (this.ctx.storeId !== undefined) {
          await releaseOrderStock(t, this.ctx.storeId, oid, `ORDER_${newStatus}`, newStatus === "CANCELLED");
        }
        if (newStatus === "CANCELLED") await releaseFlashSaleUnits(t, orderItems);
      }

      const updateData: Record<string, unknown> = { status: newStatus };
      if (newStatus === "DELIVERED") {
        (updateData as any).completedAt = new Date();
        // Cash on delivery is collected when the parcel is handed over.
        const o = order as { paymentGatewayCode?: string; paymentStatus?: string };
        if (o.paymentGatewayCode === "cod" && o.paymentStatus === "unpaid") {
          updateData.paymentStatus = "paid";
          updateData.paidAt = new Date();
        }
      }
      if (newStatus === "CANCELLED") {
        (updateData as any).cancelledAt = new Date();
      }

      await t.order.update({ where: { id: oid }, data: updateData as any });
      // Loyalty: cashback, referral rewards and level on delivery; wallet and cashback back on closing.
      if (this.ctx.storeId !== undefined) {
        if (newStatus === "DELIVERED") await onOrderDelivered(t, this.ctx.storeId, oid);
        if (newStatus === "CANCELLED" || newStatus === "REFUNDED" || newStatus === "FAILED") await onOrderClosed(t, this.ctx.storeId, oid);
      }
      // Cash on delivery handed over without a parcel carrying it: count it as cash in hand.
      if (newStatus === "DELIVERED") await recordOrderCash(t, oid);

      await t.orderStatusLog.create({
        data: {
          orderId: oid,
          status: newStatus,
          note: dto.note ?? null,
          notifyCustomer: dto.notifyCustomer ?? false,
          adminId: this.ctx.admin?.id ? BigInt(this.ctx.admin.id) : null,
        } as any,
      });

      return t.order.findFirst({ where: { id: oid } });
    });

    emitOrderStatusChanged({
      storeId: String((order as { storeId: bigint }).storeId),
      orderId: String(oid),
      status: newStatus,
      // Only a note written by the shop goes in the customer's email.
      note: this.ctx.admin ? (dto.note ?? null) : null,
      notify: dto.notifyCustomer !== false,
    });

    return result;
  }

  async listOrders(filters: OrderSearchQueryDto) {
    return this.orders.listWithJoins(this.ctx, filters);
  }

  async getOrderById(id: bigint) {
    const order = await this.orders.findDetailById(BigInt(id), this.ctx);
    if (!order) throw new NotFoundError("order", id);
    return order;
  }

  async getOrderByNumber(number: string) {
    const order = await this.orders.findByNumber(number, this.ctx);
    if (!order) throw new NotFoundError("order", number);
    return order;
  }

  async createGuestCart(dto: CreateCartDto & { items?: Array<{ productId: bigint; variantId?: bigint | null; quantity: number; unitPrice?: number | null }> }) {
    const token = newId("cart");
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const result = await tx(async (t: Prisma.TransactionClient) => {
      const cart = await t.cart.create({
        data: {
          ...(this.ctx.storeId !== undefined ? { storeId: this.ctx.storeId } : {}),
          token,
          customerId: dto.customerId ? BigInt(dto.customerId) : null,
          currencyCode: dto.currencyCode ?? "BDT",
          appliedCouponCode: dto.appliedCouponCode ?? null,
          expiresAt,
        } as any,
      });
      const cartId = BigInt((cart as any).id);

      const insertedItems: any[] = [];
      if (dto.items && dto.items.length > 0) {
        const seen = new Set<string>();
        for (const item of dto.items) {
          const key = `${String(item.productId)}:${item.variantId ? String(item.variantId) : "null"}`;
          if (seen.has(key)) {
            throw new BadRequestError("Duplicate product+variant in cart items", "CART_INVALID");
          }
          seen.add(key);
          const unitPrice = item.unitPrice ?? 0;
          const qty = item.quantity;
          const created = await t.cartItem.create({
            data: {
              cartId,
              productId: BigInt(item.productId),
              variantId: item.variantId ? BigInt(item.variantId) : null,
              quantity: qty,
              unitPrice,
              lineTotal: unitPrice * qty,
              lineTax: 0,
            } as any,
          });
          insertedItems.push(created);
        }
      }

      return { cart, items: insertedItems };
    });

    return { token, ...result };
  }

  async addCartItem(
    cartId: bigint,
    productId: bigint,
    variantId: bigint | null | undefined,
    qty: number,
    unitPrice?: number,
  ) {
    const cid = BigInt(cartId);
    const pid = BigInt(productId);
    const vid = variantId ? BigInt(variantId) : null;
    const price = unitPrice ?? 0;
    return this.carts.upsertItem(cid, pid, vid, qty, price, price * qty, 0);
  }

  async exportOrders(_format: "csv" | "xlsx" | "pdf", _filters: ExportOrdersDto) {
    const format = _format ?? "csv";
    return {
      url: `/tmp-exports/order-${Date.now()}.${format}`,
      filename: `orders-${new Date().toISOString().slice(0, 10)}.${format}`,
      rows: 10,
    };
  }

  async aggregateStats(filters?: {
    status?: string[];
    paymentStatus?: string[];
    dateFrom?: Date;
    dateTo?: Date;
  }) {
    return this.orders.aggregateStats(this.ctx, filters ?? {});
  }

  async customerScopedGetMyOrders(customerId: bigint, filters: OrderSearchQueryDto) {
    const cid = BigInt(customerId);
    const scopedFilters = { ...filters, customerId: cid };
    return this.orders.listWithJoins(this.ctx, scopedFilters);
  }
}
