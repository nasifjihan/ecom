/**
 * Admin search (Ctrl+K) against a REAL Postgres: orders, customers and products by the ways staff
 * look them up, only with the right permissions and storefronts. Runs only when RUN_DB_TESTS=1.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import type { RequestContext } from "../../src/core"

const runDb = process.env.RUN_DB_TESTS === "1"

describe.skipIf(!runDb)("admin search (Postgres)", () => {
  let prisma: typeof import("../../src/config/prisma").prisma
  let search: typeof import("../../src/modules/search").adminSearch
  let storeId: bigint
  let dhaka: bigint
  let ctg: bigint
  let owner: RequestContext
  const suffix = Date.now().toString(36)

  beforeAll(async () => {
    ;({ prisma } = await import("../../src/config/prisma"))
    ;({ adminSearch: search } = await import("../../src/modules/search"))
    storeId = (await prisma.store.create({ data: { name: "Search Shop", slug: `search-${suffix}` } })).id
    dhaka = (await prisma.storefront.create({ data: { storeId, name: "Dhaka", code: "DHK", isDefault: true } })).id
    ctg = (await prisma.storefront.create({ data: { storeId, name: "Ctg", code: "CTG" } })).id
    owner = { storeId, requestId: "t", locale: "en", currency: "BDT", admin: { id: 1n, role: "ADMIN", permissions: ["*"] } }
    const order = (n: number, sf: bigint, first: string, phone: string) =>
      prisma.order.create({
        data: {
          storeId, storefrontId: sf, number: `SR-${suffix}-${n}`, orderKey: `sk-${suffix}-${n}`, itemsSubtotal: 500, grandTotal: 500, currencyCode: "BDT",
          paymentGatewayCode: "cod", shippingMethodCode: "pickup", shippingMethodName: "Pickup",
          billingFirstName: first, billingLastName: "Begum", billingPhone: phone, billingCountryCode: "BD", billingAddress1: "x", billingCity: "Dhaka",
        },
      })
    await order(1, dhaka, "Nasrin", "01711223344")
    await order(2, ctg, "Nasrin", "01811223344")
    await prisma.customer.create({ data: { storeId, firstName: "Nasrin", lastName: "Begum", phone: "01711223344" } })
    await prisma.product.create({ data: { storeId, name: "Nasrin Silk Saree", slug: `saree-${suffix}`, sku: `SAR-${suffix}`, regularPrice: 9000 } })
    await prisma.product.create({ data: { storeId, name: "Nasrin Old Saree", slug: `old-${suffix}`, regularPrice: 1, deletedAt: new Date() } })
  })

  afterAll(async () => {
    if (!prisma || !storeId) return // setup failed: an undefined id would match every row
    await prisma.order.deleteMany({ where: { storeId } })
    await prisma.product.deleteMany({ where: { storeId } })
    await prisma.store.delete({ where: { id: storeId } })
    await prisma.$disconnect()
  })

  it("finds orders, customers and products by name, and leaves out the Trash", async () => {
    const r = await search(owner, "nasrin")
    expect(r.orders.map((o) => o.number).sort()).toEqual([`SR-${suffix}-1`, `SR-${suffix}-2`])
    expect(r.customers).toEqual([expect.objectContaining({ name: "Nasrin Begum", phone: "01711223344" })])
    expect(r.products.map((p) => p.name)).toEqual(["Nasrin Silk Saree"])
  })

  it("matches phone numbers on their digits, order numbers and SKUs", async () => {
    expect((await search(owner, "01711-223344")).orders.map((o) => o.number)).toEqual([`SR-${suffix}-1`])
    expect((await search(owner, `SR-${suffix}-2`)).orders).toHaveLength(1)
    expect((await search(owner, `sar-${suffix}`)).products).toHaveLength(1)
  })

  it("only shows what the staff member may see", async () => {
    const dhakaOnly: RequestContext = { ...owner, admin: { id: 2n, role: "ADMIN", permissions: ["orders.view"], storefrontIds: [dhaka] } }
    const r = await search(dhakaOnly, "nasrin")
    expect(r.orders.map((o) => o.number)).toEqual([`SR-${suffix}-1`])
    expect(r.customers).toEqual([])
    expect(r.products).toEqual([])
  })
})
