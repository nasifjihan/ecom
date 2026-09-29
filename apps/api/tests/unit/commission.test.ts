import { describe, it, expect } from "vitest"
import { commissionLines, commissionState, monthOf, monthRange, rateFor, targetProgress } from "../../src/modules/sales/commission.rules"

describe("commission rate", () => {
  it("takes the product's rate, else the category's, else the store's, plus the salesperson's extra", () => {
    expect(rateFor({ productRate: 8, categoryRates: [5], defaultRate: 3, extraPct: 1 })).toEqual({ rate: 9, source: "product" })
    expect(rateFor({ productRate: null, categoryRates: [null, 5], defaultRate: 3, extraPct: 0 })).toEqual({ rate: 5, source: "category" })
    expect(rateFor({ productRate: null, categoryRates: [], defaultRate: 3, extraPct: 0.5 })).toEqual({ rate: 3.5, source: "store" })
    expect(rateFor({ productRate: 0, categoryRates: [5], defaultRate: 3, extraPct: 0 })).toEqual({ rate: 0, source: "product" })
  })
})

describe("commission on an order", () => {
  it("shares the discount over the lines by value", () => {
    const r = commissionLines(
      [
        { name: "Shirt", subtotal: 3000, rate: 10, source: "product" },
        { name: "Saree", subtotal: 1000, rate: 5, source: "store" },
      ],
      400,
    )
    expect(r.lines.map((l) => [l.base, l.amount])).toEqual([
      [2700, 270],
      [900, 45],
    ])
    expect(r).toMatchObject({ base: 3600, amount: 315 })
  })

  it("keeps rounding in the last line so the bases add up", () => {
    const r = commissionLines(
      [
        { name: "A", subtotal: 100, rate: 10, source: "store" },
        { name: "B", subtotal: 100, rate: 10, source: "store" },
        { name: "C", subtotal: 100, rate: 10, source: "store" },
      ],
      100,
    )
    expect(r.base).toBe(200)
  })
})

describe("commission state", () => {
  const order = { status: "PROCESSING", paymentStatus: "unpaid", deliveredAt: null, paidAt: null, itemsSubtotal: 4000, discountTotal: 400, refundedTotal: 0 }
  const c = { base: 3600, amount: 315, paidOutAt: null }

  it("is pending until the order is delivered and paid", () => {
    expect(commissionState(order, c)).toMatchObject({ state: "PENDING", amount: 315 })
    expect(commissionState({ ...order, status: "DELIVERED" }, c).state).toBe("PENDING")
    expect(commissionState({ ...order, paymentStatus: "paid", paidAt: new Date() }, c).state).toBe("PENDING")
  })

  it("is earned when both are done, on the later date", () => {
    const d = new Date("2026-10-05T10:00:00Z")
    const p = new Date("2026-10-07T10:00:00Z")
    expect(commissionState({ ...order, status: "DELIVERED", deliveredAt: d, paymentStatus: "paid", paidAt: p }, c)).toMatchObject({ state: "EARNED", earnedAt: p })
    expect(commissionState({ ...order, status: "COMPLETED", deliveredAt: d, paymentStatus: "paid", paidAt: p }, { ...c, paidOutAt: new Date() }).state).toBe("PAID")
  })

  it("gives back the refunded share, and nothing on a closed order", () => {
    const done = { ...order, status: "DELIVERED", paymentStatus: "partially_refunded", deliveredAt: new Date(), paidAt: new Date() }
    expect(commissionState({ ...done, refundedTotal: 900 }, c)).toMatchObject({ state: "EARNED", amount: 236.25, base: 2700 })
    expect(commissionState({ ...order, status: "CANCELLED" }, c)).toMatchObject({ state: "CANCELLED", amount: 0 })
    expect(commissionState({ ...order, status: "REFUNDED" }, c).state).toBe("CANCELLED")
  })
})

describe("months and targets", () => {
  it("uses Dhaka months", () => {
    expect(monthOf(new Date("2026-09-30T19:00:00Z"))).toBe("2026-10")
    expect(monthOf(new Date("2026-09-30T17:00:00Z"))).toBe("2026-09")
    expect(monthRange("2026-10")).toEqual({ start: new Date("2026-09-30T18:00:00Z"), end: new Date("2026-10-31T18:00:00Z") })
    expect(monthRange("2026-12").end).toEqual(new Date("2026-12-31T18:00:00Z"))
  })

  it("shows progress toward a target", () => {
    expect(targetProgress(75000, 100000)).toBe(75)
    expect(targetProgress(120000, 100000)).toBe(120)
    expect(targetProgress(5000, null)).toBeNull()
  })
})
