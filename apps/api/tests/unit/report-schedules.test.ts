import { describe, expect, it } from "vitest"
import {
  PDF_ROW_CAP,
  afterRun,
  cleanEmails,
  isoWeekday,
  nextRunAt,
  ordinal,
  periodRange,
  scheduleProblem,
  staffMayReceive,
  timingText,
  type ScheduleShape,
} from "../../src/modules/reports/report-schedule.rules"
import { buildSection, summaryLines, tk } from "../../src/modules/reports/report.sections"
import { renderReportPdf } from "../../src/modules/reports/report.pdf"

const DHAKA = "Asia/Dhaka"
const at = (iso: string) => new Date(iso)

describe("when a schedule sends", () => {
  it("sends daily at the hour, shop time", () => {
    // 07:30 Dhaka = 01:30 UTC; 08:00 Dhaka = 02:00 UTC.
    expect(nextRunAt({ frequency: "daily", sendHour: 8 }, at("2026-10-19T01:30:00Z"), DHAKA).toISOString()).toBe("2026-10-19T02:00:00.000Z")
    // Just past it: tomorrow.
    expect(nextRunAt({ frequency: "daily", sendHour: 8 }, at("2026-10-19T02:00:00Z"), DHAKA).toISOString()).toBe("2026-10-20T02:00:00.000Z")
    // 23:00 Dhaka is 17:00 UTC the same day; past Dhaka midnight it's the next local day.
    expect(nextRunAt({ frequency: "daily", sendHour: 23 }, at("2026-10-19T18:30:00Z"), DHAKA).toISOString()).toBe("2026-10-20T17:00:00.000Z")
  })

  it("sends weekly on the weekday chosen", () => {
    expect(isoWeekday("2026-10-19")).toBe(1) // a Monday
    expect(isoWeekday("2026-10-25")).toBe(7)
    // Monday 19 Oct, 10:00 Dhaka: the next Sunday 09:00 is the 25th.
    expect(nextRunAt({ frequency: "weekly", weekday: 7, sendHour: 9 }, at("2026-10-19T04:00:00Z"), DHAKA).toISOString()).toBe("2026-10-25T03:00:00.000Z")
    // Monday, before the hour: today.
    expect(nextRunAt({ frequency: "weekly", weekday: 1, sendHour: 9 }, at("2026-10-19T02:00:00Z"), DHAKA).toISOString()).toBe("2026-10-19T03:00:00.000Z")
  })

  it("sends monthly on the day, across the year end", () => {
    expect(nextRunAt({ frequency: "monthly", monthDay: 1, sendHour: 8 }, at("2026-12-15T00:00:00Z"), DHAKA).toISOString()).toBe("2027-01-01T02:00:00.000Z")
    expect(nextRunAt({ frequency: "monthly", monthDay: 28, sendHour: 0 }, at("2027-02-01T00:00:00Z"), DHAKA).toISOString()).toBe("2027-02-27T18:00:00.000Z")
  })

  it("uses the shop's own time zone, including summer time", () => {
    // London is UTC+1 in October (before the 25th) and UTC+0 after.
    expect(nextRunAt({ frequency: "daily", sendHour: 8 }, at("2026-10-19T08:00:00Z"), "Europe/London").toISOString()).toBe("2026-10-20T07:00:00.000Z")
    expect(nextRunAt({ frequency: "daily", sendHour: 8 }, at("2026-10-26T09:00:00Z"), "Europe/London").toISOString()).toBe("2026-10-27T08:00:00.000Z")
  })

  it("describes the timing in words", () => {
    expect(timingText({ frequency: "daily", sendHour: 8 })).toBe("Daily at 08:00")
    expect(timingText({ frequency: "weekly", weekday: 6, sendHour: 21 })).toBe("Every Saturday at 21:00")
    expect(timingText({ frequency: "monthly", monthDay: 2, sendHour: 9 })).toBe("On the 2nd of each month at 09:00")
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23].map(ordinal)).toEqual(["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "23rd"])
  })
})

