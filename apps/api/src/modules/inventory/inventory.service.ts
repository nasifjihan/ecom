import type { Prisma } from "@prisma/client";
import { prisma, tx } from "../../config";
import { defaultWarehouseId, moveStock } from "../stock";
import { BaseService, type RequestContext, type Paginated, NotFoundError, BadRequestError } from "../../core";
import { InventoryLogRepository } from "./inventory.repository";
import type {
  StockAdjustmentDto,
  MovementQueryDto,
  LowStockReportDto,
} from "./inventory.dto";

export class InventoryService extends BaseService {
  private inventoryLogs: InventoryLogRepository;

  constructor(ctx: RequestContext) {
    super(ctx);
    this.inventoryLogs = new InventoryLogRepository();
  }

  /**
   * Applies stock counts: each line adds or takes units off the shelf of one warehouse (the default
   * one when none is given). A line targets an option (variantId) or a product without options
   * (productId only). Rows are looked up inside the caller's store; the shelf can't go below zero.
   */
  async adjustStock(lines: StockAdjustmentDto): Promise<{ applied: number }> {
    const storeId = this.ctx.storeId;
    if (storeId === undefined) throw new BadRequestError("No store for this request", "STORE_REQUIRED");
    let applied = 0;
    await tx(async (t: Prisma.TransactionClient) => {
      for (const line of lines.lines) {
        let productId: bigint;
        let variantId: bigint | null = null;
        let label: string;
        if (line.variantId !== undefined) {
          variantId = BigInt(line.variantId);
          const variant = await t.productVariant.findFirst({
            where: { id: variantId, product: { storeId } },
            select: { productId: true, product: { select: { name: true } } },
          });
          if (!variant) throw new NotFoundError("productVariant", variantId);
          productId = variant.productId;
          label = variant.product.name;
        } else {
          productId = BigInt(line.productId!);
          const product = await t.product.findFirst({
            where: { id: productId, storeId },
            select: { name: true, _count: { select: { variants: true } } },
          });
          if (!product) throw new NotFoundError("product", productId);
          if (product._count.variants > 0) {
            throw new BadRequestError("This product has options; adjust an option instead", "VARIANT_REQUIRED");
          }
          label = product.name;
        }
        let warehouseId: bigint;
        if (line.warehouseId !== undefined) {
          const w = await t.warehouse.findFirst({ where: { id: BigInt(line.warehouseId), storeId }, select: { id: true } });
          if (!w) throw new NotFoundError("warehouse", line.warehouseId);
          warehouseId = w.id;
        } else {
          warehouseId = await defaultWarehouseId(t, storeId);
        }
        const moved = await moveStock(t, {
          storeId,
          warehouseId,
          sku: { productId, variantId },
          onHand: line.delta,
          guard: line.delta < 0 ? "onHand" : undefined,
          reason: line.reason ?? (line.delta > 0 ? "MANUAL_RESTOCK" : "MANUAL_DEDUCT"),
          note: line.note ?? null,
          label,
        });
        if (!moved.applied) throw new BadRequestError(`"${label}" doesn't track stock; turn on stock tracking first`, "VALIDATION_FAILED");
        applied += 1;
      }
    });
    return { applied };
  }

  /**
   * One row per stock-keeping unit: each variant of a variable product, or the product itself
   * when it has no variants. Built in memory, which is fine for catalogs of a few thousand SKUs.
   */
  async stockList(q: { search?: string; lowStock?: boolean; outOfStock?: boolean; page: number; perPage: number }) {
    const storeId = this.ctx.storeId;
    const where: Record<string, unknown> = { ...(storeId !== undefined ? { storeId } : {}), manageStock: true, deletedAt: null };
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
    // Stock per warehouse, for the breakdown and for "set to" counts in one warehouse.
    const [warehouses, perWarehouse] = await Promise.all([
      prisma.warehouse.findMany({
        where: { ...(storeId !== undefined ? { storeId } : {}) },
        orderBy: [{ isDefault: "desc" }, { sortOrder: "asc" }, { id: "asc" }],
        select: { id: true, code: true, name: true, isDefault: true, isActive: true },
      }),
      prisma.warehouseStock.findMany({
        where: { productId: { in: products.map((p) => p.id) } },
        select: { warehouseId: true, skuKey: true, onHand: true, reserved: true },
      }),
    ]);

    const rows = products.flatMap((p) => {
      const image = p.images[0]?.imageUrl ?? null;
      const make = (v: (typeof p.variants)[number] | null) => {
        const physical = Number((v ? v.stockQty : p.stockQty) ?? 0);
        const reserved = Number((v ? v.reservedStock : p.reservedStock) ?? 0);
        const label = v ? Object.values((v.attributeValues ?? {}) as Record<string, string>).join(" / ") : "";
        return {
          id: v ? `v${v.id}` : `p${p.id}`,
          byWarehouse: warehouses.map((w) => {
            const row = perWarehouse.find((x) => x.warehouseId === w.id && x.skuKey === (v ? `v${v.id}` : `p${p.id}`));
            return { warehouseId: String(w.id), code: w.code, onHand: row?.onHand ?? 0, reserved: row?.reserved ?? 0 };
          }),
          productId: String(p.id),
          variantId: v ? String(v.id) : null,
          productName: label ? `${p.name} (${label})` : p.name,
          sku: (v ? v.sku : p.sku) ?? "",
          imageUrl: (v?.imageUrl ?? image) || null,
          physicalQty: physical,
          reservedQty: reserved,
          availableQty: Math.max(0, physical - reserved),
          lowStockThreshold: (v ? v.lowStockThreshold : null) ?? p.lowStockThreshold ?? 5,
          // Cost price when known (purchases keep it up to date), otherwise the selling price (value at retail).
          unitCost: Number(v?.costPrice ?? p.costPrice ?? p.supplierCost ?? v?.regularPrice ?? p.regularPrice ?? 0),
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
      warehouses: warehouses.map((w) => ({ id: String(w.id), code: w.code, name: w.name, isDefault: w.isDefault, isActive: w.isActive })),
      summary,
      total,
      page: q.page,
      perPage: q.perPage,
      totalPages: Math.max(1, Math.ceil(total / q.perPage)),
    };
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
    const productWhere: Record<string, unknown> = { deletedAt: null };
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
    line: { delta: number; reason?: string; warehouseId?: bigint; note?: string },
  ): Promise<unknown> {
    return this.adjustStock({
      lines: [{ variantId: BigInt(variantId), delta: line.delta, reason: line.reason, warehouseId: line.warehouseId, note: line.note }],
    });
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
