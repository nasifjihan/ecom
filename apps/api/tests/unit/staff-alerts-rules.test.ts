import { describe, expect, it } from "vitest"
import { alertRecipients, staffSetting, staffSmsText, STAFF_EVENT_INFO } from "../../src/modules/staff-alerts/staff-alerts.rules"

const staff = [
  { id: 1n, active: true, owner: true },
  { id: 2n, active: true, owner: false },
  { id: 3n, active: false, owner: false },
  { id: 4n, active: true, owner: true },
]

describe("staff alert rules", () => {
  it("uses the defaults until a setting is saved", () => {
    expect(staffSetting("new_order", null)).toEqual({ inApp: true, email: true, sms: false, staffIds: [] })
    expect(staffSetting("low_stock", { inApp: false, email: true, sms: true, staffIds: [2n] })).toEqual({ inApp: false, email: true, sms: true, staffIds: [2n] })
    expect(STAFF_EVENT_INFO.lead_assigned.toAssignee).toBe(true)
  })

  it("sends to the chosen active people, or the owners when nobody is chosen", () => {
    expect(alertRecipients("new_order", staffSetting("new_order", null), staff)).toEqual([1n, 4n])
    expect(alertRecipients("new_order", { inApp: true, email: false, sms: false, staffIds: [2n, 3n] }, staff)).toEqual([2n])
  })

  it("sends 'given to you' alerts only to the follower, and not when they did it themselves", () => {
    const s = staffSetting("lead_assigned", null)
    expect(alertRecipients("lead_assigned", s, staff, { assigneeId: 2n, byId: 1n })).toEqual([2n])
    expect(alertRecipients("lead_assigned", s, staff, { assigneeId: 2n, byId: 2n })).toEqual([])
    expect(alertRecipients("lead_assigned", s, staff, { assigneeId: 3n })).toEqual([])
    expect(alertRecipients("lead_assigned", s, staff, { assigneeId: null })).toEqual([])
  })

  it("keeps staff SMS short and plain", () => {
    expect(staffSmsText("Fashion BD", "New order 1001 · ৳2,500")).toBe("Fashion BD: New order 1001 - Tk 2,500")
    expect(staffSmsText("Shop", "x".repeat(300))).toHaveLength(160)
  })
})
