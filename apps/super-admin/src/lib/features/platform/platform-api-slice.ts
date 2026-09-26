"use client";

import { api, toPaginated, type Paginated } from "@ecom/api-client";

/* ============================== Shapes ============================== */

export type StoreStatus = "active" | "trial" | "suspended" | "cancelled";
export type SubscriptionStatus = "active" | "trialing" | "past_due" | "cancelled";

export interface PlanFeatures {
  maxProducts?: number;
  staffUsers?: number;
  storageGB?: number;
  customDomain?: boolean;
  enableDropshipping?: boolean;
  enableSubscriptions?: boolean;
  [key: string]: string | number | boolean | undefined;
}

export interface Plan {
  id: string;
  name: string;
  type: "BASIC" | "PRO" | "ENTERPRISE";
  priceMonthly: number;
  priceYearly: number;
  features: PlanFeatures;
  storeCount: number;
  activeStores: number;
  subscriptions: number;
  mrr: number;
  createdAt: string;
}

export interface PlanInput {
  name: string;
  type: Plan["type"];
  priceMonthly: number;
  priceYearly: number;
  features: PlanFeatures;
}

export interface StoreDomain {
  id?: string;
  storeId?: string;
  hostname: string;
  type: "storefront" | "admin";
  primary: boolean;
  sslEnabled?: boolean;
  createdAt?: string;
  store?: { id: string; name: string; status: StoreStatus };
}

export interface StoreRow {
  id: string;
  name: string;
  slug: string;
  status: StoreStatus;
  trialEndsAt: string | null;
  createdAt: string;
  plan: { id: string; name: string; priceMonthly: number } | null;
  primaryDomain: string | null;
  domains: StoreDomain[];
  owner: { name: string; email: string; phone: string | null } | null;
  orders: number;
  revenue: number;
  mrr: number;
}

export interface StoreListArgs {
  page?: number;
  perPage?: number;
  search?: string;
  status?: StoreStatus;
  planId?: string;
}

export interface StoreInput {
  name: string;
  slug: string;
  planId?: string;
  status?: StoreStatus;
  trialDays?: number;
}

export interface StoreAdmin {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: string;
  lastLoginAt: string | null;
  createdAt: string;
  role: { name: string; slug: string } | null;
}

export interface AuditLog {
  id: string;
  storeId: string;
  action: string;
  objectType: string;
  objectId: string;
  changes: unknown;
  ipAddress: string | null;
  createdAt: string;
  admin: { name: string; email: string } | null;
  store?: { name: string };
}

export interface StoreOverview {
  store: {
    id: string;
    name: string;
    slug: string;
    status: StoreStatus;
    trialEndsAt: string | null;
    createdAt: string;
    plan: (Omit<Plan, "storeCount" | "activeStores" | "subscriptions" | "mrr">) | null;
    billingSub: { id: string; status: SubscriptionStatus; currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean } | null;
    domains: StoreDomain[];
    primaryDomain: string;
    settings: { phone: string | null; city: string | null; countryCode: string | null; tagline: string | null } | null;
  };
  owner: StoreAdmin | null;
  admins: StoreAdmin[];
  mrr: number;
  stats: {
    products: number;
    customers: number;
    staff: number;
    orders: number;
    revenue: number;
    orders30d: number;
    revenue30d: number;
  };
  quotas: { key: string; label: string; used: number; limit: number | null }[];
  daily: { date: string; day: string; revenue: number; orders: number }[];
  auditLogs: AuditLog[];
}

export interface PlatformOverview {
  totalStores: number;
  activeStores: number;
  trialStores: number;
  suspendedStores: number;
  cancelledStores: number;
  totalMRR: number;
  payingStores: number;
  newSignupsToday: number;
  newSignups7d: number;
  newSignups30d: number;
  newSignupsDelta: number;
  churnRate: number;
  arpu: number;
  platformOrders: number;
  platformRevenue: number;
  orders30d: number;
  ordersDelta: number;
  revenue30d: number;
  revenueDelta: number;
  activeAdmins: number;
  systemHealth: { cpu: string; memory: string; database: string; redis: string };
  planNames: { name: string; color: string }[];
  monthlyMRR: Array<Record<string, string | number>>;
  topStores: { rank: number; storeId: string; storeName: string; domain: string; plan: string; revenue: number; orders: number }[];
  plansDistribution: { plan: string; count: number; value: number; color: string }[];
}

