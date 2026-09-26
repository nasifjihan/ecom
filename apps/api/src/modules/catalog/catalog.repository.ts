import { prisma } from "../../config";
import { BaseRepository, NotFoundError, type RequestContext, type Paginated, paginate } from "../../core";
import type { ProductSearchQueryDto } from "./catalog.dto";

export class ProductRepository extends BaseRepository<"product"> {
  constructor() {
    super("product");
  }

  async findFull(ctx: RequestContext, id: bigint | number): Promise<unknown> {
    const row = await (this.q as any).findFirst({
      where: { id: BigInt(id), ...(ctx.storeId !== undefined ? { storeId: ctx.storeId } : {}) },
      include: {
        brand: true,
        categories: { include: { category: true } },
        images: { orderBy: { sortOrder: "asc" } },
        variants: { orderBy: { createdAt: "asc" } },
        attributes: { include: { attribute: true, terms: { include: { term: true } } } },
      },
    });
    if (!row) throw new NotFoundError("product", id);
    return row;
  }

  async findBySlug(ctx: RequestContext, slug: string, include?: unknown): Promise<unknown | null> {
    return this.findBy(ctx, { slug }, include);
  }

  async listWithJoins(
    ctx: RequestContext,
    filters: ProductSearchQueryDto & {
      status?: string;
      categoryId?: bigint;
      brandId?: bigint;
      minPrice?: number;
      maxPrice?: number;
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
    if (filters.brandId) where.brandId = BigInt(filters.brandId);
    if (filters.categoryId) {
      where.categories = { some: { categoryId: BigInt(filters.categoryId) } };
    }
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: "insensitive" } },
        { slug: { contains: filters.search, mode: "insensitive" } },
        { sku: { contains: filters.search, mode: "insensitive" } },
      ];
    }
    const priceWhere: Record<string, unknown> = {};
    if (filters.minPrice !== undefined) priceWhere.gte = filters.minPrice;
    if (filters.maxPrice !== undefined) priceWhere.lte = filters.maxPrice;
    if (Object.keys(priceWhere).length) where.regularPrice = priceWhere;

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
          brand: { select: { id: true, name: true, slug: true } },
          categories: { include: { category: { select: { id: true, name: true, slug: true } } } },
          images: { orderBy: { sortOrder: "asc" }, take: 1 },
          _count: { select: { variants: true, reviews: true } },
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
}

export class ProductVariantRepository extends BaseRepository<"productVariant"> {
  constructor() {
    super("productVariant");
  }

  async listForProduct(ctx: RequestContext, productId: bigint | number): Promise<unknown[]> {
    return this.list(ctx, { productId: BigInt(productId) }, { orderBy: { sortOrder: "asc" } });
  }
}

type CategoryRow = {
  id: bigint;
  parentId: bigint | null;
  children?: CategoryRow[];
  [key: string]: unknown;
};

function buildTree(rows: CategoryRow[]): CategoryRow[] {
  const map = new Map<bigint, CategoryRow>();
  const roots: CategoryRow[] = [];
  for (const row of rows) {
    map.set(BigInt(row.id), { ...row, children: [] });
  }
  for (const row of rows) {
    const node = map.get(BigInt(row.id))!;
    if (row.parentId === null || row.parentId === undefined) {
      roots.push(node);
    } else {
      const parent = map.get(BigInt(row.parentId));
      if (parent) {
        (parent.children as CategoryRow[]).push(node);
      } else {
        roots.push(node);
      }
    }
  }
  return roots;
}

export class CategoryRepository extends BaseRepository<"category"> {
  constructor() {
    super("category");
  }

  async findBySlugParent(ctx: RequestContext, slug: string, parentId: bigint | null | undefined): Promise<unknown | null> {
    const where: Record<string, unknown> = { slug };
    if (parentId === undefined || parentId === null) {
      where.parentId = null;
    } else {
      where.parentId = BigInt(parentId);
    }
    return this.findBy(ctx, where);
  }

  async findTree(ctx: RequestContext): Promise<unknown[]> {
    // Admin-only tree: inactive categories must stay visible so they can be re-enabled.
    const all = await this.list(ctx, {}, {
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { products: true } } },
    });
    return buildTree(all as CategoryRow[]);
  }

  async findAncestorsChain(ctx: RequestContext, id: bigint | number): Promise<unknown[]> {
    const chain: unknown[] = [];
    let current: unknown = await this.findById(ctx, id);
    while (current) {
      chain.unshift(current);
      const curr = current as CategoryRow;
      if (curr.parentId) {
        current = await this.findBy(ctx, { id: BigInt(curr.parentId) });
      } else {
        break;
      }
    }
    return chain;
  }

  async hasChildren(ctx: RequestContext, id: bigint | number): Promise<boolean> {
    const count = await (this.q as any).count({
      where: {
        ...(ctx.storeId !== undefined ? { storeId: ctx.storeId } : {}),
        parentId: BigInt(id),
      },
    });
    return count > 0;
  }

  async reorderChildren(ctx: RequestContext, parentId: bigint | null, orderedIds: bigint[]): Promise<any[]> {
    const updates = orderedIds.map((id, idx) =>
      (this.q as any).update({
        where: {
          id: BigInt(id),
          ...(ctx.storeId !== undefined ? { storeId: ctx.storeId } : {}),
        },
        data: { sortOrder: idx, parentId: parentId === null ? null : BigInt(parentId) },
      }),
    );
    return Promise.all(updates);
  }
}

export class BrandRepository extends BaseRepository<"brand"> {
  constructor() {
    super("brand");
  }

  async findBySlug(ctx: RequestContext, slug: string): Promise<unknown | null> {
    return this.findBy(ctx, { slug });
  }

  async listActive(ctx: RequestContext): Promise<unknown[]> {
    return this.list(ctx, { isActive: true }, { orderBy: { sortOrder: "asc" } });
  }
}

export class AttributeRepository extends BaseRepository<"attribute"> {
  constructor() {
    super("attribute");
  }

  async findBySlug(ctx: RequestContext, slug: string): Promise<unknown | null> {
    return this.findBy(ctx, { slug });
  }

  async listFullWithOptions(ctx: RequestContext): Promise<unknown[]> {
    const opts: Record<string, unknown> = {
      orderBy: { sortOrder: "asc" },
      include: { terms: { orderBy: { sortOrder: "asc" } } },
    };
    return this.list(ctx, { isActive: true }, opts);
  }

  async findWithTerms(ctx: RequestContext, id: bigint | number): Promise<unknown> {
    const row = await (this.q as any).findFirst({
      where: {
        id: BigInt(id),
        ...(ctx.storeId !== undefined ? { storeId: ctx.storeId } : {}),
      },
      include: { terms: { orderBy: { sortOrder: "asc" } } },
    });
    if (!row) throw new NotFoundError("attribute", id);
    return row;
  }
}

export class ProductImageRepository extends BaseRepository<"productImage"> {
  constructor() {
    super("productImage");
  }

  async setGalleryOrder(ctx: RequestContext, productId: bigint | number, orderedMediaIds: bigint[]): Promise<unknown[]> {
    void ctx;
    const updates = orderedMediaIds.map((mediaId, idx) =>
      prisma.productImage.updateMany({
        where: {
          productId: BigInt(productId),
          OR: [{ id: BigInt(mediaId) }, { mediaId: BigInt(mediaId) }],
        },
        data: { sortOrder: idx },
      }),
    );
    return Promise.all(updates);
  }
}
