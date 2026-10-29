/**
 * Batch 51 against a REAL Postgres: related products picked in the admin (saved, in order, this
 * store's only, shown first on the product page), duplicating a product as a draft, the on-sale
 * filter and discount sort, and a shopper deleting their own account.
 * Runs only when RUN_DB_TESTS=1.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import type { RequestContext } from "../../src/core"

const runDb = process.env.RUN_DB_TESTS === "1"

describe.skipIf(!runDb)("Batch 51 shop features (Postgres)", () => {
  let prisma: typeof import("../../src/config/prisma").prisma
  let Catalog: typeof import("../../src/modules/catalog/catalog.service").CatalogService
  let Shop: typeof import("../../src/modules/storefront/storefront.service").StorefrontService
  let dto: typeof import("../../src/modules/catalog/catalog.dto")
  let sfDto: typeof import("../../src/modules/storefront/storefront.dto")
  let accounts: typeof import("../../src/modules/customers/account-deletion")
  let storeId: bigint
  let otherStoreId: bigint
  let owner: RequestContext
  const suffix = Date.now().toString(36)
  const shop = () => new Shop({ storeId, requestId: "t", locale: "en", currency: "BDT" })

  beforeAll(async () => {
    ;({ prisma } = await import("../../src/config/prisma"))
    ;({ CatalogService: Catalog } = await import("../../src/modules/catalog/catalog.service"))
    ;({ StorefrontService: Shop } = await import("../../src/modules/storefront/storefront.service"))
    dto = await import("../../src/modules/catalog/catalog.dto")
    sfDto = await import("../../src/modules/storefront/storefront.dto")
    accounts = await import("../../src/modules/customers/account-deletion")
    storeId = (await prisma.store.create({ data: { name: "B51 Shop", slug: `b51-${suffix}` } })).id
    otherStoreId = (await prisma.store.create({ data: { name: "B51 Other", slug: `b51o-${suffix}` } })).id
    const role = await prisma.role.create({ data: { storeId, name: "Manager", slug: `mgr-${suffix}` } })
    const staffId = (await prisma.adminUser.create({ data: { storeId, email: `m-${suffix}@x.test`, name: "Mitu", passwordHash: "x", roleId: role.id } })).id
    owner = { storeId, requestId: "test", locale: "en", currency: "BDT", admin: { id: staffId, role: "ADMIN", permissions: ["*"] } }
  })

  afterAll(async () => {
    if (!prisma || !storeId) return // setup failed: an undefined id would match every row
    await prisma.customer.deleteMany({ where: { storeId: { in: [storeId, otherStoreId] } } })
    await prisma.product.deleteMany({ where: { storeId: { in: [storeId, otherStoreId] } } })
    await prisma.adminUser.deleteMany({ where: { storeId } })
    await prisma.store.deleteMany({ where: { id: { in: [storeId, otherStoreId] } } })
    await prisma.$disconnect()
  })

  const make = (name: string, extra: object = {}) =>
    new Catalog(owner).createProduct(
      dto.CreateProductDto.parse({ name, slug: `${name.toLowerCase()}-${suffix}`, regularPrice: 1000, manageStock: false, ...extra }),
    ) as Promise<{ id: bigint; relatedProductIds: bigint[] }>

  it("saves related picks in order, never itself or another store's product, and shows them on the product page", async () => {
    const shirt = await make("Shirt")
    const belt = await make("Belt")
    const cap = await make("Cap")
    const foreign = await prisma.product.create({ data: { storeId: otherStoreId, name: "Theirs", slug: `theirs-${suffix}`, regularPrice: 10 } })
    const saved = (await new Catalog(owner).updateProduct(
      shirt.id,
      dto.UpdateProductDto.parse({ relatedProductIds: [cap.id, belt.id, shirt.id, foreign.id, cap.id] }),
    )) as unknown
    const full = (await new Catalog(owner).getProductById(shirt.id)) as { relatedProductIds: bigint[] }
    expect(full.relatedProductIds).toEqual([cap.id, belt.id])
    expect(saved).toBeTruthy()
    const page = await shop().getProductBySlug(`shirt-${suffix}`)
    expect(page.relatedIds).toEqual([String(cap.id), String(belt.id)])
    // Deleting a linked product for good removes the link instead of failing.
    await prisma.product.delete({ where: { id: cap.id } })
    expect(((await new Catalog(owner).getProductById(shirt.id)) as { relatedProductIds: bigint[] }).relatedProductIds).toEqual([belt.id])
  })

  it("duplicates a product as a draft with no stock, SKUs or SEO title", async () => {
    const src = (await make("Panjabi", {
      sku: `PJ-${suffix}`,
      seoTitle: "Best panjabi",
      tags: ["eid"],
      type: "VARIABLE",
      variants: [
        { attributeValues: { size: "M" }, sku: `PJ-M-${suffix}`, stockQty: 5 },
        { attributeValues: { size: "L" }, sku: `PJ-L-${suffix}`, stockQty: 2 },
      ],
      manageStock: true,
      stockQty: 0,
    })) as { id: bigint }
    const copy = (await new Catalog(owner).duplicateProduct(src.id)) as {
      id: bigint
      name: string
      status: string
      sku: string | null
      seoTitle: string | null
      tags: string[]
      variants: { sku: string | null; stockQty: number; attributeValues: unknown }[]
    }
    expect(copy.id).not.toBe(src.id)
    expect(copy).toMatchObject({ name: "Panjabi (copy)", status: "draft", sku: null, seoTitle: null, tags: ["eid"] })
    expect(copy.variants.map((v) => [v.attributeValues, v.sku, v.stockQty])).toEqual([
      [{ size: "M" }, null, 0],
      [{ size: "L" }, null, 0],
    ])
  })

  it("lists only products on sale, biggest discount first", async () => {
    await make("Saree", { salePrice: 500 }) // 50% off
    await make("Lungi", { salePrice: 900 }) // 10% off
    const q = sfDto.StorefrontProductsQueryDto.parse({ onSale: "true", sort: "discount" })
    const { items } = (await shop().listProducts(q)) as unknown as { items: { title: string }[] }
    expect(items.map((i) => i.title)).toEqual(["Saree", "Lungi"])
  })

  it("empties a deleted account, keeps it from signing in, and frees the email", async () => {
    const c = await prisma.customer.create({
      data: { storeId, email: `rina-${suffix}@x.test`, passwordHash: "hash", firstName: "Rina", lastName: "Akter", phone: "01711111111" },
    })
    await prisma.customerAddress.create({
      data: { customerId: c.id, type: "shipping", firstName: "Rina", lastName: "Akter", address1: "Road 1", city: "Dhaka", countryCode: "BD", phone: "01711111111" },
    })
    const exported = await accounts.exportMyData(storeId, c.id)
    expect(exported.account.email).toBe(`rina-${suffix}@x.test`)
    await accounts.deleteMyAccount(storeId, c.id)
    const after = await prisma.customer.findUniqueOrThrow({ where: { id: c.id }, include: { addresses: true } })
    expect(after).toMatchObject({ firstName: "Deleted", phone: null, passwordHash: null, status: "deleted", addresses: [] })
    expect(after.email).not.toContain("rina")
    expect(after.sessionsValidFrom).not.toBeNull()
    // Another store can't delete it, and the old email can open a new account.
    await expect(accounts.deleteMyAccount(otherStoreId, c.id)).rejects.toThrow()
    await prisma.customer.create({ data: { storeId, email: `rina-${suffix}@x.test`, firstName: "Rina", lastName: "New" } })
  })
})
