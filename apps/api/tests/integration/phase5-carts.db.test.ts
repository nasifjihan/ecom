/**
 * Batch 55 against a REAL Postgres: carts saved on the server (guests only with a phone or email,
 * joined on sign-in), abandoned-cart reminders (once each, quiet at night, not after opting out)
 * and recovery when the shopper orders. Runs only when RUN_DB_TESTS=1.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import type { RequestContext } from "../../src/core"

const runDb = process.env.RUN_DB_TESTS === "1"

describe.skipIf(!runDb)("Batch 55 saved carts and reminders (Postgres)", () => {
  let prisma: typeof import("../../src/config/prisma").prisma
  let carts: typeof import("../../src/modules/storefront/saved-cart")
  let reminders: typeof import("../../src/modules/marketing/cart-reminders")
  let storeId: bigint
  let productId: bigint
  let customerId: bigint
  const suffix = Date.now().toString(36)
  const guest = (): RequestContext => ({ storeId, requestId: "t", locale: "en", currency: "BDT" })
  const signedIn = (): RequestContext => ({ ...guest(), customer: { id: customerId } } as RequestContext)
  const line = (qty: number) => ({ productId, variantId: null, qty })
  // 11am in Dhaka (05:00 UTC), so SMS isn't held for the night.
  const day = (offsetHours = 0) => new Date(Date.UTC(2030, 0, 15, 5) + offsetHours * 3600_000)

  beforeAll(async () => {
    ;({ prisma } = await import("../../src/config/prisma"))
    carts = await import("../../src/modules/storefront/saved-cart")
    reminders = await import("../../src/modules/marketing/cart-reminders")
    storeId = (await prisma.store.create({ data: { name: "B55 Shop", slug: `b55-${suffix}` } })).id
    productId = (await prisma.product.create({ data: { storeId, name: "Cotton Panjabi", slug: `pj-${suffix}`, status: "published", regularPrice: 2450, manageStock: false } })).id
    customerId = (await prisma.customer.create({ data: { storeId, email: `rina-${suffix}@x.test`, firstName: "Rina", lastName: "Akter" } })).id
  })

  afterAll(async () => {
    if (!prisma || !storeId) return // setup failed: an undefined id would match every row
    await new Promise((r) => setTimeout(r, 500)) // background emails
    await prisma.cart.deleteMany({ where: { storeId } })
    await prisma.customer.deleteMany({ where: { storeId } })
    await prisma.product.deleteMany({ where: { storeId } })
    await prisma.store.delete({ where: { id: storeId } })
    await prisma.$disconnect()
  })

  it("keeps a guest's cart only once there's a phone or email, and joins it into the account on sign-in", async () => {
    expect(await new carts.SavedCarts(guest()).save({ lines: [line(1)] })).toEqual({ token: null })
    const g = await new carts.SavedCarts(guest()).save({ lines: [line(2)], contact: { phone: "01711-000101", firstName: "Rina" } })
    expect(g.token).toMatch(/^cart_/)
    const saved = await prisma.cart.findUniqueOrThrow({ where: { token: g.token! }, include: { items: true } })
    expect(saved).toMatchObject({ phone: "01711000101", firstName: "Rina" })
    expect(Number(saved.items[0]!.unitPrice)).toBe(2450)
    const joined = await new carts.SavedCarts(signedIn()).join(g.token, [line(1)])
    expect(joined.items).toEqual([expect.objectContaining({ productId: String(productId), qty: 2, title: "Cotton Panjabi" })])
    expect((await prisma.cart.findUniqueOrThrow({ where: { token: g.token! } })).customerId).toBe(customerId)
  })

  it("reminds an abandoned cart once, waits at night for SMS, and counts the order as recovered", async () => {
    await prisma.cartReminderSettings.create({ data: { storeId, enabled: true, firstDelayMinutes: 60, secondEnabled: true, secondDelayHours: 24, sms: true, email: true } })
    const g = await new carts.SavedCarts(guest()).save({ lines: [line(1)], contact: { phone: "01811-000202", email: `guest-${suffix}@x.test` } })
    await prisma.cart.update({ where: { token: g.token! }, data: { lastActivityAt: day(-2) } })
    // 11pm in Dhaka: held (it has a phone).
    expect((await reminders.remindStore(storeId, day(12))).first).toBe(0)
    expect((await reminders.remindStore(storeId, day())).first).toBeGreaterThanOrEqual(1)
    expect((await reminders.remindStore(storeId, day())).first).toBe(0) // never twice
    const a = await prisma.abandonedCart.findFirstOrThrow({ where: { cart: { token: g.token! } } })
    expect(a.reminderSentAt).not.toBeNull()
    expect((await reminders.remindStore(storeId, day(25))).second).toBeGreaterThanOrEqual(1)
    // Ordering with the same phone recovers it.
    const order = await prisma.order.findFirst({ where: { storeId } })
    const orderId = order?.id ?? BigInt(0)
    await carts.markOrdered(storeId, { orderId, phone: "01811000202" })
    expect((await prisma.abandonedCart.findUniqueOrThrow({ where: { id: a.id } })).recoveredAt).not.toBeNull()
  })

  it("sends nothing to a shopper who opted out", async () => {
    const g = await new carts.SavedCarts(guest()).save({ lines: [line(1)], contact: { email: `out-${suffix}@x.test` } })
    await prisma.reminderOptOut.create({ data: { storeId, contact: `out-${suffix}@x.test` } })
    await prisma.cart.update({ where: { token: g.token! }, data: { lastActivityAt: day(-2) } })
    await reminders.remindStore(storeId, day())
    expect(await prisma.abandonedCart.count({ where: { cart: { token: g.token! }, reminderSentAt: { not: null } } })).toBe(0)
  })
})
