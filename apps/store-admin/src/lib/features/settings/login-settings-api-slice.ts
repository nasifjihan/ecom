"use client";

/** How customers may sign in on the storefront (API: modules/auth/customer-login). */
import { api } from "@ecom/api-client";

export type SocialProvider = "google" | "facebook";

export interface ProviderSettings {
  enabled: boolean;
  clientId: string | null;
  /** Last 4 characters of the stored secret, e.g. "••••a1b2". */
  secretHint: string | null;
  /** On, with keys (or test mode): customers see the button. */
  ready: boolean;
}

export interface LoginSettings {
  emailCode: boolean;
  /** Phone codes are switched on in Settings → SMS; true only when a sending provider is set. */
  phoneOtp: boolean;
  smsProvider: string;
  google: ProviderSettings;
  facebook: ProviderSettings;
  socialTestMode: boolean;
  /** False on the live site, where test mode can't be used. */
  testModeAllowed: boolean;
  /** The addresses to paste into the Google and Facebook app settings. */
  redirectUris: string[];
}

export interface LoginSettingsInput {
  emailCode?: boolean;
  google?: { enabled?: boolean; clientId?: string | null; clientSecret?: string };
  facebook?: { enabled?: boolean; clientId?: string | null; clientSecret?: string };
  socialTestMode?: boolean;
}

const TAG = { type: "Store" as const, id: "LOGIN_SETTINGS" };

export const loginSettingsApi = api.injectEndpoints({
  endpoints: (b) => ({
    loginSettings: b.query<LoginSettings, void>({ query: () => "/admin/login-settings", providesTags: [TAG] }),
    saveLoginSettings: b.mutation<LoginSettings, LoginSettingsInput>({
      query: (body) => ({ url: "/admin/login-settings", method: "PUT", body }),
      invalidatesTags: [TAG],
    }),
  }),
});

export const { useLoginSettingsQuery, useSaveLoginSettingsMutation } = loginSettingsApi;
