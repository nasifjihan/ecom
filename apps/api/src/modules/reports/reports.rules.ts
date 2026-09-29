/**
 * REPORT RULES — no I/O (table-tested in tests/unit/reports.test.ts).
 *
 * - Dates are the shop's calendar days (store time zone, default Asia/Dhaka): "from" and "to" are
 *   both included, and turned into a UTC instant range [start, end) for the database.
 * - Charts group by day up to two months, by week (Monday) up to six months, else by month;
 *   every period in the range gets a row, so gaps show as zero.
 * - Profit: net sales = items − discounts − refunds (shipping and tax aren't the shop's income);
 *   gross profit = net sales − cost of the units kept (sold − refunded) at their cost when sold.
 */

export type Bucket = "day" | "week" | "month"

export interface DayRange {
  /** YYYY-MM-DD, shop time, inclusive. */
  fromDay: string
  toDay: string
  /** UTC instants for the query: start of fromDay and start of the day after toDay. */
  start: Date
  end: Date
  days: number
}

const DAY_MS = 86_400_000
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/
export const MAX_RANGE_DAYS = 3 * 366

/** Minutes the zone is ahead of UTC at that instant (Asia/Dhaka → 360). */
export function zoneOffsetMinutes(tz: string, at: Date): number {
  const name =
    new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "longOffset" })
      .formatToParts(at)
      .find((p) => p.type === "timeZoneName")?.value ?? "GMT"
  const m = /GMT([+-])(\d{2}):?(\d{2})?/.exec(name)
  if (!m) return 0
  return (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0))
}

/** The shop's calendar day (YYYY-MM-DD) at an instant. */
export function dayIn(tz: string, at: Date): string {
  return new Date(at.getTime() + zoneOffsetMinutes(tz, at) * 60_000).toISOString().slice(0, 10)
}

/** The UTC instant at which that calendar day starts in the zone. */
export function dayStart(tz: string, day: string): Date {
  const utcMidnight = Date.parse(`${day}T00:00:00Z`)
  // Offset at (roughly) that local midnight; re-check once for days where the offset changes.
  let at = utcMidnight - zoneOffsetMinutes(tz, new Date(utcMidnight)) * 60_000
  at = utcMidnight - zoneOffsetMinutes(tz, new Date(at)) * 60_000
  return new Date(at)
}

export const addDays = (day: string, n: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10)

const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS)

const validDay = (d: string) =>
  ISO_DAY.test(d) && new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10) === d

/**
 * The range asked for, or the last 30 days (today included) when a side is missing.
 * A missing "from" is 29 days before "to"; a missing "to" is today.
 */
export function resolveRange(
  q: { from?: string; to?: string },
  now: Date,
  tz: string,
): DayRange | { error: string } {
  if (q.from && !validDay(q.from)) return { error: "Start date isn't a real date" }
  if (q.to && !validDay(q.to)) return { error: "End date isn't a real date" }
  const toDay = q.to ?? dayIn(tz, now)
  const fromDay = q.from ?? addDays(toDay, -29)
  const days = daysBetween(fromDay, toDay) + 1
  if (days < 1) return { error: "The start date is after the end date" }
  if (days > MAX_RANGE_DAYS) return { error: "Choose at most three years" }
  return {
    fromDay,
    toDay,
    start: dayStart(tz, fromDay),
    end: dayStart(tz, addDays(toDay, 1)),
    days,
  }
}

/** The same number of days just before, for "vs previous period". */
export function previousRange(r: DayRange, tz: string): DayRange {
  const toDay = addDays(r.fromDay, -1)
  const fromDay = addDays(toDay, -(r.days - 1))
  return { fromDay, toDay, start: dayStart(tz, fromDay), end: r.start, days: r.days }
}

export function pickBucket(days: number): Bucket {
  if (days <= 62) return "day"
  if (days <= 186) return "week"
  return "month"
}

/** The period a day falls in: the day, its week's Monday, or the 1st of its month. */
export function bucketOf(day: string, bucket: Bucket): string {
  if (bucket === "day") return day
  if (bucket === "month") return `${day.slice(0, 7)}-01`
  const dow = new Date(`${day}T00:00:00Z`).getUTCDay() // 0 = Sunday
  return addDays(day, -((dow + 6) % 7))
}

/** Every period from the range's first to its last, in order. */
export function bucketKeys(r: Pick<DayRange, "fromDay" | "toDay">, bucket: Bucket): string[] {
  const keys: string[] = []
  let k = bucketOf(r.fromDay, bucket)
  const last = bucketOf(r.toDay, bucket)
  while (k <= last) {
    keys.push(k)
    if (bucket === "day") k = addDays(k, 1)
    else if (bucket === "week") k = addDays(k, 7)
    else {
      const [y, m] = k.split("-").map(Number) as [number, number]
      k = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`
    }
  }
  return keys
}

export const round2 = (n: number) => Math.round(n * 100) / 100

/** Share of a whole, as a percentage with one decimal; null when the whole is 0. */
export function pct(part: number, whole: number): number | null {
  if (!whole) return null
  return Math.round((part / whole) * 1000) / 10
}

/** % change from the previous value; null when there was nothing before. */
export function change(current: number, previous: number): number | null {
  if (!previous) return null
  return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10
}

export interface SalesFigures {
  orders: number
  itemsSubtotal: number
  discounts: number
  shipping: number
  tax: number
  refunds: number
  /** Cost of units kept (sold − refunded) that have a cost. */
  cogs: number
  units: number
  unitsWithCost: number
}

export function profit(f: SalesFigures) {
  const netSales = round2(f.itemsSubtotal - f.discounts - f.refunds)
  const grossProfit = round2(netSales - f.cogs)
  return {
    netSales,
    grossProfit,
    /** Gross profit as % of net sales. */
    margin: pct(grossProfit, netSales),
    averageOrder: f.orders
      ? round2((f.itemsSubtotal - f.discounts + f.shipping + f.tax) / f.orders)
      : 0,
    /** Share of units sold that had a cost price. Below 100, profit is overstated (missing costs count as 0). */
    costCoverage: pct(f.unitsWithCost, f.units),
  }
}

/** Orders counted by a report: "placed" = everything not cancelled or failed; "delivered" = delivered or completed. */
export const REPORT_BASES = ["placed", "delivered"] as const
export type ReportBasis = (typeof REPORT_BASES)[number]
export const statusesFor = (basis: ReportBasis): string[] =>
  basis === "delivered"
    ? ["DELIVERED", "COMPLETED"]
    : [
        "PENDING",
        "PROCESSING",
        "ON_HOLD",
        "SHIPPED",
        "OUT_FOR_DELIVERY",
        "DELIVERED",
        "COMPLETED",
        "REFUNDED",
      ]
