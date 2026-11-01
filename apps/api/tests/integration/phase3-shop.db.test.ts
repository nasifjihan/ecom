/**
 * Batch 53 against a REAL Postgres: the theme's look and light/dark saved per storefront, a
 * product's video link, and photos in reviews (only the author's own uploads, shown on the
 * product page, one removable by staff). Runs only when RUN_DB_TESTS=1.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import type { RequestContext } from "../../src/core"

const runDb = process.env.RUN_DB_TESTS === "1"

describe.skipIf(!runDb)("Batch 53 themes, video and review photos (Postgres)", () => {
  let prisma: typeof import("../../src/config/prisma").prisma
  let Catalog: typeof import("../../src/modules/catalog/catalog.service").CatalogService
  let Shop: typeof import("../../src/modules/storefront/storefront.service").StorefrontService
  let Engagement: typeof import("../../src/modules/storefront/engagement").StorefrontEngagement
  let Marketing: typeof import("../../src/modules/marketing/marketing.service").MarketingService
  let Content: typeof import("../../src/modules/content/content.service").ContentService
  let dto: typeof import("../../src/modules/catalog/catalog.dto")
  let cDto: typeof import("../../src/modules/content/content.dto")
  let storeId: bigint
  let owner: RequestContext
  let customerId: bigint
  const suffix = Date.now().toString(36)

  beforeAll(async () => {
    ;({ prisma } = await import("../../src/config/prisma"))
    ;({ CatalogService: Catalog } = await import("../../src/modules/catalog/catalog.service"))
    ;({ StorefrontService: Shop } = await import("../../src/modules/storefront/storefront.service"))
    ;({ StorefrontEngagement: Engagement } = await import("../../src/modules/storefront/engagement"))
    ;({ MarketingService: Marketing } = await import("../../src/modules/marketing/marketing.service"))
    ;({ ContentService: Content } = await import("../../src/modules/content/content.service"))
    dto = await import("../../src/modules/catalog/catalog.dto")
    cDto = await import("../../src/modules/content/content.dto")
    storeId = (await prisma.store.create({ data: { name: "B53 Shop", slug: `b53-${suffix}` } })).id
    const role = await prisma.role.create({ data: { storeId, name: "Manager", slug: `mgr-${suffix}` } })
    const staffId = (await prisma.adminUser.create({ data: { storeId, email: `m-${suffix}@x.test`, name: "Mitu", passwordHash: "x", roleId: role.id } })).id
    owner = { storeId, requestId: "test", locale: "en", currency: "BDT", admin: { id: staffId, role: "ADMIN", permissions: ["*"] } }
    customerId = (await prisma.customer.create({ data: { storeId, email: `c-${suffix}@x.test`, firstName: "Rina", lastName: "Akter" } })).id
  })

  afterAll(async () => {
    if (!prisma || !storeId) return // setup failed: an undefined id would match every row
    await prisma.review.deleteMany({ where: { storeId } })
    await prisma.customer.deleteMany({ where: { storeId } })
    await prisma.product.deleteMany({ where: { storeId } })
    await prisma.adminUser.deleteMany({ where: { storeId } })
    await prisma.store.delete({ where: { id: storeId } })
    await prisma.$disconnect()
  })

  it("saves a theme with light/dark and gives it to the shop", async () => {
    const c = new Content(owner)
    const theme = await c.getTheme()
    await c.saveTheme(cDto.ThemeDto.parse({ ...theme, appearance: { preset: "royal", mode: "auto", shopperSwitch: true } }))
    const site = await new Content({ storeId, requestId: "t", locale: "en", currency: "BDT" }).site()
    expect(site.theme.appearance).toEqual({ preset: "royal", mode: "auto", shopperSwitch: true })
  })

  it("keeps a product's video link, refuses other links, and copies it with the product", async () => {
    expect(() => dto.CreateProductDto.parse({ name: "X", regularPrice: 1, manageStock: false, videoUrl: "https://example.com/clip" })).toThrow()
    const p = (await new Catalog(owner).createProduct(
      dto.CreateProductDto.parse({ name: "Silk Saree", slug: `saree-${suffix}`, regularPrice: 5000, manageStock: false, videoUrl: "https://youtu.be/dQw4w9WgXcQ" }),
    )) as { id: bigint; videoUrl: string | null }
    expect(p.videoUrl).toBe("https://youtu.be/dQw4w9WgXcQ")
    const page = await new Shop({ storeId, requestId: "t", locale: "en", currency: "BDT" }).getProductBySlug(`saree-${suffix}`)
    expect(page.videoUrl).toBe("https://youtu.be/dQw4w9WgXcQ")
    const copy = (await new Catalog(owner).duplicateProduct(p.id)) as { videoUrl: string | null }
    expect(copy.videoUrl).toBe("https://youtu.be/dQw4w9WgXcQ")
    await new Catalog(owner).updateProduct(p.id, dto.UpdateProductDto.parse({ videoUrl: "" }))
    expect((await prisma.product.findUniqueOrThrow({ where: { id: p.id } })).videoUrl).toBeNull()
  })

  it("puts the author's own photos on a review, shows them, and lets staff remove one", async () => {
    const product = await prisma.product.create({ data: { storeId, name: "Kurta", slug: `kurta-${suffix}`, status: "published", regularPrice: 900 } })
    const shopper = new Engagement({ storeId, requestId: "t", locale: "en", currency: "BDT", customer: { id: customerId } } as RequestContext)
    const own = (n: number) => `${storeId}/media/reviews/${customerId}/179350000000${n}-a1b2c3d4e5f6.webp`
    await expect(shopper.submitReview(product.id, { rating: 5, photos: [`${storeId}/media/reviews/999/1793500000000-a1b2c3d4e5f6.webp`] })).rejects.toThrow()
    const r = await shopper.submitReview(product.id, { rating: 5, body: "Lovely", photos: [own(1), own(2)] })
    const saved = await prisma.review.findUniqueOrThrow({ where: { id: BigInt(r.id) } })
    expect(saved.photos).toHaveLength(2)
    await prisma.review.update({ where: { id: saved.id }, data: { status: "approved" } })
    const page = await new Shop({ storeId, requestId: "t", locale: "en", currency: "BDT" }).getProductBySlug(`kurta-${suffix}`)
    expect(page.reviews[0]?.photos).toEqual(saved.photos.map((url) => ({ url, thumb: url.replace(/\.webp$/, "-thumb.webp") })))
    const after = await new Marketing(owner).removeReviewPhoto(saved.id, saved.photos[0]!)
    expect(after.photos).toEqual([saved.photos[1]])
  })
})
