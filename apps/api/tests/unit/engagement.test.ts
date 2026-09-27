import { describe, expect, it } from "vitest"
import {
  publicName,
  searchTerm,
  TRACK_STEPS,
  trackStep,
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
