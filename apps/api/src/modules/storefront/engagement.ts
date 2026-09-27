/**
 * STOREFRONT EXTRAS — search suggestions and the search-terms record, public order tracking,
 * the wishlist, the flash-sale page, and reviews and questions customers send from product pages.
 */
import type { Prisma } from "@prisma/client"
import { logger, prisma } from "../../config"
import {
  BadRequestError,
  ConflictError,
  HttpError,
  NotFoundError,
  RateLimitError,
  UnauthorizedError,
  type RequestContext,
} from "../../core"
import { bdMobile, phoneVariants } from "../sms/sms.rules"
import { flashRules } from "./flash-pricing"
import { StorefrontService } from "./storefront.service"
import {
  publicName,
  searchTerm,
  SUGGEST_MIN_SEARCHES,
  TRACK_STEPS,
  trackStep,
} from "./engagement.rules"

const num = (v: Prisma.Decimal | number | null | undefined) =>
  v === null || v === undefined ? 0 : Number(v)

/** Keeps a product's rating and review count in line with its approved reviews. */
export async function refreshProductRating(
  productId: bigint,
  t: Prisma.TransactionClient = prisma,
) {
  const agg = await t.review.aggregate({
    where: { productId, status: "approved" },
    _avg: { rating: true },
    _count: true,
  })
  await t.product.update({
    where: { id: productId },
    data: {
      reviewCount: agg._count,
      averageRating: Math.round(Number(agg._avg.rating ?? 0) * 100) / 100,
    },
  })
}

export class StorefrontEngagement {
  constructor(private readonly ctx: RequestContext) {}

  private get storeId(): bigint {
    if (this.ctx.storeId === undefined)
      throw new BadRequestError("No store for this request", "TENANT_NOT_RESOLVED")
    return this.ctx.storeId
  }

  private get customerId(): bigint {
    const id = this.ctx.customer?.id
    if (!id) throw new UnauthorizedError("Please log in first")
    return BigInt(id)
  }

  private catalog() {
    return new StorefrontService(this.ctx)
  }

  // ================================================================ search

  /** Counts a search (first page only, so paging through results isn't counted twice). */
  async recordSearch(raw: string, results: number) {
    const term = searchTerm(raw)
    if (!term) return
    try {
      await prisma.searchTerm.upsert({
        where: { storeId_term: { storeId: this.storeId, term } },
        create: { storeId: this.storeId, term, results },
        update: { searches: { increment: 1 }, results, lastSearchedAt: new Date() },
      })
    } catch (err) {
      logger.debug({ err }, "Couldn't record a search term")
    }
  }

