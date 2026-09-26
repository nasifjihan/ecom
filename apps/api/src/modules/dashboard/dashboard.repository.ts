import { prisma } from "../../config";
import type { RequestContext } from "../../core";
import { StoreStatus } from "@ecom/shared-types";

type DateRange = { from?: Date; to?: Date };

export class SuperDashboardRepo {
  private ctx: RequestContext;

  constructor(ctx: RequestContext) {
    this.ctx = ctx;
  }

  private inRange(from?: Date, to?: Date): { gte?: Date; lte?: Date } {
    const r: { gte?: Date; lte?: Date } = {};
    if (from) r.gte = from;
    if (to) r.lte = to;
    return r;
  }

  async totalStores(): Promise<number> {
    return prisma.store.count();
  }

  async activeStores(): Promise<number> {
    return prisma.store.count({
      where: { status: { in: [StoreStatus.TRIAL, StoreStatus.ACTIVE] } },
    });
  }

  async churnedStoresLast30d(): Promise<number> {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    return prisma.store.count({
      where: {
        status: StoreStatus.CANCELLED,
        updatedAt: { gte: cutoff },
      },
    });
  }

  async newSignupsByDayLast30d(): Promise<{ date: string; count: number }[]> {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const rows = await prisma.$queryRawUnsafe(`
      SELECT DATE("createdAt")::text as date, COUNT(*)::int as count
      FROM "Store"
      WHERE "createdAt" >= $1::timestamptz
      GROUP BY DATE("createdAt")
      ORDER BY date
    `, cutoff) as unknown as { date: string; count: number }[];
    return rows;
  }

  async planDistribution(): Promise<{ planId: bigint | null; planName: string; count: number }[]> {
    const rows = await prisma.$queryRawUnsafe(`
      SELECT p.id as "planId", p.name as "planName", COUNT(s.id)::int as count
      FROM "Plan" p LEFT JOIN "Store" s ON s."planId" = p.id
      GROUP BY p.id, p.name
      ORDER BY count DESC
    `) as unknown as { planId: bigint | null; planName: string; count: number }[];
    return rows;
  }

  async mrrLast30d(): Promise<number> {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const rows = await prisma.billingSubscription.findMany({
      where: {
        status: "active",
        createdAt: { gte: cutoff },
      },
      select: { plan: { select: { priceMonthly: true } } },
    });
    let total = 0;
    for (const row of rows) {
      total += Number(row.plan?.priceMonthly ?? 0);
    }
    return Math.round(total * 100) / 100;
  }

  async getSuperStats(range: DateRange): Promise<{
    totalStores: number;
    activeStores: number;
    churnedLast30: number;
    newSignupsByDay: { date: string; count: number }[];
    planDistribution: { planId: bigint | null; planName: string; count: number }[];
    mrrLast30d: number;
  }> {
    void range;
    const [totalStores, activeStores, churnedLast30, newSignupsByDay, planDistribution, mrrLast30d] = await Promise.all([
      this.totalStores(),
      this.activeStores(),
      this.churnedStoresLast30d(),
      this.newSignupsByDayLast30d(),
      this.planDistribution(),
      this.mrrLast30d(),
    ]);
    return {
      totalStores,
      activeStores,
      churnedLast30,
      newSignupsByDay,
      planDistribution,
      mrrLast30d,
    };
  }
}

export class StoreDashboardRepo {
  private ctx: RequestContext;

  constructor(ctx: RequestContext) {
    this.ctx = ctx;
  }

  private storeWhere(): Record<string, unknown> {
    return this.ctx.storeId !== undefined ? { storeId: this.ctx.storeId } : {};
  }

  private inRange(from?: Date, to?: Date): { gte?: Date; lte?: Date } {
    const r: { gte?: Date; lte?: Date } = {};
    if (from) r.gte = from;
    if (to) r.lte = to;
    return r;
  }

