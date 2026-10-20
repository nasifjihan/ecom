import { describe, expect, it } from "vitest"
import {
  checkCoupon,
  needsUsage,
  type CouponLine,
  type CouponRule,
} from "../../src/modules/marketing/coupon.rules"

const NOW = new Date("2026-10-21T10:00:00Z")
const DAY = 86_400_000
const SF = 1n

const coupon = (over: Partial<CouponRule> = {}): CouponRule => ({
  code: "SAVE",
  type: "PERCENTAGE",
  amount: 10 as unknown as CouponRule["amount"],
  isActive: true,
  storefrontIds: [],
  startsAt: null,
  expiresAt: null,
  totalUsageLimit: null,
  usageCount: 0,
  minSubtotal: null,
  maxSubtotal: null,
  customerEmails: null,
  perCustomerLimit: null,
  newCustomersOnly: false,
  productIds: null,
  excludeProductIds: null,
  categoryIds: null,
  excludeSales: false,
  worksWithPromotions: true,
  freeShipping: false,
  ...over,
})
const money = (n: number) => n as unknown as CouponRule["amount"]

const line = (
  productId: string,
  unitPrice: number,
  qty = 1,
  over: Partial<CouponLine> = {},
): CouponLine => ({
  productId,
  categoryIds: ["10"],
  unitPrice,
  qty,
  lineSubtotal: unitPrice * qty,
  onSale: false,
  flash: false,
  ...over,
})
// Shirt ৳1,000 ×2 in category 10, saree ৳3,000 on sale in category 20.
const CART = [line("1", 1000, 2), line("2", 3000, 1, { categoryIds: ["20"], onSale: true })]
const run = (c: CouponRule, lines = CART, o: Partial<Parameters<typeof checkCoupon>[2]> = {}) =>
  checkCoupon(c, lines, { now: NOW, storefrontId: SF, ...o })

describe("checkCoupon: what each type takes off", () => {
  it.each([
    ["10% of the cart", coupon(), 500],
    ["৳300 off the cart", coupon({ type: "FIXED_CART", amount: money(300) }), 300],
    ["৳250 off each item", coupon({ type: "FIXED_PRODUCT", amount: money(250) }), 750],
    [
      "৳1,500 off each item, at most its price (2 × ৳1,000 + ৳1,500)",
      coupon({ type: "FIXED_PRODUCT", amount: money(1500) }),
      3500,
    ],
    [
      "a fixed amount bigger than the cart is capped",
      coupon({ type: "FIXED_CART", amount: money(9000) }),
      5000,
    ],
    ["33.333% is rounded to the paisa", coupon({ amount: money(33.333) }), 1666.65],
  ])("%s", (_, c, discount) => {
    expect(run(c)).toMatchObject({ ok: true, discount, subtotal: 5000 })
  })

  it("free delivery takes nothing off the goods", () => {
    expect(run(coupon({ type: "FREE_SHIPPING", amount: money(0) }))).toEqual({
      ok: true,
      discount: 0,
      freeShipping: true,
      subtotal: 5000,
    })
  })
  it("a money coupon can add free delivery", () => {
    expect(run(coupon({ freeShipping: true }))).toMatchObject({
      ok: true,
      discount: 500,
      freeShipping: true,
    })
  })
})

