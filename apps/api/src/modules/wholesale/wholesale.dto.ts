import { z } from "zod"
import { BUSINESS_STATUSES, BUSINESS_TYPES } from "./wholesale.rules"

const noXss = (v: string) => !/<\s*script|<\s*iframe|on(error|load|click|mouseover)\s*=/i.test(v)
const text = (max: number) => z.string().trim().max(max).refine(noXss, "No HTML please")
const optText = (max: number) =>
  text(max)
    .optional()
    .nullable()
    .transform((v) => (v === undefined ? undefined : v === "" ? null : v))
const money = z.coerce.number().min(0).max(100_000_000)

export const IdParam = z.object({ id: z.coerce.bigint().positive() })
export const ProductIdParam = z.object({ productId: z.coerce.bigint().positive() })

export const SettingsDto = z
  .object({
    enabled: z.boolean(),
    autoApprove: z.boolean(),
    intro: optText(2000),
  })
  .partial()

/** A business's details: what the customer applies with, and what staff can correct. */
export const BusinessDetailsDto = z.object({
  companyName: text(120).pipe(z.string().min(2, "Enter the business name")),
  businessType: z.enum(BUSINESS_TYPES).default("retailer"),
  contactPhone: optText(20),
  address: optText(300),
  tradeLicenseNo: optText(60),
  vatRegNo: optText(40),
  note: optText(1000),
})
export type BusinessDetailsDto = z.infer<typeof BusinessDetailsDto>

export const ApplyDto = BusinessDetailsDto

/** Staff make an existing customer a business account (approved straight away). */
export const CreateAccountDto = BusinessDetailsDto.extend({ customerId: z.coerce.bigint().positive() })

export const UpdateAccountDto = BusinessDetailsDto.partial()

export const ReviewDto = z.object({
  action: z.enum(["approve", "reject", "suspend"]),
  /** Shown to the customer when rejected or suspended. */
  note: optText(500),
})

export const AccountsQuery = z.object({
  status: z.enum(BUSINESS_STATUSES).optional(),
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
})

export const TiersDto = z.object({
  tiers: z
    .array(
      z.object({
        variantId: z.coerce.bigint().positive().nullable().optional(),
        minQty: z.coerce.number().int().min(2, "The minimum quantity must be 2 or more").max(1_000_000),
        price: money.refine((v) => v > 0, "Enter a price above zero"),
        forEveryone: z.boolean().default(false),
      }),
    )
    .max(200),
})

export const MarginsQuery = z.object({
  search: z.string().trim().max(100).optional(),
  categoryId: z.coerce.bigint().positive().optional(),
  /** withCost: only rows that have a cost; noCost: only rows missing one. */
  cost: z.enum(["all", "withCost", "noCost"]).default("all"),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(200).default(50),
})

export const ApplyPricesDto = z.object({
  rows: z
    .array(
      z.object({
        productId: z.coerce.bigint().positive(),
        variantId: z.coerce.bigint().positive().nullable().optional(),
        regularPrice: money.refine((v) => v > 0, "Prices must be above zero"),
      }),
    )
    .min(1, "Pick at least one row")
    .max(500),
})

// ------------------------------------------------------------------ quotations

const QuoteLine = z.object({
  productId: z.coerce.bigint().positive(),
  variantId: z.coerce.bigint().positive().nullable().optional(),
  qty: z.coerce.number().int().min(1).max(100_000),
})

export const QuotePreviewDto = z.object({
  customerId: z.coerce.bigint().positive(),
  storefrontId: z.coerce.bigint().positive().nullable().optional(),
  items: z.array(QuoteLine).min(1).max(200),
})

export const SaveQuoteDto = z.object({
  customerId: z.coerce.bigint().positive(),
  storefrontId: z.coerce.bigint().positive().nullable().optional(),
  validUntil: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date")
    .nullable()
    .optional(),
  terms: optText(2000),
  staffNote: optText(2000),
  discount: money.default(0),
  deliveryFee: money.default(0),
  items: z
    .array(QuoteLine.extend({ unitPrice: money }))
    .min(1, "Add at least one product")
    .max(200),
})

export const QuotesQuery = z.object({
  status: z.enum(["REQUESTED", "DRAFT", "SENT", "EXPIRED", "ACCEPTED", "DECLINED", "ORDERED", "CANCELLED"]).optional(),
  search: z.string().trim().max(100).optional(),
  customerId: z.coerce.bigint().positive().optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
})

export const RequestQuoteDto = z.object({
  items: z.array(QuoteLine).min(1, "Your cart is empty").max(200),
  note: optText(1000),
})

export const RespondQuoteDto = z.object({
  action: z.enum(["accept", "decline"]),
  note: optText(1000),
})

export const QuoteNumberParam = z.object({ number: z.string().trim().regex(/^Q-\d{1,10}$/) })
