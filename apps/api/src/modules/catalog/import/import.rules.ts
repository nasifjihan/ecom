/**
 * PRODUCT IMPORT RULES — reading a product sheet (CSV or Excel) and checking it, pure and tested.
 *
 * One row per product, or one row per variant: rows with the same `product_sku` are one product,
 * and a row with option values is one of its variants. The first row of a product carries its
 * details (name, category …). This is the same layout the export writes, so a shop can export,
 * edit in Excel and import again. On an existing product a blank cell means "leave as it is".
 */

export const MAX_IMPORT_ROWS = 2000

/** The sheet's columns, in the order the export and the template use. */
export const COLUMNS = [
  "product_sku",
  "name",
  "status",
  "category",
  "brand",
  "price",
  "sale_price",
  "cost_price",
  "stock",
  "weight_kg",
  "tags",
  "short_description",
  "description",
  "image_urls",
  "variant_sku",
  "option1_name",
  "option1_value",
  "option2_name",
  "option2_value",
  "option3_name",
  "option3_value",
] as const
export type Column = (typeof COLUMNS)[number]
export type Row = Partial<Record<Column, string>> & { _row: number }

/** Other names people give these columns (lowercase, words joined by "_"). */
const ALIASES: Record<string, Column> = {
  sku: "product_sku",
  product_code: "product_sku",
  parent_sku: "product_sku",
  product_name: "name",
  title: "name",
  regular_price: "price",
  mrp: "price",
  sale: "sale_price",
  offer_price: "sale_price",
  cost: "cost_price",
  purchase_price: "cost_price",
  quantity: "stock",
  qty: "stock",
  stock_qty: "stock",
  weight: "weight_kg",
  categories: "category",
  images: "image_urls",
  image_url: "image_urls",
  image: "image_urls",
  variation_sku: "variant_sku",
}

const headerKey = (h: string): Column | null => {
  const k = h
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
  if ((COLUMNS as readonly string[]).includes(k)) return k as Column
  return ALIASES[k] ?? null
}

// ---------------------------------------------------------------- reading

/** Splits CSV text into rows of cells: quotes, doubled quotes, CRLF, and a comma, semicolon or tab separator. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, "")
  const firstLine = src.split(/\r?\n/, 1)[0] ?? ""
  const counts = { ",": 0, ";": 0, "\t": 0 }
  for (const ch of firstLine) if (ch in counts) counts[ch as keyof typeof counts]++
  // The separator the header uses most (Excel in some locales saves ";"); a comma by default.
  const sep =
    counts[";"] > counts[","] && counts[";"] >= counts["\t"]
      ? ";"
      : counts["\t"] > counts[","]
        ? "\t"
        : ","
  const rows: string[][] = []
  let row: string[] = []
  let cell = ""
  let quoted = false
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"'
        i++
      } else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"' && cell === "") quoted = true
    else if (ch === sep) {
      row.push(cell)
      cell = ""
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ""
    } else cell += ch
  }
  if (cell !== "" || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""))
}

/**
 * Header row + cells → rows keyed by column (row numbers as in the sheet, header = 1). Unknown
 * columns are listed so the preview can say they were ignored.
 */
export function toRows(table: string[][]): {
  rows: Row[]
  unknownColumns: string[]
  missingColumns: Column[]
} {
  const [header = [], ...body] = table
  const keys = header.map(headerKey)
  const unknownColumns = header.filter((h, i) => h.trim() && !keys[i]).map((h) => h.trim())
  const rows = body.map((cells, i) => {
    const r: Row = { _row: i + 2 }
    keys.forEach((k, j) => {
      if (!k) return
      const v = (cells[j] ?? "").trim()
      if (v !== "" && r[k] === undefined) r[k] = v
    })
    return r
  })
  const missingColumns = (["product_sku"] as Column[]).filter((c) => !keys.includes(c))
  return { rows, unknownColumns, missingColumns }
}

