"use client";

/**
 * Automatic promotions on the storefront: what shows in each slot (announcement bar, home,
 * product page, cart…), and coupons the customer can pick from (public ones and any given to them).
 * What an order actually gets is worked out by the API (see cart-prices.ts: `promotions`).
 */
import { api } from "@ecom/api-client";

export type PromoSlot =
  | "announcement_bar"
  | "home_hero"
  | "home_below_categories"
  | "home_offers"
  | "category_banner"
  | "product_detail"
  | "cart"
  | "checkout"
  | "entry_popup";

export interface SlotPromotion {
  id: string;
  type: "discount" | "free_gift" | "bxgy" | "free_delivery";
  summary: string;
  headline: string;
  message: string | null;
  imageUrl: string | null;
  linkUrl: string | null;
  slots: PromoSlot[];
  endsAt: string | null;
}

/** What the API worked out for the cart (StorefrontService.promotionsView). */
export interface CartPromotions {
  droppedForCoupon: boolean;
  total: number;
  discount: { id: string; name: string; amount: number } | null;
  bxgy: { id: string; name: string; productId: string; productName: string; freeUnits: number; amount: number }[];
  gifts: { promotionId: string; promotionName: string; productId: string; variantId: string | null; title: string; qty: number; imageUrl: string | null }[];
  freeDelivery: { id: string; name: string } | null;
  nudges: { id: string; name: string; type: string; message: string }[];
  notes: string[];
}

export interface AvailableCoupon {
  code: string;
  summary: string;
  description: string | null;
  minSubtotal: number | null;
  expiresAt: string | null;
  forYou: boolean;
  worksWithPromotions: boolean;
}

const promotionsApi = api.injectEndpoints({
  endpoints: (b) => ({
    slotPromotions: b.query<SlotPromotion[], { slot: PromoSlot; productId?: string; categorySlug?: string }>({
      query: (params) => ({ url: "/storefront/promotions", params }),
      keepUnusedDataFor: 120,
    }),
    availableCoupons: b.query<AvailableCoupon[], void>({
      query: () => "/storefront/checkout/coupons/available",
    }),
  }),
  overrideExisting: false,
});

export const { useSlotPromotionsQuery, useAvailableCouponsQuery } = promotionsApi;
