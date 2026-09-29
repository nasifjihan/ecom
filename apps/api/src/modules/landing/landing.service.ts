/**
 * LANDING PAGES — a page for one product at /lp/{slug}, for ads and Facebook posts: a hero, page
 * blocks, reviews and an order form (name, phone, address; cash on delivery) right on the page.
 * An offer price for the page is charged by the server (StorefrontService.quoteOrder unitPrices),
 * and orders remember their page, so each page shows its visits, orders and sales.
 */
import type { Prisma } from "@prisma/client"
import { createHmac } from "node:crypto"
import { env, prisma } from "../../config"
import { BadRequestError, ConflictError, NotFoundError, type RequestContext } from "../../core"
import { StorefrontService } from "../storefront/storefront.service"
import { emitOrderPlaced } from "../notifications"
import { creditOrder, salespersonByCode } from "../sales/commission.ledger"
import { recordMove } from "../redirects"
import { SectionDto } from "../content/content.dto"
import { bdMobile, conversion, offerActive, pagePrice, splitName, LANDING_SLUG } from "./landing.rules"

const WITH_PRODUCT = { product: { select: { id: true, name: true, slug: true, status: true, regularPrice: true } } } as const
type Row = Prisma.LandingPageGetPayload<{ include: typeof WITH_PRODUCT }>
const n = (v: Prisma.Decimal | null) => (v === null ? null : Number(v))
/** Trimmed text, or null when empty. */
const text = (v?: string | null) => {
  const t = v?.trim() ?? ""
  return t === "" ? null : t
}

export interface LandingInput {
  slug: string
  title: string
  status: "draft" | "published"
  productId: bigint
  headline: string
  subheadline?: string | null
  heroImageUrl?: string | null
  offerPrice?: number | null
  offerEndsAt?: string | null
  sections?: unknown[]
  showReviews?: boolean
  ctaText?: string
  formTitle?: string | null
  maxQty?: number
  seoTitle?: string | null
  metaDesc?: string | null
}

export interface LandingAddress {
  locationId?: bigint | null
  division?: string
  district: string
  upazila?: string
  addressLine1: string
}

export interface LandingOrderInput {
  name: string
  phone: string
  email?: string | null
  address: LandingAddress
  variantId?: bigint | null
  qty: number
  shippingMethodId: bigint
  note?: string | null
  salesCode?: string | null
}

export class LandingService {
  constructor(private readonly ctx: RequestContext) {}

  private get storeId(): bigint {
    if (this.ctx.storeId === undefined) throw new BadRequestError("No store for this request", "STORE_REQUIRED")
    return this.ctx.storeId
  }

  /** A private link to see a draft before publishing it. */
  previewToken(id: bigint): string {
    return createHmac("sha256", env.JWT_ADMIN_ACCESS_SECRET).update(`landing:${this.storeId}:${id}`).digest("hex").slice(0, 24)
  }

  // ================================================================ staff

  private adminView(r: Row, stats: { orders: number; sales: number }) {
    return {
      id: String(r.id),
      slug: r.slug,
      title: r.title,
      status: r.status,
      product: { id: String(r.product.id), name: r.product.name, slug: r.product.slug, published: r.product.status === "published", price: n(r.product.regularPrice) },
      headline: r.headline,
      subheadline: r.subheadline,
      heroImageUrl: r.heroImageUrl,
      offerPrice: n(r.offerPrice),
      offerEndsAt: r.offerEndsAt?.toISOString() ?? null,
      offerRunning: offerActive(n(r.offerPrice), r.offerEndsAt),
      sections: r.sections as unknown[],
      showReviews: r.showReviews,
      ctaText: r.ctaText,
      formTitle: r.formTitle,
      maxQty: r.maxQty,
      seoTitle: r.seoTitle,
      metaDesc: r.metaDesc,
      views: r.views,
      orders: stats.orders,
      sales: stats.sales,
      conversion: conversion(r.views, stats.orders),
      previewToken: this.previewToken(r.id),
      updatedAt: r.updatedAt.toISOString(),
    }
  }

  /** Orders and sales per page (cancelled and failed orders left out). */
  private async stats(ids: bigint[]) {
    if (!ids.length) return new Map<bigint, { orders: number; sales: number }>()
    const g = await prisma.order.groupBy({
      by: ["landingPageId"],
      where: { storeId: this.storeId, landingPageId: { in: ids }, status: { notIn: ["CANCELLED", "FAILED"] } },
      _count: { _all: true },
      _sum: { grandTotal: true },
    })
    return new Map(g.map((x) => [x.landingPageId!, { orders: x._count._all, sales: Number(x._sum.grandTotal ?? 0) }]))
  }

