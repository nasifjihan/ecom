/**
 * QUOTATION RULES — pure status and money rules for price quotes.
 *
 *   REQUESTED  the customer asked from their cart; staff price it
 *   DRAFT      staff are preparing it (the customer doesn't see it)
 *   SENT       the customer can accept or decline until `validUntil` (after that it reads EXPIRED)
 *   ACCEPTED / DECLINED   the customer's answer
 *   ORDERED    staff turned it into an order
 *   CANCELLED  withdrawn
 *
 * Editing a quote that was sent (or answered) takes it back to DRAFT, so it must be sent again.
 */

export const QUOTE_STATUSES = ["REQUESTED", "DRAFT", "SENT", "ACCEPTED", "DECLINED", "ORDERED", "CANCELLED"] as const
export type QuoteStatus = (typeof QUOTE_STATUSES)[number]
/** What lists and filters show: SENT past its date reads EXPIRED. */
export type QuoteView = QuoteStatus | "EXPIRED"

const round2 = (n: number) => Math.round(n * 100) / 100

export function isExpired(status: string, validUntil: Date | null, now = new Date()): boolean {
  return status === "SENT" && validUntil !== null && validUntil.getTime() < now.getTime()
}

export function viewStatus(status: string, validUntil: Date | null, now = new Date()): QuoteView {
  return isExpired(status, validUntil, now) ? "EXPIRED" : (status as QuoteStatus)
}

/** The end of the given day (valid "until 30 Sept" means all of 30 Sept, Dhaka time). */
export function endOfDay(date: string): Date {
  return new Date(`${date}T23:59:59.999+06:00`)
}

export const canEdit = (status: string) => ["REQUESTED", "DRAFT", "SENT", "ACCEPTED", "DECLINED"].includes(status)
export const canSend = (status: string) => ["REQUESTED", "DRAFT", "SENT"].includes(status)
export const canCancel = (status: string) => !["ORDERED", "CANCELLED"].includes(status)

/** The customer may answer a sent quote that hasn't expired. */
export function canRespond(status: string, validUntil: Date | null, now = new Date()): boolean {
  return status === "SENT" && !isExpired(status, validUntil, now)
}

/** Staff may turn a live sent quote, or an accepted one, into an order. */
export function orderBlocker(status: string, validUntil: Date | null, now = new Date()): string | null {
  if (status === "ACCEPTED") return null
  if (status === "SENT") return isExpired(status, validUntil, now) ? "This quote has expired. Change the date and send it again first." : null
  if (status === "ORDERED") return "This quote is already an order"
  if (status === "DECLINED") return "The customer declined this quote. Change it and send it again first."
  return "Send the quote to the customer first"
}

export interface QuoteLine {
  qty: number
  unitPrice: number
  listPrice: number
}

export interface QuoteTotals {
  subtotal: number
  discount: number
  deliveryFee: number
  total: number
  /** What the lines would cost at the customer's normal prices. */
  listTotal: number
  /** Everything taken off the normal prices (lower prices + discount), as % of listTotal. */
  offPercent: number
}

export function quoteTotals(lines: readonly QuoteLine[], discount: number, deliveryFee: number): QuoteTotals {
  const subtotal = round2(lines.reduce((s, l) => s + round2(l.qty * l.unitPrice), 0))
  const d = round2(Math.min(Math.max(0, discount), subtotal))
  const listTotal = round2(lines.reduce((s, l) => s + round2(l.qty * l.listPrice), 0))
  const off = round2(listTotal - (subtotal - d))
  return {
    subtotal,
    discount: d,
    deliveryFee: round2(Math.max(0, deliveryFee)),
    total: round2(subtotal - d + Math.max(0, deliveryFee)),
    listTotal,
    offPercent: listTotal > 0 ? Math.max(0, Math.round((off / listTotal) * 1000) / 10) : 0,
  }
}

/** Q-000001 style numbers; `last` is the highest number used so far (or null). */
export function nextQuoteNumber(last: string | null): string {
  const n = last ? Number(last.replace(/\D/g, "")) || 0 : 0
  return `Q-${String(n + 1).padStart(6, "0")}`
}
