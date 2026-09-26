import { prisma, tx } from "../../config";
import { BaseService, type RequestContext, type Paginated, NotFoundError, BadRequestError } from "../../core";
import { InventoryLogRepository, InventoryRepository } from "./inventory.repository";
import type {
  StockAdjustmentDto,
  StockTransferDto,
  MovementQueryDto,
  LowStockReportDto,
} from "./inventory.dto";

export class InventoryService extends BaseService {
  private inventoryLogs: InventoryLogRepository;
  private inventory: InventoryRepository;

  constructor(ctx: RequestContext) {
    super(ctx);
    this.inventoryLogs = new InventoryLogRepository();
    this.inventory = new InventoryRepository();
  }

  /**
   * Applies stock deltas. A line targets a variant (variantId) or, for a simple product
   * without variants, the product itself (productId only). Rows are looked up inside the
   * caller's store, so one store's admin can never touch another store's stock.
   */
  async adjustStock(lines: StockAdjustmentDto): Promise<unknown[]> {
    const storeId = this.ctx.storeId;
    const results: unknown[] = [];
    await tx(async (t: any) => {
      for (const line of lines.lines) {
        let productId: bigint;
        let variantId: bigint | null = null;
        let qtyBefore: number;

        if (line.variantId !== undefined) {
          variantId = BigInt(line.variantId);
          const variant = await t.productVariant.findFirst({
            where: { id: variantId, ...(storeId !== undefined ? { product: { storeId } } : {}) },
          });
          if (!variant) throw new NotFoundError("productVariant", variantId);
          productId = variant.productId;
          qtyBefore = Number(variant.stockQty ?? 0);
        } else {
          productId = BigInt(line.productId!);
          const product = await t.product.findFirst({
            where: { id: productId, ...(storeId !== undefined ? { storeId } : {}) },
            include: { _count: { select: { variants: true } } },
          });
          if (!product) throw new NotFoundError("product", productId);
          if (product._count.variants > 0) {
            throw new BadRequestError("This product has variants; adjust a variant instead", "VARIANT_REQUIRED");
          }
          qtyBefore = Number(product.stockQty ?? 0);
        }

        const qtyAfter = qtyBefore + line.delta;
        if (qtyAfter < 0) {
          throw new BadRequestError(`Insufficient stock: have ${qtyBefore}, need ${-line.delta}`, "INSUFFICIENT_STOCK");
        }

        if (variantId !== null) {
          await t.productVariant.update({ where: { id: variantId }, data: { stockQty: qtyAfter } });
          // Keep the parent's aggregate in step with its variants (used by listings and low-stock reports).
          const sum = await t.productVariant.aggregate({ where: { productId }, _sum: { stockQty: true } });
          await t.product.update({ where: { id: productId }, data: { stockQty: sum._sum.stockQty ?? 0 } });
        } else {
          await t.product.update({ where: { id: productId }, data: { stockQty: qtyAfter } });
        }

        const log = await t.inventoryLog.create({
          data: {
            variantId,
            productId,
            warehouse: line.warehouse ?? "MAIN",
            changeQty: line.delta,
            reason: line.reason ?? (line.delta > 0 ? "MANUAL_RESTOCK" : "MANUAL_DEDUCT"),
            referenceId: null,
            note: line.note ?? null,
            qtyBefore,
            qtyAfter,
          },
        });
        results.push(log);
      }
    });
    return results;
  }

