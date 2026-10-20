/**
 * Guest checkout and checkout style per storefront, against a real Postgres. RUN_DB_TESTS=1 only.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import type { RequestContext } from "../../src/core"

const runDb = process.env.RUN_DB_TESTS === "1"

describe.skipIf(!runDb)("guest checkout per storefront (Postgres)", () => {
  let prisma: typeof import("../../src/config/prisma").prisma
  let Storefront: typeof import("../../src/modules/storefront/storefront.service").StorefrontService
  let PlaceOrderDto: typeof import("../../src/modules/storefront/storefront.dto").PlaceOrderDto
  let forget: typeof import("../../src/modules/storefronts/storefronts.context").forgetStorefronts
  let storeId: bigint | undefined
  let productId: bigint
  let methodId: bigint
  let ctx: RequestContext
  const suffix = Date.now().toString(36)

  const order = (c: RequestContext) =>
    new Storefront(c).placeOrder(
      PlaceOrderDto.parse({
        phone: "01712345678",
        shippingAddress: {
          firstName: "Salma",
          lastName: "Begum",
          country: "BD",
          district: "Dhaka",
          addressLine1: "House 7, Road 2",
          phone: "01712345678",
        },
        shippingMethodId: String(methodId),
        paymentGateway: "cod",
        items: [{ productId: String(productId), qty: 1 }],
        termsAgreed: true,
      }),
    )
  const setStorefront = async (data: { guestCheckout?: boolean; checkoutStyle?: string }) => {
    await prisma.storefront.updateMany({ where: { storeId }, data })
    forget(storeId!)
  }

  beforeAll(async () => {
    ;({ prisma } = await import("../../src/config/prisma"))
    ;({ StorefrontService: Storefront } =
      await import("../../src/modules/storefront/storefront.service"))
    ;({ PlaceOrderDto } = await import("../../src/modules/storefront/storefront.dto"))
    ;({ forgetStorefronts: forget } =
      await import("../../src/modules/storefronts/storefronts.context"))
    storeId = (await prisma.store.create({ data: { name: "Guest Test", slug: `guest-${suffix}` } }))
      .id
    ctx = { storeId, requestId: "test", locale: "en", currency: "BDT" }
    await prisma.paymentGatewayConfig.create({
      data: { storeId, code: "cod", name: "Cash on delivery", enabled: true },
    })
    productId = (
      await prisma.product.create({
        data: {
          storeId,
          name: "Scarf",
          slug: `scarf-${suffix}`,
          status: "published",
          regularPrice: 500,
          manageStock: false,
        },
      })
    ).id
    const zone = await prisma.shippingZone.create({
      data: {
        storeId,
        name: "Everywhere",
        countries: ["BD"],
        methods: { create: [{ code: "std", name: "Standard", baseCost: 60 }] },
      },
      include: { methods: true },
    })
    methodId = zone.methods[0]!.id
  })

  afterAll(async () => {
    if (!prisma || !storeId) return // setup failed: an undefined id would match every row
    await new Promise((r) => setTimeout(r, 500)) // background emails
    await prisma.order.deleteMany({ where: { storeId } })
    await prisma.customer.deleteMany({ where: { storeId } })
    await prisma.product.deleteMany({ where: { storeId } })
    await prisma.store.delete({ where: { id: storeId } })
    await prisma.$disconnect()
  })

  it("takes guest orders by default and says so with the checkout style", async () => {
    expect(await new Storefront(ctx).deliveryChoices()).toMatchObject({
      guestCheckout: true,
      checkoutStyle: "single",
    })
    await expect(order(ctx)).resolves.toBeTruthy()
  })

  it("refuses guests when the storefront needs an account, but takes signed-in customers", async () => {
    await setStorefront({ guestCheckout: false, checkoutStyle: "steps" })
    expect(await new Storefront(ctx).deliveryChoices()).toMatchObject({
      guestCheckout: false,
      checkoutStyle: "steps",
    })
    await expect(order(ctx)).rejects.toThrow(/log in or create an account/)
    const c = await prisma.customer.create({
      data: {
        storeId: storeId!,
        email: `g-${suffix}@example.com`,
        firstName: "Salma",
        lastName: "Begum",
      },
    })
    await expect(order({ ...ctx, customer: { id: c.id } })).resolves.toBeTruthy()
  })
})
