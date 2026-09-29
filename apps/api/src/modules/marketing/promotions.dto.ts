import { z } from "zod"
import { PROMOTION_SLOTS, PROMOTION_TYPES } from "./promotions.rules"

const ids = z.array(z.coerce.bigint().positive()).max(500).default([])
const money = z.coerce.number().nonnegative().max(10_000_000)
const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .refine((v) => !/<script|<iframe|on\w+=/i.test(v), "No HTML scripts allowed")
const url = z
  .string()
  .trim()
  .max(500)
  .refine(
    (v) => v.startsWith("/") || /^https?:\/\//i.test(v),
    "Use a link starting with / or https://",
  )

const Base = z.object({
  name: text(120).pipe(z.string().min(2, "Give the promotion a name")),
  type: z.enum(PROMOTION_TYPES),
  discountType: z.enum(["percentage", "fixed"]).nullish(),
  discountValue: money.nullish(),
  maxDiscount: money.nullish(),
  minOrder: money.nullish(),
  minQty: z.coerce.number().int().min(1).max(1000).nullish(),
  productIds: ids,
  categoryIds: ids,
  includeSaleItems: z.boolean().default(false),
  buyQty: z.coerce.number().int().min(1).max(100).nullish(),
  getQty: z.coerce.number().int().min(1).max(100).nullish(),
  giftProductId: z.coerce.bigint().positive().nullish(),
  giftVariantId: z.coerce.bigint().positive().nullish(),
  giftQty: z.coerce.number().int().min(1).max(20).default(1),
  slots: z.array(z.enum(PROMOTION_SLOTS)).max(PROMOTION_SLOTS.length).default([]),
  /** Only on these storefronts (empty: all). */
  storefrontIds: z.array(z.coerce.bigint().positive()).max(50).default([]),
  headline: text(120).nullish(),
  message: text(300).nullish(),
  imageUrl: url.nullish(),
  linkUrl: url.nullish(),
  startsAt: z.coerce.date().nullish(),
  endsAt: z.coerce.date().nullish(),
  isActive: z.boolean().default(true),
})

type Shape = Partial<z.infer<typeof Base>>

/** What each type needs; shared by create and by update (checked on the merged record). */
export function promotionProblems(v: Shape): { path: string; message: string }[] {
  const out: { path: string; message: string }[] = []
  if (v.type === "discount") {
    if (!v.discountType)
      out.push({ path: "discountType", message: "Choose percentage or fixed amount" })
    if (!v.discountValue || v.discountValue <= 0)
      out.push({ path: "discountValue", message: "Enter the discount" })
    else if (v.discountType === "percentage" && v.discountValue > 100)
      out.push({ path: "discountValue", message: "A percentage can't be over 100" })
  }
  if (v.type === "bxgy" && (!v.buyQty || !v.getQty))
    out.push({ path: "buyQty", message: "Enter how many to buy and how many are free" })
  if (v.type === "free_gift" && !v.giftProductId)
    out.push({ path: "giftProductId", message: "Choose the gift product" })
  if (v.startsAt && v.endsAt && v.endsAt <= v.startsAt)
    out.push({ path: "endsAt", message: "The end must be after the start" })
  return out
}

export const CreatePromotionDto = Base.superRefine((v, ctx) => {
  for (const p of promotionProblems(v))
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: [p.path], message: p.message })
})
export type CreatePromotionDto = z.infer<typeof CreatePromotionDto>

// No defaults on update: a field left out stays as it is.
export const UpdatePromotionDto = z.object(
  Object.fromEntries(
    Object.entries(Base.shape).map(([k, s]) => [
      k,
      (s instanceof z.ZodDefault ? s.removeDefault() : s).optional(),
    ]),
  ) as {
    [K in keyof typeof Base.shape]: z.ZodOptional<z.ZodTypeAny>
  },
)
export type UpdatePromotionDto = Shape

export const PromotionIdParam = z.object({ id: z.coerce.bigint().positive() })
export const PromotionListQuery = z.object({
  state: z.enum(["live", "scheduled", "ended", "paused"]).optional(),
  type: z.enum(PROMOTION_TYPES).optional(),
  search: z.string().trim().max(100).optional(),
})
export type PromotionListQuery = z.infer<typeof PromotionListQuery>

export const SlotQuery = z.object({
  slot: z.enum(PROMOTION_SLOTS).optional(),
  productId: z.coerce.bigint().positive().optional(),
  categoryId: z.coerce.bigint().positive().optional(),
  /** The storefront's product list filters by category slug. */
  categorySlug: z.string().trim().max(200).optional(),
})
export type SlotQuery = z.infer<typeof SlotQuery>

export const PickProductsQuery = z.object({
  search: z.string().trim().max(100).optional(),
  /** "1,2,3": the chosen products' names, for an edited promotion. */
  ids: z
    .string()
    .regex(/^\d+(,\d+)*$/)
    .transform((v) =>
      v
        .split(",")
        .slice(0, 500)
        .map((x) => BigInt(x)),
    )
    .optional(),
})
export type PickProductsQuery = z.infer<typeof PickProductsQuery>
