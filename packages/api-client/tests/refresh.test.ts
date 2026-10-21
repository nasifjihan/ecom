import { describe, expect, it } from "vitest"
import { refreshesOn401 } from "../src/index"

describe("refreshesOn401", () => {
  it.each([
    ["/admin/orders", true],
    ["/storefront/account/orders?page=2", true],
    ["/auth/me/admin", true], // the blank-page bug: "who am I" must refresh like any signed-in call
    ["/auth/me/customer", true],
    ["/auth/admin/login", false], // a wrong password, not an expired session
    ["/auth/customer/login", false],
    ["/auth/admin/refresh", false],
    ["/auth/customer/otp/verify", false],
    ["/auth/customer/email-code/verify", false],
    ["/auth/customer/oauth/finish", false],
  ])("%s → %s", (url, want) => {
    expect(refreshesOn401(url)).toBe(want)
  })
})
