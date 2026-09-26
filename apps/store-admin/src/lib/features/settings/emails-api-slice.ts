"use client";

/** Store emails: template wording, previews, test sends and the sent-email log (API: /admin/emails/*). */
import { api, toPaginated, type Paginated } from "@ecom/api-client";

export type EmailAudience = "customer" | "staff";
export type EmailStatus = "queued" | "sent" | "retrying" | "failed";

export interface EmailTemplateRow {
  key: string;
  label: string;
  audience: EmailAudience;
  description: string;
  enabled: boolean;
  /** True when the store has changed the wording from the built-in default. */
  customised: boolean;
  subject: string;
}

export interface EmailTemplate extends EmailTemplateRow {
  message: string;
  /** Staff emails only: who gets them. Empty means the store owners. */
  recipients: string[];
  variables: string[];
  /** Parts drawn under the message: the order table and the courier box. */
  blocks: ("order_summary" | "tracking")[];
  buttonLabel: string | null;
  defaultSubject: string;
  defaultMessage: string;
}

/** Fields left out keep their current value. */
export interface EmailTemplateInput {
  enabled?: boolean;
  subject?: string;
  message?: string;
  recipients?: string[];
}

export interface EmailDraft {
  subject: string;
  message: string;
}

export interface EmailLogRow {
  id: string;
  template: string;
  templateLabel: string;
  subject: string;
  to: string[];
  recipientType: string;
  status: EmailStatus;
  error: string | null;
  attempts: number;
  /** The mail driver only logged it: nothing was handed to a mail server. */
  logOnly: boolean;
  orderId: string | null;
  createdAt: string;
  sentAt: string | null;
}

export interface EmailLogEntry extends EmailLogRow {
  html: string;
  text: string;
}

export interface EmailLogArgs {
  page?: number;
  perPage?: number;
  search?: string;
  status?: EmailStatus;
}

const clean = (a: EmailLogArgs) =>
  Object.fromEntries(Object.entries({ page: 1, perPage: 20, ...a }).filter(([, v]) => v !== undefined && v !== ""));

export const emailsApi = api.injectEndpoints({
  endpoints: (b) => ({
    getEmailTemplates: b.query<EmailTemplateRow[], void>({
      query: () => "/admin/emails/templates",
      providesTags: ["EmailTemplate"],
    }),
    getEmailTemplate: b.query<EmailTemplate, string>({
      query: (key) => `/admin/emails/templates/${key}`,
      providesTags: (_r, _e, key) => [{ type: "EmailTemplate", id: key }],
    }),
    saveEmailTemplate: b.mutation<EmailTemplate, { key: string } & EmailTemplateInput>({
      query: ({ key, ...body }) => ({ url: `/admin/emails/templates/${key}`, method: "PUT", body }),
      invalidatesTags: ["EmailTemplate"],
    }),
    resetEmailTemplate: b.mutation<EmailTemplate, string>({
      query: (key) => ({ url: `/admin/emails/templates/${key}`, method: "DELETE" }),
      invalidatesTags: ["EmailTemplate"],
    }),
    previewEmail: b.mutation<{ subject: string; html: string }, { key: string; draft?: EmailDraft }>({
      query: ({ key, draft }) => ({ url: `/admin/emails/templates/${key}/preview`, method: "POST", body: { draft } }),
    }),
    sendTestEmail: b.mutation<EmailLogEntry, { key: string; to?: string; draft?: EmailDraft }>({
      query: ({ key, ...body }) => ({ url: `/admin/emails/templates/${key}/test`, method: "POST", body }),
      invalidatesTags: ["EmailLog"],
    }),
    getEmailLog: b.query<Paginated<EmailLogRow>, EmailLogArgs | void>({
      query: (a) => ({ url: "/admin/emails/log", params: clean(a ?? {}) }),
      transformResponse: (items: EmailLogRow[], meta) => toPaginated(items, meta),
      providesTags: ["EmailLog"],
    }),
    getEmailLogEntry: b.query<EmailLogEntry, string>({
      query: (id) => `/admin/emails/log/${id}`,
      providesTags: (_r, _e, id) => [{ type: "EmailLog", id }],
    }),
    resendEmail: b.mutation<EmailLogEntry, string>({
      query: (id) => ({ url: `/admin/emails/log/${id}/resend`, method: "POST" }),
      invalidatesTags: ["EmailLog"],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetEmailTemplatesQuery,
  useGetEmailTemplateQuery,
  useSaveEmailTemplateMutation,
  useResetEmailTemplateMutation,
  usePreviewEmailMutation,
  useSendTestEmailMutation,
  useGetEmailLogQuery,
  useGetEmailLogEntryQuery,
  useResendEmailMutation,
} = emailsApi;
