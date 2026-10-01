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

/** "VAT 15%", or just "VAT" when the order kept no rate (orders placed before rates were kept). */
export function vatLabel(rate: unknown, word = "VAT"): string {
  const r = Number(rate)
  return r > 0 ? `${word} ${Number(r.toFixed(2))}%` : word
}
