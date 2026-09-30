/**
 * PRODUCT IMPORT & EXPORT — Catalog > Products > Import / Export.
 *
 * A CSV or Excel sheet is read (import.rules parseCsv / toRows), checked against the store
 * (planImport: categories, brands, existing products and variant SKUs), shown as a preview, then
 * imported through CatalogService, so an imported product is saved exactly like one made by
 * hand (slug, stock ledger, variants kept by id). The export writes the same columns.
 */
import ExcelJS from "exceljs"
import { prisma } from "../../../config"
import { BadRequestError, type RequestContext } from "../../../core"
import { CatalogService } from "../catalog.service"
import { CreateProductDto, UpdateProductDto } from "../catalog.dto"
import {
  COLUMNS,
  categoryLookup,
  parseCsv,
  planImport,
  toRows,
  type Column,
  type ImportPlan,
  type Lookups,
  type PlannedProduct,
} from "./import.rules"

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024

export interface ImportFile {
  buffer: Buffer
  originalname: string
  mimetype: string
}

/** What one cell of an Excel sheet holds, as text. */
function cellText(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return ""
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  if (typeof v === "object") {
    if ("richText" in v) return v.richText.map((t) => t.text).join("")
    if ("text" in v && typeof v.text === "string") return v.text
    if ("result" in v) return cellText(v.result)
    if ("hyperlink" in v) return String(v.hyperlink)
    return ""
  }
  return String(v)
}

/** The sheet as rows of text cells (CSV or the first Excel sheet). */
export async function readTable(file: ImportFile): Promise<string[][]> {
  const name = file.originalname.toLowerCase()
  if (name.endsWith(".xlsx") || file.mimetype.includes("spreadsheetml")) {
    const wb = new ExcelJS.Workbook()
    try {
      await wb.xlsx.load(file.buffer as unknown as ArrayBuffer)
    } catch {
      throw new BadRequestError(
        "This Excel file can't be read. Save it as .xlsx or .csv and try again.",
        "VALIDATION_FAILED",
      )
    }
    const ws = wb.worksheets[0]
    if (!ws) return []
    const table: string[][] = []
    ws.eachRow({ includeEmpty: false }, (row) => {
      const cells: string[] = []
      for (let c = 1; c <= ws.columnCount; c++) cells.push(cellText(row.getCell(c).value))
      if (cells.some((x) => x.trim() !== "")) table.push(cells)
    })
    return table
  }
  if (
    name.endsWith(".csv") ||
    name.endsWith(".txt") ||
    file.mimetype.includes("csv") ||
    file.mimetype.startsWith("text/")
  ) {
    return parseCsv(file.buffer.toString("utf8").replace(/^\uFEFF/, ""))
  }
  throw new BadRequestError("Upload a .csv or .xlsx file", "VALIDATION_FAILED")
}

export class ProductImportService {
  constructor(private readonly ctx: RequestContext) {}

  private get storeId(): bigint {
    if (this.ctx.storeId === undefined)
      throw new BadRequestError("No store for this request", "STORE_REQUIRED")
    return this.ctx.storeId
  }

  private async lookups(): Promise<Lookups> {
    const storeId = this.storeId
    const [cats, brands, products, variants] = await Promise.all([
      prisma.category.findMany({
        where: { storeId },
        select: { id: true, name: true, parentId: true },
      }),
      prisma.brand.findMany({ where: { storeId }, select: { id: true, name: true } }),
      prisma.product.findMany({
        where: { storeId, deletedAt: null, sku: { not: null } },
        select: { id: true, name: true, sku: true },
      }),
      prisma.productVariant.findMany({
        where: { product: { storeId }, sku: { not: null } },
        select: { sku: true, product: { select: { sku: true, id: true } } },
      }),
    ])
    const productSku = new Map(products.map((p) => [p.id, p.sku!.toLowerCase()]))
    return {
      categories: categoryLookup(cats),
      brands: new Map(brands.map((b) => [b.name.trim().toLowerCase(), b.id])),
      products: new Map(
        products.map((p) => [
          p.sku!.toLowerCase(),
          {
            id: p.id,
            name: p.name,
            variantSkus: variants
              .filter((v) => v.product.id === p.id)
              .map((v) => v.sku!.toLowerCase()),
          },
        ]),
      ),
      // A variant of a product without its own SKU is named by its product id.
      variantSkus: new Map(
        variants.map((v) => [
          v.sku!.toLowerCase(),
          productSku.get(v.product.id) ?? `#${v.product.id}`,
        ]),
      ),
    }
  }

