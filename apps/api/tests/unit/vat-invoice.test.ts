import { describe, it, expect } from "vitest"
import { splitTaxOnTop, taxInside, vatLabel } from "../../src/modules/shipping/tax.rules"
import { cleanOrderPrefix, nextOrderNumber, orderNumberStem } from "../../src/modules/orders/order-number.rules"

describe("VAT inside prices", () => {
  it("finds the VAT already inside a VAT-inclusive amount", () => {
    expect(taxInside(115, 17.25)).toBe(15) // 15%
    expect(taxInside(1150, 172.5)).toBe(150)
    expect(taxInside(105, 5.25)).toBe(5) // 5%
    expect(taxInside(80, 12)).toBe(10.43)
    expect(taxInside(0, 10)).toBe(0)
    expect(taxInside(100, 0)).toBe(0)
  })

  it("splits tax on top between goods and delivery", () => {
    expect(splitTaxOnTop(165, 1000, 100)).toEqual({ items: 150, shipping: 15 })
    expect(splitTaxOnTop(150, 1000, 0)).toEqual({ items: 150, shipping: 0 })
    expect(splitTaxOnTop(0, 1000, 100)).toEqual({ items: 0, shipping: 0 })
    const s = splitTaxOnTop(10.01, 33.33, 33.34)
    expect(s.items + s.shipping).toBeCloseTo(10.01, 2)
  })

  it("names the rate when the order kept it", () => {
    expect(vatLabel(15)).toBe("VAT 15%")
    expect(vatLabel("7.50")).toBe("VAT 7.5%")
    expect(vatLabel(null)).toBe("VAT")
    expect(vatLabel(15, "ভ্যাট")).toBe("ভ্যাট 15%")
  })
})

describe("order number prefix", () => {
  it("accepts 1–6 letters or digits, in capitals, without the dash", () => {
    expect(cleanOrderPrefix("fbd")).toBe("FBD")
    expect(cleanOrderPrefix(" FBD- ")).toBe("FBD")
    expect(cleanOrderPrefix("")).toBeNull()
    expect(cleanOrderPrefix(null)).toBeNull()
    expect(cleanOrderPrefix("TOOLONG")).toBeUndefined()
    expect(cleanOrderPrefix("A B")).toBeUndefined()
    expect(cleanOrderPrefix("ফ্যাশন")).toBeUndefined()
  })

  it("counts up within the day, after the prefix", () => {
    const day = new Date(2026, 9, 1)
    expect(orderNumberStem("FBD", day)).toBe("FBD-20261001")
    expect(orderNumberStem(null, day)).toBe("20261001")
    expect(nextOrderNumber("FBD-20261001", null)).toBe("FBD-20261001000001")
    expect(nextOrderNumber("FBD-20261001", "FBD-20261001000041")).toBe("FBD-20261001000042")
    expect(nextOrderNumber("20261001", "20261001000009")).toBe("20261001000010")
  })
})
