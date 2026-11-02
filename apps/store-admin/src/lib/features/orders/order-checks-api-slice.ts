/** Orders > Confirm calls, the order page's checks panel and order editing (API: modules/orders/order-checks.routes, order-edit). */
import { api } from "@ecom/api-client";
import type { RiskLevel } from "@/lib/features/operations/operations-api-slice";

export interface OrderCheckSettings {
  riskWatchBelow: number;
  riskHighBelow: number;
  riskMinParcels: number;
  holdHighRisk: boolean;
  callRetryHours: number;
  callMaxTries: number;
  customerExchanges: boolean;
  exchangeFee: number;
}

type Record_ = { delivered: number; returned: number };

export interface OrderChecks {
  phone: string | null;
  now: { all: Record_; here: Record_; level: RiskLevel; rate: number | null } | null;
  atOrder: { level: RiskLevel; delivered: number; returned: number } | null;
  call: { status: CallOutcome | null; attempts: number; nextCallAt: string | null };
  calls: { id: string; outcome: CallOutcome; note: string | null; createdAt: string }[];
  blocked: { id: string; reason: string; createdAt: string } | null;
}

export const CALL_OUTCOMES = ["confirmed", "no_answer", "wrong_number", "fake", "cancelled"] as const;
export type CallOutcome = (typeof CALL_OUTCOMES)[number];
export const CALL_LABELS: Record<CallOutcome, string> = {
  confirmed: "Confirmed",
  no_answer: "No answer",
  wrong_number: "Wrong number",
  fake: "Fake order",
  cancelled: "Customer cancelled",
};
export const RISK_LABELS: Record<RiskLevel, string> = { new: "New number", good: "Good", watch: "Watch", high: "High risk" };
export const RISK_STYLES: Record<RiskLevel, string> = {
  new: "bg-slate-100 text-slate-700",
  good: "bg-emerald-100 text-emerald-700",
  watch: "bg-amber-100 text-amber-800",
  high: "bg-red-100 text-red-700",
};

export interface CallRow {
  id: string;
  number: string;
  createdAt: string;
  status: string;
  total: number;
  name: string;
  phone: string | null;
  city: string | null;
  risk: { level: RiskLevel; delivered: number; returned: number } | null;
  callStatus: CallOutcome | null;
  callAttempts: number;
  nextCallAt: string | null;
  items: number;
}
export type CallTab = "due" | "later" | "stuck";
type Meta = { page: number; perPage: number; total: number; totalPages: number };

export interface EditOrderBody {
  address?: {
    firstName: string;
    lastName: string;
    phone: string;
    addressLine1: string;
    addressLine2?: string;
    division?: string;
    district: string;
    upazila?: string;
    postcode?: string;
    locationId?: string | null;
  };
  items?: { orderItemId?: string | null; productId: string; variantId?: string | null; quantity: number }[];
  shippingTotal?: number;
  note?: string;
}

const orderTags = (id: string) => [{ type: "Order" as const, id }, { type: "Order" as const, id: "LIST" }, { type: "Order" as const, id: "CALLS" }];

const orderChecksApi = api.injectEndpoints({
  endpoints: (b) => ({
    getOrderCheckSettings: b.query<OrderCheckSettings, void>({ query: () => "/admin/order-checks/settings" }),
    saveOrderCheckSettings: b.mutation<OrderCheckSettings, OrderCheckSettings>({
      query: (body) => ({ url: "/admin/order-checks/settings", method: "PUT", body }),
      async onQueryStarted(_a, { dispatch, queryFulfilled }) {
        const { data } = await queryFulfilled;
        dispatch(orderChecksApi.util.updateQueryData("getOrderCheckSettings", undefined, () => data));
      },
    }),
    getCallList: b.query<{ items: CallRow[]; counts: Record<CallTab, number>; meta: Meta }, { tab: CallTab; page: number }>({
      query: (params) => ({ url: "/admin/order-checks/calls", params }),
      providesTags: [{ type: "Order", id: "CALLS" }],
    }),
    getOrderChecks: b.query<OrderChecks, string>({
      query: (id) => `/admin/order-checks/orders/${id}`,
      providesTags: (_r, _e, id) => [{ type: "Order", id: `checks-${id}` }],
    }),
    logCall: b.mutation<OrderChecks, { id: string; outcome: CallOutcome; note?: string; block?: boolean }>({
      query: ({ id, ...body }) => ({ url: `/admin/order-checks/orders/${id}/calls`, method: "POST", body }),
      invalidatesTags: (_r, _e, a) => [...orderTags(a.id), { type: "Order", id: `checks-${a.id}` }, { type: "Order", id: "BLOCKS" }],
    }),
    checkPhone: b.mutation<{ phone: string; all: Record_; here: Record_; level: RiskLevel; rate: number | null; blocked: boolean }, string>({
      query: (phone) => ({ url: "/admin/order-checks/phone", params: { phone } }),
    }),
    getCodBlocks: b.query<{ items: { id: string; phone: string; reason: string; createdAt: string }[]; meta: Meta }, { search?: string; page: number }>({
      query: (params) => ({ url: "/admin/order-checks/blocks", params }),
      providesTags: [{ type: "Order", id: "BLOCKS" }],
    }),
    blockPhone: b.mutation<unknown, { phone: string; reason: string; orderId?: string }>({
      query: ({ phone, reason }) => ({ url: "/admin/order-checks/blocks", method: "POST", body: { phone, reason } }),
      invalidatesTags: (_r, _e, a) => [{ type: "Order", id: "BLOCKS" }, ...(a.orderId ? [{ type: "Order" as const, id: `checks-${a.orderId}` }] : [])],
    }),
    unblockPhone: b.mutation<unknown, { id: string; orderId?: string }>({
      query: ({ id }) => ({ url: `/admin/order-checks/blocks/${id}`, method: "DELETE" }),
      invalidatesTags: (_r, _e, a) => [{ type: "Order", id: "BLOCKS" }, ...(a.orderId ? [{ type: "Order" as const, id: `checks-${a.orderId}` }] : [])],
    }),
    editOrder: b.mutation<{ changes: string[] }, { id: string } & EditOrderBody>({
      query: ({ id, ...body }) => ({ url: `/admin/orders/${id}/edit`, method: "PUT", body }),
      invalidatesTags: (_r, _e, a) => [...orderTags(a.id), { type: "Order", id: `checks-${a.id}` }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetOrderCheckSettingsQuery,
  useSaveOrderCheckSettingsMutation,
  useGetCallListQuery,
  useGetOrderChecksQuery,
  useLogCallMutation,
  useCheckPhoneMutation,
  useGetCodBlocksQuery,
  useBlockPhoneMutation,
  useUnblockPhoneMutation,
  useEditOrderMutation,
} = orderChecksApi;
