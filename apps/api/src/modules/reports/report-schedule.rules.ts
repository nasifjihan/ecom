/**
 * REPORT SCHEDULE RULES — no I/O (table-tested in tests/unit/report-schedules.test.ts).
 *
 * - A schedule sends at `sendHour` (shop time) every day, on one weekday, or on one day of the
 *   month (1–28, so every month has it).
 * - Each sending covers a period counted back from the day it's sent: yesterday, the 7 days before,
 *   last week (Monday–Sunday), last month, or this month so far. The day it's sent is never in it,
 *   so the figures are for whole days.
 * - After FAILURE_LIMIT failures in a row the schedule switches itself off.
 */
import { addDays, dayIn, dayStart } from "./reports.rules"

export const REPORT_KEYS = ["sales", "products", "discounts", "customers", "couriers", "returns", "tax", "stock"] as const
export type ReportKey = (typeof REPORT_KEYS)[number]

export const REPORT_LABELS: Record<ReportKey, string> = {
  sales: "Sales & profit",
  products: "Products",
  discounts: "Coupons & promotions",
  customers: "Customers",
  couriers: "Couriers & COD",
  returns: "Returns & refunds",
  tax: "Tax",
  stock: "Stock value",
}

export const FREQUENCIES = ["daily", "weekly", "monthly"] as const
export type Frequency = (typeof FREQUENCIES)[number]

export const PERIODS = ["yesterday", "last_7_days", "last_week", "last_month", "month_to_date"] as const
export type Period = (typeof PERIODS)[number]

export const PERIOD_LABELS: Record<Period, string> = {
  yesterday: "Yesterday",
  last_7_days: "The 7 days before",
  last_week: "Last week (Mon–Sun)",
  last_month: "Last month",
  month_to_date: "This month so far",
}

export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

export const FAILURE_LIMIT = 3
export const MAX_EMAILS = 10
/** Rows each PDF table shows before pointing at the admin for the rest. */
export const PDF_ROW_CAP = 50

export interface ScheduleTiming {
  frequency: Frequency
  /** 1 = Monday … 7 = Sunday. */
  weekday?: number | null
  /** 1–28. */
  monthDay?: number | null
  sendHour: number
}

/** 1 = Monday … 7 = Sunday, for a YYYY-MM-DD day. */
export const isoWeekday = (day: string) => {
  const dow = new Date(`${day}T00:00:00Z`).getUTCDay()
  return dow === 0 ? 7 : dow
}

const sendsOn = (t: ScheduleTiming, day: string) => {
  if (t.frequency === "weekly") return isoWeekday(day) === t.weekday
  if (t.frequency === "monthly") return Number(day.slice(8, 10)) === t.monthDay
  return true
}

/** The first sending time after `after`, as a UTC instant. */
export function nextRunAt(t: ScheduleTiming, after: Date, tz: string): Date {
  const first = dayIn(tz, after)
  for (let i = 0; i <= 62; i++) {
    const day = addDays(first, i)
    if (!sendsOn(t, day)) continue
    const at = new Date(dayStart(tz, day).getTime() + t.sendHour * 3_600_000)
    if (at.getTime() > after.getTime()) return at
  }
  // Unreachable for valid timings (every month has days 1–28); keep the schedule moving anyway.
  return new Date(after.getTime() + 86_400_000)
}

const monthStart = (day: string) => `${day.slice(0, 7)}-01`

/** The days a sending on `runDay` covers (both included). */
export function periodRange(period: Period, runDay: string): { from: string; to: string } {
  const yesterday = addDays(runDay, -1)
  switch (period) {
    case "yesterday":
      return { from: yesterday, to: yesterday }
    case "last_7_days":
      return { from: addDays(runDay, -7), to: yesterday }
    case "last_week": {
      const monday = addDays(runDay, -(isoWeekday(runDay) - 1))
      return { from: addDays(monday, -7), to: addDays(monday, -1) }
    }
    case "last_month": {
      const end = addDays(monthStart(runDay), -1)
      return { from: monthStart(end), to: end }
    }
    case "month_to_date":
      // Sent on the 1st, "so far" would be empty: it covers the month just ended instead.
      return { from: monthStart(yesterday), to: yesterday }
  }
}

/** "Every Monday at 08:00", "Daily at 21:00", "On the 1st of each month at 09:00". */
export function timingText(t: ScheduleTiming): string {
  const at = `at ${String(t.sendHour).padStart(2, "0")}:00`
  if (t.frequency === "weekly") return `Every ${WEEKDAYS[(t.weekday ?? 1) - 1]} ${at}`
  if (t.frequency === "monthly") return `On the ${ordinal(t.monthDay ?? 1)} of each month ${at}`
  return `Daily ${at}`
}

export function ordinal(n: number): string {
  const s = n % 100 >= 11 && n % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th"
  return `${n}${s}`
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export interface ScheduleShape extends ScheduleTiming {
  name: string
  reports: string[]
  period: string
  staffIds: unknown[]
  emails: string[]
}

/** What's wrong with a schedule, or null. */
export function scheduleProblem(s: ScheduleShape): string | null {
  if (!s.name.trim()) return "Give the schedule a name"
  if (!s.reports.length) return "Choose at least one report"
  if (s.reports.some((r) => !(REPORT_KEYS as readonly string[]).includes(r))) return "Unknown report"
  if (!(FREQUENCIES as readonly string[]).includes(s.frequency)) return "Choose how often it's sent"
  if (!(PERIODS as readonly string[]).includes(s.period)) return "Choose which days it covers"
  if (!Number.isInteger(s.sendHour) || s.sendHour < 0 || s.sendHour > 23) return "Choose an hour from 0 to 23"
  if (s.frequency === "weekly" && !(Number.isInteger(s.weekday) && s.weekday! >= 1 && s.weekday! <= 7)) return "Choose the day of the week"
  if (s.frequency === "monthly" && !(Number.isInteger(s.monthDay) && s.monthDay! >= 1 && s.monthDay! <= 28))
    return "Choose a day of the month from 1 to 28"
  if (s.emails.length > MAX_EMAILS) return `At most ${MAX_EMAILS} other addresses`
  const bad = s.emails.find((e) => !EMAIL.test(e))
  if (bad) return `"${bad}" doesn't look like an email address`
  if (!s.staffIds.length && !s.emails.length) return "Choose who gets it"
  return null
}

/** Addresses trimmed, lower-cased and without repeats. */
export const cleanEmails = (list: string[]) => [...new Set(list.map((e) => e.trim().toLowerCase()).filter(Boolean))]

/**
 * Whether a staff member may receive figures for `storefrontId` (null: the whole store).
 * Staff limited to some storefronts only get reports for one of theirs.
 */
export function staffMayReceive(staffStorefrontIds: bigint[], storefrontId: bigint | null): boolean {
  if (!staffStorefrontIds.length) return true
  return storefrontId !== null && staffStorefrontIds.includes(storefrontId)
}

/** After a run: the failure count, and whether the schedule switches itself off. */
export function afterRun(failures: number, ok: boolean): { failures: number; disable: boolean } {
  if (ok) return { failures: 0, disable: false }
  const next = failures + 1
  return { failures: next, disable: next >= FAILURE_LIMIT }
}
