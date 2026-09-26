import { z } from "zod";
import { PaginationSchema } from "@ecom/zod-schemas";
import { CouponType } from "@ecom/shared-types";

const XSS_RE = /<script|<iframe|onerror=|onload=|onclick=|onmouseover=/i;
const noXss = (v: string | null | undefined): boolean => {
  if (v === null || v === undefined || v.length === 0) return true;
  XSS_RE.lastIndex = 0;
  return !XSS_RE.test(v);
};
const noXssMessage = "No JavaScript injection allowed";

/** Admin/API CouponType → the DiscountType enum stored in the Coupon.type column. */
export function couponTypeToDiscountType(type: CouponType): string {
  switch (type) {
    case CouponType.PERCENT_CART:
      return "PERCENTAGE";
    case CouponType.PERCENT_PRODUCT:
      return "PERCENTAGE";
    case CouponType.BUY_X_GET_Y:
      return "BOGO";
    case CouponType.FIXED_CART:
      return "FIXED_CART";
    case CouponType.FIXED_PRODUCT:
      return "FIXED_PRODUCT";
    case CouponType.FREE_SHIPPING:
      return "FREE_SHIPPING";
    default:
      return "FIXED_CART";
  }
}

const bigintArray = z.array(z.coerce.bigint().positive()).optional();

export const CouponIdParamDto = z.object({ id: z.coerce.bigint().positive() });
export type CouponIdParamDto = z.infer<typeof CouponIdParamDto>;

const BaseCouponDto = z.object({
  code: z
    .string()
    .toUpperCase()
    .trim()
    .regex(/^[A-Z0-9_-]{3,20}$/, "Coupon code must be 3-20 chars: A-Z, 0-9, hyphen, underscore"),
  description: z.string().max(500).optional().refine(noXss, noXssMessage),
  type: z.nativeEnum(CouponType),
  amount: z.coerce.number().nonnegative(),
  freeShipping: z.boolean().default(false),
  minSubtotal: z.coerce.number().nonnegative().optional(),
  maxSubtotal: z.coerce.number().nonnegative().optional(),
  productIds: bigintArray,
  excludeProductIds: bigintArray,
  categoryIds: bigintArray,
  excludeSales: z.boolean().default(false),
  individualOnly: z.boolean().default(false),
  customerGroupIds: bigintArray,
  customerEmails: z.array(z.string().email()).optional(),
  newCustomersOnly: z.boolean().default(false),
  totalUsageLimit: z.coerce.number().int().nonnegative().optional(),
  perCustomerLimit: z.coerce.number().int().nonnegative().optional(),
  startsAt: z.coerce.date().optional(),
  expiresAt: z.coerce.date().optional(),
  isActive: z.boolean().default(true),
  autoApply: z.boolean().default(false),
});

export const CreateCouponDto = BaseCouponDto.superRefine((v, ctx) => {
  if (v.minSubtotal !== undefined && v.maxSubtotal !== undefined && v.minSubtotal > v.maxSubtotal) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "minSubtotal cannot exceed maxSubtotal",
      path: ["minSubtotal"],
    });
  }
  if (v.startsAt !== undefined && v.expiresAt !== undefined && v.startsAt > v.expiresAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "startsAt must be before expiresAt",
      path: ["startsAt"],
    });
  }
  if (v.totalUsageLimit !== undefined && v.totalUsageLimit < 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "totalUsageLimit must be >= 0",
      path: ["totalUsageLimit"],
    });
  }
  if (v.perCustomerLimit !== undefined && v.perCustomerLimit < 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "perCustomerLimit must be >= 0",
      path: ["perCustomerLimit"],
    });
  }
});
export type CreateCouponDto = z.infer<typeof CreateCouponDto>;

export const UpdateCouponDto = BaseCouponDto.partial();
export type UpdateCouponDto = z.infer<typeof UpdateCouponDto>;

