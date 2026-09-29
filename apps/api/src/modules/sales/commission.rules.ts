/**
 * COMMISSION RULES — pure rules for the sales team's commission.
 *
 * Rate for a product: its own rate, else its category's (the main category first), else the
 * store's default; plus the salesperson's extra %. Commission is on the items after discounts:
 * the order's discounts are shared over the lines by value. It's worked out once, when the order
 * is credited to the salesperson, so later rate changes don't touch past orders.
 *
 * It's earned when the order is delivered AND paid (the later of the two is when). Refunds take
 * their share back; a cancelled, failed or fully refunded order earns nothing.
 */

const round2 = (n: number) => Math.round(n * 100) / 100

export type RateSource = "product" | "category" | "store"

export interface RateInput {
  productRate: number | null
  /** Rates of the product's categories, main category first (null where none is set). */
  categoryRates: (number | null)[]
  defaultRate: number
  extraPct: number
}

export function rateFor(r: RateInput): { rate: number; source: RateSource } {
  const base =
    r.productRate !== null
      ? { rate: r.productRate, source: "product" as const }
      : r.categoryRates.find((c) => c !== null) != null
        ? { rate: r.categoryRates.find((c) => c !== null)!, source: "category" as const }
        : { rate: r.defaultRate, source: "store" as const }
  return { rate: round2(Math.max(0, base.rate + r.extraPct)), source: base.source }
}

export interface CommissionLineIn {
  name: string
  subtotal: number
  rate: number
  source: RateSource
}

export interface CommissionLine extends CommissionLineIn {
  base: number
  amount: number
}

/** Shares `discount` over the lines by value, then applies each line's rate. */
export function commissionLines(lines: readonly CommissionLineIn[], discount: number): { lines: CommissionLine[]; base: number; amount: number } {
  const total = lines.reduce((s, l) => s + l.subtotal, 0)
  const d = Math.min(Math.max(0, discount), total)
  let left = round2(d)
  const out = lines.map((l, i) => {
    const share = i === lines.length - 1 ? left : round2(total > 0 ? (d * l.subtotal) / total : 0)
    left = round2(left - share)
    const base = round2(Math.max(0, l.subtotal - share))
    return { ...l, base, amount: round2((base * l.rate) / 100) }
  })
  return {
    lines: out,
    base: round2(out.reduce((s, l) => s + l.base, 0)),
    amount: round2(out.reduce((s, l) => s + l.amount, 0)),
  }
}

export type CommissionState = "PENDING" | "EARNED" | "PAID" | "CANCELLED"

export interface OrderFacts {
  status: string
  paymentStatus: string
  deliveredAt: Date | null
  paidAt: Date | null
  itemsSubtotal: number
  discountTotal: number
  refundedTotal: number
}

const CLOSED = ["CANCELLED", "FAILED", "REFUNDED"]
const DELIVERED = ["DELIVERED", "COMPLETED"]
const PAID = ["paid", "partially_refunded"]

/** Where a commission stands now, what it's worth after refunds, and when it was earned. */
export function commissionState(
  o: OrderFacts,
  c: { base: number; amount: number; paidOutAt: Date | null },
): { state: CommissionState; amount: number; base: number; earnedAt: Date | null } {
  if (CLOSED.includes(o.status)) return { state: "CANCELLED", amount: 0, base: 0, earnedAt: null }
  const net = o.itemsSubtotal - o.discountTotal
  const kept = net > 0 ? Math.max(0, Math.min(1, 1 - o.refundedTotal / net)) : 1
  const amount = round2(c.amount * kept)
  const base = round2(c.base * kept)
  const done = DELIVERED.includes(o.status) && PAID.includes(o.paymentStatus)
  if (!done) return { state: "PENDING", amount, base, earnedAt: null }
  const times = [o.deliveredAt, o.paidAt].filter((d): d is Date => d !== null).map((d) => d.getTime())
  const earnedAt = times.length ? new Date(Math.max(...times)) : null
  return { state: c.paidOutAt ? "PAID" : "EARNED", amount, base, earnedAt }
}

// ------------------------------------------------------------------ months (Dhaka time)

const DHAKA_MS = 6 * 3600_000

/** YYYY-MM of a moment, in Dhaka. */
export function monthOf(d: Date): string {
  return new Date(d.getTime() + DHAKA_MS).toISOString().slice(0, 7)
}

/** [start, end) of a Dhaka month as instants. */
export function monthRange(month: string): { start: Date; end: Date } {
  const [y, m] = month.split("-").map(Number) as [number, number]
  const start = new Date(Date.UTC(y, m - 1, 1) - DHAKA_MS)
  const end = new Date(Date.UTC(y, m, 1) - DHAKA_MS)
  return { start, end }
}

/** Progress toward a monthly target, in % (null without a target). */
export function targetProgress(sales: number, target: number | null): number | null {
  if (!target || target <= 0) return null
  return Math.round((sales / target) * 1000) / 10
}

/** A share-link code: letters and digits, 3–20. */
export const SALES_CODE = /^[A-Z0-9]{3,20}$/
