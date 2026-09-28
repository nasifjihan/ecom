import { z } from "zod"
import { REPORT_BASES } from "./reports.rules"

const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .optional()

export const RangeQuery = z.object({
  from: day,
  to: day,
  /** placed = every order not cancelled or failed; delivered = delivered or completed only. */
  basis: z.enum(REPORT_BASES).optional(),
})

export const ProductsQuery = RangeQuery.extend({
  sort: z.enum(["revenue", "units", "profit"]).optional(),
})
