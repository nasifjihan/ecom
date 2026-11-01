/**
 * "Notify me when it's back": shoppers leave a phone or email on a sold-out product or option;
 * when stock comes back, each gets one SMS or email. Requests older than ALERT_DAYS lapse.
 */
import { prisma, logger } from "../../config"
import { BadRequestError, NotFoundError } from "../../core"
import { bdMobile } from "../sms/sms.rules"
import { skuKey } from "./stock.rules"

export const ALERT_DAYS = 90
/** Open requests one phone or email can have in a store (stops someone filling the list). */
export const MAX_OPEN_PER_CONTACT = 30

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** A Bangladeshi mobile (as 01XXXXXXXXX) or a lower-case email; null for anything else. */
export function contactOf(raw: string): string | null {
  const v = raw.trim()
  return bdMobile(v) ?? (EMAIL.test(v) && v.length <= 254 ? v.toLowerCase() : null)
}

const variantText = (values: unknown) =>
  values && typeof values === "object"
    ? Object.entries(values as Record<string, unknown>)
        .map(([k, v]) => `${k.charAt(0).toUpperCase()}${k.slice(1)}: ${String(v)}`)
        .join(", ")
    : null

export async function requestStockAlert(storeId: bigint, input: { productId: bigint; variantId?: bigint | null; contact: string; customerId?: bigint | null }) {
  const contact = contactOf(input.contact)
  if (!contact) throw new BadRequestError("Enter a mobile number (01XXXXXXXXX) or an email address", "VALIDATION_FAILED")
  const product = await prisma.product.findFirst({
    where: { id: input.productId, storeId, status: "published" },
    select: { id: true, variants: input.variantId ? { where: { id: input.variantId }, select: { id: true, attributeValues: true } } : false },
  })
  if (!product) throw new NotFoundError("Product")
  const variant = input.variantId ? product.variants?.[0] : null
  if (input.variantId && !variant) throw new NotFoundError("Option")
  const open = await prisma.stockAlert.count({ where: { storeId, contact, notifiedAt: null } })
  if (open >= MAX_OPEN_PER_CONTACT) throw new BadRequestError("You're already waiting for a lot of products here", "VALIDATION_FAILED")
  const key = skuKey(product.id, variant?.id ?? null)
  // Asking again after being told (or after it lapsed) starts a fresh request.
  await prisma.stockAlert.upsert({
    where: { storeId_skuKey_contact: { storeId, skuKey: key, contact } },
    create: { storeId, productId: product.id, variantId: variant?.id ?? null, skuKey: key, variantLabel: variant ? variantText(variant.attributeValues) : null, contact, customerId: input.customerId ?? null },
    update: { notifiedAt: null, createdAt: new Date(), customerId: input.customerId ?? undefined },
  })
  return { waiting: true, by: contact.includes("@") ? "email" : "sms" }
}

/**
 * Called by the stock ledger when an item goes from sold out to available. Waits a moment so the
 * stock change has been saved, then tells everyone waiting.
 * shortcut: an in-process timer, lost if the server stops in those seconds; the requests stay and go out on the next restock.
 */
export function scheduleBackInStock(storeId: bigint, productId: bigint, variantId: bigint | null) {
  setTimeout(() => {
    notifyBackInStock(storeId, productId, variantId).catch((err: unknown) => logger.error({ err, productId: String(productId) }, "Back-in-stock alerts failed"))
  }, 3000).unref?.()
}

export async function notifyBackInStock(storeId: bigint, productId: bigint, variantId: bigint | null) {
  const row = variantId
    ? await prisma.productVariant.findFirst({ where: { id: variantId, productId }, select: { stockQty: true, reservedStock: true } })
    : await prisma.product.findFirst({ where: { id: productId, storeId }, select: { stockQty: true, reservedStock: true } })
  if (!row || (row.stockQty ?? 0) - row.reservedStock <= 0) return 0
  const product = await prisma.product.findFirst({ where: { id: productId, storeId, status: "published" }, select: { name: true, slug: true } })
  if (!product) return 0
  // Claim the requests first (one timestamp), so two servers never send the same one twice.
  const at = new Date()
  const since = new Date(at.getTime() - ALERT_DAYS * 86_400_000)
  await prisma.stockAlert.updateMany({
    where: { storeId, skuKey: skuKey(productId, variantId), notifiedAt: null, createdAt: { gte: since } },
    data: { notifiedAt: at },
  })
  const claimed = await prisma.stockAlert.findMany({ where: { storeId, skuKey: skuKey(productId, variantId), notifiedAt: at } })
  if (!claimed.length) return 0
  const [{ EmailService }, { SmsService }] = await Promise.all([import("../notifications/notifications.service"), import("../sms/sms.service")])
  const email = new EmailService(storeId)
  const sms = new SmsService(storeId)
  const url = `${(await email.urls()).storefront}/products/${product.slug}`
  for (const a of claimed) {
    try {
      if (a.contact.includes("@")) await email.backInStock(a.contact, { name: product.name, option: a.variantLabel, url })
      else await sms.backInStock(a.contact, a.variantLabel ? `${product.name} (${a.variantLabel})` : product.name, url)
    } catch (err) {
      logger.error({ err, alertId: String(a.id) }, "Back-in-stock message failed")
    }
  }
  return claimed.length
}

/** Who is waiting for a product, by option (admin product page). */
export async function waitingFor(storeId: bigint, productId: bigint) {
  const since = new Date(Date.now() - ALERT_DAYS * 86_400_000)
  const rows = await prisma.stockAlert.findMany({
    where: { storeId, productId, notifiedAt: null, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    select: { id: true, variantLabel: true, contact: true, createdAt: true },
  })
  return rows.map((r) => ({ ...r, id: String(r.id) }))
}

/** Products with the most shoppers waiting (inventory page: what to restock). */
export async function mostWanted(storeId: bigint, take = 10) {
  const since = new Date(Date.now() - ALERT_DAYS * 86_400_000)
  const groups = await prisma.stockAlert.groupBy({
    by: ["productId", "variantLabel"],
    where: { storeId, notifiedAt: null, createdAt: { gte: since } },
    _count: { _all: true },
    orderBy: { _count: { productId: "desc" } },
    take,
  })
  const names = await prisma.product.findMany({ where: { id: { in: groups.map((g) => g.productId) } }, select: { id: true, name: true } })
  return groups.map((g) => ({
    productId: String(g.productId),
    productName: names.find((n) => n.id === g.productId)?.name ?? "",
    option: g.variantLabel,
    waiting: g._count._all,
  }))
}
