/**
 * WHOLESALE CONTEXT — what checkout and the storefront need to know: whether a customer buys at
 * business prices, and the bulk price tiers of some products.
 */
import { prisma } from "../../config"
import type { Tier } from "./wholesale.rules"

export interface WholesaleSettingsView {
  enabled: boolean
  autoApprove: boolean
  intro: string | null
}

/** The store's wholesale settings (defaults — off — until they're saved). */
export async function wholesaleSettings(storeId: bigint): Promise<WholesaleSettingsView> {
  const row = await prisma.wholesaleSettings.findUnique({ where: { storeId } })
  return { enabled: row?.enabled ?? false, autoApprove: row?.autoApprove ?? false, intro: row?.intro ?? null }
}

/** True when the store sells to businesses and this customer's business account is approved. */
export async function isBusinessBuyer(storeId: bigint, customerId: bigint | null | undefined): Promise<boolean> {
  if (!customerId) return false
  const [settings, account] = await Promise.all([
    wholesaleSettings(storeId),
    prisma.businessAccount.findFirst({ where: { storeId, customerId }, select: { status: true } }),
  ])
  return settings.enabled && account?.status === "APPROVED"
}

/** Bulk price tiers of these products, by product id. */
export async function tiersByProduct(storeId: bigint, productIds: bigint[]): Promise<Map<bigint, Tier[]>> {
  const out = new Map<bigint, Tier[]>()
  if (!productIds.length) return out
  const rows = await prisma.priceTier.findMany({
    where: { storeId, productId: { in: productIds } },
    orderBy: [{ minQty: "asc" }, { id: "asc" }],
    select: { productId: true, variantId: true, minQty: true, price: true, forEveryone: true },
  })
  for (const r of rows) {
    const list = out.get(r.productId) ?? []
    list.push({ variantId: r.variantId, minQty: r.minQty, price: r.price, forEveryone: r.forEveryone })
    out.set(r.productId, list)
  }
  return out
}
