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
