import { describe, it, expect } from "vitest"
import {
  marginOf,
  priceForMargin,
  reviewTo,
  roundUp,
  tierFor,
  tierProblems,
  tierQty,
  tiersFor,
  withTier,
  type Tier,
} from "../../src/modules/wholesale/wholesale.rules"

const t = (minQty: number, price: number, forEveryone = false, variantId: bigint | null = null): Tier => ({ minQty, price, forEveryone, variantId })

describe("bulk price tiers", () => {
  const tiers = [t(10, 900), t(50, 800), t(5, 950, true), t(20, 700, false, 7n)]

  it("uses an option's own tiers when it has any, else the product's", () => {
    expect(tiersFor(tiers, 7n, true).map((x) => x.minQty)).toEqual([20])
    expect(tiersFor(tiers, 8n, true).map((x) => x.minQty)).toEqual([5, 10, 50])
    expect(tiersFor(tiers, null, true).map((x) => x.minQty)).toEqual([5, 10, 50])
  })

  it("gives business-only tiers to approved business accounts only", () => {
    expect(tiersFor(tiers, null, false).map((x) => x.minQty)).toEqual([5])
    expect(tierFor(tiers, null, 60, false)).toMatchObject({ minQty: 5, price: 950 })
    expect(tierFor(tiers, null, 60, true)).toMatchObject({ minQty: 50, price: 800 })
  })

  it("picks the highest minimum the quantity reaches", () => {
    expect(tierFor(tiers, null, 4, true)).toBeNull()
    expect(tierFor(tiers, null, 5, true)?.price).toBe(950)
    expect(tierFor(tiers, null, 49, true)?.price).toBe(900)
    expect(tierFor(tiers, 7n, 19, true)).toBeNull()
  })

  it("takes the cheaper when both audiences share a minimum", () => {
    expect(tierFor([t(10, 900, true), t(10, 850)], null, 10, true)?.price).toBe(850)
    expect(tierFor([t(10, 900, true), t(10, 850)], null, 10, false)?.price).toBe(900)
  })

  it("counts every option together for product-wide tiers", () => {
    const lines = [{ variantId: 7n, qty: 4 }, { variantId: 8n, qty: 5 }, { variantId: 9n, qty: 6 }]
    expect(tierQty(tiers, lines, 8n)).toBe(11)
    expect(tierQty(tiers, lines, 9n)).toBe(11)
    expect(tierQty(tiers, lines, 7n)).toBe(4)
    expect(tierQty(tiers, [{ variantId: null, qty: 3 }], null)).toBe(3)
  })

  it("applies a tier only when it beats the price the line already has", () => {
    expect(withTier(1000, { minQty: 10, price: 900, forEveryone: false })).toEqual({ price: 900, tier: { minQty: 10, price: 900, forEveryone: false } })
    expect(withTier(850, { minQty: 10, price: 900, forEveryone: false })).toEqual({ price: 850, tier: null })
    expect(withTier(850, null)).toEqual({ price: 850, tier: null })
  })

  it("checks a set of tiers before saving", () => {
    const label = (v: bigint | null) => (v ? `Option ${v}` : "Product")
    expect(tierProblems([{ variantId: null, minQty: 10, price: 900, forEveryone: false }, { variantId: null, minQty: 10, price: 950, forEveryone: true }], label)).toEqual([])
    expect(tierProblems([{ variantId: null, minQty: 1, price: 0, forEveryone: false }], label)).toEqual([
      "Product: the minimum quantity must be 2 or more",
      "Product: enter a price above zero",
    ])
    expect(tierProblems([{ variantId: 3n, minQty: 10, price: 900, forEveryone: false }, { variantId: 3n, minQty: 10, price: 800, forEveryone: false }], label)).toEqual([
      "Option 3 (business): two prices for 10+",
    ])
    expect(tierProblems([{ variantId: null, minQty: 10, price: 800, forEveryone: true }, { variantId: null, minQty: 20, price: 850, forEveryone: true }], label)).toEqual([
      "Product (everyone): 20+ costs more than 10+",
    ])
  })
})

describe("business account reviews", () => {
  it("allows only sensible moves", () => {
    expect(reviewTo("approve", "PENDING")).toBe("APPROVED")
    expect(reviewTo("approve", "SUSPENDED")).toBe("APPROVED")
    expect(reviewTo("approve", "APPROVED")).toBeNull()
    expect(reviewTo("reject", "PENDING")).toBe("REJECTED")
    expect(reviewTo("reject", "APPROVED")).toBeNull()
    expect(reviewTo("suspend", "APPROVED")).toBe("SUSPENDED")
    expect(reviewTo("suspend", "PENDING")).toBeNull()
  })
})

describe("pricing by margin", () => {
  it("works out the margin as a share of the price", () => {
    expect(marginOf(600, 1000)).toBe(40)
    expect(marginOf(700, 999)).toBe(29.9)
    expect(marginOf(null, 1000)).toBeNull()
    expect(marginOf(100, 0)).toBeNull()
    expect(marginOf(1200, 1000)).toBe(-20)
  })

  it("rounds prices up so the margin is kept", () => {
    expect(roundUp(1234.561, "none")).toBe(1234.56)
    expect(roundUp(1234.2, "1")).toBe(1235)
    expect(roundUp(1234, "1")).toBe(1234)
    expect(roundUp(1231, "5")).toBe(1235)
    expect(roundUp(1235, "5")).toBe(1235)
    expect(roundUp(1231, "10")).toBe(1240)
    expect(roundUp(1231, "end9")).toBe(1239)
    expect(roundUp(1239, "end9")).toBe(1239)
    expect(roundUp(1239.5, "end9")).toBe(1249)
    expect(roundUp(1240, "end9")).toBe(1249)
  })

  it("prices for a target margin", () => {
    expect(priceForMargin(600, 40, "none")).toBe(1000)
    expect(priceForMargin(600, 40, "end9")).toBe(1009)
    expect(priceForMargin(700, 30, "10")).toBe(1000)
    expect(priceForMargin(500, 0, "none")).toBe(500)
    expect(priceForMargin(500, 100, "none")).toBeNull()
    expect(marginOf(600, priceForMargin(600, 35, "5"))).toBeGreaterThanOrEqual(35)
  })
})
