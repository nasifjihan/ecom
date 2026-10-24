/**
 * The payment methods every new store starts with (Settings → Payments lists these; the store
 * turns on the ones it uses). Cash on delivery is on; bKash, Nagad, Rocket and bank transfer
 * start as manual (staff check the transaction ID), the card gateways as online.
 * Used by the seed and when the super admin creates a store.
 */
export const DEFAULT_GATEWAYS = [
  { code: "cod", name: "Cash On Delivery", enabled: true, sortOrder: 1 },
  { code: "bkash", name: "bKash", sortOrder: 2 },
  { code: "nagad", name: "Nagad", sortOrder: 3 },
  { code: "rocket", name: "Rocket", sortOrder: 4 },
  { code: "sslcommerz", name: "SSLCommerz", sortOrder: 5 },
  { code: "aamarpay", name: "aamarPay", sortOrder: 6 },
  { code: "stripe", name: "Stripe", sortOrder: 10 },
  { code: "bank_transfer", name: "Bank Transfer", sortOrder: 20 },
] as const

const MANUAL = new Set(["bkash", "nagad", "rocket", "bank_transfer"])

/** Rows for paymentGatewayConfig.createMany for one store. */
export function defaultGatewayRows(storeId: bigint) {
  return DEFAULT_GATEWAYS.map((g) => ({
    storeId,
    code: g.code,
    name: g.name,
    sortOrder: g.sortOrder,
    enabled: "enabled" in g ? g.enabled : false,
    mode: MANUAL.has(g.code) ? "manual" : "online",
  }))
}
