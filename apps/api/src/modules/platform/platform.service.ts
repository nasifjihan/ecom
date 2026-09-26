/**
 * PLATFORM (super admin) read models: dashboard, store overview, plans,
 * subscriptions, reports and audit logs. Everything here is cross-tenant,
 * so queries never filter by ctx.storeId.
 *
 * Money rules used throughout:
 *  - GMV / store revenue = grandTotal of orders not CANCELLED or FAILED (in the store currency).
 *  - MRR of a store = its plan's priceMonthly while the store is "active"; trial,
 *    suspended and cancelled stores contribute 0. There is no billing history table,
 *    so monthly MRR is rebuilt from each store's signup date and current plan.
 */
import os from "node:os";
import { Prisma } from "@prisma/client";
import { prisma, redis } from "../../config";
import { BaseService, NotFoundError, ConflictError, type RequestContext } from "../../core";
import type {
  CreatePlanDto,
  UpdatePlanDto,
  SubscriptionListQueryDto,
  UpdateSubscriptionDto,
  AuditLogQueryDto,
  ReportsQueryDto,
} from "./platform.dto";

const DAY = 24 * 60 * 60 * 1000;
const TYPE_COLORS: Record<string, string> = { BASIC: "#10b981", PRO: "#f59e0b", ENTERPRISE: "#f43f5e" };
const EXTRA_COLORS = ["#3b82f6", "#8b5cf6", "#06b6d4", "#64748b"];

/** Stable chart colour per plan: the built-in tiers keep theirs, other plans cycle by id. */
const planColor = (p: { id: bigint; name: string }) =>
  TYPE_COLORS[p.name] ?? EXTRA_COLORS[Number(p.id) % EXTRA_COLORS.length]!;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const round2 = (n: number) => Math.round(n * 100) / 100;
const pctChange = (cur: number, prev: number) => (prev === 0 ? (cur === 0 ? 0 : 100) : round2(((cur - prev) / prev) * 100));
const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** First day of the month `back` months before the current one, local time. */
function monthStart(back: number): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() - back, 1);
}

type StoreAgg = { storeId: bigint; orders: number; revenue: number };

export class PlatformService extends BaseService {
  constructor(ctx: RequestContext) {
    super(ctx);
  }

  /** Orders and GMV per store (all time), keyed by store id. */
  async storeAggregates(storeIds?: bigint[]): Promise<Map<string, StoreAgg>> {
    const filter = storeIds ? Prisma.sql`AND "storeId" IN (${Prisma.join(storeIds.length ? storeIds : [BigInt(-1)])})` : Prisma.empty;
    const rows = await prisma.$queryRaw<StoreAgg[]>`
      SELECT "storeId", COUNT(*)::int AS orders,
             COALESCE(SUM("grandTotal") FILTER (WHERE status NOT IN ('CANCELLED', 'FAILED')), 0)::float AS revenue
      FROM "Order"
      WHERE TRUE ${filter}
      GROUP BY "storeId"`;
    return new Map(rows.map((r) => [String(r.storeId), r]));
  }

  /** Email of each store's owner (the admin holding the "owner" role, else the oldest admin). */
  async ownerEmails(storeIds: bigint[]): Promise<Map<string, { name: string; email: string; phone: string | null }>> {
    const admins = await prisma.adminUser.findMany({
      where: { storeId: { in: storeIds } },
      select: { storeId: true, name: true, email: true, phone: true, createdAt: true, role: { select: { slug: true } } },
      orderBy: { createdAt: "asc" },
    });
    const out = new Map<string, { name: string; email: string; phone: string | null }>();
    for (const a of admins) {
      const key = String(a.storeId);
      if (!out.has(key) || a.role?.slug === "owner") out.set(key, { name: a.name, email: a.email, phone: a.phone });
    }
    return out;
  }

  private storeMrr(store: { status: string; plan?: { priceMonthly: Prisma.Decimal } | null }): number {
    return store.status === "active" && store.plan ? Number(store.plan.priceMonthly) : 0;
  }

