"use client";

/**
 * Payments staff check (API: modules/payments): bKash / Nagad / bank transfers to verify, cash on
 * delivery with couriers and at the shop, courier payouts, and payment method settings.
 */
import { api, toPaginated, type Paginated } from "@ecom/api-client";

export const METHOD_LABELS: Record<string, string> = {
  bkash: "bKash",
  nagad: "Nagad",
  rocket: "Rocket",
  bank_transfer: "Bank transfer",
  cod: "Cash on delivery",
  cash: "Cash",
  sslcommerz: "SSLCommerz",
  stripe: "Card (Stripe)",
};
export const methodLabel = (m?: string | null) => (m ? METHOD_LABELS[m] ?? m : "—");

export const TRANSFER_TABS = [
  { value: "to_verify", label: "To verify" },
  { value: "verified", label: "Verified" },
  { value: "rejected", label: "Rejected" },
] as const;

export const PAYMENT_LABELS: Record<string, string> = {
  to_verify: "To verify",
  verified: "Verified",
  rejected: "Rejected",
  with_courier: "With courier",
  cash_in_hand: "Cash in hand",
  received: "Received",
  not_collected: "Not collected",
};

export const PAYMENT_STYLES: Record<string, string> = {
  to_verify: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20",
  verified: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20",
  rejected: "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20",
  with_courier: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20",
  cash_in_hand: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20",
  received: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20",
  not_collected: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
};

export const SETTLEMENT_LABELS: Record<string, string> = { balanced: "Balanced", short: "Short", over: "Overpaid", resolved: "Settled" };
export const SETTLEMENT_STYLES: Record<string, string> = {
  balanced: PAYMENT_STYLES.received!,
  short: PAYMENT_STYLES.rejected!,
  over: PAYMENT_STYLES.to_verify!,
  resolved: PAYMENT_STYLES.not_collected!,
};

// ------------------------------------------------------------------ shapes

type Dec = string | number;

export interface PaymentOrderRef {
  id: string;
  number: string;
  status: string;
  grandTotal: number;
  paymentStatus: string;
  customerName: string;
  phone: string | null;
}

export interface PaymentRow {
  id: string;
  orderId: string;
  kind: "transfer" | "cod";
  method: string;
  amount: number;
  transactionId: string | null;
  senderNumber: string | null;
  status: string;
  moneyIsWith: string | null;
  courierCode: string | null;
  courierName: string | null;
  submittedBy: string;
  note: string | null;
  rejectReason: string | null;
  checkedAt: string | null;
  createdAt: string;
  settlement: { id: string; code: string } | null;
  shipment: { code: string; trackingNumber?: string | null } | null;
  order?: PaymentOrderRef;
}

export interface ApiPaymentRow {
  id: string;
  orderId: string;
  kind: "transfer" | "cod";
  method: string;
  amount: Dec;
  transactionId: string | null;
  senderNumber: string | null;
  status: string;
  moneyIsWith: string | null;
  courierCode: string | null;
  courierName: string | null;
  submittedBy: string;
  note: string | null;
  rejectReason: string | null;
  checkedAt: string | null;
  createdAt: string;
  settlement?: { id: string; code: string } | null;
  shipment?: { code: string; trackingNumber?: string | null } | null;
  order?: {
    id: string;
    number: string;
    status: string;
    grandTotal: Dec;
    paymentStatus: string;
    billingFirstName: string | null;
    billingLastName: string | null;
    billingPhone: string | null;
    shippingPhone: string | null;
  };
}

export function fromApiPayment(r: ApiPaymentRow): PaymentRow {
  return {
    ...r,
    amount: Number(r.amount),
    settlement: r.settlement ?? null,
    shipment: r.shipment ?? null,
    order: r.order
      ? {
          id: r.order.id,
          number: r.order.number,
          status: r.order.status,
          grandTotal: Number(r.order.grandTotal),
          paymentStatus: r.order.paymentStatus,
          customerName: [r.order.billingFirstName, r.order.billingLastName].filter(Boolean).join(" ") || "Guest",
          phone: r.order.shippingPhone ?? r.order.billingPhone,
        }
      : undefined,
  };
}

