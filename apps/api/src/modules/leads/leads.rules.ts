/**
 * CRM LEADS: rules with no database, so they can be tested on their own.
 * A lead is someone who asked (a Facebook comment, an Instagram DM, a call) and hasn't ordered.
 */

export const LEAD_CHANNELS = ["facebook", "instagram", "whatsapp", "messenger", "tiktok", "phone", "walk_in", "website", "referral", "other"] as const
export type LeadChannel = (typeof LEAD_CHANNELS)[number]

export const LEAD_STATUSES = ["new", "contacted", "interested", "won", "lost"] as const
export type LeadStatus = (typeof LEAD_STATUSES)[number]

export const OPEN_STATUSES: readonly LeadStatus[] = ["new", "contacted", "interested"]
export const isOpen = (status: string) => (OPEN_STATUSES as readonly string[]).includes(status)

export const NOTE_KINDS = ["note", "call", "message"] as const

/** Where a customer made from a lead "came from" (the customer list has fewer choices). */
export function customerSource(channel: string): "phone" | "facebook" | "instagram" | "whatsapp" | "walk_in" | "other" {
  switch (channel) {
    case "facebook":
    case "messenger":
      return "facebook"
    case "instagram":
    case "whatsapp":
    case "phone":
    case "walk_in":
      return channel
    default:
      return "other"
  }
}

/** The order source for an order made from a lead. */
export function orderSource(channel: string): "website" | "phone" | "facebook" | "instagram" | "whatsapp" | "messenger" | "walk_in" | "other" {
  switch (channel) {
    case "facebook":
    case "instagram":
    case "whatsapp":
    case "messenger":
    case "phone":
    case "walk_in":
    case "website":
      return channel
    default:
      return "other"
  }
}

/**
 * A handle as typed or pasted: profile links become the name in them
 * ("https://www.facebook.com/rahima.khatun/" → "rahima.khatun"), "@" is kept off, spaces trimmed.
 */
export function cleanHandle(raw: string | null | undefined): string | null {
  let h = (raw ?? "").trim()
  if (!h) return null
  const link = /^(?:https?:\/\/)?(?:www\.|m\.|web\.)?(?:facebook\.com|fb\.com|instagram\.com|tiktok\.com|wa\.me)\/(?:profile\.php\?id=)?@?([^/?#]+)/i.exec(h)
  if (link?.[1]) h = decodeURIComponent(link[1])
  h = h.replace(/^@+/, "").trim()
  return h ? h.slice(0, 100) : null
}

/** Tags: lower case, single spaces, no repeats, at most 10 of up to 30 characters. */
export function cleanTags(tags: readonly string[] | null | undefined): string[] {
  const out: string[] = []
  for (const t of tags ?? []) {
    const v = t.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 30)
    if (v && !out.includes(v)) out.push(v)
    if (out.length === 10) break
  }
  return out
}

export type FollowUp = "none" | "overdue" | "today" | "later"

/** Where a follow-up date stands, by the shop's calendar day (Bangladesh, UTC+6). */
export function followUpState(at: Date | null | undefined, now: Date, offsetMinutes = 360): FollowUp {
  if (!at) return "none"
  const day = (d: Date) => Math.floor((d.getTime() + offsetMinutes * 60_000) / 86_400_000)
  if (at.getTime() < now.getTime() && day(at) < day(now)) return "overdue"
  if (day(at) === day(now)) return "today"
  return at.getTime() < now.getTime() ? "overdue" : "later"
}

/** The start and end of "today" in the shop's time zone, as instants. */
export function todayRange(now: Date, offsetMinutes = 360): { start: Date; end: Date } {
  const ms = offsetMinutes * 60_000
  const start = Math.floor((now.getTime() + ms) / 86_400_000) * 86_400_000 - ms
  return { start: new Date(start), end: new Date(start + 86_400_000) }
}

/** Why a status change isn't allowed, or null. */
export function statusChangeProblem(from: string, to: string, lostReason: string | null | undefined): string | null {
  if (from === to) return "The lead already has this status"
  if (to === "lost" && !(lostReason ?? "").trim()) return "Say why the lead was lost"
  if (to === "won") return "A lead is won by making an order for it"
  return null
}

const STATUS_WORDS: Record<string, string> = { new: "New", contacted: "Contacted", interested: "Interested", won: "Won", lost: "Lost" }
export const statusWord = (s: string) => STATUS_WORDS[s] ?? s
