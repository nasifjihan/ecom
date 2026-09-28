/**
 * LOYALTY RULES — no I/O (table-tested in tests/unit/loyalty.test.ts).
 *
 * - Level: the highest level whose minimum spend the customer has reached. Spend counts items less
 *   discounts and refunds on delivered orders (never below zero per order).
 * - Member discount: the level's % off the items after promotions and coupons.
 * - Wallet at checkout: up to the balance, and up to the store's % of the order total.
 * - Cashback: store % + level % of the items after discounts, when delivered; a minimum order and a
 *   per-order cap can apply. A later refund takes back the same share of the cashback.
 * - Refer a friend: a new customer (no earlier orders) with someone else's code; both get their
 *   reward when the friend's first order (at least the minimum) is delivered.
 */

const r2 = (n: number) => Math.round(n * 100) / 100

export interface Level {
  id: bigint
  name: string
  minSpend: number
  discountPercent: number
  cashbackPercent: number
}

export function levelFor<L extends Pick<Level, "minSpend">>(spend: number, levels: L[]): L | null {
  let best: L | null = null
  for (const l of levels) if (spend >= l.minSpend && (!best || l.minSpend > best.minSpend)) best = l
  return best
}

/** The next level up and how much more spend it needs, or null at the top. */
export function nextLevel<L extends Pick<Level, "minSpend">>(
  spend: number,
  levels: L[],
): { level: L; needed: number } | null {
  const above = levels.filter((l) => l.minSpend > spend).sort((a, b) => a.minSpend - b.minSpend)[0]
  return above ? { level: above, needed: r2(above.minSpend - spend) } : null
}

/** A delivered order's contribution to spend. */
export const orderSpend = (itemsSubtotal: number, discountTotal: number, refundedTotal: number) =>
  Math.max(0, r2(itemsSubtotal - discountTotal - refundedTotal))

export function memberDiscount(itemsAfterOtherDiscounts: number, percent: number): number {
  if (percent <= 0 || itemsAfterOtherDiscounts <= 0) return 0
  return r2((itemsAfterOtherDiscounts * Math.min(percent, 100)) / 100)
}

/** How much of the order total the wallet pays. */
export function walletUse(total: number, balance: number, maxPercent: number): number {
  if (total <= 0 || balance <= 0 || maxPercent <= 0) return 0
  const cap = r2((total * Math.min(maxPercent, 100)) / 100)
  return r2(Math.min(balance, cap, total))
}

export interface CashbackSettings {
  enabled: boolean
  percent: number
  minOrder: number
  maxPerOrder: number | null
}

/** Cashback on a delivered order's items after discounts (and refunds so far). */
export function cashbackFor(itemsNet: number, s: CashbackSettings, levelPercent = 0): number {
  if (!s.enabled || itemsNet <= 0 || itemsNet < s.minOrder) return 0
  const pct = Math.max(0, s.percent) + Math.max(0, levelPercent)
  if (pct <= 0) return 0
  const amount = r2((itemsNet * pct) / 100)
  return s.maxPerOrder !== null ? Math.min(amount, s.maxPerOrder) : amount
}

/**
 * Cashback to take back after a refund: the refunded share of the items, never more than what's
 * left of the cashback. `itemsNet` is the items after discounts before this refund.
 */
export function cashbackToReverse(
  cashbackLeft: number,
  itemsNet: number,
  refunded: number,
): number {
  if (cashbackLeft <= 0 || refunded <= 0) return 0
  if (itemsNet <= 0 || refunded >= itemsNet) return r2(cashbackLeft)
  return Math.min(r2(cashbackLeft), r2((cashbackLeft * refunded) / itemsNet))
}

/** Why a referral code can't be used, or null when it can. */
export function referralProblem(p: {
  enabled: boolean
  ownerCustomerId: bigint | null
  customerId: bigint
  alreadyReferred: boolean
  earlierOrders: number
  samePhone: boolean
}): string | null {
  if (!p.enabled) return "Referrals aren't running right now"
  if (!p.ownerCustomerId) return "That referral code doesn't exist"
  if (p.ownerCustomerId === p.customerId) return "You can't use your own referral code"
  if (p.alreadyReferred) return "You were already referred by someone"
  if (p.earlierOrders > 0) return "Referral codes are for new customers"
  if (p.samePhone) return "That referral code can't be used on this account"
  return null
}

/** "RAHIM7K2": the name's letters (up to 5) and three random characters, upper case. */
export function referralCode(firstName: string, random: string): string {
  const base = firstName
    .normalize("NFKD")
    .replace(/[^A-Za-z]/g, "")
    .toUpperCase()
    .slice(0, 5)
  const tail = random
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase()
    .slice(0, 3)
    .padEnd(3, "X")
  return `${base || "FRIEND"}${tail}`
}
