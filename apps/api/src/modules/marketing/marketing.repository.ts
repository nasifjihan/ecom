import { prisma } from "../../config";
import { BaseRepository, type RequestContext, type Paginated, paginate, NotFoundError, ConflictError } from "../../core";
import type { CouponSearchQueryDto, ListReviewsQueryDto } from "./marketing.dto";
import { CouponType } from "@ecom/shared-types";

export class CouponRepository extends BaseRepository<"coupon"> {
  constructor() {
    super("coupon");
  }

  async findByCode(ctx: RequestContext, code: string): Promise<unknown | null> {
    const where: Record<string, unknown> = { code: code.toUpperCase() };
    if (ctx.storeId !== undefined) where.storeId = ctx.storeId;
    return (this.q as any).findFirst({ where });
  }

  async incrementUsage(ctx: RequestContext, id: bigint | number): Promise<unknown> {
    const where: Record<string, unknown> = { id: BigInt(id) };
    if (ctx.storeId !== undefined) where.storeId = ctx.storeId;
    return (this.q as any).update({
      where,
      data: { usageCount: { increment: 1 } },
    });
  }

  async listPaginated(
    ctx: RequestContext,
    filters: CouponSearchQueryDto & {
      status?: string;
      type?: CouponType;
      minAmount?: number;
      maxAmount?: number;
    },
  ): Promise<Paginated<unknown>> {
    const where: Record<string, unknown> = {};
    if (ctx.storeId !== undefined) where.storeId = ctx.storeId;
    if (filters.type) where.type = filters.type;
    if (filters.status === "active") where.isActive = true;
    if (filters.status === "inactive") where.isActive = false;
    if (filters.status === "expired") {
      where.expiresAt = { lt: new Date() };
    }
    if (filters.minAmount !== undefined || filters.maxAmount !== undefined) {
      const amountWhere: Record<string, unknown> = {};
      if (filters.minAmount !== undefined) amountWhere.gte = filters.minAmount;
      if (filters.maxAmount !== undefined) amountWhere.lte = filters.maxAmount;
      if (Object.keys(amountWhere).length) where.amount = amountWhere;
    }
    if (filters.search) {
      where.OR = [
        { code: { contains: filters.search, mode: "insensitive" } },
        { description: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    const orderBy = { [filters.sortBy ?? "createdAt"]: filters.sortOrder ?? "desc" };
    const skip = (filters.page - 1) * filters.perPage;

    const [count, items] = await Promise.all([
      (this.q as any).count({ where }),
      (this.q as any).findMany({ where, orderBy, skip, take: filters.perPage }),
    ]);

    return paginate({
      items,
      total: count,
      page: filters.page,
      perPage: filters.perPage,
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder,
      search: filters.search,
      filtersApplied: filters,
    });
  }

  async validateCouponForCart(
    ctx: RequestContext,
    code: string,
    cart: {
      customerId?: bigint;
      subtotal: number;
      productIdsInCart: bigint[];
      customerEmail?: string;
      isNewCustomer?: boolean;
      groupId?: bigint;
    },
  ): Promise<{ ok: boolean; errors: string[] }> {
    const coupon = await this.findByCode(ctx, code);
    const errors: string[] = [];
    if (!coupon) {
      return { ok: false, errors: ["Coupon not found"] };
    }
    const c: any = coupon;
    if (!c.isActive) errors.push("Coupon is not active");
    if (c.startsAt && new Date() < new Date(c.startsAt)) errors.push("Coupon is not yet valid");
    if (c.expiresAt && new Date() > new Date(c.expiresAt)) errors.push("Coupon has expired");
    if (c.totalUsageLimit !== null && c.totalUsageLimit !== undefined && c.usageCount >= c.totalUsageLimit) {
      errors.push("Coupon usage limit reached");
    }
    if (c.minSubtotal !== null && c.minSubtotal !== undefined && cart.subtotal < Number(c.minSubtotal)) {
      errors.push(`Subtotal must be at least ${c.minSubtotal}`);
    }
    if (c.maxSubtotal !== null && c.maxSubtotal !== undefined && cart.subtotal > Number(c.maxSubtotal)) {
      errors.push(`Subtotal must be at most ${c.maxSubtotal}`);
    }
    if (c.newCustomersOnly && !cart.isNewCustomer) {
      errors.push("Coupon is for new customers only");
    }
    if (c.productIds && Array.isArray(c.productIds) && c.productIds.length > 0) {
      const allowed = new Set(c.productIds.map((id: any) => String(id)));
      const hasMatch = cart.productIdsInCart.some((pid) => allowed.has(String(pid)));
      if (!hasMatch) errors.push("Coupon is not valid for any products in cart");
    }
    if (c.excludeProductIds && Array.isArray(c.excludeProductIds) && c.excludeProductIds.length > 0) {
      const excluded = new Set(c.excludeProductIds.map((id: any) => String(id)));
      const hasExcluded = cart.productIdsInCart.some((pid) => excluded.has(String(pid)));
      if (hasExcluded) errors.push("Coupon excludes one or more products in your cart");
    }
    if (c.customerEmails && Array.isArray(c.customerEmails) && c.customerEmails.length > 0 && cart.customerEmail) {
      if (!c.customerEmails.map((e: string) => e.toLowerCase()).includes(cart.customerEmail.toLowerCase())) {
        errors.push("Coupon is not valid for your email");
      }
    }
    if (c.customerGroupIds && Array.isArray(c.customerGroupIds) && c.customerGroupIds.length > 0 && cart.groupId) {
      const allowedGroups = new Set(c.customerGroupIds.map((id: any) => String(id)));
      if (!allowedGroups.has(String(cart.groupId))) {
        errors.push("Coupon is not valid for your customer group");
      }
    }
    if (c.perCustomerLimit !== null && c.perCustomerLimit !== undefined && cart.customerId) {
      const custUsages = await prisma.order.count({
        where: {
          storeId: ctx.storeId,
          customerId: BigInt(cart.customerId),
          couponUsed: c.code,
        },
      });
      if (custUsages >= c.perCustomerLimit) {
        errors.push(`Coupon can only be used ${c.perCustomerLimit} time(s) per customer`);
      }
    }
    return { ok: errors.length === 0, errors };
  }
}

export class FlashSaleRepository extends BaseRepository<"flashSale"> {
  constructor() {
    super("flashSale");
  }

  async findActiveForProduct(ctx: RequestContext, productIds: bigint[]): Promise<unknown[]> {
    const now = new Date();
    const where: Record<string, unknown> = {
      isActive: true,
      startsAt: { lte: now },
      endsAt: { gte: now },
    };
    if (ctx.storeId !== undefined) where.storeId = ctx.storeId;
    const pids = productIds.map((id) => BigInt(id));
    const items = await prisma.flashSaleItem.findMany({
      where: {
        productId: { in: pids },
        flashSale: where as any,
      },
      include: {
        flashSale: true,
      },
      orderBy: {
        flashSale: { position: "asc" },
      },
    });
    return items;
  }

  async findBySlug(ctx: RequestContext, slug: string): Promise<unknown | null> {
    const where: Record<string, unknown> = { slug };
    if (ctx.storeId !== undefined) where.storeId = ctx.storeId;
    return (this.q as any).findFirst({
      where,
      include: { items: true },
    });
  }

  async listPaginated(
    ctx: RequestContext,
    filters: { page: number; perPage: number; sortBy?: string; sortOrder?: "asc" | "desc"; search?: string },
  ): Promise<Paginated<unknown>> {
    const where: Record<string, unknown> = {};
    if (ctx.storeId !== undefined) where.storeId = ctx.storeId;
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: "insensitive" } },
        { slug: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    const orderBy = { [filters.sortBy ?? "position"]: filters.sortOrder ?? "asc" };
    const skip = (filters.page - 1) * filters.perPage;

    const [count, items] = await Promise.all([
      (this.q as any).count({ where }),
      (this.q as any).findMany({
        where,
        orderBy,
        skip,
        take: filters.perPage,
        include: { _count: { select: { items: true } } },
      }),
    ]);

    return paginate({
      items,
      total: count,
      page: filters.page,
      perPage: filters.perPage,
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder,
      search: filters.search,
      filtersApplied: filters,
    });
  }
}

export class ReviewRepository extends BaseRepository<"review"> {
  constructor() {
    super("review");
  }

  async listPaginated(
    ctx: RequestContext,
    filters: ListReviewsQueryDto & {
      productId?: bigint;
      customerId?: bigint;
      status?: string;
      rating?: number;
    },
  ): Promise<Paginated<unknown>> {
    const where: Record<string, unknown> = {};
    if (ctx.storeId !== undefined) where.storeId = ctx.storeId;
    if (filters.productId) where.productId = BigInt(filters.productId);
    if (filters.customerId) where.customerId = BigInt(filters.customerId);
    if (filters.status) where.status = filters.status;
    if (filters.rating) where.rating = filters.rating;
    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: "insensitive" } },
        { body: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    const orderBy = { [filters.sortBy ?? "createdAt"]: filters.sortOrder ?? "desc" };
    const skip = (filters.page - 1) * filters.perPage;

    const [count, items] = await Promise.all([
      (this.q as any).count({ where }),
      (this.q as any).findMany({
        where,
        orderBy,
        skip,
        take: filters.perPage,
        include: {
          product: { select: { id: true, name: true, slug: true } },
          customer: { select: { id: true, firstName: true, lastName: true, email: true } },
          order: { select: { id: true, status: true, number: true } },
        },
      }),
    ]);

    return paginate({
      items,
      total: count,
      page: filters.page,
      perPage: filters.perPage,
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder,
      search: filters.search,
      filtersApplied: filters,
    });
  }

  async setStatus(
    ctx: RequestContext,
    ids: bigint[],
    action: "approve" | "bulk-delete" | "spam-mark",
  ): Promise<{ count: number }> {
    const bigIds = ids.map((i) => BigInt(i));
    const storeId = ctx.storeId;
    const where: Record<string, unknown> = {
      id: { in: bigIds },
    };
    if (storeId !== undefined) where.storeId = storeId;

    if (action === "bulk-delete") {
      return (this.q as any).deleteMany({ where });
    }
    const status = action === "approve" ? "approved" : "spam";
    return (this.q as any).updateMany({
      where,
      data: { status },
    });
  }

  async findExistingReview(
    ctx: RequestContext,
    customerId: bigint,
    productId: bigint,
    orderId?: bigint,
  ): Promise<unknown | null> {
    const where: Record<string, unknown> = {
      customerId: BigInt(customerId),
      productId: BigInt(productId),
    };
    if (ctx.storeId !== undefined) where.storeId = ctx.storeId;
    if (orderId !== undefined) where.orderId = BigInt(orderId);
    return (this.q as any).findFirst({ where });
  }
}
