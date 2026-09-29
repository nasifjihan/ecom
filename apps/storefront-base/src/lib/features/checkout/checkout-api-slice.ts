import { api } from "@ecom/api-client";
import { CouponType, PaymentMethod } from "@ecom/shared-types";

export type ShippingRate = {
  providerId: string;
  providerName: string;
  methodId: string;
  methodName: string;
  cost: number;
  currency: string;
  minDeliveryDays?: number;
  maxDeliveryDays?: number;
  freeFromSubtotal?: number;
  description?: string;
  estimatedLabel?: string;
};

/** Raw shape of GET /storefront/shipping/rates (see ShippingService.computeShippingOptions). */
type ShippingRatesResponse = {
  options: {
    id: string;
    code: string;
    name: string;
    provider?: string | null;
    description?: string | null;
    finalRateBDT: number;
    savingsBDT: number;
    freeReason?: string | null;
    transit: { minDays: number | null; maxDays: number | null };
  }[];
  reason?: string | null;
};

/** Raw shape of GET /storefront/shipping/taxes (see TaxRateRepository.resolveForAddress). */
type TaxesResponse = {
  totalTax: number;
  breakdown: { name: string; ratePct: number; base: number; amount: number }[];
};

export type PaymentMethodOption = {
  code: string;
  name: string;
  description?: string;
  instructions?: string;
  /** "manual": the customer sends money to accountNumber and gives the transaction ID. */
  mode?: "manual" | "online" | "cod";
  accountNumber?: string;
  /** personal | agent | merchant */
  accountType?: string;
  feeFixed: number;
  feePercent: number;
};

/** A bKash / Nagad / Rocket / bank payment paid by hand, and what the shop made of it. */
export type OrderPayment = {
  method: string;
  methodName: string;
  manual: boolean;
  accountNumber: string | null;
  accountType: string | null;
  instructions: string | null;
  /** What's still to pay after verified payments. */
  due: number;
  /** A transaction ID can be sent now (nothing waiting to be checked, money still due). */
  canSubmit: boolean;
  transfers: { transactionId: string | null; amount: number; status: "to_verify" | "verified" | "rejected" | string; rejectReason: string | null; createdAt: string }[];
};

export type TransferInput = { transactionId: string; senderNumber?: string };

export type OrderDetail = {
  orderId: string;
  orderRef: string;
  orderKey: string;
  status: string;
  paymentStatus: string;
  paymentGateway: string;
  createdAt: string;
  email: string;
  phone?: string | null;
  shippingMethodName: string;
  shipping: OrderAddressSummary;
  billing: OrderAddressSummary;
  items: { id: string; productId: string | null; title: string; variantLabel: string; image: string; qty: number; price: number; lineTotal: number; giftFrom?: string | null; giftBox?: { key: string; name: string; message: string | null; role: "box" | "item" } | null }[];
  itemsSubtotal: number;
  discountTotal: number;
  /** Loyalty level discount (part of discountTotal), wallet payment and cashback earned. */
  memberDiscount?: number;
  memberLevel?: string | null;
  walletUsed?: number;
  cashback?: number;
  /** Part of discountTotal from automatic promotions, listed in `promotions`. */
  promotionDiscount?: number;
  promotions?: { name: string; type: string; amount: number }[];
  couponUsed?: string | null;
  shippingTotal: number;
  taxTotal: number;
  feeTotal: number;
  grandTotal: number;
  currency: string;
  payment?: OrderPayment;
};

export type OrderAddressSummary = {
  name: string;
  address: string;
  city?: string | null;
  upazila?: string | null;
  division?: string | null;
  postcode?: string | null;
  country?: string | null;
};

/** A Bangladesh delivery area the store serves (GET /storefront/locations). */
export type StoreLocation = {
  id: string;
  parentId: string | null;
  type: "DIVISION" | "DISTRICT" | "UPAZILA" | "THANA";
  en: string;
  bn: string;
};

export type TaxBreakdown = {
  name: string;
  rate: number;
  amount: number;
};

export type CouponApplyResult = {
  valid: boolean;
  couponCode: string;
  discountAmount: number;
  discountType?: "PERCENTAGE" | "FIXED" | "FREE_SHIPPING" | "BOGO";
  freeShipping?: boolean;
  message?: string;
  newCartTotal?: number;
  newSubtotal?: number;
  /** False: the store's automatic promotions come off the order while this coupon is on it. */
  worksWithPromotions?: boolean;
  /** Shipping amount waived by a free-shipping coupon (0 otherwise). */
  shippingDiscount?: number;
  errorMessage?: string;
};

