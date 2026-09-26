import { prisma, tx } from "../../config";
import { BaseService, ConflictError, NotFoundError, BadRequestError, type RequestContext, type Paginated } from "../../core";
import { CouponRepository, FlashSaleRepository, ReviewRepository } from "./marketing.repository";
import { couponTypeToDiscountType } from "./marketing.dto";
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
import { CouponType } from "@ecom/shared-types";
import { OrderStatus } from "@ecom/shared-types";

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

    return tx(async (t: any) => {
      const saleData: Record<string, unknown> = {
        name: dto.name,
        slug: dto.slug,
        description: dto.description ?? null,
        startsAt: dto.startsAt,
        endsAt: dto.endsAt,
        discountPercent: dto.discountPercent ?? null,
        discountFixed: dto.discountFixed ?? null,
        bannerImageUrl: dto.bannerImageUrl ?? null,
        bannerTitle: dto.bannerTitle ?? null,
        bannerSubtitle: dto.bannerSubtitle ?? null,
        bannerCtaText: dto.bannerCtaText ?? null,
        bannerCtaUrl: dto.bannerCtaUrl ?? null,
        position: dto.position,
        isActive: dto.isActive,
      };
      if (storeId !== undefined) saleData.storeId = storeId;

      const flashSale = await t.flashSale.create({ data: saleData });

      const itemsData = dto.items.map((item, idx) => ({
        flashSaleId: flashSale.id,
        productId: BigInt(item.productId),
        variantId: item.variantId ? BigInt(item.variantId) : null,
        salePrice: item.salePrice ?? null,
        discountPct: item.discountPct ?? null,
        stockLimit: item.stockLimit ?? null,
        sortOrder: idx,
      }));
      if (itemsData.length > 0) {
        await t.flashSaleItem.createMany({ data: itemsData, skipDuplicates: true });
      }
      return t.flashSale.findFirst({
        where: { id: flashSale.id },
        include: { items: true },
      });
    });
  }

  async listFlashSales(filters: { page: number; perPage: number; sortBy?: string; sortOrder?: "asc" | "desc"; search?: string }): Promise<Paginated<unknown>> {
    return this.flashSales.listPaginated(this.ctx, filters);
  }

  async getFlashSale(id: bigint | number): Promise<unknown> {
    const fid = BigInt(id);
    const row = await prisma.flashSale.findFirst({
      where: { id: fid, ...(this.ctx.storeId !== undefined ? { storeId: this.ctx.storeId } : {}) },
      include: { items: true },
    });
    if (!row) throw new NotFoundError("flashSale", fid);
    return row;
  }

  async updateFlashSale(id: bigint | number, dto: UpdateFlashSaleDto): Promise<unknown> {
    const fid = BigInt(id);
    return tx(async (t: any) => {
      const data: Record<string, unknown> = {};
      for (const key of Object.keys(dto)) {
        if (key === "items") continue;
        (data as any)[key] = (dto as any)[key];
      }
      if (Object.keys(data).length > 0) {
        await t.flashSale.update({ where: { id: fid }, data });
      }
      if (dto.items && dto.items.length > 0) {
        await t.flashSaleItem.deleteMany({ where: { flashSaleId: fid } });
        const itemsData = dto.items.map((item, idx) => ({
          flashSaleId: fid,
          productId: BigInt(item.productId),
          variantId: item.variantId ? BigInt(item.variantId) : null,
          salePrice: item.salePrice ?? null,
          discountPct: item.discountPct ?? null,
          stockLimit: item.stockLimit ?? null,
          sortOrder: idx,
        }));
        await t.flashSaleItem.createMany({ data: itemsData });
      }
      return t.flashSale.findFirst({
        where: { id: fid },
        include: { items: true },
      });
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
    const result = await this.reviews.setStatus(this.ctx, bigIds, dto.action);
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
