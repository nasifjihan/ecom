import { z } from "zod"
import { MONEY_ACCOUNT_TYPES, PAYMENT_METHODS, PAYMENT_TERMS } from "./purchasing.rules"

const noXss = (v: string) => !/<\s*script|<\s*iframe|on(error|load|click|mouseover)\s*=/i.test(v)
const text = (max: number) => z.string().trim().max(max).refine(noXss, "No HTML please")
const money = z.coerce.number().min(0).max(100_000_000)
const date = z.coerce.date()

export const IdParam = z.object({ id: z.coerce.bigint().positive() })

export const SupplierDto = z.object({
  name: text(120).pipe(z.string().min(2, "Enter the supplier's name")),
  contactPerson: text(120).nullish(),
  contactPhone: text(30).nullish(),
  contactEmail: z.string().trim().toLowerCase().email().max(200).nullish().or(z.literal("")),
  countryCode: text(60).nullish(),
  address: text(300).nullish(),
  /** What the shop already owed them (negative = they owe the shop / an advance). */
  openingBalance: z.coerce.number().min(-100_000_000).max(100_000_000).optional(),
  notes: text(1000).nullish(),
  isActive: z.boolean().optional(),
})
export const UpdateSupplierDto = SupplierDto.partial()
export const SupplierQuery = z.object({
  search: z.string().trim().max(80).optional(),
  active: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
})

export const GradeDto = z.object({ name: text(40).pipe(z.string().min(1)) })

export const AccountDto = z.object({
  name: text(80).pipe(z.string().min(2, "Name the account")),
  type: z.enum(MONEY_ACCOUNT_TYPES),
  details: text(200).nullish(),
  openingBalance: z.coerce.number().min(-100_000_000).max(100_000_000).optional(),
  isActive: z.boolean().optional(),
})
export const UpdateAccountDto = AccountDto.partial()
export const MoveMoneyDto = z.object({
  kind: z.enum(["deposit", "withdrawal", "adjustment", "transfer"]),
  accountId: z.coerce.bigint().positive(),
  toAccountId: z.coerce.bigint().positive().nullish(),
  /** Positive; an adjustment can be negative to correct a balance down. */
  amount: z.coerce.number().refine((v) => v !== 0 && Math.abs(v) <= 100_000_000, "Enter an amount"),
  occurredOn: date,
  note: text(300).nullish(),
})
export const PageQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
})

export const PaymentDto = z.object({
  supplierId: z.coerce.bigint().positive(),
  purchaseId: z.coerce.bigint().positive().nullish(),
  accountId: z.coerce.bigint().positive(),
  amount: money.refine((v) => v > 0, "Enter an amount above 0"),
  method: z.enum(PAYMENT_METHODS),
  paidOn: date,
  reference: text(100).nullish(),
  notes: text(500).nullish(),
})
export const PaymentsQuery = PageQuery.extend({
  supplierId: z.coerce.bigint().positive().optional(),
})

export const PurchaseDto = z.object({
  supplierId: z.coerce.bigint().positive(),
  sourcingType: z.enum(["local", "import"]).default("local"),
  originCountry: text(60).nullish(),
  sourceFrom: text(120).nullish(),
  reference: text(100).nullish(),
  purchasedOn: date,
  /** Warehouse the goods go into; the default one when left out. */
  warehouseId: z.coerce.bigint().positive().nullish(),
  shippingCost: money.optional(),
  customsDuty: money.optional(),
  otherCharges: money.optional(),
  discount: money.optional(),
  items: z
    .array(
      z.object({
        productId: z.coerce.bigint().positive(),
        variantId: z.coerce.bigint().positive().nullish(),
        qualityGrade: text(40).nullish(),
        qty: z.coerce.number().int().min(1).max(1_000_000),
        unitCost: money,
        discountPct: z.coerce.number().min(0).max(100).optional(),
        discountAmount: money.optional(),
      }),
    )
    .min(1, "Add at least one item")
    .max(200),
  paymentTerm: z.enum(PAYMENT_TERMS),
  payNow: money.optional(),
  accountId: z.coerce.bigint().positive().nullish(),
  paymentMethod: z.enum(PAYMENT_METHODS).optional(),
  notes: text(1000).nullish(),
  /** false: a purchase order (nothing arrives yet). */
  receiveNow: z.boolean().default(true),
  expectedOn: date.nullish(),
})
export type PurchaseDto = z.infer<typeof PurchaseDto>

/** A delivery against a purchase order: how many of each line arrived. */
export const ReceiveDto = z.object({
  items: z
    .array(z.object({ itemId: z.coerce.bigint().positive(), qty: z.coerce.number().int().min(0).max(1_000_000) }))
    .min(1)
    .max(200),
  receivedOn: date.optional(),
  note: text(300).nullish(),
})

export const SupplierReturnDto = z.object({
  supplierId: z.coerce.bigint().positive(),
  purchaseId: z.coerce.bigint().positive().nullish(),
  warehouseId: z.coerce.bigint().positive().nullish(),
  returnedOn: date,
  reason: text(200).pipe(z.string().min(2, "Say why the goods go back")),
  notes: text(1000).nullish(),
  items: z
    .array(
      z.object({
        productId: z.coerce.bigint().positive(),
        variantId: z.coerce.bigint().positive().nullish(),
        qty: z.coerce.number().int().min(1).max(1_000_000),
        /** Left out: the purchase line's landed cost, or the product's cost price. */
        unitCost: money.optional(),
      }),
    )
    .min(1, "Add at least one item")
    .max(200),
})
export const ReturnsQuery = PageQuery.extend({ supplierId: z.coerce.bigint().positive().optional() })
export const PurchasesQuery = PageQuery.extend({
  supplierId: z.coerce.bigint().positive().optional(),
  status: z.enum(["ordered", "partial", "received", "cancelled"]).optional(),
  search: z.string().trim().max(80).optional(),
  from: date.optional(),
  to: date.optional(),
})

export const PickQuery = z.object({ search: z.string().trim().max(80).default("") })
