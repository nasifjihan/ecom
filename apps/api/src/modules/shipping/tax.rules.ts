/**
 * TAX RULES — VAT added on top of prices, or already inside them (Settings → VAT & invoices).
 * Pure functions; the rates themselves come from TaxRepository.resolveForAddress.
 */

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * The tax already inside a VAT-inclusive amount, given the tax that would be added on top of
 * that same amount. 115 with 15% VAT: 17.25 on top, so 115 × 17.25 / 132.25 = 15 inside.
 */
export function taxInside(gross: number, taxOnTop: number): number {
  if (!(gross > 0) || !(taxOnTop > 0)) return 0
  return round2((gross * taxOnTop) / (gross + taxOnTop))
}

/** Splits tax added on top of goods + delivery into the goods share and the delivery share. */
export function splitTaxOnTop(total: number, goods: number, delivery: number): { items: number; shipping: number } {
  const base = goods + delivery
  if (!(total > 0) || !(base > 0)) return { items: 0, shipping: 0 }
  const items = round2((total * Math.max(goods, 0)) / base)
  return { items, shipping: round2(total - items) }
}

/**
 * Scales line amounts so they add up to `total` (the goods after the order's discounts), keeping
 * their shares. The last line takes the rounding so the sum is exact.
 */
export function spreadAmounts(amounts: number[], total: number): number[] {
  const sum = amounts.reduce((s, a) => s + Math.max(a, 0), 0)
  if (!(sum > 0) || !(total > 0)) return amounts.map(() => 0)
  const out = amounts.map((a) => round2((Math.max(a, 0) * total) / sum))
  out[out.length - 1] = round2(total - out.slice(0, -1).reduce((s, a) => s + a, 0))
  return out
}

/**
 * Goods grouped by the tax class whose rates apply: the line's own class, else the store's
 * default class, else null (no class: every rate that matches the address, as before classes).
 * `goods` is the goods total after discounts; it's spread over the lines first.
 */
export function taxClassGroups(
  lines: { amount: number; taxClassId: string | null }[],
  goods: number,
  defaultClassId: string | null,
): { taxClassId: string | null; amount: number }[] {
  const spread = spreadAmounts(lines.map((l) => l.amount), goods)
  const byClass = new Map<string | null, number>()
  lines.forEach((l, i) => {
    const key = l.taxClassId ?? defaultClassId
    byClass.set(key, round2((byClass.get(key) ?? 0) + spread[i]!))
  })
  return [...byClass].filter(([, amount]) => amount > 0).map(([taxClassId, amount]) => ({ taxClassId, amount }))
}

/** The one rate an order keeps: the rate every taxed part shares, or 0 when they differ (mixed classes). */
export function sharedRate(parts: { ratePct: number; tax: number }[]): number {
  const rates = [...new Set(parts.filter((p) => p.tax > 0).map((p) => p.ratePct))]
  return rates.length === 1 ? rates[0]! : 0
}

/** "VAT 15%", or just "VAT" when the order kept no rate (orders placed before rates were kept). */
export function vatLabel(rate: unknown, word = "VAT"): string {
  const r = Number(rate)
  return r > 0 ? `${word} ${Number(r.toFixed(2))}%` : word
}
