/**
 * DELIVERY SLOTS — which delivery windows a customer can still pick. Pure functions; times are
 * worked out in the store's time zone (Asia/Dhaka by default), days are "YYYY-MM-DD".
 */

export interface SlotRow {
  id: string
  name: string
  startTime: string
  endTime: string
  cutoffMinutes: number
  fee: number
  capacity: number | null
  weekdays: number[]
}

export interface SlotChoice {
  id: string
  name: string
  /** "17:00–21:00" */
  window: string
  fee: number
  /** Places left that day (null: no limit). */
  left: number | null
  available: boolean
  /** Why it can't be picked: "full" or "closed" (past its order-by time). */
  reason: "full" | "closed" | null
}

export interface SlotDay {
  date: string
  weekday: number
  slots: SlotChoice[]
}

const HM = /^([01]\d|2[0-3]):([0-5]\d)$/

/** "17:30" → 1050 minutes after midnight; null when it isn't a 24-hour time. */
export function minutesOf(hm: string): number | null {
  const m = HM.exec(hm)
  return m ? Number(m[1]) * 60 + Number(m[2]) : null
}

/** What's wrong with a slot's times, or null. */
export function slotTimesProblem(startTime: string, endTime: string, cutoffMinutes: number): string | null {
  const start = minutesOf(startTime)
  const end = minutesOf(endTime)
  if (start === null || end === null) return "Times are 24-hour, e.g. 10:00 or 17:30"
  if (end <= start) return "The window must end after it starts"
  if (!Number.isInteger(cutoffMinutes) || cutoffMinutes < 0 || cutoffMinutes > 7 * 24 * 60) return "Orders close 0 minutes to 7 days before the window"
  return null
}

/** Today's date and the minutes since midnight in a time zone. */
export function localNow(now: Date, timeZone: string): { day: string; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00"
  return { day: `${get("year")}-${get("month")}-${get("day")}`, minutes: Number(get("hour")) * 60 + Number(get("minute")) }
}

/** The day `n` days after a "YYYY-MM-DD" day. */
export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export const weekdayOf = (day: string) => new Date(`${day}T00:00:00Z`).getUTCDay()

const VALID_DAY = /^\d{4}-\d{2}-\d{2}$/
export const isDay = (v: string) => VALID_DAY.test(v) && !Number.isNaN(new Date(`${v}T00:00:00Z`).getTime()) && new Date(`${v}T00:00:00Z`).toISOString().startsWith(v)

/**
 * The days customers can pick from (today and the next `daysAhead - 1` days), each with the slots
 * that run that weekday. A slot is closed once its order-by time has passed and full when `taken`
 * (orders by "slotId|day") reaches its capacity. Days the store is closed, or with no slots, are left out.
 */
export function slotDays(input: {
  slots: SlotRow[]
  now: Date
  timeZone: string
  daysAhead: number
  closedDates?: string[]
  taken?: Map<string, number>
}): SlotDay[] {
  const { day: today, minutes: nowMin } = localNow(input.now, input.timeZone)
  const closed = new Set(input.closedDates ?? [])
  const days: SlotDay[] = []
  for (let i = 0; i < Math.max(1, Math.min(input.daysAhead, 31)); i++) {
    const date = addDays(today, i)
    if (closed.has(date)) continue
    const weekday = weekdayOf(date)
    const slots = input.slots
      .filter((s) => s.weekdays.includes(weekday))
      .sort((a, b) => (minutesOf(a.startTime) ?? 0) - (minutesOf(b.startTime) ?? 0))
      .map((s): SlotChoice => {
        const start = minutesOf(s.startTime) ?? 0
        // Minutes from now until orders close, counting whole days ahead.
        const closesIn = i * 24 * 60 + start - s.cutoffMinutes - nowMin
        const taken = input.taken?.get(`${s.id}|${date}`) ?? 0
        const left = s.capacity === null ? null : Math.max(0, s.capacity - taken)
        const reason = closesIn < 0 ? "closed" : left === 0 ? "full" : null
        return { id: s.id, name: s.name, window: `${s.startTime}–${s.endTime}`, fee: s.fee, left, available: reason === null, reason }
      })
    if (slots.length) days.push({ date, weekday, slots })
  }
  return days
}

/** The picked slot if it can still be booked, or why not. */
export function pickSlot(days: SlotDay[], slotId: string, date: string): { slot: SlotChoice } | { problem: string } {
  const day = days.find((d) => d.date === date)
  const slot = day?.slots.find((s) => s.id === slotId)
  if (!slot) return { problem: "That delivery time isn't offered on that day. Please pick another." }
  if (slot.reason === "full") return { problem: "That delivery time is fully booked. Please pick another." }
  if (slot.reason === "closed") return { problem: "Orders for that delivery time have closed. Please pick another." }
  return { slot }
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

/** "Thu 2 Oct, Evening 17:00–21:00" — kept on the order. */
export function slotLabel(date: string, slot: { name: string; window: string }): string {
  const d = new Date(`${date}T00:00:00Z`)
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}, ${slot.name} ${slot.window}`
}