  private async systemHealth() {
    const status = (ok: boolean, warn = false) => (!ok ? "critical" : warn ? "warning" : "good");
    const db = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false);
    const cache = await Promise.race([
      redis.ping().then((r) => r === "PONG"),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 1000)),
    ]).catch(() => false);
    const load = (os.loadavg()[0] ?? 0) / Math.max(1, os.cpus().length);
    const memUsed = 1 - os.freemem() / os.totalmem();
    return {
      cpu: load > 1.5 ? "critical" : load > 0.8 ? "warning" : "good",
      memory: memUsed > 0.95 ? "critical" : memUsed > 0.85 ? "warning" : "good",
      database: status(db),
      redis: status(cache),
    };
  }

  /* ============================== DASHBOARD ============================== */

  async dashboard() {
    const now = Date.now();
    const d30 = new Date(now - 30 * DAY);
    const d60 = new Date(now - 60 * DAY);
    const d7 = new Date(now - 7 * DAY);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [stores, plans, ordersCur, ordersPrev, activeAdmins, health, aggs] = await Promise.all([
      prisma.store.findMany({
        select: {
          id: true, name: true, status: true, createdAt: true, updatedAt: true, planId: true,
          plan: { select: { name: true, priceMonthly: true } },
          domains: { select: { hostname: true, type: true, primary: true } },
        },
      }),
      prisma.plan.findMany({ orderBy: { priceMonthly: "asc" } }),
      prisma.order.aggregate({
        where: { createdAt: { gte: d30 }, status: { notIn: ["CANCELLED", "FAILED"] } },
        _count: { _all: true },
        _sum: { grandTotal: true },
      }),
      prisma.order.aggregate({
        where: { createdAt: { gte: d60, lt: d30 }, status: { notIn: ["CANCELLED", "FAILED"] } },
        _count: { _all: true },
        _sum: { grandTotal: true },
      }),
      prisma.adminUser.count({ where: { status: "active" } }),
      this.systemHealth(),
      this.storeAggregates(),
    ]);

    const count = (s: string) => stores.filter((x) => x.status === s).length;
    const totalMRR = round2(stores.reduce((sum, s) => sum + this.storeMrr(s), 0));
    const paying = stores.filter((s) => this.storeMrr(s) > 0).length;
    const arpu = paying ? round2(totalMRR / paying) : 0;

    const newSince = (d: Date) => stores.filter((s) => s.createdAt >= d).length;
    const newSignups30d = newSince(d30);
    const newSignupsPrev30d = stores.filter((s) => s.createdAt >= d60 && s.createdAt < d30).length;

    // Churn: stores cancelled in the last 30 days over stores that existed 30 days ago.
    const existing30dAgo = stores.filter((s) => s.createdAt < d30).length;
    const churned = stores.filter((s) => s.status === "cancelled" && s.updatedAt >= d30).length;
    const churnRate = existing30dAgo ? round2((churned / existing30dAgo) * 100) : 0;

    let platformOrders = 0;
    let platformRevenue = 0;
    for (const a of aggs.values()) {
      platformOrders += a.orders;
      platformRevenue += a.revenue;
    }

    // MRR by plan for the last 12 months, from signup date and current plan.
    const monthlyMRR = Array.from({ length: 12 }, (_, i) => {
      const start = monthStart(11 - i);
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
      const row: Record<string, string | number> = { month: `${MONTHS[start.getMonth()]} ${String(start.getFullYear()).slice(2)}` };
      for (const p of plans) row[p.name] = 0;
      for (const s of stores) {
        if (s.createdAt >= end || !s.plan) continue;
        const mrr = this.storeMrr(s);
        if (mrr) row[s.plan.name] = round2(Number(row[s.plan.name] ?? 0) + mrr);
      }
      return row;
    });

    const plansDistribution = plans.map((p) => {
      const n = stores.filter((s) => s.planId === p.id).length;
      return { plan: p.name, count: n, value: n, color: planColor(p) };
    });
    const noPlan = stores.filter((s) => s.planId === null).length;
    if (noPlan) plansDistribution.push({ plan: "No plan", count: noPlan, value: noPlan, color: "#94a3b8" });

    const topStores = stores
      .map((s) => ({ s, agg: aggs.get(String(s.id)) }))
      .sort((a, b) => (b.agg?.revenue ?? 0) - (a.agg?.revenue ?? 0) || (b.agg?.orders ?? 0) - (a.agg?.orders ?? 0))
      .slice(0, 8)
      .map(({ s, agg }, i) => ({
        rank: i + 1,
        storeId: String(s.id),
        storeName: s.name,
        domain: this.primaryHost(s.domains),
        plan: s.plan?.name ?? "No plan",
        revenue: round2(agg?.revenue ?? 0),
        orders: agg?.orders ?? 0,
      }));

    const orders30 = ordersCur._count._all;
    const revenue30 = Number(ordersCur._sum.grandTotal ?? 0);

    return {
      totalStores: stores.length,
      activeStores: count("active"),
      trialStores: count("trial"),
      suspendedStores: count("suspended"),
      cancelledStores: count("cancelled"),
      totalMRR,
      payingStores: paying,
      newSignupsToday: newSince(today),
      newSignups7d: newSince(d7),
      newSignups30d,
      newSignupsDelta: pctChange(newSignups30d, newSignupsPrev30d),
      churnRate,
      arpu,
      platformOrders,
      platformRevenue: round2(platformRevenue),
      orders30d: orders30,
      ordersDelta: pctChange(orders30, ordersPrev._count._all),
      revenue30d: round2(revenue30),
      revenueDelta: pctChange(revenue30, Number(ordersPrev._sum.grandTotal ?? 0)),
      activeAdmins,
      systemHealth: health,
      planNames: plans.map((p) => ({ name: p.name, color: planColor(p) })),
      monthlyMRR,
      topStores,
      plansDistribution,
    };
  }

  private primaryHost(domains: { hostname: string; type: string; primary: boolean }[]): string {
    const sf = domains.filter((d) => d.type === "storefront");
    return (sf.find((d) => d.primary) ?? sf[0] ?? domains[0])?.hostname ?? "";
  }

  /* ============================ STORE OVERVIEW ============================ */

  async storeOverview(id: bigint) {
    const store = await prisma.store.findUnique({
      where: { id },
      include: {
        plan: true,
        billingSub: { include: { plan: true } },
        domains: { orderBy: { createdAt: "asc" } },
        generalSettings: { select: { phone: true, city: true, countryCode: true, tagline: true } },
      },
    });
    if (!store) throw new NotFoundError("store", id);

    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - 29);

    const [products, customers, admins, aggs, recent, auditLogs] = await Promise.all([
      prisma.product.count({ where: { storeId: id } }),
      prisma.customer.count({ where: { storeId: id } }),
      prisma.adminUser.findMany({
        where: { storeId: id },
        select: { id: true, name: true, email: true, phone: true, status: true, lastLoginAt: true, createdAt: true, role: { select: { name: true, slug: true } } },
        orderBy: { createdAt: "asc" },
      }),
      this.storeAggregates([id]),
      prisma.order.findMany({
        where: { storeId: id, createdAt: { gte: since } },
        select: { createdAt: true, grandTotal: true, status: true },
      }),
      prisma.auditLog.findMany({
        where: { storeId: id },
        orderBy: { createdAt: "desc" },
        take: 25,
        include: { admin: { select: { name: true, email: true } } },
      }),
    ]);

    const byDay = new Map<string, { revenue: number; orders: number }>();
    for (const o of recent) {
      const k = dayKey(o.createdAt);
      const cur = byDay.get(k) ?? { revenue: 0, orders: 0 };
      cur.orders += 1;
      if (o.status !== "CANCELLED" && o.status !== "FAILED") cur.revenue += Number(o.grandTotal);
      byDay.set(k, cur);
    }
    const daily = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(since);
      d.setDate(d.getDate() + i);
      const v = byDay.get(dayKey(d)) ?? { revenue: 0, orders: 0 };
      return { date: dayKey(d), day: `${d.getDate()} ${MONTHS[d.getMonth()]}`, revenue: round2(v.revenue), orders: v.orders };
    });

    const owner = admins.find((a) => a.role?.slug === "owner") ?? admins[0] ?? null;
    const agg = aggs.get(String(id));
    const features = (store.plan?.features ?? {}) as Record<string, unknown>;

    return {
      store: {
        id: String(store.id),
        name: store.name,
        slug: store.slug,
        status: store.status,
        trialEndsAt: store.trialEndsAt,
        createdAt: store.createdAt,
        plan: store.plan,
        billingSub: store.billingSub,
        domains: store.domains,
        primaryDomain: this.primaryHost(store.domains),
        settings: store.generalSettings,
      },
      owner,
      admins,
      mrr: this.storeMrr(store),
      stats: {
        products,
        customers,
        staff: admins.length,
        orders: agg?.orders ?? 0,
        revenue: round2(agg?.revenue ?? 0),
        orders30d: recent.length,
        revenue30d: round2(daily.reduce((s, d) => s + d.revenue, 0)),
      },
      quotas: [
        { key: "products", label: "Products", used: products, limit: Number(features.maxProducts ?? 0) || null },
        { key: "staff", label: "Staff users", used: admins.length, limit: Number(features.staffUsers ?? 0) || null },
      ],
      daily,
      auditLogs,
    };
  }

  /* ================================ PLANS ================================ */

  async listPlans() {
    const [plans, counts, subs] = await Promise.all([
      prisma.plan.findMany({ orderBy: { priceMonthly: "asc" } }),
      prisma.store.groupBy({ by: ["planId", "status"], _count: { _all: true } }),
      prisma.billingSubscription.groupBy({ by: ["planId"], _count: { _all: true } }),
    ]);
    return plans.map((p) => {
      const rows = counts.filter((c) => c.planId === p.id);
      const storeCount = rows.reduce((s, r) => s + r._count._all, 0);
      const activeStores = rows.filter((r) => r.status === "active").reduce((s, r) => s + r._count._all, 0);
      return {
        ...p,
        storeCount,
        activeStores,
        subscriptions: subs.find((s) => s.planId === p.id)?._count._all ?? 0,
        mrr: round2(activeStores * Number(p.priceMonthly)),
      };
    });
  }

  async createPlan(dto: CreatePlanDto) {
    const dup = await prisma.plan.findUnique({ where: { name: dto.name } });
    if (dup) throw new ConflictError(`A plan named "${dto.name}" already exists`, "CONFLICT");
    return prisma.plan.create({ data: { ...dto, features: dto.features as Prisma.InputJsonValue } });
  }

  async updatePlan(id: bigint, dto: UpdatePlanDto) {
    const plan = await prisma.plan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundError("plan", id);
    if (dto.name && dto.name !== plan.name) {
      const dup = await prisma.plan.findUnique({ where: { name: dto.name } });
      if (dup) throw new ConflictError(`A plan named "${dto.name}" already exists`, "CONFLICT");
    }
    const { features, ...rest } = dto;
    return prisma.plan.update({
      where: { id },
      data: { ...rest, ...(features ? { features: features as Prisma.InputJsonValue } : {}) },
    });
  }

  async deletePlan(id: bigint) {
    const plan = await prisma.plan.findUnique({ where: { id }, include: { _count: { select: { stores: true, billingSubs: true } } } });
    if (!plan) throw new NotFoundError("plan", id);
    if (plan._count.stores || plan._count.billingSubs) {
      throw new ConflictError("Move this plan's stores to another plan before deleting it", "CONFLICT");
    }
    await prisma.plan.delete({ where: { id } });
    return { id: String(id) };
  }

  /* ============================ SUBSCRIPTIONS ============================ */

  /**
   * One row per store. Stores without a BillingSubscription row still appear,
   * with their plan and a status derived from the store, so the table covers the platform.
   */
  async listSubscriptions(q: SubscriptionListQueryDto) {
    const where: Prisma.StoreWhereInput = {};
    if (q.search) {
      where.OR = [
        { name: { contains: q.search, mode: "insensitive" } },
        { slug: { contains: q.search, mode: "insensitive" } },
      ];
    }
    if (q.planId) where.planId = q.planId;
    const stores = await prisma.store.findMany({
      where,
      include: { plan: true, billingSub: { include: { plan: true } }, domains: { select: { hostname: true, type: true, primary: true } } },
      orderBy: { createdAt: "desc" },
    });
    const rows = stores.map((s) => {
      const plan = s.billingSub?.plan ?? s.plan;
      const status = s.billingSub?.status ?? (s.status === "trial" ? "trialing" : s.status === "active" ? "active" : s.status === "suspended" ? "past_due" : "cancelled");
      return {
        id: s.billingSub ? String(s.billingSub.id) : null,
        storeId: String(s.id),
        storeName: s.name,
        domain: this.primaryHost(s.domains),
        storeStatus: s.status,
        plan: plan ? { id: String(plan.id), name: plan.name, priceMonthly: Number(plan.priceMonthly), priceYearly: Number(plan.priceYearly) } : null,
        status,
        currentPeriodEnd: s.billingSub?.currentPeriodEnd ?? s.trialEndsAt ?? null,
        cancelAtPeriodEnd: s.billingSub?.cancelAtPeriodEnd ?? false,
        externalId: s.billingSub?.externalId ?? null,
        mrr: this.storeMrr(s),
        createdAt: s.billingSub?.createdAt ?? s.createdAt,
      };
    });
    const filtered = q.status ? rows.filter((r) => r.status === q.status) : rows;
    const summary = {
      total: rows.length,
      active: rows.filter((r) => r.status === "active").length,
      trialing: rows.filter((r) => r.status === "trialing").length,
      pastDue: rows.filter((r) => r.status === "past_due").length,
      cancelled: rows.filter((r) => r.status === "cancelled").length,
      mrr: round2(rows.reduce((s, r) => s + r.mrr, 0)),
    };
    return { items: filtered, summary };
  }

  /** Creates or updates the store's subscription row; a plan change also moves the store to that plan. */
  async upsertSubscription(storeId: bigint, dto: UpdateSubscriptionDto) {
    const store = await prisma.store.findUnique({ where: { id: storeId }, include: { billingSub: true } });
    if (!store) throw new NotFoundError("store", storeId);
    const planId = dto.planId ?? store.billingSub?.planId ?? store.planId;
    if (!planId) throw new ConflictError("Pick a plan for this store first", "CONFLICT");
    const plan = await prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundError("plan", planId);

    const data = {
      planId,
      ...(dto.status !== undefined ? { status: dto.status } : {}),
      ...(dto.currentPeriodEnd !== undefined ? { currentPeriodEnd: dto.currentPeriodEnd } : {}),
      ...(dto.cancelAtPeriodEnd !== undefined ? { cancelAtPeriodEnd: dto.cancelAtPeriodEnd } : {}),
    };
    return prisma.$transaction(async (tx) => {
      if (dto.planId && dto.planId !== store.planId) {
        await tx.store.update({ where: { id: storeId }, data: { planId: dto.planId } });
      }
      return tx.billingSubscription.upsert({
        where: { storeId },
        create: { storeId, status: dto.status ?? (store.status === "trial" ? "trialing" : "active"), ...data },
        update: data,
        include: { plan: true },
      });
    });
  }

  /* =============================== REPORTS =============================== */

  async reports(q: ReportsQueryDto) {
    const months = q.months;
    const from = monthStart(months - 1);

    const [orderRows, storeRows, customerRows, statusRows, byStore, stores] = await Promise.all([
      prisma.$queryRaw<{ month: string; orders: number; revenue: number; aov: number }[]>`
        SELECT to_char(date_trunc('month', "createdAt"), 'YYYY-MM') AS month,
               COUNT(*)::int AS orders,
               COALESCE(SUM("grandTotal") FILTER (WHERE status NOT IN ('CANCELLED', 'FAILED')), 0)::float AS revenue,
               COALESCE(AVG("grandTotal") FILTER (WHERE status NOT IN ('CANCELLED', 'FAILED')), 0)::float AS aov
        FROM "Order" WHERE "createdAt" >= ${from}
        GROUP BY 1`,
      prisma.$queryRaw<{ month: string; count: number }[]>`
        SELECT to_char(date_trunc('month', "createdAt"), 'YYYY-MM') AS month, COUNT(*)::int AS count
        FROM "Store" WHERE "createdAt" >= ${from} GROUP BY 1`,
      prisma.$queryRaw<{ month: string; count: number }[]>`
        SELECT to_char(date_trunc('month', "createdAt"), 'YYYY-MM') AS month, COUNT(*)::int AS count
        FROM "Customer" WHERE "createdAt" >= ${from} GROUP BY 1`,
      prisma.$queryRaw<{ status: string; count: number; revenue: number }[]>`
        SELECT status::text AS status, COUNT(*)::int AS count, COALESCE(SUM("grandTotal"), 0)::float AS revenue
        FROM "Order" WHERE "createdAt" >= ${from}
        GROUP BY 1 ORDER BY 2 DESC`,
      prisma.$queryRaw<{ storeId: bigint; orders: number; revenue: number; customers: number }[]>`
        SELECT o."storeId", COUNT(*)::int AS orders,
               COALESCE(SUM(o."grandTotal") FILTER (WHERE o.status NOT IN ('CANCELLED', 'FAILED')), 0)::float AS revenue,
               COUNT(DISTINCT o."billingEmail")::int AS customers
        FROM "Order" o WHERE o."createdAt" >= ${from}
        GROUP BY 1 ORDER BY revenue DESC LIMIT 10`,
      prisma.store.findMany({ select: { id: true, name: true, plan: { select: { name: true } } } }),
    ]);

    const idx = <T extends { month: string }>(rows: T[]) => new Map(rows.map((r) => [r.month, r]));
    const o = idx(orderRows);
    const s = idx(storeRows);
    const c = idx(customerRows);
    const monthly = Array.from({ length: months }, (_, i) => {
      const d = monthStart(months - 1 - i);
      const k = monthKey(d);
      return {
        month: `${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`,
        orders: o.get(k)?.orders ?? 0,
        revenue: round2(o.get(k)?.revenue ?? 0),
        aov: round2(o.get(k)?.aov ?? 0),
        newStores: s.get(k)?.count ?? 0,
        newCustomers: c.get(k)?.count ?? 0,
      };
    });

    const names = new Map(stores.map((st) => [String(st.id), st]));
    const totals = monthly.reduce(
      (t, m) => ({
        orders: t.orders + m.orders,
        revenue: round2(t.revenue + m.revenue),
        newStores: t.newStores + m.newStores,
        newCustomers: t.newCustomers + m.newCustomers,
      }),
      { orders: 0, revenue: 0, newStores: 0, newCustomers: 0 },
    );

    return {
      months,
      totals: { ...totals, aov: totals.orders ? round2(totals.revenue / totals.orders) : 0 },
      monthly,
      ordersByStatus: statusRows,
      topStores: byStore.map((r) => ({
        storeId: String(r.storeId),
        storeName: names.get(String(r.storeId))?.name ?? `Store ${r.storeId}`,
        plan: names.get(String(r.storeId))?.plan?.name ?? "No plan",
        orders: r.orders,
        revenue: round2(r.revenue),
        customers: r.customers,
      })),
    };
  }

  /* ============================== AUDIT LOGS ============================== */

  async auditLogs(q: AuditLogQueryDto) {
    const where: Prisma.AuditLogWhereInput = {};
    if (q.storeId) where.storeId = q.storeId;
    if (q.search) {
      where.OR = [
        { action: { contains: q.search, mode: "insensitive" } },
        { objectType: { contains: q.search, mode: "insensitive" } },
      ];
    }
    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (q.page - 1) * q.perPage,
        take: q.perPage,
        include: { admin: { select: { name: true, email: true } }, store: { select: { name: true } } },
      }),
      prisma.auditLog.count({ where }),
    ]);
    return { items, meta: { page: q.page, perPage: q.perPage, total, totalPages: Math.max(1, Math.ceil(total / q.perPage)) } };
  }
}
