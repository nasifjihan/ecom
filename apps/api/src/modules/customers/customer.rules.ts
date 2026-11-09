/**
 * CUSTOMER RULES — no I/O. Banned customers can't sign in or order (a guest checkout with their
 * phone or email counts as them). Customers staff add by hand say where they came from.
 */
import { randomBytes } from "node:crypto"

/** Statuses that stop signing in and ordering (older rows are upper case). */
export const isBanned = (status: string | null | undefined) => ["banned", "suspended"].includes((status ?? "").toLowerCase())

export const CUSTOMER_SOURCES = ["phone", "facebook", "instagram", "whatsapp", "messenger", "tiktok", "daraz", "website", "referral", "walk_in", "other"] as const
export type CustomerSource = (typeof CUSTOMER_SOURCES)[number]

export const BANNED_MESSAGE = "Sorry, we can't take orders from this account. Please contact the shop."

// ---------------------------------------------------------------- newsletter

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** Trimmed, lower-case email, or null when it isn't one. */
export function newsletterEmail(v: string | null | undefined): string | null {
  const e = (v ?? "").trim().toLowerCase()
  return e.length <= 254 && EMAIL.test(e) ? e : null
}

export const NEWSLETTER_SOURCES = ["footer", "checkout", "signup", "admin", "import"] as const
export type NewsletterSource = (typeof NEWSLETTER_SOURCES)[number]

/**
 * Whether a sign-up puts an address on the list. Someone who unsubscribed comes back only when
 * they ask themselves (footer, checkout, sign-up); staff can't add them back.
 */
export function maySubscribe(current: { status: string } | null, source: NewsletterSource): { ok: true } | { ok: false; reason: string } {
  if (!current || current.status === "subscribed") return { ok: true }
  if (source === "admin" || source === "import") return { ok: false, reason: "They unsubscribed. Only they can sign up again." }
  return { ok: true }
}

/** Secret for the unsubscribe link. */
export const newsletterToken = () => randomBytes(18).toString("base64url")

/** "ay***@gmail.com" — shown after unsubscribing, without giving the address away. */
export function maskEmail(email: string): string {
  const [user = "", domain = ""] = email.split("@")
  return `${user.slice(0, 2)}***@${domain}`
}

/** One CSV cell. Cells starting with = + - @ are prefixed so spreadsheets don't run them. */
export function csvCell(v: string | null | undefined): string {
  let s = v ?? ""
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

// ------------------------------------------------------------------ names and profile links

export const SOCIAL_KEYS = ["facebook", "instagram", "whatsapp", "tiktok", "website"] as const
export type CustomerSocial = Partial<Record<(typeof SOCIAL_KEYS)[number], string>>

/** Profile links with the empty ones left out (null when there are none). */
export function cleanSocial(raw: CustomerSocial | null | undefined): CustomerSocial | null {
  const out: CustomerSocial = {}
  for (const k of SOCIAL_KEYS) {
    const v = raw?.[k]?.trim()
    if (v) out[k] = v
  }
  return Object.keys(out).length ? out : null
}

/** At most this many other names are kept per customer. */
export const MAX_OTHER_NAMES = 10

/**
 * Adds a name ordered with this customer's phone to their other names, unless it's their own name
 * or already there (ignoring case and spaces). Returns null when nothing changes.
 */
export function withOtherName(c: { firstName: string; lastName: string; otherNames: string[] }, name: string): string[] | null {
  const tidy = (s: string) => s.trim().replace(/\s+/g, " ")
  const key = (s: string) => tidy(s).toLowerCase()
  const n = tidy(name)
  if (!n || key(n) === key(`${c.firstName} ${c.lastName}`) || key(n) === key(c.firstName)) return null
  if (c.otherNames.some((o) => key(o) === key(n))) return null
  return [...c.otherNames, n].slice(-MAX_OTHER_NAMES)
}
