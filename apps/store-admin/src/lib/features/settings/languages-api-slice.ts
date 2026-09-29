"use client";

/** Storefront languages (API: /admin/settings/languages). */
import { api } from "@ecom/api-client";

export interface StoreLanguage {
  code: "en" | "bn";
  name: string;
  nativeName: string;
  enabled: boolean;
}

export interface LanguageSettings {
  languages: StoreLanguage[];
  defaultLanguage: "en" | "bn";
}

const TAG = { type: "Store" as const, id: "LANGUAGES" };

export const languagesApi = api.injectEndpoints({
  endpoints: (b) => ({
    languageSettings: b.query<LanguageSettings, void>({ query: () => "/admin/settings/languages", providesTags: [TAG] }),
    saveLanguageSettings: b.mutation<LanguageSettings, { enabled: string[]; defaultLanguage: string }>({
      query: (body) => ({ url: "/admin/settings/languages", method: "PUT", body }),
      invalidatesTags: [TAG],
    }),
  }),
});

export const { useLanguageSettingsQuery, useSaveLanguageSettingsMutation } = languagesApi;
