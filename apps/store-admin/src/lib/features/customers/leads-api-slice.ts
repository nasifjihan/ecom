"use client";

/** CRM leads (API: /admin/leads): people who asked and haven't ordered yet. */
import { api, toPaginated, type Paginated } from "@ecom/api-client";

export type LeadStatus = "new" | "contacted" | "interested" | "won" | "lost";
export type FollowUp = "none" | "overdue" | "today" | "later";

export interface Lead {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  channel: string;
  handle: string | null;
  interest: string | null;
  value: number | null;
  tags: string[];
  status: LeadStatus;
  lostReason: string | null;
  owner: { id: string; name: string } | null;
  nextFollowUpAt: string | null;
  followUp: FollowUp;
  lastContactAt: string | null;
  customer: { id: string; name: string; orderCount: number; banned: boolean } | null;
  orderId: string | null;
  orderNumber: string | null;
  closedAt: string | null;
  createdAt: string;
}

export interface LeadNote {
  id: string;
  kind: "note" | "call" | "message" | "status";
  body: string;
  author: string | null;
  createdAt: string;
}

export interface LeadDetail extends Lead {
  notes: LeadNote[];
}

export interface LeadInput {
  name: string;
  phone?: string | null;
  email?: string | null;
  channel: string;
  handle?: string | null;
  interest?: string | null;
  value?: number | null;
  tags?: string[];
  ownerId?: string | null;
  nextFollowUpAt?: string | null;
  note?: string | null;
}

export interface LeadQuery {
  status?: "open" | LeadStatus;
  owner?: string;
  due?: "overdue" | "today";
  tag?: string;
  search?: string;
  page?: number;
}

export interface LeadList extends Paginated<Lead> {
  counts: Record<LeadStatus, number>;
  overdue: number;
  today: number;
}

export const LEAD_CHANNEL_LABELS: Record<string, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  whatsapp: "WhatsApp",
  messenger: "Messenger",
  tiktok: "TikTok",
  phone: "Phone call",
  walk_in: "Walk-in",
  website: "Website",
  referral: "Referral",
  other: "Other",
};

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  interested: "Interested",
  won: "Won",
  lost: "Lost",
};

/** The order source for a lead's order (New order page). */
export const leadOrderSource = (channel: string) =>
  ["facebook", "instagram", "whatsapp", "messenger", "phone", "walk_in", "website"].includes(channel) ? channel : "other";

const clean = (q: LeadQuery) => Object.fromEntries(Object.entries(q).filter(([, v]) => v !== undefined && v !== ""));
const LIST = { type: "Lead" as const, id: "LIST" };

export const leadsApi = api.injectEndpoints({
  endpoints: (b) => ({
    leads: b.query<LeadList, LeadQuery>({
      query: (q) => ({ url: "/admin/leads", params: clean(q) }),
      transformResponse: (items: Lead[], meta) => {
        const m = (meta ?? {}) as { counts?: Record<LeadStatus, number>; overdue?: number; today?: number };
        return {
          ...toPaginated(items, meta),
          counts: m.counts ?? { new: 0, contacted: 0, interested: 0, won: 0, lost: 0 },
          overdue: m.overdue ?? 0,
          today: m.today ?? 0,
        };
      },
      providesTags: [LIST],
    }),
    lead: b.query<LeadDetail, string>({
      query: (id) => `/admin/leads/${id}`,
      providesTags: (_r, _e, id) => [{ type: "Lead", id }],
    }),
    leadTags: b.query<string[], void>({ query: () => "/admin/leads/tags", providesTags: [LIST] }),
    leadOwners: b.query<{ id: string; name: string; isSalesperson: boolean }[], void>({ query: () => "/admin/leads/owners" }),
    addLead: b.mutation<LeadDetail, LeadInput>({
      query: (body) => ({ url: "/admin/leads", method: "POST", body }),
      invalidatesTags: [LIST],
    }),
    updateLead: b.mutation<LeadDetail, { id: string } & Partial<LeadInput>>({
      query: ({ id, ...body }) => ({ url: `/admin/leads/${id}`, method: "PATCH", body }),
      invalidatesTags: (_r, _e, { id }) => [LIST, { type: "Lead", id }],
    }),
    setLeadStatus: b.mutation<LeadDetail, { id: string; status: LeadStatus; reason?: string }>({
      query: ({ id, ...body }) => ({ url: `/admin/leads/${id}/status`, method: "POST", body }),
      invalidatesTags: (_r, _e, { id }) => [LIST, { type: "Lead", id }],
    }),
    addLeadNote: b.mutation<LeadDetail, { id: string; kind: "note" | "call" | "message"; body: string; nextFollowUpAt?: string | null }>({
      query: ({ id, ...body }) => ({ url: `/admin/leads/${id}/notes`, method: "POST", body }),
      invalidatesTags: (_r, _e, { id }) => [LIST, { type: "Lead", id }],
    }),
    leadToCustomer: b.mutation<{ customerId: string; created: boolean }, string>({
      query: (id) => ({ url: `/admin/leads/${id}/customer`, method: "POST" }),
      invalidatesTags: (_r, _e, id) => [LIST, { type: "Lead", id }, "Customer"],
    }),
    deleteLead: b.mutation<null, string>({
      query: (id) => ({ url: `/admin/leads/${id}`, method: "DELETE" }),
      invalidatesTags: [LIST],
    }),
  }),
});

export const {
  useLeadsQuery,
  useLeadQuery,
  useLeadTagsQuery,
  useLeadOwnersQuery,
  useAddLeadMutation,
  useUpdateLeadMutation,
  useSetLeadStatusMutation,
  useAddLeadNoteMutation,
  useLeadToCustomerMutation,
  useDeleteLeadMutation,
} = leadsApi;
