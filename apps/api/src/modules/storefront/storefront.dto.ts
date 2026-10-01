import { z } from "zod";

const XSS_RE = /<\s*script|<\s*iframe|on(error|load|click|mouseover)\s*=/i;
const noXss = (v: string | null | undefined): boolean => !v || !XSS_RE.test(v);
const safeText = (max: number) => z.string().trim().max(max).refine(noXss, "No JavaScript injection allowed");

const PRODUCT_SORTS = ["popular", "newest", "price_asc", "price_desc", "rating"] as const;

export const StorefrontProductsQueryDto = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(60).default(16),
  sort: z.enum(PRODUCT_SORTS).default("popular"),
  categoryId: z.string().regex(/^\d+(,\d+)*$/, "categoryId must be one or more comma-separated ids").optional(),
  categorySlug: z.string().max(120).optional(),
  brandId: z.string().regex(/^\d+(,\d+)*$/, "brandId must be one or more comma-separated ids").optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  rating: z.coerce.number().min(0).max(5).optional(),
  search: z.string().trim().max(120).optional(),
  /** Products with this tag (lower-case). */
  tag: z.string().trim().toLowerCase().max(40).optional(),
  /** These products only (e.g. a guest's wishlist), comma-separated. */
  ids: z.string().regex(/^\d+(,\d+){0,99}$/, "ids must be comma-separated product ids").optional(),
  featured: z.enum(["true", "false"]).transform((v) => v === "true").optional(),
  excludeId: z.coerce.bigint().positive().optional(),
});
export type StorefrontProductsQueryDto = z.infer<typeof StorefrontProductsQueryDto>;

export const StorefrontSlugParamDto = z.object({
  slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/i, "Invalid slug"),
});

export const StorefrontOrderKeyParamDto = z.object({
  orderKey: z.string().min(8).max(64).regex(/^[A-Za-z0-9_-]+$/, "Invalid order key"),
});

const CartLineDto = z.object({
  productId: z.coerce.bigint().positive(),
  variantId: z.coerce.bigint().positive().optional().nullable(),
  qty: z.coerce.number().int().min(1).max(100),
  /** Part of a gift box the shopper filled (modules/giftboxes): the box itself or an item in it. */
  box: z
    .object({
      key: z.string().trim().min(1).max(40),
      giftBoxId: z.coerce.bigint().positive(),
      role: z.enum(["box", "item"]),
      message: z.string().max(1000).nullable().optional(),
    })
    .nullable()
    .optional(),
});
export type CartLineDto = z.infer<typeof CartLineDto>;

/** Mirrors `AddressPayload` in storefront-base checkout-api-slice. */
const StorefrontAddressDto = z.object({
  firstName: safeText(80).pipe(z.string().min(1)),
  lastName: safeText(80).pipe(z.string().min(1)),
  company: safeText(120).optional(),
  country: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, "country must be a 2-letter code"),
  division: safeText(64).optional().default(""),
  district: safeText(64).pipe(z.string().min(1)),
  upazila: safeText(64).optional().default(""),
  /** Deepest area picked (upazila/thana or district); its names replace the typed ones. */
  locationId: z.coerce.bigint().positive().optional().nullable(),
  postcode: safeText(12).optional().default(""),
  addressLine1: safeText(200).pipe(z.string().min(3)),
  addressLine2: safeText(200).optional(),
  phone: z.string().trim().regex(/^\+?[0-9\s-]{7,20}$/, "Enter a valid phone number"),
  email: z.string().trim().toLowerCase().email().max(254).optional(),
});
export type StorefrontAddressDto = z.infer<typeof StorefrontAddressDto>;

/** The cart page asks for current prices (flash sales start and end while a cart sits in the browser). */
export const CartPricesDto = z.object({
  items: z.array(CartLineDto.passthrough()).min(1).max(100),
  /** The coupon the customer applied: one that doesn't work with promotions switches them off. */
  couponCode: z.string().trim().toUpperCase().max(40).optional(),
  email: z.string().trim().toLowerCase().email().optional(),
});
export type CartPricesDto = z.infer<typeof CartPricesDto>;

export const ApplyCouponDto = z.object({
  code: z.string().trim().toUpperCase().min(3).max(40).regex(/^[A-Z0-9_-]+$/, "Invalid coupon code"),
  items: z.array(CartLineDto.extend({ price: z.coerce.number().optional() })).min(1).max(100),
  email: z.string().trim().toLowerCase().email().optional(),
  shippingTotal: z.coerce.number().min(0).optional(),
  countryCode: z.string().optional(),
});
export type ApplyCouponDto = z.infer<typeof ApplyCouponDto>;

/**
 * Mirrors `PlaceOrderBody` in storefront-base checkout-api-slice.
 * Client-sent money fields (prices, totals, shippingCost) are accepted but IGNORED:
 * the server re-prices every line from the database.
 */
export const PlaceOrderDto = z.object({
  /** Optional: many customers here shop with a phone number only (order emails are then skipped). */
  email: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().trim().toLowerCase().email().max(254).optional()),
  phone: z.string().trim().min(7).max(20),
  isGuest: z.boolean().optional(),
  subscribeNewsletter: z.boolean().optional(),
  shippingAddress: StorefrontAddressDto,
  billingAddress: StorefrontAddressDto.optional(),
  billingSameAsShipping: z.boolean().optional().default(true),
  shippingMethodId: z.coerce.bigint().positive(),
  /** For delivery options that use time slots: the slot and day picked. */
  deliverySlot: z.object({ slotId: z.string().regex(/^\d{1,18}$/), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).optional(),
  /** The courier picked, when the storefront lets customers choose. */
  courierAccountId: z.string().regex(/^\d{1,18}$/).optional(),
  paymentGateway: z.string().trim().toLowerCase().min(2).max(32),
  /** bKash / Nagad / Rocket / bank sent by hand: what the customer paid from and the transaction ID. */
  payment: z
    .object({ transactionId: safeText(60), senderNumber: safeText(40).optional() })
    .optional(),
  couponCodes: z.array(z.string().trim().toUpperCase().max(40)).max(1).optional().default([]),
  items: z.array(CartLineDto.passthrough()).min(1).max(100),
  customerNote: safeText(2000).optional(),
  /** Signed-in customers: pay what the store allows from the wallet balance. */
  useWallet: z.boolean().optional(),
  /** A salesperson's share-link code (?sp=CODE): the order is credited to them. */
  salesCode: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{3,20}$/).optional().or(z.literal("")),
  termsAgreed: z.literal(true, { errorMap: () => ({ message: "You must accept the terms" }) }),
});
export type PlaceOrderDto = z.infer<typeof PlaceOrderDto>;

export const MyOrdersQueryDto = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(50).default(10),
});

export const OrderRefParamDto = z.object({
  orderRef: z.string().min(1).max(40).regex(/^[A-Za-z0-9-]+$/, "Invalid order number"),
});
