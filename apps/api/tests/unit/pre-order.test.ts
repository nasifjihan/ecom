import { describe, expect, it } from "vitest"
import { latestShipDate, preOrderShipDate } from "../../src/modules/catalog/pre-order"

// 31 Oct 2026, 20:00 in Dhaka (UTC+6): still the 31st there.
const now = new Date("2026-10-31T14:00:00Z")
const p = (o: Partial<{ preOrder: boolean; preOrderDays: number | null; preOrderShipsOn: Date | null }>) => ({
  preOrder: true,
  preOrderDays: null,
  preOrderShipsOn: null,
  ...o,
})

describe("pre-order ship dates", () => {
  it("is null for products that aren't on pre-order", () => {
    expect(preOrderShipDate(p({ preOrder: false, preOrderDays: 10 }), now)).toBeNull()
  })

  it("counts days from the order, in Dhaka time", () => {
    expect(preOrderShipDate(p({ preOrderDays: 10 }), now)).toBe("2026-11-10")
    // 23:30 on the 31st in Dhaka is already 1 Nov.
    expect(preOrderShipDate(p({ preOrderDays: 1 }), new Date("2026-10-31T18:30:00Z"))).toBe("2026-11-02")
  })

  it("uses a set day, or today once that day has passed", () => {
    expect(preOrderShipDate(p({ preOrderShipsOn: new Date("2026-12-01") }), now)).toBe("2026-12-01")
    expect(preOrderShipDate(p({ preOrderShipsOn: new Date("2026-10-01") }), now)).toBe("2026-10-31")
  })

  it("ships an order with the last of its pre-order items", () => {
    expect(latestShipDate([null, "2026-11-10", "2026-12-01", null])).toBe("2026-12-01")
    expect(latestShipDate([null])).toBeNull()
  })
})
