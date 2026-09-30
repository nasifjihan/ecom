import { z } from "zod";
import { PaginationSchema } from "@ecom/zod-schemas";

const XSS_RE = /<\s*script|<\s*iframe|on(error|load|click|mouseover)\s*=/i;
const noXss = (v: string | null | undefined): boolean => {
  if (v === null || v === undefined || v.length === 0) return true;
  XSS_RE.lastIndex = 0;
  return !XSS_RE.test(v);
};

const ORDER_STATUSES = [
  "PENDING",
  "PROCESSING",
  "ON_HOLD",
  "SHIPPED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "COMPLETED",
  "CANCELLED",
  "REFUNDED",
  "FAILED",
] as const;

const PAYMENT_GATEWAYS = [
  "cod",
  "stripe",
  "bkash",
  "nagad",
  "rocket",
  "sslcommerz",
  "bank_transfer",
] as const;

const REFUND_METHODS = ["original", "store_credit", "cash"] as const;
const EXPORT_FORMATS = ["csv", "xlsx", "pdf"] as const;

/** Query-string arrays: accepts ?status=A,B, ?status=A&status=B or a real array. */
const csvArray = <T extends z.ZodTypeAny>(item: T) =>
  z.preprocess((v) => (typeof v === "string" ? v.split(",").filter(Boolean) : v), z.array(item));

const BaseOrderSearchQueryDto = PaginationSchema.extend({
  status: csvArray(z.enum(ORDER_STATUSES)).optional(),
  paymentStatus: csvArray(z.string()).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  minTotal: z.coerce.number().nonnegative().optional(),
  maxTotal: z.coerce.number().nonnegative().optional(),
  search: z.string().optional(),
  customerId: z.coerce.bigint().optional(),
  channel: z.string().optional(),
  /** Where orders came from: website, phone, facebook, ... (comma separated). */
  source: csvArray(z.string().max(20)).optional(),
  /** Orders placed on one storefront. */
  storefrontId: z.coerce.bigint().positive().optional(),
});

export const OrderSearchQueryDto = BaseOrderSearchQueryDto.superRefine((v, ctx) => {
  if (v.minTotal !== undefined && v.maxTotal !== undefined && v.minTotal > v.maxTotal) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "minTotal cannot exceed maxTotal",
      path: ["minTotal"],
    });
  }
  if (v.dateFrom !== undefined && v.dateTo !== undefined && v.dateFrom > v.dateTo) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "dateFrom must be before dateTo",
      path: ["dateFrom"],
    });
  }
});
export type OrderSearchQueryDto = z.infer<typeof OrderSearchQueryDto>;

export const OrderIdParamDto = z.object({
  id: z.coerce.bigint().positive(),
});
export type OrderIdParamDto = z.infer<typeof OrderIdParamDto>;

export const OrderNumberParamDto = z.object({
  number: z.string().min(4).max(40),
});
export type OrderNumberParamDto = z.infer<typeof OrderNumberParamDto>;

export const AddressDto = z.object({
  firstName: z.string().min(2).refine(noXss, "No JavaScript injection allowed"),
  lastName: z.string().min(2).refine(noXss, "No JavaScript injection allowed"),
  company: z.string().optional(),
  address1: z.string().min(2),
  address2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().optional(),
  postcode: z.string().optional(),
  countryCode: z
    .string()
    .min(2)
    .refine((v) => /^[A-Z]{2,3}$/.test(v), "countryCode must be 2 or 3 uppercase letters"),
  email: z.string().trim().email().max(254).toLowerCase(),
  phone: z.string().max(30).optional(),
  type: z.enum(["shipping", "billing"]).optional(),
});
export type AddressDto = z.infer<typeof AddressDto>;

const BaseCreateOrderFromCartDto = z.object({
  cartId: z.coerce.bigint().positive(),
  shippingAddress: AddressDto,
  billingAddress: AddressDto.optional(),
  couponCode: z.string().trim().toUpperCase().optional(),
  shippingMethodCode: z.string().min(1),
  paymentGatewayCode: z.string().min(1),
  agreeToTerms: z.literal(true),
  customerNote: z
    .string()
    .max(5000)
    .refine(noXss, "No JavaScript injection allowed")
    .optional()
    .nullable(),
});

export const CreateOrderFromCartDto = BaseCreateOrderFromCartDto.superRefine((v, ctx) => {
  if (!PAYMENT_GATEWAYS.includes(v.paymentGatewayCode as any)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `paymentGatewayCode must be one of: ${PAYMENT_GATEWAYS.join(", ")}`,
      path: ["paymentGatewayCode"],
    });
  }
  if (v.couponCode !== undefined && v.couponCode !== null && v.couponCode.length > 0) {
    if (v.couponCode.length < 3 || v.couponCode.length > 20) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "couponCode must be 3-20 characters",
        path: ["couponCode"],
      });
    } else if (!/^[A-Za-z0-9-]+$/.test(v.couponCode)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "couponCode may only contain alphanumeric characters and hyphens",
        path: ["couponCode"],
      });
    }
  }
});
export type CreateOrderFromCartDto = z.infer<typeof CreateOrderFromCartDto>;

export const UpdateOrderFromCartDto = BaseCreateOrderFromCartDto.partial();
export type UpdateOrderFromCartDto = z.infer<typeof UpdateOrderFromCartDto>;

