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

  async adjustStock(lines: StockAdjustmentDto): Promise<unknown[]> {
    const results: unknown[] = [];
    await tx(async (t: any) => {
      for (const line of lines.lines) {
        const vid = BigInt(line.variantId);
        const variant = await prisma.productVariant.findFirst({
          where: { id: vid },
        });
        if (!variant) throw new NotFoundError("productVariant", vid);

        const qtyBefore = Number(variant.stockQty ?? 0);
        const qtyAfter = qtyBefore + line.delta;
        if (qtyAfter < 0) {
          throw new BadRequestError(`Insufficient stock for variant ${vid}: have ${qtyBefore}, need ${-line.delta}`, "INSUFFICIENT_STOCK");
        }

        await this.inventory.adjustStockQtyVariantOrProduct(this.ctx, vid, line.delta, qtyAfter, t);

        const warehouse = line.warehouse ?? "MAIN";
        const reason = line.reason ?? (line.delta > 0 ? "MANUAL_RESTOCK" : "MANUAL_DEDUCT");
        const log = await t.inventoryLog.create({
          data: {
            variantId: vid,
            productId: line.productId ? BigInt(line.productId) : variant.productId,
            warehouse,
            changeQty: line.delta,
            reason,
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

  async transferStock(dto: StockTransferDto): Promise<{ originLogs: unknown[]; destLogs: unknown[] }> {
    const originLogs: unknown[] = [];
    const destLogs: unknown[] = [];

    await tx(async (t: any) => {
      for (const line of dto.lines) {
        const vid = BigInt(line.variantId);
        const variant = await prisma.productVariant.findFirst({
          where: { id: vid },
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
