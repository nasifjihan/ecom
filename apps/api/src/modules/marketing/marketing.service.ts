import { prisma, tx } from "../../config";
import { refreshProductRating } from "../storefront/engagement";
import { BaseService, ConflictError, NotFoundError, BadRequestError, type RequestContext, type Paginated } from "../../core";
import { CouponRepository, FlashSaleRepository, ReviewRepository } from "./marketing.repository";
import { couponTypeToDiscountType } from "./marketing.dto";
import { checkStorefrontIds } from "../storefronts/storefronts.context";
import type {
  CreateCouponDto,
  UpdateCouponDto,
  CouponSearchQueryDto,
  CreateFlashSaleDto,
  UpdateFlashSaleDto,
  CreateReviewDto,
  ListReviewsQueryDto,
  ReviewModerateDto,
} from "./marketing.dto";
import { Prisma } from "@prisma/client";
import { CouponType } from "@ecom/shared-types";
import { OrderStatus } from "@ecom/shared-types";

type FlashItemInput = CreateFlashSaleDto["items"][number];
interface FlashRulesInput {
  appliesTo?: string;
  categoryIds?: (bigint | string)[];
  excludeOnSale?: boolean;
}

const rulesJson = (r: NonNullable<CreateFlashSaleDto["rules"]>): Prisma.InputJsonObject => ({
  appliesTo: r.appliesTo,
  categoryIds: r.categoryIds.map(String),
  excludeOnSale: r.excludeOnSale,
});

/** A sale must say what it covers and how much it takes off. */
function checkFlashSale(s: {
  startsAt: Date;
  endsAt: Date;
  discountPercent?: number | null;
  discountFixed?: number | null;
  rules: FlashRulesInput | null;
  items: { productId: bigint; salePrice?: number | null; discountPct?: number | null }[];
}) {
  if (s.startsAt >= s.endsAt) throw new BadRequestError("The sale must end after it starts", "BAD_REQUEST");
  const scope = s.rules?.appliesTo ?? "products";
  const saleWide = s.discountPercent != null || s.discountFixed != null;
  if (scope === "products") {
    if (!s.items.length) throw new BadRequestError("Add at least one product to the sale", "BAD_REQUEST");
    if (!saleWide && s.items.some((i) => i.salePrice == null && i.discountPct == null)) {
      throw new BadRequestError("Set a discount for the sale, or a sale price for every product", "BAD_REQUEST");
    }
  } else {
    if (scope === "categories" && !s.rules?.categoryIds?.length) {
      throw new BadRequestError("Choose at least one category", "BAD_REQUEST");
    }
    if (!saleWide) throw new BadRequestError("Set the discount for the sale", "BAD_REQUEST");
  }
}

/** Replaces a sale's products while keeping the units already sold for the ones that stay. */
async function syncFlashItems(t: Prisma.TransactionClient, flashSaleId: bigint, items: FlashItemInput[]) {
  const existing = await t.flashSaleItem.findMany({ where: { flashSaleId } });
  const key = (productId: bigint, variantId: bigint | null | undefined) => `${productId}:${variantId ?? ""}`;
  const byKey = new Map(existing.map((i) => [key(i.productId, i.variantId), i]));
  const keep = new Set<bigint>();
  for (const [idx, item] of items.entries()) {
    const data = {
      salePrice: item.salePrice ?? null,
      discountPct: item.discountPct ?? null,
      stockLimit: item.stockLimit ?? null,
      sortOrder: idx,
    };
    const found = byKey.get(key(item.productId, item.variantId));
    if (found) {
      if (keep.has(found.id)) continue;
      keep.add(found.id);
      await t.flashSaleItem.update({ where: { id: found.id }, data });
    } else {
      const created = await t.flashSaleItem.create({
        data: { ...data, flashSaleId, productId: item.productId, variantId: item.variantId ?? null },
      });
      keep.add(created.id);
      byKey.set(key(item.productId, item.variantId), created);
    }
  }
  await t.flashSaleItem.deleteMany({ where: { flashSaleId, id: { notIn: [...keep] } } });
}

