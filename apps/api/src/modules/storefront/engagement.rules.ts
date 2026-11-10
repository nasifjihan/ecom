/**
 * Rules with no I/O for the storefront's search terms and public order tracking
 * (table-tested in tests/unit/engagement.test.ts).
 */

/** "  Eid   PANJABI!! " -> "eid panjabi". Null when it isn't worth recording. */
export function searchTerm(raw: string | null | undefined): string | null {
  if (!raw) return null
  const t = raw
    .normalize("NFC")
    .toLowerCase()
    // Letters with their marks (Bangla vowel signs are marks), digits, spaces, apostrophes and dashes.
    .replace(/[^\p{L}\p{M}\p{N}\s'-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
  if (t.length < 2 || t.length > 60) return null
  // Pasted order numbers, phone numbers and the like aren't product searches.
  if (/^[\d\s-]{6,}$/.test(t)) return null
  return t
}

/** A term customers searched at least this often is offered as a suggestion. */
export const SUGGEST_MIN_SEARCHES = 2

/** Public tracking shows these parts of the order history, in plain words. */
export const TRACK_STEPS = [
  { status: "PENDING", label: "Order placed" },
  { status: "PROCESSING", label: "Confirmed and being packed" },
  { status: "SHIPPED", label: "Handed to the courier" },
  { status: "OUT_FOR_DELIVERY", label: "Out for delivery" },
  { status: "DELIVERED", label: "Delivered" },
] as const

const STEP_INDEX: Record<string, number> = {
  PENDING: 0,
  ON_HOLD: 0,
  PROCESSING: 1,
  SHIPPED: 2,
  OUT_FOR_DELIVERY: 3,
  DELIVERED: 4,
  COMPLETED: 4,
}

/** How far along the usual path an order is: -1 when it left it (cancelled, refunded, failed). */
export const trackStep = (status: string) => STEP_INDEX[status] ?? -1

/** "Riya Akter" -> "Riya A." for public review and question names. */
export function publicName(first: string | null | undefined, last?: string | null): string {
  const f = (first ?? "").trim()
  const l = (last ?? "").trim()
  if (!f && !l) return "Customer"
  return l ? `${f || l} ${f ? `${l.charAt(0)}.` : ""}`.trim() : f
}

/** How far back "trending" looks. */
export const TRENDING_DAYS = 7

/**
 * Trending order: most units sold in the last week first, then all-time sales, then newest.
 * Products with no sales this week simply follow in best-seller order, so a quiet week (or a new
 * shop) still shows a full list.
 */
export function byTrending(week: Map<bigint, number>) {
  return (a: { id: bigint; sold: number }, b: { id: bigint; sold: number }) =>
    (week.get(b.id) ?? 0) - (week.get(a.id) ?? 0) || b.sold - a.sold || Number(b.id - a.id)
}

/**
 * Products a customer can still review: bought and delivered (newest order first), not reviewed
 * yet, each once.
 */
export function waitingForReview<T extends { productId: bigint | null }>(delivered: T[], reviewed: Iterable<bigint>): (T & { productId: bigint })[] {
  const seen = new Set(reviewed)
  const out: (T & { productId: bigint })[] = []
  for (const d of delivered) {
    if (d.productId === null || seen.has(d.productId)) continue
    seen.add(d.productId)
    out.push(d as T & { productId: bigint })
  }
  return out
}
