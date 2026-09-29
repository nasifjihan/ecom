"use client";

/** Product landing pages, /lp/{slug} (API: /storefront/landing). The page itself is fetched on the server. */
import { api } from "@ecom/api-client";
import type { ProductReview } from "@ecom/storefront-base";
import type { HomepageSection } from "./content";

export interface LandingPrice {
  price: number;
  compareAtPrice: number | null;
}

export interface LandingPageData {
  slug: string;
  title: string;
  draft: boolean;
  headline: string;
  subheadline: string | null;
  heroImageUrl: string | null;
  offer: { running: boolean; endsAt: string | null };
  sections: HomepageSection[];
  ctaText: string;
  formTitle: string | null;
  maxQty: number;
  seo: { title: string; description: string | null };
  cashOnDelivery: boolean;
  product: LandingPrice & {
    id: string;
    slug: string;
    name: string;
    images: string[];
    rating: number;
    reviewCount: number;
    inStock: boolean;
    variants: (LandingPrice & { id: string; label: string; inStock: boolean })[];
  };
  reviews: ProductReview[];
}

export interface LandingAddress {
  locationId?: string | null;
  division?: string;
  district: string;
  upazila?: string;
  addressLine1: string;
}

export interface LandingQuote {
  unitPrice: number | null;
  problem: string | null;
  shippingOptions: { id: string; name: string; fee: number; freeReason: string | null; minDays: number | null; maxDays: number | null }[];
  totals: { itemsSubtotal: number; discountTotal: number; shippingTotal: number; taxTotal: number; feeTotal: number; grandTotal: number };
  problems: string[];
}

interface Slugged {
  slug: string;
  preview?: string;
}
const url = (a: Slugged, tail: string) =>
  `/storefront/landing/${encodeURIComponent(a.slug)}/${tail}${a.preview ? `?preview=${encodeURIComponent(a.preview)}` : ""}`;

const landingApi = api.injectEndpoints({
  endpoints: (b) => ({
    landingView: b.mutation<null, Slugged>({ query: (a) => ({ url: url(a, "view"), method: "POST", body: {} }) }),
    landingQuote: b.mutation<LandingQuote, Slugged & { variantId?: string | null; qty: number; address: LandingAddress; shippingMethodId?: string }>({
      query: ({ slug, preview, ...body }) => ({ url: url({ slug, preview }, "quote"), method: "POST", body }),
    }),
    landingOrder: b.mutation<
      { orderKey: string; number: string; grandTotal: number },
      Slugged & {
        name: string;
        phone: string;
        address: LandingAddress;
        variantId?: string | null;
        qty: number;
        shippingMethodId: string;
        note?: string | null;
        salesCode?: string | null;
      }
    >({
      query: ({ slug, preview, ...body }) => ({ url: url({ slug, preview }, "order"), method: "POST", body }),
    }),
  }),
});

export const { useLandingViewMutation, useLandingQuoteMutation, useLandingOrderMutation } = landingApi;