/** Units sold and revenue per sale, from order lines stamped with the sale at checkout (cancelled orders left out). */
async function flashSaleStats(ids: bigint[]): Promise<Map<string, { unitsSold: number; revenue: number }>> {
  if (!ids.length) return new Map();
  const rows = await prisma.$queryRaw<{ id: string; units: bigint | null; revenue: Prisma.Decimal | null }[]>`
    SELECT oi.meta->'flashSale'->>'id' AS id, SUM(oi.quantity) AS units, SUM(oi."lineSubtotal") AS revenue
    FROM "OrderItem" oi JOIN "Order" o ON o.id = oi."orderId"
    WHERE o.status <> 'CANCELLED' AND oi.meta->'flashSale'->>'id' IN (${Prisma.join(ids.map(String))})
    GROUP BY 1`;
  return new Map(rows.map((r) => [r.id, { unitsSold: Number(r.units ?? 0), revenue: Number(r.revenue ?? 0) }]));
}

export class MarketingService extends BaseService {
  private coupons: CouponRepository;
  private flashSales: FlashSaleRepository;
  private reviews: ReviewRepository;

  constructor(ctx: RequestContext) {
    super(ctx);
    this.coupons = new CouponRepository();
    this.flashSales = new FlashSaleRepository();
    this.reviews = new ReviewRepository();
  }

  async createCoupon(dto: CreateCouponDto): Promise<unknown> {
    const storeId = this.ctx.storeId;
    const existing = await this.coupons.findByCode(this.ctx, dto.code);
    if (existing) throw new ConflictError(`Coupon code already exists: ${dto.code}`, "DUPLICATE_COUPON_CODE");
    if (storeId !== undefined) await checkStorefrontIds(storeId, dto.storefrontIds);

    const data: Record<string, unknown> = {
      code: dto.code.toUpperCase(),
      description: dto.description ?? null,
      type: couponTypeToDiscountType(dto.type),
      amount: dto.amount,
      freeShipping: dto.freeShipping,
      minSubtotal: dto.minSubtotal ?? null,
      maxSubtotal: dto.maxSubtotal ?? null,
      productIds: dto.productIds ?? null,
      excludeProductIds: dto.excludeProductIds ?? null,
      categoryIds: dto.categoryIds ?? null,
      excludeSales: dto.excludeSales,
      individualOnly: dto.individualOnly,
      customerGroupIds: dto.customerGroupIds ?? null,
      customerEmails: dto.customerEmails ?? null,
      newCustomersOnly: dto.newCustomersOnly,
      totalUsageLimit: dto.totalUsageLimit ?? null,
      perCustomerLimit: dto.perCustomerLimit ?? null,
      startsAt: dto.startsAt ?? null,
      expiresAt: dto.expiresAt ?? null,
      isActive: dto.isActive,
      autoApply: dto.autoApply,
      audience: dto.audience,
      worksWithPromotions: dto.worksWithPromotions,
      storefrontIds: dto.storefrontIds,
    };
    if (storeId !== undefined) data.storeId = storeId;

    return this.coupons.create(this.ctx, data);
  }

  async listCoupons(filters: CouponSearchQueryDto): Promise<Paginated<unknown>> {
    return this.coupons.listPaginated(this.ctx, filters);
  }

  async getCoupon(id: bigint | number): Promise<unknown> {
    return this.coupons.findById(this.ctx, id);
  }

  async updateCoupon(id: bigint | number, dto: UpdateCouponDto): Promise<unknown> {
    const cid = BigInt(id);
    if (this.ctx.storeId !== undefined) await checkStorefrontIds(this.ctx.storeId, dto.storefrontIds);
    const data: Record<string, unknown> = {};
    for (const key of Object.keys(dto)) {
      if (key === "type" && dto.type !== undefined) {
        data.type = couponTypeToDiscountType(dto.type);
      } else {
        (data as any)[key] = (dto as any)[key];
      }
    }
    if (dto.code !== undefined) data.code = dto.code.toUpperCase();
    return this.coupons.update(this.ctx, cid, data);
  }

  async deleteCoupon(id: bigint | number): Promise<{ success: true; id: bigint | number }> {
    return this.coupons.delete(this.ctx, id);
  }

  async validateCoupon(code: string, cart: any): Promise<{ ok: boolean; errors: string[] }> {
    return this.coupons.validateCouponForCart(this.ctx, code, cart);
  }