export type OrderItemSnapshot = {
  productId: string;
  variantId?: string;
  qty: number;
  price: number;
  title?: string;
  image?: string;
  sku?: string;
  variantLabel?: string;
  weightKG?: number;
  /** Part of a gift box (see cartOrderLines). */
  box?: { key: string; giftBoxId: string; role: "box" | "item"; message?: string | null };
};

export type AddressPayload = {
  firstName: string;
  lastName: string;
  company?: string;
  country: string;
  division: string;
  district: string;
  upazila?: string;
  /** Deepest area picked (upazila/thana, else district); the API fills the names from it. */
  locationId?: string | null;
  postcode: string;
  addressLine1: string;
  addressLine2?: string;
  phone: string;
  email?: string;
};

export type PlaceOrderBody = {
  /** Optional: a phone number is enough to order. */
  email?: string;
  phone: string;
  isGuest: boolean;
  accountCreatePassword?: string;
  subscribeNewsletter?: boolean;
  shippingAddress: AddressPayload;
  billingAddress?: AddressPayload;
  billingSameAsShipping?: boolean;
  /** `ShippingRate.methodId` of the chosen rate. */
  shippingMethodId?: string;
  shippingProviderId?: string;
  shippingCost?: number;
  paymentGateway: PaymentMethod | string;
  paymentDetails?: Record<string, unknown>;
  /** Manual bKash / Nagad / Rocket / bank payments: the transaction ID and the number paid from. */
  payment?: TransferInput;
  couponCodes?: string[];
  items: OrderItemSnapshot[];
  subtotal?: number;
  shippingTotal?: number;
  taxTotal?: number;
  discountTotal?: number;
  grandTotal?: number;
  currency?: string;
  customerNote?: string;
  termsAgreed?: boolean;
  /** Signed-in customers: pay what the shop allows from the wallet. */
  useWallet?: boolean;
  /** A salesperson's share-link code: the order is credited to them. */
  salesCode?: string;
};

export type OrderResult = {
  orderId: string;
  orderRef: string;
  orderNumber?: string;
  /** Secret key for the guest order lookup on the thank-you page. */
  orderKey: string;
  status: string;
  paymentStatus?: string;
  grandTotal: number;
  currency: string;
  redirectPaymentURL?: string;
  customerEmail?: string;
  createdAt?: string;
  expectedDeliveryDate?: string;
  invoiceUrl?: string;
};