  /**
   * One row per stock-keeping unit: each variant of a variable product, or the product itself
   * when it has no variants. Built in memory, which is fine for catalogs of a few thousand SKUs.
   */
  async stockList(q: { search?: string; lowStock?: boolean; outOfStock?: boolean; page: number; perPage: number }) {
    const storeId = this.ctx.storeId;
    const where: Record<string, unknown> = { ...(storeId !== undefined ? { storeId } : {}), manageStock: true };
    if (q.search) {
      where.OR = [
        { name: { contains: q.search, mode: "insensitive" } },
        { sku: { contains: q.search, mode: "insensitive" } },
        { variants: { some: { sku: { contains: q.search, mode: "insensitive" } } } },
      ];
    }
    const products = await prisma.product.findMany({
      where: where as any,
      orderBy: { name: "asc" },
      include: {
        variants: { orderBy: { id: "asc" } },
        images: { orderBy: { sortOrder: "asc" }, take: 1 },
      },
    });
    const lastLogs = await prisma.inventoryLog.groupBy({
      by: ["productId", "variantId"],
      where: { productId: { in: products.map((p) => p.id) } },
      _max: { createdAt: true },
    });
    const lastAt = new Map(lastLogs.map((l) => [`${l.productId}:${l.variantId ?? ""}`, l._max.createdAt]));

    const rows = products.flatMap((p) => {
      const image = p.images[0]?.imageUrl ?? null;
      const make = (v: (typeof p.variants)[number] | null) => {
        const physical = Number((v ? v.stockQty : p.stockQty) ?? 0);
        const reserved = Number((v ? v.reservedStock : p.reservedStock) ?? 0);
        const label = v ? Object.values((v.attributeValues ?? {}) as Record<string, string>).join(" / ") : "";
        return {
          id: v ? `v${v.id}` : `p${p.id}`,
          productId: String(p.id),
          variantId: v ? String(v.id) : null,
          productName: label ? `${p.name} (${label})` : p.name,
          sku: (v ? v.sku : p.sku) ?? "",
          imageUrl: (v?.imageUrl ?? image) || null,
          physicalQty: physical,
          reservedQty: reserved,
          availableQty: Math.max(0, physical - reserved),
          lowStockThreshold: (v ? v.lowStockThreshold : null) ?? p.lowStockThreshold ?? 5,
          // Supplier cost when known, otherwise the selling price (so value is at retail).
          unitCost: Number(p.supplierCost ?? v?.regularPrice ?? p.regularPrice ?? 0),
          lastAdjustedAt: lastAt.get(`${p.id}:${v ? v.id : ""}`) ?? null,
        };
      };
      return p.variants.length ? p.variants.map(make) : [make(null)];
    });

    const summary = {
      totalSkus: rows.length,
      totalStockValue: Math.round(rows.reduce((s, r) => s + r.physicalQty * r.unitCost, 0) * 100) / 100,
      outOfStockCount: rows.filter((r) => r.availableQty === 0).length,
      lowStockCount: rows.filter((r) => r.availableQty > 0 && r.availableQty <= r.lowStockThreshold).length,
    };
    const filtered = rows.filter((r) => {
      if (q.outOfStock && r.availableQty !== 0) return false;
      if (q.lowStock && !(r.availableQty > 0 && r.availableQty <= r.lowStockThreshold)) return false;
      return true;
    });
    const total = filtered.length;
    const start = (q.page - 1) * q.perPage;
    return {
      items: filtered.slice(start, start + q.perPage),
      summary,
      total,
      page: q.page,
      perPage: q.perPage,
      totalPages: Math.max(1, Math.ceil(total / q.perPage)),
    };
  }