describe("which days a sending covers", () => {
  it("counts back from the day it's sent, never including it", () => {
    expect(periodRange("yesterday", "2026-10-19")).toEqual({ from: "2026-10-18", to: "2026-10-18" })
    expect(periodRange("last_7_days", "2026-10-19")).toEqual({ from: "2026-10-12", to: "2026-10-18" })
    // Sent on Monday 19th: the Monday–Sunday before.
    expect(periodRange("last_week", "2026-10-19")).toEqual({ from: "2026-10-12", to: "2026-10-18" })
    // Sent on Wednesday 21st: still that week.
    expect(periodRange("last_week", "2026-10-21")).toEqual({ from: "2026-10-12", to: "2026-10-18" })
    expect(periodRange("last_month", "2026-10-19")).toEqual({ from: "2026-09-01", to: "2026-09-30" })
    expect(periodRange("last_month", "2026-03-01")).toEqual({ from: "2026-02-01", to: "2026-02-28" })
    expect(periodRange("last_month", "2027-01-05")).toEqual({ from: "2026-12-01", to: "2026-12-31" })
    expect(periodRange("month_to_date", "2026-10-19")).toEqual({ from: "2026-10-01", to: "2026-10-18" })
    // On the 1st there's nothing "so far": the month just ended.
    expect(periodRange("month_to_date", "2026-11-01")).toEqual({ from: "2026-10-01", to: "2026-10-31" })
  })
})

describe("checking a schedule", () => {
  const ok: ScheduleShape = { name: "Weekly", reports: ["sales"], frequency: "weekly", weekday: 1, sendHour: 8, period: "last_week", staffIds: [1n], emails: [] }

  it("accepts a good one and names the first problem", () => {
    expect(scheduleProblem(ok)).toBeNull()
    expect(scheduleProblem({ ...ok, name: " " })).toBe("Give the schedule a name")
    expect(scheduleProblem({ ...ok, reports: [] })).toBe("Choose at least one report")
    expect(scheduleProblem({ ...ok, reports: ["orders"] })).toBe("Unknown report")
    expect(scheduleProblem({ ...ok, weekday: null })).toBe("Choose the day of the week")
    expect(scheduleProblem({ ...ok, frequency: "monthly", monthDay: 31 })).toBe("Choose a day of the month from 1 to 28")
    expect(scheduleProblem({ ...ok, sendHour: 24 })).toBe("Choose an hour from 0 to 23")
    expect(scheduleProblem({ ...ok, staffIds: [], emails: [] })).toBe("Choose who gets it")
    expect(scheduleProblem({ ...ok, staffIds: [], emails: ["accountant@example.com"] })).toBeNull()
    expect(scheduleProblem({ ...ok, emails: ["not-an-email"] })).toBe('"not-an-email" doesn\'t look like an email address')
    expect(scheduleProblem({ ...ok, emails: Array.from({ length: 11 }, (_, i) => `a${i}@x.com`) })).toBe("At most 10 other addresses")
  })

  it("tidies addresses", () => {
    expect(cleanEmails([" Owner@Shop.com ", "owner@shop.com", "", "b@x.com"])).toEqual(["owner@shop.com", "b@x.com"])
  })

  it("only sends staff limited to storefronts reports for one of theirs", () => {
    expect(staffMayReceive([], null)).toBe(true)
    expect(staffMayReceive([], 2n)).toBe(true)
    expect(staffMayReceive([2n], 2n)).toBe(true)
    expect(staffMayReceive([2n], 3n)).toBe(false)
    expect(staffMayReceive([2n], null)).toBe(false)
  })

  it("switches itself off after 3 failures in a row", () => {
    expect(afterRun(0, false)).toEqual({ failures: 1, disable: false })
    expect(afterRun(1, false)).toEqual({ failures: 2, disable: false })
    expect(afterRun(2, false)).toEqual({ failures: 3, disable: true })
    expect(afterRun(2, true)).toEqual({ failures: 0, disable: false })
  })
})

// ------------------------------------------------------------------ the PDF

