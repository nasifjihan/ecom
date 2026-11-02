/** Marketing > Abandoned carts (API: modules/marketing/cart-reminders.routes). */
import { api } from "@ecom/api-client";

export interface CartReminderSettings {
  enabled: boolean;
  firstDelayMinutes: number;
  secondEnabled: boolean;
  secondDelayHours: number;
  couponCode: string | null;
  sms: boolean;
  email: boolean;
}

export interface AbandonedCartRow {
  id: string;
  contact: string;
  items: string[];
  value: number;
  createdAt: string;
  reminders: number;
  recoveredAt: string | null;
  order: { id: string; number: string } | null;
}

export interface AbandonedReport {
  totals: { abandoned: number; reminded: number; recovered: number; recoveredSales: number };
  items: AbandonedCartRow[];
  meta: { page: number; perPage: number; total: number; totalPages: number };
}

const cartRemindersApi = api.injectEndpoints({
  endpoints: (b) => ({
    getCartReminderSettings: b.query<CartReminderSettings, void>({ query: () => "/admin/marketing/abandoned-carts/settings" }),
    saveCartReminderSettings: b.mutation<CartReminderSettings, CartReminderSettings>({
      query: (body) => ({ url: "/admin/marketing/abandoned-carts/settings", method: "PUT", body }),
      async onQueryStarted(_a, { dispatch, queryFulfilled }) {
        const { data } = await queryFulfilled;
        dispatch(cartRemindersApi.util.updateQueryData("getCartReminderSettings", undefined, () => data));
      },
    }),
    getAbandonedCarts: b.query<AbandonedReport, { from?: string; to?: string; page?: number }>({
      query: (params) => ({ url: "/admin/marketing/abandoned-carts", params }),
    }),
  }),
  overrideExisting: false,
});

export const { useGetCartReminderSettingsQuery, useSaveCartReminderSettingsMutation, useGetAbandonedCartsQuery } = cartRemindersApi;
