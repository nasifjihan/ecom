import { describe, expect, it } from "vitest"
import { DEFAULT_ORDER_CHECKS, afterCall, deliveryOutcome, phoneKeyOf, riskLevel } from "../../src/modules/orders/order-checks.rules"
import { editBlocker, editedTotals, newLineMoney, planEdit, scaleLine } from "../../src/modules/orders/order-edit.rules"
import { exchangeSplit } from "../../src/modules/fulfilment/exchange"

const s = DEFAULT_ORDER_CHECKS

describe("fraud check", () => {
  it("rates a number by its delivered share, high risk only with enough parcels", () => {
    expect(riskLevel({ delivered: 0, returned: 0 }, s)).toBe("new")
    expect(riskLevel({ delivered: 9, returned: 1 }, s)).toBe("good")
    expect(riskLevel({ delivered: 6, returned: 4 }, s)).toBe("watch")
    expect(riskLevel({ delivered: 1, returned: 3 }, s)).toBe("high")
    // Two parcels, both back: bad, but too few to call it high risk.
    expect(riskLevel({ delivered: 0, returned: 2 }, s)).toBe("watch")
  })

  it("counts failed and returned parcels as returned, and finished orders as delivered", () => {
    expect(deliveryOutcome({ status: "SHIPPED", fulfillmentStatus: "delivery_failed" })).toBe("returned")
    expect(deliveryOutcome({ status: "COMPLETED", fulfillmentStatus: "unfulfilled" })).toBe("delivered")
    expect(deliveryOutcome({ status: "PENDING", fulfillmentStatus: "unfulfilled" })).toBeNull()
  })

  it("looks orders up by the shipping phone, else the billing phone", () => {
    expect(phoneKeyOf({ shippingPhone: "+880 1711-000111", billingPhone: "01811000222" })).toBe("01711000111")
    expect(phoneKeyOf({ shippingPhone: "", billingPhone: "8801811000222" })).toBe("01811000222")
    expect(phoneKeyOf({ shippingPhone: "12345" })).toBeNull()
  })
})

describe("confirmation calls", () => {
  const now = new Date("2026-11-09T05:00:00Z")
  it("confirms or cancels the order by the outcome", () => {
    expect(afterCall("confirmed", 0, s, now)).toMatchObject({ tries: 1, status: "PROCESSING", nextCallAt: null })
    expect(afterCall("fake", 1, s, now).status).toBe("CANCELLED")
    expect(afterCall("wrong_number", 0, s, now)).toMatchObject({ status: null, nextCallAt: null })
  })
  it("brings no-answer orders back after the wait until the tries run out", () => {
    expect(afterCall("no_answer", 0, s, now).nextCallAt).toEqual(new Date("2026-11-09T07:00:00Z"))
    expect(afterCall("no_answer", 2, s, now)).toMatchObject({ tries: 3, nextCallAt: null })
  })
})

describe("editing an order", () => {
  const existing = [
    { id: "1", productId: "10", variantId: "100", productName: "Panjabi", quantity: 2 },
    { id: "2", productId: "20", variantId: null, productName: "Cap", quantity: 1 },
  ]
  it("splits the new list into kept, removed and added lines", () => {
    const p = planEdit(existing, [
      { orderItemId: "1", productId: "10", variantId: "100", quantity: 3 },
      { productId: "10", variantId: "101", quantity: 1 },
    ])
    expect(p.keep).toEqual([{ line: existing[0], quantity: 3 }])
    expect(p.add).toEqual([{ productId: "10", variantId: "101", quantity: 1 }])
    expect(p.remove).toEqual([existing[1]])
  })
  it("refuses an empty order, a doubled item and a size change in place", () => {
    expect(() => planEdit(existing, [])).toThrow(/Cancel the order/)
    expect(() => planEdit(existing, [{ productId: "20", quantity: 1 }])).toThrow(/already on the order/)
    expect(() => planEdit(existing, [{ orderItemId: "1", productId: "10", variantId: "101", quantity: 1 }])).toThrow(/remove it and add/)
  })
  it("only edits orders that haven't gone out", () => {
    expect(editBlocker({ status: "PROCESSING", parcels: 0, refunds: 0, returns: 0 })).toBeNull()
    expect(editBlocker({ status: "SHIPPED", parcels: 0, refunds: 0, returns: 0 })).toMatch(/haven't gone out/)
    expect(editBlocker({ status: "PENDING", parcels: 1, refunds: 0, returns: 0 })).toMatch(/parcel/)
  })
  it("keeps a line's price and discount per unit and prices new lines at the VAT rate", () => {
    expect(scaleLine({ quantity: 2, lineSubtotal: 2000, lineDiscount: 200, lineTax: 0, lineTotal: 1800 }, 3)).toEqual({ lineSubtotal: 3000, lineDiscount: 300, lineTax: 0, lineTotal: 2700 })
    expect(newLineMoney(1150, 15, true)).toEqual({ lineSubtotal: 1150, lineDiscount: 0, lineTax: 150, lineTotal: 1150 })
    expect(newLineMoney(1000, 15, false)).toEqual({ lineSubtotal: 1000, lineDiscount: 0, lineTax: 150, lineTotal: 1150 })
  })
  it("moves the totals by the item and delivery changes", () => {
    const before = [{ lineSubtotal: 2000, lineDiscount: 200, lineTax: 0, lineTotal: 1800 }]
    const after = [{ lineSubtotal: 1000, lineDiscount: 100, lineTax: 0, lineTotal: 900 }, newLineMoney(500, 0, false)]
    const o = { itemsSubtotal: 2000, discountTotal: 200, taxTotal: 0, shippingTotal: 60, grandTotal: 1860 }
    expect(editedTotals(o, before, after, 120)).toEqual({ itemsSubtotal: 1500, discountTotal: 100, taxTotal: 0, shippingTotal: 120, grandTotal: 1520 })
  })
})

describe("exchanges", () => {
  it("takes the returned items' value off the replacement and leaves the rest to refund", () => {
    expect(exchangeSplit(1200, 1500)).toEqual({ used: 1200, toRefund: 0 })
    expect(exchangeSplit(1200, 1000)).toEqual({ used: 1000, toRefund: 200 })
  })
})