export const TransitionStatusDto = z
  .object({
    newStatus: z.enum(ORDER_STATUSES),
    note: z
      .string()
      .max(2000)
      .refine(noXss, "No JavaScript injection allowed")
      .optional()
      .nullable(),
    /** Emails the customer about the change (when that email is switched on in Settings > Emails). */
    notifyCustomer: z.boolean().default(true),
    sendEmail: z.boolean().default(false),
    reasonCode: z.string().optional().nullable(),
  })
  .superRefine((_v, _ctx) => {});
export type TransitionStatusDto = z.infer<typeof TransitionStatusDto>;

export const RefundItemLineDto = z.object({
  orderItemId: z.coerce.bigint().positive(),
  quantity: z.coerce.number().int().min(1),
  amount: z.coerce.number().nonnegative(),
});
export type RefundItemLineDto = z.infer<typeof RefundItemLineDto>;

const BaseCreateRefundDto = z.object({
  orderId: z.coerce.bigint().positive(),
  items: z.array(RefundItemLineDto).min(1),
  reason: z.string().max(1000).refine(noXss, "No JavaScript injection allowed"),
  refundMethod: z.enum(REFUND_METHODS).default("original"),
  restockItems: z.boolean().default(true),
  gatewayRefund: z.boolean().default(true),
  noteToCustomer: z
    .string()
    .max(5000)
    .refine(noXss, "No JavaScript injection allowed")
    .optional()
    .nullable(),
});

export const CreateRefundDto = BaseCreateRefundDto.superRefine((v, ctx) => {
  const total = v.items.reduce((sum, it) => sum + (it.amount * it.quantity || 0), 0);
  if (total > 1000000) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Total refund amount exceeds ceiling of 1,000,000",
      path: ["items"],
    });
  }
  v.items.forEach((it, i) => {
    if (it.quantity <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "quantity must be positive",
        path: ["items", i, "quantity"],
      });
    }
  });
});
export type CreateRefundDto = z.infer<typeof CreateRefundDto>;

export const CartItemLineDto = z.object({
  productId: z.coerce.bigint().positive(),
  variantId: z.coerce.bigint().positive().optional().nullable(),
  quantity: z.coerce.number().int().min(1).max(999),
  unitPrice: z.coerce.number().nonnegative().optional().nullable(),
  meta: z.record(z.unknown()).optional(),
});
export type CartItemLineDto = z.infer<typeof CartItemLineDto>;

const BaseCreateCartDto = z.object({
  customerId: z.coerce.bigint().positive().optional().nullable(),
  items: z.array(CartItemLineDto).default([]),
  appliedCouponCode: z.string().trim().toUpperCase().optional().nullable(),
  currencyCode: z.string().length(3).default("BDT"),
});

export const CreateCartDto = BaseCreateCartDto.superRefine((v, ctx) => {
  const seen = new Set<string>();
  v.items.forEach((it, i) => {
    const key = `${String(it.productId)}:${it.variantId ? String(it.variantId) : "null"}`;
    if (seen.has(key)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Duplicate product + variant pair in cart items",
        path: ["items", i],
      });
    }
    seen.add(key);
  });
});
export type CreateCartDto = z.infer<typeof CreateCartDto>;

export const UpdateCartDto = BaseCreateCartDto.partial();
export type UpdateCartDto = z.infer<typeof UpdateCartDto>;

export const AddCartItemDto = CartItemLineDto;
export type AddCartItemDto = z.infer<typeof AddCartItemDto>;

export const UpdateCartItemDto = z.object({
  quantity: z.coerce.number().int().min(1).max(999),
  unitPrice: z.coerce.number().nonnegative().optional().nullable(),
});
export type UpdateCartItemDto = z.infer<typeof UpdateCartItemDto>;

const BaseExportOrdersDto = PaginationSchema.extend({
  status: csvArray(z.enum(ORDER_STATUSES)).optional(),
  paymentStatus: csvArray(z.string()).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  minTotal: z.coerce.number().nonnegative().optional(),
  maxTotal: z.coerce.number().nonnegative().optional(),
  search: z.string().optional(),
  customerId: z.coerce.bigint().optional(),
  channel: z.string().optional(),
  format: z.enum(EXPORT_FORMATS).default("csv"),
});

export const ExportOrdersDto = BaseExportOrdersDto.superRefine((v, ctx) => {
  if (v.minTotal !== undefined && v.maxTotal !== undefined && v.minTotal > v.maxTotal) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "minTotal cannot exceed maxTotal",
      path: ["minTotal"],
    });
  }
  if (v.dateFrom !== undefined && v.dateTo !== undefined && v.dateFrom > v.dateTo) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "dateFrom must be before dateTo",
      path: ["dateFrom"],
    });
  }
});
export type ExportOrdersDto = z.infer<typeof ExportOrdersDto>;

/** ?ids=1,2,3 for printing several invoices at once. */
export const InvoiceIdsQueryDto = z.object({
  ids: z
    .string()
    .trim()
    .regex(/^\d+(,\d+)*$/, "ids must be order ids separated by commas")
    .transform((v) => [...new Set(v.split(","))].map((id) => BigInt(id)))
    .pipe(z.array(z.bigint()).min(1).max(100, "Print up to 100 invoices at a time")),
  download: z.string().optional(),
});
