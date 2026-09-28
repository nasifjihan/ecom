/**
 * Wallet, cashback, levels and referrals against a REAL Postgres, through the real order status
 * changes. Runs only when RUN_DB_TESTS=1.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import type { RequestContext } from "../../src/core"

const runDb = process.env.RUN_DB_TESTS === "1"

describe.skipIf(!runDb)("loyalty (Postgres)", () => {
  let prisma: typeof import("../../src/config/prisma").prisma
  let ledger: typeof import("../../src/modules/loyalty/loyalty.ledger")
  let Loyalty: typeof import("../../src/modules/loyalty/loyalty.service").LoyaltyService
  let Orders: typeof import("../../src/modules/orders/orders.service").OrdersService
  let storeId: bigint
  let ctx: RequestContext
  let ali: bigint
  let bina: bigint
  const suffix = Date.now().toString(36)
  let seq = 0

  const balance = async (id: bigint) =>
    Number((await prisma.customer.findUniqueOrThrow({ where: { id } })).storeCredit)
  const walk = async (orderId: bigint, to: string[]) => {
    for (const s of to)
      await new Orders(ctx).transitionStatus(orderId, {
        newStatus: s,
        note: null,
        notifyCustomer: false,
      } as never)
  }
  /** An order for `customerId` with `items` worth of goods, as checkout leaves it. */
  const place = async (customerId: bigint, items: number, walletUsed = 0) => {
    seq += 1
    return prisma.$transaction(async (t) => {
      const o = await t.order.create({
        data: {
          storeId,
          customerId,
          number: `L${suffix}${seq}`,
          orderKey: `ok_l_${suffix}_${seq}`,
          billingFirstName: "Test",
          billingLastName: "Customer",
          billingAddress1: "House 1",
          billingCity: "Dhaka",
          billingCountryCode: "BD",
          itemsSubtotal: items,
          grandTotal: items + 60 - walletUsed,
          shippingTotal: 60,
          walletUsed,
          currencyCode: "BDT",
          paymentGatewayCode: "cod",
          shippingMethodCode: "std",
          shippingMethodName: "Standard",
        },
      })
      await ledger.onOrderPlaced(t, storeId, {
        id: o.id,
        number: o.number,
        customerId,
        walletUsed,
        itemsNet: items,
      })
      return o
    })
  }

  beforeAll(async () => {
    ;({ prisma } = await import("../../src/config/prisma"))
    ledger = await import("../../src/modules/loyalty/loyalty.ledger")
    ;({ LoyaltyService: Loyalty } = await import("../../src/modules/loyalty/loyalty.service"))
    ;({ OrdersService: Orders } = await import("../../src/modules/orders/orders.service"))
    const store = await prisma.store.create({
      data: { name: "Loyalty Test", slug: `loyalty-${suffix}` },
    })
    storeId = store.id
    ctx = { storeId, requestId: "test", locale: "en", currency: "BDT" }
    await prisma.loyaltySettings.create({
      data: {
        storeId,
        cashbackEnabled: true,
        cashbackPercent: 5,
        levelsEnabled: true,
        referralEnabled: true,
        referrerReward: 150,
        refereeReward: 100,
        referralMinOrder: 1000,
      },
    })
    await prisma.loyaltyLevel.createMany({
      data: [
        { storeId, name: "Bronze", minSpend: 0 },
        { storeId, name: "Silver", minSpend: 3000, discountPercent: 2, cashbackPercent: 1 },
      ],
    })
    ali = (
      await prisma.customer.create({
        data: { storeId, firstName: "Ali", lastName: "Khan", phone: "01711000001" },
      })
    ).id
    bina = (
      await prisma.customer.create({
        data: { storeId, firstName: "Bina", lastName: "Das", phone: "01711000002" },
      })
    ).id
  })

  afterAll(async () => {
    if (!prisma) return
    await prisma.order.deleteMany({ where: { storeId } })
    await prisma.affiliate.deleteMany({ where: { storeId } })
    await prisma.customer.deleteMany({ where: { storeId } })
    await prisma.store.delete({ where: { id: storeId } })
    await prisma.$disconnect()
  })

  it("keeps a ledger and never lets a wallet go below zero", async () => {
    await new Loyalty(ctx).adjustWallet(ali, 500, "Welcome credit")
    expect(await balance(ali)).toBe(500)
    await expect(new Loyalty(ctx).adjustWallet(ali, -600, "Too much")).rejects.toThrow(
      /isn't enough/,
    )
    expect(await balance(ali)).toBe(500)
    const rows = await prisma.walletTransaction.findMany({ where: { customerId: ali } })
    expect(rows.map((r) => [Number(r.amount), Number(r.balanceAfter)])).toEqual([[500, 500]])
  })

  it("takes the wallet part when ordering and gives it back once when the order is cancelled", async () => {
    const o = await place(ali, 1500, 200)
    expect(await balance(ali)).toBe(300)
    await expect(place(ali, 1500, 400)).rejects.toThrow(/wallet balance changed/)
    await walk(o.id, ["CANCELLED"])
    expect(await balance(ali)).toBe(500)
    await ledger.onOrderClosed(prisma, storeId, o.id) // a second close changes nothing
    expect(await balance(ali)).toBe(500)
  })

  it("pays cashback on delivery and moves the customer up a level", async () => {
    const o = await place(ali, 4000)
    await walk(o.id, ["PROCESSING", "SHIPPED", "OUT_FOR_DELIVERY"])
    expect(await balance(ali)).toBe(500) // nothing until delivered
    await walk(o.id, ["DELIVERED"])
    expect(await balance(ali)).toBe(700) // 5% of 4000 (Bronze has no extra)
    const c = await prisma.customer.findUniqueOrThrow({
      where: { id: ali },
      include: { loyaltyLevel: true },
    })
    expect([Number(c.qualifyingSpend), c.loyaltyLevel?.name]).toEqual([4000, "Silver"])

    // A refund of a quarter of the items takes back a quarter of the cashback.
    await prisma.order.update({ where: { id: o.id }, data: { refundedTotal: 1000 } })
    await prisma.$transaction((t) => ledger.onOrderRefunded(t, storeId, o.id, 1000, 4000))
    expect(await balance(ali)).toBe(650)
    const after = await prisma.customer.findUniqueOrThrow({
      where: { id: ali },
      include: { loyaltyLevel: true },
    })
    expect([Number(after.qualifyingSpend), after.loyaltyLevel?.name]).toEqual([3000, "Silver"])
  })

  it("gives the level's discount at checkout", async () => {
    const l = await prisma.$transaction((t) => ledger.checkoutLoyalty(t, storeId, ali))
    expect(l.level).toMatchObject({ name: "Silver", discountPercent: 2, cashbackPercent: 1 })
    expect(l.balance).toBe(650)
  })

  it("rewards both friends when a referred customer's first order is delivered", async () => {
    const svc = new Loyalty(ctx)
    const mine = await svc.myReferral(ali)
    expect(mine.code).toMatch(/^ALI/)
    await expect(svc.claimReferral(ali, mine.code!)).rejects.toThrow(/own referral code/)
    await svc.claimReferral(bina, mine.code!)
    await expect(svc.claimReferral(bina, mine.code!)).rejects.toThrow(/already referred/)

    const small = await place(bina, 500) // below the referral minimum: doesn't count
    const first = await place(bina, 2000)
    expect(
      (await prisma.affiliateReferral.findFirstOrThrow({ where: { referredCustomerId: bina } }))
        .orderId,
    ).toBe(first.id)
    await walk(small.id, ["CANCELLED"])
    await walk(first.id, ["PROCESSING", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"])

    expect(await balance(ali)).toBe(800) // 650 + 150 for the referral
    expect(await balance(bina)).toBe(200) // 100 welcome + 5% cashback of 2000
    const ref = await prisma.affiliateReferral.findFirstOrThrow({
      where: { referredCustomerId: bina },
    })
    expect([ref.status, Number(ref.commission)]).toEqual(["rewarded", 150])
    expect((await svc.myReferral(ali)).friends).toMatchObject([
      { name: "Bina", status: "rewarded", reward: 150 },
    ])
  })

  it("lets an order spend the whole balance, paisa included", async () => {
    await new Loyalty(ctx).adjustWallet(bina, -104.24, "Leave 95.76")
    expect(await balance(bina)).toBe(95.76)
    await place(bina, 1000, 95.76)
    expect(await balance(bina)).toBe(0)
  })
})
