import { describe, it, expect } from "vitest"
import { checkBoxes, takes, withParents, type BoxDef, type BoxLine } from "../../src/modules/giftboxes/giftbox.rules"

const def: BoxDef = {
  id: 1n,
  name: "Eid gift box",
  isActive: true,
  boxProductId: 100n,
  minItems: 2,
  maxItems: 4,
  productIds: [7n],
  categoryIds: [20n],
  allowMessage: true,
  messageMax: 20,
}
const defs = new Map([[1n, def]])
// Product 5 is in category 21, a child of 20; product 6 is in 30; product 7 is picked by hand.
const parentOf = new Map<bigint, bigint | null>([[20n, null], [21n, 20n], [30n, null]])
const cats: Record<string, bigint[]> = { "5": [21n], "6": [30n], "7": [30n], "100": [] }
const categoriesOf = (p: bigint) => withParents(cats[String(p)] ?? [], parentOf)

const tag = (role: "box" | "item", message?: string, key = "k1") => ({ key, giftBoxId: 1n, role, message })
const box = (message?: string, key = "k1"): BoxLine => ({ productId: 100n, qty: 1, box: tag("box", message, key) })
const item = (productId: bigint, qty = 1, key = "k1"): BoxLine => ({ productId, qty, box: tag("item", undefined, key) })

describe("gift boxes", () => {
  it("takes picked products and anything in its categories, but never the box itself", () => {
    expect(takes(def, 7n, categoriesOf(7n))).toBe(true)
    expect(takes(def, 5n, categoriesOf(5n))).toBe(true)
    expect(takes(def, 6n, categoriesOf(6n))).toBe(false)
    expect(takes({ ...def, productIds: [], categoryIds: [] }, 6n, [])).toBe(true)
    expect(takes({ ...def, productIds: [], categoryIds: [] }, 100n, [])).toBe(false)
  })

  it("accepts a good box and keeps its name and message", () => {
    const r = checkBoxes([{ productId: 9n, qty: 1 }, box(" Eid Mubarak! "), item(5n, 2), item(7n)], defs, categoriesOf)
    expect(r.problems).toEqual([])
    expect(r.boxes.get("k1")).toEqual({ key: "k1", giftBoxId: 1n, name: "Eid gift box", message: "Eid Mubarak!", items: 3 })
  })

  it("checks the number of items", () => {
    expect(checkBoxes([box(), item(5n)], defs, categoriesOf).problems).toEqual(['The "Eid gift box" gift box needs at least 2 items'])
    expect(checkBoxes([box(), item(5n, 3), item(7n, 2)], defs, categoriesOf).problems).toEqual(['The "Eid gift box" gift box holds at most 4 items'])
  })

  it("refuses products the box doesn't take, a wrong box line, and long messages", () => {
    expect(checkBoxes([box(), item(5n), item(6n)], defs, categoriesOf).problems[0]).toMatch(/can't go in it/)
    expect(checkBoxes([{ productId: 5n, qty: 1, box: tag("box") }, item(5n), item(7n)], defs, categoriesOf).problems[0]).toMatch(/isn't put together correctly/)
    expect(checkBoxes([item(5n), item(7n)], defs, categoriesOf).problems[0]).toMatch(/isn't put together correctly/)
    expect(checkBoxes([box("x".repeat(21)), item(5n), item(7n)], defs, categoriesOf).problems[0]).toMatch(/too long \(at most 20/)
    const noCard = new Map([[1n, { ...def, allowMessage: false }]])
    expect(checkBoxes([box("Hi"), item(5n), item(7n)], noCard, categoriesOf).problems[0]).toMatch(/doesn't come with a message card/)
  })

  it("checks each box on its own, and refuses boxes that were switched off", () => {
    const r = checkBoxes([box("A", "a"), item(5n, 1, "a"), item(7n, 1, "a"), box("B", "b"), item(5n, 1, "b")], defs, categoriesOf)
    expect(r.problems).toEqual(['The "Eid gift box" gift box needs at least 2 items'])
    expect([...r.boxes.keys()]).toEqual(["a"])
    const off = new Map([[1n, { ...def, isActive: false }]])
    expect(checkBoxes([box(), item(5n), item(7n)], off, categoriesOf).problems).toEqual(["A gift box in your cart is no longer available"])
  })
})
