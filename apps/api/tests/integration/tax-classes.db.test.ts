/**
 * Tax classes at checkout against a REAL Postgres: each product is taxed with its own class's
 * rates (or the store's default class), delivery with its delivery option's class, the checkout
 * preview matches the order, and another store's class is refused on a product.
 * Runs only when RUN_DB_TESTS=1.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import type { RequestContext } from "../../src/core"

const runDb = process.env.RUN_DB_TESTS === "1"

describe.skipIf(!runDb)("tax classes at checkout (Postgres)", () => {
  let prisma: typeof import("../../src/config/prisma").prisma
  let Storefront: typeof import("../../src/modules/storefront/storefront.service").StorefrontService
  let Shipping: typeof import("../../src/modules/shipping/shipping.service").ShippingService
  let PlaceOrderDto: typeof import("../../src/modules/storefront/storefront.dto").PlaceOrderDto
  let storeId: bigint
  let saree: bigint // no class: the default (Standard 15%)
  let book: bigint // Exempt class (0%)
  let methodId: bigint
  let standard: bigint
  let exempt: bigint
  let ctx: RequestContext
  const suffix = Date.now().toString(36)
  const address = { firstName: "Nusrat", lastName: "Jahan", country: "BD", district: "Dhaka", addressLine1: "House 9, Road 4, Gulshan", phone: "01811111111" }

  const order = (items: { productId: bigint; qty: number }[]) =>
    new Storefront(ctx).placeOrder(
      PlaceOrderDto.parse({
        phone: "01712345678",
        shippingAddress: address,
        shippingMethodId: String(methodId),
        paymentGateway: "cod",
        items: items.map((i) => ({ productId: String(i.productId), qty: i.qty })),
        termsAgreed: true,
      }),
    )
  const placed = async (items: { productId: bigint; qty: number }[]) =>
    prisma.order.findUniqueOrThrow({ where: { orderKey: (await order(items)).orderKey } })

  beforeAll(async () => {
    ;({ prisma } = await import("../../src/config/prisma"))
    ;({ StorefrontService: Storefront } = await import("../../src/modules/storefront/storefront.service"))
    ;({ ShippingService: Shipping } = await import("../../src/modules/shipping/shipping.service"))
    ;({ PlaceOrderDto } = await import("../../src/modules/storefront/storefront.dto"))
    storeId = (await prisma.store.create({ data: { name: "Tax Test", slug: `tax-${suffix}` } })).id
    ctx = { storeId, requestId: "test", locale: "en", currency: "BDT" }
    await prisma.storeGeneralSetting.create({ data: { storeId, emailFrom: "shop@tax.test", emailFromName: "Tax Test" } })
    await prisma.paymentGatewayConfig.create({ data: { storeId, code: "cod", name: "Cash on delivery", enabled: true } })
    standard = (await prisma.taxClass.create({ data: { storeId, name: "Standard", rates: { create: [{ countryCode: "BD", rate: 15, name: "VAT" }] } } })).id
    exempt = (await prisma.taxClass.create({ data: { storeId, name: "Exempt", rates: { create: [{ countryCode: "*", rate: 0, name: "Exempt" }] } } })).id
    saree = (await prisma.product.create({ data: { storeId, name: "Jamdani saree", slug: `saree-${suffix}`, status: "published", regularPrice: 1000, manageStock: false } })).id
    book = (await prisma.product.create({ data: { storeId, name: "Poetry book", slug: `book-${suffix}`, status: "published", regularPrice: 500, manageStock: false, taxClassId: exempt } })).id
    const zone = await prisma.shippingZone.create({
      data: { storeId, name: "Everywhere", countries: ["BD"], methods: { create: [{ code: "std", name: "Standard", baseCost: 100 }] } },
      include: { methods: true },
    })
    methodId = zone.methods[0]!.id
  })

  afterAll(async () => {
    if (!prisma || !storeId) return // setup failed: an undefined id would match every row
    await new Promise((r) => setTimeout(r, 500)) // background emails
    await prisma.order.deleteMany({ where: { storeId } })
    await prisma.product.deleteMany({ where: { storeId } })
    await prisma.store.delete({ where: { id: storeId } })
    await prisma.$disconnect()
  })

  it("with no default class: a classed product uses its class, the rest every matching rate (as before)", async () => {
    // The exempt book pays no VAT; delivery has no class, so every matching rate applies (15%).
    const o = await placed([{ productId: book, qty: 1 }])
    expect(Number(o.taxTotal)).toBe(15)
    // The unclassed saree: 15% (Standard) + 0% (Exempt) both match, as before classes.
    expect(Number((await placed([{ productId: saree, qty: 1 }])).taxTotal)).toBe(165)
  })

  it("with a default class: the exempt book pays no VAT, the saree and delivery pay 15%", async () => {
    await new Shipping().updateTaxClass(ctx, standard, { isDefault: true })
    const o = await placed([
      { productId: saree, qty: 1 },
      { productId: book, qty: 1 },
    ])
    expect(Number(o.taxTotal)).toBe(165) // 15% of the saree's 1000 + 15% of delivery's 100
    // The exempt part has no tax, so the order's one rate is still 15% (two non-zero rates would make it none).
    expect(Number(o.taxRate)).toBe(15)

    const book1 = await placed([{ productId: book, qty: 1 }])
    expect(Number(book1.taxTotal)).toBe(15) // only delivery
  })

  it("delivery uses its option's class", async () => {
    await prisma.shippingMethod.update({ where: { id: methodId }, data: { taxClassId: exempt } })
    const o = await placed([{ productId: saree, qty: 2 }])
    expect(Number(o.taxTotal)).toBe(300) // 15% of 2000, no VAT on delivery
    await prisma.shippingMethod.update({ where: { id: methodId }, data: { taxClassId: null } })
  })

  it("the checkout preview gives the same VAT as the order", async () => {
    const preview = await new Shipping().taxPreview(ctx, {
      countryCode: "BD",
      city: "Dhaka",
      subtotal: 1500,
      shippingTotal: 100,
      lines: `${saree}:1000,${book}:500`,
      shippingMethodId: methodId,
    })
    expect(preview.totalTax).toBe(165)
    expect(preview.effectiveTaxRatePct).toBe(15)
  })

  it("refuses another store's tax class on a product", async () => {
    const other = await prisma.store.create({ data: { name: "Other", slug: `other-${suffix}` } })
    try {
      const theirs = await prisma.taxClass.create({ data: { storeId: other.id, name: "Theirs" } })
      const { CatalogService } = await import("../../src/modules/catalog/catalog.service")
      await expect(
        new CatalogService({ ...ctx, admin: { id: 1n, role: "owner", permissions: ["*"] } }).updateProduct(saree, { taxClassId: theirs.id } as never),
      ).rejects.toThrow(/this store's tax classes/)
    } finally {
      await prisma.taxClass.deleteMany({ where: { storeId: other.id } })
      await prisma.store.delete({ where: { id: other.id } })
    }
  })
})
