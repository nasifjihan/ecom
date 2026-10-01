/**
 * CUSTOMER RULES — no I/O. Banned customers can't sign in or order (a guest checkout with their
 * phone or email counts as them). Customers staff add by hand say where they came from.
 */
import { randomBytes } from "node:crypto"

/** Statuses that stop signing in and ordering (older rows are upper case). */
export const isBanned = (status: string | null | undefined) => ["banned", "suspended"].includes((status ?? "").toLowerCase())

export const CUSTOMER_SOURCES = ["phone", "facebook", "instagram", "whatsapp", "walk_in", "other"] as const
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
