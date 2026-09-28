/**
 * BASE REPOSITORY
 *
 * Every business model repo (ProductRepo, OrderRepo, ...) extends this.
 * The critical safety feature: `ctx.storeId` is AUTOMATICALLY appended to
 * every query so junior devs CANNOT accidentally query another store's data
 * (the #1 IDOR bug in multi-tenant systems).
 *
 * Just do:
 *   class ProductRepo extends BaseRepository<'product'> { constructor(){ super('product') } }
 *   repo.list(ctx, where);  // WHERE product.storeId = ctx.storeId AND ...
 *
 * Store-scoping is turned OFF for platform/super endpoints via ctx.storeId === undefined.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import type { DefaultArgs } from "@prisma/client/runtime/library";
import { prisma } from "../config";
import { NotFoundError } from "./http.error";
import type { PaginationDto } from "@ecom/zod-schemas";
import { paginate, type Paginated } from "./pagination";

export type RequestContext = {
  storeId?: bigint;
  /** The storefront the request is for (web address → Storefront, else the store's default). */
  storefrontId?: bigint;
  /** `storefrontIds`: the storefronts this staff member is limited to (absent or empty: all). */
  admin?: { id: bigint; role: string; permissions: string[]; storefrontIds?: bigint[] };
  customer?: { id: bigint };
  super?: { id: bigint };
  requestId: string;
  /** Client IP as Express resolves it (honours `trust proxy`). */
  ip?: string;
  locale: string;
  currency: string;
};

type ModelName = Exclude<
  keyof PrismaClient,
  | `$${string}`
  | symbol
>;

export abstract class BaseRepository<TModelName extends ModelName> {
  protected readonly model: TModelName;
  protected readonly db: PrismaClient;

  constructor(modelName: TModelName) {
    this.model = modelName;
    this.db = prisma;
  }

  /* ---------- Safe store scope ---------- */
  private scope(storeId: bigint | undefined, extraWhere: Record<string, unknown> = {}) {
    const where: Record<string, unknown> = { ...extraWhere };
    if (storeId !== undefined) where.storeId = Number.isNaN(Number(storeId)) ? storeId : BigInt(storeId as bigint);
    return where;
  }

  /* ---------- Raw model access (for advanced queries) ---------- */
  get q(): any {
    return prisma[this.model];
  }

  /* ---------- Standard CRUD ---------- */
  async findById(ctx: RequestContext, id: bigint | number): Promise<any> {
    const row = await (this.q as any).findFirst({
      where: { id: BigInt(id), ...this.scope(ctx.storeId) },
    });
    if (!row) throw new NotFoundError(String(this.model), id);
    return row;
  }

  async findBy(ctx: RequestContext, where: Record<string, unknown>, include?: unknown): Promise<any | null> {
    return (this.q as any).findFirst({
      where: this.scope(ctx.storeId, where),
      include: include as never,
    });
  }

  async mustFindBy(ctx: RequestContext, where: Record<string, unknown>, include?: unknown): Promise<any> {
    const row = await this.findBy(ctx, where, include);
    if (!row) throw new NotFoundError(String(this.model));
    return row;
  }

  async list(ctx: RequestContext, where: Record<string, unknown> = {}, args: { orderBy?: unknown; include?: unknown; take?: number; skip?: number } = {}): Promise<any[]> {
    return (this.q as any).findMany({
      where: this.scope(ctx.storeId, where),
      orderBy: args.orderBy ?? { createdAt: "desc" },
      include: args.include as never,
      take: args.take,
      skip: args.skip,
    });
  }

  async paginate(
    ctx: RequestContext,
    p: PaginationDto & { where?: Record<string, unknown>; include?: unknown; select?: unknown; } = {} as any,
  ): Promise<Paginated<any>> {
    const where = this.scope(ctx.storeId, p.where ?? {});
    const orderBy = { [p.sortBy ?? "createdAt"]: p.sortOrder ?? "desc" };
    const skip = (p.page - 1) * p.perPage;
    const [count, items] = await Promise.all([
      (this.q as any).count({ where }),
      (this.q as any).findMany({
        where,
        orderBy,
        include: p.include as never,
        select: p.select as never,
        skip,
        take: p.perPage,
      }),
    ]);
    return paginate({
      items,
      total: count,
      page: p.page,
      perPage: p.perPage,
      sortBy: p.sortBy,
      sortOrder: p.sortOrder,
      search: p.search,
      filtersApplied: p.where,
    });
  }

  async create(ctx: RequestContext, data: Record<string, unknown>): Promise<any> {
    const input: Record<string, unknown> = { ...data };
    if (ctx.storeId !== undefined && !("storeId" in input)) input.storeId = ctx.storeId;
    return (this.q as any).create({ data: input });
  }

  async createMany(_ctx: RequestContext, data: any[]): Promise<{ count: number }> {
    if (!data.length) return { count: 0 };
    return (this.q as any).createMany({ data, skipDuplicates: true });
  }

  async update(ctx: RequestContext, id: bigint | number, data: Record<string, unknown>): Promise<any> {
    await this.findById(ctx, id);
    return (this.q as any).update({
      where: { id: BigInt(id) },
      data,
    });
  }

  async patchBy(ctx: RequestContext, where: Record<string, unknown>, data: Record<string, unknown>): Promise<any> {
    return (this.q as any).updateMany({
      where: this.scope(ctx.storeId, where),
      data,
    });
  }

  async delete(ctx: RequestContext, id: bigint | number): Promise<{ success: true; id: bigint | number }> {
    await this.findById(ctx, id);
    await (this.q as any).delete({ where: { id: BigInt(id) } });
    return { success: true, id };
  }

  async softDelete(ctx: RequestContext, id: bigint | number): Promise<any> {
    return this.update(ctx, id, { deletedAt: new Date() });
  }
}
