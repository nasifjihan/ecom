import { describe, expect, it } from "vitest"
import {
  checkTransfer,
  pickWarehouse,
  receiptFor,
  skuKey,
  splitBack,
  transferCode,
  warehouseCode,
  type WarehouseOption,
} from "../../src/modules/stock/stock.rules"

const wh = (id: number, isDefault: boolean, stock: Record<string, number>): WarehouseOption => ({
  id: BigInt(id),
  isDefault,
  available: new Map(Object.entries(stock)),
})

describe("skuKey", () => {
  it("names an option by its id and a product without options by the product", () => {
    expect(skuKey(5n, 12n)).toBe("v12")
    expect(skuKey(5n, null)).toBe("p5")
    expect(skuKey("5", undefined)).toBe("p5")
  })
})

describe("pickWarehouse", () => {
  const main = wh(1, true, { p1: 5, v7: 1 })
  const ctg = wh(2, false, { p1: 10, v7: 4 })
  const syl = wh(3, false, { p1: 10 })

  it("uses the default warehouse when it has everything", () => {
    expect(pickWarehouse([ctg, main], [{ key: "p1", qty: 5 }])).toBe(1n)
  })
  it("moves to the first warehouse that has everything", () => {
    expect(
      pickWarehouse(
        [main, syl, ctg],
        [
          { key: "p1", qty: 2 },
          { key: "v7", qty: 2 },
        ],
      ),
    ).toBe(2n)
    expect(pickWarehouse([main, syl, ctg], [{ key: "p1", qty: 8 }])).toBe(3n)
  })
  it("stays with the default when no single warehouse has it all", () => {
    expect(pickWarehouse([main, ctg, syl], [{ key: "p1", qty: 11 }])).toBe(1n)
    expect(pickWarehouse([main, ctg], [{ key: "x9", qty: 1 }])).toBe(1n)
  })
  it("uses the first warehouse when none is marked default, and null when there are none", () => {
    expect(pickWarehouse([ctg, syl], [{ key: "p1", qty: 100 }])).toBe(2n)
    expect(pickWarehouse([], [{ key: "p1", qty: 1 }])).toBeNull()
  })
  it("an order with nothing to hold ships from the default", () => {
    expect(pickWarehouse([ctg, main], [])).toBe(1n)
  })
})

describe("splitBack", () => {
  it.each([
    [3, 3, 3, 0], // nothing packed yet: just stop holding them
    [3, 0, 0, 3], // all packed and shipped: back on the shelf
    [5, 2, 2, 3], // part of each
    [2, 5, 2, 0],
    [0, 4, 0, 0],
    [2, -1, 0, 2],
  ])("%i back with %i reserved → release %i, receive %i", (qty, reserved, release, receive) => {
    expect(splitBack(qty, reserved)).toEqual({ release, receive })
  })
})

describe("receiptFor", () => {
  const lines = [
    { id: "1", name: "Panjabi", qtySent: 10 },
    { id: "2", name: "Saree", qtySent: 4 },
  ]
  it("takes unlisted lines as arrived in full", () => {
    expect(receiptFor(lines, [])).toEqual({
      lines: [
        { id: "1", received: 10, short: 0 },
        { id: "2", received: 4, short: 0 },
      ],
      totalShort: 0,
    })
  })
  it("works out the shortfall", () => {
    const r = receiptFor(lines, [
      { id: "1", qty: 8 },
      { id: "2", qty: 0 },
    ])
    expect(r).toEqual({
      lines: [
        { id: "1", received: 8, short: 2 },
        { id: "2", received: 0, short: 4 },
      ],
      totalShort: 6,
    })
  })
  it.each([
    [[{ id: "1", qty: 11 }], "Only 10"],
    [[{ id: "1", qty: -1 }], "whole numbers"],
    [[{ id: "1", qty: 1.5 }], "whole numbers"],
    [[{ id: "9", qty: 1 }], "isn't part"],
  ])("refuses %j", (received, msg) => {
    const r = receiptFor(lines, received)
    expect("error" in r && r.error).toContain(msg)
  })
})

describe("checkTransfer", () => {
  it.each([
    ["1", "1", [{ key: "p1", qty: 1 }], "different warehouses"],
    ["1", "2", [], "at least one"],
    ["1", "2", [{ key: "p1", qty: 0 }], "whole numbers"],
    ["1", "2", [{ key: "p1", qty: 2.5 }], "whole numbers"],
    [
      "1",
      "2",
      [
        { key: "p1", qty: 1 },
        { key: "p1", qty: 2 },
      ],
      "only be on the transfer once",
    ],
  ])("%s → %s %j is refused", (from, to, items, msg) => {
    expect(checkTransfer(from, to, items)).toContain(msg)
  })
  it("accepts a good transfer", () => {
    expect(
      checkTransfer("1", "2", [
        { key: "p1", qty: 3 },
        { key: "v4", qty: 1 },
      ]),
    ).toBeNull()
  })
})

describe("codes", () => {
  it("numbers transfers", () => {
    expect(transferCode(1)).toBe("TR-0001")
    expect(transferCode(12345)).toBe("TR-12345")
  })
  it.each([
    ["main", "MAIN"],
    [" ctg hub ", "CTG-HUB"],
    ["Chattogram hub", null], // too long: ask for a shorter code
    ["ctg-2", "CTG-2"],
    ["x", null],
    ["Dhaka warehouse one", null],
    ["৳৳", null],
  ])("%j → %s", (input, code) => {
    expect(warehouseCode(input)).toBe(code)
  })
})
