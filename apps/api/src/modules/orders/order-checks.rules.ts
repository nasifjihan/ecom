/**
 * Fraud check and COD call rules (no database). A phone number's delivery record is its past
 * orders that went out, across every shop on the platform: delivered vs returned or failed.
 */
import { bdMobile } from "../sms/sms.rules"

export type RiskLevel = "new" | "good" | "watch" | "high"

export type RiskSettings = { riskWatchBelow: number; riskHighBelow: number; riskMinParcels: number }

export const DEFAULT_ORDER_CHECKS = {
  riskWatchBelow: 70,
  riskHighBelow: 50,
  riskMinParcels: 3,
  holdHighRisk: false,
  callRetryHours: 2,
  callMaxTries: 3,
  customerExchanges: false,
  exchangeFee: 0,
}
export type OrderCheckSettings = typeof DEFAULT_ORDER_CHECKS

/** The number an order is looked up by: shipping phone, else billing phone, as 01XXXXXXXXX. */
export const phoneKeyOf = (o: { shippingPhone?: string | null; billingPhone?: string | null }) => bdMobile(o.shippingPhone) ?? bdMobile(o.billingPhone)

/** Delivered or came back, from an order's parcel and order state (null: not finished yet). */
export function deliveryOutcome(o: { status: string; fulfillmentStatus: string }): "delivered" | "returned" | null {
  if (o.fulfillmentStatus === "returned" || o.fulfillmentStatus === "delivery_failed") return "returned"
  if (o.fulfillmentStatus === "delivered" || o.status === "DELIVERED" || o.status === "COMPLETED") return "delivered"
  return null
}

export function riskLevel(r: { delivered: number; returned: number }, s: RiskSettings): RiskLevel {
  const total = r.delivered + r.returned
  if (total === 0) return "new"
  const rate = (r.delivered / total) * 100
  if (total >= s.riskMinParcels && rate < s.riskHighBelow) return "high"
  return rate < s.riskWatchBelow ? "watch" : "good"
}

/** Delivered share in whole percent (null with no parcels yet). */
export const deliveryRate = (r: { delivered: number; returned: number }) =>
  r.delivered + r.returned > 0 ? Math.round((r.delivered / (r.delivered + r.returned)) * 100) : null

// ------------------------------------------------------------------ calls

export const CALL_OUTCOMES = ["confirmed", "no_answer", "wrong_number", "fake", "cancelled"] as const
export type CallOutcome = (typeof CALL_OUTCOMES)[number]

/**
 * What a call does to the order: its new status (if any), and when to call again.
 * No answer comes back after the wait until the tries run out; then it waits for staff.
 */
export function afterCall(outcome: CallOutcome, attempts: number, s: { callRetryHours: number; callMaxTries: number }, now: Date) {
  const tries = attempts + 1
  if (outcome === "confirmed") return { tries, status: "PROCESSING" as const, nextCallAt: null }
  if (outcome === "fake" || outcome === "cancelled") return { tries, status: "CANCELLED" as const, nextCallAt: null }
  if (outcome === "no_answer" && tries < s.callMaxTries) return { tries, status: null, nextCallAt: new Date(+now + s.callRetryHours * 3600_000) }
  return { tries, status: null, nextCallAt: null }
}
