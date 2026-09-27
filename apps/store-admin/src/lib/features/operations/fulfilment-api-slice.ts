"use client";

/**
 * Parcels, returns and refunds (API: modules/fulfilment).
 * /admin/orders/:id/shipments|returns|refunds, /admin/shipments, /admin/returns.
 */
import { api, toPaginated, type Paginated } from "@ecom/api-client";

export const PARCEL_STATUSES = [
  "ready",
  "picked_up",
  "in_transit",
  "out_for_delivery",
  "delivered",
  "failed",
  "returned",
  "cancelled",
] as const;
export type ParcelStatus = (typeof PARCEL_STATUSES)[number];

/** Same moves the API allows (fulfilment.rules.ts PARCEL_NEXT). */
export const PARCEL_NEXT: Record<ParcelStatus, ParcelStatus[]> = {
  ready: ["picked_up", "in_transit", "cancelled"],
  picked_up: ["in_transit", "out_for_delivery", "delivered", "failed", "returned"],
  in_transit: ["out_for_delivery", "delivered", "failed", "returned"],
  out_for_delivery: ["delivered", "failed", "returned"],
  failed: ["in_transit", "out_for_delivery", "returned"],
  delivered: [],
  returned: [],
  cancelled: [],
};

export const PARCEL_LABELS: Record<ParcelStatus, string> = {
  ready: "Ready to ship",
  picked_up: "Picked up",
  in_transit: "In transit",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  failed: "Delivery failed",
  returned: "Returned to us",
  cancelled: "Cancelled",
};

export const PARCEL_STYLES: Record<ParcelStatus, string> = {
  ready: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-500/10 dark:text-slate-300 dark:border-slate-500/20",
  picked_up: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20",
  in_transit: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20",
  out_for_delivery: "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-500/10 dark:text-cyan-400 dark:border-cyan-500/20",
  delivered: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20",
  failed: "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20",
  returned: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-500/20",
  cancelled: "bg-slate-100 text-slate-500 border-slate-200 line-through dark:bg-slate-800 dark:text-slate-500 dark:border-slate-700",
};

export const COURIERS = [
  { code: "pathao", name: "Pathao" },
  { code: "steadfast", name: "Steadfast" },
  { code: "redx", name: "RedX" },
  { code: "paperfly", name: "Paperfly" },
  { code: "ecourier", name: "eCourier" },
  { code: "sundarban", name: "Sundarban Courier" },
  { code: "sa_paribahan", name: "SA Paribahan" },
  { code: "own", name: "Own delivery" },
  { code: "other", name: "Other" },
] as const;

export const RETURN_STATUSES = ["requested", "approved", "received", "refunded", "rejected", "cancelled"] as const;
export type ReturnStatus = (typeof RETURN_STATUSES)[number];

/** Moves staff make by hand; "refunded" is reached by issuing a refund. */
export const RETURN_NEXT: Record<ReturnStatus, ReturnStatus[]> = {
  requested: ["approved", "received", "rejected", "cancelled"],
  approved: ["received", "cancelled"],
  received: ["rejected"],
  refunded: [],
  rejected: [],
  cancelled: [],
};

