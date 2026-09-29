"use client";

/** Sales team: commission, targets, payouts, and my commission (API: /admin/sales). */
import { api } from "@ecom/api-client";

export type CommissionState = "PENDING" | "EARNED" | "PAID" | "CANCELLED";

export interface MonthSummary {
  sales: number;
  earned: number;
  orders: number;
  pending: number;
  pendingOrders: number;
  unpaid: number;
  target: number | null;
  progress: number | null;
}

export interface Salesperson extends MonthSummary {
  id: string;
  name: string;
  email: string;
  active: boolean;
  extraPct: number;
  salesCode: string | null;
}

export interface SalesTeam {
  month: string;
  settings: { enabled: boolean; defaultRate: number };
  team: Salesperson[];
  totals: { sales: number; earned: number; pending: number; unpaid: number };
  otherStaff: { id: string; name: string; email: string }[];
}

export interface CommissionRow {
  id: string;
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  paymentStatus: string;
  customer: string;
  orderedAt: string;
  salesperson: { id: string; name: string };
  state: CommissionState;
  base: number;
  amount: number;
  earnedAt: string | null;
  paidOutAt: string | null;
  lines: { name: string; base: number; rate: number; source: string; amount: number }[];
}

export type MyCommission =
  | { isSalesperson: false }
  | (MonthSummary & { isSalesperson: true; month: string; enabled: boolean; salesCode: string | null; extraPct: number; rows: CommissionRow[] });

export interface OrderCommission {
  salesperson: { id: string; name: string } | null;
  commission: CommissionRow | null;
}

const TEAM = { type: "Report" as const, id: "SALES" };
const clean = (o: object) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== ""));

export const salesApi = api.injectEndpoints({
  endpoints: (b) => ({
    salesTeam: b.query<SalesTeam, string>({ query: (month) => ({ url: "/admin/sales/team", params: { month } }), providesTags: [TEAM] }),
    commissions: b.query<CommissionRow[], { month: string; salespersonId?: string; state?: CommissionState }>({
      query: (params) => ({ url: "/admin/sales/commissions", params: clean(params) }),
      providesTags: [TEAM],
    }),
    updateSalesSettings: b.mutation<SalesTeam["settings"], Partial<SalesTeam["settings"]>>({
      query: (body) => ({ url: "/admin/sales/settings", method: "PATCH", body }),
      invalidatesTags: [TEAM],
    }),
    updateSalesperson: b.mutation<{ id: string }, { id: string; isSalesperson?: boolean; extraPct?: number; salesCode?: string | null }>({
      query: ({ id, ...body }) => ({ url: `/admin/sales/salespeople/${id}`, method: "PATCH", body }),
      invalidatesTags: [TEAM, "Me"],
    }),
    setSalesTarget: b.mutation<unknown, { id: string; month: string; amount: number | null }>({
      query: ({ id, ...body }) => ({ url: `/admin/sales/salespeople/${id}/target`, method: "PUT", body }),
      invalidatesTags: [TEAM],
    }),
    payoutCommission: b.mutation<{ orders: number; amount: number }, { id: string; month: string }>({
      query: ({ id, ...body }) => ({ url: `/admin/sales/salespeople/${id}/payout`, method: "POST", body }),
      invalidatesTags: [TEAM],
    }),
    salespeople: b.query<{ id: string; name: string }[], void>({ query: () => "/admin/sales/salespeople", providesTags: [TEAM] }),
    orderCommission: b.query<OrderCommission, string>({
      query: (id) => `/admin/sales/orders/${id}`,
      providesTags: (_r, _e, id) => [TEAM, { type: "Order" as const, id }],
    }),
    setOrderSalesperson: b.mutation<OrderCommission, { orderId: string; salespersonId: string | null }>({
      query: ({ orderId, salespersonId }) => ({ url: `/admin/sales/orders/${orderId}`, method: "PUT", body: { salespersonId } }),
      invalidatesTags: (_r, _e, { orderId }) => [TEAM, { type: "Order" as const, id: orderId }],
    }),
    myCommission: b.query<MyCommission, string>({ query: (month) => ({ url: "/admin/sales/me", params: { month } }), providesTags: [TEAM] }),
  }),
});

export const {
  useSalesTeamQuery,
  useCommissionsQuery,
  useUpdateSalesSettingsMutation,
  useUpdateSalespersonMutation,
  useSetSalesTargetMutation,
  usePayoutCommissionMutation,
  useSalespeopleQuery,
  useOrderCommissionQuery,
  useSetOrderSalespersonMutation,
  useMyCommissionQuery,
} = salesApi;

export const COMMISSION_STATE_LABELS: Record<CommissionState, string> = {
  PENDING: "Waiting (not delivered and paid yet)",
  EARNED: "Earned",
  PAID: "Paid out",
  CANCELLED: "Cancelled",
};

export const COMMISSION_STATE_STYLE: Record<CommissionState, string> = {
  PENDING: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200",
  EARNED: "border-green-300 bg-green-50 text-green-800 dark:border-green-700 dark:bg-green-950 dark:text-green-200",
  PAID: "border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
  CANCELLED: "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300",
};

/** This month and the ones before it, newest first, for month pickers. */
export function recentMonths(count = 12): { value: string; label: string }[] {
  const now = new Date(Date.now() + 6 * 3600_000);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    return {
      value: d.toISOString().slice(0, 7),
      label: d.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }),
    };
  });
}
