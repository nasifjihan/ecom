/**
 * STOREFRONT RULES — pure pricing and range rules for a store with more than one storefront.
 *
 * A product's price in a storefront is, in order:
 *   1. the option's own price there (ProductStorefront.variantPrices, by variant id);
 *   2. otherwise the product's own price there (ProductStorefront.regularPrice / salePrice), for every option;
 *   3. otherwise the product's (or option's) price with the storefront's adjustment (+/- %),
 *      rounded to whole taka, sale window kept;
 *   4. otherwise the product's price as it is.
 * A product is sold in a storefront when its row there says so, or, with no row, when the
 * storefront takes new products automatically.
 */
import type { Prisma } from "@prisma/client"

type Num = Prisma.Decimal | number | string | null | undefined
const num = (v: Num): number | null => (v === null || v === undefined || v === "" ? null : Number(v))

export interface PriceRow {
  regularPrice: Num
  salePrice: Num
  salePriceStartAt?: Date | null
  salePriceEndAt?: Date | null
}

export interface StorefrontPricing {
  priceAdjustPercent: number
}

export interface OwnPrice {
  listed: boolean
  regularPrice: Num
  salePrice: Num
  /** Own prices per option, by variant id (JSON). */
  variantPrices?: unknown
}

export interface OptionPrice {
  regularPrice: number
  salePrice: number | null
}

/** The own prices per option in a storefront row, keeping only well-formed ones (by variant id). */
export function optionPrices(raw: unknown): Map<string, OptionPrice> {
  const out = new Map<string, OptionPrice>()
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!v || typeof v !== "object") continue
    const { regularPrice, salePrice } = v as { regularPrice?: unknown; salePrice?: unknown }
    const reg = typeof regularPrice === "number" ? regularPrice : Number(regularPrice)
    if (regularPrice === null || regularPrice === undefined || !Number.isFinite(reg) || reg < 0) continue
    const sale = salePrice === null || salePrice === undefined ? null : Number(salePrice)
    out.set(id, { regularPrice: reg, salePrice: sale !== null && Number.isFinite(sale) && sale < reg ? sale : null })
  }
  return out
}

/** Grows or shrinks a price by `percent`, to whole taka, never below zero. */
export function adjust(price: number, percent: number): number {
  if (!percent) return price
  return Math.max(0, Math.round(price * (1 + percent / 100)))
}

/** The price row a storefront sells from (see the order above). */
export function storefrontPriceRow(
  row: PriceRow,
  sf: StorefrontPricing | null,
  own: OwnPrice | null | undefined,
  variantId?: bigint | string | null,
): PriceRow {
  if (own && variantId !== null && variantId !== undefined) {
    const opt = optionPrices(own.variantPrices).get(String(variantId))
    if (opt) return { regularPrice: opt.regularPrice, salePrice: opt.salePrice, salePriceStartAt: null, salePriceEndAt: null }
  }
  const ownRegular = num(own?.regularPrice)
  if (own && ownRegular !== null) {
    const sale = num(own.salePrice)
    return { regularPrice: ownRegular, salePrice: sale !== null && sale < ownRegular ? sale : null, salePriceStartAt: null, salePriceEndAt: null }
  }
  const pct = sf?.priceAdjustPercent ?? 0
  if (!pct) return row
  const regular = num(row.regularPrice)
  const sale = num(row.salePrice)
  return {
    ...row,
    regularPrice: regular === null ? null : adjust(regular, pct),
    salePrice: sale === null ? null : adjust(sale, pct),
  }
}

/** Whether a product is sold in a storefront. */
export function listedIn(sf: { includeNewProducts: boolean }, own: { listed: boolean } | null | undefined): boolean {
  return own ? own.listed : sf.includeNewProducts
}

/** A storefront code: capitals, digits and dashes, 2–12 long ("Kids shop" → "KIDS-SHOP"). */
export function storefrontCode(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 12)
}

/** A web address as it's stored: host (and port) only, lower case, no scheme, path or "www.". */
export function cleanHostname(raw: string): string | null {
  let s = raw.trim().toLowerCase()
  if (!s) return null
  s = s.replace(/^[a-z]+:\/\//, "").split("/")[0] ?? ""
  s = s.replace(/^www\./, "")
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*(:\d{2,5})?$/.test(s)) return null
  return s
}

/** A promotion, coupon, delivery zone or staff member limited to some storefronts (empty: all). */
export function onStorefront(storefrontIds: readonly bigint[], storefrontId: bigint | null | undefined): boolean {
  return storefrontIds.length === 0 || (storefrontId != null && storefrontIds.includes(storefrontId))
}

/** Whether a storefront offers a payment method (an empty list: every enabled one). */
export function gatewayOffered(paymentGateways: readonly string[], code: string): boolean {
  return paymentGateways.length === 0 || paymentGateways.includes(code)
}

/**
 * The delivery zones a storefront uses among those matching an address: zones limited to it
 * when any match (its own delivery prices), otherwise the shared ones.
 */
export function storefrontZones<Z extends { storefrontIds: readonly bigint[] }>(zones: Z[], storefrontId: bigint | null | undefined): Z[] {
  const usable = zones.filter((z) => onStorefront(z.storefrontIds, storefrontId))
  const own = usable.filter((z) => z.storefrontIds.length > 0)
  return own.length ? own : usable
}
