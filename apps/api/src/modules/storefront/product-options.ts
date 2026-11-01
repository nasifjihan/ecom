/**
 * Filtering the shop by product options (size, colour…): Catalog > Attributes marked "show in
 * filters" are the filters, matched to the options on each variant ({ size: "M", color: "Red" })
 * by the attribute's slug or name. "Size M" means a size-M variant that can be sold now.
 */
import type { Prisma } from "@prisma/client"
import { prisma } from "../../config"

/** `size:M|L;color:Red` → { size: ["M", "L"], color: ["Red"] }. */
export function parseOptions(raw: string | undefined): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const part of (raw ?? "").split(";")) {
    const at = part.indexOf(":")
    if (at < 1) continue
    const values = part.slice(at + 1).split("|").map((v) => v.trim()).filter(Boolean)
    if (values.length) out[part.slice(0, at).trim().toLowerCase()] = [...new Set(values)]
  }
  return out
}

/** The keys a variant may use for an attribute: "size", "Size", or its name. */
export function keysFor(attr: { slug: string; name: string }): string[] {
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
  return [...new Set([attr.slug, cap(attr.slug), attr.name, attr.name.toLowerCase()])]
}

/** Matches a variant's key to an attribute (case and spaces aside). */
const sameKey = (key: string, attr: { slug: string; name: string }) => {
  const k = key.trim().toLowerCase()
  return k === attr.slug.toLowerCase() || k === attr.name.trim().toLowerCase()
}

export interface FilterAttribute {
  slug: string
  name: string
  type: string
  terms: { name: string; value: string | null; sortOrder: number }[]
}

export function filterAttributes(storeId: bigint): Promise<FilterAttribute[]> {
  return prisma.attribute.findMany({
    where: { storeId, isActive: true, isFilterable: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { slug: true, name: true, type: true, terms: { orderBy: { sortOrder: "asc" }, select: { name: true, value: true, sortOrder: true } } },
  })
}

/** A variant that can be sold now. */
const variantAvailable = (): Prisma.ProductVariantWhereInput => ({
  status: "active",
  OR: [{ manageStock: false }, { allowBackorder: true }, { stockQty: { gt: prisma.productVariant.fields.reservedStock } }],
})

/** Products with a sellable variant in every chosen option, or (in stock only) anything sellable. */
export async function optionsWhere(storeId: bigint, raw: string | undefined, inStock: boolean): Promise<Prisma.ProductWhereInput> {
  const chosen = parseOptions(raw)
  const attrs = Object.keys(chosen).length ? await filterAttributes(storeId) : []
  const groups = Object.entries(chosen).map(([slug, values]) => {
    const attr = attrs.find((a) => a.slug.toLowerCase() === slug) ?? { slug, name: slug }
    return { OR: keysFor(attr).flatMap((k) => values.map((v) => ({ attributeValues: { path: [k], equals: v } }))) }
  })
  if (groups.length) return { variants: { some: { AND: [variantAvailable(), ...groups] } } }
  if (!inStock) return {}
  return {
    OR: [
      { variants: { some: variantAvailable() } },
      {
        variants: { none: { status: "active" } },
        OR: [{ manageStock: false }, { allowBackorder: true }, { stockQty: { gt: prisma.product.fields.reservedStock } }],
      },
    ],
  }
}

export interface OptionFacet {
  slug: string
  name: string
  /** Colour swatches when the attribute is a colour one and the value has a colour code. */
  values: { value: string; count: number; color?: string }[]
}

/**
 * How many products each option value would show. A value counts a product when the product has a
 * sellable variant with it that also fits the other chosen options (its own group is left out, so
 * shoppers can add a second size).
 */
export function countOptions(
  attrs: FilterAttribute[],
  variants: { productId: bigint; attributeValues: unknown }[],
  chosen: Record<string, string[]>,
): OptionFacet[] {
  const optionsOf = (v: { attributeValues: unknown }) => {
    const vals = (v.attributeValues ?? {}) as Record<string, unknown>
    const out: Record<string, string> = {}
    for (const a of attrs) {
      const key = Object.keys(vals).find((k) => sameKey(k, a))
      if (key !== undefined && vals[key] !== null && vals[key] !== "") out[a.slug.toLowerCase()] = String(vals[key])
    }
    return out
  }
  const rows = variants.map((v) => ({ productId: v.productId, opts: optionsOf(v) }))
  const fits = (opts: Record<string, string>, except: string) =>
    Object.entries(chosen).every(([slug, values]) => slug === except || values.includes(opts[slug] ?? ""))
  return attrs
    .map((a) => {
      const slug = a.slug.toLowerCase()
      const products = new Map<string, Set<bigint>>()
      for (const r of rows) {
        const value = r.opts[slug]
        if (value === undefined || !fits(r.opts, slug)) continue
        if (!products.has(value)) products.set(value, new Set())
        products.get(value)!.add(r.productId)
      }
      const order = (v: string) => {
        const i = a.terms.findIndex((t) => t.name.toLowerCase() === v.toLowerCase())
        return i === -1 ? Number.MAX_SAFE_INTEGER : i
      }
      const colourOf = (v: string) => a.terms.find((t) => t.name.toLowerCase() === v.toLowerCase())?.value ?? undefined
      const values = [...products.entries()]
        .map(([value, ids]) => {
          const color = colourOf(value)
          return { value, count: ids.size, ...(color && /^#[0-9a-f]{3,8}$/i.test(color) ? { color } : {}) }
        })
        .sort((x, y) => order(x.value) - order(y.value) || x.value.localeCompare(y.value, undefined, { numeric: true }))
      return { slug: a.slug, name: a.name, values }
    })
    .filter((f) => f.values.length > 0)
}

/** Sellable variants of the products a list shows, for countOptions. */
export function sellableVariants(where: Prisma.ProductWhereInput) {
  // shortcut: counts read every sellable variant of the listed products; fine for a few thousand products, move to SQL counts beyond that.
  return prisma.productVariant.findMany({ where: { product: where, ...variantAvailable() }, select: { productId: true, attributeValues: true } })
}
