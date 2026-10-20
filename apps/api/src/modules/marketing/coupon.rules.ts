/**
 * COUPON RULES — whether a coupon applies to a cart and what it takes off. No database: the
 * caller loads the coupon, the priced lines and (when the coupon limits it) the customer's order
 * counts. Checks run in this order, and the first one that fails gives the customer's message.
 */
import type { Coupon } from "@prisma/client"
import { onStorefront } from "../storefronts/storefronts.rules"

export type CouponRule = Pick<
  Coupon,
  | "code"
  | "type"
  | "amount"
  | "isActive"
  | "storefrontIds"
  | "startsAt"
  | "expiresAt"
  | "totalUsageLimit"
  | "usageCount"
  | "minSubtotal"
  | "maxSubtotal"
  | "customerEmails"
  | "perCustomerLimit"
  | "newCustomersOnly"
  | "productIds"
  | "excludeProductIds"
  | "categoryIds"
  | "excludeSales"
  | "worksWithPromotions"
  | "freeShipping"
>

export interface CouponLine {
  productId: string
  categoryIds: string[]
  unitPrice: number
  qty: number
  /** unitPrice × qty, before promotions. */
  lineSubtotal: number
  onSale: boolean
  /** In a flash sale. */
  flash: boolean
}

export interface CouponCheck {
  now: Date
  /** The storefront the cart is on. */
  storefrontId: bigint
  /** The customer's email (lower case), when known. */
  email?: string
  /** What automatic promotions already take off each line (same order as the lines). */
  promoOff?: number[]
  /** With an email and a per-customer or first-order rule: their orders (not cancelled). */
  usage?: { withCoupon: number; orders: number }
}

export type CouponResult =
  | { ok: true; discount: number; freeShipping: boolean; subtotal: number }
  | { ok: false; error: string }

type Num = { toString(): string } | number | null | undefined
const num = (v: Num): number => (v === null || v === undefined ? 0 : Number(v))
const round2 = (n: number): number => Math.round(n * 100) / 100
const ids = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : [])

/** Whether the per-customer counts are needed (so the caller only looks them up then). */
export const needsUsage = (
  c: Pick<CouponRule, "perCustomerLimit" | "newCustomersOnly">,
  email?: string,
) => !!email && (c.perCustomerLimit !== null || c.newCustomersOnly)

export function checkCoupon(c: CouponRule, lines: CouponLine[], o: CouponCheck): CouponResult {
  const subtotal = round2(lines.reduce((s, l) => s + l.lineSubtotal, 0))
  if (!c.isActive || !onStorefront(c.storefrontIds, o.storefrontId))
    return { ok: false, error: "This coupon code is not valid" }
  if (c.startsAt && c.startsAt > o.now) return { ok: false, error: "This coupon is not active yet" }
  if (c.expiresAt && c.expiresAt < o.now) return { ok: false, error: "This coupon has expired" }
  if (c.totalUsageLimit !== null && c.usageCount >= c.totalUsageLimit)
    return { ok: false, error: "This coupon has reached its usage limit" }
  if (c.minSubtotal !== null && subtotal < num(c.minSubtotal))
    return {
      ok: false,
      error: `Add ৳${round2(num(c.minSubtotal) - subtotal)} more to use this coupon (minimum ৳${num(c.minSubtotal)})`,
    }
  if (c.maxSubtotal !== null && subtotal > num(c.maxSubtotal))
    return { ok: false, error: `This coupon only applies to orders up to ৳${num(c.maxSubtotal)}` }

  const allowed = ids(c.customerEmails).map((e) => e.toLowerCase())
  if (allowed.length) {
    if (!o.email) return { ok: false, error: "Enter your email to use this coupon" }
    if (!allowed.includes(o.email))
      return { ok: false, error: "This coupon is not available for your account" }
  }
  if (needsUsage(c, o.email) && o.usage) {
    if (c.perCustomerLimit !== null && o.usage.withCoupon >= c.perCustomerLimit)
      return { ok: false, error: "You have already used this coupon" }
    if (c.newCustomersOnly && o.usage.orders > 0)
      return { ok: false, error: "This coupon is for first orders only" }
  }

  const include = ids(c.productIds)
  const exclude = ids(c.excludeProductIds)
  const cats = ids(c.categoryIds)
  // A coupon that doesn't work with promotions doesn't count flash-sale items either, and is
  // worked out on full prices (the promotions are dropped when it's used).
  const off = c.worksWithPromotions ? (o.promoOff ?? []) : []
  const eligible = lines
    .map((l, i) => ({ ...l, lineSubtotal: round2(l.lineSubtotal - (off[i] ?? 0)) }))
    .filter((l) => {
      if (exclude.includes(l.productId)) return false
      if (c.excludeSales && l.onSale) return false
      if (!c.worksWithPromotions && l.flash) return false
      if (include.length && !include.includes(l.productId)) return false
      if (cats.length && !l.categoryIds.some((id) => cats.includes(id))) return false
      return true
    })
  const eligibleSubtotal = eligible.reduce((s, l) => s + l.lineSubtotal, 0)
  const amount = num(c.amount)

  let discount = 0
  let freeShipping = c.freeShipping
  switch (c.type) {
    case "PERCENTAGE":
      discount = (eligibleSubtotal * amount) / 100
      break
    case "FIXED_CART":
      discount = eligible.length ? amount : 0
      break
    case "FIXED_PRODUCT":
      discount = eligible.reduce(
        (s, l) => s + Math.min(l.lineSubtotal, Math.min(l.unitPrice, amount) * l.qty),
        0,
      )
      break
    case "FREE_SHIPPING":
      freeShipping = true
      break
    default:
      return { ok: false, error: "This coupon type cannot be used at checkout yet" }
  }
  if (c.type !== "FREE_SHIPPING" && eligible.length === 0)
    return { ok: false, error: "This coupon does not apply to the items in your cart" }
  return {
    ok: true,
    discount: round2(Math.min(discount, eligibleSubtotal)),
    freeShipping,
    subtotal,
  }
}
