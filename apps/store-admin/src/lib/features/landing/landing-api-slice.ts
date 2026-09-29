"use client";

/** Product landing pages (API: /admin/landing-pages). */
import { api } from "@ecom/api-client";
import type { Section } from "@/components/content/sections-editor";
import { STOREFRONT_URL } from "@/components/content/shared";

export interface LandingPage {
  id: string;
  slug: string;
  title: string;
  status: "draft" | "published";
  product: { id: string; name: string; slug: string; published: boolean; price: number | null };
  headline: string;
  subheadline: string | null;
  heroImageUrl: string | null;
  offerPrice: number | null;
  offerEndsAt: string | null;
  offerRunning: boolean;
  sections: Section[];
  showReviews: boolean;
  ctaText: string;
  formTitle: string | null;
  maxQty: number;
  seoTitle: string | null;
  metaDesc: string | null;
  views: number;
  orders: number;
  sales: number;
  /** Orders per 100 visits; null before the first visit. */
  conversion: number | null;
  previewToken: string;
  updatedAt: string;
}

export interface LandingInput {
  slug: string;
  title: string;
  status: "draft" | "published";
  productId: string;
  headline: string;
  subheadline: string | null;
  heroImageUrl: string | null;
  offerPrice: number | null;
  offerEndsAt: string | null;
  sections: unknown[];
  showReviews: boolean;
  ctaText: string;
  formTitle: string | null;
  maxQty: number;
  seoTitle: string | null;
  metaDesc: string | null;
}

const T = { type: "Page" as const, id: "LANDING" };

export const landingApi = api.injectEndpoints({
  endpoints: (b) => ({
    landingPages: b.query<LandingPage[], void>({ query: () => "/admin/landing-pages", providesTags: [T] }),
    landingPage: b.query<LandingPage, string>({ query: (id) => `/admin/landing-pages/${id}`, providesTags: [T] }),
    saveLandingPage: b.mutation<LandingPage, LandingInput & { id?: string }>({
      query: ({ id, ...body }) => ({ url: id ? `/admin/landing-pages/${id}` : "/admin/landing-pages", method: id ? "PATCH" : "POST", body }),
      invalidatesTags: [T],
    }),
    deleteLandingPage: b.mutation<null, string>({
      query: (id) => ({ url: `/admin/landing-pages/${id}`, method: "DELETE" }),
      invalidatesTags: [T],
    }),
  }),
});

export const { useLandingPagesQuery, useLandingPageQuery, useSaveLandingPageMutation, useDeleteLandingPageMutation } = landingApi;

/** The page on the store; a draft opens with its preview key. */
export const pageLink = (p: Pick<LandingPage, "slug" | "status" | "previewToken">) =>
  `${STOREFRONT_URL}/lp/${p.slug}${p.status === "published" ? "" : `?preview=${p.previewToken}`}`;
