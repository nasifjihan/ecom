import { describe, it, expect } from "vitest"
import {
  describePromotion,
  evaluatePromotions,
  inScope,
  promotionState,
  type PromoLine,
  type PromoRule,
} from "../../src/modules/marketing/promotions.rules"

const line = (
  key: string,
  unitPrice: number,
  qty: number,
  o: Partial<PromoLine> = {},
): PromoLine => ({
  key,
  productId: key,
  name: `Product ${key}`,
  categoryIds: [],
  unitPrice,
  qty,
  onSale: false,
  ...o,
})
const promo = (id: string, o: Partial<PromoRule>): PromoRule => ({
  id,
  name: `Promo ${id}`,
  type: "discount",
  productIds: [],
  categoryIds: [],
  ...o,
})

describe("inScope", () => {
  const shirt = line("1", 500, 1, { categoryIds: ["10"] })
  it.each([
    [{}, true],
    [{ productIds: ["1"] }, true],
    [{ productIds: ["2"] }, false],
    [{ categoryIds: ["10"] }, true],
    [{ categoryIds: ["11"] }, false],
    [{ productIds: ["2"], categoryIds: ["10"] }, true],
  ])("scope %j -> %s", (o, want) => {
    expect(inScope(promo("p", o), shirt)).toBe(want)
  })

  it("leaves sale items out of discounts unless asked, but not out of spend thresholds", () => {
    const sale = line("1", 500, 1, { onSale: true })
    expect(inScope(promo("p", { type: "discount" }), sale)).toBe(false)
    expect(inScope(promo("p", { type: "bxgy" }), sale)).toBe(false)
    expect(inScope(promo("p", { type: "discount", includeSaleItems: true }), sale)).toBe(true)
    expect(inScope(promo("p", { type: "free_delivery" }), sale)).toBe(true)
    expect(inScope(promo("p", { type: "free_gift" }), sale)).toBe(true)
  })
})

