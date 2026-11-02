/**
 * Batch 56 against a REAL Postgres: a phone's delivery record across shops, the COD block list at
 * checkout, confirmation calls, editing an order, and an exchange that makes a replacement order.
 * Runs only when RUN_DB_TESTS=1.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import type { RequestContext } from "../../src/core"

const runDb = process.env.RUN_DB_TESTS === "1"

describe.skipIf(!runDb)("Batch 56 order checks, edits and exchanges (Postgres)", () => {
  let prisma: typeof import("../../src/config/prisma").prisma
  let Storefront: typeof import("../../src/modules/storefront/storefront.service").StorefrontService
  let PlaceOrderDto: typeof import("../../src/modules/storefront/storefront.dto").PlaceOrderDto
  let checks: typeof import("../../src/modules/orders/order-checks")
  let OrderEdit: typeof import("../../src/modules/orders/order-edit").OrderEditService
  let Fulfilment: typeof import("../../src/modules/fulfilment/fulfilment.service").FulfilmentService
  const stores: bigint[] = []
  let storeId: bigint
  let otherStoreId: bigint
  let productId: bigint
  let sizeM: bigint
  let sizeL: bigint
  let methodId: bigint
  const suffix = Date.now().toString(36)
  const ctx = (): RequestContext => ({ storeId, requestId: "t", locale: "en", currency: "BDT" })
  const phone = "01911000303"

  const place = (over: Record<string, unknown> = {}) =>
    new Storefront(ctx()).placeOrder(
      PlaceOrderDto.parse({
        phone,
        shippingAddress: { firstName: "Karim", lastName: "Uddin", country: "BD", district: "Dhaka", addressLine1: "House 3, Road 7, Mirpur", phone },
        shippingMethodId: String(methodId),
        paymentGateway: "cod",
        items: [{ productId: String(productId), variantId: String(sizeM), qty: 2 }],
        termsAgreed: true,
        ...over,
      }),
    )
  const orderOf = async (key: string) => prisma.order.findUniqueOrThrow({ where: { orderKey: key }, include: { items: true } })

  beforeAll(async () => {
    ;({ prisma } = await import("../../src/config/prisma"))
    ;({ StorefrontService: Storefront } = await import("../../src/modules/storefront/storefront.service"))
    ;({ PlaceOrderDto } = await import("../../src/modules/storefront/storefront.dto"))
    checks = await import("../../src/modules/orders/order-checks")
    ;({ OrderEditService: OrderEdit } = await import("../../src/modules/orders/order-edit"))
    ;({ FulfilmentService: Fulfilment } = await import("../../src/modules/fulfilment/fulfilment.service"))
    storeId = (await prisma.store.create({ data: { name: "B56 Shop", slug: `b56-${suffix}` } })).id
    otherStoreId = (await prisma.store.create({ data: { name: "B56 Other", slug: `b56o-${suffix}` } })).id
    stores.push(storeId, otherStoreId)
    await prisma.paymentGatewayConfig.create({ data: { storeId, code: "cod", name: "Cash on delivery", enabled: true } })
    const p = await prisma.product.create({
      data: {
        storeId, name: "Cotton Panjabi", slug: `pj-${suffix}`, status: "published", regularPrice: 1500, manageStock: false,
        variants: { create: [{ attributeValues: { size: "M" }, manageStock: false }, { attributeValues: { size: "L" }, manageStock: false }] },
      },
      include: { variants: { orderBy: { id: "asc" } } },
    })
    productId = p.id
    sizeM = p.variants[0]!.id
    sizeL = p.variants[1]!.id
    const zone = await prisma.shippingZone.create({
      data: { storeId, name: "Everywhere", countries: ["BD"], methods: { create: [{ code: "std", name: "Standard", baseCost: 60 }] } },
      include: { methods: true },
    })
    methodId = zone.methods[0]!.id
    // The same number at another shop: 1 delivered, 3 returned.
    for (const [i, f] of ["delivered", "returned", "returned", "delivery_failed"].entries()) {
      await prisma.order.create({
        data: {
          storeId: otherStoreId, number: `B56O-${suffix}-${i}`, orderKey: `b56o-${suffix}-${i}`, billingFirstName: "K", billingLastName: "U",
          billingAddress1: "x", billingCity: "Dhaka", billingCountryCode: "BD", billingPhone: phone, phoneKey: phone, grandTotal: 1000,
          currencyCode: "BDT", paymentGatewayCode: "cod", shippingMethodCode: "std", shippingMethodName: "Standard", fulfillmentStatus: f,
        },
      })
    }
  })

  afterAll(async () => {
    if (!prisma || !stores.length) return // setup failed: an undefined id would match every row
    await new Promise((r) => setTimeout(r, 500)) // background emails
    for (const id of stores) {
      await prisma.returnRequest.deleteMany({ where: { storeId: id } })
      await prisma.order.deleteMany({ where: { storeId: id } })
      await prisma.product.deleteMany({ where: { storeId: id } })
      await prisma.store.delete({ where: { id } })
    }
    await prisma.$disconnect()
  })

  it("saves the number's record from every shop, and holds a high-risk COD order when asked", async () => {
    await prisma.orderCheckSettings.create({ data: { storeId, holdHighRisk: true } })
    const o = await orderOf((await place()).orderKey)
    expect(o).toMatchObject({ phoneKey: phone, riskLevel: "high", riskDelivered: 1, riskReturned: 3, status: "ON_HOLD" })
    const panel = await new checks.OrderChecks(ctx()).forOrder(o.id)
    expect(panel.now?.here).toEqual({ delivered: 0, returned: 0 })
    await prisma.orderCheckSettings.update({ where: { storeId }, data: { holdHighRisk: false } })
  })

  it("refuses cash on delivery for a blocked number", async () => {
    const b = await new checks.OrderChecks(ctx()).block("+8801911-000303", "Refused 3 parcels")
    await expect(place()).rejects.toMatchObject({ code: "COD_BLOCKED" })
    await new checks.OrderChecks(ctx()).unblock(BigInt(b.id))
  })

  it("brings a no-answer order back later and moves a confirmed one to processing", async () => {
    const o = await orderOf((await place()).orderKey)
    const c = new checks.OrderChecks(ctx())
    const now = new Date()
    await c.logCall(o.id, { outcome: "no_answer" }, now)
    expect((await c.callList("later", 1, 50, now)).items.map((r) => r.id)).toContain(String(o.id))
    expect((await c.callList("due", 1, 50, new Date(+now + 3 * 3600_000))).items.map((r) => r.id)).toContain(String(o.id))
    await c.logCall(o.id, { outcome: "confirmed" })
    expect((await prisma.order.findUniqueOrThrow({ where: { id: o.id } })).status).toBe("PROCESSING")
  })

  it("edits the items and address, keeping prices per unit and logging what changed", async () => {
    const o = await orderOf((await place()).orderKey)
    const line = o.items[0]!
    const r = await new OrderEdit(ctx()).edit(o.id, {
      items: [
        { orderItemId: line.id, productId, variantId: sizeM, quantity: 1 },
        { productId, variantId: sizeL, quantity: 1 },
      ],
      address: { firstName: "Karim", lastName: "Uddin", phone: "01911000404", addressLine1: "House 5, Road 2, Mirpur", district: "Dhaka" },
    })
    expect(r.changes.join(" ")).toMatch(/1 → 1|2 → 1/)
    const after = await prisma.order.findUniqueOrThrow({ where: { id: o.id }, include: { items: true } })
    expect(after.items).toHaveLength(2)
    expect(Number(after.grandTotal)).toBe(Number(o.grandTotal)) // one M fewer, one L more, same price
    expect(after).toMatchObject({ shippingPhone: "01911000404", phoneKey: "01911000404" })
  })

  it("approving an exchange makes a replacement order with the returned value taken off", async () => {
    const o = await orderOf((await place()).orderKey)
    await prisma.order.update({ where: { id: o.id }, data: { status: "DELIVERED", paymentStatus: "paid" } })
    const f = new Fulfilment(ctx())
    const ret = await f.createReturn(o.id, { type: "exchange", reason: "wrong_size", items: [{ orderItemId: o.items[0]!.id, quantity: 1, exchangeVariantId: sizeL }] }, "staff")
    const approved = await f.moveReturn(ret.id, { status: "approved" })
    expect(approved.exchangeOrder).not.toBeNull()
    const replacement = await prisma.order.findUniqueOrThrow({ where: { id: approved.exchangeOrder!.id }, include: { items: true } })
    expect(replacement.items[0]).toMatchObject({ variantId: sizeL, quantity: 1 })
    expect(Number(replacement.grandTotal)).toBe(0) // same price, no exchange fee
    const received = await f.moveReturn(ret.id, { status: "received" })
    expect(received.status).toBe("exchanged")
  })
})
