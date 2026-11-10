import { describe, expect, it } from "vitest"
import {
  byTrending,
  publicName,
  searchTerm,
  TRACK_STEPS,
  trackStep,
  waitingForReview,
} from "../../src/modules/storefront/engagement.rules"

describe("searchTerm", () => {
  it.each([
    ["  Eid   PANJABI!! ", "eid panjabi"],
    ["Men's shirt", "men's shirt"],
    ["জামদানি শাড়ি", "জামদানি শাড়ি"],
    ["a", null],
    ["", null],
    [null, null],
    ["01712345678", null],
    ["2026 0927 000037", null],
    ["iphone 15", "iphone 15"],
    ["x".repeat(61), null],
    ["<script>", "script"],
  ])("%j -> %j", (raw, want) => {
    expect(searchTerm(raw)).toBe(want)
  })
})

describe("trackStep", () => {
  it.each([
    ["PENDING", 0],
    ["ON_HOLD", 0],
    ["PROCESSING", 1],
    ["SHIPPED", 2],
    ["OUT_FOR_DELIVERY", 3],
    ["DELIVERED", 4],
    ["COMPLETED", 4],
    ["CANCELLED", -1],
    ["REFUNDED", -1],
  ])("%s -> %i", (status, step) => {
    expect(trackStep(status)).toBe(step)
  })
  it("has a label for every step", () => {
    expect(TRACK_STEPS.map((s) => s.label)).toHaveLength(5)
  })
})

describe("publicName", () => {
  it.each([
    ["Riya", "Akter", "Riya A."],
    ["Riya", "", "Riya"],
    ["", "", "Customer"],
    [null, null, "Customer"],
    ["", "Akter", "Akter"],
  ])("%j %j -> %s", (f, l, want) => {
    expect(publicName(f, l)).toBe(want)
  })
})

describe("byTrending", () => {
  const rows = [
    { id: 1n, sold: 50 },
    { id: 2n, sold: 10 },
    { id: 3n, sold: 0 },
    { id: 4n, sold: 0 },
  ]
  it("puts this week's sellers first, then all-time sales, then the newest", () => {
    const week = new Map([[3n, 5], [2n, 1]])
    expect([...rows].sort(byTrending(week)).map((r) => r.id)).toEqual([3n, 2n, 1n, 4n])
  })
  it("is the best-seller order when nothing sold this week", () => {
    expect([...rows].sort(byTrending(new Map())).map((r) => r.id)).toEqual([1n, 2n, 4n, 3n])
  })
})

describe("waitingForReview", () => {
  it("keeps delivered products not reviewed yet, each once, newest order first", () => {
    const delivered = [{ productId: 7n, o: "B" }, { productId: 5n, o: "B" }, { productId: 7n, o: "A" }, { productId: null, o: "A" }, { productId: 9n, o: "A" }]
    expect(waitingForReview(delivered, [5n])).toEqual([{ productId: 7n, o: "B" }, { productId: 9n, o: "A" }])
  })
  it("is empty when everything was reviewed", () => {
    expect(waitingForReview([{ productId: 1n }], [1n])).toEqual([])
  })
})
