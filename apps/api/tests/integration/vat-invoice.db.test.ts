/**
 * VAT-inclusive prices, the order number prefix and the store's legal details on invoices,
 * against a REAL Postgres. The test store has no VAT rates of its own, so Bangladesh's 15% applies.
 * Runs only when RUN_DB_TESTS=1.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import type { RequestContext } from "../../src/core"
import type { InvoiceDoc } from "../../src/modules/invoices/invoice.pdf"

const runDb = process.env.RUN_DB_TESTS === "1"

describe.skipIf(!runDb)("VAT and invoice details (Postgres)", () => {
  let prisma: typeof import("../../src/config/prisma").prisma
  let Landing: typeof import("../../src/modules/landing/landing.service").LandingService
  let Invoices: typeof import("../../src/modules/invoices/invoices.service").InvoiceService
  let Reports: typeof import("../../src/modules/reports/reports.service").ReportsService
  let storeId: bigint
  let methodId: bigint
  let owner: RequestContext
  let visitor: RequestContext
  const suffix = Date.now().toString(36)
  const prefix = `V${suffix.slice(-5).toUpperCase()}`
  const address = { district: "Dhaka", addressLine1: "House 4, Road 7, Dhanmondi" }
  const form = () => ({ name: "Rahim Uddin", phone: "01712-345678", address, qty: 1, shippingMethodId: methodId })

  beforeAll(async () => {
    ;({ prisma } = await import("../../src/config/prisma"))
    ;({ LandingService: Landing } = await import("../../src/modules/landing/landing.service"))
    ;({ InvoiceService: Invoices } = await import("../../src/modules/invoices/invoices.service"))
    ;({ ReportsService: Reports } = await import("../../src/modules/reports/reports.service"))
    storeId = (await prisma.store.create({ data: { name: "VAT Test", slug: `vat-${suffix}` } })).id
    owner = { storeId, requestId: "test", locale: "en", currency: "BDT", admin: { id: 1n, role: "OWNER", permissions: ["*"] } }
    visitor = { storeId, requestId: "test", locale: "en", currency: "BDT" }
    await prisma.storeGeneralSetting.create({
      data: {
        storeId,
        emailFrom: "shop@vat.test",
        emailFromName: "VAT Test",
        legalName: "VAT Test Fashion Ltd.",
        vatRegNo: "000123456-0101",
        tradeLicenseNo: "TRAD/DNCC/012345/2026",
        invoiceNote: "Exchange within 7 days with this invoice.",
        pricesIncludeTax: true,
        orderPrefix: prefix,
      },
    })
    await prisma.paymentGatewayConfig.create({ data: { storeId, code: "cod", name: "Cash on delivery", enabled: true } })
    const shirt = await prisma.product.create({
      data: { storeId, name: "Shirt", slug: `shirt-${suffix}`, status: "published", regularPrice: 1500, manageStock: false },
    })
    const zone = await prisma.shippingZone.create({
      data: { storeId, name: "Everywhere", countries: ["BD"], methods: { create: [{ code: "std", name: "Home delivery", baseCost: 115 }] } },
      include: { methods: true },
    })
    methodId = zone.methods[0]!.id
    await new Landing(owner).create({
      slug: "shirt",
      title: "Shirt",
      status: "published",
      productId: shirt.id,
      headline: "Shirt",
      offerPrice: 1150,
      offerEndsAt: new Date(Date.now() + 86_400_000).toISOString(),
      maxQty: 3,
    })
  })

  afterAll(async () => {
    if (!prisma) return
    await new Promise((r) => setTimeout(r, 500)) // background emails
    await prisma.invoice.deleteMany({ where: { order: { storeId } } })
    await prisma.order.deleteMany({ where: { storeId } })
    await prisma.landingPage.deleteMany({ where: { storeId } })
    await prisma.product.deleteMany({ where: { storeId } })
    await prisma.store.delete({ where: { id: storeId } })
    await prisma.$disconnect()
  })

  it("takes VAT out of VAT-inclusive prices instead of adding it", async () => {
    const q = await new Landing(visitor).quote("shirt", { qty: 1, address, shippingMethodId: methodId })
    // 1,150 shirt + 115 delivery, VAT 15% inside each: 150 + 15.
    expect(q.totals).toMatchObject({ itemsSubtotal: 1150, shippingTotal: 115, taxTotal: 165, taxIncluded: true, grandTotal: 1265 })
  })

  it("keeps the rate on the order and numbers it with the store's prefix", async () => {
    const placed = await new Landing(visitor).order("shirt", form())
    expect(placed.grandTotal).toBe(1265)
    expect(placed.number).toMatch(new RegExp(`^${prefix}-\\d{14}$`))
    const o = await prisma.order.findFirstOrThrow({ where: { orderKey: placed.orderKey }, include: { items: true } })
    expect(o).toMatchObject({ pricesIncludeTax: true })
    expect(Number(o.taxRate)).toBe(15)
    expect(Number(o.taxTotal)).toBe(165)
    expect(o.items.map((i) => [Number(i.lineTax), Number(i.lineTotal)])).toEqual([[150, 1150]])
    // The next order that day counts on from it.
    const next = await new Landing(visitor).order("shirt", form())
    expect(Number(next.number.slice(-6))).toBe(Number(placed.number.slice(-6)) + 1)
  })

  it("prints the BIN, trade licence, VAT inside the total and the store's note on the invoice", async () => {
    const order = await prisma.order.findFirstOrThrow({
      where: { storeId },
      orderBy: { id: "asc" },
      include: { items: true, shipments: true },
    })
    const doc = await (new Invoices(storeId) as unknown as { build: (o: typeof order) => Promise<InvoiceDoc> }).build(order)
    expect(doc.number).toBe(`INV-${order.number}`)
    expect(doc.store.legal).toEqual(["VAT Test Fashion Ltd.", "BIN: 000123456-0101", "Trade licence: TRAD/DNCC/012345/2026"])
    expect(doc.storeNote).toBe("Exchange within 7 days with this invoice.")
    const labels = doc.totals.map((t) => t.label)
    expect(labels).not.toContain("VAT 15%")
    const total = doc.totals.findIndex((t) => t.strong)
    expect(doc.totals[total]).toMatchObject({ label: "Total", value: "৳1,265.00" })
    expect(doc.totals[total + 1]).toEqual({ label: "Includes VAT 15%", value: "৳165.00" })
    const pdf = await new Invoices(storeId).forOrderId(order.id)
    expect(pdf.pdf.subarray(0, 5).toString()).toBe("%PDF-")
  })

  it("reports sales without the VAT inside them", async () => {
    const r = await new Reports(owner).tax({})
    expect(r.totals).toMatchObject({ orders: 2, sales: 2000, shipping: 200, tax: 330 })
    const s = await new Reports(owner).sales({})
    expect(s.total).toMatchObject({ itemsSubtotal: 2000, tax: 330, netSales: 2000 })
  })

  it("adds VAT on top again once prices no longer include it", async () => {
    await prisma.storeGeneralSetting.update({ where: { storeId }, data: { pricesIncludeTax: false, orderPrefix: null } })
    const q = await new Landing(visitor).quote("shirt", { qty: 1, address, shippingMethodId: methodId })
    expect(q.totals).toMatchObject({ taxTotal: 189.75, taxIncluded: false, grandTotal: 1454.75 })
    const placed = await new Landing(visitor).order("shirt", form())
    expect(placed.number).toMatch(/^\d{14}$/)
    const o = await prisma.order.findFirstOrThrow({ where: { orderKey: placed.orderKey }, include: { items: true } })
    expect(o.pricesIncludeTax).toBe(false)
    expect(o.items.map((i) => [Number(i.lineTax), Number(i.lineTotal)])).toEqual([[172.5, 1322.5]])
  })
})
