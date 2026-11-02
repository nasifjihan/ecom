/** Customers > Messages: the contact form inbox (API: modules/content/contact-messages.routes). */
import { api } from "@ecom/api-client";

export type MessageKind = "question" | "callback" | "order_problem";
export type MessageStatus = "new" | "open" | "done";
export const KIND_LABELS: Record<MessageKind, string> = { question: "Question", callback: "Call me back", order_problem: "Order problem" };
export const STATUS_LABELS: Record<MessageStatus, string> = { new: "New", open: "Open", done: "Done" };

export interface MessageRow {
  id: string;
  kind: MessageKind;
  name: string;
  phone: string | null;
  email: string | null;
  message: string;
  callbackTime: string | null;
  status: MessageStatus;
  createdAt: string;
  order: { id: string; number: string; status?: string } | null;
  assignedTo: { id: string; name: string } | null;
  replies: number;
}

export interface MessageDetail extends Omit<MessageRow, "replies"> {
  customerId: string | null;
  replies: { id: string; channel: "sms" | "email" | "note"; body: string; by: string; createdAt: string }[];
}

type Meta = { page: number; perPage: number; total: number; totalPages: number };
const LIST = { type: "Customer" as const, id: "MESSAGES" };

const messagesApi = api.injectEndpoints({
  endpoints: (b) => ({
    listMessages: b.query<{ items: MessageRow[]; counts: Partial<Record<MessageStatus, number>>; meta: Meta }, { status?: MessageStatus; kind?: MessageKind; search?: string; page: number }>({
      query: (params) => ({ url: "/admin/contact-messages", params }),
      providesTags: [LIST],
    }),
    getMessage: b.query<MessageDetail, string>({
      query: (id) => `/admin/contact-messages/${id}`,
      providesTags: (_r, _e, id) => [{ type: "Customer", id: `message-${id}` }],
    }),
    updateMessage: b.mutation<MessageDetail, { id: string; status?: MessageStatus; assignedToId?: string | null }>({
      query: ({ id, ...body }) => ({ url: `/admin/contact-messages/${id}`, method: "PUT", body }),
      invalidatesTags: (_r, _e, a) => [LIST, { type: "Customer", id: `message-${a.id}` }],
    }),
    replyToMessage: b.mutation<MessageDetail, { id: string; channel: "sms" | "email" | "note"; body: string }>({
      query: ({ id, ...body }) => ({ url: `/admin/contact-messages/${id}/replies`, method: "POST", body }),
      invalidatesTags: (_r, _e, a) => [LIST, { type: "Customer", id: `message-${a.id}` }],
    }),
  }),
  overrideExisting: false,
});

export const { useListMessagesQuery, useGetMessageQuery, useUpdateMessageMutation, useReplyToMessageMutation } = messagesApi;
