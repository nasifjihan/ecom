import { describe, expect, it } from "vitest"
import {
  addDays,
  bucketKeys,
  bucketOf,
  change,
  dayIn,
  dayStart,
  pct,
  pickBucket,
  previousRange,
  profit,
  resolveRange,
  statusesFor,
  zoneOffsetMinutes,
  type DayRange,
} from "../../src/modules/reports/reports.rules"

const TZ = "Asia/Dhaka"

describe("time zones", () => {
  it("knows Dhaka is 6 hours ahead", () => {
    expect(zoneOffsetMinutes(TZ, new Date("2026-09-28T00:00:00Z"))).toBe(360)
    expect(zoneOffsetMinutes("UTC", new Date("2026-09-28T00:00:00Z"))).toBe(0)
  })
  it("handles zones behind UTC and daylight saving", () => {
    expect(zoneOffsetMinutes("America/New_York", new Date("2026-01-15T12:00:00Z"))).toBe(-300)
    expect(zoneOffsetMinutes("America/New_York", new Date("2026-07-15T12:00:00Z"))).toBe(-240)
  })
  it.each([
    ["2026-09-27T17:59:00Z", "2026-09-27"],
    ["2026-09-27T18:00:00Z", "2026-09-28"], // midnight in Dhaka
    ["2026-12-31T20:00:00Z", "2027-01-01"],
  ])("%s is %s in Dhaka", (at, day) => {
    expect(dayIn(TZ, new Date(at))).toBe(day)
  })
  it("a Dhaka day starts at 18:00 UTC the day before", () => {
    expect(dayStart(TZ, "2026-09-28").toISOString()).toBe("2026-09-27T18:00:00.000Z")
    expect(dayStart("UTC", "2026-09-28").toISOString()).toBe("2026-09-28T00:00:00.000Z")
  })
  it("adds days across months and years", () => {
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01")
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01")
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28")
  })
})

describe("resolveRange", () => {
  const now = new Date("2026-09-28T05:00:00Z") // 11:00 in Dhaka

  it("defaults to the last 30 days including today", () => {
    const r = resolveRange({}, now, TZ) as DayRange
    expect(r.fromDay).toBe("2026-08-30")
    expect(r.toDay).toBe("2026-09-28")
    expect(r.days).toBe(30)
    expect(r.start.toISOString()).toBe("2026-08-29T18:00:00.000Z")
    expect(r.end.toISOString()).toBe("2026-09-28T18:00:00.000Z")
  })
  it("includes both ends", () => {
    const r = resolveRange({ from: "2026-09-01", to: "2026-09-01" }, now, TZ) as DayRange
    expect(r.days).toBe(1)
    expect(r.end.getTime() - r.start.getTime()).toBe(86_400_000)
  })
  it("uses 29 days before 'to' when only 'to' is given", () => {
    expect((resolveRange({ to: "2026-06-30" }, now, TZ) as DayRange).fromDay).toBe("2026-06-01")
  })
  it.each([
    [{ from: "2026-09-10", to: "2026-09-01" }, "after the end"],
    [{ from: "2026-02-30" }, "real date"],
    [{ to: "28/09/2026" }, "real date"],
    [{ from: "2020-01-01", to: "2026-01-01" }, "three years"],
  ])("refuses %j", (q, msg) => {
    const r = resolveRange(q, now, TZ)
    expect("error" in r && r.error).toContain(msg)
  })
  it("gives the previous period of the same length", () => {
    const r = resolveRange({ from: "2026-09-01", to: "2026-09-30" }, now, TZ) as DayRange
    const p = previousRange(r, TZ)
    expect([p.fromDay, p.toDay, p.days]).toEqual(["2026-08-02", "2026-08-31", 30])
    expect(p.end.getTime()).toBe(r.start.getTime())
  })
})

describe("buckets", () => {
  it.each([
    [1, "day"],
    [62, "day"],
    [63, "week"],
    [186, "week"],
    [187, "month"],
  ])("%i days group by %s", (days, b) => {
    expect(pickBucket(days)).toBe(b)
  })
  it.each([
    ["2026-09-28", "week", "2026-09-28"], // a Monday
    ["2026-09-27", "week", "2026-09-21"], // Sunday belongs to the week before
    ["2026-10-01", "week", "2026-09-28"],
    ["2026-09-17", "month", "2026-09-01"],
    ["2026-09-17", "day", "2026-09-17"],
  ] as const)("%s by %s is %s", (day, b, key) => {
    expect(bucketOf(day, b)).toBe(key)
  })
  it("lists every day, week or month in the range", () => {
    expect(bucketKeys({ fromDay: "2026-09-29", toDay: "2026-10-02" }, "day")).toEqual([
      "2026-09-29",
      "2026-09-30",
      "2026-10-01",
      "2026-10-02",
    ])
    expect(bucketKeys({ fromDay: "2026-09-02", toDay: "2026-09-21" }, "week")).toEqual([
      "2026-08-31",
      "2026-09-07",
      "2026-09-14",
      "2026-09-21",
    ])
    expect(bucketKeys({ fromDay: "2026-11-15", toDay: "2027-02-01" }, "month")).toEqual([
      "2026-11-01",
      "2026-12-01",
      "2027-01-01",
      "2027-02-01",
    ])
  })
})

describe("profit", () => {
  const base = {
    orders: 4,
    itemsSubtotal: 10_000,
    discounts: 500,
    shipping: 480,
    tax: 0,
    refunds: 1_500,
    cogs: 5_000,
    units: 10,
    unitsWithCost: 8,
  }
  it("takes discounts and refunds off sales, then the cost of goods", () => {
    const p = profit(base)
    expect(p.netSales).toBe(8_000)
    expect(p.grossProfit).toBe(3_000)
    expect(p.margin).toBe(37.5)
    expect(p.averageOrder).toBe(2_495) // (10,000 − 500 + 480) / 4
    expect(p.costCoverage).toBe(80)
  })
  it("reports a loss as negative", () => {
    const p = profit({ ...base, cogs: 9_000 })
    expect(p.grossProfit).toBe(-1_000)
    expect(p.margin).toBe(-12.5)
  })
  it("has no margin, average or coverage with no sales", () => {
    const p = profit({
      ...base,
      orders: 0,
      itemsSubtotal: 0,
      discounts: 0,
      refunds: 0,
      cogs: 0,
      units: 0,
      unitsWithCost: 0,
    })
    expect([p.margin, p.averageOrder, p.costCoverage]).toEqual([null, 0, null])
  })
})

describe("helpers", () => {
  it.each([
    [1, 3, 33.3],
    [0, 5, 0],
    [2, 0, null],
  ])("pct(%d, %d) = %s", (a, b, r) => {
    expect(pct(a, b)).toBe(r)
  })
  it.each([
    [150, 100, 50],
    [50, 100, -50],
    [10, 0, null],
    [-50, -100, 50],
  ])("change(%d, %d) = %s", (a, b, r) => {
    expect(change(a, b)).toBe(r)
  })
  it("counts delivered orders or everything not cancelled / failed", () => {
    expect(statusesFor("delivered")).toEqual(["DELIVERED", "COMPLETED"])
    expect(statusesFor("placed")).not.toContain("CANCELLED")
    expect(statusesFor("placed")).not.toContain("FAILED")
    expect(statusesFor("placed")).toContain("REFUNDED")
  })
})
