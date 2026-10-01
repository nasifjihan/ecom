import { describe, it, expect } from "vitest"
import { orderStatus, receiveDelivery, receivedValue, returnNumber, supplierBalance } from "../../src/modules/purchasing/purchasing.rules"

const lines = [
  { id: "1", qty: 10, qtyReceived: 0, landedUnitCost: 333.33 },
  { id: "2", qty: 5, qtyReceived: 0, landedUnitCost: 100 },
]

describe("purchase orders", () => {
  it("receives part of an order, then the rest", () => {
    const first = receiveDelivery(lines, [{ id: "1", qty: 4 }])
    expect(first).toEqual({ received: new Map([["1", 4], ["2", 0]]), units: 4 })
    const after = lines.map((l) => ({ ...l, qtyReceived: "received" in first ? first.received.get(l.id)! : 0 }))
    expect(orderStatus(after)).toBe("partial")
    expect(receivedValue(after, 3833.3)).toBe(1333.32)
    const rest = receiveDelivery(after, [{ id: "1", qty: 6 }, { id: "2", qty: 5 }])
    const done = after.map((l) => ({ ...l, qtyReceived: "received" in rest ? rest.received.get(l.id)! : 0 }))
    expect(orderStatus(done)).toBe("received")
    // Everything in: exactly the total, whatever the rounding.
    expect(receivedValue(done, 3833.3)).toBe(3833.3)
  })

  it("refuses more than is still to come, odd quantities and empty deliveries", () => {
    expect(receiveDelivery(lines, [{ id: "2", qty: 6 }])).toEqual({ error: "Only 5 more of a line can arrive" })
    expect(receiveDelivery(lines, [{ id: "1", qty: 1.5 }])).toEqual({ error: "Quantities are whole numbers of 0 or more" })
    expect(receiveDelivery(lines, [{ id: "1", qty: 0 }])).toEqual({ error: "Enter how many arrived" })
    expect(receiveDelivery(lines, [{ id: "9", qty: 1 }])).toEqual({ error: "That item isn't on this purchase" })
    // The same line twice counts both.
    expect(receiveDelivery(lines, [{ id: "2", qty: 3 }, { id: "2", qty: 3 }])).toEqual({ error: "Only 2 more of a line can arrive" })
  })

  it("is ordered until something arrives", () => {
    expect(orderStatus(lines)).toBe("ordered")
  })
})

describe("returns to suppliers", () => {
  it("take what's sent back off the balance", () => {
    expect(supplierBalance(0, 10000, 6000, 1500)).toBe(2500)
    expect(supplierBalance(0, 10000, 10000, 1500)).toBe(-1500) // credit with the supplier
  })
  it("are numbered RTS-", () => {
    expect(returnNumber(12)).toBe("RTS-000012")
  })
})
