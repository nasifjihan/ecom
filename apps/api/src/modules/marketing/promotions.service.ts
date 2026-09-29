/**
 * PROMOTIONS — automatic offers the store runs without a code. Admin CRUD, the live rules checkout
 * prices with (StorefrontService.quoteOrder), and what the storefront shows in each display slot.
 */
import type { Prisma, Promotion } from "@prisma/client"
import { prisma } from "../../config"
import { BadRequestError, NotFoundError, type RequestContext } from "../../core"
import { checkStorefrontIds } from "../storefronts/storefronts.context"
import {
  promotionProblems,
  type CreatePromotionDto,
  type PromotionListQuery,
  type SlotQuery,
  type UpdatePromotionDto,
} from "./promotions.dto"
import {
  describePromotion,
  promotionState,
  type PromoRule,
  type PromotionType,
} from "./promotions.rules"

const num = (v: Prisma.Decimal | number | null | undefined) =>
  v === null || v === undefined ? null : Number(v)

interface GiftInfo {
  name: string
  imageUrl: string | null
}

/** A stored promotion as the rules engine sees it. */
export function toRule(p: Promotion, gift?: GiftInfo | null): PromoRule {
  return {
    id: String(p.id),
    name: p.name,
    type: p.type as PromotionType,
    discountType: (p.discountType as "percentage" | "fixed" | null) ?? null,
    discountValue: num(p.discountValue),
    maxDiscount: num(p.maxDiscount),
    minOrder: num(p.minOrder),
    minQty: p.minQty,
    productIds: p.productIds.map(String),
    categoryIds: p.categoryIds.map(String),
    includeSaleItems: p.includeSaleItems,
    buyQty: p.buyQty,
    getQty: p.getQty,
    gift: p.giftProductId
      ? {
          productId: String(p.giftProductId),
          variantId: p.giftVariantId ? String(p.giftVariantId) : null,
          qty: p.giftQty,
          name: gift?.name,
        }
      : null,
  }
}

