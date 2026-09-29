/**
 * PURCHASING RULES — no I/O (table-tested in tests/unit/purchasing.test.ts).
 *
 * - A line's total is qty × unit cost, less its discount % and then its discount amount.
 * - Landed cost: shipping, customs and other charges, less the purchase discount, are shared over
 *   the lines by value (by quantity when every line is free), so each unit's cost includes them.
 * - A product's cost price becomes the weighted average of the stock on hand and what was bought.
 * - Payment terms: "instant full" pays the total now, "instant partial" part of it, "credit" and
 *   "advance" nothing now (credit is paid later; advance was paid before).
 */

const round2 = (n: number) => Math.round(n * 100) / 100

export const PAYMENT_TERMS = ["advance", "instant_full", "instant_partial", "credit"] as const
export type PaymentTerm = (typeof PAYMENT_TERMS)[number]

export const MONEY_ACCOUNT_TYPES = ["bank", "cash", "mobile"] as const
export const PAYMENT_METHODS = [
  "cash",
  "bank_transfer",
  "cheque",
  "bkash",
  "nagad",
  "rocket",
  "other",
] as const

export interface LineInput {
  qty: number
  unitCost: number
  discountPct?: number
  discountAmount?: number
}

/** The line's total, or an error when its discount is more than the line is worth. */
export function lineTotal(l: LineInput): { total: number } | { error: string } {
  if (!Number.isInteger(l.qty) || l.qty < 1)
    return { error: "Quantity must be a whole number of 1 or more" }
  if (l.unitCost < 0) return { error: "Unit cost can't be negative" }
  const pct = l.discountPct ?? 0
  if (pct < 0 || pct > 100) return { error: "Discount % must be between 0 and 100" }
  const afterPct = l.qty * l.unitCost * (1 - pct / 100)
  const amt = l.discountAmount ?? 0
  if (amt < 0) return { error: "Discount can't be negative" }
  if (amt > round2(afterPct) + 0.001)
    return { error: "The discount is more than the line is worth" }
  return { total: round2(afterPct - amt) }
}

export interface Extras {
  shipping?: number
  customs?: number
  other?: number
  discount?: number
}

/**
 * Totals for a purchase and each line's landed unit cost. `extras` are shared over the lines by
 * value; the last line takes the rounding so the shares add up exactly.
 */
export function purchaseTotals(
  lines: LineInput[],
  extras: Extras,
):
  | { itemsSubtotal: number; total: number; lineTotals: number[]; landedUnitCosts: number[] }
  | { error: string } {
  if (!lines.length) return { error: "Add at least one item" }
  const totals: number[] = []
  for (const [i, l] of lines.entries()) {
    const r = lineTotal(l)
    if ("error" in r) return { error: `Line ${i + 1}: ${r.error}` }
    totals.push(r.total)
  }
  const e = {
    shipping: extras.shipping ?? 0,
    customs: extras.customs ?? 0,
    other: extras.other ?? 0,
    discount: extras.discount ?? 0,
  }
  if (Object.values(e).some((v) => v < 0))
    return { error: "Charges and discount can't be negative" }
  const itemsSubtotal = round2(totals.reduce((s, t) => s + t, 0))
  const extra = round2(e.shipping + e.customs + e.other - e.discount)
  const total = round2(itemsSubtotal + extra)
  if (total < 0) return { error: "The discount is more than the whole purchase" }

  // Share by value; by quantity when nothing has a value (free goods with only shipping to pay).
  const weights = itemsSubtotal > 0 ? totals : lines.map((l) => l.qty)
  const weightSum = weights.reduce((s, w) => s + w, 0)
  let left = extra
  const landedUnitCosts = lines.map((l, i) => {
    const share = i === lines.length - 1 ? left : round2((extra * weights[i]!) / weightSum)
    left = round2(left - share)
    return round2(Math.max(0, totals[i]! + share) / l.qty)
  })
  return { itemsSubtotal, total, lineTotals: totals, landedUnitCosts }
}

/** Weighted average cost after receiving `addQty` at `addCost` (stock below zero counts as none). */
export function averageCost(
  onHand: number,
  currentCost: number | null,
  addQty: number,
  addCost: number,
): number {
  if (onHand <= 0 || currentCost === null) return round2(addCost)
  return round2((onHand * currentCost + addQty * addCost) / (onHand + addQty))
}

/** What's paid now for a payment term, or why the amount doesn't fit it. */
export function payNowFor(
  term: PaymentTerm,
  total: number,
  payNow: number | undefined,
): { amount: number } | { error: string } {
  switch (term) {
    case "instant_full":
      if (payNow !== undefined && Math.abs(payNow - total) > 0.001)
        return { error: `"Instant full" pays the whole ${total} now` }
      return { amount: total }
    case "instant_partial":
      if (payNow === undefined || payNow <= 0 || payNow >= total)
        return { error: "For a part payment, enter an amount above 0 and below the total" }
      return { amount: round2(payNow) }
    case "credit":
    case "advance":
      if (payNow)
        return {
          error:
            term === "credit"
              ? "On credit nothing is paid now; record the payment later"
              : "An advance was paid before; nothing is paid now",
        }
      return { amount: 0 }
  }
}

/** What the shop owes a supplier: opening balance + purchases received − payments. Negative = paid ahead. */
export const supplierBalance = (opening: number, purchases: number, payments: number) =>
  round2(opening + purchases - payments)

/** Purchase number from a running count: 7 -> "PUR-000007". */
export const purchaseNumber = (n: number) => `PUR-${String(n).padStart(6, "0")}`