  /** As-you-type: matching products, categories and terms other customers searched. */
  async suggest(raw: string) {
    const q = raw.trim()
    if (q.length < 2) return { products: [], categories: [], terms: [] }
    const lower = q.toLowerCase()
    const [products, categories, terms] = await Promise.all([
      prisma.product.findMany({
        where: {
          storeId: this.storeId,
          status: "published",
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { sku: { equals: q, mode: "insensitive" } },
            { tags: { has: lower } },
          ],
        },
        orderBy: [{ saleCount: "desc" }, { id: "desc" }],
        take: 6,
        select: { id: true },
      }),
      prisma.category.findMany({
        where: {
          storeId: this.storeId,
          isActive: true,
          name: { contains: q, mode: "insensitive" },
        },
        take: 4,
        select: { name: true, slug: true },
      }),
      prisma.searchTerm.findMany({
        where: {
          storeId: this.storeId,
          term: { startsWith: lower },
          searches: { gte: SUGGEST_MIN_SEARCHES },
          results: { gt: 0 },
        },
        orderBy: { searches: "desc" },
        take: 5,
        select: { term: true },
      }),
    ])
    const cards = await this.catalog().productSummaries(products.map((p) => p.id))
    return {
      products: cards.map((c) => ({
        id: c.id,
        slug: String(c.slug),
        title: String(c.title),
        image: c.image,
        price: c.price,
        compareAtPrice: c.compareAtPrice,
      })),
      categories,
      terms: terms.map((t) => t.term),
    }
  }

  /** What customers search most (and the shop has products for). */
  async popularSearches() {
    const rows = await prisma.searchTerm.findMany({
      where: { storeId: this.storeId, searches: { gte: SUGGEST_MIN_SEARCHES }, results: { gt: 0 } },
      orderBy: [{ searches: "desc" }, { lastSearchedAt: "desc" }],
      take: 10,
      select: { term: true },
    })
    return rows.map((r) => r.term)
  }

  // ================================================================ tracking

  /**
   * Public order tracking by order number + the phone on the order. Shows progress and parcels,
   * never the address or other personal details. A wrong pair and a missing order answer alike.
   */
  async track(number: string, rawPhone: string) {
    const phone = bdMobile(rawPhone)
    const notFound = new HttpError(
      "We couldn't find an order with that number and phone. Check both and try again.",
      404,
      "NOT_FOUND",
    )
    if (!phone) throw notFound
    const variants = phoneVariants(phone)
    const o = await prisma.order.findFirst({
      where: {
        storeId: this.storeId,
        number: number.trim().replace(/^#/, ""),
        OR: [{ shippingPhone: { in: variants } }, { billingPhone: { in: variants } }],
      },
      include: {
        items: {
          select: {
            productName: true,
            variantValues: true,
            quantity: true,
            imageUrl: true,
            meta: true,
          },
        },
        statusHistory: { orderBy: { createdAt: "asc" }, select: { status: true, createdAt: true } },
        shipments: {
          orderBy: { createdAt: "asc" },
          select: {
            code: true,
            status: true,
            providerName: true,
            trackingNumber: true,
            trackingUrl: true,
            updatedAt: true,
            deliveredAt: true,
          },
        },
      },
    })
    if (!o) throw notFound
    const reached = trackStep(o.status)
    const firstAt = (status: string) =>
      o.statusHistory.find((h) => h.status === status)?.createdAt.toISOString() ?? null
    return {
      number: o.number,
      status: o.status,
      placedAt: o.createdAt.toISOString(),
      paymentStatus: o.paymentStatus,
      total: num(o.grandTotal),
      /** -1 when the order was cancelled, refunded or failed. */
      step: reached,
      steps: TRACK_STEPS.map((s, i) => ({
        label: s.label,
        done: i === 0 || reached >= i,
        at:
          i === 0
            ? o.createdAt.toISOString()
            : (firstAt(s.status) ?? (s.status === "DELIVERED" ? firstAt("COMPLETED") : null)),
      })),
      items: o.items.map((i) => ({
        title: i.productName,
        option: i.variantValues
          ? Object.values(i.variantValues as Record<string, string>).join(" / ")
          : null,
        qty: i.quantity,
        image: i.imageUrl,
        gift: !!(i.meta as { gift?: unknown } | null)?.gift,
      })),
      parcels: o.shipments.map((s) => ({
        code: s.code,
        status: s.status,
        courier: s.providerName,
        trackingNumber: s.trackingNumber,
        trackingUrl: s.trackingUrl,
        updatedAt: s.updatedAt.toISOString(),
      })),
    }
  }

  // ================================================================ wishlist

  async wishlist() {
    const rows = await prisma.wishlistItem.findMany({
      where: { customerId: this.customerId, product: { storeId: this.storeId } },
      orderBy: { createdAt: "desc" },
      select: { productId: true, createdAt: true },
    })
    const cards = await this.catalog().productSummaries(rows.map((r) => r.productId))
    return cards
  }

  async wishlistIds() {
    const rows = await prisma.wishlistItem.findMany({
      where: { customerId: this.customerId, product: { storeId: this.storeId } },
      select: { productId: true },
    })
    return rows.map((r) => String(r.productId))
  }

  /** Adds products (e.g. the ones saved before logging in); ones already there are skipped. */
  async addToWishlist(productIds: bigint[]) {
    const products = await prisma.product.findMany({
      where: { storeId: this.storeId, id: { in: productIds }, status: "published" },
      select: { id: true },
    })
    const have = new Set((await this.wishlistIds()).map((id) => BigInt(id)))
    const add = products.filter((p) => !have.has(p.id))
    if (add.length) {
      await prisma.wishlistItem.createMany({
        data: add.map((p) => ({ customerId: this.customerId, productId: p.id })),
      })
    }
    return this.wishlistIds()
  }

  async removeFromWishlist(productId: bigint) {
    await prisma.wishlistItem.deleteMany({ where: { customerId: this.customerId, productId } })
    return this.wishlistIds()
  }

  // ================================================================ flash sales

  /** Running flash sales with their products, for the /flash-sale page. */
  async flashSales() {
    const now = new Date()
    const sales = await prisma.flashSale.findMany({
      where: { storeId: this.storeId, isActive: true, startsAt: { lte: now }, endsAt: { gt: now } },
      include: { items: { select: { productId: true } } },
      orderBy: [{ position: "asc" }, { endsAt: "asc" }],
    })
    const out = []
    for (const s of sales) {
      const rules = flashRules(s.rules)
      let ids: bigint[]
      if (rules.appliesTo === "products") {
        ids = [...new Set(s.items.map((i) => i.productId))]
      } else {
        const where: Prisma.ProductWhereInput = { storeId: this.storeId, status: "published" }
        if (rules.appliesTo === "categories") {
          const cats = await prisma.category.findMany({
            where: { storeId: this.storeId },
            select: { id: true, parentId: true },
          })
          const set = new Set(rules.categoryIds)
          let grew = true
          while (grew) {
            grew = false
            for (const c of cats) {
              if (c.parentId !== null && set.has(String(c.parentId)) && !set.has(String(c.id))) {
                set.add(String(c.id))
                grew = true
              }
            }
          }
          where.categories = { some: { categoryId: { in: [...set].map((x) => BigInt(x)) } } }
        }
        ids = (
          await prisma.product.findMany({
            where,
            orderBy: [{ saleCount: "desc" }, { id: "desc" }],
            take: 60,
            select: { id: true },
          })
        ).map((p) => p.id)
      }
      // Only products that actually get this sale's price right now (not sold out, not excluded).
      const cards = (await this.catalog().productSummaries(ids)).filter(
        (c) => c.flashSale?.slug === s.slug,
      )
      if (!cards.length) continue
      out.push({
        name: s.name,
        slug: s.slug,
        description: s.description,
        endsAt: s.endsAt.toISOString(),
        banner: s.bannerImageUrl
          ? {
              image: s.bannerImageUrl,
              title: s.bannerTitle,
              subtitle: s.bannerSubtitle,
              ctaText: s.bannerCtaText,
              ctaUrl: s.bannerCtaUrl,
            }
          : null,
        products: cards,
      })
    }
    return out
  }

  // ================================================================ reviews

  /**
   * A signed-in customer's review. A customer who received the product in a delivered order is a
   * verified buyer and the review shows at once; others wait for the shop to approve it.
   */
  async submitReview(productId: bigint, dto: { rating: number; title?: string; body?: string }) {
    const customerId = this.customerId
    const product = await prisma.product.findFirst({
      where: { id: productId, storeId: this.storeId, status: "published" },
      select: { id: true, allowReviews: true },
    })
    if (!product) throw new NotFoundError("Product")
    if (!product.allowReviews)
      throw new BadRequestError("Reviews are turned off for this product", "VALIDATION_FAILED")
    const existing = await prisma.review.findFirst({
      where: { storeId: this.storeId, productId, customerId },
    })
    if (existing)
      throw new ConflictError("You've already reviewed this product", "DUPLICATE_REVIEW")
    const order = await prisma.order.findFirst({
      where: {
        storeId: this.storeId,
        customerId,
        status: { in: ["DELIVERED", "COMPLETED"] },
        items: { some: { productId } },
      },
      orderBy: { id: "desc" },
      select: { id: true },
    })
    const verified = !!order
    const review = await prisma.$transaction(async (t) => {
      const r = await t.review.create({
        data: {
          storeId: this.storeId,
          productId,
          customerId,
          orderId: order?.id ?? null,
          rating: dto.rating,
          title: dto.title?.trim() ? dto.title.trim() : null,
          body: dto.body?.trim() ? dto.body.trim() : null,
          status: verified ? "approved" : "pending",
          verified,
        },
      })
      await refreshProductRating(productId, t)
      return r
    })
    return { id: String(review.id), status: review.status, verified }
  }

  /** The signed-in customer's review of a product, if any (so the page can say it's waiting). */
  async myReview(productId: bigint) {
    const r = await prisma.review.findFirst({
      where: { storeId: this.storeId, productId, customerId: this.customerId },
      select: { id: true, rating: true, status: true, createdAt: true },
    })
    return r
      ? {
          id: String(r.id),
          rating: r.rating,
          status: r.status,
          createdAt: r.createdAt.toISOString(),
        }
      : null
  }

  // ================================================================ questions

  /** Anyone can ask; it shows once the shop answers and publishes it. Max 5 an hour per visitor. */
  async askQuestion(productId: bigint, dto: { name?: string; question: string }) {
    const product = await prisma.product.findFirst({
      where: { id: productId, storeId: this.storeId, status: "published" },
      select: { id: true },
    })
    if (!product) throw new NotFoundError("Product")
    const ip = this.ctx.ip ?? null
    if (ip) {
      const recent = await prisma.productQuestion.count({
        where: { storeId: this.storeId, ip, createdAt: { gt: new Date(Date.now() - 3600_000) } },
      })
      if (recent >= 5)
        throw new RateLimitError(
          "You've asked a lot of questions just now. Please try again later.",
        )
    }
    const customerId = this.ctx.customer?.id ? BigInt(this.ctx.customer.id) : null
    let name = dto.name?.trim() ?? ""
    if (!name && customerId) {
      const c = await prisma.customer.findUnique({
        where: { id: customerId },
        select: { firstName: true, lastName: true },
      })
      name = publicName(c?.firstName, c?.lastName)
    }
    const q = await prisma.productQuestion.create({
      data: {
        storeId: this.storeId,
        productId,
        customerId,
        name: name || "Customer",
        question: dto.question.trim(),
        ip,
      },
    })
    return { id: String(q.id), status: q.status }
  }

  /** Published questions and answers for a product page. */
  async questions(productId: bigint) {
    const rows = await prisma.productQuestion.findMany({
      where: { storeId: this.storeId, productId, status: "published", answer: { not: null } },
      orderBy: { answeredAt: "desc" },
      take: 30,
    })
    return rows.map((r) => ({
      id: String(r.id),
      name: r.name,
      question: r.question,
      answer: r.answer!,
      askedAt: r.createdAt.toISOString(),
      answeredAt: r.answeredAt?.toISOString() ?? null,
    }))
  }
}
