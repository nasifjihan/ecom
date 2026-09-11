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
  variantId: z.coerce.bigint().positive(),
  productId: z.coerce.bigint().positive().optional(),
  delta: z.number().int(),
  reason: z.string().max(100).optional().refine(noXss, noXssMessage),
  warehouse: z.string().max(100).optional(),
  note: z.string().max(500).optional().refine(noXss, noXssMessage),
});
export type StockAdjustLineDto = z.infer<typeof StockAdjustLineDto>;

const BaseStockAdjustmentDto = z.object({
  lines: z.array(StockAdjustLineDto).min(1),
});
export const StockAdjustmentDto = BaseStockAdjustmentDto.superRefine((v, ctx) => {
  v.lines.forEach((line, idx) => {
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

const BaseStockTransferDto = z.object({
  originWarehouse: z.string().min(1).max(100),
  destWarehouse: z.string().min(1).max(100),
  lines: z.array(StockAdjustLineDto).min(1),
});
export const StockTransferDto = BaseStockTransferDto.superRefine((v, ctx) => {
  if (v.originWarehouse === v.destWarehouse) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "originWarehouse must differ from destWarehouse",
      path: ["destWarehouse"],
    });
  }
  v.lines.forEach((line, idx) => {
    if (line.delta === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "delta must not be zero",
        path: ["lines", idx, "delta"],
      });
    }
  });
});
export type StockTransferDto = z.infer<typeof StockTransferDto>;

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