  async list() {
    const rows = await prisma.landingPage.findMany({
      where: { storeId: this.storeId },
      include: WITH_PRODUCT,
      orderBy: [{ updatedAt: "desc" }],
    })
    const stats = await this.stats(rows.map((r) => r.id))
    return rows.map((r) => this.adminView(r, stats.get(r.id) ?? { orders: 0, sales: 0 }))
  }

  private async row(id: bigint) {
    const r = await prisma.landingPage.findFirst({
      where: { id, storeId: this.storeId },
      include: WITH_PRODUCT,
    })
    if (!r) throw new NotFoundError("Landing page", String(id))
    return r
  }

  async get(id: bigint) {
    const r = await this.row(id)
    return this.adminView(r, (await this.stats([id])).get(id) ?? { orders: 0, sales: 0 })
  }

  private async data(d: LandingInput) {
    const slug = d.slug.trim().toLowerCase()
    if (!LANDING_SLUG.test(slug)) throw new BadRequestError("Use lowercase letters, numbers and dashes for the address", "VALIDATION_FAILED")
    const product = await prisma.product.findFirst({ where: { id: d.productId, storeId: this.storeId }, select: { id: true } })
    if (!product) throw new NotFoundError("Product", String(d.productId))
    const sections = SectionDto.array().max(20).safeParse(d.sections ?? [])
    if (!sections.success) throw new BadRequestError("One of the page blocks isn't complete", "VALIDATION_FAILED")
    return {
      slug,
      title: d.title.trim(),
      status: d.status,
      productId: d.productId,
      headline: d.headline.trim(),
      subheadline: text(d.subheadline),
      heroImageUrl: text(d.heroImageUrl),
      offerPrice: d.offerPrice ?? null,
      offerEndsAt: d.offerEndsAt ? new Date(d.offerEndsAt) : null,
      sections: sections.data as Prisma.InputJsonValue,
      showReviews: d.showReviews ?? true,
      ctaText: text(d.ctaText) ?? "Order now",
      formTitle: text(d.formTitle),
      maxQty: d.maxQty ?? 10,
      seoTitle: text(d.seoTitle),
      metaDesc: text(d.metaDesc),
    }
  }

  async create(d: LandingInput) {
    try {
      const r = await prisma.landingPage.create({ data: { storeId: this.storeId, ...(await this.data(d)) } })
      return this.get(r.id)
    } catch (e) {
      if ((e as { code?: string }).code === "P2002") throw new ConflictError("Another landing page uses that address")
      throw e
    }
  }

  async update(id: bigint, d: LandingInput) {
    const current = await this.row(id)
    const data = await this.data(d)
    try {
      await prisma.landingPage.update({ where: { id }, data })
    } catch (e) {
      if ((e as { code?: string }).code === "P2002") throw new ConflictError("Another landing page uses that address")
      throw e
    }
    // Ads already point at the old address: send them to the new one.
    if (data.slug !== current.slug) await recordMove(prisma, this.storeId, `/lp/${current.slug}`, `/lp/${data.slug}`)
    return this.get(id)
  }

  async remove(id: bigint) {
    await this.row(id)
    await prisma.landingPage.delete({ where: { id } })
  }

  // ================================================================ storefront

  /** A published page, or a draft with its preview key. */
  private async bySlug(slug: string, preview?: string | null) {
    const r = await prisma.landingPage.findFirst({
      where: { storeId: this.storeId, slug: slug.toLowerCase() },
      include: WITH_PRODUCT,
    })
    if (!r) throw new NotFoundError("Landing page")
    if (r.status !== "published" && preview !== this.previewToken(r.id)) throw new NotFoundError("Landing page")
    return r
  }

  async page(slug: string, preview?: string | null) {
    const r = await this.bySlug(slug, preview)
    const shop = new StorefrontService(this.ctx)
    const p = await shop.getProductBySlug(r.product.slug).catch(() => null)
    if (!p) throw new NotFoundError("Landing page")
    const offer = n(r.offerPrice)
    const running = offerActive(offer, r.offerEndsAt)
    const priced = (price: number, compareAt: number | null) => {
      const now = pagePrice(price, offer, r.offerEndsAt)
      return { price: now, compareAtPrice: now < price ? compareAt ?? price : compareAt }
    }
    const methods = await shop.paymentMethods()
    return {
      slug: r.slug,
      title: r.title,
      draft: r.status !== "published",
      headline: r.headline,
      subheadline: r.subheadline,
      heroImageUrl: r.heroImageUrl ?? p.images[0] ?? null,
      offer: { running, endsAt: running && r.offerEndsAt ? r.offerEndsAt.toISOString() : null },
      sections: r.sections as unknown[],
      ctaText: r.ctaText,
      formTitle: r.formTitle,
      maxQty: r.maxQty,
      seo: { title: r.seoTitle ?? r.title, description: r.metaDesc ?? r.subheadline ?? null },
      cashOnDelivery: methods.some((m) => m.code === "cod"),
      product: {
        id: p.id,
        slug: String(p.slug),
        name: String(p.title),
        images: p.images,
        rating: Number(p.rating),
        reviewCount: Number(p.reviewCount),
        inStock: !p.isOutOfStock,
        ...priced(p.price, p.compareAtPrice ?? null),
        variants: p.variants.map((v) => ({ id: v.id, label: v.label, inStock: v.inStock, ...priced(v.price, v.compareAtPrice ?? null) })),
      },
      reviews: r.showReviews ? p.reviews.slice(0, 6) : [],
    }
  }

