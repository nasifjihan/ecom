/**
 * FESTIVAL CALENDAR RULES — Bangladesh's shopping seasons, pure and tested.
 *
 * A festival has its own days (startsOn–endsOn) and a sale window (saleFrom–saleTo), usually
 * starting before it: Eid shopping happens in Ramadan. Dates are "YYYY-MM-DD" days in Dhaka time.
 *
 * Fixed-date days (21 February, Pohela Boishakh, Victory Day …) are worked out for any year.
 * Eid and Ramadan follow the moon and Durga Puja the Hindu lunar calendar: those come from a
 * table of estimates, marked as such, for staff to correct once the dates are announced.
 */

export type Day = string // "YYYY-MM-DD"

const DHAKA_OFFSET = "+06:00"

const pad = (n: number) => String(n).padStart(2, "0")
const ymd = (y: number, m: number, d: number): Day => `${y}-${pad(m)}-${pad(d)}`

/** `day` moved by n days. */
export function addDays(day: Day, n: number): Day {
  const d = new Date(`${day}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Whole days from a to b (b − a). */
export function daysBetween(a: Day, b: Day): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000)
}

/** Today in Dhaka. */
export function dhakaToday(now = new Date()): Day {
  return new Date(now.getTime() + 6 * 3_600_000).toISOString().slice(0, 10)
}

/** The first and last moment of a Dhaka day. */
export const dhakaStart = (day: Day) => new Date(`${day}T00:00:00${DHAKA_OFFSET}`)
export const dhakaEnd = (day: Day) => new Date(`${day}T23:59:59${DHAKA_OFFSET}`)

/** A Date saved as a Postgres `date` (midnight UTC) back to its day. */
export const toDay = (d: Date): Day => d.toISOString().slice(0, 10)
/** A day as the Date Prisma writes to a `date` column. */
export const fromDay = (day: Day) => new Date(`${day}T00:00:00Z`)

/** The n-th given weekday (0 = Sunday) of a month. */
function nthWeekday(year: number, month: number, weekday: number, n: number): Day {
  const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay()
  return ymd(year, month, 1 + ((weekday - first + 7) % 7) + (n - 1) * 7)
}

// ---------------------------------------------------------------- presets

export interface PresetDef {
  key: string
  name: string
  /** How many days the festival itself lasts. */
  days: number
  /** The sale starts this many days before the festival … */
  saleBefore: number
  /** … and ends this many days after its last day. */
  saleAfter: number
  /** Email a reminder this many days before the sale starts. */
  remindDays: number
  /** What to get ready, on top of the usual list. */
  extraTasks?: string[]
  /** Fixed or worked-out day, or null when it comes from the estimates table. */
  date: ((year: number) => Day) | null
}

export const PRESETS: PresetDef[] = [
  {
    key: "ramadan",
    name: "Ramadan begins",
    days: 1,
    saleBefore: 7,
    saleAfter: 7,
    remindDays: 21,
    extraTasks: ["Iftar and prayer items on the homepage"],
    date: null,
  },
  {
    key: "eid_ul_fitr",
    name: "Eid-ul-Fitr",
    days: 3,
    saleBefore: 25,
    saleAfter: 0,
    remindDays: 30,
    extraTasks: ["Last order date for delivery before Eid on the site", "Plan courier pickups for the last week"],
    date: null,
  },
  {
    key: "eid_ul_adha",
    name: "Eid-ul-Adha",
    days: 3,
    saleBefore: 14,
    saleAfter: 0,
    remindDays: 21,
    extraTasks: ["Last order date for delivery before Eid on the site"],
    date: null,
  },
  {
    key: "durga_puja",
    name: "Durga Puja",
    days: 5,
    saleBefore: 14,
    saleAfter: 0,
    remindDays: 21,
    date: null,
  },
  { key: "pohela_falgun", name: "Pohela Falgun & Valentine's Day", days: 1, saleBefore: 7, saleAfter: 0, remindDays: 14, date: (y) => ymd(y, 2, 14) },
  { key: "ekushey", name: "International Mother Language Day (21 February)", days: 1, saleBefore: 3, saleAfter: 0, remindDays: 10, date: (y) => ymd(y, 2, 21) },
  { key: "independence_day", name: "Independence Day", days: 1, saleBefore: 3, saleAfter: 0, remindDays: 10, date: (y) => ymd(y, 3, 26) },
  {
    key: "pohela_boishakh",
    name: "Pohela Boishakh (Bangla New Year)",
    days: 1,
    saleBefore: 10,
    saleAfter: 0,
    remindDays: 21,
    extraTasks: ["Red-and-white collection on the homepage"],
    date: (y) => ymd(y, 4, 14),
  },
  { key: "mothers_day", name: "Mother's Day", days: 1, saleBefore: 7, saleAfter: 0, remindDays: 14, date: (y) => nthWeekday(y, 5, 0, 2) },
  { key: "fathers_day", name: "Father's Day", days: 1, saleBefore: 7, saleAfter: 0, remindDays: 14, date: (y) => nthWeekday(y, 6, 0, 3) },
  { key: "sale_11_11", name: "11.11 sale day", days: 1, saleBefore: 0, saleAfter: 0, remindDays: 14, date: (y) => ymd(y, 11, 11) },
  {
    key: "black_friday",
    name: "Black Friday",
    days: 1,
    saleBefore: 0,
    saleAfter: 3,
    remindDays: 14,
    date: (y) => addDays(nthWeekday(y, 11, 4, 4), 1),
  },
  { key: "victory_day", name: "Victory Day", days: 1, saleBefore: 3, saleAfter: 0, remindDays: 10, date: (y) => ymd(y, 12, 16) },
  { key: "christmas", name: "Christmas (Boro Din)", days: 1, saleBefore: 7, saleAfter: 0, remindDays: 14, date: (y) => ymd(y, 12, 25) },
]

/**
 * First day of the moon-sighted and lunar festivals, as expected in Bangladesh. Estimates:
 * the real day is announced close to the date and is often a day later.
 */
export const ESTIMATES: Record<number, Partial<Record<string, Day>>> = {
  2025: { ramadan: "2025-03-02", eid_ul_fitr: "2025-03-31", eid_ul_adha: "2025-06-07", durga_puja: "2025-09-28" },
  2026: { ramadan: "2026-02-19", eid_ul_fitr: "2026-03-21", eid_ul_adha: "2026-05-27", durga_puja: "2026-10-17" },
  2027: { ramadan: "2027-02-09", eid_ul_fitr: "2027-03-11", eid_ul_adha: "2027-05-17", durga_puja: "2027-10-06" },
}

export const DEFAULT_TASKS = [
  "Decide the offers and discounts",
  "Order enough stock of the best sellers",
  "Make the banner and homepage section",
  "Set up the sale, coupon or landing page",
  "Plan posts and SMS to customers",
]

export interface FestivalDates {
  key: string
  name: string
  startsOn: Day
  endsOn: Day
  saleFrom: Day
  saleTo: Day
  remindDays: number
  dateIsEstimate: boolean
  tasks: string[]
}

/** The preset festivals of a year, and the ones left out because their dates aren't known. */
export function presetsFor(year: number): { festivals: FestivalDates[]; unknown: string[] } {
  const festivals: FestivalDates[] = []
  const unknown: string[] = []
  for (const p of PRESETS) {
    const start = p.date ? p.date(year) : ESTIMATES[year]?.[p.key]
    if (!start) {
      unknown.push(p.name)
      continue
    }
    const endsOn = addDays(start, p.days - 1)
    festivals.push({
      key: p.key,
      name: p.name,
      startsOn: start,
      endsOn,
      saleFrom: addDays(start, -p.saleBefore),
      saleTo: addDays(endsOn, p.saleAfter),
      remindDays: p.remindDays,
      dateIsEstimate: !p.date,
      tasks: [...DEFAULT_TASKS, ...(p.extraTasks ?? [])],
    })
  }
  festivals.sort((a, b) => a.startsOn.localeCompare(b.startsOn))
  return { festivals, unknown }
}

/**
 * The same festival a year earlier, for comparing sales: the preset's dates that year when known
 * (moon festivals move about 11 days a year), else the same days a year back.
 */
export function lastYearWindow(f: { key: string | null; startsOn: Day; saleFrom: Day; saleTo: Day }): { from: Day; to: Day } {
  const year = Number(f.startsOn.slice(0, 4))
  const prev = f.key ? presetsFor(year - 1).festivals.find((p) => p.key === f.key) : undefined
  if (prev) {
    // Keep this year's sale length and lead, placed around last year's festival.
    const lead = daysBetween(f.saleFrom, f.startsOn)
    const length = daysBetween(f.saleFrom, f.saleTo)
    const from = addDays(prev.startsOn, -lead)
    return { from, to: addDays(from, length) }
  }
  const back = (d: Day) => {
    const [y, m, day] = d.split("-").map(Number) as [number, number, number]
    // 29 February has no match a year back: use the 28th.
    return m === 2 && day === 29 ? ymd(y - 1, 2, 28) : ymd(y - 1, m, day)
  }
  return { from: back(f.saleFrom), to: back(f.saleTo) }
}

// ---------------------------------------------------------------- where a festival stands

export type Phase = "later" | "prepare" | "on_sale" | "over"

/**
 * later: before the reminder; prepare: reminder sent, sale not started; on_sale: in the sale
 * window or the festival; over: both have ended.
 */
export function phase(f: { saleFrom: Day; saleTo: Day; endsOn: Day; remindDays: number }, today: Day): Phase {
  const last = f.endsOn > f.saleTo ? f.endsOn : f.saleTo
  if (today > last) return "over"
  if (today >= f.saleFrom) return "on_sale"
  if (today >= addDays(f.saleFrom, -f.remindDays)) return "prepare"
  return "later"
}

/** Should the reminder email go out today? Once, from the reminder day until the sale ends. */
export function reminderDue(f: { saleFrom: Day; saleTo: Day; remindDays: number; remindedAt: Date | null }, today: Day): boolean {
  return !f.remindedAt && today >= addDays(f.saleFrom, -f.remindDays) && today <= f.saleTo
}

// ---------------------------------------------------------------- linked campaigns

export type Coverage = "covers" | "partial" | "outside" | "always"

/**
 * How a campaign's dates line up with the sale window. No start and no end means it's always
 * on; a missing start or end counts as open on that side.
 */
export function coverage(item: { startsAt: Date | null; endsAt: Date | null }, saleFrom: Day, saleTo: Day): Coverage {
  if (!item.startsAt && !item.endsAt) return "always"
  const from = dhakaStart(saleFrom).getTime()
  const to = dhakaEnd(saleTo).getTime()
  const s = item.startsAt?.getTime() ?? -Infinity
  const e = item.endsAt?.getTime() ?? Infinity
  if (e < from || s > to) return "outside"
  return s <= from && e >= to ? "covers" : "partial"
}

// ---------------------------------------------------------------- checklist

export interface Task {
  id: string
  text: string
  done: boolean
}

export const tasksFrom = (texts: string[]): Task[] => texts.map((text, i) => ({ id: `t${i + 1}`, text, done: false }))

export function progress(tasks: Task[]): { done: number; total: number } {
  return { done: tasks.filter((t) => t.done).length, total: tasks.length }
}

/** Checks a festival's dates: the festival and sale make sense, and the sale reaches the festival. */
export function datesProblem(d: { startsOn: Day; endsOn: Day; saleFrom: Day; saleTo: Day }): string | null {
  if (d.endsOn < d.startsOn) return "The festival ends before it starts"
  if (d.saleTo < d.saleFrom) return "The sale ends before it starts"
  if (daysBetween(d.startsOn, d.endsOn) > 60) return "A festival can last at most 60 days"
  if (daysBetween(d.saleFrom, d.saleTo) > 120) return "A sale can run at most 120 days"
  if (d.saleFrom > d.endsOn || d.saleTo < addDays(d.startsOn, -60)) return "The sale should run near the festival"
  return null
}