/** Running promotions; with `storefrontId`, only those shown on that storefront. */
const liveWhere = (storeId: bigint, now: Date, storefrontId?: bigint): Prisma.PromotionWhereInput => ({
  storeId,
  isActive: true,
  OR: [{ startsAt: null }, { startsAt: { lte: now } }],
  AND: [
    { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
    ...(storefrontId === undefined ? [] : [{ OR: [{ storefrontIds: { isEmpty: true } }, { storefrontIds: { has: storefrontId } }] }]),
  ],
})

/** Gift product names (with the option) and pictures, by promotion id. */
async function giftInfo(rows: Promotion[]): Promise<Map<bigint, GiftInfo>> {
  const withGift = rows.filter((r) => r.giftProductId)
  if (!withGift.length) return new Map()
  const products = await prisma.product.findMany({
    where: { id: { in: withGift.map((r) => r.giftProductId!) } },
    select: {
      id: true,
      name: true,
      images: { orderBy: { sortOrder: "asc" }, take: 1, select: { imageUrl: true } },
      variants: { select: { id: true, attributeValues: true, imageUrl: true } },
    },
  })
  const out = new Map<bigint, GiftInfo>()
  for (const r of withGift) {
    const p = products.find((x) => x.id === r.giftProductId)
    if (!p) continue
    const v = r.giftVariantId ? p.variants.find((x) => x.id === r.giftVariantId) : null
    const opt =
      v?.attributeValues && typeof v.attributeValues === "object"
        ? Object.values(v.attributeValues as Record<string, string>).join(" / ")
        : ""
    out.set(r.id, {
      name: opt ? `${p.name} (${opt})` : p.name,
      imageUrl: v?.imageUrl ?? p.images[0]?.imageUrl ?? null,
    })
  }
  return out
}

/**
 * A lookup from a category to it and every parent above it, so an offer on "Men" covers products
 * filed under "Men > Shirts".
 */
export async function categoryLineage(storeId: bigint): Promise<(ids: bigint[]) => string[]> {
  const rows = await prisma.category.findMany({
    where: { storeId },
    select: { id: true, parentId: true },
  })
  const parent = new Map(rows.map((r) => [r.id, r.parentId]))
  return (ids) => {
    const out = new Set<string>()
    for (const id of ids) {
      let cur: bigint | null | undefined = id
      for (let depth = 0; cur && depth < 20 && !out.has(String(cur)); depth++) {
        out.add(String(cur))
        cur = parent.get(cur)
      }
    }
    return [...out]
  }
}

/** Live promotions as engine rules, for pricing an order. */
export async function livePromotionRules(storeId: bigint, now = new Date(), storefrontId?: bigint): Promise<PromoRule[]> {
  const rows = await prisma.promotion.findMany({
    where: liveWhere(storeId, now, storefrontId),
    orderBy: { id: "asc" },
  })
  const gifts = await giftInfo(rows)
  return rows.map((r) => toRule(r, gifts.get(r.id)))
}

export class PromotionsService {
  constructor(private readonly ctx: RequestContext) {}

  private get storeId(): bigint {
    if (this.ctx.storeId === undefined)
      throw new BadRequestError("No store for this request", "STORE_REQUIRED")
    return this.ctx.storeId
  }

  private async view(rows: Promotion[]) {
    const gifts = await giftInfo(rows)
    const now = new Date()
    return rows.map((p) => ({
      id: String(p.id),
      name: p.name,
      type: p.type,
      summary: describePromotion(toRule(p, gifts.get(p.id))),
      state: promotionState(p, now),
      discountType: p.discountType,
      discountValue: num(p.discountValue),
      maxDiscount: num(p.maxDiscount),
      minOrder: num(p.minOrder),
      minQty: p.minQty,
      productIds: p.productIds.map(String),
      categoryIds: p.categoryIds.map(String),
      includeSaleItems: p.includeSaleItems,
      buyQty: p.buyQty,
      getQty: p.getQty,
      giftProductId: p.giftProductId ? String(p.giftProductId) : null,
      giftVariantId: p.giftVariantId ? String(p.giftVariantId) : null,
      giftQty: p.giftQty,
      gift: gifts.get(p.id) ?? null,
      slots: p.slots,
      storefrontIds: p.storefrontIds.map(String),
      headline: p.headline,
      message: p.message,
      imageUrl: p.imageUrl,
      linkUrl: p.linkUrl,
      startsAt: p.startsAt?.toISOString() ?? null,
      endsAt: p.endsAt?.toISOString() ?? null,
      isActive: p.isActive,
      usedCount: p.usedCount,
      createdAt: p.createdAt.toISOString(),
    }))
  }

  async list(q: PromotionListQuery) {
    const rows = await prisma.promotion.findMany({
      where: {
        storeId: this.storeId,
        ...(q.type ? { type: q.type } : {}),
        ...(q.search ? { name: { contains: q.search, mode: "insensitive" as const } } : {}),
      },
      orderBy: [{ createdAt: "desc" }],
    })
    const out = await this.view(rows)
    return q.state ? out.filter((p) => p.state === q.state) : out
  }

  private async find(id: bigint) {
    const p = await prisma.promotion.findFirst({ where: { id, storeId: this.storeId } })
    if (!p) throw new NotFoundError("Promotion")
    return p
  }

  async get(id: bigint) {
    return (await this.view([await this.find(id)]))[0]!
  }

  /** Products, categories and the gift must be this store's; the gift's option must be its own. */
  private async checkRefs(v: UpdatePromotionDto) {
    const storeId = this.storeId
    if (v.productIds?.length) {
      const n = await prisma.product.count({ where: { storeId, id: { in: v.productIds } } })
      if (n !== new Set(v.productIds).size)
        throw new BadRequestError("Some of the chosen products don't exist", "VALIDATION_FAILED")
    }
    if (v.categoryIds?.length) {
      const n = await prisma.category.count({ where: { storeId, id: { in: v.categoryIds } } })
      if (n !== new Set(v.categoryIds).size)
        throw new BadRequestError("Some of the chosen categories don't exist", "VALIDATION_FAILED")
    }
    if (v.type === "free_gift" && v.giftProductId) {
      const p = await prisma.product.findFirst({
        where: { storeId, id: v.giftProductId },
        select: { id: true, variants: { where: { status: "active" }, select: { id: true } } },
      })
      if (!p) throw new BadRequestError("The gift product doesn't exist", "VALIDATION_FAILED")
      if (p.variants.length && !p.variants.some((x) => x.id === v.giftVariantId)) {
        throw new BadRequestError(
          "Choose which option of the gift to give (size, colour…)",
          "VALIDATION_FAILED",
        )
      }
      if (!p.variants.length && v.giftVariantId)
        throw new BadRequestError("The gift product has no options", "VALIDATION_FAILED")
    }
  }

  /** Clears the fields another type used, so an edited promotion doesn't keep stale settings. */
  private data(v: UpdatePromotionDto): Prisma.PromotionUncheckedUpdateInput {
    const d: Prisma.PromotionUncheckedUpdateInput = {
      ...(v as Prisma.PromotionUncheckedUpdateInput),
    }
    if (v.type && v.type !== "discount")
      Object.assign(d, { discountType: null, discountValue: null, maxDiscount: null })
    if (v.type && v.type !== "bxgy") Object.assign(d, { buyQty: null, getQty: null })
    if (v.type && v.type !== "free_gift")
      Object.assign(d, { giftProductId: null, giftVariantId: null, giftQty: 1 })
    if (v.discountType === "fixed") d.maxDiscount = null
    return d
  }

  async create(dto: CreatePromotionDto) {
    await this.checkRefs(dto)
    await checkStorefrontIds(this.storeId, dto.storefrontIds)
    const p = await prisma.promotion.create({
      data: {
        ...(this.data(dto) as Prisma.PromotionUncheckedCreateInput),
        storeId: this.storeId,
        name: dto.name,
        type: dto.type,
      },
    })
    return this.get(p.id)
  }

  async update(id: bigint, dto: UpdatePromotionDto) {
    const cur = await this.find(id)
    await checkStorefrontIds(this.storeId, dto.storefrontIds)
    // A field sent as null clears it; one left out keeps the stored value.
    const pick = <K extends keyof UpdatePromotionDto>(k: K, v: unknown) => {
      const sent = dto[k] !== undefined
      return (sent ? dto[k] : v) as UpdatePromotionDto[K]
    }
    const type = pick("type", cur.type)
    const merged: UpdatePromotionDto = {
      type,
      discountType: pick("discountType", cur.discountType),
      discountValue: pick("discountValue", num(cur.discountValue)),
      buyQty: pick("buyQty", cur.buyQty),
      getQty: pick("getQty", cur.getQty),
      giftProductId: pick("giftProductId", cur.giftProductId),
      giftVariantId: pick("giftVariantId", cur.giftVariantId),
      startsAt: pick("startsAt", cur.startsAt),
      endsAt: pick("endsAt", cur.endsAt),
    }
    const problem = promotionProblems(merged)[0]
    if (problem)
      throw new BadRequestError(problem.message, "VALIDATION_FAILED", {
        [problem.path]: [problem.message],
      })
    await this.checkRefs({ ...dto, ...merged })
    await prisma.promotion.update({ where: { id }, data: this.data(dto) })
    return this.get(id)
  }

  /** Stops it now; it stays in the list as ended. */
  async end(id: bigint) {
    await this.find(id)
    await prisma.promotion.update({ where: { id }, data: { endsAt: new Date() } })
    return this.get(id)
  }

  async remove(id: bigint) {
    await this.find(id)
    await prisma.promotion.delete({ where: { id } })
    return { deleted: true }
  }

  /** Names of chosen products (any status), for showing an edited promotion's scope. */
  async productsByIds(ids: bigint[]) {
    const rows = await prisma.product.findMany({
      where: { storeId: this.storeId, id: { in: ids } },
      select: {
        id: true,
        name: true,
        sku: true,
        images: { orderBy: { sortOrder: "asc" }, take: 1, select: { imageUrl: true } },
      },
    })
    return rows.map((p) => ({
      id: String(p.id),
      name: p.name,
      sku: p.sku,
      imageUrl: p.images[0]?.imageUrl ?? null,
    }))
  }

  /** Every category, parents first, with its depth for an indented list. */
  async categories() {
    const rows = await prisma.category.findMany({
      where: { storeId: this.storeId },
      select: { id: true, name: true, parentId: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    })
    const out: { id: string; name: string; depth: number }[] = []
    const walk = (parent: bigint | null, depth: number) => {
      for (const c of rows.filter((r) => r.parentId === parent)) {
        out.push({ id: String(c.id), name: c.name, depth })
        walk(c.id, depth + 1)
      }
    }
    walk(null, 0)
    return out
  }

  // ------------------------------------------------------------------ storefront

  /**
   * Live promotions for a display slot. On a product page only offers that cover the product; on
   * a category page, offers for that category or the whole store.
   */
  async forSlot(q: SlotQuery) {
    const now = new Date()
    const rows = await prisma.promotion.findMany({
      where: {
        ...liveWhere(this.storeId, now, this.ctx.storefrontId),
        ...(q.slot ? { slots: { has: q.slot } } : { slots: { isEmpty: false } }),
      },
      orderBy: [{ createdAt: "desc" }],
    })
    let shown = rows
    if (q.productId) {
      const lineage = await categoryLineage(this.storeId)
      const cats = lineage(
        (
          await prisma.productCategory.findMany({
            where: { productId: q.productId },
            select: { categoryId: true },
          })
        ).map((c) => c.categoryId),
      ).map((c) => BigInt(c))
      shown = rows.filter(
        (r) =>
          (!r.productIds.length && !r.categoryIds.length) ||
          r.productIds.includes(q.productId!) ||
          r.categoryIds.some((c) => cats.includes(c)),
      )
    } else if (q.categoryId || q.categorySlug) {
      const categoryId =
        q.categoryId ??
        (
          await prisma.category.findFirst({
            where: { storeId: this.storeId, slug: q.categorySlug },
            select: { id: true },
          })
        )?.id
      // The category page shows offers on it or on a parent of it.
      const covered = categoryId ? (await categoryLineage(this.storeId))([categoryId]) : []
      shown = categoryId
        ? rows.filter(
            (r) =>
              !r.productIds.length &&
              (!r.categoryIds.length || r.categoryIds.some((c) => covered.includes(String(c)))),
          )
        : []
    }
    const gifts = await giftInfo(shown)
    return shown.map((p) => ({
      id: String(p.id),
      type: p.type,
      summary: describePromotion(toRule(p, gifts.get(p.id))),
      // The name is the shop's own label; customers see the headline, or what the offer is.
      headline: p.headline?.trim() ? p.headline : describePromotion(toRule(p, gifts.get(p.id))),
      message: p.message,
      imageUrl: p.imageUrl ?? gifts.get(p.id)?.imageUrl ?? null,
      linkUrl: p.linkUrl,
      slots: p.slots,
      endsAt: p.endsAt?.toISOString() ?? null,
    }))
  }
}
