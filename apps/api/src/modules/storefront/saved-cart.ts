/**
 * Carts kept on the server, so a signed-in shopper sees the same cart on every device and a
 * shopper who typed a phone or email at checkout can be reminded about it. Lines are the product,
 * option and quantity; prices are always worked out again by the shop. Gift boxes stay in the
 * browser only.
 */
import { randomBytes } from "node:crypto"
import { prisma } from "../../config"
import { NotFoundError, type RequestContext } from "../../core"
import { bdMobile } from "../sms/sms.rules"
import { StorefrontService } from "./storefront.service"

export interface SavedLine {
  productId: bigint
  variantId: bigint | null
  qty: number
}

export const MAX_SAVED_LINES = 100

const keyOf = (l: { productId: bigint | string; variantId?: bigint | string | null }) => `${l.productId}:${l.variantId ?? ""}`

/**
 * Two carts joined (signing in with a cart already in the browser): every item once, at the larger
 * quantity, so nothing is doubled. The first cart's order comes first.
 */
export function mergeLines(a: SavedLine[], b: SavedLine[]): SavedLine[] {
  const out = new Map<string, SavedLine>()
  for (const l of [...a, ...b]) {
    const k = keyOf(l)
    const had = out.get(k)
    out.set(k, had ? { ...had, qty: Math.max(had.qty, l.qty) } : { ...l })
  }
  return [...out.values()].slice(0, MAX_SAVED_LINES)
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
export const newCartToken = () => `cart_${randomBytes(18).toString("base64url")}`

export class SavedCarts {
  constructor(private readonly ctx: RequestContext) {}

  private get storeId() {
    return BigInt(this.ctx.storeId!)
  }

  /** The open (not yet ordered) cart for this shopper: their account's, else the browser's token. */
  private async find(token?: string | null) {
    const open = { storeId: this.storeId, orderedAt: null }
    const customerId = this.ctx.customer?.id
    if (customerId) {
      const mine = await prisma.cart.findFirst({ where: { ...open, customerId }, orderBy: { lastActivityAt: "desc" } })
      if (mine) return mine
    }
    if (!token) return null
    // A guest's cart, or this customer's own; never another customer's.
    return prisma.cart.findFirst({ where: { ...open, token, OR: [{ customerId: null }, ...(customerId ? [{ customerId }] : [])] } })
  }

  /** Only this store's published products, at most MAX_SAVED_LINES, each once. */
  private async clean(lines: SavedLine[]) {
    const merged = mergeLines(lines, [])
    const ok = await prisma.product.findMany({ where: { storeId: this.storeId, status: "published", id: { in: merged.map((l) => l.productId) } }, select: { id: true } })
    const ids = new Set(ok.map((p) => p.id))
    return merged.filter((l) => ids.has(l.productId))
  }

  /**
   * Saves the cart. A guest's cart is kept only once there's someone to remind (a phone or email
   * typed at checkout); a signed-in customer's always is.
   */
  async save(input: { token?: string | null; lines: SavedLine[]; contact?: { phone?: string | null; email?: string | null; firstName?: string | null } }) {
    const phone = bdMobile(input.contact?.phone ?? "") ?? undefined
    const email = input.contact?.email && EMAIL.test(input.contact.email) ? input.contact.email.trim().toLowerCase() : undefined
    const customerId = this.ctx.customer?.id ?? null
    const lines = await this.clean(input.lines)
    let cart = await this.find(input.token)
    if (!cart) {
      if (!customerId && !phone && !email) return { token: null }
      if (!lines.length) return { token: null }
      cart = await prisma.cart.create({ data: { storeId: this.storeId, token: newCartToken(), customerId, currencyCode: "BDT" } })
    }
    const prices = lines.length ? await new StorefrontService(this.ctx).cartPrices(lines.map((l) => ({ ...l, variantId: l.variantId ?? undefined }))) : { items: [] }
    const priceOf = (l: SavedLine) => prices.items.find((p) => p.productId === String(l.productId) && (p.variantId ?? "") === String(l.variantId ?? ""))?.price ?? 0
    await prisma.$transaction([
      prisma.cartItem.deleteMany({ where: { cartId: cart.id } }),
      prisma.cartItem.createMany({
        data: lines.map((l) => ({ cartId: cart!.id, productId: l.productId, variantId: l.variantId, quantity: l.qty, unitPrice: priceOf(l), lineTotal: priceOf(l) * l.qty })),
      }),
      prisma.cart.update({
        where: { id: cart.id },
        data: {
          lastActivityAt: new Date(),
          ...(customerId && !cart.customerId ? { customerId } : {}),
          ...(phone ? { phone } : {}),
          ...(email ? { email } : {}),
          ...(input.contact?.firstName?.trim() ? { firstName: input.contact.firstName.trim().slice(0, 80) } : {}),
        },
      }),
    ])
    return { token: cart.token }
  }

  /** The saved cart's items, with what the shop shows for them (a signed-in customer's, else the token's). */
  async load(token?: string | null) {
    const cart = await this.find(token)
    if (!cart) return { token: null, items: [] }
    return { token: cart.token, items: await itemsOf(cart.id) }
  }

  /**
   * Signing in with a cart in the browser: the account's saved cart and the browser's are joined
   * into the account's (the browser's guest cart, if saved, moves over).
   */
  async join(token: string | null | undefined, browser: SavedLine[]) {
    const customerId = this.ctx.customer?.id
    if (!customerId) return this.load(token)
    const mine = await prisma.cart.findFirst({ where: { storeId: this.storeId, orderedAt: null, customerId }, orderBy: { lastActivityAt: "desc" } })
    const guest = token ? await prisma.cart.findFirst({ where: { storeId: this.storeId, orderedAt: null, token, customerId: null } }) : null
    const saved = mine ? await linesOf(mine.id) : []
    const fromGuest = guest ? await linesOf(guest.id) : []
    const lines = mergeLines(mergeLines(saved, fromGuest), browser)
    if (guest && mine) await prisma.cart.delete({ where: { id: guest.id } })
    else if (guest) await prisma.cart.update({ where: { id: guest.id }, data: { customerId } })
    const r = await this.save({ token: (mine ?? guest)?.token, lines })
    return this.load(r.token)
  }

  /** "Back to your cart" from a reminder: the items, and the cart's token so it stays the same cart. */
  async recover(recoveryToken: string) {
    const a = await prisma.abandonedCart.findFirst({ where: { storeId: this.storeId, recoveryToken }, select: { cart: { select: { id: true, token: true, orderedAt: true } } } })
    if (!a) throw new NotFoundError("Cart")
    await prisma.cart.update({ where: { id: a.cart.id }, data: { lastActivityAt: new Date() } })
    return { token: a.cart.orderedAt ? null : a.cart.token, items: await itemsOf(a.cart.id) }
  }

  /** "No more cart reminders" from a reminder's link. */
  async unsubscribe(recoveryToken: string) {
    const a = await prisma.abandonedCart.findFirst({ where: { storeId: this.storeId, recoveryToken }, select: { phone: true, customerEmail: true } })
    if (!a) throw new NotFoundError("Cart")
    for (const contact of [a.phone, a.customerEmail].filter((c): c is string => !!c))
      await prisma.reminderOptOut.upsert({ where: { storeId_contact: { storeId: this.storeId, contact } }, create: { storeId: this.storeId, contact }, update: {} })
    return { unsubscribed: true }
  }
}

async function linesOf(cartId: bigint): Promise<SavedLine[]> {
  const rows = await prisma.cartItem.findMany({ where: { cartId }, orderBy: { id: "asc" }, select: { productId: true, variantId: true, quantity: true } })
  return rows.map((r) => ({ productId: r.productId, variantId: r.variantId, qty: r.quantity }))
}

async function itemsOf(cartId: bigint) {
  const rows = await prisma.cartItem.findMany({
    where: { cartId, product: { status: "published" } },
    orderBy: { id: "asc" },
    include: {
      product: { select: { name: true, slug: true, weight: true, images: { orderBy: { sortOrder: "asc" }, take: 1, select: { imageUrl: true } } } },
      variant: { select: { attributeValues: true, imageUrl: true, weight: true } },
    },
  })
  return rows.map((r) => ({
    productId: String(r.productId),
    variantId: r.variantId ? String(r.variantId) : null,
    qty: r.quantity,
    title: r.product.name,
    slug: r.product.slug,
    image: r.variant?.imageUrl ?? r.product.images[0]?.imageUrl ?? "",
    price: Number(r.unitPrice),
    weightKG: Number(r.variant?.weight ?? r.product.weight ?? 0),
    variantLabel: r.variant?.attributeValues
      ? Object.entries(r.variant.attributeValues as Record<string, unknown>)
          .map(([k, v]) => `${k.charAt(0).toUpperCase()}${k.slice(1)}: ${String(v)}`)
          .join(" • ")
      : undefined,
  }))
}

/**
 * An order was placed: its cart stops counting as abandoned, and a reminded cart of the same
 * shopper (account, phone or email) in the last week counts as recovered by this order.
 */
export async function markOrdered(storeId: bigint, o: { orderId: bigint; cartToken?: string | null; customerId?: bigint | null; phone?: string | null; email?: string | null }) {
  const phone = bdMobile(o.phone ?? "") ?? undefined
  const email = o.email?.trim().toLowerCase() || undefined
  const who = [
    ...(o.cartToken ? [{ token: o.cartToken }] : []),
    ...(o.customerId ? [{ customerId: o.customerId }] : []),
    ...(phone ? [{ phone }] : []),
    ...(email ? [{ email }] : []),
  ]
  if (!who.length) return
  const now = new Date()
  const since = new Date(now.getTime() - 7 * 86_400_000)
  const carts = await prisma.cart.findMany({ where: { storeId, orderedAt: null, OR: who }, select: { id: true } })
  if (!carts.length) return
  const ids = carts.map((c) => c.id)
  await prisma.$transaction([
    prisma.cart.updateMany({ where: { id: { in: ids } }, data: { orderedAt: now, orderId: o.orderId } }),
    prisma.abandonedCart.updateMany({
      where: { storeId, cartId: { in: ids }, recoveredAt: null, reminderSentAt: { gte: since } },
      data: { recoveredAt: now, recoveredOrderId: o.orderId },
    }),
  ])
}
