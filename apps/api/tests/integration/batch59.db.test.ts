/**
 * Batch 59 against a REAL Postgres: the Trending product list (sold most this week, then all-time
 * sales, cancelled orders left out) and the account's Reviews page (delivered products still to
 * review, and the reviews written). Runs only when RUN_DB_TESTS=1.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import type { RequestContext } from "../../src/core"

const runDb = process.env.RUN_DB_TESTS === "1"

describe.skipIf(!runDb)("Batch 59 trending and my reviews (Postgres)", () => {
  let prisma: typeof import("../../src/config/prisma").prisma
  let Shop: typeof import("../../src/modules/storefront/storefront.service").StorefrontService
  let Extras: typeof import("../../src/modules/storefront/engagement").StorefrontEngagement
  let sfDto: typeof import("../../src/modules/storefront/storefront.dto")
  let storeId: bigint
  let customerId: bigint
  const ids: Record<string, bigint> = {}
  const suffix = Date.now().toString(36)
  const ctx = (): RequestContext => ({ storeId, requestId: "t", locale: "en", currency: "BDT", customer: { id: customerId } })
  const titles = async (sort: string) =>
    ((await new Shop(ctx()).listProducts(sfDto.StorefrontProductsQueryDto.parse({ sort }))) as unknown as { items: { title: string }[] }).items.map((i) => i.title)

  beforeAll(async () => {
    ;({ prisma } = await import("../../src/config/prisma"))
    ;({ StorefrontService: Shop } = await import("../../src/modules/storefront/storefront.service"))
    ;({ StorefrontEngagement: Extras } = await import("../../src/modules/storefront/engagement"))
    sfDto = await import("../../src/modules/storefront/storefront.dto")
    storeId = (await prisma.store.create({ data: { name: "B59 Shop", slug: `b59-${suffix}` } })).id
    customerId = (await prisma.customer.create({ data: { storeId, firstName: "Rina", lastName: "Akter", phone: "01722000701" } })).id
    // All-time sales: Old Favourite 50, Steady 10, New Hit 0.
    for (const [name, saleCount] of [["Old Favourite", 50], ["Steady", 10], ["New Hit", 0]] as const)
      ids[name] = (await prisma.product.create({ data: { storeId, name, slug: `${name.toLowerCase().replace(" ", "-")}-${suffix}`, status: "published", regularPrice: 1000, saleCount } })).id
    const order = (n: number, status: "DELIVERED" | "CANCELLED", items: [string, number][]) =>
      prisma.order.create({
        data: {
          storeId, customerId, number: `B59-${suffix}-${n}`, orderKey: `b59-${suffix}-${n}`, status, itemsSubtotal: 1000, grandTotal: 1000, currencyCode: "BDT",
          paymentGatewayCode: "cod", shippingMethodCode: "pickup", shippingMethodName: "Pickup",
          billingFirstName: "Rina", billingLastName: "Akter", billingPhone: "01722000701", billingCountryCode: "BD", billingAddress1: "x", billingCity: "Dhaka",
          items: { create: items.map(([name, quantity]) => ({ productId: ids[name], productName: name, quantity, unitPrice: 1000, lineSubtotal: 1000 * quantity, lineTotal: 1000 * quantity })) },
        },
      })
    // This week: New Hit sold 5 and Steady 1. A cancelled order for 99 Old Favourites doesn't count.
    await order(1, "DELIVERED", [["New Hit", 5], ["Steady", 1]])
    await order(2, "CANCELLED", [["Old Favourite", 99]])
  })

  afterAll(async () => {
    if (!prisma || !storeId) return // setup failed: an undefined id would match every row
    await prisma.review.deleteMany({ where: { storeId } })
    await prisma.order.deleteMany({ where: { storeId } })
    await prisma.customer.deleteMany({ where: { storeId } })
    await prisma.product.deleteMany({ where: { storeId } })
    await prisma.store.delete({ where: { id: storeId } })
    await prisma.$disconnect()
  })

  it("puts this week's sellers first, then the all-time best sellers", async () => {
    expect(await titles("trending")).toEqual(["New Hit", "Steady", "Old Favourite"])
    expect(await titles("popular")).toEqual(["Old Favourite", "Steady", "New Hit"])
  })

  it("lists delivered products to review, and moves one to 'your reviews' once written", async () => {
    const before = await new Extras(ctx()).myReviews()
    expect(before.toReview.map((p) => p.title).sort()).toEqual(["New Hit", "Steady"])
    expect(before.reviews).toEqual([])

    const made = await new Extras(ctx()).submitReview(ids["Steady"]!, { rating: 5, body: "Good cloth" })
    expect(made.verified).toBe(true)
    const after = await new Extras(ctx()).myReviews()
    expect(after.toReview.map((p) => p.title)).toEqual(["New Hit"])
    expect(after.reviews.map((r) => [r.title, r.rating, r.shown])).toEqual([["Steady", 5, true]])
  })

  it("doesn't offer a product that was only in a cancelled order, or one with reviews turned off", async () => {
    await prisma.product.update({ where: { id: ids["New Hit"]! }, data: { allowReviews: false } })
    const r = await new Extras(ctx()).myReviews()
    expect(r.toReview).toEqual([])
  })
})