  async view(slug: string) {
    await prisma.landingPage.updateMany({ where: { storeId: this.storeId, slug: slug.toLowerCase(), status: "published" }, data: { views: { increment: 1 } } })
  }

  private draft(r: Row, d: { variantId?: bigint | null; qty: number; address: LandingAddress; name?: string; phone?: string; email?: string | null; shippingMethodId?: bigint }, strict: boolean) {
    const qty = Math.min(Math.max(1, d.qty), r.maxQty)
    const offer = n(r.offerPrice)
    const { firstName, lastName } = splitName(d.name ?? "")
    return {
      strict,
      items: [{ productId: r.productId, variantId: d.variantId ?? undefined, qty }],
      email: d.email ?? null,
      shippingAddress: {
        firstName: firstName || "Customer",
        lastName,
        country: "BD",
        locationId: d.address.locationId ?? null,
        division: d.address.division ?? "",
        district: d.address.district,
        upazila: d.address.upazila ?? "",
        postcode: "",
        addressLine1: d.address.addressLine1 || "—",
        phone: d.phone ?? "",
      },
      billingSameAsShipping: true,
      delivery: d.shippingMethodId ? { methodId: d.shippingMethodId } : { pickup: true as const },
      listShippingOptions: true,
      paymentGateway: "cod",
      requireEnabledGateway: true,
      applyGatewayFee: true,
      customerId: this.ctx.customer?.id ?? null,
      // The page's offer: charged by the server, whatever the browser sends.
      unitPrices: offerActive(offer, r.offerEndsAt) ? new Map([[`${r.productId}:${d.variantId ?? ""}`, offer!]]) : undefined,
      unitPricesLowerOnly: true,
    }
  }

  /** What the order would cost for this option, quantity and address (delivery options included). */
  async quote(slug: string, d: { variantId?: bigint | null; qty: number; address: LandingAddress; shippingMethodId?: bigint }, preview?: string | null) {
    const r = await this.bySlug(slug, preview)
    const shop = new StorefrontService(this.ctx)
    const q = await shop.quoteOrder(this.draft(r, d, false))
    const line = q.quotedLines[0]
    return {
      unitPrice: line?.priced?.unitPrice ?? null,
      problem: line?.problem?.message ?? null,
      shippingOptions: q.shippingOptions.map((o) => ({ id: o.id, name: o.name, fee: o.fee, freeReason: o.freeReason, minDays: o.minDays, maxDays: o.maxDays })),
      totals: q.totals,
      problems: q.problems.filter((p) => !/delivery option/i.test(p)),
    }
  }

  async order(slug: string, d: LandingOrderInput, preview?: string | null) {
    const r = await this.bySlug(slug, preview)
    const phone = bdMobile(d.phone)
    if (!phone) throw new BadRequestError("Enter a mobile number like 01712345678", "VALIDATION_FAILED")
    if (splitName(d.name).firstName.length < 2) throw new BadRequestError("Enter your name", "VALIDATION_FAILED")
    const shop = new StorefrontService(this.ctx)
    const q = await shop.quoteOrder(this.draft(r, { ...d, phone }, true))
    const order = await shop.createOrder(q, {
      customerId: this.ctx.customer?.id ?? null,
      customerNote: d.note ?? null,
      source: "landing",
      landingPageId: r.id,
      historyNote: `Order placed on landing page /lp/${r.slug}`,
    })
    if (d.salesCode) {
      const sp = await salespersonByCode(prisma, this.storeId, d.salesCode).catch(() => null)
      if (sp) await creditOrder(prisma, this.storeId, order.id, sp).catch(() => undefined)
    }
    emitOrderPlaced({ storeId: String(this.storeId), orderId: String(order.id) })
    return { orderKey: order.orderKey, number: order.number, grandTotal: q.totals.grandTotal }
  }
}
