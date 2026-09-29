/**
 * Several storefronts in one store against a REAL Postgres: product range, prices, the look, the
 * home page, menus and the admin rules. Runs only when RUN_DB_TESTS=1.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import type { RequestContext } from "../../src/core"

const runDb = process.env.RUN_DB_TESTS === "1"

describe.skipIf(!runDb)("storefronts (Postgres)", () => {
  let prisma: typeof import("../../src/config/prisma").prisma
  let sfCtx: typeof import("../../src/modules/storefronts/storefronts.context")
  let Shop: typeof import("../../src/modules/storefront/storefront.service").StorefrontService
  let Content: typeof import("../../src/modules/content/content.service").ContentService
  let Admin: typeof import("../../src/modules/storefronts/storefronts.service").StorefrontsService
  let storeId: bigint
  let mainId: bigint
  let kidsId: bigint
  let admin: RequestContext
  const ids: Record<string, bigint> = {}
  const suffix = Date.now().toString(36)

  const at = (storefrontId: bigint): RequestContext => ({ storeId, storefrontId, requestId: "test", locale: "en", currency: "BDT" })
  const list = async (storefrontId: bigint, q: Record<string, unknown> = {}) =>
    (await new Shop(at(storefrontId)).listProducts({ page: 1, perPage: 20, sort: "newest", ...q } as never)).items.map(
      (p): [string, number, number | null] => [String(p.title), p.price, p.compareAtPrice],
    )

  beforeAll(async () => {
    ;({ prisma } = await import("../../src/config/prisma"))
    sfCtx = await import("../../src/modules/storefronts/storefronts.context")
    ;({ StorefrontService: Shop } = await import("../../src/modules/storefront/storefront.service"))
    ;({ ContentService: Content } = await import("../../src/modules/content/content.service"))
    ;({ StorefrontsService: Admin } = await import("../../src/modules/storefronts/storefronts.service"))
    storeId = (await prisma.store.create({ data: { name: "Two Fronts", slug: `fronts-${suffix}` } })).id
    admin = { storeId, requestId: "test", locale: "en", currency: "BDT" }
    for (const [name, price, sale] of [
      ["Shirt", 1000, null],
      ["Bag", 2000, 1500],
      ["Cap", 300, null],
    ] as const) {
      const p = await prisma.product.create({
        data: {
          storeId,
          name,
          slug: `${name.toLowerCase()}-${suffix}`,
          status: "published",
          regularPrice: price,
          salePrice: sale,
          manageStock: false,
        },
      })
      ids[name] = p.id
    }
  })

  afterAll(async () => {
    if (!prisma) return
    await prisma.order.deleteMany({ where: { storeId } })
    await prisma.domain.deleteMany({ where: { storeId } })
    await prisma.product.deleteMany({ where: { storeId } })
    await prisma.store.delete({ where: { id: storeId } })
    await prisma.$disconnect()
  })

  it("gives every store a default storefront on first use", async () => {
    mainId = await sfCtx.defaultStorefrontId(storeId)
    const rows = await prisma.storefront.findMany({ where: { storeId } })
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ code: "MAIN", isDefault: true, name: "Two Fronts" })
    expect(await sfCtx.resolveStorefrontId(storeId, null)).toBe(mainId)
  })

  it("adds a storefront with a code made from its name, and refuses a taken code", async () => {
    const created = await new Admin(admin).create({ name: "Kids shop", priceAdjustPercent: 10 })
    kidsId = BigInt(created.id)
    expect((await prisma.storefront.findUniqueOrThrow({ where: { id: kidsId } })).code).toBe("KIDS-SHOP")
    await expect(new Admin(admin).create({ name: "Other", code: "kids shop" })).rejects.toThrow(/already uses the code KIDS-SHOP/)
  })

  it("prices with the storefront's adjustment and the product's own price there", async () => {
    await new Admin(admin).saveProductStorefronts(ids.Cap!, {
      storefronts: [{ storefrontId: kidsId, listed: true, regularPrice: 250, salePrice: null }],
    })
    expect(await list(mainId)).toEqual([
      ["Cap", 300, null],
      ["Bag", 1500, 2000],
      ["Shirt", 1000, null],
    ])
    expect(await list(kidsId)).toEqual([
      ["Cap", 250, null],
      ["Bag", 1650, 2200],
      ["Shirt", 1100, null],
    ])
  })

  it("leaves a product out where it isn't sold, including its page and the cart", async () => {
    await new Admin(admin).saveProductStorefronts(ids.Shirt!, { storefronts: [{ storefrontId: kidsId, listed: false }] })
    expect((await list(kidsId)).map((r) => r[0])).toEqual(["Cap", "Bag"])
    expect((await list(mainId)).map((r) => r[0])).toEqual(["Cap", "Bag", "Shirt"])
    await expect(new Shop(at(kidsId)).getProductBySlug(`shirt-${suffix}`)).rejects.toThrow(/not found/i)
    const [line] = await new Shop(at(kidsId)).quoteLines([{ productId: ids.Shirt!, qty: 1 }])
    expect(line!.problem?.message).toMatch(/no longer available/)
    // Staff taking an order can still sell it.
    const [staff] = await new Shop({ ...at(kidsId), admin: { id: 1n, role: "owner", permissions: [] } }).quoteLines([
      { productId: ids.Shirt!, qty: 1 },
    ])
    expect(staff!.priced?.unitPrice).toBe(1100)
  })

  it("filters and sorts on the storefront's own prices", async () => {
    expect(await list(kidsId, { minPrice: 1600 })).toEqual([["Bag", 1650, 2200]])
    expect(await list(mainId, { minPrice: 1600 })).toEqual([])
    expect((await list(kidsId, { sort: "price_asc" })).map((r) => r[1])).toEqual([250, 1650])
  })

  it("a storefront that doesn't take new products only sells what was added", async () => {
    await new Admin(admin).update(kidsId, { includeNewProducts: false })
    sfCtx.forgetStorefronts(storeId)
    // Cap has its own row (listed), the rest have none or are hidden.
    expect((await list(kidsId)).map((r) => r[0])).toEqual(["Cap"])
    await new Admin(admin).setProducts(kidsId, [ids.Bag!], true)
    expect((await list(kidsId)).map((r) => r[0])).toEqual(["Cap", "Bag"])
    await new Admin(admin).update(kidsId, { includeNewProducts: true })
    sfCtx.forgetStorefronts(storeId)
  })

  it("drops rows that say nothing new", async () => {
    await new Admin(admin).saveProductStorefronts(ids.Bag!, { storefronts: [{ storefrontId: kidsId, listed: true }] })
    expect(await prisma.productStorefront.count({ where: { productId: ids.Bag! } })).toBe(0)
    await expect(
      new Admin(admin).saveProductStorefronts(ids.Bag!, {
        storefronts: [{ storefrontId: kidsId, listed: true, regularPrice: 100, salePrice: 150 }],
      }),
    ).rejects.toThrow(/sale price needs a regular price above it/)
  })

  it("uses the main look until a storefront saves its own, then goes back on reset", async () => {
    const main = new Content(admin)
    const saved = await main.getTheme()
    await main.saveTheme({ ...saved, brand: { ...saved.brand, storeName: "Main Shop" } })
    expect((await new Content(at(kidsId)).getTheme()).brand.storeName).toBe("Main Shop")
    await main.saveTheme({ ...saved, brand: { ...saved.brand, storeName: "Kids Shop" } }, kidsId)
    expect((await new Content(at(kidsId)).getTheme()).brand.storeName).toBe("Kids Shop")
    expect((await new Content(at(mainId)).getTheme()).brand.storeName).toBe("Main Shop")
    await main.resetTheme(kidsId)
    expect((await new Content(at(kidsId)).getTheme()).brand.storeName).toBe("Main Shop")
    await expect(main.resetTheme(mainId)).rejects.toThrow(/main look/)
  })

  it("shows the main home page until a storefront has its own", async () => {
    const main = new Content(admin)
    const sections = (await main.getHomepage()).sections
    await main.saveHomepage([sections[0]!, sections[1]!])
    expect(await new Content(at(kidsId)).getHomepage()).toMatchObject({ inherited: true, customised: false })
    expect((await new Content(at(kidsId)).publicHomepage()).length).toBe(2)
    await main.saveHomepage([sections[0]!], kidsId)
    expect(await new Content(at(kidsId)).getHomepage()).toMatchObject({ inherited: false, customised: true })
    expect((await new Content(at(kidsId)).publicHomepage()).length).toBe(1)
    expect((await new Content(at(mainId)).publicHomepage()).length).toBe(2)
    await main.resetHomepage(kidsId)
    expect((await new Content(at(kidsId)).publicHomepage()).length).toBe(2)
  })

  it("uses a storefront's own menu for a place, else the main one", async () => {
    const c = new Content(admin)
    const mainHeader = await c.createMenu({ name: "Main header", location: "header" })
    await c.setMenuItems(mainHeader.id, { items: [{ title: "All", url: "/products", openInNewTab: false, children: [] }] })
    const footer = await c.createMenu({ name: "Help", location: "footer" })
    await c.setMenuItems(footer.id, { items: [{ title: "FAQ", url: "/faq", openInNewTab: false, children: [] }] })
    expect((await new Content(at(kidsId)).site()).headerMenu?.[0]?.title).toBe("All")

    const kidsHeader = await c.createMenu({ name: "Kids header", location: "header", storefrontId: kidsId })
    await c.setMenuItems(kidsHeader.id, { items: [{ title: "Toys", url: "/products?tag=toys", openInNewTab: false, children: [] }] })
    const kids = await new Content(at(kidsId)).site()
    expect(kids.headerMenu?.[0]?.title).toBe("Toys")
    expect(kids.footerMenus.map((m) => m.title)).toEqual(["Help"]) // no own footer: the main one
    expect((await new Content(at(mainId)).site()).headerMenu?.[0]?.title).toBe("All")
    // One header menu per storefront.
    await expect(c.createMenu({ name: "Second", location: "header", storefrontId: kidsId })).rejects.toThrow(/already this storefront's header/)
    expect((await c.listMenus(kidsId)).map((m) => m.name)).toEqual(["Kids header"])
  })

  it("opens a web address's storefront, and the default when it's closed or unlinked", async () => {
    const svc = new Admin(admin)
    await svc.addDomain(kidsId, `https://www.kids-${suffix}.example.com/`)
    const d = await prisma.domain.findUniqueOrThrow({ where: { hostname: `kids-${suffix}.example.com` } })
    expect(d.storefrontId).toBe(kidsId)
    await expect(svc.addDomain(kidsId, `kids-${suffix}.example.com`)).rejects.toThrow(/already yours/)
    await expect(svc.addDomain(kidsId, "no spaces allowed")).rejects.toThrow(/doesn't look like a web address/)
    expect(await sfCtx.resolveStorefrontId(storeId, kidsId)).toBe(kidsId)
    await svc.update(kidsId, { isActive: false })
    expect(await sfCtx.resolveStorefrontId(storeId, kidsId)).toBe(mainId)
    await svc.update(kidsId, { isActive: true })
    await svc.moveDomain(d.id, null)
    expect((await prisma.domain.findUniqueOrThrow({ where: { id: d.id } })).storefrontId).toBeNull()
  })

  it("keeps one default storefront, which can't be closed or deleted", async () => {
    const svc = new Admin(admin)
    await expect(svc.update(mainId, { isActive: false })).rejects.toThrow(/can't be closed/)
    await expect(svc.remove(mainId)).rejects.toThrow(/can't be deleted/)
    await svc.makeDefault(kidsId)
    const defaults = await prisma.storefront.findMany({ where: { storeId, isDefault: true } })
    expect(defaults.map((s) => s.id)).toEqual([kidsId])
    expect(await sfCtx.defaultStorefrontId(storeId)).toBe(kidsId)
    await svc.makeDefault(mainId)
  })

  it("won't delete a storefront that has orders", async () => {
    const svc = new Admin(admin)
    await prisma.order.create({
      data: {
        storeId,
        storefrontId: kidsId,
        number: `SF${suffix}`,
        orderKey: `ok_sf_${suffix}`,
        billingFirstName: "A",
        billingLastName: "B",
        billingAddress1: "House 1",
        billingCity: "Dhaka",
        billingCountryCode: "BD",
        grandTotal: 100,
        currencyCode: "BDT",
        paymentGatewayCode: "cod",
        shippingMethodCode: "std",
        shippingMethodName: "Standard",
      },
    })
    await expect(svc.remove(kidsId)).rejects.toThrow(/1 order\(s\) were placed/)
    const listed = await svc.list()
    expect(listed.find((s) => s.id === String(kidsId))).toMatchObject({ orders: 1, ownPrices: 1, hiddenProducts: 1 })
  })
})