  async transferStock(dto: StockTransferDto): Promise<{ originLogs: unknown[]; destLogs: unknown[] }> {
    const originLogs: unknown[] = [];
    const destLogs: unknown[] = [];

    await tx(async (t: any) => {
      for (const line of dto.lines) {
        if (line.variantId === undefined) throw new BadRequestError("Transfers need a variantId", "VARIANT_REQUIRED");
        const vid = BigInt(line.variantId);
        const variant = await prisma.productVariant.findFirst({
          where: { id: vid, ...(this.ctx.storeId !== undefined ? { product: { storeId: this.ctx.storeId } } : {}) },
        });
        if (!variant) throw new NotFoundError("productVariant", vid);

        const qtyBefore = Number(variant.stockQty ?? 0);
        const transferQty = Math.abs(line.delta || 1);
        if (qtyBefore < transferQty) {
          throw new BadRequestError(
            `Insufficient stock at origin for variant ${vid}: have ${qtyBefore}, need ${transferQty}`,
            "INSUFFICIENT_STOCK",
          );
        }
        const qtyAfter = qtyBefore - transferQty;

        await t.productVariant.update({
          where: { id: vid },
          data: { stockQty: qtyAfter },
        });

        const deductReason = "TRANSFER_OUT";
        const originLog = await t.inventoryLog.create({
          data: {
            variantId: vid,
            productId: line.productId ? BigInt(line.productId) : variant.productId,
            warehouse: dto.originWarehouse,
            changeQty: -transferQty,
            reason: deductReason,
            referenceId: null,
            note: `Transfer to ${dto.destWarehouse}`,
            qtyBefore,
            qtyAfter,
          },
        });
        originLogs.push(originLog);

        const destQtyBefore = qtyAfter;
        const destQtyAfter = destQtyBefore + transferQty;
        await t.productVariant.update({
          where: { id: vid },
          data: { stockQty: destQtyAfter },
        });

        const addReason = "TRANSFER_IN";
        const destLog = await t.inventoryLog.create({
          data: {
            variantId: vid,
            productId: line.productId ? BigInt(line.productId) : variant.productId,
            warehouse: dto.destWarehouse,
            changeQty: transferQty,
            reason: addReason,
            referenceId: null,
            note: `Transfer from ${dto.originWarehouse}`,
            qtyBefore: destQtyBefore,
            qtyAfter: destQtyAfter,
          },
        });
        destLogs.push(destLog);
      }
    });

    return { originLogs, destLogs };
  }

  async movementReport(filters: MovementQueryDto): Promise<Paginated<unknown>> {
    return this.inventoryLogs.listMovementPaginated(this.ctx, filters);
  }

  async lowStockReport(dto: LowStockReportDto): Promise<unknown[]> {
    return this.inventoryLogs.lowStockReport(
      this.ctx,
      dto.threshold ?? 10,
      {
        productId: dto.productId,
        brandId: dto.brandId,
        categoryId: dto.categoryId,
      },
    );
  }

