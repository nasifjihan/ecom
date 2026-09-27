/**
 * AUTOMATIC PROMOTIONS — rules with no I/O (table-tested in tests/unit/promotions.test.ts).
 *
 * - Only one discount-type promotion applies to an order: the one worth most to the customer.
 * - Buy X get Y free offers stack with it (each on its own product) and are worked out first, so
 *   the discount is taken off what's left to pay.
 * - Every free gift whose spend is reached is added; free delivery applies when any offer gives it.
 * - Scope is products or whole categories; both empty = the whole cart. Discounts skip items already
 *   on a flash sale / marked down unless the promotion says otherwise.
 * - Minimum order / quantity are measured on the items in scope.
 * An offer that's close (short of its minimum) comes back as a nudge: "Add ৳300 more for free delivery".
 */

export const PROMOTION_TYPES = ["discount", "free_gift", "bxgy", "free_delivery"] as const
export type PromotionType = (typeof PROMOTION_TYPES)[number]

export const PROMOTION_SLOTS = [
  "announcement_bar",
  "home_hero",
  "home_below_categories",
  "home_offers",
  "category_banner",
  "product_detail",
  "cart",
  "checkout",
  "entry_popup",
] as const
export type PromotionSlot = (typeof PROMOTION_SLOTS)[number]

export interface PromoLine {
  key: string
  productId: string
  name: string
  categoryIds: string[]
  unitPrice: number
  qty: number
  /** On a flash sale or marked down (has a compare-at price). */
  onSale: boolean
}

export interface PromoRule {
  id: string
  name: string
  type: PromotionType
  discountType?: "percentage" | "fixed" | null
  discountValue?: number | null
  maxDiscount?: number | null
  minOrder?: number | null
  minQty?: number | null
  productIds: string[]
  categoryIds: string[]
  includeSaleItems?: boolean
  buyQty?: number | null
  getQty?: number | null
  gift?: { productId: string; variantId: string | null; qty: number; name?: string } | null
}

export interface PromoResult {
  /** The one discount-type promotion applied. */
  discount: { id: string; name: string; amount: number } | null
  bxgy: {
    id: string
    name: string
    productId: string
    productName: string
    freeUnits: number
    amount: number
  }[]
  gifts: { id: string; name: string; productId: string; variantId: string | null; qty: number }[]
  freeDelivery: { id: string; name: string } | null
  /** Discount + buy X get Y, taken off the items. */
  total: number
  /** How much of `total` comes off each line (by line key). */
  lineDiscounts: Record<string, number>
  nudges: {
    id: string
    name: string
    type: PromotionType
    message: string
    amountShort?: number
    qtyShort?: number
  }[]
}

const round2 = (n: number) => Math.round(n * 100) / 100
const tk = (n: number) => `৳${round2(n).toLocaleString("en-US", { maximumFractionDigits: 2 })}`

/** The line counts toward (and, for discounts, gets) this promotion. */
export function inScope(p: PromoRule, l: PromoLine): boolean {
  const discounting = p.type === "discount" || p.type === "bxgy"
  if (discounting && l.onSale && !p.includeSaleItems) return false
  if (!p.productIds.length && !p.categoryIds.length) return true
  return p.productIds.includes(l.productId) || l.categoryIds.some((c) => p.categoryIds.includes(c))
}

/** "20% off (up to ৳500)", "Buy 2 get 1 free", "Free gift over ৳3,000", "Free delivery over ৳1,500". */
export function describePromotion(p: PromoRule): string {
  const over = p.minOrder ? ` over ${tk(p.minOrder)}` : p.minQty ? ` on ${p.minQty}+ items` : ""
  switch (p.type) {
    case "discount": {
      const v = p.discountValue ?? 0
      const what = p.discountType === "fixed" ? `${tk(v)} off` : `${v}% off`
      const cap = p.discountType !== "fixed" && p.maxDiscount ? ` (up to ${tk(p.maxDiscount)})` : ""
      return `${what}${cap}${over}`
    }
    case "bxgy":
      return `Buy ${p.buyQty ?? 1} get ${p.getQty ?? 1} free${over}`
    case "free_gift":
      return `Free gift${p.gift?.name ? `: ${p.gift.name}` : ""}${over}`
    case "free_delivery":
      return `Free delivery${over}`
  }
}

export type PromotionState = "live" | "scheduled" | "ended" | "paused"

