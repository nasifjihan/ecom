import { describe, expect, it } from "vitest"
import { sharedRate, spreadAmounts, taxClassGroups } from "../../src/modules/shipping/tax.rules"

describe("spreadAmounts", () => {
  it.each([
    // Discount of 100 on 300 + 700: each line keeps its share.
    [[300, 700], 900, [270, 630]],
    // Rounding goes to the last line so the sum stays exact.
    [[100, 100, 100], 100, [33.33, 33.33, 33.34]],
    [[500], 450, [450]],
    // Nothing to tax.
    [[200, 300], 0, [0, 0]],
    [[0, 0], 100, [0, 0]],
  ])("%j spread to %d gives %j", (amounts, total, want) => {
    expect(spreadAmounts(amounts, total)).toEqual(want)
    if (total > 0 && amounts.some((a) => a > 0)) expect(want.reduce((s, a) => s + a, 0)).toBeCloseTo(total, 2)
  })
})

describe("taxClassGroups", () => {
  it("groups by the line's class, then the default class", () => {
    expect(
      taxClassGroups(
        [
          { amount: 1000, taxClassId: null }, // no class: the default (Standard)
          { amount: 500, taxClassId: "2" }, // Reduced
          { amount: 500, taxClassId: "1" }, // Standard
        ],
        1800, // 200 off the 2000 of goods
        "1",
      ),
    ).toEqual([
      { taxClassId: "1", amount: 1350 },
      { taxClassId: "2", amount: 450 },
    ])
  })

  it("without a default class, unclassed lines use every matching rate (null)", () => {
    expect(taxClassGroups([{ amount: 100, taxClassId: null }, { amount: 100, taxClassId: "3" }], 200, null)).toEqual([
      { taxClassId: null, amount: 100 },
      { taxClassId: "3", amount: 100 },
    ])
  })

  it("leaves out empty groups (a fully discounted order)", () => {
    expect(taxClassGroups([{ amount: 100, taxClassId: "1" }], 0, null)).toEqual([])
  })
})

describe("sharedRate", () => {
  it.each([
    [[{ ratePct: 15, tax: 150 }, { ratePct: 15, tax: 9 }], 15],
    // An exempt part (no tax) doesn't make the order "mixed".
    [[{ ratePct: 15, tax: 150 }, { ratePct: 0, tax: 0 }], 15],
    [[{ ratePct: 15, tax: 150 }, { ratePct: 5, tax: 25 }], 0],
    [[], 0],
  ])("%j → %d", (parts, want) => {
    expect(sharedRate(parts)).toBe(want)
  })
})
