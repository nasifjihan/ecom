/**
 * Product import/export against a REAL Postgres: a sheet creates simple and variable products,
 * a second sheet updates them by SKU (variants kept by SKU, stock through the ledger), rows with
 * problems are skipped with their reasons, and the export re-imports as updates only.
 * Runs only when RUN_DB_TESTS=1.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import type { RequestContext } from "../../src/core"

const runDb = process.env.RUN_DB_TESTS === "1"

describe.skipIf(!runDb)("product import (Postgres)", () => {
  let prisma: typeof import("../../src/config/prisma").prisma
  let Svc: typeof import("../../src/modules/catalog/import/import.service").ProductImportService
  let storeId: bigint
  let ctx: RequestContext
  const suffix = Date.now().toString(36)
  const csv = (text: string, name = "products.csv") => ({
    buffer: Buffer.from(text, "utf8"),
    originalname: name,
    mimetype: "text/csv",
  })

  beforeAll(async () => {
    ;({ prisma } = await import("../../src/config/prisma"))
    ;({ ProductImportService: Svc } =
      await import("../../src/modules/catalog/import/import.service"))
    storeId = (await prisma.store.create({ data: { name: "Import Test", slug: `im-${suffix}` } }))
      .id
    const men = await prisma.category.create({
      data: { storeId, name: "Men", slug: `men-${suffix}` },
    })
    await prisma.category.create({
      data: { storeId, name: "Panjabi", slug: `panjabi-${suffix}`, parentId: men.id },
    })
    ctx = {
      storeId,
      requestId: "test",
      locale: "en",
      currency: "BDT",
      admin: { id: 1n, role: "ADMIN", permissions: ["*"] },
    }
  })

  afterAll(async () => {
    if (!prisma) return
    await prisma.product.deleteMany({ where: { storeId } })
    await prisma.category.deleteMany({ where: { storeId, parentId: { not: null } } })
    await prisma.category.deleteMany({ where: { storeId } })
    await prisma.store.delete({ where: { id: storeId } })
    await prisma.$disconnect()
  })

  const product = (sku: string) =>
    prisma.product.findFirstOrThrow({
      where: { storeId, sku },
      include: { variants: { orderBy: { id: "asc" } }, categories: true },
    })

  const first = [
    "product_sku,name,status,category,price,sale_price,stock,option1_name,option1_value,variant_sku",
    `PNJ-1,Cotton Panjabi,published,Men > Panjabi,"৳2,500",2200,10,,,`,
    "TEE-1,Basic Tee,draft,,550,,,,,",
    "TEE-1,,,,,,5,Size,S,TEE-1-S",
    "TEE-1,,,,580,,8,Size,M,TEE-1-M",
    "BAD-1,No Price,published,Nowhere,abc,,,,,",
  ].join("\n")

  it("previews without saving anything", async () => {
    const view = await new Svc(ctx).preview(csv(first))
    expect(view.products.map((p) => [p.sku, p.action, p.variants, p.errors.length > 0])).toEqual([
      ["PNJ-1", "create", 0, false],
      ["TEE-1", "create", 2, false],
      ["BAD-1", "create", 0, true],
    ])
    expect(await prisma.product.count({ where: { storeId } })).toBe(0)
  })

  it("creates products, skipping the ones with problems", async () => {
    const res = await new Svc(ctx).run(csv(first))
    expect(res.created).toBe(2)
    expect(res.failed.map((f) => f.sku)).toEqual(["BAD-1"])
    const pnj = await product("PNJ-1")
    expect([pnj.status, Number(pnj.regularPrice), Number(pnj.salePrice), pnj.stockQty]).toEqual([
      "published",
      2500,
      2200,
      10,
    ])
    expect(pnj.categories).toHaveLength(1)
    const tee = await product("TEE-1")
    expect(tee.type).toBe("VARIABLE")
    expect(
      tee.variants.map((v) => [v.sku, v.attributeValues, Number(v.regularPrice), v.stockQty]),
    ).toEqual([
      ["TEE-1-S", { size: "S" }, 550, 5],
      ["TEE-1-M", { size: "M" }, 580, 8],
    ])
  })

  it("updates by SKU, keeping variants and only changing the filled cells", async () => {
    const before = await product("TEE-1")
    const res = await new Svc(ctx).run(
      csv(
        [
          "product_sku,name,price,stock,option1_name,option1_value,variant_sku",
          "PNJ-1,,,4,,,",
          "TEE-1,Basic Tee 2,,,,,",
          "TEE-1,,,12,Size,M,TEE-1-M",
          "TEE-1,,,3,Size,L,TEE-1-L",
        ].join("\n"),
      ),
    )
    expect([res.created, res.updated, res.failed]).toEqual([0, 2, []])
    const pnj = await product("PNJ-1")
    expect([pnj.name, Number(pnj.regularPrice), pnj.stockQty]).toEqual(["Cotton Panjabi", 2500, 4])
    const tee = await product("TEE-1")
    expect(tee.name).toBe("Basic Tee 2")
    expect(tee.variants.map((v) => [v.sku, v.stockQty])).toEqual([
      ["TEE-1-S", 5],
      ["TEE-1-M", 12],
      ["TEE-1-L", 3],
    ])
    expect(tee.variants.slice(0, 2).map((v) => v.id)).toEqual(before.variants.map((v) => v.id))
  })

  it("exports rows that import back as updates only", async () => {
    const rows = await new Svc(ctx).exportRows()
    expect(rows.filter((r) => r.product_sku === "TEE-1")).toHaveLength(4)
    expect(rows.find((r) => r.product_sku === "PNJ-1")?.category).toBe("Men > Panjabi")
    const { COLUMNS } = await import("../../src/modules/catalog/import/import.rules")
    const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
    const text =
      "﻿" +
      [COLUMNS.join(","), ...rows.map((r) => COLUMNS.map((c) => esc(r[c])).join(","))].join("\r\n")
    const view = await new Svc(ctx).preview(csv(text))
    expect(view.products.map((p) => [p.sku, p.action, p.errors])).toEqual([
      ["PNJ-1", "update", []],
      ["TEE-1", "update", []],
    ])
    const res = await new Svc(ctx).run(csv(text))
    expect([res.created, res.updated, res.failed]).toEqual([0, 2, []])
    expect((await product("TEE-1")).variants).toHaveLength(3)
  })
})