export function promotionState(
  p: { isActive: boolean; startsAt?: Date | null; endsAt?: Date | null },
  now = new Date(),
): PromotionState {
  if (p.endsAt && p.endsAt <= now) return "ended"
  if (!p.isActive) return "paused"
  if (p.startsAt && p.startsAt > now) return "scheduled"
  return "live"
}

/** Buy X get Y on one product: how many units are free and what they're worth (cheapest units). */
function bxgyFor(p: PromoRule, lines: PromoLine[]) {
  const buy = Math.max(1, p.buyQty ?? 1)
  const get = Math.max(1, p.getQty ?? 1)
  const units = lines.flatMap((l) =>
    Array.from({ length: l.qty }, () => ({ key: l.key, price: l.unitPrice })),
  )
  const qty = units.length
  const freeUnits = Math.floor(qty / (buy + get)) * get
  units.sort((a, b) => a.price - b.price)
  const perLine: Record<string, number> = {}
  for (const u of units.slice(0, freeUnits))
    perLine[u.key] = round2((perLine[u.key] ?? 0) + u.price)
  const amount = round2(Object.values(perLine).reduce((s, v) => s + v, 0))
  // Enough bought for the next free one: say how many more to add.
  const into = qty % (buy + get)
  const toAdd = into >= buy ? buy + get - into : 0
  return { freeUnits, amount, perLine, toAdd }
}

