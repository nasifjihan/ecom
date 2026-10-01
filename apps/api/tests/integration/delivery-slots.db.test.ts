/**
 * Delivery time slots and courier choice at checkout against a REAL Postgres: a slot is required
 * with options that use them, its charge is added, a full slot refuses the next order and frees up
 * when an order is cancelled, and customers can pick only couriers the storefront offers.
 * Runs only when RUN_DB_TESTS=1.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import type { RequestContext } from "../../src/core"

const runDb = process.env.RUN_DB_TESTS === "1"

describe.skipIf(!runDb)("delivery slots and courier choice (Postgres)", () => {
  let prisma: typeof import("../../src/config/prisma").prisma
  let Storefront: typeof import("../../src/modules/storefront/storefront.service").StorefrontService
  let Slots: typeof import("../../src/modules/shipping/slots.service").DeliverySlotService
  let PlaceOrderDto: typeof import("../../src/modules/storefront/storefront.dto").PlaceOrderDto
  let rules: typeof import("../../src/modules/shipping/slots.rules")
  let forget: typeof import("../../src/modules/storefronts/storefronts.context").forgetStorefronts
  let storeId: bigint
  let productId: bigint
  let plainId: bigint
  let slotMethodId: bigint
  let slotId: string
  let tomorrow: string
  let ctx: RequestContext
  const suffix = Date.now().toString(36)

  const order = (over: Record<string, unknown> = {}) =>
    new Storefront(ctx).placeOrder(
      PlaceOrderDto.parse({
        phone: "01712345678",
        shippingAddress: { firstName: "Salma", lastName: "Begum", country: "BD", district: "Dhaka", addressLine1: "House 7, Road 2", phone: "01712345678" },
        shippingMethodId: String(slotMethodId),
        paymentGateway: "cod",
        items: [{ productId: String(productId), qty: 1 }],
        termsAgreed: true,
        ...over,
      }),
    )

  beforeAll(async () => {
    ;({ prisma } = await import("../../src/config/prisma"))
    ;({ StorefrontService: Storefront } = await import("../../src/modules/storefront/storefront.service"))
    ;({ DeliverySlotService: Slots } = await import("../../src/modules/shipping/slots.service"))
    ;({ PlaceOrderDto } = await import("../../src/modules/storefront/storefront.dto"))
    rules = await import("../../src/modules/shipping/slots.rules")
    ;({ forgetStorefronts: forget } = await import("../../src/modules/storefronts/storefronts.context"))
    storeId = (await prisma.store.create({ data: { name: "Slot Test", slug: `slot-${suffix}` } })).id
    ctx = { storeId, requestId: "test", locale: "en", currency: "BDT" }
    await prisma.storeGeneralSetting.create({ data: { storeId, emailFrom: "shop@slot.test", emailFromName: "Slot Test", timezone: "Asia/Dhaka", slotDaysAhead: 3 } })
    await prisma.paymentGatewayConfig.create({ data: { storeId, code: "cod", name: "Cash on delivery", enabled: true } })
    productId = (await prisma.product.create({ data: { storeId, name: "Cake", slug: `cake-${suffix}`, status: "published", regularPrice: 1000, manageStock: false } })).id
    const zone = await prisma.shippingZone.create({
      data: {
        storeId,
        name: "Everywhere",
        countries: ["BD"],
        methods: { create: [{ code: "std", name: "Standard", baseCost: 80 }, { code: "timed", name: "Timed delivery", baseCost: 100, useSlots: true }] },
      },
      include: { methods: true },
    })
    plainId = zone.methods.find((m) => m.code === "std")!.id
    slotMethodId = zone.methods.find((m) => m.code === "timed")!.id
    tomorrow = rules.addDays(rules.localNow(new Date(), "Asia/Dhaka").day, 1)
  })

  afterAll(async () => {
    if (!prisma) return
    await new Promise((r) => setTimeout(r, 500)) // background emails
    await prisma.order.deleteMany({ where: { storeId } })
    await prisma.product.deleteMany({ where: { storeId } })
    await prisma.store.delete({ where: { id: storeId } })
    await prisma.$disconnect()
  })

  it("checks a slot's times and offers it on the coming days", async () => {
    const slots = new Slots(storeId)
    await expect(slots.create({ name: "Bad", startTime: "21:00", endTime: "17:00", cutoffMinutes: 0, fee: 0, capacity: null, weekdays: [0, 1, 2, 3, 4, 5, 6], enabled: true })).rejects.toThrow(/end after/)
    slotId = (await slots.create({ name: "Evening", startTime: "17:00", endTime: "21:00", cutoffMinutes: 0, fee: 50, capacity: 1, weekdays: [0, 1, 2, 3, 4, 5, 6], enabled: true })).id
    const choices = await new Storefront(ctx).deliveryChoices()
    expect(choices.couriers).toEqual([])
    expect(choices.days.find((d) => d.date === tomorrow)?.slots[0]).toMatchObject({ id: slotId, window: "17:00–21:00", fee: 50, left: 1, available: true })
  })

  it("needs a slot for options that use them, and adds its charge", async () => {
    await expect(order()).rejects.toThrow(/Pick a delivery time/)
    await expect(order({ deliverySlot: { slotId, date: rules.addDays(tomorrow, 10) } })).rejects.toThrow(/isn't offered/)
    const placed = await order({ deliverySlot: { slotId, date: tomorrow } })
    const o = await prisma.order.findUniqueOrThrow({ where: { orderKey: placed.orderKey } })
    expect(o.deliveryDate!.toISOString().slice(0, 10)).toBe(tomorrow)
    expect(o.deliverySlotLabel).toMatch(/, Evening 17:00–21:00$/)
    expect([Number(o.slotFee), Number(o.shippingTotal)]).toEqual([50, 150])
    // Options without slots don't ask.
    const plain = await order({ shippingMethodId: String(plainId) })
    expect((await prisma.order.findUniqueOrThrow({ where: { orderKey: plain.orderKey } })).deliverySlotId).toBeNull()
  })

  it("refuses a full slot until an order in it is cancelled", async () => {
    await expect(order({ deliverySlot: { slotId, date: tomorrow } })).rejects.toThrow(/fully booked/)
    const list = await new Slots(storeId).list()
    expect(list.slots[0]!.upcoming).toEqual([{ date: tomorrow, orders: 1 }])
    await prisma.order.updateMany({ where: { storeId, deliverySlotId: BigInt(slotId) }, data: { status: "CANCELLED" } })
    await expect(order({ deliverySlot: { slotId, date: tomorrow } })).resolves.toHaveProperty("orderKey")
  })

  it("lets customers pick only the couriers the storefront offers", async () => {
    const mk = (courier: string) =>
      prisma.courierAccount.create({
        data: { storeId, courier, label: courier, credentials: "x", webhookToken: `${courier}-${suffix}`, webhookSecret: "x" },
      })
    const [steadfast, pathao] = [await mk("steadfast"), await mk("pathao")]
    const sf = await new Storefront(ctx).storefront()
    await prisma.storefront.update({ where: { id: sf.id }, data: { checkoutCourierIds: [pathao.id] } })
    forget(storeId)
    expect((await new Storefront(ctx).deliveryChoices()).couriers).toEqual([{ id: String(pathao.id), name: "Pathao", courier: "pathao" }])
    await expect(order({ shippingMethodId: String(plainId), courierAccountId: String(steadfast.id) })).rejects.toThrow(/courier isn't available/)
    const placed = await order({ shippingMethodId: String(plainId), courierAccountId: String(pathao.id) })
    const o = await prisma.order.findUniqueOrThrow({ where: { orderKey: placed.orderKey } })
    expect(o.courierAccountId).toBe(pathao.id)
    expect((await new Storefront(ctx).getOrderByKey(placed.orderKey)).courier).toBe("Pathao")
  })
})
