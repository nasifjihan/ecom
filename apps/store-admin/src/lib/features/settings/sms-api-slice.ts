"use client";

/** SMS provider settings, order SMS templates, phone sign-in and the SMS log (API: modules/sms). */
import { api, toPaginated, type Paginated } from "@ecom/api-client";

export type SmsEvent = "order_placed" | "order_confirmed" | "order_shipped" | "order_delivered" | "order_cancelled";

export const SMS_EVENT_LABELS: Record<SmsEvent, string> = {
  order_placed: "Order placed",
  order_confirmed: "Order confirmed (Processing)",
  order_shipped: "Order shipped",
  order_delivered: "Order delivered",
  order_cancelled: "Order cancelled",
};

export const SMS_KIND_LABELS: Record<string, string> = {
  ...SMS_EVENT_LABELS,
  otp: "Sign-in code",
  invoice: "Invoice link",
  test: "Test",
};

export interface SmsSettings {
  provider: string;
  providers: { code: string; name: string; fields: { key: string; label: string; secret?: boolean }[]; senderId: "required" | "optional" | "none" }[];
  senderId: string | null;
  credentialHints: Record<string, string | null>;
  events: Record<SmsEvent, { enabled: boolean; template: string }>;
  phoneOtpLogin: boolean;
  lastTestAt: string | null;
  lastError: string | null;
}

export interface SmsSettingsInput {
  provider?: string;
  senderId?: string | null;
  credentials?: Record<string, string>;
  events?: Partial<Record<SmsEvent, { enabled?: boolean; template?: string }>>;
  phoneOtpLogin?: boolean;
}

export interface SmsMessage {
  id: string;
  to: string;
  body: string;
  kind: string;
  orderId: string | null;
  provider: string;
  status: "sent" | "failed" | "logged" | "sending";
  providerRef: string | null;
  error: string | null;
  segments: number;
  createdAt: string;
}

const SETTINGS = { type: "Store" as const, id: "SMS" };
const LOG = { type: "Store" as const, id: "SMS_LOG" };

export const smsApi = api.injectEndpoints({
  endpoints: (b) => ({
    smsSettings: b.query<SmsSettings, void>({ query: () => "/admin/sms/settings", providesTags: [SETTINGS] }),
    saveSmsSettings: b.mutation<SmsSettings, SmsSettingsInput>({
      query: (body) => ({ url: "/admin/sms/settings", method: "PUT", body }),
      invalidatesTags: [SETTINGS],
    }),
    testSms: b.mutation<SmsMessage, { to: string; text?: string }>({
      query: (body) => ({ url: "/admin/sms/test", method: "POST", body }),
      invalidatesTags: [SETTINGS, LOG],
    }),
    smsLog: b.query<Paginated<SmsMessage> & { partsLast30Days: number }, { page?: number; kind?: string; status?: string; search?: string }>({
      query: (params) => ({ url: "/admin/sms/log", params: Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== "")) }),
      transformResponse: (items: SmsMessage[], meta) => ({
        ...toPaginated(items, meta),
        partsLast30Days: Number((meta as Record<string, unknown> | null)?.partsLast30Days ?? 0),
      }),
      providesTags: [LOG],
    }),
    resendSms: b.mutation<SmsMessage, string>({
      query: (id) => ({ url: `/admin/sms/log/${id}/resend`, method: "POST" }),
      invalidatesTags: [LOG],
    }),
    orderSms: b.query<SmsMessage[], string | number>({
      query: (id) => `/admin/orders/${id}/sms`,
      providesTags: (_r, _e, id) => [{ type: "Order", id: `SMS-${id}` }],
    }),
    sendInvoiceSms: b.mutation<SmsMessage, { orderId: string | number; to?: string }>({
      query: ({ orderId, to }) => ({ url: `/admin/orders/${orderId}/sms-invoice`, method: "POST", body: to ? { to } : {} }),
      invalidatesTags: (_r, _e, { orderId }) => [{ type: "Order", id: `SMS-${orderId}` }, LOG],
    }),
  }),
});

export const {
  useSmsSettingsQuery,
  useSaveSmsSettingsMutation,
  useTestSmsMutation,
  useSmsLogQuery,
  useResendSmsMutation,
  useOrderSmsQuery,
  useSendInvoiceSmsMutation,
} = smsApi;

// Same rules as the API's smsParts: plain text is 160 characters a part (153 when split),
// anything outside the GSM alphabet (Bangla, ৳, emoji) makes it Unicode at 70 (67).
const GSM7 =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const GSM7_EXT = "^{}\\[~]|€";
export function smsParts(text: string) {
  const chars = Array.from(text);
  const unicode = chars.some((c) => !GSM7.includes(c) && !GSM7_EXT.includes(c));
  const length = unicode ? chars.length : chars.reduce((n, c) => n + (GSM7_EXT.includes(c) ? 2 : 1), 0);
  const [single, multi] = unicode ? [70, 67] : [160, 153];
  return { unicode, length, parts: length === 0 ? 0 : length <= single ? 1 : Math.ceil(length / multi) };
}
