"use client";

/** A store's storefronts, their web addresses, and where each product is sold and at what price (API: modules/storefronts). */
import { api } from "@ecom/api-client";

export interface StorefrontDomain {
  id: string;
  hostname: string;
  primary: boolean;
  /** False: not linked to a storefront, so it opens the default one. */
  linked: boolean;
}

export interface Storefront {
  id: string;
  name: string;
  code: string;
  isDefault: boolean;
  isActive: boolean;
  priceAdjustPercent: number;
  includeNewProducts: boolean;
  sortOrder: number;
  domains: StorefrontDomain[];
  orders: number;
  ownPrices: number;
  hiddenProducts: number;
  addedProducts: number;
  ownTheme: boolean;
  ownHomepage: boolean;
  ownMenus: number;
  /** Payment methods offered here (empty: every enabled one). */
  paymentGateways: string[];
  courierAccountId: string | null;
  /** Courier accounts customers choose from at checkout (empty: they don't choose). */
  checkoutCourierIds: string[];
}

/** A storefront's name for filters and pickers (readable by any staff member). */
export interface StorefrontOption {
  id: string;
  name: string;
  code: string;
  isDefault: boolean;
  isActive: boolean;
}

export type StorefrontInput = Partial<{
  name: string;
  code: string;
  isActive: boolean;
  priceAdjustPercent: number;
  includeNewProducts: boolean;
  sortOrder: number;
  paymentGateways: string[];
  courierAccountId: string | null;
  checkoutCourierIds: string[];
}>;

export interface ProductStorefront {
  storefrontId: string;
  name: string;
  code: string;
  isDefault: boolean;
  isActive: boolean;
  priceAdjustPercent: number;
  includeNewProducts: boolean;
  listed: boolean;
  regularPrice: number | null;
  salePrice: number | null;
  /** Each option with its own price here (null: uses the product's price there). */
  options: ProductStorefrontOption[];
}

export interface ProductStorefrontOption {
  variantId: string;
  label: string;
  /** What the option sells for on the product (sale price when lower), before any storefront change. */
  basePrice: number | null;
  regularPrice: number | null;
  salePrice: number | null;
}

export interface ProductStorefrontInput {
  storefrontId: string;
  listed: boolean;
  regularPrice?: number | null;
  salePrice?: number | null;
  /** Own prices per option; an option sent without a price loses its own price. */
  options?: { variantId: string; regularPrice: number | null; salePrice: number | null }[];
}

const LIST = { type: "Store" as const, id: "STOREFRONTS" };
const product = (id: string) => ({ type: "Product" as const, id: `STOREFRONTS-${id}` });

export const storefrontsApi = api.injectEndpoints({
  endpoints: (b) => ({
    storefronts: b.query<Storefront[], void>({ query: () => "/admin/storefronts", providesTags: [LIST] }),
    storefrontOptions: b.query<StorefrontOption[], void>({ query: () => "/admin/storefronts/options", providesTags: [LIST] }),
    createStorefront: b.mutation<{ id: string }, StorefrontInput>({
      query: (body) => ({ url: "/admin/storefronts", method: "POST", body }),
      invalidatesTags: [LIST],
    }),
    updateStorefront: b.mutation<{ id: string }, StorefrontInput & { id: string }>({
      query: ({ id, ...body }) => ({ url: `/admin/storefronts/${id}`, method: "PATCH", body }),
      invalidatesTags: [LIST, "Theme", "Homepage", "Menu"],
    }),
    makeDefaultStorefront: b.mutation<{ id: string }, string>({
      query: (id) => ({ url: `/admin/storefronts/${id}/default`, method: "POST" }),
      invalidatesTags: [LIST, "Theme", "Homepage", "Menu"],
    }),
    deleteStorefront: b.mutation<void, string>({
      query: (id) => ({ url: `/admin/storefronts/${id}`, method: "DELETE" }),
      invalidatesTags: [LIST],
    }),
    addStorefrontDomain: b.mutation<{ id: string; hostname: string }, { id: string; hostname: string }>({
      query: ({ id, hostname }) => ({ url: `/admin/storefronts/${id}/domains`, method: "POST", body: { hostname } }),
      invalidatesTags: [LIST],
    }),
    moveStorefrontDomain: b.mutation<{ id: string }, { domainId: string; storefrontId: string | null }>({
      query: ({ domainId, storefrontId }) => ({ url: `/admin/storefronts/domains/${domainId}`, method: "PATCH", body: { storefrontId } }),
      invalidatesTags: [LIST],
    }),
    productStorefronts: b.query<ProductStorefront[], string>({
      query: (productId) => `/admin/storefronts/products/${productId}`,
      providesTags: (_r, _e, id) => [product(id)],
    }),
    saveProductStorefronts: b.mutation<ProductStorefront[], { productId: string; storefronts: ProductStorefrontInput[] }>({
      query: ({ productId, storefronts }) => ({ url: `/admin/storefronts/products/${productId}`, method: "PUT", body: { storefronts } }),
      invalidatesTags: (_r, _e, { productId }) => [product(productId), LIST],
    }),
  }),
  overrideExisting: false,
});

export const {
  useStorefrontsQuery,
  useStorefrontOptionsQuery,
  useCreateStorefrontMutation,
  useUpdateStorefrontMutation,
  useMakeDefaultStorefrontMutation,
  useDeleteStorefrontMutation,
  useAddStorefrontDomainMutation,
  useMoveStorefrontDomainMutation,
  useProductStorefrontsQuery,
  useSaveProductStorefrontsMutation,
} = storefrontsApi;

/** The address to open a storefront at (its first web address, else the configured storefront URL). */
export function storefrontUrl(sf: Pick<Storefront, "domains"> | undefined, fallback: string): string {
  const host = sf?.domains[0]?.hostname;
  if (!host) return fallback;
  return `${/^(localhost|127\.0\.0\.1)(:|$)/.test(host) ? "http" : "https"}://${host}`;
}
