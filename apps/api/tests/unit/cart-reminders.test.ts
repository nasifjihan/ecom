import { describe, expect, it } from "vitest"
import { canSendNow, cartSummary, inQuietHours } from "../../src/modules/marketing/cart-reminders.rules"

// Times in UTC; Dhaka is UTC+6.
const at = (dhakaHour: number) => new Date(Date.UTC(2026, 10, 2, (dhakaHour - 6 + 24) % 24, 30))

describe("cart reminder timing", () => {
  it("keeps 10pm–8am Dhaka time quiet", () => {
    expect(inQuietHours(at(21))).toBe(false)
    expect(inQuietHours(at(22))).toBe(true)
    expect(inQuietHours(at(3))).toBe(true)
    expect(inQuietHours(at(7))).toBe(true)
    expect(inQuietHours(at(8))).toBe(false)
  })

  it("holds a reminder with an SMS at night, but sends email-only ones", () => {
    const both = { sms: true, email: true }
    expect(canSendNow(both, { phone: "01711000101", email: null }, at(23)).send).toBe(false)
    expect(canSendNow(both, { phone: "01711000101", email: null }, at(10)).send).toBe(true)
    expect(canSendNow(both, { phone: null, email: "a@b.co" }, at(23)).send).toBe(true)
    expect(canSendNow({ sms: false, email: true }, { phone: "01711000101", email: "a@b.co" }, at(23))).toEqual({ send: true, sms: false, email: true })
    expect(canSendNow({ sms: false, email: true }, { phone: "01711000101", email: null }, at(10)).send).toBe(false)
  })

  it("names the cart by its first item", () => {
    expect(cartSummary(["Cotton Panjabi"])).toBe("Cotton Panjabi")
    expect(cartSummary(["Cotton Panjabi", "Belt", "Cap"])).toBe("Cotton Panjabi and 2 more")
  })
})
