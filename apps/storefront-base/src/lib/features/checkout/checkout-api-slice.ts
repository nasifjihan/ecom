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
};

export type AddressPayload = {
  firstName: string;
  lastName: string;
  company?: string;
  country: string;
  division: string;
  district: string;
  postcode: string;
  addressLine1: string;
  addressLine2?: string;
  phone: string;
  email?: string;
};

export type PlaceOrderBody = {
  email: string;
  phone: string;
  isGuest: boolean;
  accountCreatePassword?: string;
  subscribeNewsletter?: boolean;
  shippingAddress: AddressPayload;
  billingAddress?: AddressPayload;
  billingSameAsShipping?: boolean;
  shippingMethodId?: string;
  shippingProviderId?: string;
  shippingCost?: number;
  paymentGateway: PaymentMethod | string;
  paymentDetails?: Record<string, unknown>;
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
};

export type OrderResult = {
  orderId: string;
  orderRef: string;
  orderNumber?: string;
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
    getShippingRates: builder.query<
      ShippingRate[],
      {
        countryCode?: string;
        division?: string;
        district?: string;
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
        if (args.division) params.set("division", args.division);
        if (args.district) params.set("district", args.district);
        if (args.subtotal) params.set("subtotal", String(args.subtotal));
        if (args.shipping) params.set("shipping", String(args.shipping));
        const qs = params.toString();
        return {
          url: qs ? `/storefront/shipping/taxes?${qs}` : `/storefront/shipping/taxes`,
          method: "GET",
        };
      },
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
  }),
  overrideExisting: true,
});

export const {
  useGetShippingRatesQuery,
  useLazyGetShippingRatesQuery,
  useGetTaxesQuery,
  useLazyGetTaxesQuery,
  useApplyCouponMutation,
  usePlaceOrderMutation,
} = checkoutApi;

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
