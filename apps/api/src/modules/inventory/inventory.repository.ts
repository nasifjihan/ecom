import { prisma, tx } from "../../config";
import { BaseRepository, NotFoundError, ConflictError, type RequestContext, type Paginated, paginate } from "../../core";
import type { MovementQueryDto, LowStockReportDto } from "./inventory.dto";

export class InventoryLogRepository extends BaseRepository<"inventoryLog"> {
  constructor() {
    super("inventoryLog");
  }

  async deductStock(
    variantId: bigint | number,
    qty: number,
    warehouse: string = "MAIN",
    reason: string,
    txInstance?: any,
  ): Promise<unknown> {
    const vid = BigInt(variantId);
    const run = async (t: any) => {
      const target = await t.productVariant.findFirst({
        where: { id: vid },
      });
      if (!target) throw new NotFoundError("productVariant", vid);
      const qtyBefore = Number(target.stockQty ?? 0);
      if (qtyBefore < qty) {
        throw new ConflictError("OutOfStock: insufficient variant stock", "INSUFFICIENT_STOCK");
      }
      const qtyAfter = qtyBefore - qty;
      await t.productVariant.update({
        where: { id: vid },
        data: {
          stockQty: qtyAfter,
        },
      });
      const productId = target.productId;
      return t.inventoryLog.create({
        data: {
          variantId: vid,
          productId,
          warehouse,
          changeQty: -qty,
          reason,
          qtyBefore,
          qtyAfter,
        },
      });
    };
    return txInstance ? run(txInstance) : tx(run);
  }

  async restock(
    variantId: bigint | number,
    qty: number,
    reason: string,
    txInstance?: any,
  ): Promise<unknown> {
    const vid = BigInt(variantId);
    const run = async (t: any) => {
      const target = await t.productVariant.findFirst({
        where: { id: vid },
      });
      if (!target) throw new NotFoundError("productVariant", vid);
      const qtyBefore = Number(target.stockQty ?? 0);
      const qtyAfter = qtyBefore + qty;
      await t.productVariant.update({
        where: { id: vid },
        data: {
          stockQty: qtyAfter,
        },
      });
      const productId = target.productId;
      return t.inventoryLog.create({
        data: {
          variantId: vid,
          productId,
          changeQty: qty,
          reason,
          qtyBefore,
          qtyAfter,
        },
      });
    };
    return txInstance ? run(txInstance) : tx(run);
  }

  async logMovement(
    variantId: bigint | number,
    productId: bigint | number | undefined,
    delta: number,
    warehouse: string,
    reason: string,
    qtyBefore: number,
    qtyAfter: number,
    referenceId?: bigint | string,
    note?: string | null,
  ): Promise<unknown> {
    const vid = variantId ? BigInt(variantId) : null;
    const pid = productId ? BigInt(productId) : null;
    return (this.q as any).create({
      data: {
        variantId: vid,
        productId: pid,
        warehouse,
        changeQty: delta,
        reason,
        referenceId: referenceId ? String(referenceId) : null,
        note: note ?? null,
        qtyBefore,
        qtyAfter,
      },
    });
  }

  async listMovementPaginated(
    ctx: RequestContext,
    filters: MovementQueryDto & {
      variantId?: bigint;
      productId?: bigint;
      from?: Date;
      to?: Date;
      warehouse?: string;
      reason?: string;
    },
  ): Promise<Paginated<unknown>> {
    const where: Record<string, unknown> = {};
    if (ctx.storeId !== undefined) {
      where.product = { storeId: ctx.storeId };
    }
    if (filters.variantId) where.variantId = BigInt(filters.variantId);
    if (filters.productId) where.productId = BigInt(filters.productId);
    if (filters.warehouse) where.warehouse = filters.warehouse;
    if (filters.reason) where.reason = filters.reason;
    if (filters.from || filters.to) {
      const createdAtWhere: Record<string, unknown> = {};
      if (filters.from) createdAtWhere.gte = filters.from;
      if (filters.to) createdAtWhere.lte = filters.to;
      where.createdAt = createdAtWhere;
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
          product: { select: { id: true, name: true, sku: true } },
          variant: { select: { id: true, sku: true, attributeValues: true } },
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

  async lowStockReport(
    ctx: RequestContext,
    threshold: number = 10,
    opts?: { productId?: bigint; brandId?: bigint; categoryId?: bigint },
  ): Promise<unknown[]> {
    const variantWhere: Record<string, unknown> = {};
    const productWhere: Record<string, unknown> = {};
    if (ctx.storeId !== undefined) {
      productWhere.storeId = ctx.storeId;
    }
    if (opts?.productId) productWhere.id = BigInt(opts.productId);
    if (opts?.brandId) productWhere.brandId = BigInt(opts.brandId);
    if (opts?.categoryId) {
      productWhere.categories = {
        some: { categoryId: BigInt(opts.categoryId) },
      };
    }

    const variants = await prisma.productVariant.findMany({
      where: {
        manageStock: true,
        product: productWhere,
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            brand: { select: { id: true, name: true } },
          },
        },
      },
    });

    const results: unknown[] = [];
    for (const v of variants) {
      const stockThreshold = Number(v.lowStockThreshold ?? 10);
      const effectiveThreshold = stockThreshold > threshold ? stockThreshold : threshold;
      const currentStock = Number(v.stockQty ?? 0);
      if (currentStock <= effectiveThreshold) {
        results.push({
          variantId: v.id,
          productId: v.productId,
          product: v.product,
          sku: v.sku,
          attributeValues: v.attributeValues,
          stockQty: currentStock,
          lowStockThreshold: stockThreshold,
          effectiveThreshold,
        });
      }
    }

    const products = await prisma.product.findMany({
      where: {
        ...productWhere,
        manageStock: true,
        variants: { none: {} },
      },
      include: {
        brand: { select: { id: true, name: true } },
      },
    });

    for (const p of products) {
      const stockThreshold = Number(p.lowStockThreshold ?? 10);
      const effectiveThreshold = stockThreshold > threshold ? stockThreshold : threshold;
      const currentStock = Number(p.stockQty ?? 0);
      if (currentStock <= effectiveThreshold) {
        results.push({
          productId: p.id,
          product: { id: p.id, name: p.name, sku: p.sku, brand: p.brand },
          sku: p.sku,
          stockQty: currentStock,
          lowStockThreshold: stockThreshold,
          effectiveThreshold,
        });
      }
    }

    return results.sort((a: any, b: any) => a.stockQty - b.stockQty);
  }
}

export class InventoryRepository {
  async adjustStockQtyVariantOrProduct(
    _ctx: RequestContext,
    variantId: bigint | number,
    delta: number,
    qtyAfter: number,
    txInstance?: any,
  ): Promise<void> {
    const vid = BigInt(variantId);
    const run = async (t: any) => {
      await t.productVariant.update({
        where: { id: vid },
        data: { stockQty: qtyAfter },
      });
    };
    return txInstance ? run(txInstance) : tx(run);
  }
}
