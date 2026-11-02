/**
 * The store dashboard's top products against a REAL Postgres: a promotion's free gift is not a
 * sale, so it must never appear (it would top the list on every qualifying order). Runs only
 * when RUN_DB_TESTS=1.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import type { RequestContext } from "../../src/core"

const runDb = process.env.RUN_DB_TESTS === "1"

describe.skipIf(!runDb)("Dashboard top products (Postgres)", () => {
  let prisma: typeof import("../../src/config/prisma").prisma
  let Dashboard: typeof import("../../src/modules/dashboard/dashboard.service").DashboardService
  let storeId: bigint
  let soldId: bigint
  let giftId: bigint
  const suffix = Date.now().toString(36)
  const ctx = (): RequestContext => ({ storeId, requestId: "t", locale: "en", currency: "BDT" })

  beforeAll(async () => {
    ;({ prisma } = await import("../../src/config/prisma"))
    ;({ DashboardService: Dashboard } = await import("../../src/modules/dashboard/dashboard.service"))
    storeId = (await prisma.store.create({ data: { name: "Dash Shop", slug: `dash-${suffix}` } })).id
    soldId = (await prisma.product.create({ data: { storeId, name: "Cotton Panjabi", slug: `dp-${suffix}`, status: "published", regularPrice: 1000, manageStock: false } })).id
    giftId = (await prisma.product.create({ data: { storeId, name: "Free Gift Mug", slug: `dg-${suffix}`, status: "published", regularPrice: 0, manageStock: false } })).id
    await prisma.order.create({
      data: {
        storeId,
        number: `DASH-${suffix}`,
        orderKey: `dash-${suffix}`,
        status: "PROCESSING",
        paymentStatus: "PAID",
        billingFirstName: "Rina",
        billingLastName: "Akter",
        billingPhone: "01712345678",
        billingAddress1: "House 1",
        billingCity: "Dhaka",
        billingCountryCode: "BD",
        itemsSubtotal: 2000,
        grandTotal: 2000,
        currencyCode: "BDT",
        paymentGatewayCode: "cod",
        shippingMethodCode: "std",
        shippingMethodName: "Standard",
        items: {
          create: [
            { productId: soldId, productName: "Cotton Panjabi", quantity: 2, unitPrice: 1000, lineSubtotal: 2000, lineTotal: 2000 },
            // A free gift, given away in bulk: without the filter it would outrank every real sale.
            { productId: giftId, productName: "Free Gift Mug", quantity: 10, unitPrice: 0, lineSubtotal: 0, lineTotal: 0, meta: { gift: { promotionId: "1", promotionName: "Free gift" } } },
          ],
        },
      },
    })
  })

  afterAll(async () => {
    if (!prisma || !storeId) return // setup failed: an undefined id would match every row
    await prisma.order.deleteMany({ where: { storeId } })
    await prisma.product.deleteMany({ where: { storeId } })
    await prisma.store.delete({ where: { id: storeId } })
    await prisma.$disconnect()
  })

  it("leaves a promotion's free gift out of the top products", async () => {
    const overview = await new Dashboard(ctx()).getStoreOverview(30)
    const names = overview.topProducts.map((p) => p.name)
    expect(names).toContain("Cotton Panjabi")
    expect(names).not.toContain("Free Gift Mug")
    expect(overview.topProducts[0]).toMatchObject({ name: "Cotton Panjabi", sales: 2, revenue: 2000 })
  })
})