describe("checkCoupon: when it can't be used", () => {
  it.each([
    ["switched off", coupon({ isActive: false }), {}, "This coupon code is not valid"],
    [
      "for another storefront",
      coupon({ storefrontIds: [2n] }),
      {},
      "This coupon code is not valid",
    ],
    [
      "not started",
      coupon({ startsAt: new Date(NOW.getTime() + DAY) }),
      {},
      "This coupon is not active yet",
    ],
    ["expired", coupon({ expiresAt: new Date(NOW.getTime() - 1) }), {}, "This coupon has expired"],
    [
      "used up",
      coupon({ totalUsageLimit: 5, usageCount: 5 }),
      {},
      "This coupon has reached its usage limit",
    ],
    [
      "cart too small",
      coupon({ minSubtotal: money(5500) }),
      {},
      "Add ৳500 more to use this coupon (minimum ৳5500)",
    ],
    [
      "cart too big",
      coupon({ maxSubtotal: money(4000) }),
      {},
      "This coupon only applies to orders up to ৳4000",
    ],
    [
      "given to someone, no email",
      coupon({ customerEmails: ["a@x.com"] }),
      {},
      "Enter your email to use this coupon",
    ],
    [
      "given to someone else",
      coupon({ customerEmails: ["a@x.com"] }),
      { email: "b@x.com" },
      "This coupon is not available for your account",
    ],
    [
      "already used the allowed times",
      coupon({ perCustomerLimit: 1 }),
      { email: "b@x.com", usage: { withCoupon: 1, orders: 3 } },
      "You have already used this coupon",
    ],
    [
      "first orders only, has ordered",
      coupon({ newCustomersOnly: true }),
      { email: "b@x.com", usage: { withCoupon: 0, orders: 1 } },
      "This coupon is for first orders only",
    ],
    [
      "no item qualifies",
      coupon({ productIds: ["99"] }),
      {},
      "This coupon does not apply to the items in your cart",
    ],
  ])("%s", (_, c, o, error) => {
    expect(run(c, CART, o)).toEqual({ ok: false, error })
  })

  it("the first failing check gives the message (expired before too small)", () => {
    expect(run(coupon({ expiresAt: new Date(0), minSubtotal: money(99999) }))).toEqual({
      ok: false,
      error: "This coupon has expired",
    })
  })
  it("passes on the edges: exactly the minimum, the start time, its storefront, an email in any case", () => {
    expect(
      run(
        coupon({
          minSubtotal: money(5000),
          startsAt: NOW,
          storefrontIds: [SF],
          customerEmails: ["B@X.com"],
        }),
        CART,
        { email: "b@x.com" },
      ).ok,
    ).toBe(true)
  })
  it("one use left still works", () => {
    expect(
      run(coupon({ perCustomerLimit: 2 }), CART, {
        email: "b@x.com",
        usage: { withCoupon: 1, orders: 4 },
      }).ok,
    ).toBe(true)
  })
})

describe("checkCoupon: which items count", () => {
  it.each([
    ["only some products", coupon({ productIds: ["1"] }), 200],
    ["all but some products", coupon({ excludeProductIds: ["1"] }), 300],
    ["a category", coupon({ categoryIds: ["20"] }), 300],
    ["not sale items", coupon({ excludeSales: true }), 200],
  ])("%s", (_, c, discount) => {
    expect(run(c)).toMatchObject({ ok: true, discount })
  })

  it("works on prices after promotions when it works with them", () => {
    expect(run(coupon(), CART, { promoOff: [200, 0] })).toMatchObject({ ok: true, discount: 480 })
  })
  it("otherwise uses full prices and leaves out flash-sale items", () => {
    const lines = [line("1", 1000, 2), line("3", 500, 1, { flash: true })]
    expect(
      run(coupon({ worksWithPromotions: false }), lines, { promoOff: [200, 100] }),
    ).toMatchObject({ ok: true, discount: 200 })
  })
})

describe("needsUsage", () => {
  it("only looks up the customer's orders when a rule needs them and there's an email", () => {
    expect(needsUsage({ perCustomerLimit: 1, newCustomersOnly: false }, "a@x.com")).toBe(true)
    expect(needsUsage({ perCustomerLimit: null, newCustomersOnly: true }, "a@x.com")).toBe(true)
    expect(needsUsage({ perCustomerLimit: 1, newCustomersOnly: false }, undefined)).toBe(false)
    expect(needsUsage({ perCustomerLimit: null, newCustomersOnly: false }, "a@x.com")).toBe(false)
  })
})
