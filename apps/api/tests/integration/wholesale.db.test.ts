/**
 * Wholesale against a REAL Postgres: business accounts (apply, review), bulk prices in the cart,
 * checkout and staff orders, the storefront's tier view, and pricing by margin.
 * Runs only when RUN_DB_TESTS=1.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import type { RequestContext } from "../../src/core"

const runDb = process.env.RUN_DB_TESTS === "1"

describe.skipIf(!runDb)("wholesale (Postgres)", () => {
  let prisma: typeof import("../../src/config/prisma").prisma
  let Shop: typeof import("../../src/modules/storefront/storefront.service").StorefrontService
  let Wholesale: typeof import("../../src/modules/wholesale/wholesale.service").WholesaleService
  let Manual: typeof import("../../src/modules/orders/manual-order").ManualOrderService
  let ManualDto: typeof import("../../src/modules/orders/manual-order").ManualOrderQuoteDto
  let storeId: bigint
  let shirt: bigint
  let tee: bigint
  let teeM: bigint
  let teeL: bigint
  let buyer: bigint
  let shopper: bigint
  let admin: RequestContext
  const suffix = Date.now().toString(36)

  const as = (customerId?: bigint): RequestContext => ({
    storeId,
    requestId: "test",
    locale: "en",
    currency: "BDT",
    ...(customerId ? { customer: { id: customerId } } : {}),
  })
  const prices = async (customerId: bigint | undefined, items: { productId: bigint; variantId?: bigint; qty: number }[]) =>
    (await new Shop(as(customerId)).cartPrices(items)).items.map((i) => [i.price, i.bulk?.minQty ?? null])

  beforeAll(async () => {
    ;({ prisma } = await import("../../src/config/prisma"))
    ;({ StorefrontService: Shop } = await import("../../src/modules/storefront/storefront.service"))
    ;({ WholesaleService: Wholesale } = await import("../../src/modules/wholesale/wholesale.service"))
    ;({ ManualOrderService: Manual, ManualOrderQuoteDto: ManualDto } = await import("../../src/modules/orders/manual-order"))
    storeId = (await prisma.store.create({ data: { name: "Wholesale Test", slug: `wh-${suffix}` } })).id
    admin = { storeId, requestId: "test", locale: "en", currency: "BDT", admin: { id: 1n, role: "OWNER", permissions: ["*"] } }
    shirt = (
      await prisma.product.create({
        data: { storeId, name: "Shirt", slug: `shirt-${suffix}`, status: "published", regularPrice: 1000, costPrice: 600, manageStock: false },
      })
    ).id
    tee = (
      await prisma.product.create({
        data: {
          storeId,
          name: "Tee",
          slug: `tee-${suffix}`,
          status: "published",
          regularPrice: 500,
          costPrice: 250,
          manageStock: false,
          variants: {
            create: [
              { attributeValues: { size: "M" }, sku: `TM-${suffix}`, manageStock: false },
              { attributeValues: { size: "L" }, sku: `TL-${suffix}`, regularPrice: 550, costPrice: 300, manageStock: false },
            ],
          },
        },
        include: { variants: { orderBy: { id: "asc" } } },
      })
    ).id
    ;[teeM, teeL] = (await prisma.productVariant.findMany({ where: { productId: tee }, orderBy: { id: "asc" } })).map((v) => v.id) as [bigint, bigint]
    buyer = (await prisma.customer.create({ data: { storeId, email: `biz-${suffix}@x.test`, firstName: "Rahim", lastName: "Traders" } })).id
    shopper = (await prisma.customer.create({ data: { storeId, email: `shop-${suffix}@x.test`, firstName: "Sadia", lastName: "K" } })).id
  })

  afterAll(async () => {
    if (!prisma) return
    await prisma.product.deleteMany({ where: { storeId } })
    await prisma.customer.deleteMany({ where: { storeId } })
    await prisma.store.delete({ where: { id: storeId } })
    await prisma.$disconnect()
  })

  it("refuses applications until the shop sells to businesses", async () => {
    await expect(new Wholesale(as(buyer)).apply(buyer, { companyName: "Rahim Traders", businessType: "retailer" })).rejects.toThrow(
      /doesn't take business accounts/,
    )
    expect((await new Wholesale(as(buyer)).myStatus(buyer)).enabled).toBe(false)
  })

  it("takes an application, then staff approve it", async () => {
    await new Wholesale(admin).updateSettings({ enabled: true, intro: "Shops buying 10+ pieces" })
    const applied = await new Wholesale(as(buyer)).apply(buyer, {
      companyName: "Rahim Traders",
      businessType: "reseller",
      tradeLicenseNo: "TL-123",
      vatRegNo: null,
      contactPhone: null,
      address: null,
      note: null,
    })
    expect(applied.status).toBe("PENDING")
    await expect(new Wholesale(as(buyer)).apply(buyer, { companyName: "Again", businessType: "retailer" })).rejects.toThrow(/already have/)

    const list = await new Wholesale(admin).listAccounts({ status: "PENDING", page: 1, perPage: 25 })
    expect(list.rows.map((r) => r.companyName)).toEqual(["Rahim Traders"])
    const id = BigInt(list.rows[0]!.id)
    await expect(new Wholesale(admin).review(id, "suspend", "x")).rejects.toThrow(/Can't suspend/)
    await expect(new Wholesale(admin).review(id, "reject", null)).rejects.toThrow(/Tell the customer why/)
    expect((await new Wholesale(admin).review(id, "approve", null)).status).toBe("APPROVED")
    expect((await new Wholesale(admin).settings()).counts).toEqual({ APPROVED: 1 })
  })

  it("lets a rejected customer apply again, and can approve straight away", async () => {
    await new Wholesale(as(shopper)).apply(shopper, { companyName: "Sadia Boutique", businessType: "retailer" })
    const acc = await new Wholesale(admin).accountOfCustomer(shopper)
    await new Wholesale(admin).review(BigInt(acc!.id), "reject", "Please add your trade licence")
    const mine = await new Wholesale(as(shopper)).myStatus(shopper)
    expect(mine.account).toMatchObject({ status: "REJECTED", reviewNote: "Please add your trade licence" })

    await new Wholesale(admin).updateSettings({ autoApprove: true })
    expect((await new Wholesale(as(shopper)).apply(shopper, { companyName: "Sadia Boutique", businessType: "retailer", tradeLicenseNo: "TL-9" })).status).toBe(
      "APPROVED",
    )
    await new Wholesale(admin).removeAccount(BigInt(acc!.id))
    await new Wholesale(admin).updateSettings({ autoApprove: false })
  })

  it("checks bulk prices before saving them", async () => {
    await expect(
      new Wholesale(admin).saveProductTiers(shirt, {
        tiers: [
          { variantId: null, minQty: 10, price: 900, forEveryone: false },
          { variantId: null, minQty: 20, price: 950, forEveryone: false },
        ],
      }),
    ).rejects.toThrow(/20\+ costs more than 10\+/)
    await expect(new Wholesale(admin).saveProductTiers(shirt, { tiers: [{ variantId: teeM, minQty: 10, price: 900, forEveryone: false }] })).rejects.toThrow(
      /isn't part of this product/,
    )
    const saved = await new Wholesale(admin).saveProductTiers(shirt, {
      tiers: [
        { variantId: null, minQty: 5, price: 950, forEveryone: true },
        { variantId: null, minQty: 10, price: 850, forEveryone: false },
        { variantId: null, minQty: 50, price: 750, forEveryone: false },
      ],
    })
    expect(saved.tiers.map((t) => [t.minQty, t.price, t.forEveryone])).toEqual([
      [5, 950, true],
      [10, 850, false],
      [50, 750, false],
    ])
  })

  it("gives business prices to approved accounts and everyone-tiers to all", async () => {
    expect(await prices(undefined, [{ productId: shirt, qty: 4 }])).toEqual([[1000, null]])
    expect(await prices(undefined, [{ productId: shirt, qty: 12 }])).toEqual([[950, 5]])
    expect(await prices(shopper, [{ productId: shirt, qty: 60 }])).toEqual([[950, 5]])
    expect(await prices(buyer, [{ productId: shirt, qty: 12 }])).toEqual([[850, 10]])
    expect(await prices(buyer, [{ productId: shirt, qty: 60 }])).toEqual([[750, 50]])
  })

  it("counts every option for product-wide tiers; an option's own tiers stand alone", async () => {
    await new Wholesale(admin).saveProductTiers(tee, {
      tiers: [
        { variantId: null, minQty: 10, price: 400, forEveryone: false },
        { variantId: teeL, minQty: 6, price: 480, forEveryone: false },
      ],
    })
    const lines = [
      { productId: tee, variantId: teeM, qty: 5 },
      { productId: tee, variantId: teeL, qty: 5 },
    ]
    // M alone is 5 (L has its own tiers), so no tier; L reaches none of its own either.
    expect(await prices(buyer, lines)).toEqual([
      [500, null],
      [550, null],
    ])
    expect(await prices(buyer, [{ ...lines[0]!, qty: 10 }, { ...lines[1]!, qty: 6 }])).toEqual([
      [400, 10],
      [480, 6],
    ])
  })

  it("stops business prices when the account is suspended or wholesale is off", async () => {
    const acc = await new Wholesale(admin).accountOfCustomer(buyer)
    await new Wholesale(admin).review(BigInt(acc!.id), "suspend", "Unpaid invoices")
    expect(await prices(buyer, [{ productId: shirt, qty: 12 }])).toEqual([[950, 5]])
    await expect(new Wholesale(as(buyer)).apply(buyer, { companyName: "X", businessType: "retailer" })).rejects.toThrow(/suspended/)
    await new Wholesale(admin).review(BigInt(acc!.id), "approve", null)
    await new Wholesale(admin).updateSettings({ enabled: false })
    expect(await prices(buyer, [{ productId: shirt, qty: 12 }])).toEqual([[950, 5]])
    await new Wholesale(admin).updateSettings({ enabled: true })
  })

  it("prices a staff order for a business customer at business prices", async () => {
    const dto = ManualDto.parse({ customer: { id: buyer }, items: [{ productId: shirt, qty: 10 }], delivery: { type: "pickup" } })
    const q = await new Manual(admin).quote(dto)
    expect(q.lines[0]!.unitPrice).toBe(850)
    expect(q.totals.itemsSubtotal).toBe(8500)
    const walkIn = ManualDto.parse({ customer: { phone: "01711000000" }, items: [{ productId: shirt, qty: 10 }], delivery: { type: "pickup" } })
    expect((await new Manual(admin).quote(walkIn)).lines[0]!.unitPrice).toBe(950)
  })

  it("shows each shopper the bulk prices they get", async () => {
    const guest = await new Wholesale(as()).storefrontTiers(shirt, false)
    expect(guest).toMatchObject({ business: false, hasBusinessPrices: true })
    expect(guest.tiers[0]!.tiers).toEqual([{ minQty: 5, price: 950, business: false }])
    const biz = await new Wholesale(as(buyer)).storefrontTiers(shirt, true)
    expect(biz.tiers[0]!.tiers.map((t) => t.minQty)).toEqual([5, 10, 50])
  })

  it("lists cost, price and margin, and saves new prices", async () => {
    const m = await new Wholesale(admin).margins({ cost: "all", page: 1, perPage: 50 })
    expect(m.rows.map((r) => [r.name, r.option, r.cost, r.price, r.margin])).toEqual([
      ["Shirt", null, 600, 1000, 40],
      ["Tee", "M", 250, 500, 50],
      ["Tee", "L", 300, 550, 45.5],
    ])
    expect(m.summary).toMatchObject({ rows: 3, missingCost: 0, belowCost: 0 })
    await expect(new Wholesale(admin).applyPrices({ rows: [{ productId: tee, regularPrice: 600 }] })).rejects.toThrow(/Pick an option/)
    await new Wholesale(admin).applyPrices({
      rows: [
        { productId: shirt, regularPrice: 1009 },
        { productId: tee, variantId: teeM, regularPrice: 499 },
      ],
    })
    const after = await new Wholesale(admin).margins({ search: "Tee", cost: "all", page: 1, perPage: 50 })
    expect(after.rows.map((r) => r.price)).toEqual([499, 550])
    expect(Number((await prisma.product.findUnique({ where: { id: shirt } }))!.regularPrice)).toBe(1009)
  })
})
