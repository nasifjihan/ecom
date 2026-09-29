/**
 * LANDING PAGE RULES — pure rules for product landing pages (/lp/{slug}).
 *
 * The page's offer price replaces the product's normal price (for every option) while it runs,
 * and only when it's lower: an offer never raises a price. The order form asks for one name; it
 * becomes the order's first and last name.
 */

export function offerActive(offerPrice: number | null, endsAt: Date | null, now = new Date()): boolean {
  return offerPrice !== null && offerPrice > 0 && (!endsAt || endsAt.getTime() > now.getTime())
}

/** What one piece costs on the page: the offer when it's running and lower, else the normal price. */
export function pagePrice(normal: number, offerPrice: number | null, endsAt: Date | null, now = new Date()): number {
  return offerActive(offerPrice, endsAt, now) && offerPrice! < normal ? offerPrice! : normal
}

/** "Rahim Uddin Ahmed" → first "Rahim", last "Uddin Ahmed"; one word → last name empty. */
export function splitName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean)
  return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") }
}

const BD_MOBILE = /^(?:\+?88)?01[3-9]\d{8}$/

/** A Bangladeshi mobile number as 01XXXXXXXXX, or null when it isn't one. */
export function bdMobile(raw: string): string | null {
  const s = raw.replace(/[\s()-]/g, "")
  return BD_MOBILE.test(s) ? s.replace(/^\+?88/, "") : null
}

/** Orders per 100 visits, one decimal (null before anyone visited). */
export function conversion(views: number, orders: number): number | null {
  if (views <= 0) return null
  return Math.round((orders / views) * 1000) / 10
}

/** Landing page addresses: lowercase letters, numbers and dashes. */
export const LANDING_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