export const RETURN_LABELS: Record<ReturnStatus, string> = {
  requested: "Requested",
  approved: "Approved",
  received: "Received",
  refunded: "Refunded",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

export const RETURN_STYLES: Record<ReturnStatus, string> = {
  requested: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20",
  approved: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20",
  received: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20",
  refunded: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/20",
  rejected: "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20",
  cancelled: "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-500 dark:border-slate-700",
};

export const RETURN_REASONS = [
  { value: "wrong_size", label: "Wrong size" },
  { value: "damaged", label: "Damaged or faulty" },
  { value: "not_as_described", label: "Not as described" },
  { value: "wrong_item", label: "Wrong item sent" },
  { value: "changed_mind", label: "Changed mind" },
  { value: "other", label: "Other" },
] as const;
export const reasonLabel = (r?: string | null) => RETURN_REASONS.find((x) => x.value === r)?.label ?? r ?? "—";

export const REFUND_METHODS = [
  { value: "original", label: "Original payment method" },
  { value: "cash", label: "Cash" },
  { value: "bkash", label: "bKash" },
  { value: "nagad", label: "Nagad" },
  { value: "bank", label: "Bank transfer" },
  { value: "store_credit", label: "Store credit" },
] as const;
export type RefundMethod = (typeof REFUND_METHODS)[number]["value"];
export const refundMethodLabel = (m?: string | null) => REFUND_METHODS.find((x) => x.value === m)?.label ?? m ?? "—";

export const FULFILLMENT_LABELS: Record<string, string> = {
  unfulfilled: "Not packed",
  partial: "Partly packed",
  packed: "Packed",
  shipped: "Shipped",
  delivered: "Delivered",
  delivery_failed: "Delivery failed",
  returned: "Returned",
};
export const FULFILLMENT_STYLES: Record<string, string> = {
  unfulfilled: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
  partial: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20",
  packed: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20",
  shipped: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20",
  delivered: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20",
  delivery_failed: "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20",
  returned: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-500/20",
};

// ------------------------------------------------------------------ shapes

export interface StatusEvent {
  id: string;
  status: string;
  note: string | null;
  adminId: string | null;
  createdAt: string;
}

export interface Parcel {
  id: string;
  orderId: string;
  code: string;
  status: ParcelStatus;
  providerCode: string | null;
  providerName: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  codAmount: number;
  weightKg: number | null;
  notes: string | null;
  failedReason: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  returnedAt: string | null;
  createdAt: string;
  items: { orderItemId: string; quantity: number; name?: string }[];
  events: StatusEvent[];
}

export interface ReturnRequest {
  id: string;
  orderId: string;
  code: string;
  status: ReturnStatus;
  reason: string | null;
  customerNote: string | null;
  adminNotes: string | null;
  requestedBy: string;
  requestedAmount: number;
  createdAt: string;
  approvedAt: string | null;
  receivedAt: string | null;
  closedAt: string | null;
  items: { id: string; orderItemId: string; quantity: number; condition: string | null; restocked: boolean; name?: string }[];
  events: StatusEvent[];
}

export interface RefundRow {
  id: string;
  amount: number;
  reason: string | null;
  method: string;
  returnRequestId: string | null;
  gatewayRefunded: boolean;
  createdAt: string;
  items: { orderItemId: string; quantity: number; amount: number }[];
}

/** A row on the Shipments / Returns pages: the parcel or return with a few order fields. */
export interface OrderRef {
  id: string;
  number: string;
  customerName: string;
  phone: string | null;
  paymentMethod: string;
  area?: string;
}

interface ApiItem {
  id?: string;
  orderItemId: string;
  quantity: number;
  condition?: string | null;
  restocked?: boolean;
  amount?: string | number;
  orderItem?: { productName: string; variantValues: Record<string, string> | null } | null;
}
const itemName = (i: ApiItem) =>
  i.orderItem
    ? i.orderItem.variantValues
      ? `${i.orderItem.productName} (${Object.values(i.orderItem.variantValues).join(" / ")})`
      : i.orderItem.productName
    : undefined;

/** Order fields the Shipments / Returns lists include. */
interface ApiOrderRef {
  id: string;
  number: string;
  paymentGatewayCode?: string | null;
  billingFirstName?: string | null;
  billingLastName?: string | null;
  shippingFirstName?: string | null;
  shippingLastName?: string | null;
  shippingPhone?: string | null;
  billingPhone?: string | null;
  shippingCity?: string | null;
  shippingUpazila?: string | null;
}

/** Decimals arrive as strings. */
type Dec = string | number;

export interface ApiParcel {
  id: string;
  orderId: string;
  code: string;
  status: ParcelStatus;
  providerCode?: string | null;
  providerName?: string | null;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  codAmount?: Dec | null;
  weightKg?: Dec | null;
  notes?: string | null;
  failedReason?: string | null;
  shippedAt?: string | null;
  deliveredAt?: string | null;
  returnedAt?: string | null;
  createdAt: string;
  items?: ApiItem[];
  events?: StatusEvent[];
  order?: ApiOrderRef;
}

export interface ApiReturn {
  id: string;
  orderId: string;
  code: string;
  status: ReturnStatus;
  reason?: string | null;
  customerNote?: string | null;
  adminNotes?: string | null;
  requestedBy?: string | null;
  requestedAmount?: Dec | null;
  createdAt: string;
  approvedAt?: string | null;
  receivedAt?: string | null;
  closedAt?: string | null;
  items?: ApiItem[];
  events?: StatusEvent[];
  order?: ApiOrderRef;
}

export interface ApiRefund {
  id: string;
  amount: Dec;
  reason?: string | null;
  method?: string | null;
  returnRequestId?: string | null;
  gatewayRefunded?: boolean;
  createdAt: string;
  items?: ApiItem[];
}

export function fromApiParcel(p: ApiParcel): Parcel {
  return {
    id: p.id,
    orderId: p.orderId,
    code: p.code,
    status: p.status,
    providerCode: p.providerCode ?? null,
    providerName: p.providerName ?? null,
    trackingNumber: p.trackingNumber ?? null,
    trackingUrl: p.trackingUrl ?? null,
    codAmount: Number(p.codAmount ?? 0),
    weightKg: p.weightKg == null ? null : Number(p.weightKg),
    notes: p.notes ?? null,
    failedReason: p.failedReason ?? null,
    shippedAt: p.shippedAt ?? null,
    deliveredAt: p.deliveredAt ?? null,
    returnedAt: p.returnedAt ?? null,
    createdAt: p.createdAt,
    items: (p.items ?? []).map((i) => ({ orderItemId: i.orderItemId, quantity: i.quantity, name: itemName(i) })),
    events: p.events ?? [],
  };
}

export function fromApiReturn(r: ApiReturn): ReturnRequest {
  return {
    id: r.id,
    orderId: r.orderId,
    code: r.code,
    status: r.status,
    reason: r.reason ?? null,
    customerNote: r.customerNote ?? null,
    adminNotes: r.adminNotes ?? null,
    requestedBy: r.requestedBy ?? "customer",
    requestedAmount: Number(r.requestedAmount ?? 0),
    createdAt: r.createdAt,
    approvedAt: r.approvedAt ?? null,
    receivedAt: r.receivedAt ?? null,
    closedAt: r.closedAt ?? null,
    items: (r.items ?? []).map((i) => ({
      id: i.id ?? "",
      orderItemId: i.orderItemId,
      quantity: i.quantity,
      condition: i.condition ?? null,
      restocked: !!i.restocked,
      name: itemName(i),
    })),
    events: r.events ?? [],
  };
}

export function fromApiRefund(r: ApiRefund): RefundRow {
  return {
    id: r.id,
    amount: Number(r.amount),
    reason: r.reason ?? null,
    method: r.method ?? "original",
    returnRequestId: r.returnRequestId ?? null,
    gatewayRefunded: !!r.gatewayRefunded,
    createdAt: r.createdAt,
    items: (r.items ?? []).map((i) => ({ orderItemId: i.orderItemId, quantity: i.quantity, amount: Number(i.amount ?? 0) })),
  };
}

const orderRef = (o: ApiOrderRef | undefined): OrderRef => ({
  id: o?.id ?? "",
  number: o?.number ?? "",
  customerName:
    [o?.shippingFirstName ?? o?.billingFirstName, o?.shippingLastName ?? o?.billingLastName].filter(Boolean).join(" ") || "Guest",
  phone: o?.shippingPhone ?? o?.billingPhone ?? null,
  paymentMethod: String(o?.paymentGatewayCode ?? "").toUpperCase(),
  area: [o?.shippingUpazila, o?.shippingCity].filter(Boolean).join(", ") || undefined,
});

export interface ListArgs {
  status?: string;
  search?: string;
  page?: number;
  perPage?: number;
}
export type ListResult<T> = Paginated<T> & { counts: Record<string, number> };

export interface CreateParcelInput {
  orderId: string | number;
  items?: { orderItemId: string; quantity: number }[];
  courierCode: string;
  courierName: string;
  trackingNumber?: string;
  trackingUrl?: string;
  codAmount?: number;
  weightKg?: number;
  note?: string;
}

export interface CreateRefundInput {
  orderId: string | number;
  items?: { orderItemId: string; quantity: number }[];
  extraAmount?: number;
  method: RefundMethod;
  reason: string;
  note?: string;
  restock: boolean;
  returnRequestId?: string;
}

const orderTags = (orderId: string | number) => [
  { type: "Order" as const, id: orderId },
  { type: "Order" as const, id: "LIST" },
  { type: "Order" as const, id: "PARCELS" },
  { type: "Order" as const, id: "RETURNS" },
];

const clean = <T extends object>(o: T) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== "")) as Partial<T>;