// ---------------------------------------------------------------- values

const BN_DIGITS = "০১২৩৪৫৬৭৮৯"
const asciiDigits = (s: string) => s.replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)))

/** "৳1,250.50", "1250", "১২৫০" → 1250.5; blank → undefined; anything else → NaN. */
export function money(v: string | undefined): number | undefined {
  if (v === undefined || v.trim() === "") return undefined
  const s = asciiDigits(v)
    .replace(/৳|tk\.?|bdt/gi, "")
    .replace(/[,\s]/g, "")
  return /^\d+(\.\d+)?$/.test(s) ? Number(s) : NaN
}

/** A whole number (stock); blank → undefined; anything else → NaN. */
export function whole(v: string | undefined): number | undefined {
  if (v === undefined || v.trim() === "") return undefined
  const s = asciiDigits(v).replace(/[,\s]/g, "")
  return /^-?\d+$/.test(s) ? Number(s) : NaN
}

const STATUSES: Record<string, string> = {
  published: "published",
  publish: "published",
  active: "published",
  live: "published",
  draft: "draft",
  hidden: "draft",
  archived: "archived",
}

// ---------------------------------------------------------------- the plan

export interface Lookups {
  /** Category by lowercase name or path ("men > shirts"); null when a name fits more than one. */
  categories: Map<string, bigint | null>
  brands: Map<string, bigint>
  /** The store's products by lowercase SKU (outside the Trash). */
  products: Map<string, { id: bigint; name: string; variantSkus: string[] }>
  /** Every variant SKU in the store (lowercase) → its product's SKU (lowercase). */
  variantSkus: Map<string, string>
}

export interface PlannedVariant {
  row: number
  sku: string | null
  options: Record<string, string>
  price?: number
  salePrice?: number
  costPrice?: number
  stock?: number
}

export interface PlannedProduct {
  sku: string
  action: "create" | "update"
  productId: bigint | null
  rows: number[]
  name?: string
  status?: string
  categoryId?: bigint
  brandId?: bigint
  price?: number
  salePrice?: number
  costPrice?: number
  stock?: number
  weightKg?: number
  tags?: string[]
  shortDescription?: string
  description?: string
  imageUrls?: string[]
  variants: PlannedVariant[]
  errors: { row: number; message: string }[]
}

export interface ImportPlan {
  products: PlannedProduct[]
  /** Problems that aren't one product's (the file itself). */
  fileErrors: string[]
  summary: { rows: number; create: number; update: number; withErrors: number; variants: number }
}

const optionKey = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ")