export interface SubscriptionRow {
  id: string | null;
  storeId: string;
  storeName: string;
  domain: string;
  storeStatus: StoreStatus;
  plan: { id: string; name: string; priceMonthly: number; priceYearly: number } | null;
  status: SubscriptionStatus;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  externalId: string | null;
  mrr: number;
  createdAt: string;
}

export interface SubscriptionSummary {
  total: number;
  active: number;
  trialing: number;
  pastDue: number;
  cancelled: number;
  mrr: number;
}

export interface PlatformReports {
  months: number;
  totals: { orders: number; revenue: number; newStores: number; newCustomers: number; aov: number };
  monthly: { month: string; orders: number; revenue: number; aov: number; newStores: number; newCustomers: number }[];
  ordersByStatus: { status: string; count: number; revenue: number }[];
  topStores: { storeId: string; storeName: string; plan: string; orders: number; revenue: number; customers: number }[];
}

export interface ApiAdminUser {
  id: string;
  storeId: string;
  email: string;
  phone: string | null;
  status: string;
  firstName: string;
  lastName: string;
  lastLoginAt: string | null;
  createdAt: string;
  role: { name: string; slug: string } | null;
}

/* ============================== Helpers ============================== */

/** Prisma Decimal columns arrive as strings. */
const num = (v: unknown) => (v === null || v === undefined || v === "" ? 0 : Number(v));

const toPlan = (p: any): Plan => ({
  ...p,
  priceMonthly: num(p.priceMonthly),
  priceYearly: num(p.priceYearly),
  features: (p.features ?? {}) as PlanFeatures,
});

const toStoreRow = (s: any): StoreRow => ({
  ...s,
  plan: s.plan ? { id: s.plan.id, name: s.plan.name, priceMonthly: num(s.plan.priceMonthly) } : null,
});

const clean = (o: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== "" && v !== "all"));

/* ============================== Endpoints ============================== */

