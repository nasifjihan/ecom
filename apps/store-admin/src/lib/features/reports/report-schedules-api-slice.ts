"use client";

/** Scheduled report emails: Reports > Scheduled emails (API: modules/reports/report-schedules). */
import { api, fileResponse } from "@ecom/api-client";
import type { Basis } from "./reports-api-slice";

export const REPORTS = [
  { key: "sales", label: "Sales & profit" },
  { key: "products", label: "Products" },
  { key: "discounts", label: "Coupons & promotions" },
  { key: "customers", label: "Customers" },
  { key: "couriers", label: "Couriers & COD" },
  { key: "returns", label: "Returns & refunds" },
  { key: "tax", label: "Tax" },
  { key: "stock", label: "Stock value" },
] as const;
export type ReportKey = (typeof REPORTS)[number]["key"];

export type Frequency = "daily" | "weekly" | "monthly";
export type Period = "yesterday" | "last_7_days" | "last_week" | "last_month" | "month_to_date";

export const PERIODS: { key: Period; label: string; hint: string }[] = [
  { key: "yesterday", label: "Yesterday", hint: "The day before it's sent" },
  { key: "last_7_days", label: "The 7 days before", hint: "The 7 days up to the day before it's sent" },
  { key: "last_week", label: "Last week", hint: "Monday to Sunday of the week before" },
  { key: "last_month", label: "Last month", hint: "The whole of the month before" },
  { key: "month_to_date", label: "This month so far", hint: "From the 1st to the day before it's sent (on the 1st: the month just ended)" },
];
export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export interface ScheduleInput {
  name: string;
  reports: ReportKey[];
  frequency: Frequency;
  weekday: number | null;
  monthDay: number | null;
  sendHour: number;
  period: Period;
  basis: Basis;
  storefrontId: string | null;
  staffIds: string[];
  emails: string[];
  enabled?: boolean;
}

export interface ScheduleRow extends Omit<ScheduleInput, "enabled"> {
  id: string;
  reportLabels: string[];
  timing: string;
  periodLabel: string;
  storefrontName: string | null;
  staff: { id: string; name: string; email: string }[];
  enabled: boolean;
  nextRunAt: string | null;
  lastRunAt: string | null;
  lastStatus: "sent" | "failed" | null;
  lastError: string | null;
  failures: number;
  createdAt: string;
}

export interface ScheduleRun {
  id: string;
  from: string;
  to: string;
  trigger: "schedule" | "send_now";
  status: "sent" | "failed";
  error: string | null;
  recipients: string[];
  emailLogId: string | null;
  hasPdf: boolean;
  createdAt: string;
}

export interface ScheduleDetail extends ScheduleRow {
  runs: ScheduleRun[];
}

export interface ScheduleOptions {
  people: { id: string; name: string; email: string; role: string; storefrontIds: string[] }[];
  myStorefrontIds: string[] | null;
}

const LIST = [{ type: "ReportSchedule" as const, id: "LIST" }];

export const reportSchedulesApi = api.injectEndpoints({
  endpoints: (b) => ({
    reportSchedules: b.query<ScheduleRow[], void>({ query: () => "/admin/reports/schedules", providesTags: LIST }),
    reportScheduleOptions: b.query<ScheduleOptions, void>({ query: () => "/admin/reports/schedules/options" }),
    reportSchedule: b.query<ScheduleDetail, string>({
      query: (id) => `/admin/reports/schedules/${id}`,
      providesTags: (_r, _e, id) => [{ type: "ReportSchedule", id }],
    }),
    createReportSchedule: b.mutation<ScheduleDetail, ScheduleInput>({
      query: (body) => ({ url: "/admin/reports/schedules", method: "POST", body }),
      invalidatesTags: LIST,
    }),
    updateReportSchedule: b.mutation<ScheduleDetail, ScheduleInput & { id: string }>({
      query: ({ id, ...body }) => ({ url: `/admin/reports/schedules/${id}`, method: "PUT", body }),
      invalidatesTags: (_r, _e, { id }) => [...LIST, { type: "ReportSchedule", id }],
    }),
    deleteReportSchedule: b.mutation<{ id: string }, string>({
      query: (id) => ({ url: `/admin/reports/schedules/${id}`, method: "DELETE" }),
      invalidatesTags: LIST,
    }),
    setReportScheduleEnabled: b.mutation<ScheduleDetail, { id: string; enabled: boolean }>({
      query: ({ id, enabled }) => ({ url: `/admin/reports/schedules/${id}/enabled`, method: "POST", body: { enabled } }),
      invalidatesTags: (_r, _e, { id }) => [...LIST, { type: "ReportSchedule", id }],
    }),
    sendReportScheduleNow: b.mutation<ScheduleDetail, string>({
      query: (id) => ({ url: `/admin/reports/schedules/${id}/send-now`, method: "POST" }),
      invalidatesTags: (_r, _e, id) => [...LIST, { type: "ReportSchedule", id }, "EmailLog"],
    }),
    /** The PDF it would send now (an object URL for openFile). */
    reportSchedulePreview: b.mutation<string, string>({
      query: (id) => ({ url: `/admin/reports/schedules/${id}/preview`, responseHandler: fileResponse }),
    }),
    reportRunPdf: b.mutation<string, { id: string; runId: string }>({
      query: ({ id, runId }) => ({ url: `/admin/reports/schedules/${id}/runs/${runId}/pdf`, responseHandler: fileResponse }),
    }),
  }),
});

export const {
  useReportSchedulesQuery,
  useReportScheduleOptionsQuery,
  useReportScheduleQuery,
  useCreateReportScheduleMutation,
  useUpdateReportScheduleMutation,
  useDeleteReportScheduleMutation,
  useSetReportScheduleEnabledMutation,
  useSendReportScheduleNowMutation,
  useReportSchedulePreviewMutation,
  useReportRunPdfMutation,
} = reportSchedulesApi;

/** "Mon 20 Oct, 08:00". */
export const whenText = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }) : "—";
