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
  /** One storefront only (staff limited to some storefronts get theirs anyway). */
  storefrontId: z.coerce.bigint().positive().optional(),
})

export const ProductsQuery = RangeQuery.extend({
  sort: z.enum(["revenue", "units", "profit"]).optional(),
})

/** A report PDF: the same filters, plus ?reports=sales,products for /all/pdf. */
export const PdfQuery = RangeQuery.extend({
  reports: z
    .string()
    .max(200)
    .transform((s) => s.split(",").map((x) => x.trim()).filter(Boolean))
    .optional(),
  /** 1: save as a file rather than open in the browser. */
  download: z.string().max(5).optional(),
})
