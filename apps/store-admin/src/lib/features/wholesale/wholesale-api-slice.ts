"use client";

/** Business accounts, bulk prices and pricing by margin (API: modules/wholesale). */
import { api } from "@ecom/api-client";

export type BusinessStatus = "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";
export type BusinessType = "retailer" | "reseller" | "corporate" | "institution" | "other";

export interface WholesaleSettings {
  enabled: boolean;
  autoApprove: boolean;
  intro: string | null;
  counts: Partial<Record<BusinessStatus, number>>;
}

export interface BusinessDetails {
  companyName: string;
  businessType: BusinessType;
  contactPhone: string | null;
  address: string | null;
  tradeLicenseNo: string | null;
  vatRegNo: string | null;
  note: string | null;
}

export interface BusinessAccount extends BusinessDetails {
  id: string;
  status: BusinessStatus;
  reviewNote: string | null;
  reviewedAt: string | null;
  appliedAt: string;
  customer: { id: string; name: string; email: string | null; phone: string | null; orderCount: number; totalSpent: number };
}

export interface AccountsPage {
  rows: BusinessAccount[];
  total: number;
  page: number;
  perPage: number;
}

export interface PriceTier {
  id?: string;
  variantId: string | null;
  minQty: number;
  price: number;
  forEveryone: boolean;
}

export interface ProductTiers {
  price: number | null;
  cost: number | null;
  variants: { id: string; label: string; price: number | null; cost: number | null }[];
  tiers: PriceTier[];
}

export interface MarginRow {
  productId: string;
  variantId: string | null;
  name: string;
  option: string | null;
  sku: string | null;
  status: string;
  imageUrl: string | null;
  tierCount: number;
  cost: number | null;
  price: number | null;
  salePrice: number | null;
  margin: number | null;
  saleMargin: number | null;
}

export interface MarginsPage {
  rows: MarginRow[];
  total: number;
  page: number;
  perPage: number;
  summary: { rows: number; missingCost: number; belowCost: number; averageMargin: number | null };
}

const T = { type: "Customer" as const, id: "WHOLESALE" };
const P = { type: "Product" as const, id: "MARGINS" };
const clean = (o: object) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== ""));

export const wholesaleApi = api.injectEndpoints({
  endpoints: (b) => ({
    wholesaleSettings: b.query<WholesaleSettings, void>({ query: () => "/admin/wholesale/settings", providesTags: [T] }),
    updateWholesaleSettings: b.mutation<WholesaleSettings, Partial<Omit<WholesaleSettings, "counts">>>({
      query: (body) => ({ url: "/admin/wholesale/settings", method: "PATCH", body }),
      invalidatesTags: [T],
    }),
    businessAccounts: b.query<AccountsPage, { status?: BusinessStatus; search?: string; page?: number }>({
      query: (params) => ({ url: "/admin/wholesale/accounts", params: clean(params) }),
      providesTags: [T],
    }),
    addBusinessAccount: b.mutation<BusinessAccount, BusinessDetails & { customerId: string }>({
      query: (body) => ({ url: "/admin/wholesale/accounts", method: "POST", body }),
      invalidatesTags: [T],
    }),
    updateBusinessAccount: b.mutation<BusinessAccount, Partial<BusinessDetails> & { id: string }>({
      query: ({ id, ...body }) => ({ url: `/admin/wholesale/accounts/${id}`, method: "PATCH", body }),
      invalidatesTags: [T],
    }),
    reviewBusinessAccount: b.mutation<BusinessAccount, { id: string; action: "approve" | "reject" | "suspend"; note?: string | null }>({
      query: ({ id, ...body }) => ({ url: `/admin/wholesale/accounts/${id}/review`, method: "POST", body }),
      invalidatesTags: [T],
    }),
    deleteBusinessAccount: b.mutation<null, string>({
      query: (id) => ({ url: `/admin/wholesale/accounts/${id}`, method: "DELETE" }),
      invalidatesTags: [T],
    }),
    customerBusinessAccount: b.query<BusinessAccount | null, string>({
      query: (id) => `/admin/wholesale/customers/${id}`,
      providesTags: [T],
    }),
    productTiers: b.query<ProductTiers, string>({
      query: (id) => `/admin/wholesale/products/${id}/tiers`,
      providesTags: (_r, _e, id) => [{ type: "Product" as const, id: `TIERS-${id}` }],
    }),
    saveProductTiers: b.mutation<ProductTiers, { productId: string; tiers: PriceTier[] }>({
      query: ({ productId, tiers }) => ({ url: `/admin/wholesale/products/${productId}/tiers`, method: "PUT", body: { tiers } }),
      invalidatesTags: (_r, _e, { productId }) => [{ type: "Product" as const, id: `TIERS-${productId}` }, P],
    }),
    margins: b.query<MarginsPage, { search?: string; categoryId?: string; cost?: "all" | "withCost" | "noCost"; page?: number; perPage?: number }>({
      query: (params) => ({ url: "/admin/wholesale/margins", params: clean(params) }),
      providesTags: [P],
    }),
    applyPrices: b.mutation<{ updated: number }, { rows: { productId: string; variantId: string | null; regularPrice: number }[] }>({
      query: (body) => ({ url: "/admin/wholesale/margins/apply", method: "POST", body }),
      invalidatesTags: [P, { type: "Product" as const, id: "LIST" }],
    }),
  }),
});

export const {
  useWholesaleSettingsQuery,
  useUpdateWholesaleSettingsMutation,
  useBusinessAccountsQuery,
  useAddBusinessAccountMutation,
  useUpdateBusinessAccountMutation,
  useReviewBusinessAccountMutation,
  useDeleteBusinessAccountMutation,
  useCustomerBusinessAccountQuery,
  useProductTiersQuery,
  useSaveProductTiersMutation,
  useMarginsQuery,
  useApplyPricesMutation,
} = wholesaleApi;

export const BUSINESS_STATUS_LABELS: Record<BusinessStatus, string> = {
  PENDING: "Waiting for review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  SUSPENDED: "Suspended",
};

export const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  retailer: "Shop / retailer",
  reseller: "Reseller / online seller",
  corporate: "Company (corporate orders)",
  institution: "School, office or institution",
  other: "Other",
};