const BaseCouponSearchQueryDto = PaginationSchema.extend({
  status: z.enum(["active", "inactive", "expired"]).optional(),
  type: z.nativeEnum(CouponType).optional(),
  minAmount: z.coerce.number().nonnegative().optional(),
  maxAmount: z.coerce.number().nonnegative().optional(),
});
export const CouponSearchQueryDto = BaseCouponSearchQueryDto.superRefine((v, ctx) => {
  if (v.minAmount !== undefined && v.maxAmount !== undefined && v.minAmount > v.maxAmount) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "minAmount cannot exceed maxAmount",
      path: ["minAmount"],
    });
  }
  if (v.search !== undefined && !noXss(v.search)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: noXssMessage,
      path: ["search"],
    });
  }
});
export type CouponSearchQueryDto = z.infer<typeof CouponSearchQueryDto>;

export const FlashSaleIdParamDto = z.object({ id: z.coerce.bigint().positive() });
export type FlashSaleIdParamDto = z.infer<typeof FlashSaleIdParamDto>;

const FlashSaleItemDto = z.object({
  productId: z.coerce.bigint().positive(),
  variantId: z.coerce.bigint().positive().optional(),
  salePrice: z.coerce.number().nonnegative().optional(),
  discountPct: z.coerce.number().nonnegative().lte(100).optional(),
  stockLimit: z.coerce.number().int().nonnegative().optional(),
});

const BaseFlashSaleDto = z.object({
  name: z.string().min(2).max(200).refine(noXss, noXssMessage),
  slug: z.string().min(2).max(200).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Only lowercase letters, numbers, hyphens"),
  description: z.string().max(1000).optional().refine(noXss, noXssMessage),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  discountPercent: z.coerce.number().nonnegative().lte(100).optional(),
  discountFixed: z.coerce.number().nonnegative().optional(),
  bannerImageUrl: z.string().max(500).optional(),
  bannerTitle: z.string().max(200).optional().refine(noXss, noXssMessage),
  bannerSubtitle: z.string().max(300).optional().refine(noXss, noXssMessage),
  bannerCtaText: z.string().max(100).optional().refine(noXss, noXssMessage),
  bannerCtaUrl: z.string().max(500).optional(),
  position: z.coerce.number().int().default(0),
  isActive: z.boolean().default(true),
  items: z.array(FlashSaleItemDto).min(1),
});

export const CreateFlashSaleDto = BaseFlashSaleDto.superRefine((v, ctx) => {
  if (v.startsAt >= v.endsAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "startsAt must be before endsAt",
      path: ["startsAt"],
    });
  }
});
export type CreateFlashSaleDto = z.infer<typeof CreateFlashSaleDto>;

export const UpdateFlashSaleDto = BaseFlashSaleDto.partial();
export type UpdateFlashSaleDto = z.infer<typeof UpdateFlashSaleDto>;

export const ReviewIdParamDto = z.object({ id: z.coerce.bigint().positive() });
export type ReviewIdParamDto = z.infer<typeof ReviewIdParamDto>;

const BaseListReviewsQueryDto = PaginationSchema.extend({
  productId: z.coerce.bigint().optional(),
  customerId: z.coerce.bigint().optional(),
  status: z.enum(["pending", "approved", "spam"]).optional(),
  rating: z.coerce.number().int().min(1).max(5).optional(),
});
export const ListReviewsQueryDto = BaseListReviewsQueryDto.superRefine((v, ctx) => {
  if (v.search !== undefined && !noXss(v.search)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: noXssMessage,
      path: ["search"],
    });
  }
});
export type ListReviewsQueryDto = z.infer<typeof ListReviewsQueryDto>;

const BaseCreateReviewDto = z.object({
  productId: z.coerce.bigint().positive(),
  orderId: z.coerce.bigint().positive().optional(),
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().max(200).optional().refine(noXss, noXssMessage),
  body: z.string().max(2000).optional().refine(noXss, noXssMessage),
});
export const CreateReviewDto = BaseCreateReviewDto.superRefine((_v, _ctx) => {});
export type CreateReviewDto = z.infer<typeof CreateReviewDto>;

export const ReviewModerateDto = z.object({
  ids: z.array(z.coerce.bigint()).min(1),
  action: z.enum(["approve", "bulk-delete", "spam-mark"]),
});
export type ReviewModerateDto = z.infer<typeof ReviewModerateDto>;
