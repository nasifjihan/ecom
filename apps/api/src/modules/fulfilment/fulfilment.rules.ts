/**
 * Parcel and return rules with no I/O (table-tested in tests/unit/fulfilment-rules.test.ts).
 */

// ------------------------------------------------------------------ parcels

export const PARCEL_STATUSES = [
  "ready",
  "picked_up",
  "in_transit",
  "out_for_delivery",
  "delivered",
  "failed",
  "returned",
  "cancelled",
] as const;
export type ParcelStatus = (typeof PARCEL_STATUSES)[number];

/** Where a parcel can go next. A failed delivery can be tried again or sent back. */
export const PARCEL_NEXT: Record<ParcelStatus, ParcelStatus[]> = {
  ready: ["picked_up", "in_transit", "cancelled"],
  picked_up: ["in_transit", "out_for_delivery", "delivered", "failed", "returned"],
  in_transit: ["out_for_delivery", "delivered", "failed", "returned"],
  out_for_delivery: ["delivered", "failed", "returned"],
  failed: ["in_transit", "out_for_delivery", "returned"],
  delivered: [],
  returned: [],
  cancelled: [],
};

export const canMoveParcel = (from: string, to: string) =>
  (PARCEL_NEXT[from as ParcelStatus] ?? []).includes(to as ParcelStatus);

export type FulfillmentStatus = "unfulfilled" | "partial" | "packed" | "shipped" | "delivered" | "delivery_failed" | "returned";

/**
 * The order's delivery state from its parcels. `ordered` is quantity per order line;
 * each parcel lists quantities per order line. Cancelled parcels don't count.
 */
export function fulfillmentStatus(
  ordered: Map<string, number>,
  parcels: { status: string; items: { orderItemId: string; quantity: number }[] }[],
): FulfillmentStatus {
  const active = parcels.filter((p) => p.status !== "cancelled");
  if (!active.length) return "unfulfilled";
  const packed = new Map<string, number>();
  for (const p of active) for (const i of p.items) packed.set(i.orderItemId, (packed.get(i.orderItemId) ?? 0) + i.quantity);
  const allPacked = [...ordered].every(([id, qty]) => (packed.get(id) ?? 0) >= qty);
  const statuses = active.map((p) => p.status);
  if (statuses.every((s) => s === "returned")) return "returned";
  if (statuses.some((s) => s === "failed")) return "delivery_failed";
  const live = statuses.filter((s) => s !== "returned");
  if (!allPacked) return "partial";
  if (live.every((s) => s === "delivered")) return "delivered";
  if (live.some((s) => s !== "ready")) return "shipped";
  return "packed";
}

/** The order status a parcel change should move the order to, or null to leave it. */
export function orderStatusForFulfillment(fulfillment: FulfillmentStatus, parcelStatus: string): string | null {
  if (fulfillment === "delivered") return "DELIVERED";
  if (parcelStatus === "out_for_delivery") return "OUT_FOR_DELIVERY";
  if (fulfillment === "shipped" || (fulfillment === "partial" && parcelStatus !== "ready" && parcelStatus !== "cancelled")) {
    return "SHIPPED";
  }
  return null;
}

/** Order-status steps from `from` to `to` using the allowed transitions (empty when unreachable or already there). */
export function orderStatusPath(from: string, to: string, transitions: Record<string, string[]>): string[] {
  if (from === to) return [];
  const seen = new Set([from]);
  const queue: string[][] = [[from]];
  while (queue.length) {
    const path = queue.shift()!;
    for (const next of transitions[path[path.length - 1]!] ?? []) {
      if (seen.has(next) || next === "CANCELLED" || next === "ON_HOLD" || next === "FAILED" || next === "REFUNDED") continue;
      const p = [...path, next];
      if (next === to) return p.slice(1);
      seen.add(next);
      queue.push(p);
    }
  }
  return [];
}

// ------------------------------------------------------------------ returns

export const RETURN_STATUSES = ["requested", "approved", "received", "refunded", "rejected", "cancelled"] as const;
export type ReturnStatus = (typeof RETURN_STATUSES)[number];

export const RETURN_NEXT: Record<ReturnStatus, ReturnStatus[]> = {
  requested: ["approved", "received", "rejected", "cancelled"],
  approved: ["received", "cancelled"],
  received: ["refunded", "rejected"],
  refunded: [],
  rejected: [],
  cancelled: [],
};

export const canMoveReturn = (from: string, to: string) =>
  (RETURN_NEXT[from as ReturnStatus] ?? []).includes(to as ReturnStatus);

/** The order's return state: the newest return that isn't cancelled, else none. */
export function returnStatusOf(returns: { status: string; createdAt: Date }[]): string {
  const live = returns.filter((r) => r.status !== "cancelled").sort((a, b) => +b.createdAt - +a.createdAt);
  return live[0]?.status ?? "none";
}

/** Customers can ask for a return this many days after delivery. */
export const RETURN_WINDOW_DAYS = 7;

// ------------------------------------------------------------------ money

const r2 = (n: number) => Math.round(n * 100) / 100;

/** What `quantity` units of an order line are worth after its discount and with its tax. */
export const unitRefund = (line: { quantity: number; lineTotal: number }) => (line.quantity > 0 ? line.lineTotal / line.quantity : 0);

/**
 * Checks refund lines against what's left of each line and of the order, and prices them.
 * Throws a message on the first problem.
 */
export function priceRefund(
  lines: { id: string; name: string; quantity: number; lineTotal: number }[],
  alreadyRefundedQty: Map<string, number>,
  request: { orderItemId: string; quantity: number }[],
  extra: number,
  orderTotal: number,
  refundedTotal: number,
): { amount: number; perLine: { orderItemId: string; quantity: number; amount: number }[] } {
  const perLine = request.map((r) => {
    const line = lines.find((l) => l.id === r.orderItemId);
    if (!line) throw new Error("That item isn't part of this order");
    const left = line.quantity - (alreadyRefundedQty.get(line.id) ?? 0);
    if (r.quantity > left) throw new Error(`Only ${left} of "${line.name}" can still be refunded`);
    return { orderItemId: r.orderItemId, quantity: r.quantity, amount: r2(unitRefund(line) * r.quantity) };
  });
  const amount = r2(perLine.reduce((s, l) => s + l.amount, 0) + extra);
  const room = r2(orderTotal - refundedTotal);
  if (amount <= 0) throw new Error("Choose items or an amount to refund");
  if (amount > room + 0.001) throw new Error(`At most ৳${room.toFixed(2)} can still be refunded on this order`);
  return { amount, perLine };
}
