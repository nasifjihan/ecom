"use client";

/** The newsletter list (API: /admin/newsletter). */
import { api, fileResponse, toPaginated, type Paginated } from "@ecom/api-client";

export interface Subscriber {
  id: string;
  email: string;
  name: string | null;
  status: "subscribed" | "unsubscribed";
  /** footer | checkout | signup | admin | import */
  source: string;
  locale: string;
  createdAt: string;
  unsubscribedAt: string | null;
}

export const SUBSCRIBER_SOURCE_LABELS: Record<string, string> = {
  footer: "Footer sign-up",
  checkout: "Checkout",
  signup: "Account sign-up",
  admin: "Added by staff",
  import: "Imported",
};

interface Q { status?: "subscribed" | "unsubscribed"; search?: string; page?: number }
const clean = (q: Q) => Object.fromEntries(Object.entries(q).filter(([, v]) => v !== undefined && v !== ""));

export const newsletterApi = api.injectEndpoints({
  endpoints: (b) => ({
    subscribers: b.query<Paginated<Subscriber> & { subscribed: number; unsubscribed: number }, Q>({
      query: (q) => ({ url: "/admin/newsletter", params: clean(q) }),
      transformResponse: (items: Subscriber[], meta) => {
        const m = (meta ?? {}) as Record<string, unknown>;
        return { ...toPaginated(items, meta), subscribed: Number(m.subscribed ?? 0), unsubscribed: Number(m.unsubscribed ?? 0) };
      },
      providesTags: [{ type: "Customer", id: "NEWSLETTER" }],
    }),
    addSubscriber: b.mutation<Subscriber, { email: string; name?: string }>({
      query: (body) => ({ url: "/admin/newsletter", method: "POST", body }),
      invalidatesTags: [{ type: "Customer", id: "NEWSLETTER" }],
    }),
    unsubscribe: b.mutation<Subscriber, string>({
      query: (id) => ({ url: `/admin/newsletter/${id}/unsubscribe`, method: "POST" }),
      invalidatesTags: [{ type: "Customer", id: "NEWSLETTER" }],
    }),
    /** The list as CSV (see openFile in @ecom/api-client). */
    newsletterCsv: b.mutation<string, Q>({
      query: (q) => ({ url: "/admin/newsletter/export", params: clean(q), responseHandler: fileResponse }),
    }),
  }),
});

export const { useSubscribersQuery, useAddSubscriberMutation, useUnsubscribeMutation, useNewsletterCsvMutation } = newsletterApi;
