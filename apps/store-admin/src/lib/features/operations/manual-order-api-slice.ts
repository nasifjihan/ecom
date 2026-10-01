"use client";

/** Orders staff enter by hand (API: /admin/orders/manual, /manual/quote). */
import { api } from "@ecom/api-client";
import type { OrderSource } from "./operations-api-slice";

export type ManualDelivery =
  | { type: "method"; methodId: string }
  | { type: "custom"; fee: number; name?: string }
  | { type: "pickup" };

export interface ManualOrderInput {
  customer: { id?: string | null; firstName?: string; lastName?: string; phone?: string; email?: string };
  items: { productId: string; variantId?: string | null; qty: number }[];
  address: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    locationId?: string | null;
    division?: string;
    district?: string;
    upazila?: string;
    postcode?: string;
    addressLine1?: string;
    addressLine2?: string;
  };
  delivery: ManualDelivery;
  couponCode?: string;
  /** The store's automatic promotions; on unless staff switch them off. */
  applyPromotions?: boolean;
  /** Take what the store allows from the customer's wallet (known customers). */
  useWallet?: boolean;
  discount?: { type: "percent" | "fixed"; value: number } | null;
  paymentGateway: string;
  paid: boolean;
  transactionId?: string;
  source: OrderSource;
  /** The storefront whose prices, promotions and delivery charges apply (default: the main one). */
  storefrontId?: string;
  status: "PENDING" | "PROCESSING";
  customerNote?: string;
  staffNote?: string;
  notifyCustomer: boolean;
  /** Make the order from this quotation (its customer, lines, agreed prices and discount). */
  quotationId?: string;
  /** Made from this CRM lead (the lead is won). */
  leadId?: string;
  /** The salesperson credited; null: nobody; left out: the quote's maker or whoever enters it, if on the sales team. */
  salespersonId?: string | null;
}

/** Automatic promotions on a priced order (StorefrontService.promotionsView). */
export interface OrderPromotions {
  droppedForCoupon: boolean;
  total: number;
  discount: { id: string; name: string; amount: number } | null;
  bxgy: { id: string; name: string; productName: string; freeUnits: number; amount: number }[];
  gifts: { promotionId: string; promotionName: string; title: string; qty: number; imageUrl: string | null }[];
  freeDelivery: { id: string; name: string } | null;
  nudges: { id: string; message: string }[];
  notes: string[];
}

export interface ManualOrderQuote {
  paymentMethods: { code: string; name: string; enabled: boolean }[];
  customer: { id: string; name: string; phone: string | null; email: string | null; orderCount: number } | null;
  lines: {
    productId: string;
    variantId: string | null;
    qty: number;
    name: string | null;
    sku: string | null;
    unitPrice: number | null;
    compareAtPrice: number | null;
    flashSale: string | null;
    /** A bulk price applied: the tier reached, and whether it's a business-only price. */
    bulk?: { minQty: number; business: boolean } | null;
    lineSubtotal: number | null;
    problem: string | null;
  }[];
  shippingOptions: { id: string; name: string; fee: number; freeReason: string | null; minDays: number | null; maxDays: number | null }[];
  delivery: { code: string; name: string; fee: number } | null;
  coupon: { code: string } | null;
  couponError: string | null;
  promotions: OrderPromotions;
  discountCapPct: number;
  /** The customer's loyalty level discount, and their wallet (known customers). */
  member: { level: string; percent: number } | null;
  wallet: { balance: number; enabled: boolean; maxPercent: number };
  totals: {
    itemsSubtotal: number;
    promotionDiscount: number;
    couponDiscount: number;
    manualDiscount: number;
    memberDiscount: number;
    discountTotal: number;
    shippingTotal: number;
    taxTotal: number;
    /** Prices include VAT: taxTotal is part of grandTotal, not added to it. */
    taxIncluded?: boolean;
    orderTotal: number;
    walletUsed: number;
    grandTotal: number;
    qty: number;
  };
  problems: string[];
}

export interface PickProduct {
  id: string;
  name: string;
  sku: string | null;
  type: string;
  price: number;
  stockQty: number | null;
  manageStock: boolean;
  variantCount: number;
  imageUrl: string | null;
}
export interface PickVariant {
  id: string;
  label: string;
  sku: string | null;
  price: number;
  stockQty: number | null;
  manageStock: boolean;
}
/** A delivery area the store serves. */
export interface OrderArea {
  id: string;
  parentId: string | null;
  type: "DIVISION" | "DISTRICT" | "UPAZILA" | "THANA";
  en: string;
  bn: string;
}
export interface PickCustomer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  orderCount: number;
}

export const manualOrderApi = api.injectEndpoints({
  endpoints: (b) => ({
    // The order form's own searches (need only the orders.create permission).
    pickProducts: b.query<PickProduct[], string>({
      query: (search) => ({ url: "/admin/orders/manual/products", params: { search } }),
    }),
    pickVariants: b.query<PickVariant[], string>({
      query: (productId) => `/admin/orders/manual/products/${productId}/variants`,
    }),
    orderAreas: b.query<OrderArea[], void>({
      query: () => "/admin/orders/manual/areas",
      keepUnusedDataFor: 3600,
    }),
    pickCustomers: b.query<PickCustomer[], string>({
      query: (search) => ({ url: "/admin/orders/manual/customers", params: { search } }),
    }),
    quoteManualOrder: b.mutation<ManualOrderQuote, ManualOrderInput>({
      query: (body) => ({ url: "/admin/orders/manual/quote", method: "POST", body }),
    }),
    createManualOrder: b.mutation<{ id: string; number: string; grandTotal: number; customerId: string }, ManualOrderInput>({
      query: (body) => ({ url: "/admin/orders/manual", method: "POST", body }),
      invalidatesTags: ["Order", "Customer", "Lead"],
    }),
  }),
});

export const {
  useQuoteManualOrderMutation,
  useCreateManualOrderMutation,
  usePickProductsQuery,
  usePickVariantsQuery,
  usePickCustomersQuery,
  useOrderAreasQuery,
} = manualOrderApi;
