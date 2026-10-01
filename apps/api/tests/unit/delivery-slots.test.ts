import { describe, it, expect } from "vitest"
import { addDays, isDay, localNow, pickSlot, slotDays, slotLabel, slotTimesProblem, type SlotRow } from "../../src/modules/shipping/slots.rules"

const TZ = "Asia/Dhaka"
// 2026-10-01 is a Thursday. 08:00 UTC = 14:00 in Dhaka.
const at = (dhakaHm: string, day = "2026-10-01") => new Date(`${day}T${dhakaHm}:00+06:00`)
const slot = (over: Partial<SlotRow> = {}): SlotRow => ({
  id: "1",
  name: "Evening",
  startTime: "17:00",
  endTime: "21:00",
  cutoffMinutes: 120,
  fee: 50,
  capacity: null,
  weekdays: [0, 1, 2, 3, 4, 5, 6],
  ...over,
})

describe("delivery slots", () => {
  it("reads the time in the store's zone", () => {
    expect(localNow(new Date("2026-10-01T20:30:00Z"), TZ)).toEqual({ day: "2026-10-02", minutes: 150 })
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01")
    expect(isDay("2026-02-30")).toBe(false)
    expect(isDay("2026-10-02")).toBe(true)
  })

  it("checks the times", () => {
    expect(slotTimesProblem("17:00", "21:00", 120)).toBeNull()
    expect(slotTimesProblem("5pm", "21:00", 120)).toMatch(/24-hour/)
    expect(slotTimesProblem("21:00", "17:00", 120)).toMatch(/end after/)
    expect(slotTimesProblem("10:00", "12:00", -5)).toMatch(/close/)
  })

  it("closes today's slot at its order-by time and keeps later days open", () => {
    const open = slotDays({ slots: [slot()], now: at("14:59"), timeZone: TZ, daysAhead: 2 })
    expect(open.map((d) => [d.date, d.slots[0]!.available])).toEqual([["2026-10-01", true], ["2026-10-02", true]])
    const late = slotDays({ slots: [slot()], now: at("15:01"), timeZone: TZ, daysAhead: 2 })
    expect(late[0]!.slots[0]).toMatchObject({ available: false, reason: "closed" })
    expect(late[1]!.slots[0]!.available).toBe(true)
  })

  it("lets a long cutoff close tomorrow's morning slot today", () => {
    const morning = slot({ startTime: "09:00", endTime: "12:00", cutoffMinutes: 15 * 60 }) // order by 18:00 the day before
    const d = slotDays({ slots: [morning], now: at("19:00"), timeZone: TZ, daysAhead: 3 })
    expect(d.map((x) => [x.date, x.slots[0]!.reason])).toEqual([["2026-10-01", "closed"], ["2026-10-02", "closed"], ["2026-10-03", null]])
  })

  it("skips closed days and weekdays the slot doesn't run, and fills up", () => {
    const d = slotDays({
      slots: [slot({ weekdays: [4, 5] }), slot({ id: "2", name: "Morning", startTime: "10:00", endTime: "13:00", capacity: 2, weekdays: [5] })],
      now: at("09:00"),
      timeZone: TZ,
      daysAhead: 4,
      closedDates: ["2026-10-01"],
      taken: new Map([["2|2026-10-02", 2]]),
    })
    // Thu closed, Fri both (morning sorted first and full), Sat/Sun none.
    expect(d.map((x) => x.date)).toEqual(["2026-10-02"])
    expect(d[0]!.slots.map((s) => [s.name, s.left, s.reason])).toEqual([["Morning", 0, "full"], ["Evening", null, null]])
    const problem = (r: ReturnType<typeof pickSlot>) => ("problem" in r ? r.problem : "")
    expect(problem(pickSlot(d, "2", "2026-10-02"))).toMatch(/fully booked/)
    expect(problem(pickSlot(d, "1", "2026-10-03"))).toMatch(/isn't offered/)
    expect(pickSlot(d, "1", "2026-10-02")).toMatchObject({ slot: { id: "1", fee: 50 } })
  })

  it("labels the slot for the order", () => {
    expect(slotLabel("2026-10-02", { name: "Evening", window: "17:00–21:00" })).toBe("Fri 2 Oct, Evening 17:00–21:00")
  })
})
