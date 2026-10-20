"use client";

/**
 * The admin as each person likes it (API: /admin/me/preferences): bookmarked pages and text size.
 * Saved on the account, so they follow the person to any device.
 */
import { useEffect } from "react";
import { api } from "@ecom/api-client";
import { NAV_SECTIONS, SETTINGS_SECTIONS } from "@/lib/nav";

export interface Bookmark {
  href: string;
  label: string;
}
export type TextSize = "sm" | "md" | "lg";
export interface Preferences {
  bookmarks: Bookmark[];
  textSize: TextSize;
}

export const MAX_BOOKMARKS = 12;
export const TEXT_SIZES: { value: TextSize; label: string; px: number }[] = [
  { value: "sm", label: "Small", px: 14 },
  { value: "md", label: "Normal", px: 16 },
  { value: "lg", label: "Large", px: 18 },
];

const TAG = { type: "Store" as const, id: "MY_PREFERENCES" };

export const preferencesApi = api.injectEndpoints({
  endpoints: (b) => ({
    preferences: b.query<Preferences, void>({ query: () => "/admin/me/preferences", providesTags: [TAG] }),
    savePreferences: b.mutation<Preferences, Partial<Preferences>>({
      query: (body) => ({ url: "/admin/me/preferences", method: "PUT", body }),
      // Shown straight away; put back if the save fails.
      async onQueryStarted(patch, { dispatch, queryFulfilled }) {
        const undo = dispatch(preferencesApi.util.updateQueryData("preferences", undefined, (d) => Object.assign(d, patch)));
        try {
          await queryFulfilled;
        } catch {
          undo.undo();
        }
      },
    }),
  }),
  overrideExisting: false,
});

export const { usePreferencesQuery, useSavePreferencesMutation } = preferencesApi;

/** Sets the admin's base font size (everything is sized in rem, so it all scales). */
export function useTextSize() {
  const { data } = usePreferencesQuery();
  const px = TEXT_SIZES.find((t) => t.value === data?.textSize)?.px ?? 16;
  useEffect(() => {
    document.documentElement.style.fontSize = px === 16 ? "" : `${px}px`;
    return () => {
      document.documentElement.style.fontSize = "";
    };
  }, [px]);
}

const PAGES = [...NAV_SECTIONS, ...SETTINGS_SECTIONS].flatMap((s) => s.items);

/** A name for the page at `href`: its menu name, else the page's heading (e.g. "Order 20261019000002"). */
export function bookmarkLabel(href: string): string {
  const path = href.split("?")[0] ?? href;
  const item = PAGES.find((i) => i.href === path);
  if (item) return item.label;
  const heading = document.querySelector("main h1")?.textContent?.trim();
  return (heading?.length ? heading : path).slice(0, 80);
}
