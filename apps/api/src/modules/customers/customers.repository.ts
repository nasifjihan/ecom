import { prisma, tx } from "../../config";
import { BaseRepository, NotFoundError, type RequestContext, type Paginated, paginate } from "../../core";
import type { CustomerSearchQueryDto } from "./customers.dto";

export class CustomerRepository extends BaseRepository<"customer"> {
  constructor() {
    super("customer");
  }

  async findFull(ctx: RequestContext, id: bigint | number): Promise<unknown> {
    const row = await (this.q as any).findFirst({
      where: { id: BigInt(id), ...(ctx.storeId !== undefined ? { storeId: ctx.storeId } : {}) },
      include: {
        group: true,
        addresses: { orderBy: { createdAt: "desc" } },
        _count: {
          select: {
            orders: true,
            reviews: true,
            wishlistItems: true,
          },
        },
      },
    });
    if (!row) throw new NotFoundError("customer", id);
    return row;
  }

  async findByEmail(ctx: RequestContext, email: string): Promise<unknown | null> {
    return this.findBy(ctx, { email });
  }

  async listWithJoins(
    ctx: RequestContext,
    filters: CustomerSearchQueryDto & {
      status?: string;
      groupId?: bigint;
      minTotalSpent?: number;
      maxTotalSpent?: number;
      dateFrom?: Date;
      dateTo?: Date;
      country?: string;
      acceptMarketing?: boolean;
      isGuest?: boolean;
    } = {
      page: 1,
      perPage: 20,
      sortBy: "createdAt",
      sortOrder: "desc",
    },
  ): Promise<Paginated<unknown>> {
    const where: Record<string, unknown> = {};
    if (ctx.storeId !== undefined) where.storeId = ctx.storeId;
    if (filters.status) where.status = filters.status;
    if (filters.groupId) where.groupId = BigInt(filters.groupId);
    if (filters.acceptMarketing !== undefined) where.acceptMarketing = filters.acceptMarketing;
    if (filters.isGuest !== undefined) where.isGuest = filters.isGuest;
    if (filters.search) {
      where.OR = [
        { firstName: { contains: filters.search, mode: "insensitive" } },
        { lastName: { contains: filters.search, mode: "insensitive" } },
        { email: { contains: filters.search, mode: "insensitive" } },
        { phone: { contains: filters.search, mode: "insensitive" } },
      ];
    }
    const spentWhere: Record<string, unknown> = {};
    if (filters.minTotalSpent !== undefined) spentWhere.gte = filters.minTotalSpent;
    if (filters.maxTotalSpent !== undefined) spentWhere.lte = filters.maxTotalSpent;
    if (Object.keys(spentWhere).length) where.totalSpent = spentWhere;
    if (filters.dateFrom || filters.dateTo) {
      const createdAtWhere: Record<string, unknown> = {};
      if (filters.dateFrom) createdAtWhere.gte = filters.dateFrom;
      if (filters.dateTo) createdAtWhere.lte = filters.dateTo;
      where.createdAt = createdAtWhere;
    }
    if (filters.country) {
      where.addresses = {
        some: { countryCode: filters.country },
      };
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
          group: { select: { id: true, name: true, discountPercent: true } },
          addresses: { take: 2, orderBy: { isDefault: "desc" } },
          _count: { select: { orders: true, reviews: true } },
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

  async incrementStatsAfterPayment(
    ctx: RequestContext,
    customerId: bigint | number,
    stats: { addSpent?: number; addOrders?: number },
  ): Promise<unknown> {
    const cid = BigInt(customerId);
    const existing = await this.findById(ctx, cid);
    if (!existing) throw new NotFoundError("customer", cid);

    const data: Record<string, unknown> = {};
    if (stats.addSpent !== undefined) {
      data.totalSpent = {
        increment: stats.addSpent,
      };
    }
    if (stats.addOrders !== undefined) {
      data.orderCount = {
        increment: stats.addOrders,
      };
    }

    if (Object.keys(data).length === 0) return existing;

    return (this.q as any).update({
      where: { id: cid },
      data,
    });
  }

  async bulkUpdateStatuses(
    ctx: RequestContext,
    ids: bigint[],
    data: Record<string, unknown>,
  ): Promise<{ count: number }> {
    const storeId = ctx.storeId;
    const bigIds = ids.map((i) => BigInt(i));
    return (this.q as any).updateMany({
      where: {
        id: { in: bigIds },
        ...(storeId !== undefined ? { storeId } : {}),
      },
      data,
    });
  }
}

export class CustomerAddressRepository extends BaseRepository<"customerAddress"> {
  constructor() {
    super("customerAddress");
  }

  private async withCustomerStore(
    customerId: bigint | number,
    ctx: RequestContext,
  ): Promise<void> {
    if (ctx.storeId === undefined) return;
    const cust = await prisma.customer.findFirst({
      where: { id: BigInt(customerId), storeId: ctx.storeId },
      select: { id: true },
    });
    if (!cust) throw new NotFoundError("customer", customerId);
  }

  async listForCustomer(ctx: RequestContext, customerId: bigint | number): Promise<unknown[]> {
    const cid = BigInt(customerId);
    await this.withCustomerStore(cid, ctx);
    return prisma.customerAddress.findMany({
      where: { customerId: cid },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });
  }

  async addAddress(ctx: RequestContext, customerId: bigint | number, data: Record<string, unknown>): Promise<unknown> {
    const cid = BigInt(customerId);
    await this.withCustomerStore(cid, ctx);
    const type = String(data.type ?? "shipping");
    const isDefault = Boolean(data.isDefault ?? false);

    return tx(async (t: any) => {
      if (isDefault) {
        await t.customerAddress.updateMany({
          where: { customerId: cid, type },
          data: { isDefault: false },
        });
      }
      return t.customerAddress.create({
        data: {
          ...data,
          customerId: cid,
          isDefault,
        },
      });
    });
  }

  async setDefault(
    ctx: RequestContext,
    params: { customerId: bigint | number; type: "billing" | "shipping"; addressId: bigint | number },
  ): Promise<unknown> {
    const { customerId, type, addressId } = params;
    const cid = BigInt(customerId);
    const aid = BigInt(addressId);
    await this.withCustomerStore(cid, ctx);

    const addr = await prisma.customerAddress.findFirst({
      where: { id: aid, customerId: cid },
    });
    if (!addr) throw new NotFoundError("customerAddress", addressId);

    return tx(async (t: any) => {
      await t.customerAddress.updateMany({
        where: { customerId: cid, type },
        data: { isDefault: false },
      });
      return t.customerAddress.update({
        where: { id: aid },
        data: { isDefault: true },
      });
    });
  }

  async findByAddressId(ctx: RequestContext, customerId: bigint | number, addressId: bigint | number): Promise<unknown> {
    const cid = BigInt(customerId);
    const aid = BigInt(addressId);
    await this.withCustomerStore(cid, ctx);
    const row = await prisma.customerAddress.findFirst({
      where: { id: aid, customerId: cid },
    });
    if (!row) throw new NotFoundError("customerAddress", aid);
    return row;
  }
}