/** Reads a sheet's rows into products to create or update, each with its problems. */
export function planImport(rows: Row[], lk: Lookups): ImportPlan {
  const fileErrors: string[] = []
  if (rows.length > MAX_IMPORT_ROWS)
    fileErrors.push(
      `The file has ${rows.length} rows; import at most ${MAX_IMPORT_ROWS} at a time.`,
    )
  const groups = new Map<string, Row[]>()
  const orphanErrors: { row: number; message: string }[] = []
  for (const r of rows.slice(0, MAX_IMPORT_ROWS)) {
    const sku = r.product_sku?.trim()
    if (!sku) {
      orphanErrors.push({
        row: r._row,
        message: "No product_sku: every row needs the product's SKU",
      })
      continue
    }
    const key = sku.toLowerCase()
    groups.set(key, [...(groups.get(key) ?? []), r])
  }
  if (orphanErrors.length) fileErrors.push(...orphanErrors.map((e) => `Row ${e.row}: ${e.message}`))

  const products: PlannedProduct[] = []
  const seenVariantSkus = new Map<string, string>()
  for (const [key, group] of groups) {
    const first = group[0]!
    const existing = lk.products.get(key)
    const p: PlannedProduct = {
      sku: first.product_sku!.trim(),
      action: existing ? "update" : "create",
      productId: existing?.id ?? null,
      rows: group.map((r) => r._row),
      variants: [],
      errors: [],
    }
    const err = (row: number, message: string) => p.errors.push({ row, message })
    const num = (
      row: Row,
      col: Column,
      label: string,
      read: (v: string | undefined) => number | undefined,
    ) => {
      const n = read(row[col])
      if (n !== undefined && (Number.isNaN(n) || n < 0)) {
        err(row._row, `${label} "${row[col]}" isn't a number`)
        return undefined
      }
      return n
    }

    // The product's details: from the first row that has each one.
    const pick = (col: Column) => group.find((r) => r[col] !== undefined)?.[col]
    const pickRow = (col: Column) => group.find((r) => r[col] !== undefined) ?? first
    if (lk.variantSkus.has(key) && !existing)
      err(first._row, `"${p.sku}" is already a variant's SKU; use another product_sku`)
    p.name = pick("name")
    if (!p.name && !existing) err(first._row, "A new product needs a name")
    if (p.name && p.name.length < 2) err(pickRow("name")._row, "The name is too short")

    const status = pick("status")
    if (status !== undefined) {
      p.status = STATUSES[status.trim().toLowerCase()]
      if (!p.status)
        err(pickRow("status")._row, `Status "${status}" isn't one of published, draft or archived`)
    }
    const category = pick("category")
    if (category !== undefined) {
      const k = category
        .split(/\s*[>/]\s*/)
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
        .join(" > ")
      const id = lk.categories.get(k)
      if (id === undefined)
        err(
          pickRow("category")._row,
          `Category "${category}" wasn't found; add it first, or use its path like "Men > Shirts"`,
        )
      else if (id === null)
        err(
          pickRow("category")._row,
          `More than one category is called "${category}"; use its path like "Men > Shirts"`,
        )
      else p.categoryId = id
    }
    const brand = pick("brand")
    if (brand !== undefined) {
      const id = lk.brands.get(brand.trim().toLowerCase())
      if (id === undefined)
        err(pickRow("brand")._row, `Brand "${brand}" wasn't found; add it first`)
      else p.brandId = id
    }
    const tags = pick("tags")
    if (tags !== undefined)
      p.tags = tags
        .split(/[,;|]/)
        .map((t) => t.trim())
        .filter(Boolean)
    p.shortDescription = pick("short_description")
    if (p.shortDescription && p.shortDescription.length > 500)
      err(pickRow("short_description")._row, "The short description is longer than 500 characters")
    p.description = pick("description")
    const images = pick("image_urls")
    if (images !== undefined) {
      p.imageUrls = images
        .split(/[|\s]+/)
        .map((u) => u.trim())
        .filter(Boolean)
      const bad = p.imageUrls.find((u) => !/^https?:\/\/\S+$/i.test(u))
      if (bad)
        err(pickRow("image_urls")._row, `Picture "${bad}" isn't a web address (http… or https…)`)
    }
    const weightRow = pickRow("weight_kg")
    p.weightKg = num(weightRow, "weight_kg", "Weight", money)

    // Rows without options are the product itself; rows with options are its variants.
    const plain = group.filter(
      (r) => ![r.option1_value, r.option2_value, r.option3_value].some(Boolean),
    )
    const variantRows = group.filter((r) =>
      [r.option1_value, r.option2_value, r.option3_value].some(Boolean),
    )
    if (plain.length > 1)
      err(
        plain[1]!._row,
        `Product "${p.sku}" is listed twice; give variants option values, or use another product_sku`,
      )
    const base = plain[0] ?? first
    p.price = num(base, "price", "Price", money)
    p.salePrice = num(base, "sale_price", "Sale price", money)
    p.costPrice = num(base, "cost_price", "Cost price", money)
    p.stock = num(base, "stock", "Stock", whole)
    if (p.price !== undefined && p.salePrice !== undefined && p.salePrice > p.price)
      err(base._row, "The sale price is higher than the price")

    const optionNames: string[] = []
    const combos = new Set<string>()
    for (const r of variantRows) {
      const options: Record<string, string> = {}
      for (const i of [1, 2, 3] as const) {
        const name = r[`option${i}_name`]
        const value = r[`option${i}_value`]
        if (!value) continue
        const key = optionKey(name ?? optionNames[i - 1] ?? "")
        if (!key) {
          err(r._row, `Option ${i} has a value but no name (option${i}_name)`)
          continue
        }
        if (optionNames[i - 1] && optionNames[i - 1] !== key)
          err(r._row, `Option ${i} is "${name}" here but "${optionNames[i - 1]}" on an earlier row`)
        optionNames[i - 1] ??= key
        options[key] = value
      }
      const combo = Object.entries(options)
        .map(([k, v]) => `${k}=${v.toLowerCase()}`)
        .sort()
        .join("|")
      if (combos.has(combo))
        err(r._row, `The same options (${Object.values(options).join(" / ")}) are listed twice`)
      combos.add(combo)
      const vsku = r.variant_sku?.trim() ?? null
      if (vsku) {
        const other =
          lk.variantSkus.get(vsku.toLowerCase()) ?? seenVariantSkus.get(vsku.toLowerCase())
        if (other && other !== key)
          err(r._row, `Variant SKU "${vsku}" already belongs to product "${other.toUpperCase()}"`)
        if (lk.products.has(vsku.toLowerCase()) && vsku.toLowerCase() !== key)
          err(r._row, `Variant SKU "${vsku}" is a product's SKU`)
        seenVariantSkus.set(vsku.toLowerCase(), key)
      }
      const v: PlannedVariant = {
        row: r._row,
        sku: vsku,
        options,
        price: num(r, "price", "Price", money),
        salePrice: num(r, "sale_price", "Sale price", money),
        costPrice: num(r, "cost_price", "Cost price", money),
        stock: num(r, "stock", "Stock", whole),
      }
      const price = v.price ?? p.price
      if (price !== undefined && v.salePrice !== undefined && v.salePrice > price)
        err(r._row, "The sale price is higher than the price")
      if (!existing && price === undefined)
        err(r._row, "A new variant needs a price (on its row or the product's)")
      p.variants.push(v)
    }
    if (!variantRows.length && !existing && p.price === undefined)
      err(base._row, "A new product needs a price")
    products.push(p)
  }

  return {
    products,
    fileErrors,
    summary: {
      rows: rows.length,
      create: products.filter((p) => p.action === "create" && !p.errors.length).length,
      update: products.filter((p) => p.action === "update" && !p.errors.length).length,
      withErrors: products.filter((p) => p.errors.length).length,
      variants: products.reduce((n, p) => n + (p.errors.length ? 0 : p.variants.length), 0),
    },
  }
}

/** Category lookup: every category by its full path, and by its own name when that's unique. */
export function categoryLookup(
  cats: { id: bigint; name: string; parentId: bigint | null }[],
): Map<string, bigint | null> {
  const byId = new Map(cats.map((c) => [c.id, c]))
  const path = (c: { name: string; parentId: bigint | null }): string => {
    const names: string[] = []
    let cur: { name: string; parentId: bigint | null } | undefined = c
    for (let hops = 0; cur && hops < 20; hops++) {
      names.unshift(cur.name.trim().toLowerCase())
      cur = cur.parentId ? byId.get(cur.parentId) : undefined
    }
    return names.join(" > ")
  }
  const out = new Map<string, bigint | null>()
  for (const c of cats) {
    out.set(path(c), c.id)
    const own = c.name.trim().toLowerCase()
    if (own !== path(c)) out.set(own, out.has(own) && out.get(own) !== c.id ? null : c.id)
  }
  // A plain name that's also a top-level path stays that category.
  for (const c of cats) if (!c.parentId) out.set(c.name.trim().toLowerCase(), c.id)
  return out
}
