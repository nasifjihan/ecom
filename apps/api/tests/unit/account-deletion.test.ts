import { describe, expect, it } from "vitest"
import { hasOpenOrders } from "../../src/modules/customers/account-deletion"

describe("account deletion", () => {
  it("waits for orders still on their way, whatever the letter case", () => {
    expect(hasOpenOrders([])).toBe(false)
    expect(hasOpenOrders(["DELIVERED", "CANCELLED", "REFUNDED", "COMPLETED", "FAILED"])).toBe(false)
    expect(hasOpenOrders(["DELIVERED", "SHIPPED"])).toBe(true)
    expect(hasOpenOrders(["pending"])).toBe(true)
    expect(hasOpenOrders(["OUT_FOR_DELIVERY"])).toBe(true)
  })
})