  async createFlashSale(dto: CreateFlashSaleDto): Promise<unknown> {
    const storeId = this.ctx.storeId;
    const existing = await this.flashSales.findBySlug(this.ctx, dto.slug);
    if (existing) throw new ConflictError(`Flash sale slug already exists: ${dto.slug}`, "DUPLICATE_SLUG");
    checkFlashSale({ ...dto, rules: dto.rules ?? null });

    return tx(async (t: Prisma.TransactionClient) => {
      const flashSale = await t.flashSale.create({
        data: {
          storeId: storeId as bigint,
          name: dto.name,
          slug: dto.slug,
          description: dto.description ?? null,
          startsAt: dto.startsAt,
          endsAt: dto.endsAt,
          discountPercent: dto.discountPercent ?? null,
          discountFixed: dto.discountFixed ?? null,
          rules: dto.rules ? rulesJson(dto.rules) : Prisma.JsonNull,
          bannerImageUrl: dto.bannerImageUrl ?? null,
          bannerTitle: dto.bannerTitle ?? null,
          bannerSubtitle: dto.bannerSubtitle ?? null,
          bannerCtaText: dto.bannerCtaText ?? null,
          bannerCtaUrl: dto.bannerCtaUrl ?? null,
          position: dto.position,
          isActive: dto.isActive,
        },
      });
      await syncFlashItems(t, flashSale.id, dto.items);
      return t.flashSale.findFirst({ where: { id: flashSale.id }, include: { items: true } });
    });
  }

  async listFlashSales(filters: { page: number; perPage: number; sortBy?: string; sortOrder?: "asc" | "desc"; search?: string }): Promise<Paginated<unknown>> {
    const page = await this.flashSales.listPaginated(this.ctx, filters);
    const rows = page.data as { id: bigint }[];
    const stats = await flashSaleStats(rows.map((s) => s.id));
    return { ...page, data: rows.map((s) => ({ ...s, stats: stats.get(String(s.id)) ?? { unitsSold: 0, revenue: 0 } })) };
  }

  async getFlashSale(id: bigint | number): Promise<unknown> {
    const fid = BigInt(id);
    const row = await prisma.flashSale.findFirst({
      where: { id: fid, ...(this.ctx.storeId !== undefined ? { storeId: this.ctx.storeId } : {}) },
      include: {
        items: {
          orderBy: { sortOrder: "asc" },
          include: {
            product: {
              select: {
                name: true,
                sku: true,
                regularPrice: true,
                salePrice: true,
                images: { orderBy: { sortOrder: "asc" }, take: 1, select: { imageUrl: true } },
              },
            },
          },
        },
      },
    });
    if (!row) throw new NotFoundError("flashSale", fid);
    const stats = await flashSaleStats([fid]);
    return { ...row, stats: stats.get(String(fid)) ?? { unitsSold: 0, revenue: 0 } };
  }

  async updateFlashSale(id: bigint | number, dto: UpdateFlashSaleDto): Promise<unknown> {
    const fid = BigInt(id);
    const current = await prisma.flashSale.findFirst({
      where: { id: fid, ...(this.ctx.storeId !== undefined ? { storeId: this.ctx.storeId } : {}) },
      include: { items: true },
    });
    if (!current) throw new NotFoundError("flashSale", fid);
    if (dto.slug && dto.slug !== current.slug) {
      const clash = await this.flashSales.findBySlug(this.ctx, dto.slug);
      if (clash) throw new ConflictError(`Flash sale slug already exists: ${dto.slug}`, "DUPLICATE_SLUG");
    }
    const num = (v: Prisma.Decimal | null) => (v === null ? null : Number(v));
    // Pausing or renaming a sale doesn't re-check what it covers.
    const touchesPricing = ["startsAt", "endsAt", "discountPercent", "discountFixed", "rules", "items"].some(
      (k) => (dto as Record<string, unknown>)[k] !== undefined,
    );
    if (touchesPricing) checkFlashSale({
      startsAt: dto.startsAt ?? current.startsAt,
      endsAt: dto.endsAt ?? current.endsAt,
      discountPercent: dto.discountPercent !== undefined ? dto.discountPercent : num(current.discountPercent),
      discountFixed: dto.discountFixed !== undefined ? dto.discountFixed : num(current.discountFixed),
      rules: dto.rules ?? (current.rules as FlashRulesInput | null),
      items:
        dto.items ??
        current.items.map((i) => ({ productId: i.productId, salePrice: num(i.salePrice), discountPct: num(i.discountPct) })),
    });

    return tx(async (t: Prisma.TransactionClient) => {
      const { items, rules, ...rest } = dto;
      const data: Prisma.FlashSaleUpdateInput = { ...rest };
      if (rules) data.rules = rulesJson(rules);
      if (Object.keys(data).length > 0) await t.flashSale.update({ where: { id: fid }, data });
      if (items) await syncFlashItems(t, fid, items);
      return t.flashSale.findFirst({ where: { id: fid }, include: { items: true } });
    });
  }

