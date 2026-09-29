"use client";

/** My price quotes (API: /storefront/account/quotes). */
import { api } from "@ecom/api-client";
import { msg } from "@ecom/storefront-base";

export type QuoteStatus = "REQUESTED" | "SENT" | "EXPIRED" | "ACCEPTED" | "DECLINED" | "ORDERED" | "CANCELLED";

export interface MyQuote {
  id: string;
  number: string;
  status: QuoteStatus;
  validUntil: string | null;
  terms: string | null;
  customerNote: string | null;
  discount: number;
  deliveryFee: number;
  subtotal: number;
  total: number;
  listTotal: number;
  items: { id: string; name: string; option: string | null; sku: string | null; qty: number; unitPrice: number; listPrice: number; lineTotal: number }[];
  order: { id: string; number: string | null } | null;
  sentAt: string | null;
  createdAt: string;
  canRespond: boolean;
}

const TAG = { type: "Customer" as const, id: "QUOTES" };

const quotesApi = api.injectEndpoints({
  endpoints: (b) => ({
    myQuotes: b.query<MyQuote[], void>({ query: () => "/storefront/account/quotes", providesTags: [TAG] }),
    myQuote: b.query<MyQuote, string>({ query: (n) => `/storefront/account/quotes/${encodeURIComponent(n)}`, providesTags: [TAG] }),
    requestQuote: b.mutation<MyQuote, { items: { productId: string; variantId?: string | null; qty: number }[]; note?: string | null }>({
      query: (body) => ({ url: "/storefront/account/quotes/request", method: "POST", body }),
      invalidatesTags: [TAG],
    }),
    respondQuote: b.mutation<MyQuote, { number: string; action: "accept" | "decline"; note?: string | null }>({
      query: ({ number, ...body }) => ({ url: `/storefront/account/quotes/${encodeURIComponent(number)}/respond`, method: "POST", body }),
      invalidatesTags: [TAG],
    }),
  }),
  overrideExisting: false,
});

export const { useMyQuotesQuery, useMyQuoteQuery, useRequestQuoteMutation, useRespondQuoteMutation } = quotesApi;

export const QUOTE_STATUS_WORDS: Record<QuoteStatus, string> = {
  REQUESTED: msg("Requested"),
  SENT: msg("Waiting for your answer"),
  EXPIRED: msg("Expired"),
  ACCEPTED: msg("Accepted"),
  DECLINED: msg("Declined"),
  ORDERED: msg("Ordered"),
  CANCELLED: msg("Cancelled"),
};

export const QUOTE_STATUS_TONE: Record<QuoteStatus, string> = {
  REQUESTED: "bg-violet-100 text-violet-800",
  SENT: "bg-blue-100 text-blue-800",
  EXPIRED: "bg-amber-100 text-amber-800",
  ACCEPTED: "bg-green-100 text-green-800",
  DECLINED: "bg-rose-100 text-rose-800",
  ORDERED: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-slate-100 text-slate-700",
};