  /** Reads and checks a sheet without changing anything. */
  async preview(file: ImportFile) {
    const { rows, unknownColumns, missingColumns } = toRows(await readTable(file))
    if (missingColumns.length)
      throw new BadRequestError(
        `The sheet needs a product_sku column (the first row must be the column names)`,
        "VALIDATION_FAILED",
      )
    if (!rows.length)
      throw new BadRequestError(
        "The sheet has no products under its column names",
        "VALIDATION_FAILED",
      )
    const plan = planImport(rows, await this.lookups())
    return { ...this.view(plan), unknownColumns }
  }

  private view(plan: ImportPlan) {
    return {
      summary: plan.summary,
      fileErrors: plan.fileErrors,
      products: plan.products.map((p) => ({
        sku: p.sku,
        name: p.name ?? null,
        action: p.action,
        rows: p.rows,
        variants: p.variants.length,
        errors: p.errors,
      })),
    }
  }

  /** Imports the products that have no problems; the rest are listed with their reasons. */
  async run(file: ImportFile) {
    const { rows, missingColumns } = toRows(await readTable(file))
    if (missingColumns.length || !rows.length)
      throw new BadRequestError(
        "The sheet needs a product_sku column and at least one product",
        "VALIDATION_FAILED",
      )
    const plan = planImport(rows, await this.lookups())
    if (plan.fileErrors.length && plan.products.length === 0)
      throw new BadRequestError(plan.fileErrors[0], "VALIDATION_FAILED")
    const catalog = new CatalogService(this.ctx)
    const done: { sku: string; action: "create" | "update"; id: string }[] = []
    const failed: { sku: string; rows: number[]; message: string }[] = []
    for (const p of plan.products) {
      if (p.errors.length) {
        failed.push({
          sku: p.sku,
          rows: p.rows,
          message: p.errors.map((e) => `Row ${e.row}: ${e.message}`).join("; "),
        })
        continue
      }
      try {
        const id =
          p.action === "create" ? await this.create(catalog, p) : await this.update(catalog, p)
        done.push({ sku: p.sku, action: p.action, id: String(id) })
      } catch (e) {
        failed.push({ sku: p.sku, rows: p.rows, message: messageOf(e) })
      }
    }
    return {
      created: done.filter((d) => d.action === "create").length,
      updated: done.filter((d) => d.action === "update").length,
      done,
      failed,
    }
  }

  private async create(catalog: CatalogService, p: PlannedProduct): Promise<bigint> {
    const variable = p.variants.length > 0
    const dto = CreateProductDto.parse({
      type: variable ? "VARIABLE" : "SIMPLE",
      name: p.name,
      sku: p.sku,
      status: p.status ?? "draft",
      regularPrice: p.price ?? p.variants.find((v) => v.price !== undefined)?.price ?? null,
      salePrice: p.salePrice ?? null,
      costPrice: p.costPrice ?? null,
      manageStock: true,
      stockQty: variable ? 0 : (p.stock ?? 0),
      weight: p.weightKg ?? null,
      brandId: p.brandId ?? null,
      categoryIds: p.categoryId ? [p.categoryId] : [],
      imageUrls: p.imageUrls ?? [],
      tags: p.tags ?? [],
      shortDescription: p.shortDescription ?? null,
      description: p.description ?? null,
      variants: p.variants.map((v) => ({
        attributeValues: v.options,
        sku: v.sku,
        regularPrice: v.price ?? p.price ?? null,
        salePrice: v.salePrice ?? null,
        costPrice: v.costPrice ?? p.costPrice ?? null,
        manageStock: true,
        stockQty: v.stock ?? 0,
      })),
    })
    const created = (await catalog.createProduct(dto)) as { id: bigint }
    return created.id
  }

