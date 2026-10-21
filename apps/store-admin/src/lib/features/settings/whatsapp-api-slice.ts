"use client";

/** WhatsApp order updates: provider, templates, test send and the message log (API: /admin/whatsapp). */
import { api, toPaginated, type Paginated } from "@ecom/api-client";

export type WaEvent = "order_placed" | "order_confirmed" | "order_shipped" | "order_delivered" | "order_cancelled";
export type WaLanguage = "en" | "en_US" | "bn";

/** What each template gets as {{1}}, {{2}}, … (the same order as the API's WA_EVENT_INFO). */
export const WA_EVENT_INFO: Record<WaEvent, { label: string; params: string[] }> = {
  order_placed: { label: "Order placed", params: ["customer's first name", "order number", "order total", "shop name"] },
  order_confirmed: { label: "Order confirmed (Processing)", params: ["customer's first name", "order number", "shop name"] },
  order_shipped: { label: "Order shipped", params: ["customer's first name", "order number", "courier name", "tracking link or number"] },
  order_delivered: { label: "Order delivered", params: ["customer's first name", "order number", "shop name"] },
  order_cancelled: { label: "Order cancelled", params: ["customer's first name", "order number", "shop phone"] },
};

export interface WaSettings {
  provider: "log" | "cloud";
  phoneNumberId: string | null;
  accessTokenHint: string | null;
  appSecretHint: string | null;
  verifyToken: string;
  webhookUrl: string;
  events: Record<WaEvent, { enabled: boolean; template: string; language: WaLanguage }>;
  lastTestAt: string | null;
  lastError: string | null;
}

export interface WaSettingsInput {
  provider?: "log" | "cloud";
  phoneNumberId?: string | null;
  accessToken?: string;
  appSecret?: string;
  events?: Partial<Record<WaEvent, { enabled?: boolean; template?: string; language?: WaLanguage }>>;
}

export interface WaMessage {
  id: string;
  to: string;
  kind: string;
  orderId: string | null;
  template: string;
  language: string;
  params: string[];
  provider: string;
  status: "logged" | "sending" | "sent" | "delivered" | "read" | "failed";
  providerRef: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

const SETTINGS = { type: "Store" as const, id: "WHATSAPP" };
const LOG = { type: "Store" as const, id: "WHATSAPP_LOG" };

export const whatsappApi = api.injectEndpoints({
  endpoints: (b) => ({
    whatsappSettings: b.query<WaSettings, void>({ query: () => "/admin/whatsapp/settings", providesTags: [SETTINGS] }),
    saveWhatsappSettings: b.mutation<WaSettings, WaSettingsInput>({
      query: (body) => ({ url: "/admin/whatsapp/settings", method: "PUT", body }),
      invalidatesTags: [SETTINGS],
    }),
    testWhatsapp: b.mutation<WaMessage, { to: string }>({
      query: (body) => ({ url: "/admin/whatsapp/test", method: "POST", body }),
      invalidatesTags: [SETTINGS, LOG],
    }),
    whatsappLog: b.query<Paginated<WaMessage>, { page?: number; status?: string }>({
      query: (params) => ({ url: "/admin/whatsapp/log", params: Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== "")) }),
      transformResponse: (items: WaMessage[], meta) => toPaginated(items, meta),
      providesTags: [LOG],
    }),
    resendWhatsapp: b.mutation<WaMessage, string>({
      query: (id) => ({ url: `/admin/whatsapp/log/${id}/resend`, method: "POST" }),
      invalidatesTags: [LOG],
    }),
  }),
  overrideExisting: false,
});

export const {
  useWhatsappSettingsQuery,
  useSaveWhatsappSettingsMutation,
  useTestWhatsappMutation,
  useWhatsappLogQuery,
  useResendWhatsappMutation,
} = whatsappApi;
