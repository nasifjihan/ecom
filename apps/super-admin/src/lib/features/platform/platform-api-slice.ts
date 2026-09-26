"use client";

import { api, toPaginated, type Paginated } from "@ecom/api-client";

/** Plan tiers as the super-admin UI labels them (API Plan.type BASIC/PRO/ENTERPRISE). */
export type PlanTier = "Free" | "Starter" | "Pro" | "Enterprise";
export type PlatformStoreStatus = "active" | "trial" | "suspended" | "cancelled";

export interface PlatformStore {
  id: string;
  logo: string;
  name: string;
  slug: string;
  domain: string;
  domains: { hostname: string; primary: boolean; type: string }[];
  ownerEmail: string;
  ownerName: string;
  plan: PlanTier;
  planName: string;
  planId: string | null;
  status: PlatformStoreStatus;
  trialExpires?: string;
  /** Monthly price of the store's active subscription; 0 without one. */
  mrr: number;
  orders: number;
  products: number;
  customers: number;
  createdDate: string;
  country: string;
}

export interface PlatformPlan {
  id: string;
  name: string;
  tier: PlanTier;
  priceMonthly: number;
  priceYearly: number;
  features: Record<string, unknown>;
  storesCount: number;
}

export interface PlatformSubscription {
  id: string;
  storeId: string;
  storeName: string;
  storeStatus: string;
  plan: string;
  price: number;
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  createdAt: string;
}

type ApiRow = Record<string, any>;

export const tierOf = (type?: string | null): PlanTier =>
  type === "BASIC" ? "Starter" : type === "PRO" ? "Pro" : type === "ENTERPRISE" ? "Enterprise" : "Free";

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

export function fromApiStore(s: ApiRow): PlatformStore {
  const domains: PlatformStore["domains"] = s.domains ?? [];
  const storefront = domains.find((d) => d.primary) ?? domains.find((d) => d.type === "storefront") ?? domains[0];
  const sub = s.billingSub;
  const status = String(s.status).toLowerCase();
  return {
    id: String(s.id),
    logo: initials(s.name),
    name: s.name,
    slug: s.slug,
    domain: storefront?.hostname ?? "—",
    domains,
    ownerEmail: s.admins?.[0]?.email ?? "—",
    ownerName: s.admins?.[0]?.name ?? "",
    plan: tierOf(s.plan?.type),
    planName: s.plan?.name ?? "No plan",
    planId: s.planId ?? null,
    status: (status === "closed" ? "cancelled" : status) as PlatformStoreStatus,
    trialExpires: s.trialEndsAt ? new Date(s.trialEndsAt).toLocaleDateString() : undefined,
    mrr: sub?.status === "active" ? Number(sub.plan?.priceMonthly ?? 0) : 0,
    orders: s._count?.orders ?? 0,
    products: s._count?.products ?? 0,
    customers: s._count?.customers ?? 0,
    createdDate: new Date(s.createdAt).toLocaleDateString(),
    country: s.generalSettings?.countryCode ?? "—",
  };
}

export interface PlatformStats {
  totalStores: number;
  activeStores: number;
  churnedLast30: number;
  newSignupsByDay: { date: string; count: number }[];
  planDistribution: { planId: string | null; planName: string; count: number }[];
  mrrLast30d: number;
}

export const platformApiSlice = api.injectEndpoints({
  endpoints: (builder) => ({
    // newSignupsByDay covers the last 30 days.
    getPlatformStats: builder.query<PlatformStats, void>({
      query: () => "/super/dashboard/stats",
    }),
    getStores: builder.query<Paginated<PlatformStore>, { page?: number; perPage?: number; search?: string }>({
      query: ({ page = 1, perPage = 50, search }) => {
        const params = new URLSearchParams({ page: String(page), perPage: String(perPage) });
        if (search) params.set("search", search);
        return `/super/stores?${params}`;
      },
      transformResponse: (rows: ApiRow[], meta) => toPaginated(rows.map(fromApiStore), meta),
      providesTags: [{ type: "Store", id: "LIST" }],
    }),
    getStore: builder.query<ApiRow, string>({
      query: (id) => `/super/stores/${id}`,
      providesTags: (_r, _e, id) => [{ type: "Store", id }],
    }),
    suspendStore: builder.mutation<void, string>({
      query: (id) => ({ url: `/super/stores/${id}/suspend`, method: "POST" }),
      invalidatesTags: (_r, _e, id) => [{ type: "Store", id }, { type: "Store", id: "LIST" }],
    }),
    activateStore: builder.mutation<void, string>({
      query: (id) => ({ url: `/super/stores/${id}/activate`, method: "POST" }),
      invalidatesTags: (_r, _e, id) => [{ type: "Store", id }, { type: "Store", id: "LIST" }],
    }),
    updateStore: builder.mutation<void, { id: string; body: { name?: string; planId?: string; status?: string } }>({
      query: ({ id, body }) => ({ url: `/super/stores/${id}`, method: "PATCH", body }),
      invalidatesTags: (_r, _e, { id }) => [{ type: "Store", id }, { type: "Store", id: "LIST" }],
    }),
    deleteStore: builder.mutation<void, string>({
      query: (id) => ({ url: `/super/stores/${id}`, method: "DELETE" }),
      invalidatesTags: [{ type: "Store", id: "LIST" }],
    }),
    // Plans come without store counts; count from the store list.
    getPlans: builder.query<PlatformPlan[], void>({
      queryFn: async (_arg, _api, _extra, baseQuery) => {
        const [plans, stores] = await Promise.all([baseQuery("/super/plans"), baseQuery("/super/stores?perPage=100")]);
        if (plans.error) return { error: plans.error };
        const counts = new Map<string, number>();
        for (const s of (stores.data as ApiRow[] | undefined) ?? []) {
          if (s.planId) counts.set(String(s.planId), (counts.get(String(s.planId)) ?? 0) + 1);
        }
        return {
          data: (plans.data as ApiRow[]).map((p) => ({
            id: String(p.id),
            name: p.name,
            tier: tierOf(p.type),
            priceMonthly: Number(p.priceMonthly),
            priceYearly: Number(p.priceYearly),
            features: p.features ?? {},
            storesCount: counts.get(String(p.id)) ?? 0,
          })),
        };
      },
      providesTags: [{ type: "Store", id: "PLANS" }],
    }),
    getSubscriptions: builder.query<Paginated<PlatformSubscription>, { page?: number; search?: string }>({
      query: ({ page = 1, search }) => {
        const params = new URLSearchParams({ page: String(page), perPage: "50" });
        if (search) params.set("search", search);
        return `/super/subscriptions?${params}`;
      },
      transformResponse: (rows: ApiRow[], meta) =>
        toPaginated(
          rows.map((r) => ({
            id: String(r.id),
            storeId: String(r.store?.id ?? r.storeId),
            storeName: r.store?.name ?? "—",
            storeStatus: r.store?.status ?? "",
            plan: r.plan?.name ?? "—",
            price: Number(r.plan?.priceMonthly ?? 0),
            status: r.status,
            currentPeriodEnd: r.currentPeriodEnd,
            cancelAtPeriodEnd: r.cancelAtPeriodEnd,
            createdAt: r.createdAt,
          })),
          meta,
        ),
      providesTags: [{ type: "Store", id: "SUBSCRIPTIONS" }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetPlatformStatsQuery,
  useGetStoresQuery,
  useGetStoreQuery,
  useSuspendStoreMutation,
  useActivateStoreMutation,
  useUpdateStoreMutation,
  useDeleteStoreMutation,
  useGetPlansQuery,
  useGetSubscriptionsQuery,
} = platformApiSlice;
