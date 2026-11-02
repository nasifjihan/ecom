/**
 * Editing an order's items (no database): which lines stay (maybe with a new quantity), which go,
 * which are new, and what each line is worth. A kept line keeps its price, discount and tax per
 * unit; a new line is at today's price with no discount.
 */

const r2 = (n: number) => Math.round(n * 100) / 100

export type EditLine = { orderItemId?: string | null; productId: string; variantId?: string | null; quantity: number }
export type ExistingLine = { id: string; productId: string | null; variantId: string | null; productName: string; quantity: number }

/** Orders that can still be edited: nothing packed or sent, nothing refunded or returned. */
export const EDITABLE_STATUSES = ["PENDING", "PROCESSING", "ON_HOLD"]

export function editBlocker(o: { status: string; parcels: number; refunds: number; returns: number }): string | null {
  if (!EDITABLE_STATUSES.includes(o.status)) return "Only orders that haven't gone out can be edited"
  if (o.parcels > 0) return "A parcel is already packed for this order. Cancel the parcel to edit the items."
  if (o.refunds > 0 || o.returns > 0) return "This order has a refund or return, so it can't be edited"
  return null
}

export function planEdit(existing: ExistingLine[], wanted: EditLine[]) {
  if (!wanted.length) throw new Error("An order needs at least one item. Cancel the order instead.")
  const key = (p: string | null, v: string | null | undefined) => `${p}:${v ?? ""}`
  const seen = new Set<string>()
  const keep: { line: ExistingLine; quantity: number }[] = []
  const add: { productId: string; variantId: string | null; quantity: number }[] = []
  for (const w of wanted) {
    if (w.quantity < 1) throw new Error("Quantities start at 1. Remove the item instead.")
    const k = key(w.productId, w.variantId)
    if (seen.has(k)) throw new Error("The same item is listed twice. Change its quantity instead.")
    seen.add(k)
    if (w.orderItemId) {
      const line = existing.find((e) => e.id === w.orderItemId)
      if (!line) throw new Error("That item isn't part of this order")
      if (key(line.productId, line.variantId) !== k) throw new Error(`To change the size or colour of "${line.productName}", remove it and add the other one`)
      keep.push({ line, quantity: w.quantity })
    } else {
      const same = existing.find((e) => key(e.productId, e.variantId) === k)
      if (same) throw new Error(`"${same.productName}" is already on the order. Change its quantity instead.`)
      add.push({ productId: w.productId, variantId: w.variantId ?? null, quantity: w.quantity })
    }
  }
  const remove = existing.filter((e) => !keep.some((k) => k.line.id === e.id))
  return { keep, add, remove }
}

/** A kept line at a new quantity: the same price, discount and tax per unit. */
export function scaleLine(l: { quantity: number; lineSubtotal: number; lineDiscount: number; lineTax: number; lineTotal: number }, quantity: number) {
  const f = quantity / l.quantity
  return { lineSubtotal: r2(l.lineSubtotal * f), lineDiscount: r2(l.lineDiscount * f), lineTax: r2(l.lineTax * f), lineTotal: r2(l.lineTotal * f) }
}

/** A new line's money at the order's VAT rate (inside the price when the order's prices include it). */
export function newLineMoney(lineSubtotal: number, taxRate: number, included: boolean) {
  const lineTax = taxRate > 0 ? r2(included ? (lineSubtotal * taxRate) / (100 + taxRate) : (lineSubtotal * taxRate) / 100) : 0
  return { lineSubtotal: r2(lineSubtotal), lineDiscount: 0, lineTax, lineTotal: r2(lineSubtotal + (included ? 0 : lineTax)) }
}

type Money = { lineSubtotal: number; lineDiscount: number; lineTax: number; lineTotal: number }
const sum = (ls: Money[], k: keyof Money) => ls.reduce((s, l) => s + l[k], 0)

/** The order's new totals: the item changes and the delivery change are added to what it was. */
export function editedTotals(
  o: { itemsSubtotal: number; discountTotal: number; taxTotal: number; shippingTotal: number; grandTotal: number },
  before: Money[],
  after: Money[],
  shippingTotal: number,
) {
  const d = (k: keyof Money) => sum(after, k) - sum(before, k)
  const grandTotal = r2(o.grandTotal + d("lineTotal") + (shippingTotal - o.shippingTotal))
  if (grandTotal < 0) throw new Error("The order total can't go below zero")
  return {
    itemsSubtotal: r2(o.itemsSubtotal + d("lineSubtotal")),
    discountTotal: r2(o.discountTotal + d("lineDiscount")),
    taxTotal: r2(o.taxTotal + d("lineTax")),
    shippingTotal: r2(shippingTotal),
    grandTotal,
  }
}
