import { describe, expect, it } from "vitest"
import {
  cashbackFor,
  cashbackToReverse,
  levelFor,
  memberDiscount,
  nextLevel,
  orderSpend,
  referralCode,
  referralProblem,
  walletUse,
} from "../../src/modules/loyalty/loyalty.rules"

const levels = [
  { id: 1n, name: "Bronze", minSpend: 0, discountPercent: 0, cashbackPercent: 0 },
  { id: 3n, name: "Gold", minSpend: 30000, discountPercent: 5, cashbackPercent: 2 },
  { id: 2n, name: "Silver", minSpend: 10000, discountPercent: 2, cashbackPercent: 1 },
]

describe("levels", () => {
  it.each([
    [0, "Bronze"],
    [9999.99, "Bronze"],
    [10000, "Silver"],
    [29999, "Silver"],
    [30000, "Gold"],
    [1_000_000, "Gold"],
  ])("%d spent → %s", (spend, name) => {
    expect(levelFor(spend, levels)?.name).toBe(name)
  })
  it("has no level below the lowest minimum", () => {
    expect(levelFor(500, [{ minSpend: 1000 }])).toBeNull()
    expect(levelFor(500, [])).toBeNull()
  })
  it("says how far the next level is", () => {
    expect(nextLevel(2500, levels)).toMatchObject({ level: { name: "Silver" }, needed: 7500 })
    expect(nextLevel(10000, levels)).toMatchObject({ level: { name: "Gold" }, needed: 20000 })
    expect(nextLevel(30000, levels)).toBeNull()
  })
  it("counts an order's items less discounts and refunds, never below zero", () => {
    expect(orderSpend(5000, 500, 0)).toBe(4500)
    expect(orderSpend(5000, 500, 1000)).toBe(3500)
    expect(orderSpend(1000, 0, 1120)).toBe(0) // a refund that included delivery
  })
})

describe("member discount", () => {
  it.each([
    [4000, 5, 200],
    [3333, 2, 66.66],
    [4000, 0, 0],
    [0, 5, 0],
    [1000, 150, 1000],
  ])("%d at %d%% → %d", (items, pct, off) => {
    expect(memberDiscount(items, pct)).toBe(off)
  })
})

describe("wallet at checkout", () => {
  it.each([
    [1500, 500, 100, 500], // part of the order
    [1500, 2000, 100, 1500], // all of it
    [1500, 2000, 50, 750], // store allows half
    [1500, 0, 100, 0],
    [0, 500, 100, 0],
    [999.99, 1000, 33.33, 333.3],
  ])("total %d, balance %d, max %d%% → %d", (total, balance, max, use) => {
    expect(walletUse(total, balance, max)).toBe(use)
  })
})

describe("cashback", () => {
  const on = { enabled: true, percent: 3, minOrder: 1000, maxPerOrder: 500 }
  it.each([
    [4000, 0, 120],
    [4000, 2, 200], // + level cashback
    [999, 0, 0], // below the minimum order
    [30000, 0, 500], // capped
    [0, 2, 0],
  ])("items %d, level +%d%% → %d", (net, lvl, cb) => {
    expect(cashbackFor(net, on, lvl)).toBe(cb)
  })
  it("gives nothing when off, and level cashback alone when the base is 0", () => {
    expect(cashbackFor(4000, { ...on, enabled: false }, 2)).toBe(0)
    expect(cashbackFor(4000, { ...on, percent: 0, maxPerOrder: null }, 2)).toBe(80)
  })
  it.each([
    [120, 4000, 1000, 30],
    [120, 4000, 4000, 120],
    [120, 4000, 5000, 120], // refund incl. delivery: all of it
    [30, 4000, 3000, 22.5],
    [0, 4000, 1000, 0],
    [120, 4000, 0, 0],
  ])("reverse: %d left, items %d, refunded %d → %d", (left, net, refunded, back) => {
    expect(cashbackToReverse(left, net, refunded)).toBe(back)
  })
})

describe("referrals", () => {
  const ok = {
    enabled: true,
    ownerCustomerId: 5n,
    customerId: 9n,
    alreadyReferred: false,
    earlierOrders: 0,
    samePhone: false,
  }
  it("accepts a new customer with someone else's code", () => {
    expect(referralProblem(ok)).toBeNull()
  })
  it.each([
    ["referrals off", { enabled: false }, "aren't running"],
    ["unknown code", { ownerCustomerId: null }, "doesn't exist"],
    ["own code", { ownerCustomerId: 9n }, "own referral code"],
    ["already referred", { alreadyReferred: true }, "already referred"],
    ["has ordered before", { earlierOrders: 1 }, "new customers"],
    ["same phone as the owner", { samePhone: true }, "can't be used"],
  ] as const)("refuses: %s", (_label, patch, msg) => {
    expect(referralProblem({ ...ok, ...patch })).toContain(msg)
  })
  it.each([
    ["Rahim", "k7z", "RAHIMK7Z"],
    ["Mohammad", "a1b", "MOHAMA1B"],
    ["রহিম", "q9", "FRIENDQ9X"],
    ["Ann-Marie", "x", "ANNMAXXX"],
  ])("code for %s", (name, rnd, code) => {
    expect(referralCode(name, rnd)).toBe(code)
  })
})
