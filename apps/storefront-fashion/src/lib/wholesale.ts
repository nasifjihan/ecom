"use client";

/**
 * Business accounts and bulk prices (API: modules/wholesale). Bulk prices depend on who is signed
 * in (business accounts see theirs), so the product page asks for them in the browser.
 */
import { api } from "@ecom/api-client";
import { msg } from "@ecom/storefront-base";
import { useAppSelector } from "./store";

export type BusinessStatus = "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";

export interface BusinessDetails {
  companyName: string;
  businessType: string;
  contactPhone?: string | null;
  address?: string | null;
  tradeLicenseNo?: string | null;
  vatRegNo?: string | null;
  note?: string | null;
}

export interface MyBusinessAccount extends BusinessDetails {
  status: BusinessStatus;
  reviewNote: string | null;
  appliedAt: string;
}

export interface WholesaleStatus {
  enabled: boolean;
  intro: string | null;
  account: MyBusinessAccount | null;
}

export interface BulkTier {
  minQty: number;
  price: number;
  business: boolean;
}

export interface ProductBulkPrices {
  business: boolean;
  hasBusinessPrices: boolean;
  wholesaleEnabled: boolean;
  /** Per option (variantId) or for the product (null). */
  tiers: { variantId: string | null; tiers: BulkTier[] }[];
}

const TAG = { type: "Customer" as const, id: "WHOLESALE" };

const wholesaleApi = api.injectEndpoints({
  endpoints: (b) => ({
    wholesaleStatus: b.query<WholesaleStatus, boolean>({ query: () => "/storefront/wholesale", providesTags: [TAG] }),
    applyBusiness: b.mutation<MyBusinessAccount, BusinessDetails>({
      query: (body) => ({ url: "/storefront/wholesale/apply", method: "POST", body }),
      invalidatesTags: [TAG],
    }),
    productBulkPrices: b.query<ProductBulkPrices, { productId: string; signedIn: boolean }>({
      query: ({ productId }) => `/storefront/wholesale/tiers/${productId}`,
      providesTags: [TAG],
    }),
  }),
  overrideExisting: false,
});

export const { useApplyBusinessMutation } = wholesaleApi;

/** Whether the shop sells to businesses, and my business account (refetched on sign in / out). */
export function useWholesaleStatus() {
  const signedIn = useAppSelector((s) => s.auth.isAuthenticated);
  return wholesaleApi.useWholesaleStatusQuery(signedIn);
}

export function useProductBulkPrices(productId: string) {
  const signedIn = useAppSelector((s) => s.auth.isAuthenticated);
  return wholesaleApi.useProductBulkPricesQuery({ productId, signedIn }, { skip: !productId });
}

/** The tiers for the option on show: its own, else the product's. */
export function tiersForOption(data: ProductBulkPrices | undefined, variantId: string | null | undefined): BulkTier[] {
  if (!data) return [];
  const own = variantId ? data.tiers.find((t) => t.variantId === variantId) : undefined;
  return (own ?? data.tiers.find((t) => t.variantId === null))?.tiers ?? [];
}

export const BUSINESS_TYPES: { value: string; label: string }[] = [
  { value: "retailer", label: msg("Shop / retailer") },
  { value: "reseller", label: msg("Reseller / online seller") },
  { value: "corporate", label: msg("Company (corporate orders)") },
  { value: "institution", label: msg("School, office or institution") },
  { value: "other", label: msg("Other") },
];

export const BUSINESS_STATUS_WORDS: Record<BusinessStatus, string> = {
  PENDING: msg("Waiting for review"),
  APPROVED: msg("Approved"),
  REJECTED: msg("Not approved"),
  SUSPENDED: msg("Suspended"),
};
