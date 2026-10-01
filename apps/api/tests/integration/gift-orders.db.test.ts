/**
 * Gift orders against a REAL Postgres: the gift details are saved with the order (the buyer as
 * billing, the recipient as shipping), shown on the customer's order, refused when too long or when
 * the shop doesn't take gifts, and the packing slip prints for gifts and ordinary orders.
 * Runs only when RUN_DB_TESTS=1.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import type { RequestContext } from "../../src/core"

const runDb = process.env.RUN_DB_TESTS === "1"

describe.skipIf(!runDb)("gift orders (Postgres)", () => {
  let prisma: typeof import("../../src/config/prisma").prisma
  let Storefront: typeof import("../../src/modules/storefront/storefront.service").StorefrontService
  let PlaceOrderDto: typeof import("../../src/modules/storefront/storefront.dto").PlaceOrderDto
  let slips: typeof import("../../src/modules/invoices/packing-slip")
  let storeId: bigint
  let productId: bigint
  let methodId: bigint
  let ctx: RequestContext
  const suffix = Date.now().toString(36)
  const recipient = { firstName: "Nusrat", lastName: "Jahan", country: "BD", district: "Dhaka", addressLine1: "House 9, Road 4, Gulshan", phone: "01811111111" }

  const order = (over: Record<string, unknown> = {}) =>
    new Storefront(ctx).placeOrder(
      PlaceOrderDto.parse({
        phone: "01712345678",
        shippingAddress: recipient,
        shippingMethodId: String(methodId),
        paymentGateway: "cod",
        items: [{ productId: String(productId), qty: 1 }],
        termsAgreed: true,
        ...over,
      }),
    )

  beforeAll(async () => {
    ;({ prisma } = await import("../../src/config/prisma"))
    ;({ StorefrontService: Storefront } = await import("../../src/modules/storefront/storefront.service"))
    ;({ PlaceOrderDto } = await import("../../src/modules/storefront/storefront.dto"))
    slips = await import("../../src/modules/invoices/packing-slip")
    storeId = (await prisma.store.create({ data: { name: "Gift Test", slug: `gift-${suffix}` } })).id
    ctx = { storeId, requestId: "test", locale: "en", currency: "BDT" }
    await prisma.storeGeneralSetting.create({ data: { storeId, emailFrom: "shop@gift.test", emailFromName: "Gift Test" } })
    await prisma.paymentGatewayConfig.create({ data: { storeId, code: "cod", name: "Cash on delivery", enabled: true } })
    productId = (await prisma.product.create({ data: { storeId, name: "Jamdani saree", slug: `saree-${suffix}`, status: "published", regularPrice: 5000, manageStock: false } })).id
    const zone = await prisma.shippingZone.create({
      data: { storeId, name: "Everywhere", countries: ["BD"], methods: { create: [{ code: "std", name: "Standard", baseCost: 80 }] } },
      include: { methods: true },
    })
    methodId = zone.methods[0]!.id
  })

  afterAll(async () => {
    if (!prisma) return
    await new Promise((r) => setTimeout(r, 500)) // background emails
    await prisma.order.deleteMany({ where: { storeId } })
    await prisma.product.deleteMany({ where: { storeId } })
    await prisma.store.delete({ where: { id: storeId } })
    await prisma.$disconnect()
  })

  it("saves a gift with the buyer as billing and the recipient as shipping", async () => {
    expect((await new Storefront(ctx).deliveryChoices()).giftOrders).toBe(true)
    const placed = await order({
      billingSameAsShipping: false,
      billingAddress: { ...recipient, firstName: "Ayesha", lastName: "Rahman", phone: "01712345678" },
      gift: { message: "Eid Mubarak!\nWith love", from: "Ayesha", hidePrices: true },
    })
    const o = await prisma.order.findUniqueOrThrow({ where: { orderKey: placed.orderKey } })
    expect(o).toMatchObject({
      isGift: true,
      giftMessage: "Eid Mubarak!\nWith love",
      giftFrom: "Ayesha",
      giftHidePrices: true,
      shippingFirstName: "Nusrat",
      billingFirstName: "Ayesha",
    })
    expect((await new Storefront(ctx).getOrderByKey(placed.orderKey)).gift).toEqual({ message: "Eid Mubarak!\nWith love", from: "Ayesha", hidePrices: true })
    expect(slips.slipShowsPrices(o)).toBe(false)
  })

  it("keeps ordinary orders as they were", async () => {
    const placed = await order()
    const o = await prisma.order.findUniqueOrThrow({ where: { orderKey: placed.orderKey } })
    expect(o).toMatchObject({ isGift: false, giftMessage: null, giftFrom: null })
    expect(slips.slipShowsPrices(o)).toBe(true)
    expect((await new Storefront(ctx).getOrderByKey(placed.orderKey)).gift).toBeNull()
  })

  it("refuses a message that won't fit the card", async () => {
    await expect(order({ gift: { message: "x".repeat(301) } })).rejects.toThrow(/Gift message: keep it to 300 characters/)
  })

  it("prints packing slips for gifts and ordinary orders together", async () => {
    const ids = (await prisma.order.findMany({ where: { storeId }, select: { id: true }, orderBy: { id: "asc" } })).map((o) => o.id)
    const file = await slips.packingSlips(storeId, ids)
    expect(file.filename).toBe("packing-slips-2.pdf")
    expect(file.pdf.subarray(0, 5).toString()).toBe("%PDF-")
    expect((file.pdf.toString("latin1").match(/\/Type \/Page\b/g) ?? []).length).toBe(2)
    await expect(slips.packingSlips(storeId, [999999999n])).rejects.toThrow(/not found/i)
  })

  it("refuses gifts when the shop switched them off", async () => {
    await prisma.storeGeneralSetting.update({ where: { storeId }, data: { giftOrders: false } })
    expect((await new Storefront(ctx).deliveryChoices()).giftOrders).toBe(false)
    await expect(order({ gift: { message: "Hi" } })).rejects.toThrow(/doesn't take gift orders/)
  })
})
