"use client";

/** How customers may sign in on the storefront (API: modules/auth/customer-login). */
import { api } from "@ecom/api-client";

export interface LoginSettings {
  emailCode: boolean;
  /** Phone codes are switched on in Settings → SMS; true only when a sending provider is set. */
  phoneOtp: boolean;
  smsProvider: string;
}

const TAG = { type: "Store" as const, id: "LOGIN_SETTINGS" };

export const loginSettingsApi = api.injectEndpoints({
  endpoints: (b) => ({
    loginSettings: b.query<LoginSettings, void>({ query: () => "/admin/login-settings", providesTags: [TAG] }),
    saveLoginSettings: b.mutation<LoginSettings, Partial<Pick<LoginSettings, "emailCode">>>({
      query: (body) => ({ url: "/admin/login-settings", method: "PUT", body }),
      invalidatesTags: [TAG],
    }),
  }),
});

export const { useLoginSettingsQuery, useSaveLoginSettingsMutation } = loginSettingsApi;
