import { describe, it, expect } from "vitest"
import { bdMobile, conversion, offerActive, pagePrice, splitName } from "../../src/modules/landing/landing.rules"

describe("landing page offer", () => {
  const now = new Date("2026-10-01T10:00:00Z")
  const later = new Date("2026-10-02T00:00:00Z")
  const past = new Date("2026-09-30T00:00:00Z")

  it("runs until its end, if it has one", () => {
    expect(offerActive(999, later, now)).toBe(true)
    expect(offerActive(999, null, now)).toBe(true)
    expect(offerActive(999, past, now)).toBe(false)
    expect(offerActive(null, later, now)).toBe(false)
    expect(offerActive(0, later, now)).toBe(false)
  })

  it("only ever lowers the price", () => {
    expect(pagePrice(1290, 999, later, now)).toBe(999)
    expect(pagePrice(890, 999, later, now)).toBe(890)
    expect(pagePrice(1290, 999, past, now)).toBe(1290)
  })
})

describe("landing page order form", () => {
  it("splits one name field into first and last", () => {
    expect(splitName("  Rahim   Uddin Ahmed ")).toEqual({ firstName: "Rahim", lastName: "Uddin Ahmed" })
    expect(splitName("Sadia")).toEqual({ firstName: "Sadia", lastName: "" })
  })

  it("accepts Bangladeshi mobile numbers only", () => {
    expect(bdMobile("01712-345 678")).toBe("01712345678")
    expect(bdMobile("+8801912345678")).toBe("01912345678")
    expect(bdMobile("01212345678")).toBeNull()
    expect(bdMobile("12345")).toBeNull()
  })

  it("works out orders per 100 visits", () => {
    expect(conversion(0, 0)).toBeNull()
    expect(conversion(250, 9)).toBe(3.6)
  })
})