  private async update(catalog: CatalogService, p: PlannedProduct): Promise<bigint> {
    const id = p.productId!
    const current = await prisma.product.findUniqueOrThrow({
      where: { id },
      include: {
        variants: { orderBy: { id: "asc" } },
        categories: { orderBy: { primary: "desc" } },
      },
    })
    const patch: Record<string, unknown> = {}
    const set = (key: string, v: unknown) => {
      if (v !== undefined) patch[key] = v
    }
    set("name", p.name)
    set("status", p.status)
    set("regularPrice", p.price)
    set("salePrice", p.salePrice)
    set("costPrice", p.costPrice)
    set("weight", p.weightKg)
    set("brandId", p.brandId)
    set("tags", p.tags)
    set("shortDescription", p.shortDescription)
    set("description", p.description)
    set("imageUrls", p.imageUrls)
    // The sheet's category becomes the main one; the product's others stay.
    if (p.categoryId)
      patch.categoryIds = [
        p.categoryId,
        ...current.categories.map((c) => c.categoryId).filter((c) => c !== p.categoryId),
      ]
    if (p.stock !== undefined && !current.variants.length && !p.variants.length)
      patch.stockQty = p.stock

    if (p.variants.length) {
      const num = (d: unknown) => (d === null || d === undefined ? null : Number(d))
      const same = (a: Record<string, unknown>, b: Record<string, string>) => {
        const norm = (o: Record<string, unknown>) =>
          Object.entries(o)
            .map(
              ([k, v]) =>
                `${k.trim().toLowerCase()}=${String(v as string)
                  .trim()
                  .toLowerCase()}`,
            )
            .sort()
            .join("|")
        return norm(a) === norm(b)
      }
      const list = current.variants.map((v) => ({
        id: String(v.id),
        attributeValues: v.attributeValues as Record<string, unknown>,
        sku: v.sku,
        barcode: v.barcode,
        regularPrice: num(v.regularPrice),
        salePrice: num(v.salePrice),
        costPrice: num(v.costPrice),
        manageStock: v.manageStock,
        stockQty: v.stockQty ?? 0,
        allowBackorder: v.allowBackorder,
        lowStockThreshold: v.lowStockThreshold,
        imageUrl: v.imageUrl,
        weight: num(v.weight),
        status: v.status,
      }))
      for (const pv of p.variants) {
        const match = list.find(
          (v) =>
            (!!pv.sku && v.sku?.toLowerCase() === pv.sku.toLowerCase()) ||
            same(v.attributeValues, pv.options),
        )
        if (match) {
          if (pv.sku) match.sku = pv.sku
          match.attributeValues = { ...match.attributeValues, ...pv.options }
          if (pv.price !== undefined) match.regularPrice = pv.price
          if (pv.salePrice !== undefined) match.salePrice = pv.salePrice
          if (pv.costPrice !== undefined) match.costPrice = pv.costPrice
          if (pv.stock !== undefined) match.stockQty = pv.stock
        } else {
          list.push({
            id: undefined as unknown as string,
            attributeValues: pv.options,
            sku: pv.sku,
            barcode: null,
            regularPrice: pv.price ?? p.price ?? num(current.regularPrice),
            salePrice: pv.salePrice ?? null,
            costPrice: pv.costPrice ?? p.costPrice ?? num(current.costPrice),
            manageStock: true,
            stockQty: pv.stock ?? 0,
            allowBackorder: false,
            lowStockThreshold: null,
            imageUrl: null,
            weight: null,
            status: "active",
          })
        }
      }
      patch.variants = list.map(({ id: vid, ...v }) => (vid ? { id: vid, ...v } : v))
      patch.type = "VARIABLE"
    }
    await catalog.updateProduct(id, UpdateProductDto.parse(patch))
    return id
  }

  // ---------------------------------------------------------------- export

