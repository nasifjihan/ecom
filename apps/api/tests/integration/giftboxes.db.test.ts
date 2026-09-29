/**
 * Gift boxes against a REAL Postgres: set-up checks, the boxes on the storefront, and a box going
 * through checkout: priced like any lines, checked (item count, what it takes, the message), and
 * saved on the order lines with its name and message. Runs only when RUN_DB_TESTS=1.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import type { RequestContext } from "../../src/core"

const runDb = process.env.RUN_DB_TESTS === "1"

describe.skipIf(!runDb)("gift boxes (Postgres)", () => {
  let prisma: typeof import("../../src/config/prisma").prisma
  let Boxes: typeof import("../../src/modules/giftboxes/giftboxes.service").GiftBoxesService
  let Shop: typeof import("../../src/modules/storefront/storefront.service").StorefrontService
  let storeId: bigint
  let owner: RequestContext
  let visitor: RequestContext
  let methodId: bigint
  let boxId: bigint
  let sweetsId: bigint
  const p: Record<string, bigint> = {}
  const suffix = Date.now().toString(36)

  const product = async (key: string, price: number, categoryId?: bigint) => {
    p[key] = (
      await prisma.product.create({
        data: {
          storeId,
          name: key,
          slug: `${key}-${suffix}`,
          status: "published",
          regularPrice: price,
          manageStock: false,
          ...(categoryId ? { categories: { create: [{ categoryId }] } } : {}),
        },
      })
    ).id
  }

  beforeAll(async () => {
    ;({ prisma } = await import("../../src/config/prisma"))
    ;({ GiftBoxesService: Boxes } = await import("../../src/modules/giftboxes/giftboxes.service"))
    ;({ StorefrontService: Shop } = await import("../../src/modules/storefront/storefront.service"))
    storeId = (await prisma.store.create({ data: { name: "Gift Box Test", slug: `gb-${suffix}` } })).id
    owner = { storeId, requestId: "test", locale: "en", currency: "BDT", admin: { id: 1n, role: "OWNER", permissions: ["*"] } }
    visitor = { storeId, requestId: "test", locale: "en", currency: "BDT" }
    await prisma.paymentGatewayConfig.create({ data: { storeId, code: "cod", name: "Cash on delivery", enabled: true } })
    const zone = await prisma.shippingZone.create({
      data: { storeId, name: "Everywhere", countries: ["BD"], methods: { create: [{ code: "std", name: "Home delivery", baseCost: 80 }] } },
      include: { methods: true },
    })
    methodId = zone.methods[0]!.id
    const sweets = await prisma.category.create({ data: { storeId, name: "Sweets", slug: `sweets-${suffix}` } })
    const choc = await prisma.category.create({ data: { storeId, name: "Chocolate", slug: `choc-${suffix}`, parentId: sweets.id } })
    const home = await prisma.category.create({ data: { storeId, name: "Home", slug: `home-${suffix}` } })
    await product("box", 150)
    await product("truffles", 400, choc.id)
    await product("laddu", 250, sweets.id)
    await product("mug", 300, home.id)
    await product("attar", 900, home.id)
    sweetsId = sweets.id
  })

  afterAll(async () => {
    if (!prisma) return
    await new Promise((r) => setTimeout(r, 500))
    await prisma.order.deleteMany({ where: { storeId } })
    await prisma.giftBox.deleteMany({ where: { storeId } })
    await prisma.productCategory.deleteMany({ where: { product: { storeId } } })
    await prisma.product.deleteMany({ where: { storeId } })
    await prisma.category.deleteMany({ where: { storeId, parentId: { not: null } } })
    await prisma.category.deleteMany({ where: { storeId } })
    await prisma.store.delete({ where: { id: storeId } })
    await prisma.$disconnect()
  })

  const input = () => ({
    slug: "eid-box",
    name: "Eid gift box",
    boxProductId: p.box!,
    minItems: 2,
    maxItems: 4,
    categoryIds: [sweetsId],
    productIds: [p.attar!],
    messageMax: 40,
  })

  it("checks the set-up", async () => {
    await expect(new Boxes(owner).create({ ...input(), slug: "Eid Box" })).rejects.toThrow(/lowercase/)
    await expect(new Boxes(owner).create({ ...input(), minItems: 5 })).rejects.toThrow(/can't be fewer/)
    await expect(new Boxes(owner).create({ ...input(), productIds: [p.box!] })).rejects.toThrow(/can't hold itself/)
    const b = await new Boxes(owner).create(input())
    boxId = BigInt(b.id)
    expect(b).toMatchObject({ slug: "eid-box", boxProduct: { name: "box", price: 150 }, sold: 0 })
    await expect(new Boxes(owner).create(input())).rejects.toThrow(/uses that address/)
  })

  it("shows the box on the storefront", async () => {
    expect(await new Boxes(visitor).shopList()).toEqual([
      { slug: "eid-box", name: "Eid gift box", description: null, imageUrl: null, minItems: 2, maxItems: 4, boxPrice: 150 },
    ])
    const one = await new Boxes(visitor).shopOne("eid-box")
    expect(one).toMatchObject({ id: String(boxId), productIds: [String(p.attar)], box: { name: "box", price: 150, styles: [] } })
  })

  const draft = (items: unknown[]) => ({
    strict: true,
    items: items as never,
    email: "gift@x.test",
    shippingAddress: { firstName: "Sadia", lastName: "K", country: "BD", district: "Dhaka", division: "", upazila: "", postcode: "", addressLine1: "House 1", phone: "01712345678" },
    billingSameAsShipping: true,
    delivery: { methodId },
    paymentGateway: "cod",
    requireEnabledGateway: false,
    applyGatewayFee: false,
  })
  const tag = (role: "box" | "item", message?: string) => ({ key: "b1", giftBoxId: boxId, role, message })

  it("refuses a box that doesn't follow its rules", async () => {
    const shop = new Shop(visitor)
    await expect(shop.quoteOrder(draft([{ productId: p.box, qty: 1, box: tag("box") }, { productId: p.truffles, qty: 1, box: tag("item") }]))).rejects.toThrow(/needs at least 2 items/)
    await expect(
      shop.quoteOrder(draft([{ productId: p.box, qty: 1, box: tag("box") }, { productId: p.truffles, qty: 1, box: tag("item") }, { productId: p.mug, qty: 1, box: tag("item") }])),
    ).rejects.toThrow(/can't go in it/)
    await expect(
      shop.quoteOrder(draft([{ productId: p.box, qty: 1, box: tag("box", "x".repeat(41)) }, { productId: p.truffles, qty: 2, box: tag("item") }])),
    ).rejects.toThrow(/too long/)
  })

  it("sells a good box like any lines and keeps its name and message on the order", async () => {
    const shop = new Shop(visitor)
    const q = await shop.quoteOrder(
      draft([
        { productId: p.mug, qty: 1 },
        { productId: p.box, qty: 1, box: tag("box", "Eid Mubarak, Nanu!") },
        { productId: p.truffles, qty: 2, box: tag("item") },
        { productId: p.laddu, qty: 1, box: tag("item") },
        { productId: p.attar, qty: 1, box: tag("item") },
      ]),
    )
    expect(q.totals.itemsSubtotal).toBe(300 + 150 + 800 + 250 + 900)
    const order = await shop.createOrder(q, { customerId: null, source: "website", historyNote: "test" })
    const items = await prisma.orderItem.findMany({ where: { orderId: order.id }, orderBy: { id: "asc" } })
    const box = (i: (typeof items)[number]) => (i.meta as { giftBox?: { name: string; role: string; message: string | null } } | null)?.giftBox ?? null
    expect(items.map((i) => [i.productName, box(i)?.role ?? null])).toEqual([
      ["mug", null],
      ["box", "box"],
      ["truffles", "item"],
      ["laddu", "item"],
      ["attar", "item"],
    ])
    expect(box(items[1]!)).toMatchObject({ key: "b1", giftBoxId: String(boxId), name: "Eid gift box", message: "Eid Mubarak, Nanu!" })
    expect((await new Boxes(owner).get(boxId)).sold).toBe(1)
  })

  it("stops selling a box that was switched off", async () => {
    await new Boxes(owner).update(boxId, { ...input(), isActive: false })
    expect(await new Boxes(visitor).shopList()).toEqual([])
    await expect(new Boxes(visitor).shopOne("eid-box")).rejects.toThrow(/not found/i)
    await expect(
      new Shop(visitor).quoteOrder(draft([{ productId: p.box, qty: 1, box: tag("box") }, { productId: p.truffles, qty: 2, box: tag("item") }])),
    ).rejects.toThrow(/no longer available/)
  })
})
