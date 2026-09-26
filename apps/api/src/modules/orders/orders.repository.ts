import { BaseRepository, type RequestContext, ConflictError } from "../../core";
import { prisma } from "../../config/prisma";
import type { OrderSearchQueryDto } from "./orders.dto";
import type { Paginated } from "../../core/pagination";
import { paginate } from "../../core/pagination";

export class OrderRepository extends BaseRepository<"order"> {
  constructor() {
    super("order");
  }

  /** Admin order detail: lines, full status history, refunds and the linked customer. */
  async findDetailById(id: bigint, ctx: RequestContext): Promise<unknown | null> {
    const where: Record<string, unknown> = { id };
    if (ctx.storeId !== undefined) where.storeId = ctx.storeId;
    return (this.q as any).findFirst({
      where,
      include: {
        items: { orderBy: { id: "asc" } },
        statusHistory: {
          orderBy: { createdAt: "desc" },
          include: { admin: { select: { id: true, name: true } } },
        },
        refunds: { include: { items: true }, orderBy: { createdAt: "desc" } },
        customer: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
      },
    });
  }

  async findByNumber(number: string, ctx: RequestContext): Promise<unknown | null> {
    const where: Record<string, unknown> = { number };
    if (ctx.storeId !== undefined) where.storeId = ctx.storeId;
    return (this.q as any).findFirst({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        items: {
          include: {
            product: true,
            variant: true,
          },
        },
        statusHistory: {
          orderBy: { createdAt: "desc" },
          take: 11,
        },
        shippingZone: true,
        coupon: true,
        refunds: {
          include: {
            items: true,
          },
        },
      },
    });
  }

  async listWithJoins(
    ctx: RequestContext,
    filters: OrderSearchQueryDto & {
      status?: string[];
      paymentStatus?: string[];
      dateFrom?: Date;
      dateTo?: Date;
      minTotal?: number;
      maxTotal?: number;
      search?: string;
      customerId?: bigint;
    } = {
      page: 1,
      perPage: 20,
      sortBy: "createdAt",
      sortOrder: "desc",
    },
  ): Promise<Paginated<unknown>> {
    const where: Record<string, unknown> = {};
    if (ctx.storeId !== undefined) where.storeId = ctx.storeId;
    if (filters.status && filters.status.length > 0) {
      where.status = { in: filters.status };
    }
    if (filters.paymentStatus && filters.paymentStatus.length > 0) {
      where.paymentStatus = { in: filters.paymentStatus };
    }
    if (filters.dateFrom) where.createdAt = { ...(where.createdAt as object || {}), gte: filters.dateFrom };
    if (filters.dateTo) where.createdAt = { ...(where.createdAt as object || {}), lte: filters.dateTo };
    if (filters.minTotal !== undefined) {
      where.grandTotal = { ...(where.grandTotal as object || {}), gte: filters.minTotal };
    }
    if (filters.maxTotal !== undefined) {
      where.grandTotal = { ...(where.grandTotal as object || {}), lte: filters.maxTotal };
    }
    if (filters.customerId) where.customerId = BigInt(filters.customerId);
    if (filters.search) {
      where.OR = [
        { number: { contains: filters.search, mode: "insensitive" } },
        { billingEmail: { contains: filters.search, mode: "insensitive" } },
        { shippingEmail: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    const orderBy = { [filters.sortBy ?? "createdAt"]: filters.sortOrder ?? "desc" };
    const skip = (filters.page - 1) * filters.perPage;

    const [count, items] = await Promise.all([
      (this.q as any).count({ where }),
      (this.q as any).findMany({
        where,
        orderBy,
        skip,
        take: filters.perPage,
        include: {
          items: true,
          statusHistory: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
          customer: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      }),
    ]);

    return paginate({
      items,
      total: count,
      page: filters.page,
      perPage: filters.perPage,
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder,
      search: filters.search,
      filtersApplied: filters,
    });
  }

  async aggregateStats(
    ctx: RequestContext,
    filters: {
      status?: string[];
      paymentStatus?: string[];
      dateFrom?: Date;
      dateTo?: Date;
    } = {},
  ): Promise<{
    byStatus: { status: string; count: number; total: number }[];
    byPaymentStatus: { paymentStatus: string; count: number }[];
  }> {
    // Built with Prisma filters (not string-built SQL) so query-string values are always bound parameters.
    const where: Record<string, unknown> = {};
    if (ctx.storeId !== undefined) where.storeId = ctx.storeId;
    if (filters.status?.length) where.status = { in: filters.status };
    if (filters.paymentStatus?.length) where.paymentStatus = { in: filters.paymentStatus };
    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {
        ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
        ...(filters.dateTo ? { lte: filters.dateTo } : {}),
      };
    }

    const [byStatusRows, byPaymentRows] = await Promise.all([
      prisma.order.groupBy({ by: ["status"], where: where as any, _count: { _all: true }, _sum: { grandTotal: true } }),
      prisma.order.groupBy({ by: ["paymentStatus"], where: where as any, _count: { _all: true } }),
    ]);

    return {
      byStatus: byStatusRows.map((r) => ({
        status: String(r.status),
        count: r._count._all,
        total: Number(r._sum.grandTotal ?? 0),
      })),
      byPaymentStatus: byPaymentRows.map((r) => ({ paymentStatus: r.paymentStatus, count: r._count._all })),
    };
  }

  async createOrderWithIncludes(
    data: Record<string, unknown>,
    includes?: unknown,
    ctx?: RequestContext,
  ): Promise<unknown> {
    const input: Record<string, unknown> = { ...data };
    if (ctx && ctx.storeId !== undefined && !("storeId" in input)) {
      input.storeId = ctx.storeId;
    }
    return prisma.$transaction(async (tx: any) => {
      return tx.order.create({
        data: input,
        include: includes as never,
      });
    });
  }

  async logStatus(
    orderId: bigint,
    status: string,
    note?: string | null,
    notify?: boolean,
    adminId?: bigint,
  ): Promise<unknown> {
    return prisma.orderStatusLog.create({
      data: {
        orderId: BigInt(orderId),
        status: status as any,
        note: note ?? null,
        notifyCustomer: notify ?? false,
        adminId: adminId ? BigInt(adminId) : null,
      },
    });
  }
}

export class CartRepository extends BaseRepository<"cart"> {
  constructor() {
    super("cart");
  }

  async findByTokenForCustomer(
    token: string,
    customerId: bigint | null | undefined,
    ctx: RequestContext,
  ): Promise<unknown | null> {
    const where: Record<string, unknown> = { token };
    if (ctx.storeId !== undefined) where.storeId = ctx.storeId;
    if (customerId !== null && customerId !== undefined) {
      where.customerId = BigInt(customerId);
    }
    return (this.q as any).findFirst({
      where,
      include: {
        items: {
          include: {
            product: true,
            variant: true,
          },
        },
        appliedCoupon: true,
      },
    });
  }

  async findByCustomerLatest(customerId: bigint, ctx: RequestContext): Promise<unknown | null> {
    const where: Record<string, unknown> = { customerId: BigInt(customerId) };
    if (ctx.storeId !== undefined) where.storeId = ctx.storeId;
    return (this.q as any).findFirst({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        items: true,
        appliedCoupon: true,
      },
    });
  }

  async upsertItem(
    cartId: bigint,
    productId: bigint,
    variantId: bigint | null | undefined,
    deltaQty: number,
    unitPrice: number,
    lineTotal: number,
    lineTax: number,
  ): Promise<unknown> {
    const existing = await prisma.cartItem.findFirst({
      where: {
        cartId: BigInt(cartId),
        productId: BigInt(productId),
        variantId: variantId ? BigInt(variantId) : null,
      },
    });

    if (existing) {
      const newQty = (existing.quantity as number) + deltaQty;
      const newLineTotal = newQty * unitPrice;
      if (newQty <= 0) {
        return prisma.cartItem.delete({ where: { id: existing.id } });
      }
      return prisma.cartItem.update({
        where: { id: existing.id },
        data: {
          quantity: newQty,
          unitPrice,
          lineTotal: newLineTotal,
          lineTax,
        },
      });
    }

    if (deltaQty <= 0) return null;
    return prisma.cartItem.create({
      data: {
        cartId: BigInt(cartId),
        productId: BigInt(productId),
        variantId: variantId ? BigInt(variantId) : null,
        quantity: deltaQty,
        unitPrice,
        lineTotal: deltaQty * unitPrice,
        lineTax,
      },
    });
  }

  async clearAll(cartId: bigint): Promise<{ count: number }> {
    return prisma.cartItem.deleteMany({
      where: { cartId: BigInt(cartId) },
    });
  }
}

export class RefundRepository extends BaseRepository<"refund"> {
  constructor() {
    super("refund");
  }

  async listForOrder(orderId: bigint, ctx: RequestContext): Promise<unknown[]> {
    const where: Record<string, unknown> = { orderId: BigInt(orderId) };
    if (ctx.storeId !== undefined) where.storeId = ctx.storeId;
    return (this.q as any).findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        items: true,
        order: true,
        admin: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
  }
}

export class CouponRepository extends BaseRepository<"coupon"> {
  constructor() {
    super("coupon");
  }

  async findByCode(code: string, ctx: RequestContext): Promise<unknown | null> {
    const where: Record<string, unknown> = { code };
    if (ctx.storeId !== undefined) where.storeId = ctx.storeId;
    return (this.q as any).findFirst({ where });
  }

  async incrementUsage(id: bigint, ctx: RequestContext): Promise<unknown> {
    const where: Record<string, unknown> = { id: BigInt(id) };
    if (ctx.storeId !== undefined) where.storeId = ctx.storeId;
    return (this.q as any).update({
      where,
      data: { usageCount: { increment: 1 } },
    });
  }
}

export class InventoryLogRepository extends BaseRepository<"inventoryLog"> {
  constructor() {
    super("inventoryLog");
  }

  async deductStock(
    productId: bigint,
    variantId: bigint | null | undefined,
    qty: number,
    reason: string,
    referenceId: bigint | string,
    note?: string | null,
    warehouse?: string | null,
    ctx?: RequestContext,
  ): Promise<unknown> {
    return prisma.$transaction(async (tx: any) => {
      const pid = BigInt(productId);
      const vid = variantId ? BigInt(variantId) : null;
      let qtyBefore: number;
      let qtyAfter: number;
      let target: any;

      if (vid !== null && vid !== undefined) {
        target = await tx.productVariant.findFirst({
          where: {
            id: vid,
            ...(ctx?.storeId !== undefined ? { storeId: ctx.storeId } : {}),
          },
        });
        if (!target) throw new ConflictError("Variant not found");
        qtyBefore = Number(target.stockQty ?? 0);
        if (qtyBefore < qty) {
          throw new ConflictError("OutOfStock: insufficient variant stock");
        }
        qtyAfter = qtyBefore - qty;
        await tx.productVariant.update({
          where: { id: vid },
          data: {
            stockQty: qtyAfter,
            reservedQty: { increment: qty },
          },
        });
      } else {
        target = await tx.product.findFirst({
          where: {
            id: pid,
            ...(ctx?.storeId !== undefined ? { storeId: ctx.storeId } : {}),
          },
        });
        if (!target) throw new ConflictError("Product not found");
        qtyBefore = Number(target.stockQty ?? 0);
        if (qtyBefore < qty) {
          throw new ConflictError("OutOfStock: insufficient product stock");
        }
        qtyAfter = qtyBefore - qty;
        await tx.product.update({
          where: { id: pid },
          data: {
            stockQty: qtyAfter,
            reservedStock: { increment: qty },
          },
        });
      }

      return tx.inventoryLog.create({
        data: {
          ...(ctx?.storeId !== undefined ? { storeId: ctx.storeId } : {}),
          productId: pid,
          variantId: vid,
          reason: reason || "ORDER_RESERVE",
          referenceId: String(referenceId),
          changeQty: -qty,
          qtyBefore,
          qtyAfter,
          note: note ?? null,
          warehouse: warehouse ?? null,
        },
      });
    });
  }

  /**
   * Put an order line's quantity back on the shelf (cancel/refund). Checkout takes
   * stock straight off stockQty without reserving it, so only stockQty goes back.
   */
  async restock(
    productId: bigint,
    variantId: bigint | null | undefined,
    qty: number,
    reason: string,
    referenceId: bigint | string,
    note?: string | null,
    ctx?: RequestContext,
  ): Promise<unknown> {
    return prisma.$transaction(async (tx: any) => {
      const pid = BigInt(productId);
      const vid = variantId ? BigInt(variantId) : null;
      const inStore = ctx?.storeId !== undefined ? { storeId: ctx.storeId } : {};

      const target = vid
        ? await tx.productVariant.findFirst({ where: { id: vid, product: inStore } })
        : await tx.product.findFirst({ where: { id: pid, ...inStore } });
      if (!target) return null; // product deleted since the order: nothing to restock

      const qtyBefore = Number(target.stockQty ?? 0);
      const qtyAfter = qtyBefore + qty;
      if (vid) await tx.productVariant.update({ where: { id: vid }, data: { stockQty: { increment: qty } } });
      else await tx.product.update({ where: { id: pid }, data: { stockQty: { increment: qty } } });

      return tx.inventoryLog.create({
        data: {
          productId: pid,
          variantId: vid,
          reason,
          referenceId: String(referenceId),
          changeQty: qty,
          qtyBefore,
          qtyAfter,
          note: note ?? null,
        },
      });
    });
  }
}

export class ShippingRepository extends BaseRepository<"shippingZone"> {
  constructor() {
    super("shippingZone");
  }

  async matchZoneByAddress(
    countryCode: string,
    state?: string | null,
    postcode?: string | null,
    ctx?: RequestContext,
  ): Promise<unknown | null> {
    const where: Record<string, unknown> = {};
    if (ctx?.storeId !== undefined) where.storeId = ctx.storeId;
    const zones = await (this.q as any).findMany({
      where,
      orderBy: { sortOrder: "asc" },
    });

    for (const zone of zones) {
      const countries: string[] = Array.isArray(zone.countries) ? zone.countries : [];
      const zoneStates: string[] | null = Array.isArray(zone.states) ? zone.states : null;
      const postcodes: string[] | null = Array.isArray(zone.postcodes) ? zone.postcodes : null;

      const countryMatch = countries.length === 0 || countries.includes(countryCode);
      if (!countryMatch) continue;

      if (zoneStates && zoneStates.length > 0 && state) {
        if (!zoneStates.includes(state)) continue;
      }

      if (postcodes && postcodes.length > 0 && postcode) {
        const pcMatch = postcodes.some((pattern) => {
          try {
            const re = new RegExp(pattern, "i");
            return re.test(postcode as string);
          } catch {
            return pattern === postcode;
          }
        });
        if (!pcMatch) continue;
      }

      return zone;
    }
    return null;
  }

  async methodsForZone(zoneId: bigint): Promise<unknown[]> {
    return prisma.shippingMethod.findMany({
      where: { zoneId: BigInt(zoneId), isActive: true },
      orderBy: { sortOrder: "asc" },
    });
  }

  flatRateCalc(
    method: {
      baseCost?: number;
      perItemCost?: number;
      freeFromSubtotal?: number;
    },
    itemsSubtotal: number,
    itemCount: number,
    _weightTotal: number,
  ): number {
    const freeFrom = method.freeFromSubtotal ?? 0;
    if (freeFrom > 0 && itemsSubtotal >= freeFrom) return 0;
    const base = method.baseCost ?? 0;
    const perItem = method.perItemCost ?? 0;
    return base + perItem * itemCount;
  }
}

export default { OrderRepository };
