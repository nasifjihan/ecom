/**
 * My coupons (GET /api/storefront/account/coupons) against a real Postgres. RUN_DB_TESTS=1 only.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import type { RequestContext } from "../../src/core"

const runDb = process.env.RUN_DB_TESTS === "1"

describe.skipIf(!runDb)("my coupons (Postgres)", () => {
  let prisma: typeof import("../../src/config/prisma").prisma
  let Storefront: typeof import("../../src/modules/storefront/storefront.service").StorefrontService
  let storeId: bigint | undefined
  let ctx: RequestContext
  const suffix = Date.now().toString(36)
  const code = (c: string) => `${c}${suffix}`.toUpperCase()
  const email = `me-${suffix}@example.com`

  beforeAll(async () => {
    ;({ prisma } = await import("../../src/config/prisma"))
    ;({ StorefrontService: Storefront } =
      await import("../../src/modules/storefront/storefront.service"))
    storeId = (
      await prisma.store.create({ data: { name: "Coupon Test", slug: `mycoupons-${suffix}` } })
    ).id
    const me = await prisma.customer.create({
      data: { storeId, email, firstName: "Mina", lastName: "Akter" },
    })
    ctx = { storeId, requestId: "test", locale: "en", currency: "BDT", customer: { id: me.id } }
    const coupon = (c: string, extra: Record<string, unknown> = {}) =>
      prisma.coupon.create({
        data: {
          storeId: storeId!,
          code: code(c),
          type: "FIXED_CART",
          amount: 100,
          audience: "public",
          ...extra,
        },
      })
    await coupon("OPEN")
    await coupon("ONCE", { perCustomerLimit: 1 })
    await coupon("TWICE", { perCustomerLimit: 2 })
    await coupon("MINE", { audience: "given", customerEmails: [email] })
    await coupon("THEIRS", { audience: "given", customerEmails: ["someone@example.com"] })
    await coupon("SECRET", { audience: "private" })
    await coupon("OLD", { expiresAt: new Date(Date.now() - 86_400_000) })
    const sf = (
      await prisma.storefront.create({
        data: { storeId, name: "Main", code: "MAIN", isDefault: true },
      })
    ).id
    let n = 0
    const order = (couponUsed: string, extra: Record<string, unknown> = {}) =>
      prisma.order.create({
        data: {
          storeId: storeId!,
          storefrontId: sf,
          number: `MC-${suffix}-${++n}`,
          orderKey: `mc-${suffix}-${n}`,
          itemsSubtotal: 500,
          grandTotal: 400,
          discountTotal: 100,
          currencyCode: "BDT",
          couponUsed,
          paymentGatewayCode: "cod",
          shippingMethodCode: "pickup",
          shippingMethodName: "Pickup",
          billingFirstName: "Mina",
          billingLastName: "Akter",
          billingPhone: "01711000000",
          billingCountryCode: "BD",
          billingAddress1: "x",
          billingCity: "Dhaka",
          customerId: me.id,
          billingEmail: email,
          ...extra,
        },
      })
    await order(code("ONCE"))
    await order(code("TWICE"))
    await order(code("TWICE"), { status: "CANCELLED" }) // doesn't count
    // A guest order with my email counts towards the limit (checkout counts by email) but isn't listed.
    await order(code("OPEN"), { customerId: null })
  })

  afterAll(async () => {
    if (!prisma || !storeId) return // setup failed: an undefined id would match every row
    await prisma.order.deleteMany({ where: { storeId } })
    await prisma.coupon.deleteMany({ where: { storeId } })
    await prisma.customer.deleteMany({ where: { storeId } })
    await prisma.store.delete({ where: { id: storeId } })
    await prisma.$disconnect()
  })

  it("lists what I can use now, with uses left, and leaves out the rest", async () => {
    const r = await new Storefront(ctx).myCoupons()
    const usable = Object.fromEntries(r.usable.map((c) => [c.code, c]))
    expect(Object.keys(usable).sort()).toEqual([code("MINE"), code("OPEN"), code("TWICE")].sort())
    expect(usable[code("TWICE")]!.usesLeft).toBe(1)
    expect(usable[code("OPEN")]!.usesLeft).toBeNull()
    expect(usable[code("MINE")]!.forYou).toBe(true)
  })

  it("lists my account's orders that used a coupon, not cancelled or guest ones", async () => {
    const r = await new Storefront(ctx).myCoupons()
    expect(r.used.map((u) => u.code).sort()).toEqual([code("ONCE"), code("TWICE")].sort())
    expect(r.used[0]).toMatchObject({ discount: 100 })
  })

  it("needs a signed-in customer", async () => {
    await expect(new Storefront({ ...ctx, customer: undefined }).myCoupons()).rejects.toThrow()
  })
})
