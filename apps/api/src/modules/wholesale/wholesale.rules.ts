/**
 * WHOLESALE RULES — pure rules for bulk prices and pricing by margin.
 *
 * Bulk prices (PriceTier): "buy at least N, each costs X". An option uses its own tiers when it
 * has any, otherwise the product's (variantId null). Tiers marked `forEveryone` apply to any
 * shopper; the rest only to approved business accounts. The tier with the highest minimum the
 * line's quantity reaches wins, and only when it is cheaper than the price the line already has
 * (so a flash sale or sale price that beats it still applies).
 *
 * Margin is profit as a share of the selling price: (price - cost) / price. A price for a target
 * margin is cost / (1 - margin), rounded UP so rounding never eats into the margin.
 */
import type { Prisma } from "@prisma/client"

type Num = Prisma.Decimal | number | string | null | undefined

export interface Tier {
  variantId: bigint | null
  minQty: number
  price: Num
  forEveryone: boolean
}

export interface TierHit {
  minQty: number
  price: number
  forEveryone: boolean
}

export const BUSINESS_STATUSES = ["PENDING", "APPROVED", "REJECTED", "SUSPENDED"] as const
export type BusinessStatus = (typeof BUSINESS_STATUSES)[number]

export const BUSINESS_TYPES = ["retailer", "reseller", "corporate", "institution", "other"] as const

/** Staff actions on an application / account, and the statuses each may start from. */
export const REVIEW_ACTIONS = {
  approve: { to: "APPROVED", from: ["PENDING", "REJECTED", "SUSPENDED"] },
  reject: { to: "REJECTED", from: ["PENDING"] },
  suspend: { to: "SUSPENDED", from: ["APPROVED"] },
} as const satisfies Record<string, { to: BusinessStatus; from: readonly BusinessStatus[] }>
export type ReviewAction = keyof typeof REVIEW_ACTIONS

/** The status a review action leads to, or null when it can't be done from `from`. */
export function reviewTo(action: ReviewAction, from: string): BusinessStatus | null {
  const rule = REVIEW_ACTIONS[action]
  return (rule.from as readonly string[]).includes(from) ? rule.to : null
}

/** The tiers that apply to one option (or a product without options), for this shopper. */
export function tiersFor(tiers: readonly Tier[], variantId: bigint | null, isBusiness: boolean): TierHit[] {
  const own = variantId === null ? [] : tiers.filter((t) => t.variantId === variantId)
  const pool = own.length ? own : tiers.filter((t) => t.variantId === null)
  return pool
    .filter((t) => t.forEveryone || isBusiness)
    .map((t) => ({ minQty: t.minQty, price: Number(t.price), forEveryone: t.forEveryone }))
    .sort((a, b) => a.minQty - b.minQty || a.price - b.price)
}

/** The tier `qty` reaches (highest minimum; the cheaper one if both audiences share a minimum). */
export function tierFor(tiers: readonly Tier[], variantId: bigint | null, qty: number, isBusiness: boolean): TierHit | null {
  let best: TierHit | null = null
  for (const t of tiersFor(tiers, variantId, isBusiness)) {
    if (t.minQty > qty) continue
    if (!best || t.minQty > best.minQty || (t.minQty === best.minQty && t.price < best.price)) best = t
  }
  return best
}

/**
 * The quantity a line's tier is judged on. An option with tiers of its own counts only itself;
 * the product's tiers count every option of the product that has none (5 M + 5 L reach 10+).
 * `lines` are the cart's lines of this one product.
 */
export function tierQty(tiers: readonly Tier[], lines: readonly { variantId: bigint | null; qty: number }[], variantId: bigint | null): number {
  const hasOwn = (v: bigint | null) => v !== null && tiers.some((t) => t.variantId === v)
  if (hasOwn(variantId)) return lines.filter((l) => l.variantId === variantId).reduce((s, l) => s + l.qty, 0)
  return lines.filter((l) => !hasOwn(l.variantId)).reduce((s, l) => s + l.qty, 0)
}

/** The line's unit price with bulk pricing: the tier's price when it beats `current`. */
export function withTier(current: number, tier: TierHit | null): { price: number; tier: TierHit | null } {
  return tier && tier.price < current ? { price: tier.price, tier } : { price: current, tier: null }
}

export interface TierInput {
  variantId: bigint | null
  minQty: number
  price: number
  forEveryone: boolean
}

/**
 * Checks a product's full set of tiers before saving: a minimum of at least 2, a price above
 * zero, no two tiers for the same option and audience at the same minimum, and prices that
 * fall (or stay) as the minimum rises. Returns the problems, empty when fine.
 */
export function tierProblems(rows: readonly TierInput[], label: (variantId: bigint | null) => string): string[] {
  const out: string[] = []
  const groups = new Map<string, TierInput[]>()
  for (const r of rows) {
    if (!Number.isInteger(r.minQty) || r.minQty < 2) out.push(`${label(r.variantId)}: the minimum quantity must be 2 or more`)
    if (!(r.price > 0)) out.push(`${label(r.variantId)}: enter a price above zero`)
    const key = `${r.variantId ?? ""}|${r.forEveryone}`
    groups.set(key, [...(groups.get(key) ?? []), r])
  }
  for (const list of groups.values()) {
    const sorted = [...list].sort((a, b) => a.minQty - b.minQty)
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]!
      const cur = sorted[i]!
      const who = `${label(cur.variantId)} (${cur.forEveryone ? "everyone" : "business"})`
      if (cur.minQty === prev.minQty) out.push(`${who}: two prices for ${cur.minQty}+`)
      else if (cur.price > prev.price) out.push(`${who}: ${cur.minQty}+ costs more than ${prev.minQty}+`)
    }
  }
  return [...new Set(out)]
}

// ------------------------------------------------------------------ margin

export const ROUNDINGS = ["none", "1", "5", "10", "end9"] as const
export type Rounding = (typeof ROUNDINGS)[number]

/** Profit as % of the price, one decimal; null without a cost or a price. */
export function marginOf(cost: number | null, price: number | null): number | null {
  if (cost === null || price === null || price <= 0) return null
  return Math.round(((price - cost) / price) * 1000) / 10
}

/** Rounds a price up: to whole taka, the next 5 or 10, or the next price ending in 9 (…9, …99 stays). */
export function roundUp(price: number, rounding: Rounding): number {
  const cents = Math.round(price * 100) / 100
  switch (rounding) {
    case "none":
      return cents
    case "1":
      return Math.ceil(cents - 1e-9)
    case "5":
      return Math.ceil(cents / 5 - 1e-9) * 5
    case "10":
      return Math.ceil(cents / 10 - 1e-9) * 10
    case "end9": {
      const whole = Math.ceil(cents - 1e-9)
      return Math.ceil((whole + 1) / 10 - 1e-9) * 10 - 1
    }
  }
}

/** The price that earns `marginPct` on `cost`, rounded up; null for a margin of 100% or more. */
export function priceForMargin(cost: number, marginPct: number, rounding: Rounding): number | null {
  if (!(cost >= 0) || !(marginPct < 100)) return null
  return roundUp(cost / (1 - marginPct / 100), rounding)
}
