"use client";

/** The bell (API: /admin/inbox) and who gets which messages (API: /admin/notifications/matrix). */
import { api } from "@ecom/api-client";

export interface Notice {
  id: string;
  event: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  createdAt: string;
}

export interface CustomerMessageRow {
  key: string;
  label: string;
  email: boolean;
  emailTemplate: string;
  /** null: this message has no SMS. */
  sms: boolean | null;
}

export interface StaffAlertRow {
  event: string;
  label: string;
  description: string;
  inApp: boolean;
  email: boolean;
  emailTemplate: string;
  sms: boolean;
  toAssignee: boolean;
  staffIds: string[];
}

export interface Matrix {
  smsReady: boolean;
  customers: CustomerMessageRow[];
  staff: StaffAlertRow[];
  people: { id: string; name: string; email: string; hasMobile: boolean; role: string; owner: boolean }[];
}

export interface MatrixInput {
  customers?: { key: string; email?: boolean; sms?: boolean }[];
  staff?: { event: string; inApp?: boolean; email?: boolean; sms?: boolean; staffIds?: string[] }[];
}

const INBOX = { type: "Notice" as const, id: "INBOX" };

export const alertsApi = api.injectEndpoints({
  endpoints: (b) => ({
    inbox: b.query<{ unread: number; items: Notice[] }, void>({
      query: () => ({ url: "/admin/inbox", params: { take: 15 } }),
      providesTags: [INBOX],
    }),
    readNotice: b.mutation<null, string>({
      query: (id) => ({ url: `/admin/inbox/${id}/read`, method: "POST" }),
      invalidatesTags: [INBOX],
    }),
    readAllNotices: b.mutation<{ marked: number }, void>({
      query: () => ({ url: "/admin/inbox/read-all", method: "POST" }),
      invalidatesTags: [INBOX],
    }),
    notificationMatrix: b.query<Matrix, void>({
      query: () => "/admin/notifications/matrix",
      providesTags: [{ type: "Notice", id: "MATRIX" }],
    }),
    saveNotificationMatrix: b.mutation<Matrix, MatrixInput>({
      query: (body) => ({ url: "/admin/notifications/matrix", method: "PUT", body }),
      invalidatesTags: [{ type: "Notice", id: "MATRIX" }],
    }),
  }),
});

export const { useInboxQuery, useReadNoticeMutation, useReadAllNoticesMutation, useNotificationMatrixQuery, useSaveNotificationMatrixMutation } = alertsApi;
