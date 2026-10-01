import { describe, expect, it } from "vitest"
import { cleanHandle, cleanTags, customerSource, followUpState, isOpen, orderSource, statusChangeProblem, todayRange } from "../../src/modules/leads/leads.rules"

describe("lead rules", () => {
  it("turns pasted profile links and @names into handles", () => {
    expect(cleanHandle("https://www.facebook.com/rahima.khatun/")).toBe("rahima.khatun")
    expect(cleanHandle("m.facebook.com/profile.php?id=10001234")).toBe("10001234")
    expect(cleanHandle("instagram.com/@rahima_bd?igsh=x")).toBe("rahima_bd")
    expect(cleanHandle("  @@rahima_bd ")).toBe("rahima_bd")
    expect(cleanHandle("Rahima Khatun")).toBe("Rahima Khatun")
    expect(cleanHandle("  ")).toBeNull()
    expect(cleanHandle(undefined)).toBeNull()
  })

  it("keeps tags tidy", () => {
    expect(cleanTags([" Eid ", "eid", "Wholesale  Buyer", ""])).toEqual(["eid", "wholesale buyer"])
    expect(cleanTags(Array.from({ length: 15 }, (_, i) => `t${i}`))).toHaveLength(10)
  })

  it("maps channels to customer and order sources", () => {
    expect(customerSource("messenger")).toBe("facebook")
    expect(customerSource("tiktok")).toBe("other")
    expect(customerSource("walk_in")).toBe("walk_in")
    expect(orderSource("messenger")).toBe("messenger")
    expect(orderSource("referral")).toBe("other")
    expect(orderSource("website")).toBe("website")
  })

  it("places follow-ups by the shop's day", () => {
    // 2026-10-03 10:00 in Dhaka = 04:00 UTC
    const now = new Date("2026-10-03T04:00:00Z")
    expect(followUpState(null, now)).toBe("none")
    expect(followUpState(new Date("2026-10-02T17:00:00Z"), now)).toBe("overdue") // 2 Oct 23:00 Dhaka
    expect(followUpState(new Date("2026-10-02T18:30:00Z"), now)).toBe("today") // 3 Oct 00:30 Dhaka
    expect(followUpState(new Date("2026-10-03T12:00:00Z"), now)).toBe("today") // 3 Oct 18:00
    expect(followUpState(new Date("2026-10-03T18:30:00Z"), now)).toBe("later") // 4 Oct 00:30
    const r = todayRange(now)
    expect(r.start.toISOString()).toBe("2026-10-02T18:00:00.000Z")
    expect(r.end.toISOString()).toBe("2026-10-03T18:00:00.000Z")
  })

  it("checks status changes", () => {
    expect(isOpen("interested")).toBe(true)
    expect(isOpen("won")).toBe(false)
    expect(statusChangeProblem("new", "new", null)).toMatch(/already/)
    expect(statusChangeProblem("new", "lost", " ")).toMatch(/why/)
    expect(statusChangeProblem("new", "lost", "Too expensive")).toBeNull()
    expect(statusChangeProblem("interested", "won", null)).toMatch(/order/)
    expect(statusChangeProblem("lost", "contacted", null)).toBeNull()
  })
})
