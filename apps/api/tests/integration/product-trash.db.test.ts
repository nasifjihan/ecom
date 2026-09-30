/**
 * Product statuses and the Trash against a REAL Postgres: statuses saved lowercase whatever the
 * admin sends, deleting to the Trash (hidden from the list and the storefront), restoring to the
 * old status, and deleting for good only when nothing depends on the product.
 * Runs only when RUN_DB_TESTS=1.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import type { RequestContext } from "../../src/core"

const runDb = process.env.RUN_DB_TESTS === "1"

describe.skipIf(!runDb)("product Trash (Postgres)", () => {
  let prisma: typeof import("../../src/config/prisma").prisma
  let Catalog: typeof import("../../src/modules/catalog/catalog.service").CatalogService
  let Shop: typeof import("../../src/modules/storefront/storefront.service").StorefrontService
  let dto: typeof import("../../src/modules/catalog/catalog.dto")
  let storeId: bigint
  let owner: RequestContext
  let staffId: bigint
  const suffix = Date.now().toString(36)

  beforeAll(async () => {
    ;({ prisma } = await import("../../src/config/prisma"))
    ;({ CatalogService: Catalog } = await import("../../src/modules/catalog/catalog.service"))
    ;({ StorefrontService: Shop } = await import("../../src/modules/storefront/storefront.service"))
    dto = await import("../../src/modules/catalog/catalog.dto")
    storeId = (await prisma.store.create({ data: { name: "Trash Test", slug: `tr-${suffix}` } })).id
    const role = await prisma.role.create({ data: { storeId, name: "Manager", slug: `mgr-${suffix}` } })
    staffId = (await prisma.adminUser.create({ data: { storeId, email: `m-${suffix}@x.test`, name: "Mitu", passwordHash: "x", roleId: role.id } })).id
    owner = { storeId, requestId: "test", locale: "en", currency: "BDT", admin: { id: staffId, role: "ADMIN", permissions: ["*"] } }
  })

  afterAll(async () => {
    if (!prisma) return
    await prisma.landingPage.deleteMany({ where: { storeId } })
    await prisma.product.deleteMany({ where: { storeId } })
    await prisma.adminUser.deleteMany({ where: { storeId } })
    await prisma.store.delete({ where: { id: storeId } })
    await prisma.$disconnect()
  })

  const byName = (name: string) => prisma.product.findFirstOrThrow({ where: { storeId, name } })
  const make = async (name: string, status: string) =>
    new Catalog(owner).createProduct(
      dto.CreateProductDto.parse({ name, slug: `${name.toLowerCase()}-${suffix}`, status, regularPrice: 500, manageStock: false }),
    ) as Promise<{ id: bigint; status: string }>

  it("saves statuses lowercase, whatever the admin sends", async () => {
    const a = await make("Kurta", "PUBLISHED")
    const b = await make("Scarf", "Active")
    const c = await make("Belt", "DRAFT")
    expect([a.status, b.status, c.status]).toEqual(["published", "published", "draft"])
    expect(() => dto.CreateProductDto.parse({ name: "X", status: "SOLD_OUT", regularPrice: 1 })).toThrow()
    await new Catalog(owner).updateProduct(c.id, dto.UpdateProductDto.parse({ status: "PUBLISHED" }))
    expect((await prisma.product.findUnique({ where: { id: c.id } }))!.status).toBe("published")
    // The storefront sells it: before the fix it was saved "PUBLISHED" and never shown.
    expect(await new Shop({ storeId, requestId: "t", locale: "en", currency: "BDT" }).getProductBySlug(`belt-${suffix}`)).toBeTruthy()
    const drafts = await new Catalog(owner).listProducts(dto.ProductSearchQueryDto.parse({ status: "DRAFT" }))
    expect(drafts.data).toEqual([])
  })

  it("remembers who made and changed a product", async () => {
    const [p] = await prisma.product.findMany({ where: { storeId, name: "Belt" } })
    const full = (await new Catalog(owner).getProductById(p!.id)) as { audit: { createdBy: string; updatedBy: string; deletedBy: string | null } }
    expect(full.audit).toEqual({ createdBy: "Mitu", updatedBy: "Mitu", deletedBy: null })
  })

  it("moves products to the Trash and back to their old status", async () => {
    const kurta = await byName("Kurta")
    const belt = await byName("Belt")
    await prisma.product.update({ where: { id: belt.id }, data: { status: "draft" } })
    expect(await new Catalog(owner).trashProducts([kurta.id, belt.id])).toEqual({ count: 2 })
    const list = await new Catalog(owner).listProducts(dto.ProductSearchQueryDto.parse({}))
    expect((list.data as { name: string }[]).map((p) => p.name)).toEqual(["Scarf"])
    const trash = await new Catalog(owner).listProducts(dto.ProductSearchQueryDto.parse({ status: "deleted" }))
    expect((trash.data as { name: string }[]).map((p) => p.name).sort()).toEqual(["Belt", "Kurta"])
    await expect(new Shop({ storeId, requestId: "t", locale: "en", currency: "BDT" }).getProductBySlug(`kurta-${suffix}`)).rejects.toThrow(/not found/i)
    await expect(new Catalog(owner).updateProduct(kurta.id, dto.UpdateProductDto.parse({ name: "Kurta 2" }))).rejects.toThrow(/in the Trash/)
    const inTrash = (await new Catalog(owner).getProductById(kurta.id)) as { audit: { deletedBy: string } }
    expect(inTrash.audit.deletedBy).toBe("Mitu")

    expect(await new Catalog(owner).restoreProducts([kurta.id, belt.id])).toEqual({ count: 2 })
    const back = await prisma.product.findMany({ where: { storeId, id: { in: [kurta.id, belt.id] } }, orderBy: { name: "asc" } })
    expect(back.map((p) => [p.name, p.status, p.deletedAt])).toEqual([
      ["Belt", "draft", null],
      ["Kurta", "published", null],
    ])
  })

  it("deletes for good only what nothing depends on", async () => {
    const kurta = await byName("Kurta")
    const scarf = await byName("Scarf")
    await prisma.landingPage.create({ data: { storeId, slug: `lp-${suffix}`, title: "Kurta ad", productId: kurta.id, headline: "Kurta" } })
    // Only products in the Trash can go.
    expect(await new Catalog(owner).purgeProducts([scarf.id])).toEqual({ deleted: 0, kept: [] })
    await new Catalog(owner).trashProducts([kurta.id, scarf.id])
    const r = await new Catalog(owner).purgeProducts([kurta.id, scarf.id])
    expect(r).toEqual({ deleted: 1, kept: [{ id: String(kurta.id), name: "Kurta", reason: "A landing page sells it" }] })
    expect(await prisma.product.findUnique({ where: { id: scarf.id } })).toBeNull()
  })
})