describe("evaluatePromotions: discounts", () => {
  it("applies a percentage off the whole cart", () => {
    const r = evaluatePromotions(
      [line("a", 1000, 2)],
      [promo("p", { discountType: "percentage", discountValue: 10 })],
    )
    expect(r.discount).toEqual({ id: "p", name: "Promo p", amount: 200 })
    expect(r.total).toBe(200)
    expect(r.lineDiscounts).toEqual({ a: 200 })
  })

  it("caps a percentage at the maximum", () => {
    const r = evaluatePromotions(
      [line("a", 5000, 1)],
      [promo("p", { discountType: "percentage", discountValue: 20, maxDiscount: 500 })],
    )
    expect(r.discount?.amount).toBe(500)
  })

  it("never takes a fixed amount below zero", () => {
    const r = evaluatePromotions(
      [line("a", 300, 1)],
      [promo("p", { discountType: "fixed", discountValue: 500 })],
    )
    expect(r.discount?.amount).toBe(300)
  })

  it("applies only the best discount-type promotion", () => {
    const r = evaluatePromotions(
      [line("a", 1000, 3)],
      [
        promo("small", { discountType: "percentage", discountValue: 5 }),
        promo("big", { discountType: "fixed", discountValue: 400 }),
        promo("mid", { discountType: "percentage", discountValue: 10 }),
      ],
    )
    expect(r.discount?.id).toBe("big")
    expect(r.total).toBe(400)
  })

  it("discounts only items in scope and spreads the amount over them", () => {
    const r = evaluatePromotions(
      [
        line("a", 1000, 1, { categoryIds: ["shoes"] }),
        line("b", 500, 1, { categoryIds: ["shoes"] }),
        line("c", 2000, 1),
      ],
      [promo("p", { discountType: "percentage", discountValue: 10, categoryIds: ["shoes"] })],
    )
    expect(r.discount?.amount).toBe(150)
    expect(r.lineDiscounts).toEqual({ a: 100, b: 50 })
  })

  it("puts rounding on the last line so the shares add up", () => {
    const r = evaluatePromotions(
      [line("a", 100, 1), line("b", 100, 1), line("c", 100, 1)],
      [promo("p", { discountType: "fixed", discountValue: 100 })],
    )
    const shares = Object.values(r.lineDiscounts)
    expect(shares.reduce((s, v) => s + v, 0)).toBeCloseTo(100, 5)
    expect(shares).toEqual([33.33, 33.33, 33.34])
  })

  it("measures the minimum order on items in scope and nudges when short", () => {
    const p = promo("p", { discountType: "percentage", discountValue: 10, minOrder: 2000 })
    const r = evaluatePromotions([line("a", 1500, 1)], [p])
    expect(r.discount).toBeNull()
    expect(r.nudges).toEqual([
      {
        id: "p",
        name: "Promo p",
        type: "discount",
        amountShort: 500,
        message: "Add ৳500 more to get 10% off",
      },
    ])
    expect(evaluatePromotions([line("a", 1000, 2)], [p]).discount?.amount).toBe(200)
  })

  it("needs the minimum quantity", () => {
    const p = promo("p", { discountType: "fixed", discountValue: 100, minQty: 3 })
    const r = evaluatePromotions([line("a", 500, 2)], [p])
    expect(r.discount).toBeNull()
    expect(r.nudges[0]?.message).toBe("Add 1 more item to get ৳100 off")
    expect(evaluatePromotions([line("a", 500, 3)], [p]).discount?.amount).toBe(100)
  })

  it("does not nudge towards a scoped offer when nothing in the cart is in scope", () => {
    const r = evaluatePromotions(
      [line("a", 500, 1)],
      [
        promo("p", {
          discountType: "fixed",
          discountValue: 100,
          minOrder: 1000,
          productIds: ["z"],
        }),
      ],
    )
    expect(r.nudges).toEqual([])
  })

  it("skips nudges for discounts smaller than the one applied", () => {
    const r = evaluatePromotions(
      [line("a", 1000, 1)],
      [
        promo("now", { discountType: "fixed", discountValue: 300 }),
        promo("worse", { discountType: "fixed", discountValue: 200, minOrder: 1500 }),
        promo("better", { discountType: "percentage", discountValue: 25, minOrder: 2000 }),
      ],
    )
    expect(r.discount?.id).toBe("now")
    expect(r.nudges.map((n) => n.id)).toEqual(["better"])
  })
})

describe("evaluatePromotions: buy X get Y", () => {
  const b2g1 = promo("b", { type: "bxgy", buyQty: 2, getQty: 1 })

  it.each([
    [1, 0, 0],
    [2, 0, 0],
    [3, 1, 400],
    [5, 1, 400],
    [6, 2, 800],
  ])("%i units -> %i free worth %i", (qty, free, amount) => {
    const r = evaluatePromotions([line("a", 400, qty)], [b2g1])
    expect(r.bxgy[0]?.freeUnits ?? 0).toBe(free)
    expect(r.total).toBe(amount)
  })

  it("tells the customer to add the free unit", () => {
    const r = evaluatePromotions([line("a", 400, 2)], [b2g1])
    expect(r.nudges).toEqual([
      {
        id: "b",
        name: "Promo b",
        type: "bxgy",
        qtyShort: 1,
        message: "Add 1 more Product a: it's free (Buy 2 get 1 free)",
      },
    ])
    expect(evaluatePromotions([line("a", 400, 1)], [b2g1]).nudges).toEqual([])
  })

  it("counts each product on its own, variants together, cheapest units free", () => {
    const r = evaluatePromotions(
      [
        line("a-red", 500, 2, { productId: "a", name: "Product a" }),
        line("a-blue", 450, 1, { productId: "a", name: "Product a" }),
        line("b", 900, 2),
      ],
      [b2g1],
    )
    expect(r.bxgy).toEqual([
      {
        id: "b",
        name: "Promo b",
        productId: "a",
        productName: "Product a",
        freeUnits: 1,
        amount: 450,
      },
    ])
    expect(r.lineDiscounts).toEqual({ "a-blue": 450 })
  })

  it("stacks with the discount, which comes off what's left", () => {
    const r = evaluatePromotions(
      [line("a", 400, 3)],
      [b2g1, promo("d", { discountType: "percentage", discountValue: 10 })],
    )
    expect(r.bxgy[0]?.amount).toBe(400)
    expect(r.discount?.amount).toBe(80)
    expect(r.total).toBe(480)
    expect(r.lineDiscounts).toEqual({ a: 480 })
  })

  it("uses the better of two offers on the same product", () => {
    const r = evaluatePromotions(
      [line("a", 100, 4)],
      [b2g1, promo("b11", { type: "bxgy", buyQty: 1, getQty: 1 })],
    )
    expect(r.bxgy.map((b) => [b.id, b.freeUnits])).toEqual([["b11", 2]])
  })

  it("ignores items already on sale", () => {
    expect(evaluatePromotions([line("a", 400, 3, { onSale: true })], [b2g1]).total).toBe(0)
  })
})

