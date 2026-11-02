import { describe, expect, it } from "vitest"
import { MAX_SAVED_LINES, mergeLines } from "../../src/modules/storefront/saved-cart"

const l = (productId: number, qty: number, variantId: number | null = null) => ({ productId: BigInt(productId), variantId: variantId === null ? null : BigInt(variantId), qty })

describe("joining two carts", () => {
  it("keeps every item once, at the larger quantity", () => {
    expect(mergeLines([l(1, 2), l(2, 1, 7)], [l(1, 1), l(2, 3, 7), l(2, 1, 8), l(3, 1)])).toEqual([l(1, 2), l(2, 3, 7), l(2, 1, 8), l(3, 1)])
  })

  it("treats a product without an option and with one as different items", () => {
    expect(mergeLines([l(1, 1)], [l(1, 1, 5)])).toHaveLength(2)
  })

  it("never keeps more than the limit", () => {
    const many = Array.from({ length: MAX_SAVED_LINES + 5 }, (_, i) => l(i + 1, 1))
    expect(mergeLines(many, [])).toHaveLength(MAX_SAVED_LINES)
  })
})
