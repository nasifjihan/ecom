/**
 * Batch 52 against a REAL Postgres: search that forgives spelling and knows the shop's same-meaning
 * words, size/colour filters that mean "in stock in that size", their counts, and menus three
 * levels deep with icons. Runs only when RUN_DB_TESTS=1.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import type { RequestContext } from "../../src/core"

const runDb = process.env.RUN_DB_TESTS === "1"

describe.skipIf(!runDb)("Batch 52 search, filters and menus (Postgres)", () => {
  let prisma: typeof import("../../src/config/prisma").prisma
  let Shop: typeof import("../../src/modules/storefront/storefront.service").StorefrontService
  let Content: typeof import("../../src/modules/content/content.service").ContentService
  let sfDto: typeof import("../../src/modules/storefront/storefront.dto")
  let cDto: typeof import("../../src/modules/content/content.dto")
  let words: typeof import("../../src/modules/search/shop-search")
  let storeId: bigint
  const suffix = Date.now().toString(36)
  const ctx = (): RequestContext => ({ storeId, requestId: "t", locale: "en", currency: "BDT" })
  const titles = async (q: Record<string, string>) =>
    ((await new Shop(ctx()).listProducts(sfDto.StorefrontProductsQueryDto.parse(q))) as unknown as { items: { title: string }[] }).items.map((i) => i.title).sort()

  beforeAll(async () => {
    ;({ prisma } = await import("../../src/config/prisma"))
    ;({ StorefrontService: Shop } = await import("../../src/modules/storefront/storefront.service"))
    ;({ ContentService: Content } = await import("../../src/modules/content/content.service"))
    sfDto = await import("../../src/modules/storefront/storefront.dto")
    cDto = await import("../../src/modules/content/content.dto")
    words = await import("../../src/modules/search/shop-search")
    storeId = (await prisma.store.create({ data: { name: "B52 Shop", slug: `b52-${suffix}` } })).id
    const size = await prisma.attribute.create({ data: { storeId, slug: "size", name: "Size", isFilterable: true } })
    await prisma.attributeTerm.createMany({ data: ["S", "M", "L"].map((name, sortOrder) => ({ attributeId: size.id, name, slug: name.toLowerCase(), sortOrder })) })
    const colour = await prisma.attribute.create({ data: { storeId, slug: "color", name: "Colour", type: "color", isFilterable: true } })
    await prisma.attributeTerm.create({ data: { attributeId: colour.id, name: "Red", slug: "red", value: "#dc2626" } })
    const product = (name: string, variants: { size: string; color?: string; stock: number }[]) =>
      prisma.product.create({
        data: {
          storeId,
          name,
          slug: `${name.toLowerCase().replace(/\s+/g, "-")}-${suffix}`,
          status: "published",
          regularPrice: 1000,
          type: "VARIABLE",
          variants: {
            create: variants.map((v, i) => ({
              attributeValues: { Size: v.size, ...(v.color ? { color: v.color } : {}) },
              sku: `${name}-${i}-${suffix}`,
              regularPrice: 1000,
              manageStock: true,
              stockQty: v.stock,
            })),
          },
        },
      })
    await product("Cotton Panjabi", [{ size: "M", color: "Red", stock: 3 }, { size: "L", stock: 0 }])
    await product("Silk Saree", [{ size: "S", stock: 2 }])
    await product("Denim Jeans", [{ size: "L", stock: 5 }])
  })

  afterAll(async () => {
    if (!prisma || !storeId) return // setup failed: an undefined id would match every row
    await prisma.product.deleteMany({ where: { storeId } })
    await prisma.store.delete({ where: { id: storeId } })
    await prisma.$disconnect()
  })

  it("finds close spellings, and the shop's same-meaning words", async () => {
    expect(await titles({ search: "panjbi" })).toEqual(["Cotton Panjabi"])
    expect(await titles({ search: "sari" })).toEqual([])
    await words.saveSearchWords(storeId, words.SearchWordsDto.parse({ groups: [["saree", "sari"]] }))
    expect(await titles({ search: "sari" })).toEqual(["Silk Saree"])
    expect((await words.listSearchWords(storeId)).groups).toEqual([["saree", "sari"]])
    // Best match first: the name containing the word beats a close spelling.
    const ranked = (await new Shop(ctx()).listProducts(sfDto.StorefrontProductsQueryDto.parse({ search: "jeans", sort: "relevance" }))) as unknown as {
      items: { title: string }[]
    }
    expect(ranked.items[0]?.title).toBe("Denim Jeans")
  })

  it("filters by size in stock, whatever the variant key's case", async () => {
    expect(await titles({ options: "size:L" })).toEqual(["Denim Jeans"]) // the panjabi's L is sold out
    expect(await titles({ options: "size:M|S" })).toEqual(["Cotton Panjabi", "Silk Saree"])
    expect(await titles({ options: "size:M;color:Red" })).toEqual(["Cotton Panjabi"])
    expect(await titles({ inStock: "true" })).toEqual(["Cotton Panjabi", "Denim Jeans", "Silk Saree"])
  })

  it("counts each value over sellable variants, colours with their codes", async () => {
    const facets = await new Shop(ctx()).productOptions(sfDto.StorefrontProductsQueryDto.parse({ options: "color:Red" }))
    const sizes = facets.find((f) => f.slug === "size")!
    const colours = facets.find((f) => f.slug === "color")!
    expect(sizes.values).toEqual([{ value: "M", count: 1 }]) // red only
    expect(colours.values).toEqual([{ value: "Red", count: 1, color: "#dc2626" }])
  })

  it("saves menus three levels deep with icons, and refuses unknown icons", async () => {
    const c = new Content(ctx())
    const menu = await c.createMenu({ name: "Main", location: "header" })
    const items = cDto.MenuItemsDto.parse({
      items: [
        {
          title: "Men",
          url: "/products?category=men",
          icon: "shirt",
          children: [{ title: "Panjabi", url: "/products?category=panjabi", children: [{ title: "Cotton", url: "/products?tag=cotton", icon: "/uploads/cotton.png" }] }],
        },
      ],
    })
    const saved = await c.setMenuItems(menu.id, items)
    expect(saved.items[0]).toMatchObject({ title: "Men", icon: "shirt", children: [{ title: "Panjabi", children: [{ title: "Cotton", icon: "/uploads/cotton.png" }] }] })
    expect(cDto.MenuItemsDto.safeParse({ items: [{ title: "X", url: "/", icon: "rocket-ship" }] }).success).toBe(false)
    const site = await c.site()
    expect(site.headerMenu?.[0]?.children?.[0]?.children?.[0]?.title).toBe("Cotton")
  })
})
