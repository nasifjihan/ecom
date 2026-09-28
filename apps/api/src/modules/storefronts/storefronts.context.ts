/**
 * Which storefront a request is for. The tenant middleware (10-tenant.ts) sets ctx.storefrontId
 * from the web address (Domain.storefrontId), falling back to the store's default storefront;
 * services read the storefront's settings through storefrontInfo(), kept for a minute.
 */
import { prisma } from "../../config"

export interface StorefrontInfo {
  id: bigint
  code: string
  name: string
  isDefault: boolean
  priceAdjustPercent: number
  includeNewProducts: boolean
}

const TTL = 60_000
const byId = new Map<string, { sf: StorefrontInfo | null; until: number }>()
const defaults = new Map<string, { id: bigint; until: number }>()

const info = (r: {
  id: bigint
  code: string
  name: string
  isDefault: boolean
  priceAdjustPercent: { toString(): string }
  includeNewProducts: boolean
}): StorefrontInfo => ({
  id: r.id,
  code: r.code,
  name: r.name,
  isDefault: r.isDefault,
  priceAdjustPercent: Number(r.priceAdjustPercent),
  includeNewProducts: r.isDefault ? true : r.includeNewProducts,
})

/** Settings changed: drop what's kept for this store. */
export function forgetStorefronts(storeId: bigint) {
  defaults.delete(String(storeId))
  for (const k of byId.keys()) if (k.startsWith(`${storeId}:`)) byId.delete(k)
}

/** The store's default storefront (made on first use for a store that has none). */
export async function defaultStorefrontId(storeId: bigint): Promise<bigint> {
  const hit = defaults.get(String(storeId))
  if (hit && hit.until > Date.now()) return hit.id
  let row = await prisma.storefront.findFirst({
    where: { storeId, isDefault: true },
    orderBy: { id: "asc" },
    select: { id: true },
  })
  if (!row) {
    const first = await prisma.storefront.findFirst({ where: { storeId }, orderBy: { id: "asc" }, select: { id: true } })
    if (first) {
      row = await prisma.storefront.update({ where: { id: first.id }, data: { isDefault: true, isActive: true }, select: { id: true } })
    } else {
      const store = await prisma.store.findUnique({ where: { id: storeId }, select: { name: true } })
      row = await prisma.storefront.upsert({
        where: { storeId_code: { storeId, code: "MAIN" } },
        update: { isDefault: true },
        create: { storeId, name: store?.name ?? "Main", code: "MAIN", isDefault: true },
        select: { id: true },
      })
    }
  }
  defaults.set(String(storeId), { id: row.id, until: Date.now() + TTL })
  return row.id
}

/**
 * The storefront a request is for: the one its web address is linked to when that is open,
 * otherwise the default.
 */
export async function resolveStorefrontId(storeId: bigint, linked: bigint | null): Promise<bigint> {
  if (linked !== null) {
    const sf = await loadInfo(storeId, linked, true)
    if (sf) return sf.id
  }
  return defaultStorefrontId(storeId)
}

async function loadInfo(storeId: bigint, id: bigint, openOnly: boolean): Promise<StorefrontInfo | null> {
  const key = `${storeId}:${id}:${openOnly ? "open" : "any"}`
  const hit = byId.get(key)
  if (hit && hit.until > Date.now()) return hit.sf
  const row = await prisma.storefront.findFirst({ where: { id, storeId, ...(openOnly ? { isActive: true } : {}) } })
  const sf = row ? info(row) : null
  byId.set(key, { sf, until: Date.now() + TTL })
  return sf
}

/** Settings of the request's storefront (the default one when none was resolved). */
export async function storefrontInfo(storeId: bigint, id: bigint | undefined): Promise<StorefrontInfo> {
  const sfId = id ?? (await defaultStorefrontId(storeId))
  const sf = (await loadInfo(storeId, sfId, false)) ?? (await loadInfo(storeId, await defaultStorefrontId(storeId), false))
  if (!sf) throw new Error("storefront missing")
  return sf
}
