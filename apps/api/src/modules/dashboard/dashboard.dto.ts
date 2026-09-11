import { z } from "zod";
import { PaginationSchema } from "@ecom/zod-schemas";
import { ExportFormat } from "@ecom/shared-types";

const BaseDashboardRangeQueryDto = PaginationSchema.extend({
  from: z.coerce.date(),
  to: z.coerce.date(),
});
export const DashboardRangeQueryDto = BaseDashboardRangeQueryDto.superRefine((v, ctx) => {
  if (v.from > v.to) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "from must be before to",
      path: ["from"],
    });
  }
});
export type DashboardRangeQueryDto = z.infer<typeof DashboardRangeQueryDto>;

const BaseStoreDashboardExportDto = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
  format: z.enum(["csv", "xlsx", "pdf"]).default("csv"),
});
export const StoreDashboardExportDto = BaseStoreDashboardExportDto.superRefine((v, ctx) => {
  if (v.from > v.to) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "from must be before to",
      path: ["from"],
    });
  }
});
export type StoreDashboardExportDto = z.infer<typeof StoreDashboardExportDto>;
