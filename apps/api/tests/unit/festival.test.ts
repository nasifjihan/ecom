import { describe, it, expect } from "vitest"
import {
  addDays,
  coverage,
  datesProblem,
  dhakaEnd,
  dhakaStart,
  dhakaToday,
  lastYearWindow,
  phase,
  presetsFor,
  progress,
  reminderDue,
  tasksFrom,
} from "../../src/modules/festivals/festival.rules"

describe("festival presets", () => {
  it("works out fixed and weekday festivals for any year", () => {
    const { festivals } = presetsFor(2026)
    const on = (key: string) => festivals.find((f) => f.key === key)!
    expect(on("pohela_boishakh")).toMatchObject({ startsOn: "2026-04-14", saleFrom: "2026-04-04", dateIsEstimate: false })
    expect(on("mothers_day").startsOn).toBe("2026-05-10")
    expect(on("fathers_day").startsOn).toBe("2026-06-21")
    expect(on("black_friday")).toMatchObject({ startsOn: "2026-11-27", saleTo: "2026-11-30" })
    expect(on("victory_day").startsOn).toBe("2026-12-16")
    expect(festivals.map((f) => f.startsOn)).toEqual([...festivals.map((f) => f.startsOn)].sort())
  })

  it("marks moon festivals as estimates, with Eid shopping in Ramadan", () => {
    const eid = presetsFor(2026).festivals.find((f) => f.key === "eid_ul_fitr")!
    expect(eid).toMatchObject({ startsOn: "2026-03-21", endsOn: "2026-03-23", saleFrom: "2026-02-24", saleTo: "2026-03-23", dateIsEstimate: true })
    expect(eid.tasks).toContain("Plan courier pickups for the last week")
  })

  it("leaves out festivals whose dates aren't known for that year", () => {
    const { festivals, unknown } = presetsFor(2031)
    expect(unknown).toEqual(["Ramadan begins", "Eid-ul-Fitr", "Eid-ul-Adha", "Durga Puja"])
    expect(festivals.some((f) => f.key === "pohela_boishakh")).toBe(true)
  })
})

describe("dates", () => {
  it("counts days across months and years, in Dhaka time", () => {
    expect(addDays("2026-02-24", 25)).toBe("2026-03-21")
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31")
    expect(dhakaToday(new Date("2026-03-20T19:30:00Z"))).toBe("2026-03-21")
    expect(dhakaStart("2026-03-21").toISOString()).toBe("2026-03-20T18:00:00.000Z")
    expect(dhakaEnd("2026-03-21").toISOString()).toBe("2026-03-21T17:59:59.000Z")
  })

  it("compares with last year's festival, which moves with the moon", () => {
    const eid = presetsFor(2026).festivals.find((f) => f.key === "eid_ul_fitr")!
    // 2025's Eid was 31 March: the same 25-day lead and sale length around it.
    expect(lastYearWindow(eid)).toEqual({ from: "2025-03-06", to: "2025-04-02" })
    expect(lastYearWindow({ key: null, startsOn: "2028-03-01", saleFrom: "2028-02-29", saleTo: "2028-03-02" })).toEqual({ from: "2027-02-28", to: "2027-03-02" })
  })

  it("checks a festival's dates", () => {
    const ok = { startsOn: "2026-04-14", endsOn: "2026-04-14", saleFrom: "2026-04-04", saleTo: "2026-04-14" }
    expect(datesProblem(ok)).toBeNull()
    expect(datesProblem({ ...ok, endsOn: "2026-04-13" })).toMatch(/ends before it starts/)
    expect(datesProblem({ ...ok, saleTo: "2026-04-01" })).toMatch(/sale ends before/)
    expect(datesProblem({ ...ok, saleFrom: "2026-04-20", saleTo: "2026-04-25" })).toMatch(/near the festival/)
  })
})

describe("where a festival stands", () => {
  const f = { saleFrom: "2026-04-04", saleTo: "2026-04-14", endsOn: "2026-04-14", remindDays: 21 }
  it("moves from later to prepare, on sale and over", () => {
    expect(phase(f, "2026-03-13")).toBe("later")
    expect(phase(f, "2026-03-14")).toBe("prepare")
    expect(phase(f, "2026-04-04")).toBe("on_sale")
    expect(phase(f, "2026-04-14")).toBe("on_sale")
    expect(phase(f, "2026-04-15")).toBe("over")
  })

  it("reminds once, from the reminder day until the sale ends", () => {
    expect(reminderDue({ ...f, remindedAt: null }, "2026-03-13")).toBe(false)
    expect(reminderDue({ ...f, remindedAt: null }, "2026-03-14")).toBe(true)
    expect(reminderDue({ ...f, remindedAt: new Date() }, "2026-03-20")).toBe(false)
    expect(reminderDue({ ...f, remindedAt: null }, "2026-04-15")).toBe(false)
  })

  it("says whether a campaign covers the sale", () => {
    const at = (s: string | null, e: string | null) => ({ startsAt: s ? new Date(s) : null, endsAt: e ? new Date(e) : null })
    expect(coverage(at(null, null), f.saleFrom, f.saleTo)).toBe("always")
    expect(coverage(at("2026-04-03T18:00:00Z", "2026-04-14T17:59:59Z"), f.saleFrom, f.saleTo)).toBe("covers")
    expect(coverage(at("2026-04-08T00:00:00Z", null), f.saleFrom, f.saleTo)).toBe("partial")
    expect(coverage(at("2026-05-01T00:00:00Z", "2026-05-10T00:00:00Z"), f.saleFrom, f.saleTo)).toBe("outside")
  })

  it("counts the checklist", () => {
    const tasks = tasksFrom(["a", "b", "c"])
    tasks[1]!.done = true
    expect(progress(tasks)).toEqual({ done: 1, total: 3 })
    expect(tasks.map((t) => t.id)).toEqual(["t1", "t2", "t3"])
  })
})