  /** Products outside the Trash (all, or just `ids`), one row per product or per variant (the import's layout). */
  async exportRows(ids?: bigint[]): Promise<Record<Column, string>[]> {
    const storeId = this.storeId
    const [products, cats] = await Promise.all([
      prisma.product.findMany({
        where: { storeId, deletedAt: null, ...(ids?.length ? { id: { in: ids } } : {}) },
        include: {
          brand: { select: { name: true } },
          categories: { orderBy: { primary: "desc" }, select: { categoryId: true } },
          images: { orderBy: { sortOrder: "asc" }, select: { imageUrl: true } },
          variants: { orderBy: { id: "asc" } },
        },
        orderBy: { id: "asc" },
      }),
      prisma.category.findMany({
        where: { storeId },
        select: { id: true, name: true, parentId: true },
      }),
    ])
    const byId = new Map(cats.map((c) => [c.id, c]))
    const pathOf = (id: bigint | undefined) => {
      const names: string[] = []
      let cur = id ? byId.get(id) : undefined
      for (let hops = 0; cur && hops < 20; hops++) {
        names.unshift(cur.name)
        cur = cur.parentId ? byId.get(cur.parentId) : undefined
      }
      return names.join(" > ")
    }
    const text = (v: { toString(): string } | null | undefined) =>
      v === null || v === undefined ? "" : v.toString()
    const blank = Object.fromEntries(COLUMNS.map((c) => [c, ""])) as Record<Column, string>
    const out: Record<Column, string>[] = []
    for (const p of products) {
      const sku = p.sku ?? `P${p.id}`
      out.push({
        ...blank,
        product_sku: sku,
        name: p.name,
        status: p.status,
        category: pathOf(p.categories[0]?.categoryId),
        brand: p.brand?.name ?? "",
        price: text(p.regularPrice),
        sale_price: text(p.salePrice),
        cost_price: text(p.costPrice),
        stock: p.variants.length ? "" : text(p.stockQty ?? 0),
        weight_kg: text(p.weight),
        tags: p.tags.join(", "),
        short_description: p.shortDescription ?? "",
        description: p.description ?? "",
        image_urls: p.images.map((i) => i.imageUrl).join(" | "),
      })
      for (const v of p.variants) {
        const opts = Object.entries((v.attributeValues ?? {}) as Record<string, unknown>).slice(
          0,
          3,
        )
        const row: Record<Column, string> = {
          ...blank,
          product_sku: sku,
          variant_sku: v.sku ?? "",
          price: text(v.regularPrice),
          sale_price: text(v.salePrice),
          cost_price: text(v.costPrice),
          stock: text(v.stockQty ?? 0),
        }
        opts.forEach(([k, val], i) => {
          row[`option${i + 1}_name` as Column] = k.charAt(0).toUpperCase() + k.slice(1)
          row[`option${i + 1}_value` as Column] = typeof val === "string" || typeof val === "number" ? String(val) : ""
        })
        out.push(row)
      }
    }
    return out
  }
}

/** A readable reason from a failed save (a zod check or a service error). */
function messageOf(e: unknown): string {
  const issues = (e as { issues?: { path: (string | number)[]; message: string }[] }).issues
  if (issues?.length) return issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")
  return (e as Error).message || "Couldn't save this product"
}

/** A sheet for staff to fill: the columns, and two example products. */
export const TEMPLATE_ROWS: Partial<Record<Column, string>>[] = [
  {
    product_sku: "PNJ-001",
    name: "Cotton Panjabi",
    status: "published",
    category: "Men > Panjabi",
    brand: "",
    price: "2500",
    sale_price: "2200",
    cost_price: "1400",
    stock: "10",
    weight_kg: "0.4",
    tags: "eid, cotton",
    short_description: "Soft cotton panjabi for Eid",
    image_urls: "https://example.com/panjabi-front.jpg | https://example.com/panjabi-back.jpg",
  },
  {
    product_sku: "TEE-001",
    name: "Basic T-shirt",
    status: "draft",
    price: "550",
    cost_price: "300",
  },
  {
    product_sku: "TEE-001",
    variant_sku: "TEE-001-S-RED",
    option1_name: "Size",
    option1_value: "S",
    option2_name: "Colour",
    option2_value: "Red",
    stock: "5",
  },
  {
    product_sku: "TEE-001",
    variant_sku: "TEE-001-M-RED",
    option1_name: "Size",
    option1_value: "M",
    option2_name: "Colour",
    option2_value: "Red",
    stock: "8",
    price: "580",
  },
]