export interface CodSummary {
  withCourier: { count: number; amount: number };
  cashInHand: { count: number; amount: number };
  received: { count: number; amount: number };
  notCollected: { count: number; amount: number };
  notShipped: { count: number; amount: number };
  outstanding: { count: number; amount: number };
  shortfalls: { count: number; amount: number };
  byCourier: { courierCode: string | null; courierName: string | null; count: number; amount: number; oldest: string | null }[];
}

export interface Settlement {
  id: string;
  code: string;
  courierCode: string;
  courierName: string;
  reference: string | null;
  paidOn: string;
  expectedAmount: number;
  charges: number;
  receivedAmount: number;
  shortfall: number;
  status: string;
  note: string | null;
  resolvedNote: string | null;
  createdAt: string;
  recordCount: number;
  records?: PaymentRow[];
}

interface ApiSettlement {
  id: string;
  code: string;
  courierCode: string;
  courierName: string;
  reference: string | null;
  paidOn: string;
  expectedAmount: Dec;
  charges: Dec;
  receivedAmount: Dec;
  shortfall: Dec;
  status: string;
  note: string | null;
  resolvedNote: string | null;
  createdAt: string;
  _count?: { records: number };
  records?: ApiPaymentRow[];
}

const fromApiSettlement = (s: ApiSettlement): Settlement => ({
  ...s,
  expectedAmount: Number(s.expectedAmount),
  charges: Number(s.charges),
  receivedAmount: Number(s.receivedAmount),
  shortfall: Number(s.shortfall),
  recordCount: s._count?.records ?? s.records?.length ?? 0,
  records: s.records?.map(fromApiPayment),
});

export interface PaymentMethodSetting {
  id: string;
  code: string;
  name: string;
  description: string | null;
  enabled: boolean;
  sortOrder: number;
  instructions: string | null;
  mode: "manual" | "online";
  accountNumber: string | null;
  accountType: "personal" | "agent" | "merchant" | null;
  feeFixed: number;
  feePercent: number;
  manualCapable: boolean;
  /** bKash / SSLCommerz: can take payments online with the store's own merchant keys. */
  onlineCapable: boolean;
  keysSet: boolean;
  keysTestOk: boolean | null;
  keysTestedAt: string | null;
}

export interface GatewayKeys {
  code: "bkash" | "sslcommerz";
  mode: "sandbox" | "live";
  set: boolean;
  /** Saved values come back masked (secrets as dots), never in full. */
  fields: { key: string; label: string; secret: boolean; value: string | null }[];
  lastTest: { at: string; ok: boolean; note: string | null } | null;
  /** SSLCommerz: the payment notice (IPN) address to enter in its merchant panel. */
  ipnUrl?: string;
}

/** One try at paying an order online. */
export interface PaymentAttempt {
  id: string;
  gateway: string;
  code: string;
  amount: number;
  mode: "sandbox" | "live";
  /** started | paid | failed | cancelled | review */
  status: string;
  transactionId: string | null;
  note: string | null;
  createdAt: string;
  paidAt: string | null;
}

export interface OrderPayments {
  due: number;
  pending: boolean;
  canSubmit: boolean;
  records: PaymentRow[];
  attempts: PaymentAttempt[];
}

export interface PaymentListArgs {
  kind: "transfer" | "cod";
  status?: string;
  method?: string;
  courier?: string;
  search?: string;
  page?: number;
  perPage?: number;
}

const clean = <T extends object>(o: T) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== "")) as Partial<T>;

const TAGS = [
  { type: "Order" as const, id: "PAYMENTS" },
  { type: "Order" as const, id: "COD" },
  { type: "Order" as const, id: "LIST" },
];