export const fulfilmentApi = api.injectEndpoints({
  endpoints: (b) => ({
    listParcels: b.query<ListResult<Parcel & { order: OrderRef }>, ListArgs>({
      query: (a) => ({ url: "/admin/shipments", params: clean({ ...a }) }),
      transformResponse: (d: { items: ApiParcel[]; counts: Record<string, number> }, meta) => ({
        ...toPaginated(d.items.map((p) => ({ ...fromApiParcel(p), order: orderRef(p.order) })), meta),
        counts: d.counts,
      }),
      providesTags: [{ type: "Order", id: "PARCELS" }],
    }),
    createParcel: b.mutation<Parcel, CreateParcelInput>({
      query: ({ orderId, ...body }) => ({ url: `/admin/orders/${orderId}/shipments`, method: "POST", body: clean(body) }),
      transformResponse: fromApiParcel,
      invalidatesTags: (_r, _e, { orderId }) => orderTags(orderId),
    }),
    updateParcel: b.mutation<
      Parcel,
      { id: string; orderId: string | number; courierCode?: string; courierName?: string; trackingNumber?: string; trackingUrl?: string; codAmount?: number; note?: string }
    >({
      query: ({ id, orderId: _o, ...body }) => ({ url: `/admin/shipments/${id}`, method: "PATCH", body }),
      transformResponse: fromApiParcel,
      invalidatesTags: (_r, _e, { orderId }) => orderTags(orderId),
    }),
    moveParcel: b.mutation<Parcel, { id: string; orderId: string | number; status: ParcelStatus; note?: string; trackingNumber?: string }>({
      query: ({ id, orderId: _o, ...body }) => ({ url: `/admin/shipments/${id}/status`, method: "POST", body: clean(body) }),
      transformResponse: fromApiParcel,
      invalidatesTags: (_r, _e, { orderId }) => orderTags(orderId),
    }),

    listReturns: b.query<ListResult<ReturnRequest & { order: OrderRef }>, ListArgs>({
      query: (a) => ({ url: "/admin/returns", params: clean({ ...a }) }),
      transformResponse: (d: { items: ApiReturn[]; counts: Record<string, number> }, meta) => ({
        ...toPaginated(d.items.map((r) => ({ ...fromApiReturn(r), order: orderRef(r.order) })), meta),
        counts: d.counts,
      }),
      providesTags: [{ type: "Order", id: "RETURNS" }],
    }),
    createReturn: b.mutation<
      ReturnRequest,
      { orderId: string | number; items: { orderItemId: string; quantity: number }[]; reason: string; note?: string }
    >({
      query: ({ orderId, ...body }) => ({ url: `/admin/orders/${orderId}/returns`, method: "POST", body: clean(body) }),
      transformResponse: fromApiReturn,
      invalidatesTags: (_r, _e, { orderId }) => orderTags(orderId),
    }),
    moveReturn: b.mutation<
      ReturnRequest,
      { id: string; orderId: string | number; status: ReturnStatus; note?: string; restock?: boolean; noRestockItemIds?: string[] }
    >({
      query: ({ id, orderId: _o, ...body }) => ({ url: `/admin/returns/${id}/status`, method: "POST", body: clean(body) }),
      transformResponse: fromApiReturn,
      invalidatesTags: (_r, _e, { orderId }) => [...orderTags(orderId), "Product"],
    }),

    createRefund: b.mutation<RefundRow, CreateRefundInput>({
      query: ({ orderId, ...body }) => ({ url: `/admin/orders/${orderId}/refunds`, method: "POST", body: clean(body) }),
      transformResponse: fromApiRefund,
      invalidatesTags: (_r, _e, { orderId }) => [...orderTags(orderId), "Product", "Customer"],
    }),
  }),
});

export const {
  useListParcelsQuery,
  useCreateParcelMutation,
  useUpdateParcelMutation,
  useMoveParcelMutation,
  useListReturnsQuery,
  useCreateReturnMutation,
  useMoveReturnMutation,
  useCreateRefundMutation,
} = fulfilmentApi;

/** The API's error message (first field error, else the message), for a toast. */
export function apiError(e: unknown, fallback: string): string {
  const d = (e as { data?: unknown })?.data;
  if (typeof d === "string") return d;
  if (d && typeof d === "object") {
    const { errors, message } = d as { errors?: unknown; message?: unknown };
    if (errors && typeof errors === "object") {
      const first = Object.values(errors as Record<string, unknown>)[0];
      if (Array.isArray(first) && first[0]) return String(first[0]);
    }
    if (typeof message === "string" && message) return message;
  }
  return fallback;
}
