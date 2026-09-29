import { describe, expect, it } from "vitest"
import {
  averageCost,
  lineTotal,
  payNowFor,
  purchaseNumber,
  purchaseTotals,
  supplierBalance,
} from "../../src/modules/purchasing/purchasing.rules"

describe("lineTotal", () => {
  it.each([
    [{ qty: 10, unitCost: 500 }, 5000],
    [{ qty: 10, unitCost: 500, discountPct: 10 }, 4500],
    [{ qty: 10, unitCost: 500, discountAmount: 200 }, 4800],
    [{ qty: 10, unitCost: 500, discountPct: 10, discountAmount: 500 }, 4000],
    [{ qty: 3, unitCost: 33.33 }, 99.99],
    [{ qty: 5, unitCost: 0 }, 0],
  ])("%j -> %d", (l, want) => {
    expect(lineTotal(l)).toEqual({ total: want })
  })

  it.each([
    [{ qty: 0, unitCost: 10 }, "Quantity"],
    [{ qty: 1.5, unitCost: 10 }, "Quantity"],
    [{ qty: 1, unitCost: -1 }, "negative"],
    [{ qty: 1, unitCost: 10, discountPct: 120 }, "between 0 and 100"],
    [{ qty: 1, unitCost: 10, discountAmount: 11 }, "more than the line"],
  ])("%j is refused", (l, msg) => {
    const r = lineTotal(l)
    expect("error" in r && r.error).toContain(msg)
  })
})

describe("purchaseTotals", () => {
  it("adds charges and shares them by value", () => {
    const r = purchaseTotals(
      [
        { qty: 10, unitCost: 300 }, // 3000
        { qty: 5, unitCost: 200 }, // 1000
      ],
      { shipping: 300, customs: 200, other: 0, discount: 100 },
    )
    expect(r).toEqual({
      itemsSubtotal: 4000,
      total: 4400,
      lineTotals: [3000, 1000],
      landedUnitCosts: [330, 220],
    })
  })

  it("keeps the shares adding up with awkward numbers", () => {
    const r = purchaseTotals(
      [
        { qty: 3, unitCost: 100 },
        { qty: 3, unitCost: 100 },
        { qty: 3, unitCost: 100 },
      ],
      { shipping: 100 },
    )
    if ("error" in r) throw new Error(r.error)
    const landed = r.landedUnitCosts.reduce((s, c, i) => s + c * 3, 0)
    expect(Math.abs(landed - r.total)).toBeLessThan(0.1)
  })

  it("shares by quantity when the goods were free", () => {
    const r = purchaseTotals(
      [
        { qty: 1, unitCost: 0 },
        { qty: 3, unitCost: 0 },
      ],
      { shipping: 400 },
    )
    expect(r).toMatchObject({ total: 400, landedUnitCosts: [100, 100] })
  })

  it.each([
    [[], {}, "at least one item"],
    [[{ qty: 1, unitCost: 100 }], { discount: 200 }, "more than the whole purchase"],
    [[{ qty: 1, unitCost: 100 }], { shipping: -5 }, "negative"],
    [
      [
        { qty: 1, unitCost: 100 },
        { qty: 0, unitCost: 1 },
      ],
      {},
      "Line 2",
    ],
  ])("refuses %j %j", (lines, extras, msg) => {
    const r = purchaseTotals(lines, extras)
    expect("error" in r && r.error).toContain(msg)
  })
})

describe("averageCost", () => {
  it.each([
    [0, null, 10, 300, 300],
    [10, 250, 10, 300, 275],
    [30, 200, 10, 400, 250],
    [-4, 200, 10, 300, 300],
    [5, null, 5, 120, 120],
  ])("on hand %i at %s + %i at %i -> %d", (onHand, cost, add, addCost, want) => {
    expect(averageCost(onHand, cost, add, addCost)).toBe(want)
  })
})

describe("payNowFor", () => {
  it.each([
    ["instant_full", 1000, undefined, 1000],
    ["instant_full", 1000, 1000, 1000],
    ["instant_partial", 1000, 400, 400],
    ["credit", 1000, undefined, 0],
    ["credit", 1000, 0, 0],
    ["advance", 1000, undefined, 0],
  ] as const)("%s total %i pay %s -> %i", (term, total, pay, want) => {
    expect(payNowFor(term, total, pay)).toEqual({ amount: want })
  })

  it.each([
    ["instant_full", 1000, 900],
    ["instant_partial", 1000, 0],
    ["instant_partial", 1000, 1000],
    ["instant_partial", 1000, undefined],
    ["credit", 1000, 100],
    ["advance", 1000, 50],
  ] as const)("%s total %i pay %s is refused", (term, total, pay) => {
    expect(payNowFor(term, total, pay)).toHaveProperty("error")
  })
})

describe("balances and numbers", () => {
  it("works out what's owed", () => {
    expect(supplierBalance(5000, 12000, 15000)).toBe(2000)
    expect(supplierBalance(0, 0, 1000)).toBe(-1000)
  })
  it("numbers purchases", () => {
    expect(purchaseNumber(7)).toBe("PUR-000007")
  })
})
