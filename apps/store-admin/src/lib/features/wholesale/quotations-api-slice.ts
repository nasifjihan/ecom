"use client";

/** Price quotes to customers (API: /admin/quotations). */
import { api } from "@ecom/api-client";

export type QuoteStatus = "REQUESTED" | "DRAFT" | "SENT" | "EXPIRED" | "ACCEPTED" | "DECLINED" | "ORDERED" | "CANCELLED";

export interface QuoteItem {
  id: string;
  productId: string | null;
  variantId: string | null;
  name: string;
  option: string | null;
  sku: string | null;
  qty: number;
  unitPrice: number;
  listPrice: number;
  lineTotal: number;
}

export interface Quotation {
  id: string;
  number: string;
  status: QuoteStatus;
  validUntil: string | null;
  terms: string | null;
  staffNote: string | null;
  customerNote: string | null;
  discount: number;
  deliveryFee: number;
  subtotal: number;
  total: number;
  listTotal: number;
  offPercent: number;
  storefrontId: string | null;
  items: QuoteItem[];
  order: { id: string; number: string | null } | null;
  customer: { id: string; name: string; email: string | null; phone: string | null; business: string | null };
  can: { edit: boolean; send: boolean; cancel: boolean; order: boolean };
  orderBlocker: string | null;
  sentAt: string | null;
  respondedAt: string | null;
  createdAt: string;
  /** On a single quote (for printing). */
  storeName?: string;
}

export interface QuotesPage {
  rows: Quotation[];
  total: number;
  page: number;
  perPage: number;
  counts: Partial<Record<QuoteStatus, number>>;
}

export interface QuoteInput {
  customerId: string;
  storefrontId?: string | null;
  validUntil?: string | null;
  terms?: string | null;
  staffNote?: string | null;
  discount: number;
  deliveryFee: number;
  items: { productId: string; variantId?: string | null; qty: number; unitPrice: number }[];
}

export interface PreviewLine {
  productId: string;
  variantId: string | null;
  name: string;
  option: string | null;
  sku: string | null;
  qty: number;
  listPrice: number;
  note: string | null;
}

const LIST = { type: "Order" as const, id: "QUOTES" };
const one = (id: string) => ({ type: "Order" as const, id: `QUOTE-${id}` });
const clean = (o: object) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== ""));

export const quotationsApi = api.injectEndpoints({
  endpoints: (b) => ({
    quotations: b.query<QuotesPage, { status?: QuoteStatus; search?: string; customerId?: string; page?: number }>({
      query: (params) => ({ url: "/admin/quotations", params: clean(params) }),
      providesTags: [LIST],
    }),
    quotation: b.query<Quotation, string>({ query: (id) => `/admin/quotations/${id}`, providesTags: (_r, _e, id) => [one(id)] }),
    previewQuoteLines: b.mutation<PreviewLine[], { customerId: string; storefrontId?: string | null; items: { productId: string; variantId?: string | null; qty: number }[] }>({
      query: (body) => ({ url: "/admin/quotations/preview", method: "POST", body }),
    }),
    saveQuotation: b.mutation<Quotation, QuoteInput & { id?: string }>({
      query: ({ id, ...body }) => ({ url: id ? `/admin/quotations/${id}` : "/admin/quotations", method: id ? "PUT" : "POST", body }),
      invalidatesTags: (r) => [LIST, ...(r ? [one(r.id)] : [])],
    }),
    sendQuotation: b.mutation<Quotation, string>({
      query: (id) => ({ url: `/admin/quotations/${id}/send`, method: "POST" }),
      invalidatesTags: (_r, _e, id) => [LIST, one(id)],
    }),
    cancelQuotation: b.mutation<Quotation, string>({
      query: (id) => ({ url: `/admin/quotations/${id}/cancel`, method: "POST" }),
      invalidatesTags: (_r, _e, id) => [LIST, one(id)],
    }),
    deleteQuotation: b.mutation<null, string>({
      query: (id) => ({ url: `/admin/quotations/${id}`, method: "DELETE" }),
      invalidatesTags: [LIST],
    }),
  }),
});

export const {
  useQuotationsQuery,
  useQuotationQuery,
  usePreviewQuoteLinesMutation,
  useSaveQuotationMutation,
  useSendQuotationMutation,
  useCancelQuotationMutation,
  useDeleteQuotationMutation,
} = quotationsApi;

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  REQUESTED: "Requested",
  DRAFT: "Draft",
  SENT: "Sent",
  EXPIRED: "Expired",
  ACCEPTED: "Accepted",
  DECLINED: "Declined",
  ORDERED: "Ordered",
  CANCELLED: "Cancelled",
};

export const QUOTE_STATUS_STYLE: Record<QuoteStatus, string> = {
  REQUESTED: "border-violet-300 bg-violet-50 text-violet-800 dark:border-violet-700 dark:bg-violet-950 dark:text-violet-200",
  DRAFT: "border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
  SENT: "border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-200",
  EXPIRED: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200",
  ACCEPTED: "border-green-300 bg-green-50 text-green-800 dark:border-green-700 dark:bg-green-950 dark:text-green-200",
  DECLINED: "border-red-300 bg-red-50 text-red-800 dark:border-red-700 dark:bg-red-950 dark:text-red-200",
  ORDERED: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-200",
  CANCELLED: "border-slate-300 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400",
};