describe("evaluatePromotions: gifts and free delivery", () => {
  const gift = promo("g", {
    type: "free_gift",
    minOrder: 3000,
    gift: { productId: "99", variantId: null, qty: 1, name: "Tote bag" },
  })
  const ship = promo("s", { type: "free_delivery", minOrder: 1500 })

  it("adds the gift and free delivery once the spend is reached", () => {
    const r = evaluatePromotions([line("a", 1600, 2)], [gift, ship])
    expect(r.gifts).toEqual([
      { id: "g", name: "Promo g", productId: "99", variantId: null, qty: 1 },
    ])
    expect(r.freeDelivery).toEqual({ id: "s", name: "Promo s" })
    expect(r.total).toBe(0)
    expect(r.nudges).toEqual([])
  })

  it("nudges the closest offers first", () => {
    const r = evaluatePromotions([line("a", 1000, 1)], [gift, ship])
    expect(r.gifts).toEqual([])
    expect(r.freeDelivery).toBeNull()
    expect(r.nudges.map((n) => n.message)).toEqual([
      "Add ৳500 more for free delivery",
      "Add ৳2,000 more to get a free gift (Tote bag)",
    ])
  })

  it("counts sale items toward the spend", () => {
    expect(
      evaluatePromotions([line("a", 1500, 1, { onSale: true })], [ship]).freeDelivery?.id,
    ).toBe("s")
  })

  it("says 'of the offer items' when the offer is scoped", () => {
    const r = evaluatePromotions(
      [line("a", 1000, 1, { categoryIds: ["kids"] })],
      [promo("s", { type: "free_delivery", minOrder: 1500, categoryIds: ["kids"] })],
    )
    expect(r.nudges[0]?.message).toBe("Add ৳500 more of the offer items for free delivery")
  })

  it("returns nothing for an empty cart", () => {
    expect(evaluatePromotions([], [gift, ship]).nudges).toEqual([])
  })
})

describe("describePromotion and promotionState", () => {
  it.each([
    [{ discountType: "percentage", discountValue: 20, maxDiscount: 500 }, "20% off (up to ৳500)"],
    [{ discountType: "fixed", discountValue: 300, minOrder: 2000 }, "৳300 off over ৳2,000"],
    [{ type: "bxgy", buyQty: 2, getQty: 1 }, "Buy 2 get 1 free"],
    [
      {
        type: "free_gift",
        minOrder: 3000,
        gift: { productId: "1", variantId: null, qty: 1, name: "Tote" },
      },
      "Free gift: Tote over ৳3,000",
    ],
    [{ type: "free_delivery", minQty: 3 }, "Free delivery on 3+ items"],
  ] as [Partial<PromoRule>, string][])("%j -> %s", (o, want) => {
    expect(describePromotion(promo("p", o))).toBe(want)
  })

  const now = new Date("2026-04-14T00:00:00Z")
  it.each([
    [{ isActive: true }, "live"],
    [{ isActive: false }, "paused"],
    [{ isActive: true, startsAt: new Date("2026-04-15") }, "scheduled"],
    [{ isActive: true, endsAt: new Date("2026-04-13") }, "ended"],
    [{ isActive: false, endsAt: new Date("2026-04-13") }, "ended"],
  ])("%j -> %s", (p, want) => {
    expect(promotionState(p, now)).toBe(want)
  })
})
