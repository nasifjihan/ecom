/**
 * Redirects against a REAL Postgres: adding and checking them, pasted lists, chains followed to
 * the end, automatic 301s when a product's or page's address changes, hit counts and the
 * broken-link log. Runs only when RUN_DB_TESTS=1.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import type { RequestContext } from "../../src/core"

const runDb = process.env.RUN_DB_TESTS === "1"

describe.skipIf(!runDb)("redirects (Postgres)", () => {
  let prisma: typeof import("../../src/config/prisma").prisma
  let Redirects: typeof import("../../src/modules/redirects/redirects.service").RedirectsService
  let Catalog: typeof import("../../src/modules/catalog/catalog.service").CatalogService
  let Content: typeof import("../../src/modules/content/content.service").ContentService
  let PageDto: typeof import("../../src/modules/content/content.dto").CreatePageDto
  let storeId: bigint
  let ctx: RequestContext
  const suffix = Date.now().toString(36)
  const list = async () => (await new Redirects(ctx).resolved()).map((r) => [r.from, r.to, r.code])

  beforeAll(async () => {
    ;({ prisma } = await import("../../src/config/prisma"))
    ;({ RedirectsService: Redirects } = await import("../../src/modules/redirects/redirects.service"))
    ;({ CatalogService: Catalog } = await import("../../src/modules/catalog/catalog.service"))
    ;({ ContentService: Content } = await import("../../src/modules/content/content.service"))
    ;({ CreatePageDto: PageDto } = await import("../../src/modules/content/content.dto"))
    storeId = (await prisma.store.create({ data: { name: "Redirects Test", slug: `rd-${suffix}` } })).id
    ctx = { storeId, requestId: "test", locale: "en", currency: "BDT", admin: { id: 1n, role: "OWNER", permissions: ["*"] } }
  })

  afterAll(async () => {
    if (!prisma) return
    await prisma.product.deleteMany({ where: { storeId } })
    await prisma.store.delete({ where: { id: storeId } })
    await prisma.$disconnect()
  })

  it("adds redirects in one form and refuses bad ones", async () => {
    const r = await new Redirects(ctx).create({ fromPath: "/Eid-Sale/", toUrl: "/collections/eid", statusCode: 302 })
    expect(r).toMatchObject({ fromPath: "/eid-sale", toUrl: "/collections/eid", statusCode: 302, auto: false })
    await expect(new Redirects(ctx).create({ fromPath: "/eid-sale?x=1", toUrl: "/y" })).rejects.toThrow(/already has a redirect/)
    await expect(new Redirects(ctx).create({ fromPath: "/", toUrl: "/y" })).rejects.toThrow(/can't be redirected/)
    await expect(new Redirects(ctx).create({ fromPath: "/collections/eid", toUrl: "/eid-sale" })).rejects.toThrow(/circle/)
  })

  it("adds pasted lines, updating old addresses already there", async () => {
    const r = await new Redirects(ctx).import("old,new\n/old-shirt,/products/shirt\n/eid-sale,/collections/eid-2026\n/a,/b\n/b,/a\n/,/x")
    expect(r.added).toBe(2)
    expect(r.updated).toBe(1)
    expect(r.errors).toEqual([
      { line: 5, message: "Would send visitors round in a circle" },
      { line: 6, message: "/ can't be redirected" },
    ])
    expect(await list()).toEqual(
      expect.arrayContaining([
        ["/eid-sale", "/collections/eid-2026", 301],
        ["/a", "/b", 301],
      ]),
    )
  })

  it("adds a 301 when a product's address changes, and keeps chains to one hop", async () => {
    const p = await prisma.product.create({ data: { storeId, name: "Denim", slug: `denim-${suffix}`, status: "published", regularPrice: 1000 } })
    await new Catalog(ctx).updateProduct(p.id, { slug: `denim-blue-${suffix}` })
    await new Catalog(ctx).updateProduct(p.id, { slug: `indigo-denim-${suffix}` })
    const rows = await prisma.redirect.findMany({ where: { storeId, auto: true }, orderBy: { id: "asc" } })
    expect(rows.map((r) => [r.fromPath, r.toUrl])).toEqual([
      [`/products/denim-${suffix}`, `/products/indigo-denim-${suffix}`],
      [`/products/denim-blue-${suffix}`, `/products/indigo-denim-${suffix}`],
    ])
    // Back to the first address: it must work again, so its redirect goes.
    await new Catalog(ctx).updateProduct(p.id, { slug: `denim-${suffix}` })
    const after = await prisma.redirect.findMany({ where: { storeId, auto: true }, orderBy: { fromPath: "asc" } })
    expect(after.map((r) => [r.fromPath, r.toUrl])).toEqual([
      [`/products/denim-blue-${suffix}`, `/products/denim-${suffix}`],
      [`/products/indigo-denim-${suffix}`, `/products/denim-${suffix}`],
    ])
  })

  it("adds a 301 when a page's address changes", async () => {
    const page = await new Content(ctx).createPage(PageDto.parse({ title: "Returns", slug: `returns-${suffix}`, content: "x" }))
    await new Content(ctx).updatePage(page.id, { slug: `return-policy-${suffix}` })
    expect(await prisma.redirect.findFirst({ where: { storeId, fromPath: `/returns-${suffix}` } })).toMatchObject({ toUrl: `/return-policy-${suffix}`, statusCode: 301, auto: true })
  })

  it("counts hits and logs addresses that weren't found", async () => {
    await new Redirects(ctx).hit("/Old-Shirt/")
    await new Redirects(ctx).hit("/old-shirt")
    expect((await prisma.redirect.findFirst({ where: { storeId, fromPath: "/old-shirt" } }))!.hits).toBe(2)

    const r = new Redirects(ctx)
    await r.notFound("/summer-2024", "https://facebook.com/post/1")
    await r.notFound("/Summer-2024/", null)
    await r.notFound("/logo.png", null)
    await r.notFound("/old-shirt", null)
    await r.notFound("/api/x", null)
    const broken = await r.brokenLinks({ page: 1, perPage: 50 })
    expect(broken.rows.map((b) => [b.path, b.hits, b.referrer])).toEqual([["/summer-2024", 2, "https://facebook.com/post/1"]])

    // Fixing it with a redirect clears it from the log.
    await r.create({ fromPath: "/summer-2024", toUrl: "/collections/summer" })
    expect((await r.brokenLinks({ page: 1, perPage: 50 })).total).toBe(0)
  })
})
