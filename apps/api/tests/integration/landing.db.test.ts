/**
 * Landing pages against a REAL Postgres: drafts only through the preview key, the offer price
 * charged by the server (and never above the normal price), the order form's checks, orders
 * tagged with their page, visits and sales per page, and a 301 when the address changes.
 * Runs only when RUN_DB_TESTS=1.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import type { RequestContext } from "../../src/core"

const runDb = process.env.RUN_DB_TESTS === "1"

describe.skipIf(!runDb)("landing pages (Postgres)", () => {
  let prisma: typeof import("../../src/config/prisma").prisma
  let Landing: typeof import("../../src/modules/landing/landing.service").LandingService
  let storeId: bigint
  let shirt: bigint
  let methodId: bigint
  let pageId: bigint
  let owner: RequestContext
  let visitor: RequestContext
  const suffix = Date.now().toString(36)
  let total = 0
  const address = { district: "Dhaka", addressLine1: "House 4, Road 7, Dhanmondi" }

  beforeAll(async () => {
    ;({ prisma } = await import("../../src/config/prisma"))
    ;({ LandingService: Landing } = await import("../../src/modules/landing/landing.service"))
    storeId = (await prisma.store.create({ data: { name: "Landing Test", slug: `lp-${suffix}` } })).id
    owner = { storeId, requestId: "test", locale: "en", currency: "BDT", admin: { id: 1n, role: "OWNER", permissions: ["*"] } }
    visitor = { storeId, requestId: "test", locale: "en", currency: "BDT" }
    await prisma.paymentGatewayConfig.create({ data: { storeId, code: "cod", name: "Cash on delivery", enabled: true } })
    shirt = (
      await prisma.product.create({
        data: { storeId, name: "Panjabi", slug: `panjabi-${suffix}`, status: "published", regularPrice: 1500, manageStock: false },
      })
    ).id
    const zone = await prisma.shippingZone.create({
      data: { storeId, name: "Everywhere", countries: ["BD"], methods: { create: [{ code: "std", name: "Home delivery", baseCost: 80 }] } },
      include: { methods: true },
    })
    methodId = zone.methods[0]!.id
  })

  afterAll(async () => {
    if (!prisma) return
    await new Promise((r) => setTimeout(r, 500)) // background emails
    await prisma.order.deleteMany({ where: { storeId } })
    await prisma.landingPage.deleteMany({ where: { storeId } })
    await prisma.redirect.deleteMany({ where: { storeId } })
    await prisma.product.deleteMany({ where: { storeId } })
    await prisma.store.delete({ where: { id: storeId } })
    await prisma.$disconnect()
  })

  const base = () => ({
    slug: "eid-panjabi",
    title: "Eid panjabi",
    status: "draft" as const,
    productId: shirt,
    headline: "The panjabi for Eid",
    offerPrice: 1190,
    offerEndsAt: new Date(Date.now() + 86_400_000).toISOString(),
    maxQty: 3,
  })

  it("keeps a draft hidden except through its preview link", async () => {
    await expect(new Landing(owner).create({ ...base(), slug: "Bad Slug" })).rejects.toThrow(/lowercase/)
    const lp = await new Landing(owner).create(base())
    pageId = BigInt(lp.id)
    expect(lp).toMatchObject({ offerRunning: true, views: 0, orders: 0, conversion: null })
    await expect(new Landing(visitor).page("eid-panjabi")).rejects.toThrow(/not found/i)
    const seen = await new Landing(visitor).page("eid-panjabi", lp.previewToken)
    expect(seen).toMatchObject({ draft: true, product: { name: "Panjabi", price: 1190, compareAtPrice: 1500 }, offer: { running: true } })
    await expect(new Landing(owner).create(base())).rejects.toThrow(/uses that address/)
  })

  it("charges the offer price and lists delivery options", async () => {
    await new Landing(owner).update(pageId, { ...base(), status: "published" })
    const q = await new Landing(visitor).quote("eid-panjabi", { qty: 2, address, shippingMethodId: methodId })
    expect(q.unitPrice).toBe(1190)
    expect(q.shippingOptions.map((o) => [o.name, o.fee])).toEqual([["Home delivery", 80]])
    expect(q.totals).toMatchObject({ itemsSubtotal: 2380, shippingTotal: 80 })
    expect(q.totals.grandTotal).toBe(2460 + q.totals.taxTotal) // the store's VAT on top
    total = q.totals.grandTotal
    // More than the page allows is capped.
    expect((await new Landing(visitor).quote("eid-panjabi", { qty: 9, address, shippingMethodId: methodId })).totals.itemsSubtotal).toBe(3570)
  })

  it("never charges an offer above the normal price", async () => {
    await new Landing(owner).update(pageId, { ...base(), status: "published", offerPrice: 1800 })
    expect((await new Landing(visitor).page("eid-panjabi")).product).toMatchObject({ price: 1500, compareAtPrice: null })
    expect((await new Landing(visitor).quote("eid-panjabi", { qty: 1, address })).unitPrice).toBe(1500)
    await new Landing(owner).update(pageId, { ...base(), status: "published", offerEndsAt: new Date(Date.now() - 1000).toISOString() })
    expect((await new Landing(visitor).page("eid-panjabi")).offer).toEqual({ running: false, endsAt: null })
    await new Landing(owner).update(pageId, { ...base(), status: "published" })
  })

  it("checks the order form and tags the order with its page", async () => {
    const order = { name: "Rahim Uddin", phone: "01712-345678", address, qty: 2, shippingMethodId: methodId }
    await expect(new Landing(visitor).order("eid-panjabi", { ...order, phone: "12345" })).rejects.toThrow(/mobile number/)
    await expect(new Landing(visitor).order("eid-panjabi", { ...order, name: " " })).rejects.toThrow(/your name/)
    const placed = await new Landing(visitor).order("eid-panjabi", order)
    expect(placed.grandTotal).toBe(total)
    const saved = await prisma.order.findFirst({ where: { orderKey: placed.orderKey }, include: { items: true } })
    expect(saved).toMatchObject({ source: "landing", landingPageId: pageId, paymentGatewayCode: "cod" })
    expect(saved!.items.map((i) => Number(i.unitPrice))).toEqual([1190])
    expect(saved).toMatchObject({ shippingFirstName: "Rahim", shippingLastName: "Uddin", shippingPhone: "01712345678" })
  })

  it("counts visits and shows orders, sales and conversion", async () => {
    for (let i = 0; i < 4; i++) await new Landing(visitor).view("eid-panjabi")
    await new Landing(visitor).view("no-such-page")
    const [lp] = await new Landing(owner).list()
    expect(lp).toMatchObject({ views: 4, orders: 1, sales: total, conversion: 25 })
  })

  it("sends the old address to the new one when it changes", async () => {
    await new Landing(owner).update(pageId, { ...base(), status: "published", slug: "eid-offer" })
    const r = await prisma.redirect.findFirst({ where: { storeId, fromPath: "/lp/eid-panjabi" } })
    expect(r).toMatchObject({ toUrl: "/lp/eid-offer", statusCode: 301 })
    await new Landing(owner).remove(pageId)
    expect(await prisma.order.count({ where: { storeId, landingPageId: null } })).toBe(1)
  })
})