  async deleteFlashSale(id: bigint | number): Promise<{ success: true; id: bigint | number }> {
    return this.flashSales.delete(this.ctx, id);
  }

  async createReview(dto: CreateReviewDto): Promise<unknown> {
    const storeId = this.ctx.storeId;
    const customerId = this.ctx.customer?.id;
    if (!customerId) throw new BadRequestError("Customer context required", "BAD_REQUEST");

    const pid = BigInt(dto.productId);
    const product = await prisma.product.findFirst({
      where: { id: pid, ...(storeId !== undefined ? { storeId } : {}) },
    });
    if (!product) throw new NotFoundError("product", pid);

    if (dto.orderId !== undefined) {
      const order = await prisma.order.findFirst({
        where: {
          id: BigInt(dto.orderId),
          ...(storeId !== undefined ? { storeId } : {}),
          customerId: BigInt(customerId),
        },
      });
      if (!order) throw new NotFoundError("order", dto.orderId);
      if (order.status !== OrderStatus.DELIVERED && order.status !== OrderStatus.COMPLETED) {
        throw new BadRequestError("You can only review delivered orders", "ORDER_NOT_DELIVERED");
      }
    }

    const existing = await this.reviews.findExistingReview(this.ctx, BigInt(customerId), pid, dto.orderId);
    if (existing) throw new ConflictError("You have already reviewed this product", "DUPLICATE_REVIEW");

    const verified = dto.orderId !== undefined;
    const data: Record<string, unknown> = {
      productId: pid,
      customerId: BigInt(customerId),
      orderId: dto.orderId ? BigInt(dto.orderId) : null,
      rating: dto.rating,
      title: dto.title ?? null,
      body: dto.body ?? null,
      status: verified ? "approved" : "pending",
      verified,
    };
    if (storeId !== undefined) data.storeId = storeId;

    return tx(async (t: any) => {
      const review = await t.review.create({ data });
      const approvedCount = await t.review.count({
        where: { productId: pid, status: "approved" },
      });
      const avgRatingRow = await t.review.aggregate({
        where: { productId: pid, status: "approved" },
        _avg: { rating: true },
      });
      const avgRating = Number(avgRatingRow._avg.rating ?? 0);
      await t.product.update({
        where: { id: pid },
        data: {
          reviewCount: approvedCount,
          averageRating: Math.round(avgRating * 100) / 100,
        },
      });
      return t.review.findFirst({
        where: { id: review.id },
        include: {
          product: { select: { id: true, name: true } },
          customer: { select: { id: true, firstName: true, lastName: true } },
        },
      });
    });
  }

  async listReviews(filters: ListReviewsQueryDto): Promise<Paginated<unknown>> {
    return this.reviews.listPaginated(this.ctx, filters);
  }

  async getReview(id: bigint | number): Promise<unknown> {
    return this.reviews.findById(this.ctx, id);
  }

  async moderateReviews(dto: ReviewModerateDto): Promise<{ count: number; action: string }> {
    const bigIds = dto.ids.map((id) => BigInt(id));
    // Ratings on the product pages follow what's approved, so re-count the products touched.
    const touched = await prisma.review.findMany({
      where: { id: { in: bigIds }, ...(this.ctx.storeId !== undefined ? { storeId: this.ctx.storeId } : {}) },
      select: { productId: true },
    });
    const result = await this.reviews.setStatus(this.ctx, bigIds, dto.action);
    for (const productId of new Set(touched.map((t) => t.productId))) await refreshProductRating(productId);
    return { count: result.count, action: dto.action };
  }

  async listMyReviews(filters: ListReviewsQueryDto): Promise<Paginated<unknown>> {
    const customerId = this.ctx.customer?.id;
    if (!customerId) throw new BadRequestError("Customer context required", "BAD_REQUEST");
    return this.reviews.listPaginated(this.ctx, {
      ...filters,
      customerId: BigInt(customerId),
    });
  }
}