const salesData = {
  from: "2026-10-12",
  to: "2026-10-18",
  days: 7,
  timezone: DHAKA,
  basis: "placed" as const,
  previous: { from: "2026-10-05", to: "2026-10-11" },
  bucket: "day" as const,
  total: { orders: 12, itemsSubtotal: 50000, discounts: 2000, shipping: 720, tax: 0, refunds: 1000, cogs: 30000, units: 20, unitsWithCost: 18, netSales: 47000, grossProfit: 17000, margin: 36.2, averageOrder: 4060, costCoverage: 90 },
  changes: { orders: 20, netSales: -5.5, grossProfit: null, averageOrder: 1 },
  series: ["2026-10-12", "2026-10-13"].map((period, i) => ({ period, orders: 6, itemsSubtotal: 0, discounts: 0, shipping: 0, tax: 0, refunds: 0, cogs: 0, units: 0, unitsWithCost: 0, netSales: 20000 + i * 7000, grossProfit: 8000, margin: 40, averageOrder: 0, costCoverage: 100 })),
  bySource: [{ key: "storefront", orders: 12, itemsSubtotal: 0, discounts: 0, shipping: 0, tax: 0, refunds: 0, cogs: 0, units: 0, unitsWithCost: 0, netSales: 47000, grossProfit: 17000, margin: 36.2, averageOrder: 0, costCoverage: 90, share: 100 }],
  byPayment: [],
  byStorefront: [],
}

const productsData = (n: number) => ({
  from: "2026-10-12",
  to: "2026-10-18",
  days: 7,
  timezone: DHAKA,
  basis: "placed" as const,
  sort: "revenue" as const,
  products: Array.from({ length: n }, (_, i) => ({
    productId: String(i + 1),
    name: i === 0 ? "জামদানি শাড়ি — চন্দ্র" : `Cotton Panjabi ${i + 1}`,
    sku: `SKU-${i + 1}`,
    category: "Panjabi",
    orders: 1,
    units: 2,
    unitsReturned: 0,
    revenue: 5000,
    refunded: 0,
    netSales: 5000,
    cogs: 3000,
    grossProfit: 2000,
    margin: 40,
    costCoverage: 100,
  })),
  categories: [{ category: "Panjabi", units: n * 2, netSales: n * 5000, cogs: n * 3000, products: n, grossProfit: n * 2000, margin: 40 }],
})

describe("report PDF sections", () => {
  it("shows the sales figures with the change and a cost-price warning", () => {
    const s = buildSection("sales", salesData as never)
    expect(s.title).toBe("Sales & profit")
    expect(s.stats[0]).toEqual({ label: "Net sales", value: "৳47,000", change: -5.5 })
    expect(s.stats[1]!.change).toBeNull()
    expect(s.note).toMatch(/90% of units sold have a cost price/)
    expect(s.chart!.points.map((p) => p.label)).toEqual(["12 Oct", "13 Oct"])
    expect(s.tables.map((t) => t.title)).toEqual(["By day", "By source", "By payment method"])
    expect(s.tables[1]!.rows).toEqual([["Storefront", "12", "৳47,000", "৳17,000", "100%"]])
  })

  it(`caps tables at ${PDF_ROW_CAP} rows and keeps the full count`, () => {
    const s = buildSection("products", productsData(120) as never)
    expect(s.tables[0]!.rows).toHaveLength(PDF_ROW_CAP)
    expect(s.tables[0]!.totalRows).toBe(120)
    expect(s.tables[1]!.rows).toHaveLength(1)
  })

  it("writes money the way the admin does (lakh grouping, no paisa)", () => {
    expect(tk(184250.4)).toBe("৳1,84,250")
    expect(tk(-500)).toBe("−৳500")
  })

  it("sums up the sales for the email", () => {
    expect(summaryLines({ sales: salesData })).toEqual([
      "Net sales: ৳47,000 (−5.5% vs the period before)",
      "Orders: 12 (+20% vs the period before)",
      "Gross profit: ৳17,000",
    ])
    expect(summaryLines({})).toEqual([])
  })

  it("makes a PDF over several pages with Bangla names", async () => {
    const pdf = await renderReportPdf({
      storeName: "Fashion BD",
      title: "Weekly sales",
      details: ["12 Oct 2026 – 18 Oct 2026", "All placed orders"],
      madeAt: "Made 19 Oct 2026, 08:00 (Asia/Dhaka)",
      sections: [buildSection("sales", salesData as never), buildSection("products", productsData(120) as never)],
    })
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-")
    const pages = (pdf.toString("latin1").match(/\/Type \/Page\b/g) ?? []).length
    expect(pages).toBeGreaterThanOrEqual(3)
  }, 20_000)
})
