import { describe, expect, it } from "vitest"
import {
  optionsSummary,
  shippingOptions,
  type MethodForOptions,
} from "../../src/modules/shipping/shipping.rules"

const method = (code: string, over: Partial<MethodForOptions> = {}): MethodForOptions => ({
  id: code,
  zoneId: "z1",
  code,
  name: code,
  baseCost: 100,
  deliveryEstimateMinDays: 2,
  deliveryEstimateMaxDays: 3,
  ...over,
})
const cart = (subtotal: number, weightKG = 0.5, qty = 1) => ({ subtotal, weightKG, qty })

describe("shippingOptions", () => {
  it("lists what the cart can use, cheapest first", () => {
    const out = shippingOptions(
      [
        method("express", { baseCost: 200, deliveryEstimateMinDays: 0 }),
        method("std"),
        method("off", { enabled: false }),
      ],
      cart(1000),
    )
    expect(out.map((o) => [o.code, o.finalRateBDT])).toEqual([
      ["std", 100],
      ["express", 200],
    ])
  })

  it.each([
    ["flat rate", method("m"), cart(500), 100],
    [
      "extra kilos above the first half kilo",
      method("m", { costRules: { perKgExtra: 20 } }),
      cart(500, 2.2),
      140,
    ],
    ["per item", method("m", { perItemCost: 10 }), cart(500, 0.5, 3), 130],
    [
      "weight tiers",
      method("m", {
        costRules: {
          weightTiers: [
            { upToKg: 1, cost: 60 },
            { upToKg: 3, cost: 90 },
          ],
        },
      }),
      cart(500, 2),
      90,
    ],
    [
      "a minimum charge",
      method("m", { baseCost: 30, costRules: { minimumCost: 50 } }),
      cart(500),
      50,
    ],
  ])("%s", (_, m, c, cost) => {
    expect(shippingOptions([m], c)[0]?.finalRateBDT).toBe(cost)
  })

  it("free from a set amount, showing what was saved", () => {
    const [o] = shippingOptions([method("m", { freeFromSubtotal: 2000 })], cart(2000))
    expect(o).toMatchObject({
      finalRateBDT: 0,
      savingsBDT: 100,
      freeReason: "Free delivery on orders from 2000.00",
    })
    expect(shippingOptions([method("m", { freeFromSubtotal: 2000 })], cart(1999))[0]).toMatchObject(
      { finalRateBDT: 100, savingsBDT: 0, freeReason: null },
    )
  })

  it("leaves out a method that needs a bigger order", () => {
    expect(
      shippingOptions([method("m", { costRules: { minSubtotal: 1500 } })], cart(1000)),
    ).toEqual([])
  })
})

describe("optionsSummary", () => {
  it("picks the cheapest and the fastest (unknown days count as slowest)", () => {
    const opts = shippingOptions(
      [
        method("std"),
        method("express", { baseCost: 200, deliveryEstimateMinDays: 0 }),
        method("unknown", { baseCost: 50, deliveryEstimateMinDays: null }),
      ],
      cart(1000),
    )
    const s = optionsSummary(opts, { id: "z1", name: "Dhaka" })
    expect([s.cheapest?.code, s.fastest?.code, s.zonesMatched, s.reason]).toEqual([
      "unknown",
      "express",
      3,
      null,
    ])
  })
  it("on equal days the cheaper one is the fastest", () => {
    const opts = shippingOptions(
      [method("a", { baseCost: 150 }), method("b", { baseCost: 120 })],
      cart(1000),
    )
    expect(optionsSummary(opts, null).fastest?.code).toBe("b")
  })
  it("says why when nothing is offered", () => {
    expect(optionsSummary([], null)).toMatchObject({
      cheapest: null,
      fastest: null,
      reason: "No shipping options available for this address.",
    })
  })
})