  async stockValueReport(): Promise<{
    totalValue: number;
    byCategory: { categoryId: bigint | null; categoryName: string | null; value: number; count: number }[];
    byBrand: { brandId: bigint | null; brandName: string | null; value: number; count: number }[];
  }> {
    const storeId = this.ctx.storeId;
    const variantWhere: Record<string, unknown> = {};
    const productWhere: Record<string, unknown> = {};
    if (storeId !== undefined) productWhere.storeId = storeId;

    const variants = await prisma.productVariant.findMany({
      where: variantWhere,
      include: {
        product: {
          include: {
            brand: { select: { id: true, name: true } },
            categories: { include: { category: { select: { id: true, name: true } } } },
          },
        },
      },
    });

    let totalValue = 0;
    const byCategoryMap = new Map<string, { categoryId: bigint | null; categoryName: string | null; value: number; count: number }>();
    const byBrandMap = new Map<string, { brandId: bigint | null; brandName: string | null; value: number; count: number }>();

    for (const v of variants) {
      const stockQty = Number(v.stockQty ?? 0);
      const unitCost = Number(v.regularPrice ?? v.product.regularPrice ?? 0);
      const lineValue = stockQty * unitCost;
      totalValue += lineValue;

      const primaryCategory = v.product.categories?.[0]?.category;
      const catKey = primaryCategory ? String(primaryCategory.id) : "null";
      if (!byCategoryMap.has(catKey)) {
        byCategoryMap.set(catKey, {
          categoryId: primaryCategory?.id ?? null,
          categoryName: primaryCategory?.name ?? null,
          value: 0,
          count: 0,
        });
      }
      const catBucket = byCategoryMap.get(catKey)!;
      catBucket.value += lineValue;
      catBucket.count += stockQty;

      const brand = v.product.brand;
      const brandKey = brand ? String(brand.id) : "null";
      if (!byBrandMap.has(brandKey)) {
        byBrandMap.set(brandKey, {
          brandId: brand?.id ?? null,
          brandName: brand?.name ?? null,
          value: 0,
          count: 0,
        });
      }
      const brandBucket = byBrandMap.get(brandKey)!;
      brandBucket.value += lineValue;
      brandBucket.count += stockQty;
    }

    const simpleProducts = await prisma.product.findMany({
      where: {
        ...productWhere,
        variants: { none: {} },
      },
      include: {
        brand: { select: { id: true, name: true } },
        categories: { include: { category: { select: { id: true, name: true } } } },
      },
    });

    for (const p of simpleProducts) {
      const stockQty = Number(p.stockQty ?? 0);
      const unitCost = Number(p.regularPrice ?? 0);
      const lineValue = stockQty * unitCost;
      totalValue += lineValue;

      const primaryCategory = p.categories?.[0]?.category;
      const catKey = primaryCategory ? String(primaryCategory.id) : "null";
      if (!byCategoryMap.has(catKey)) {
        byCategoryMap.set(catKey, {
          categoryId: primaryCategory?.id ?? null,
          categoryName: primaryCategory?.name ?? null,
          value: 0,
          count: 0,
        });
      }
      const catBucket = byCategoryMap.get(catKey)!;
      catBucket.value += lineValue;
      catBucket.count += stockQty;

      const brand = p.brand;
      const brandKey = brand ? String(brand.id) : "null";
      if (!byBrandMap.has(brandKey)) {
        byBrandMap.set(brandKey, {
          brandId: brand?.id ?? null,
          brandName: brand?.name ?? null,
          value: 0,
          count: 0,
        });
      }
      const brandBucket = byBrandMap.get(brandKey)!;
      brandBucket.value += lineValue;
      brandBucket.count += stockQty;
    }

    return {
      totalValue: Math.round(totalValue * 100) / 100,
      byCategory: Array.from(byCategoryMap.values()),
      byBrand: Array.from(byBrandMap.values()),
    };
  }

  async importStockCount(
    _file?: { buffer: Uint8Array; originalName: string; mimeType: string },
  ): Promise<{ imported: number; skipped: number; errors: unknown[] }> {
    void _file;
    return { imported: 0, skipped: 0, errors: [] };
  }

  async variantInventoryById(variantId: bigint | number): Promise<unknown> {
    const vid = BigInt(variantId);
    const storeId = this.ctx.storeId;
    const variant = await prisma.productVariant.findFirst({
      where: {
        id: vid,
        ...(storeId !== undefined ? { product: { storeId } } : {}),
      },
      include: {
        product: {
          select: { id: true, name: true, sku: true, manageStock: true, stockQty: true, lowStockThreshold: true },
        },
      },
    });
    if (!variant) throw new NotFoundError("productVariant", vid);

    const recentMovements = await prisma.inventoryLog.findMany({
      where: { variantId: vid },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return {
      variant: {
        id: variant.id,
        sku: variant.sku,
        manageStock: variant.manageStock,
        stockQty: Number(variant.stockQty ?? 0),
        reservedStock: Number(variant.reservedStock ?? 0),
        lowStockThreshold: variant.lowStockThreshold ?? null,
        product: variant.product,
      },
      recentMovements,
    };
  }

  async adjustVariant(
    variantId: bigint | number,
    line: { delta: number; reason?: string; warehouse?: string; note?: string },
  ): Promise<unknown> {
    const result = await this.adjustStock({
      lines: [{ variantId: BigInt(variantId), delta: line.delta, reason: line.reason, warehouse: line.warehouse, note: line.note }],
    });
    return result[0];
  }

  async getMovement(id: bigint | number): Promise<unknown> {
    const mid = BigInt(id);
    const row = await prisma.inventoryLog.findFirst({
      where: { id: mid },
      include: {
        product: { select: { id: true, name: true, sku: true } },
        variant: { select: { id: true, sku: true } },
      },
    });
    if (!row) throw new NotFoundError("inventoryLog", mid);
    return row;
  }
}
