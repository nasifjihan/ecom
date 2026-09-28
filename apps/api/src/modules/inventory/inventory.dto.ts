import { z } from "zod";
import { PaginationSchema } from "@ecom/zod-schemas";

const XSS_RE = /<script|<iframe|onerror=|onload=|onclick=|onmouseover=/i;
const noXss = (v: string | null | undefined): boolean => {
  if (v === null || v === undefined || v.length === 0) return true;
  XSS_RE.lastIndex = 0;
  return !XSS_RE.test(v);
};
const noXssMessage = "No JavaScript injection allowed";

export const VariantIdParamDto = z.object({ variantId: z.coerce.bigint().positive() });
export type VariantIdParamDto = z.infer<typeof VariantIdParamDto>;

export const StockAdjustLineDto = z.object({
  /** Variant to adjust; omit (and send productId) for a simple product without variants. */
  variantId: z.coerce.bigint().positive().optional(),
  productId: z.coerce.bigint().positive().optional(),
  delta: z.number().int(),
  reason: z.string().max(100).optional().refine(noXss, noXssMessage),
  /** Warehouse whose shelf changes; the default warehouse when left out. */
  warehouseId: z.coerce.bigint().positive().optional(),
  note: z.string().max(500).optional().refine(noXss, noXssMessage),
});
export type StockAdjustLineDto = z.infer<typeof StockAdjustLineDto>;

const BaseStockAdjustmentDto = z.object({
  lines: z.array(StockAdjustLineDto).min(1),
});
export const StockAdjustmentDto = BaseStockAdjustmentDto.superRefine((v, ctx) => {
  v.lines.forEach((line, idx) => {
    if (line.variantId === undefined && line.productId === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "variantId or productId is required", path: ["lines", idx] });
    }
    if (line.delta === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "delta must not be zero",
        path: ["lines", idx, "delta"],
      });
    }
  });
});
export type StockAdjustmentDto = z.infer<typeof StockAdjustmentDto>;

export const StockListQueryDto = PaginationSchema.extend({
  lowStock: z.enum(["true", "false"]).transform((v) => v === "true").optional(),
  outOfStock: z.enum(["true", "false"]).transform((v) => v === "true").optional(),
});
export type StockListQueryDto = z.infer<typeof StockListQueryDto>;

const BaseMovementQueryDto = PaginationSchema.extend({
  variantId: z.coerce.bigint().optional(),
  productId: z.coerce.bigint().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  warehouse: z.string().max(100).optional(),
  reason: z.string().max(100).optional(),
});
export const MovementQueryDto = BaseMovementQueryDto.superRefine((v, ctx) => {
  if (v.from !== undefined && v.to !== undefined && v.from > v.to) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "from must be before to",
      path: ["from"],
    });
  }
});
export type MovementQueryDto = z.infer<typeof MovementQueryDto>;

const BaseLowStockReportDto = z.object({
  threshold: z.coerce.number().int().nonnegative().default(10),
  productId: z.coerce.bigint().optional(),
  brandId: z.coerce.bigint().optional(),
  categoryId: z.coerce.bigint().optional(),
});
export const LowStockReportDto = BaseLowStockReportDto.superRefine((v, ctx) => {
  if (v.threshold < 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "threshold must be >= 0",
      path: ["threshold"],
    });
  }
});
export type LowStockReportDto = z.infer<typeof LowStockReportDto>;