export const checkoutApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getLocations: builder.query<StoreLocation[], void>({
      query: () => "/storefront/locations",
      keepUnusedDataFor: 3600,
    }),

    getShippingRates: builder.query<
      ShippingRate[],
      {
        countryCode?: string;
        division?: string;
        district?: string;
        upazila?: string;
        locationId?: string | null;
        subtotal?: number;
        weightKG?: number;
        qty?: number;
        stateOrCity?: string;
      }
    >({
      query: (args) => {
        const params = new URLSearchParams();
        if (args.countryCode) params.set("countryCode", args.countryCode);
        if (args.division) params.set("division", args.division);
        if (args.district) params.set("district", args.district);
        if (args.upazila) params.set("upazila", args.upazila);
        if (args.locationId) params.set("locationId", args.locationId);
        if (args.subtotal) params.set("subtotal", String(args.subtotal));
        if (args.weightKG) params.set("weightKG", String(args.weightKG));
        if (args.qty) params.set("qty", String(args.qty));
        if (args.stateOrCity) params.set("stateOrCity", args.stateOrCity);
        const qs = params.toString();
        return {
          url: qs ? `/storefront/shipping/rates?${qs}` : `/storefront/shipping/rates`,
          method: "GET",
        };
      },
      transformResponse: (res: ShippingRatesResponse): ShippingRate[] =>
        (res?.options ?? []).map((o) => {
          const min = o.transit?.minDays ?? undefined;
          const max = o.transit?.maxDays ?? undefined;
          return {
            providerId: o.provider ?? o.code,
            providerName: o.provider ?? o.name,
            methodId: String(o.id),
            methodName: o.name,
            cost: o.finalRateBDT,
            currency: "BDT",
            minDeliveryDays: min,
            maxDeliveryDays: max,
            description: o.freeReason ? "Free delivery on this order" : o.description ?? undefined,
            estimatedLabel:
              min !== undefined && max !== undefined ? (min === max ? `${max} day${max === 1 ? "" : "s"}` : `${min}-${max} days`) : undefined,
          };
        }),
      providesTags: ["Order"],
    }),

    getTaxes: builder.query<
      { total: number; currency: string; lines: TaxBreakdown[] },
      {
        countryCode?: string;
        division?: string;
        district?: string;
        subtotal?: number;
        shipping?: number;
      }
    >({
      query: (args) => {
        const params = new URLSearchParams();
        if (args.countryCode) params.set("countryCode", args.countryCode);
        if (args.subtotal) params.set("subtotal", String(args.subtotal));
        if (args.division) params.set("state", args.division);
        if (args.district) params.set("city", args.district);
        if (args.shipping) params.set("shippingTotal", String(args.shipping));
        const qs = params.toString();
        return {
          url: qs ? `/storefront/shipping/taxes?${qs}` : `/storefront/shipping/taxes`,
          method: "GET",
        };
      },
      transformResponse: (res: TaxesResponse) => ({
        total: res?.totalTax ?? 0,
        currency: "BDT",
        lines: (res?.breakdown ?? [])
          .filter((b) => b.amount > 0)
          .map((b) => ({ name: b.name, rate: b.ratePct / 100, amount: b.amount })),
      }),
      providesTags: ["Order"],
    }),

    applyCoupon: builder.mutation<
      CouponApplyResult,
      {
        code: string;
        subtotal: number;
        items: { productId: string; variantId?: string; price: number; qty: number }[];
        cartItemsIds?: string[];
        shippingTotal?: number;
        countryCode?: string;
        email?: string;
      }
    >({
      query: (body) => ({
        url: `/storefront/checkout/coupons/apply`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["Coupon"],
    }),

    placeOrder: builder.mutation<OrderResult, PlaceOrderBody>({
      query: (body) => ({
        url: `/storefront/checkout`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["Order"],
    }),

    getPaymentMethods: builder.query<PaymentMethodOption[], void>({
      query: () => ({ url: `/storefront/checkout/payment-methods`, method: "GET" }),
    }),

    getOrderByKey: builder.query<OrderDetail, string>({
      query: (orderKey) => ({ url: `/storefront/checkout/orders/${encodeURIComponent(orderKey)}`, method: "GET" }),
      providesTags: (_res, _err, key) => [{ type: "Order" as const, id: key }],
    }),

    /** Sends a transaction ID for an order from the thank-you page (the order key is the secret). */
    submitOrderPayment: builder.mutation<{ transactionId: string; status: string; amount: number }, TransferInput & { orderKey: string }>({
      query: ({ orderKey, ...body }) => ({ url: `/storefront/checkout/orders/${encodeURIComponent(orderKey)}/payment`, method: "POST", body }),
      invalidatesTags: (_res, _err, { orderKey }) => [{ type: "Order" as const, id: orderKey }],
    }),
  }),
  overrideExisting: true,
});

export const {
  useGetLocationsQuery,
  useGetShippingRatesQuery,
  useLazyGetShippingRatesQuery,
  useGetTaxesQuery,
  useLazyGetTaxesQuery,
  useApplyCouponMutation,
  usePlaceOrderMutation,
  useGetPaymentMethodsQuery,
  useGetOrderByKeyQuery,
  useSubmitOrderPaymentMutation,
} = checkoutApi;

/**
 * Human-readable message from an RTK Query error. Non-2xx responses carry the API
 * envelope in `data` ({ message, errors }); envelope-level failures carry the errors
 * map or the message itself (see @ecom/api-client baseQuery).
 */
export function apiErrorMessage(err: unknown, fallback = "Something went wrong. Please try again."): string {
  const e = err as { data?: unknown; error?: string; message?: string } | undefined;
  const data = e?.data as { message?: unknown; errors?: unknown } | string | undefined;
  if (typeof data === "string" && data) return data;
  if (data && typeof data === "object") {
    const errors = (data.errors ?? (data.message === undefined ? data : undefined)) as Record<string, unknown> | undefined;
    const first = errors && typeof errors === "object" ? Object.entries(errors)[0] : undefined;
    if (first) return `${first[0]}: ${Array.isArray(first[1]) ? first[1].join(", ") : String(first[1])}`;
    if (typeof data.message === "string" && data.message) return data.message;
  }
  return e?.error ?? e?.message ?? fallback;
}

export function mapCouponTypeToDisplay(
  t?: CouponType | string,
): "PERCENTAGE" | "FIXED" | "FREE_SHIPPING" | "BOGO" | undefined {
  switch (t) {
    case CouponType.PERCENT_CART:
    case CouponType.PERCENT_PRODUCT:
    case "PERCENTAGE":
      return "PERCENTAGE";
    case CouponType.FIXED_CART:
    case CouponType.FIXED_PRODUCT:
    case "FIXED":
      return "FIXED";
    case CouponType.FREE_SHIPPING:
    case "FREE_SHIPPING":
      return "FREE_SHIPPING";
    case CouponType.BUY_X_GET_Y:
    case "BOGO":
      return "BOGO";
    default:
      return undefined;
  }
}
