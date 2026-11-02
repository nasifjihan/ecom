/** Marketing > SMS campaigns and Product feeds (API: modules/marketing/sms-campaigns.routes, product-feeds.routes). */
import { api } from "@ecom/api-client";

export interface Audience {
  lastOrderWithinDays?: number;
  noOrderForDays?: number;
  minSpent?: number;
  district?: string;
  levelId?: string;
}

export type CampaignStatus = "draft" | "scheduled" | "sending" | "sent" | "cancelled";

export interface SmsCampaign {
  id: string;
  name: string;
  body: string;
  audience: Audience;
  stopLink: boolean;
  status: CampaignStatus;
  scheduledAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  recipients: number;
  sent: number;
  failed: number;
  createdAt: string;
  /** Detail only: orders by its people within 3 days of getting it. */
  ordersAfter?: number;
  salesAfter?: number;
}

export interface CampaignInput {
  name: string;
  body: string;
  audience: Audience;
  stopLink: boolean;
}

export interface CampaignPreview {
  people: number;
  optedOut: number;
  unicode: boolean;
  length: number;
  parts: number;
  totalParts: number;
  sample: { name: string | null; phone: string | null }[];
}

export interface ProductFeeds {
  storefronts: { id: string; name: string; facebook: string | null; google: string | null }[];
  items: number;
  excluded: { productId: string; name: string; reason: string }[];
}

type Meta = { page: number; perPage: number; total: number; totalPages: number };
const tags = (id?: string) => [{ type: "Coupon" as const, id: "SMS-CAMPAIGNS" }, ...(id ? [{ type: "Coupon" as const, id: `sms-${id}` }] : [])];

const smsCampaignsApi = api.injectEndpoints({
  endpoints: (b) => ({
    listSmsCampaigns: b.query<{ items: SmsCampaign[]; meta: Meta }, { page: number }>({
      query: (params) => ({ url: "/admin/marketing/sms-campaigns", params }),
      providesTags: tags(),
    }),
    getSmsCampaign: b.query<SmsCampaign, string>({
      query: (id) => `/admin/marketing/sms-campaigns/${id}`,
      providesTags: (_r, _e, id) => tags(id),
    }),
    previewSmsCampaign: b.mutation<CampaignPreview, Omit<CampaignInput, "name">>({
      query: (body) => ({ url: "/admin/marketing/sms-campaigns/preview", method: "POST", body }),
    }),
    createSmsCampaign: b.mutation<SmsCampaign, CampaignInput>({
      query: (body) => ({ url: "/admin/marketing/sms-campaigns", method: "POST", body }),
      invalidatesTags: tags(),
    }),
    updateSmsCampaign: b.mutation<SmsCampaign, CampaignInput & { id: string }>({
      query: ({ id, ...body }) => ({ url: `/admin/marketing/sms-campaigns/${id}`, method: "PUT", body }),
      invalidatesTags: (_r, _e, a) => tags(a.id),
    }),
    deleteSmsCampaign: b.mutation<unknown, string>({
      query: (id) => ({ url: `/admin/marketing/sms-campaigns/${id}`, method: "DELETE" }),
      invalidatesTags: tags(),
    }),
    testSmsCampaign: b.mutation<{ status: string }, { id: string; phone: string }>({
      query: ({ id, phone }) => ({ url: `/admin/marketing/sms-campaigns/${id}/test`, method: "POST", body: { phone } }),
    }),
    sendSmsCampaign: b.mutation<SmsCampaign, { id: string; at?: string | null }>({
      query: ({ id, at }) => ({ url: `/admin/marketing/sms-campaigns/${id}/send`, method: "POST", body: { at: at ?? null } }),
      invalidatesTags: (_r, _e, a) => tags(a.id),
    }),
    cancelSmsCampaign: b.mutation<SmsCampaign, string>({
      query: (id) => ({ url: `/admin/marketing/sms-campaigns/${id}/cancel`, method: "POST" }),
      invalidatesTags: (_r, _e, id) => tags(id),
    }),
    getProductFeeds: b.query<ProductFeeds, void>({ query: () => "/admin/marketing/product-feeds" }),
  }),
  overrideExisting: false,
});

export const {
  useListSmsCampaignsQuery,
  useGetSmsCampaignQuery,
  usePreviewSmsCampaignMutation,
  useCreateSmsCampaignMutation,
  useUpdateSmsCampaignMutation,
  useDeleteSmsCampaignMutation,
  useTestSmsCampaignMutation,
  useSendSmsCampaignMutation,
  useCancelSmsCampaignMutation,
  useGetProductFeedsQuery,
} = smsCampaignsApi;