  private startOfToday(): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private startOfYesterday(): Date {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private endOfYesterday(): Date {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    d.setHours(23, 59, 59, 999);
    return d;
  }

  private daysAgo(n: number): Date {
    const d = new Date();
    d.setDate(d.getDate() - n);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private startOfMonth(): Date {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private startOfYear(): Date {
    const d = new Date();
    d.setMonth(0, 1);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  async revenueInRange(from: Date, to: Date): Promise<number> {
    const result: any = await prisma.order.aggregate({
      where: {
        ...this.storeWhere(),
        paymentStatus: "PAID",
        createdAt: { gte: from, lte: to },
      },
      _sum: { grandTotal: true },
    });
    return Number(result._sum.grandTotal ?? 0);
  }

  async revenueToday(): Promise<number> {
    return this.revenueInRange(this.startOfToday(), new Date());
  }

  async revenueYesterday(): Promise<number> {
    return this.revenueInRange(this.startOfYesterday(), this.endOfYesterday());
  }

  async revenueLast7d(): Promise<number> {
    return this.revenueInRange(this.daysAgo(7), new Date());
  }

  async revenueLast30d(): Promise<number> {
    return this.revenueInRange(this.daysAgo(30), new Date());
  }

  async revenueMtd(): Promise<number> {
    return this.revenueInRange(this.startOfMonth(), new Date());
  }

  async revenueYtd(): Promise<number> {
    return this.revenueInRange(this.startOfYear(), new Date());
  }

  async top10Products(range: DateRange): Promise<unknown[]> {
    const createdAt = this.inRange(range.from, range.to);
    const rows = await prisma.$queryRawUnsafe(`
      SELECT p.id as "productId", p.name as "productName", p.sku,
             COALESCE(SUM(oi."lineSubtotal"),0)::float as revenue,
             COALESCE(SUM(oi.quantity),0)::int as qtySold
      FROM "OrderItem" oi
      JOIN "Order" o ON o.id = oi."orderId"
      JOIN "Product" p ON p.id = oi."productId"
      WHERE o."paymentStatus" = 'PAID'
        ${this.ctx.storeId !== undefined ? `AND o."storeId" = ${Number(this.ctx.storeId)}` : ""}
        ${range.from !== undefined ? `AND o."createdAt" >= '${range.from.toISOString()}'` : ""}
        ${range.to !== undefined ? `AND o."createdAt" <= '${range.to.toISOString()}'` : ""}
      GROUP BY p.id, p.name, p.sku
      ORDER BY revenue DESC
      LIMIT 10
    `) as unknown as unknown[];
    return rows;
  }

  async ordersByStatusPie(range: DateRange): Promise<{ status: string; count: number }[]> {
    const where: Record<string, unknown> = { ...this.storeWhere() };
    const createdAtRange = this.inRange(range.from, range.to);
    if (Object.keys(createdAtRange).length) where.createdAt = createdAtRange;
    const rows = await prisma.order.groupBy({
      by: ["status"],
      where: where as any,
      _count: { status: true },
    });
    return rows.map((r) => ({ status: String(r.status), count: Number(r._count.status) }));
  }

  async refundRatePct(range: DateRange): Promise<number> {
    const where: Record<string, unknown> = { ...this.storeWhere() };
    const createdAtRange = this.inRange(range.from, range.to);
    if (Object.keys(createdAtRange).length) where.createdAt = createdAtRange;
    const [orderCount, refundCount] = await Promise.all([
      prisma.order.count({ where: where as any }),
      prisma.refund.count({ where: where as any }),
    ]);
    return orderCount > 0 ? Math.round((refundCount / orderCount) * 10000) / 100 : 0;
  }

  async abandonedCartCountAndValue(range: DateRange): Promise<{ count: number; dollarValue: number }> {
    const where: Record<string, unknown> = { ...this.storeWhere() };
    const createdAtRange = this.inRange(range.from, range.to);
    if (Object.keys(createdAtRange).length) (where as any).cart = { createdAt: createdAtRange };
    const rows = await prisma.abandonedCart.findMany({
      where: where as any,
      select: { totalAmount: true },
    });
    const count = rows.length;
    const dollarValue = rows.reduce((acc: number, r: any) => acc + Number(r.totalAmount ?? 0), 0);
    return { count, dollarValue: Math.round(dollarValue * 100) / 100 };
  }

  async cltvP90(): Promise<number> {
    const where: Record<string, unknown> = this.storeWhere();
    const rows = await prisma.customer.findMany({
      where: where as any,
      select: { totalSpent: true },
      orderBy: { totalSpent: "asc" },
    });
    if (rows.length === 0) return 0;
    const idx = Math.max(0, Math.ceil(0.9 * rows.length) - 1);
    const approximate = Number(rows[idx]?.totalSpent ?? 0);
    return Math.round(approximate * 100) / 100;
  }

  async lowStockVariantCount(): Promise<number> {
    const where: Record<string, unknown> = {};
    if (this.ctx.storeId !== undefined) {
      (where as any).product = { storeId: this.ctx.storeId };
    }
    const variants = await prisma.productVariant.findMany({
      where: {
        manageStock: true,
        ...where,
      } as any,
      select: { stockQty: true, lowStockThreshold: true },
    });
    let count = 0;
    for (const v of variants) {
      const threshold = Number(v.lowStockThreshold ?? 10);
      if (Number(v.stockQty ?? 0) <= threshold) count++;
    }
    const products = await prisma.product.findMany({
      where: {
        manageStock: true,
        variants: { none: {} },
        ...this.storeWhere(),
      } as any,
      select: { stockQty: true, lowStockThreshold: true },
    });
    for (const p of products) {
      const threshold = Number(p.lowStockThreshold ?? 10);
      if (Number(p.stockQty ?? 0) <= threshold) count++;
    }
    return count;
  }

  async averageOrderValue(range: DateRange): Promise<number> {
    const where: Record<string, unknown> = {
      ...this.storeWhere(),
      paymentStatus: "PAID",
    };
    const createdAtRange = this.inRange(range.from, range.to);
    if (Object.keys(createdAtRange).length) where.createdAt = createdAtRange;
    const result: any = await prisma.order.aggregate({
      where: where as any,
      _avg: { grandTotal: true },
      _count: { grandTotal: true },
    });
    return result._count.grandTotal > 0 ? Math.round(Number(result._avg.grandTotal ?? 0) * 100) / 100 : 0;
  }

  async getStoreStats(range: DateRange): Promise<{
    revenue: {
      today: number;
      yesterday: number;
      last7d: number;
      last30d: number;
      mtd: number;
      ytd: number;
      rangeTotal: number;
    };
    top10Products: unknown[];
    ordersByStatusPie: { status: string; count: number }[];
    refundRatePct: number;
    abandonedCart: { count: number; dollarValue: number };
    cltvP90: number;
    lowStockVariantCount: number;
    averageOrderValue: number;
  }> {
    const [
      today,
      yesterday,
      last7d,
      last30d,
      mtd,
      ytd,
      top10Products,
      ordersByStatusPie,
      refundRatePct,
      abandonedCart,
      cltvP90,
      lowStockVariantCount,
      averageOrderValue,
    ] = await Promise.all([
      this.revenueToday(),
      this.revenueYesterday(),
      this.revenueLast7d(),
      this.revenueLast30d(),
      this.revenueMtd(),
      this.revenueYtd(),
      this.top10Products(range),
      this.ordersByStatusPie(range),
      this.refundRatePct(range),
      this.abandonedCartCountAndValue(range),
      this.cltvP90(),
      this.lowStockVariantCount(),
      this.averageOrderValue(range),
    ]);
    const rangeTotal = range.from && range.to ? await this.revenueInRange(range.from, range.to) : last30d;
    return {
      revenue: { today, yesterday, last7d, last30d, mtd, ytd, rangeTotal },
      top10Products,
      ordersByStatusPie,
      refundRatePct,
      abandonedCart,
      cltvP90,
      lowStockVariantCount,
      averageOrderValue,
    };
  }

  /**
   * Everything the store-admin dashboard home renders, in one call.
   * Revenue counts paid orders only (COD orders count once marked paid); order and
   * customer counts include every order in the window.
   */
  async getStoreOverview(days: number): Promise<{
    totals: { revenue: number; orders: number; customers: number; averageOrderValue: number };
    revenueChart: { date: string; revenue: number }[];
    topProducts: { id: string; name: string; sales: number; revenue: number }[];
    recentOrders: {
      id: string;
      orderNumber: string;
      customerName: string;
      date: string;
      status: string;
      paymentStatus: string;
      total: number;
    }[];
  }> {
    const since = this.daysAgo(days - 1);
    const storeId = this.ctx.storeId !== undefined ? BigInt(this.ctx.storeId) : null;

    const [paid, orders, customers, daily, top, recent] = await Promise.all([
      prisma.order.aggregate({
        where: { ...this.storeWhere(), paymentStatus: { in: ["PAID", "paid"] }, createdAt: { gte: since } } as any,
        _sum: { grandTotal: true },
        _count: { _all: true },
      }),
      prisma.order.count({ where: { ...this.storeWhere(), createdAt: { gte: since } } as any }),
      prisma.customer.count({ where: this.storeWhere() as any }),
      prisma.order.findMany({
        where: { ...this.storeWhere(), paymentStatus: { in: ["PAID", "paid"] }, createdAt: { gte: since } } as any,
        select: { createdAt: true, grandTotal: true },
      }),
      prisma.$queryRaw<{ id: bigint; name: string; sales: number; revenue: number }[]>`
        SELECT p.id, p.name, COALESCE(SUM(oi.quantity), 0)::int AS sales,
               COALESCE(SUM(oi."lineSubtotal"), 0)::float AS revenue
        FROM "OrderItem" oi
        JOIN "Order" o ON o.id = oi."orderId"
        JOIN "Product" p ON p.id = oi."productId"
        WHERE o.status NOT IN ('CANCELLED', 'FAILED')
          AND o."createdAt" >= ${since}
          AND (${storeId}::bigint IS NULL OR o."storeId" = ${storeId}::bigint)
        GROUP BY p.id, p.name
        ORDER BY sales DESC, revenue DESC
        LIMIT 5`,
      prisma.order.findMany({
        where: this.storeWhere() as any,
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          number: true,
          billingFirstName: true,
          billingLastName: true,
          createdAt: true,
          status: true,
          paymentStatus: true,
          grandTotal: true,
        },
      }),
    ]);

    // Bucket by the server's local calendar day, the same clock daysAgo() uses.
    const dayKey = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const byDay = new Map<string, number>();
    for (const o of daily) {
      const key = dayKey(o.createdAt);
      byDay.set(key, (byDay.get(key) ?? 0) + Number(o.grandTotal));
    }
    const revenueChart = Array.from({ length: days }, (_, i) => {
      const d = new Date(since);
      d.setDate(d.getDate() + i);
      return { date: dayKey(d), revenue: Math.round((byDay.get(dayKey(d)) ?? 0) * 100) / 100 };
    });

    const revenue = Number(paid._sum.grandTotal ?? 0);
    const paidCount = paid._count._all;
    return {
      totals: {
        revenue,
        orders,
        customers,
        averageOrderValue: paidCount > 0 ? Math.round((revenue / paidCount) * 100) / 100 : 0,
      },
      revenueChart,
      topProducts: top.map((t) => ({ id: String(t.id), name: t.name, sales: Number(t.sales), revenue: Number(t.revenue) })),
      recentOrders: recent.map((o) => ({
        id: String(o.id),
        orderNumber: o.number,
        customerName: [o.billingFirstName, o.billingLastName].filter(Boolean).join(" ") || "Guest",
        date: o.createdAt.toISOString(),
        status: String(o.status),
        paymentStatus: String(o.paymentStatus),
        total: Number(o.grandTotal),
      })),
    };
  }
}