export function evaluatePromotions(lines: PromoLine[], promos: PromoRule[]): PromoResult {
  const result: PromoResult = {
    discount: null,
    bxgy: [],
    gifts: [],
    freeDelivery: null,
    total: 0,
    lineDiscounts: {},
    nudges: [],
  }
  if (!lines.length) return result
  const take = (key: string, amount: number) => {
    result.lineDiscounts[key] = round2((result.lineDiscounts[key] ?? 0) + amount)
  }

  const check = (p: PromoRule) => {
    const scoped = lines.filter((l) => inScope(p, l))
    const subtotal = round2(scoped.reduce((s, l) => s + l.unitPrice * l.qty, 0))
    const qty = scoped.reduce((s, l) => s + l.qty, 0)
    const amountShort = p.minOrder && subtotal < p.minOrder ? round2(p.minOrder - subtotal) : 0
    const qtyShort = p.minQty && qty < p.minQty ? p.minQty - qty : 0
    return {
      scoped,
      subtotal,
      qty,
      amountShort,
      qtyShort,
      ok: scoped.length > 0 && !amountShort && !qtyShort,
    }
  }
  const nudge = (p: PromoRule, c: ReturnType<typeof check>, reward: string) => {
    if (!c.scoped.length && (p.productIds.length || p.categoryIds.length)) return
    const scopedOnly = p.productIds.length > 0 || p.categoryIds.length > 0
    const of = scopedOnly ? " of the offer items" : ""
    const message = c.amountShort
      ? `Add ${tk(c.amountShort)} more${of} ${reward}`
      : `Add ${c.qtyShort} more item${c.qtyShort === 1 ? "" : "s"}${of} ${reward}`
    result.nudges.push({
      id: p.id,
      name: p.name,
      type: p.type,
      message,
      ...(c.amountShort ? { amountShort: c.amountShort } : {}),
      ...(c.qtyShort ? { qtyShort: c.qtyShort } : {}),
    })
  }

  // 1. Buy X get Y: per product, the best offer on it.
  const bestByProduct = new Map<
    string,
    { p: PromoRule; r: ReturnType<typeof bxgyFor>; name: string }
  >()
  const bxgyNudges = new Map<string, PromoResult["nudges"][number]>()
  for (const p of promos.filter((x) => x.type === "bxgy")) {
    const c = check(p)
    if (!c.ok) {
      if (c.scoped.length) nudge(p, c, `to unlock ${describePromotion(p).toLowerCase()}`)
      continue
    }
    const byProduct = new Map<string, PromoLine[]>()
    for (const l of c.scoped) byProduct.set(l.productId, [...(byProduct.get(l.productId) ?? []), l])
    for (const [productId, ls] of byProduct) {
      const r = bxgyFor(p, ls)
      const cur = bestByProduct.get(productId)
      if (r.freeUnits > 0 && (!cur || r.amount > cur.r.amount))
        bestByProduct.set(productId, { p, r, name: ls[0]!.name })
      else if (r.freeUnits === 0 && r.toAdd > 0 && !bxgyNudges.has(productId)) {
        bxgyNudges.set(productId, {
          id: p.id,
          name: p.name,
          type: "bxgy",
          qtyShort: r.toAdd,
          message: `Add ${r.toAdd} more ${ls[0]!.name}: ${r.toAdd === 1 ? "it's" : "they're"} free (${describePromotion(p)})`,
        })
      }
    }
  }
  for (const [productId, { p, r, name }] of bestByProduct) {
    result.bxgy.push({
      id: p.id,
      name: p.name,
      productId,
      productName: name,
      freeUnits: r.freeUnits,
      amount: r.amount,
    })
    for (const [key, v] of Object.entries(r.perLine)) take(key, v)
  }
  // A nudge for a product that already gets a free unit from another offer is noise.
  for (const [productId, n] of bxgyNudges) if (!bestByProduct.has(productId)) result.nudges.push(n)

  // 2. The single best discount, on what's left after free units.
  const afterBxgy = (l: PromoLine) =>
    round2(l.unitPrice * l.qty - (result.lineDiscounts[l.key] ?? 0))
  let best: { p: PromoRule; amount: number; base: { key: string; value: number }[] } | null = null
  for (const p of promos.filter((x) => x.type === "discount")) {
    const c = check(p)
    const v = p.discountValue ?? 0
    if (!c.ok) {
      nudge(p, c, `to get ${p.discountType === "fixed" ? `${tk(v)} off` : `${v}% off`}`)
      continue
    }
    const base = c.scoped.map((l) => ({ key: l.key, value: afterBxgy(l) }))
    const baseTotal = round2(base.reduce((s, b) => s + b.value, 0))
    let amount = p.discountType === "fixed" ? Math.min(v, baseTotal) : (baseTotal * v) / 100
    if (p.discountType !== "fixed" && p.maxDiscount) amount = Math.min(amount, p.maxDiscount)
    amount = round2(Math.max(0, amount))
    if (amount > 0 && (!best || amount > best.amount)) best = { p, amount, base }
  }
  if (best) {
    const chosen = best
    result.discount = { id: chosen.p.id, name: chosen.p.name, amount: chosen.amount }
    // Spread over the lines in proportion; the last line takes the rounding.
    const baseTotal = best.base.reduce((s, b) => s + b.value, 0)
    let left = best.amount
    best.base.forEach((b, i) => {
      const share =
        i === chosen.base.length - 1 ? left : round2((chosen.amount * b.value) / baseTotal)
      left = round2(left - share)
      take(b.key, share)
    })
    // Nudges for smaller discounts than the one applied don't help.
    result.nudges = result.nudges.filter(
      (n) =>
        n.type !== "discount" ||
        n.id === chosen.p.id ||
        isBetter(promos, n.id, chosen.amount, lines),
    )
  }

  // 3. Free gifts, 4. free delivery.
  for (const p of promos.filter((x) => x.type === "free_gift" && x.gift)) {
    const c = check(p)
    if (c.ok)
      result.gifts.push({
        id: p.id,
        name: p.name,
        productId: p.gift!.productId,
        variantId: p.gift!.variantId,
        qty: Math.max(1, p.gift!.qty),
      })
    else nudge(p, c, `to get a free gift${p.gift!.name ? ` (${p.gift!.name})` : ""}`)
  }
  for (const p of promos.filter((x) => x.type === "free_delivery")) {
    const c = check(p)
    if (c.ok) result.freeDelivery ??= { id: p.id, name: p.name }
    else if (!result.freeDelivery) nudge(p, c, "for free delivery")
  }
  if (result.freeDelivery) result.nudges = result.nudges.filter((n) => n.type !== "free_delivery")

  result.total = round2(
    (result.discount?.amount ?? 0) + result.bxgy.reduce((s, b) => s + b.amount, 0),
  )
  // Closest first; a few are enough.
  result.nudges.sort(
    (a, b) => (a.amountShort ?? 0) - (b.amountShort ?? 0) || (a.qtyShort ?? 0) - (b.qtyShort ?? 0),
  )
  result.nudges = result.nudges.slice(0, 3)
  return result
}

/** Would the discount promotion `id`, once its minimum is reached, be worth more than `current`? */
function isBetter(promos: PromoRule[], id: string, current: number, lines: PromoLine[]): boolean {
  const p = promos.find((x) => x.id === id)
  if (!p) return false
  const v = p.discountValue ?? 0
  if (p.discountType === "fixed") return v > current
  const reach = Math.max(
    p.minOrder ?? 0,
    lines.filter((l) => inScope(p, l)).reduce((s, l) => s + l.unitPrice * l.qty, 0),
  )
  const amount = p.maxDiscount ? Math.min((reach * v) / 100, p.maxDiscount) : (reach * v) / 100
  return amount > current
}