export const paymentsApi = api.injectEndpoints({
  endpoints: (b) => ({
    listPayments: b.query<Paginated<PaymentRow> & { counts: Record<string, { count: number; amount: number }> }, PaymentListArgs>({
      query: (a) => ({ url: "/admin/payments", params: clean({ ...a }) }),
      transformResponse: (d: { items: ApiPaymentRow[]; counts: Record<string, { count: number; amount: number }> }, meta) => ({
        ...toPaginated(d.items.map(fromApiPayment), meta),
        counts: d.counts,
      }),
      providesTags: (_r, _e, a) => [{ type: "Order", id: a.kind === "cod" ? "COD" : "PAYMENTS" }],
    }),
    orderPayments: b.query<OrderPayments, string | number>({
      query: (id) => `/admin/orders/${id}/payments`,
      transformResponse: (d: Omit<OrderPayments, "records"> & { records: ApiPaymentRow[] }) => ({ ...d, records: d.records.map(fromApiPayment) }),
      providesTags: (_r, _e, id) => [{ type: "Order", id }, { type: "Order", id: "PAYMENTS" }],
    }),
    recordPayment: b.mutation<
      PaymentRow,
      { orderId: string | number; method?: string; transactionId: string; senderNumber?: string; amount?: number; note?: string; verified: boolean }
    >({
      query: ({ orderId, ...body }) => ({ url: `/admin/orders/${orderId}/payments`, method: "POST", body: clean(body) }),
      transformResponse: fromApiPayment,
      invalidatesTags: (_r, _e, { orderId }) => [{ type: "Order", id: orderId }, ...TAGS],
    }),
    verifyPayment: b.mutation<PaymentRow, { id: string; orderId: string | number; amount?: number; note?: string }>({
      query: ({ id, orderId: _o, ...body }) => ({ url: `/admin/payments/${id}/verify`, method: "POST", body: clean(body) }),
      transformResponse: fromApiPayment,
      invalidatesTags: (_r, _e, { orderId }) => [{ type: "Order", id: orderId }, ...TAGS],
    }),
    rejectPayment: b.mutation<PaymentRow, { id: string; orderId: string | number; reason: string }>({
      query: ({ id, orderId: _o, ...body }) => ({ url: `/admin/payments/${id}/reject`, method: "POST", body }),
      transformResponse: fromApiPayment,
      invalidatesTags: (_r, _e, { orderId }) => [{ type: "Order", id: orderId }, ...TAGS],
    }),
    markNotCollected: b.mutation<PaymentRow, { id: string; orderId: string | number; reason: string }>({
      query: ({ id, orderId: _o, ...body }) => ({ url: `/admin/payments/${id}/not-collected`, method: "POST", body }),
      transformResponse: fromApiPayment,
      invalidatesTags: (_r, _e, { orderId }) => [{ type: "Order", id: orderId }, ...TAGS],
    }),

    codSummary: b.query<CodSummary, void>({
      query: () => "/admin/cod/summary",
      providesTags: [{ type: "Order", id: "COD" }],
    }),
    confirmCash: b.mutation<{ received: number; amount: number }, { ids: string[]; note?: string }>({
      query: (body) => ({ url: "/admin/cod/confirm", method: "POST", body: clean(body) }),
      invalidatesTags: TAGS,
    }),
    listSettlements: b.query<Paginated<Settlement> & { counts: Record<string, number> }, { status?: string; courier?: string; page?: number }>({
      query: (a) => ({ url: "/admin/cod/settlements", params: clean({ ...a }) }),
      transformResponse: (d: { items: ApiSettlement[]; counts: Record<string, number> }, meta) => ({
        ...toPaginated(d.items.map(fromApiSettlement), meta),
        counts: d.counts,
      }),
      providesTags: [{ type: "Order", id: "COD" }],
    }),
    getSettlement: b.query<Settlement, string>({
      query: (id) => `/admin/cod/settlements/${id}`,
      transformResponse: fromApiSettlement,
      providesTags: [{ type: "Order", id: "COD" }],
    }),
    createSettlement: b.mutation<
      Settlement,
      { courierCode: string; recordIds?: string[]; charges: number; receivedAmount: number; reference?: string; paidOn: string; note?: string }
    >({
      query: (body) => ({ url: "/admin/cod/settlements", method: "POST", body: clean(body) }),
      transformResponse: fromApiSettlement,
      invalidatesTags: TAGS,
    }),
    resolveSettlement: b.mutation<Settlement, { id: string; note: string }>({
      query: ({ id, note }) => ({ url: `/admin/cod/settlements/${id}/resolve`, method: "POST", body: { note } }),
      transformResponse: fromApiSettlement,
      invalidatesTags: TAGS,
    }),

    paymentMethods: b.query<PaymentMethodSetting[], void>({
      query: () => "/admin/payment-methods",
      transformResponse: (rows: (Omit<PaymentMethodSetting, "feeFixed" | "feePercent"> & { feeFixed: Dec; feePercent: Dec })[]) =>
        rows.map((r) => ({ ...r, feeFixed: Number(r.feeFixed), feePercent: Number(r.feePercent) })),
      providesTags: [{ type: "Store", id: "PAYMENT_METHODS" }],
    }),
    updatePaymentMethod: b.mutation<PaymentMethodSetting, { code: string } & Partial<Omit<PaymentMethodSetting, "id" | "code" | "manualCapable" | "onlineCapable" | "keysSet" | "keysTestOk" | "keysTestedAt">>>({
      query: ({ code, ...body }) => ({ url: `/admin/payment-methods/${code}`, method: "PATCH", body }),
      invalidatesTags: [{ type: "Store", id: "PAYMENT_METHODS" }],
    }),
    gatewayKeys: b.query<GatewayKeys, string>({
      query: (code) => `/admin/payment-methods/${code}/keys`,
      providesTags: (_r, _e, code) => [{ type: "Store", id: `KEYS-${code}` }],
    }),
    saveGatewayKeys: b.mutation<GatewayKeys, { code: string; mode: "sandbox" | "live"; credentials: Record<string, string> }>({
      query: ({ code, ...body }) => ({ url: `/admin/payment-methods/${code}/keys`, method: "PUT", body }),
      invalidatesTags: (_r, _e, { code }) => [{ type: "Store", id: `KEYS-${code}` }, { type: "Store", id: "PAYMENT_METHODS" }],
    }),
    testGatewayKeys: b.mutation<{ ok: boolean; note: string }, string>({
      query: (code) => ({ url: `/admin/payment-methods/${code}/keys/test`, method: "POST" }),
      invalidatesTags: (_r, _e, code) => [{ type: "Store", id: `KEYS-${code}` }, { type: "Store", id: "PAYMENT_METHODS" }],
    }),
    recheckPaymentAttempt: b.mutation<{ status: string }, string>({
      query: (id) => ({ url: `/admin/payments/attempts/${id}/recheck`, method: "POST" }),
      invalidatesTags: TAGS,
    }),
  }),
});

export const {
  useListPaymentsQuery,
  useOrderPaymentsQuery,
  useRecordPaymentMutation,
  useVerifyPaymentMutation,
  useRejectPaymentMutation,
  useMarkNotCollectedMutation,
  useCodSummaryQuery,
  useConfirmCashMutation,
  useListSettlementsQuery,
  useGetSettlementQuery,
  useCreateSettlementMutation,
  useResolveSettlementMutation,
  usePaymentMethodsQuery,
  useUpdatePaymentMethodMutation,
  useGatewayKeysQuery,
  useSaveGatewayKeysMutation,
  useTestGatewayKeysMutation,
  useRecheckPaymentAttemptMutation,
} = paymentsApi;
