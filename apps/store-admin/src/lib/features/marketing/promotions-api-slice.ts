"use client";

/** Automatic promotions: discounts, free gifts, buy X get Y, free delivery (API: modules/marketing/promotions). */
import { api } from "@ecom/api-client";

export type PromotionType = "discount" | "free_gift" | "bxgy" | "free_delivery";
export type PromotionState = "live" | "scheduled" | "ended" | "paused";

export const PROMOTION_TYPES: { value: PromotionType; label: string; help: string }[] = [
  { value: "discount", label: "Percentage or fixed discount", help: "Money off the items. Only the best discount applies to an order." },
  { value: "free_gift", label: "Free gift above a spend", help: "Adds a product at no charge once the order reaches the amount." },
  { value: "bxgy", label: "Buy X get Y free (same product)", help: "E.g. buy 2 get 1 free. Works together with a discount." },
  { value: "free_delivery", label: "Free delivery", help: "No delivery charge once the order reaches the amount." },
];

export const PROMOTION_SLOTS: { value: string; label: string }[] = [
  { value: "announcement_bar", label: "Top announcement bar" },
  { value: "home_hero", label: "Home: under the hero" },
  { value: "home_below_categories", label: "Home: below categories" },
  { value: "home_offers", label: "Home: offers section" },
  { value: "category_banner", label: "Category page banner" },
  { value: "product_detail", label: "Product page (products it covers)" },
  { value: "cart", label: "Cart" },
  { value: "checkout", label: "Checkout" },
  { value: "entry_popup", label: "Pop-up when a visitor arrives" },
];

export interface Promotion {
  id: string;
  name: string;
  type: PromotionType;
  summary: string;
  state: PromotionState;
  discountType: "percentage" | "fixed" | null;
  discountValue: number | null;
  maxDiscount: number | null;
  minOrder: number | null;
  minQty: number | null;
  productIds: string[];
  categoryIds: string[];
  includeSaleItems: boolean;
  buyQty: number | null;
  getQty: number | null;
  giftProductId: string | null;
  giftVariantId: string | null;
  giftQty: number;
  gift: { name: string; imageUrl: string | null } | null;
  slots: string[];
  /** Only on these storefronts (empty: all). */
  storefrontIds: string[];
  headline: string | null;
  message: string | null;
  imageUrl: string | null;
  linkUrl: string | null;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  usedCount: number;
  createdAt: string;
}

export type PromotionInput = Partial<Omit<Promotion, "id" | "summary" | "state" | "gift" | "usedCount" | "createdAt">>;

export interface PickedProduct {
  id: string;
  name: string;
  sku: string | null;
  imageUrl: string | null;
  price?: number;
  variantCount?: number;
}

const LIST = { type: "Store" as const, id: "PROMOTIONS" };

export const promotionsApi = api.injectEndpoints({
  endpoints: (b) => ({
    promotions: b.query<Promotion[], { state?: PromotionState; type?: PromotionType; search?: string } | void>({
      query: (params) => ({ url: "/admin/marketing/promotions", params: params ?? {} }),
      providesTags: [LIST],
    }),
    createPromotion: b.mutation<Promotion, PromotionInput>({
      query: (body) => ({ url: "/admin/marketing/promotions", method: "POST", body }),
      invalidatesTags: [LIST],
    }),
    updatePromotion: b.mutation<Promotion, PromotionInput & { id: string }>({
      query: ({ id, ...body }) => ({ url: `/admin/marketing/promotions/${id}`, method: "PATCH", body }),
      invalidatesTags: [LIST],
    }),
    endPromotion: b.mutation<Promotion, string>({
      query: (id) => ({ url: `/admin/marketing/promotions/${id}/end`, method: "POST" }),
      invalidatesTags: [LIST],
    }),
    deletePromotion: b.mutation<{ deleted: boolean }, string>({
      query: (id) => ({ url: `/admin/marketing/promotions/${id}`, method: "DELETE" }),
      invalidatesTags: [LIST],
    }),
    promoPickProducts: b.query<PickedProduct[], string>({
      query: (search) => ({ url: "/admin/marketing/promotions/pick/products", params: { search } }),
    }),
    promoProductsByIds: b.query<PickedProduct[], string[]>({
      query: (ids) => ({ url: "/admin/marketing/promotions/pick/products", params: { ids: ids.join(",") } }),
    }),
    promoPickVariants: b.query<{ id: string; label: string; price: number; stockQty: number | null; manageStock: boolean }[], string>({
      query: (id) => `/admin/marketing/promotions/pick/products/${id}/variants`,
    }),
    promoCategories: b.query<{ id: string; name: string; depth: number }[], void>({
      query: () => "/admin/marketing/promotions/pick/categories",
      keepUnusedDataFor: 600,
    }),
  }),
});

export const {
  usePromotionsQuery,
  useCreatePromotionMutation,
  useUpdatePromotionMutation,
  useEndPromotionMutation,
  useDeletePromotionMutation,
  usePromoPickProductsQuery,
  usePromoProductsByIdsQuery,
  usePromoPickVariantsQuery,
  usePromoCategoriesQuery,
} = promotionsApi;