export const platformApiSlice = api.injectEndpoints({
  endpoints: (builder) => ({
    getPlatformOverview: builder.query<PlatformOverview, void>({
      query: () => "/super/overview",
      providesTags: ["Store", "Plan", "Report"],
    }),

    getStores: builder.query<Paginated<StoreRow>, StoreListArgs>({
      query: (args) => ({ url: "/super/stores", params: clean({ perPage: 20, ...args }) }),
      transformResponse: (items: any[], meta) => toPaginated(items.map(toStoreRow), meta),
      providesTags: ["Store"],
    }),
    getStoreOverview: builder.query<StoreOverview, string>({
      query: (id) => `/super/stores/${id}/overview`,
      transformResponse: (o: any) => ({
        ...o,
        store: { ...o.store, plan: o.store.plan ? toPlan(o.store.plan) : null },
      }),
      providesTags: (_r, _e, id) => [{ type: "Store", id }, "Store"],
    }),
    createStore: builder.mutation<StoreRow, StoreInput>({
      query: (body) => ({ url: "/super/stores", method: "POST", body: clean(body as never) }),
      invalidatesTags: ["Store", "Plan", "Subscription"],
    }),
    updateStore: builder.mutation<StoreRow, { id: string } & Partial<StoreInput>>({
      query: ({ id, ...body }) => ({ url: `/super/stores/${id}`, method: "PATCH", body: clean(body as never) }),
      invalidatesTags: ["Store", "Plan", "Subscription"],
    }),
    setStoreStatus: builder.mutation<StoreRow, { id: string; action: "suspend" | "activate" }>({
      query: ({ id, action }) => ({ url: `/super/stores/${id}/${action}`, method: "POST", body: {} }),
      invalidatesTags: ["Store", "Plan", "Subscription"],
    }),

    getDomains: builder.query<StoreDomain[], { storeId?: string } | void>({
      query: (args) => ({ url: "/super/domains", params: clean({ ...(args ?? {}) }) }),
      providesTags: ["Domain"],
    }),
    createDomain: builder.mutation<StoreDomain, { storeId: string; hostname: string; type: "storefront" | "admin"; primary?: boolean }>({
      query: (body) => ({ url: "/super/domains", method: "POST", body }),
      invalidatesTags: ["Domain", "Store"],
    }),
    updateDomain: builder.mutation<StoreDomain, { id: string; primary?: boolean; sslEnabled?: boolean; hostname?: string }>({
      query: ({ id, ...body }) => ({ url: `/super/domains/${id}`, method: "PATCH", body }),
      invalidatesTags: ["Domain", "Store"],
    }),
    deleteDomain: builder.mutation<void, string>({
      query: (id) => ({ url: `/super/domains/${id}`, method: "DELETE" }),
      invalidatesTags: ["Domain", "Store"],
    }),

    getPlans: builder.query<Plan[], void>({
      query: () => "/super/plans",
      transformResponse: (rows: any[]) => rows.map(toPlan),
      providesTags: ["Plan"],
    }),
    createPlan: builder.mutation<Plan, PlanInput>({
      query: (body) => ({ url: "/super/plans", method: "POST", body }),
      invalidatesTags: ["Plan"],
    }),
    updatePlan: builder.mutation<Plan, { id: string } & Partial<PlanInput>>({
      query: ({ id, ...body }) => ({ url: `/super/plans/${id}`, method: "PATCH", body }),
      invalidatesTags: ["Plan", "Store", "Subscription"],
    }),
    deletePlan: builder.mutation<void, string>({
      query: (id) => ({ url: `/super/plans/${id}`, method: "DELETE" }),
      invalidatesTags: ["Plan"],
    }),

    getSubscriptions: builder.query<
      { items: SubscriptionRow[]; summary: SubscriptionSummary },
      { search?: string; status?: SubscriptionStatus | "all"; planId?: string }
    >({
      query: (args) => ({ url: "/super/subscriptions", params: clean(args) }),
      transformResponse: (items: SubscriptionRow[], meta) => ({ items, summary: meta as SubscriptionSummary }),
      providesTags: ["Subscription"],
    }),
    updateSubscription: builder.mutation<
      unknown,
      { storeId: string; planId?: string; status?: SubscriptionStatus; cancelAtPeriodEnd?: boolean; currentPeriodEnd?: string | null }
    >({
      query: ({ storeId, ...body }) => ({ url: `/super/stores/${storeId}/subscription`, method: "PUT", body }),
      invalidatesTags: ["Subscription", "Store", "Plan"],
    }),

    getPlatformReports: builder.query<PlatformReports, { months: number }>({
      query: ({ months }) => ({ url: "/super/reports", params: { months } }),
      providesTags: ["Report"],
    }),

    getAuditLogs: builder.query<Paginated<AuditLog>, { page?: number; storeId?: string; search?: string }>({
      query: (args) => ({ url: "/super/audit-logs", params: clean({ perPage: 25, ...args }) }),
      transformResponse: (items: AuditLog[], meta) => toPaginated(items, meta),
    }),

    getStoreAdmins: builder.query<Paginated<ApiAdminUser>, { page?: number; search?: string }>({
      query: (args) => ({ url: "/super/admin-users", params: clean({ perPage: 25, ...args }) }),
      transformResponse: (items: ApiAdminUser[], meta) => toPaginated(items, meta),
      providesTags: ["User"],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetPlatformOverviewQuery,
  useGetStoresQuery,
  useGetStoreOverviewQuery,
  useCreateStoreMutation,
  useUpdateStoreMutation,
  useSetStoreStatusMutation,
  useGetDomainsQuery,
  useCreateDomainMutation,
  useUpdateDomainMutation,
  useDeleteDomainMutation,
  useGetPlansQuery,
  useCreatePlanMutation,
  useUpdatePlanMutation,
  useDeletePlanMutation,
  useGetSubscriptionsQuery,
  useUpdateSubscriptionMutation,
  useGetPlatformReportsQuery,
  useGetAuditLogsQuery,
  useGetStoreAdminsQuery,
} = platformApiSlice;

/** First validation message from an RTK Query error, for toasts. */
export function apiErrorMessage(err: unknown, fallback = "Something went wrong"): string {
  let data = (err as { data?: unknown })?.data;
  if (typeof data === "string") return data;
  // Non-2xx responses carry the raw envelope: prefer field errors, then the message.
  if (data && typeof data === "object" && "success" in data) {
    const env = data as { message?: string; errors?: Record<string, string[]> };
    if (!env.errors || !Object.keys(env.errors).length) return env.message ?? fallback;
    data = env.errors;
  }
  if (data && typeof data === "object") {
    const first = Object.entries(data as Record<string, string[] | string>)[0];
    if (first) return Array.isArray(first[1]) ? `${first[0]}: ${first[1][0]}` : String(first[1]);
  }
  return fallback;
}

export const formatMoney = (n: number, currency: "USD" | "BDT" = "USD") =>
  currency === "BDT"
    ? `৳${n.toLocaleString("en-BD", { maximumFractionDigits: 0 })}`
    : `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

export const formatDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";
