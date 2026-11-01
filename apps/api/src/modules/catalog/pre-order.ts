/**
 * Pre-order products can be ordered with no stock and ship later: from a set day, or a number of
 * days after the order. Dates are Dhaka calendar days (YYYY-MM-DD).
 */
export interface PreOrderFields {
  preOrder: boolean
  preOrderDays: number | null
  preOrderShipsOn: Date | null
}

const DHAKA_MS = 6 * 3600_000
const dayOf = (d: Date) => new Date(d.getTime() + DHAKA_MS).toISOString().slice(0, 10)

/** When an order placed `now` is expected to ship, or null for a product that isn't on pre-order. */
export function preOrderShipDate(p: PreOrderFields, now = new Date()): string | null {
  if (!p.preOrder) return null
  const today = dayOf(now)
  const fixed = p.preOrderShipsOn ? p.preOrderShipsOn.toISOString().slice(0, 10) : null
  // A set day that's already passed means "ships about now" (the shop forgot to update it).
  if (fixed) return fixed > today ? fixed : today
  const days = Math.max(0, p.preOrderDays ?? 0)
  return dayOf(new Date(now.getTime() + days * 86_400_000))
}

/** The latest ship day among an order's pre-order lines. */
export const latestShipDate = (days: (string | null)[]): string | null =>
  days.filter((d): d is string => !!d).sort().at(-1) ?? null
