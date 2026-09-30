import { getStorageProvider } from "../../services/storage";
import type { StorageProvider } from "../../services/storage";
import { prisma, tx, cacheGet, cacheSet, cacheDel, CACHE_KEYS } from "../../config";
import { recordMove } from "../redirects";
import {
  BaseService,
  ConflictError,
  NotFoundError,
  BadRequestError,
  mergeTranslations,
  type RequestContext,
  type Paginated,
} from "../../core";
import {
  ProductRepository,
  ProductVariantRepository,
  CategoryRepository,
  BrandRepository,
  AttributeRepository,
  ProductImageRepository,
} from "./catalog.repository";
import type {
  CreateProductDto,
  UpdateProductDto,
  ProductSearchQueryDto,
  CreateCategoryDto,
  UpdateCategoryDto,
  CreateBrandDto,
  UpdateBrandDto,
  CreateAttributeDto,
  UpdateAttributeDto,
  CreateAttributeTermDto,
  CreateProductVariantDto,
  UpdateProductVariantDto,
} from "./catalog.dto";
import type { Prisma } from "@prisma/client";
import { slugify } from "@ecom/utils";
import { resyncProductTotals, setStockTotal } from "../stock";

function randomAlphanum(length: number): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function sanitizeFilename(originalName: string): string {
  const ext = originalName.includes(".") ? originalName.slice(originalName.lastIndexOf(".")) : "";
  const base = originalName.includes(".") ? originalName.slice(0, originalName.lastIndexOf(".")) : originalName;
  const safeBase = base
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  return `${safeBase || "file"}${ext}`;
}

export class CatalogService extends BaseService {
  private products: ProductRepository;
  private variants: ProductVariantRepository;
  private categories: CategoryRepository;
  private brands: BrandRepository;
  private attributes: AttributeRepository;
  private productImages: ProductImageRepository;
  private storageProvider: StorageProvider;

  constructor(ctx: RequestContext) {
    super(ctx);
    this.products = new ProductRepository();
    this.variants = new ProductVariantRepository();
    this.categories = new CategoryRepository();
    this.brands = new BrandRepository();
    this.attributes = new AttributeRepository();
    this.productImages = new ProductImageRepository();
    this.storageProvider = getStorageProvider();
  }

  private generateUniqueSlug(base: string, checkExists: (slug: string) => Promise<boolean>): Promise<string> {
    const trySlug = async (attempt: number): Promise<string> => {
      if (attempt > 50) {
        throw new ConflictError("Slug exhausted after 50 attempts — choose a different name", "DUPLICATE_SLUG");
      }
      const candidate = attempt === 1 ? base : `${base}-${attempt}`;
      const exists = await checkExists(candidate);
      if (!exists) return candidate;
      return trySlug(attempt + 1);
    };
    return trySlug(1);
  }

  private async checkVariantSkuUniqueness(storeId: bigint, sku: string, excludeVariantId?: bigint): Promise<void> {
    const where: Record<string, unknown> = { sku, product: { storeId } };
    if (excludeVariantId !== undefined) where.NOT = { id: excludeVariantId };
    const existing = await prisma.productVariant.findFirst({ where });
    if (existing) {
      throw new ConflictError(`SKU already taken: ${sku}`, "DUPLICATE_SKU");
    }
  }

  private invalidateCategoryCache(): Promise<number> {
    if (this.ctx.storeId === undefined) return Promise.resolve(0);
    return cacheDel(CACHE_KEYS.categories(String(this.ctx.storeId)));
  }

  private invalidateProductCache(id: bigint | number): Promise<number> {
    void id;
    if (this.ctx.storeId === undefined) return Promise.resolve(0);
    return cacheDel(CACHE_KEYS.products(String(this.ctx.storeId)));
  }

  async createProduct(dto: CreateProductDto) {
    const storeId = this.ctx.storeId!;

    const baseSlug = dto.slug ?? slugify(dto.name);
    const uniqueSlug = await this.generateUniqueSlug(baseSlug, async (s) => {
      const row = await prisma.product.findFirst({ where: { storeId, slug: s } });
      return row !== null;
    });

    const variantSkus = dto.variants.filter((v) => v.sku && v.sku.length > 0).map((v) => v.sku as string);
    for (const sku of variantSkus) {
      const dup = await prisma.productVariant.findFirst({
        where: { sku, product: { storeId } },
      });
      if (dup) throw new ConflictError(`SKU already taken: ${sku}`, "DUPLICATE_SKU");
    }

    const result = await tx(async (t: any) => {
      const productData: Record<string, unknown> = {
        storeId,
        type: dto.type,
        name: dto.name,
        slug: uniqueSlug,
        sku: dto.sku ?? null,
        barcode: dto.barcode ?? null,
        shortDescription: dto.shortDescription ?? null,
        description: dto.description ?? null,
        translations: mergeTranslations(null, dto.translations ?? {}),
        tags: dto.tags,
        specifications: dto.specifications.length ? dto.specifications : undefined,
        regularPrice: dto.regularPrice ?? null,
        salePrice: dto.salePrice ?? null,
        costPrice: dto.costPrice ?? null,
        commissionRate: dto.commissionRate ?? null,
        salePriceStartAt: dto.salePriceStartAt ?? null,
        salePriceEndAt: dto.salePriceEndAt ?? null,
        manageStock: dto.manageStock,
        // Stock goes in through the ledger below (default warehouse), never written directly.
        stockQty: 0,
        allowBackorder: dto.allowBackorder,
        lowStockThreshold: dto.lowStockThreshold ?? null,
        weight: dto.weight ?? null,
        length: dto.length ?? null,
        width: dto.width ?? null,
        height: dto.height ?? null,
        sourcing: dto.sourcing ?? null,
        originCountry: dto.sourcing === "imported" ? (dto.originCountry ?? null) : null,
        brandId: dto.brandId ?? null,
        taxClassId: dto.taxClassId ?? null,
        isDigital: dto.isDigital,
        digitalFileId: dto.digitalFileId ?? null,
        downloadLimit: dto.downloadLimit ?? null,
        downloadExpiryDays: dto.downloadExpiryDays ?? null,
        virtual: dto.virtual,
        individuallySold: dto.individuallySold,
        requireShipping: dto.requireShipping,
        status: dto.status,
        createdById: this.ctx.admin?.id ?? null,
        updatedById: this.ctx.admin?.id ?? null,
        featured: dto.featured,
        allowReviews: dto.allowReviews,
        seoTitle: dto.seoTitle ?? null,
        metaDesc: dto.metaDesc ?? null,
        canonicalUrl: dto.canonicalUrl ?? null,
        ogImageUrl: dto.ogImageUrl ?? null,
        supplierId: dto.supplierId ?? null,
        supplierCost: dto.supplierCost ?? null,
        supplierSku: dto.supplierSku ?? null,
        fulfillmentType: dto.fulfillmentType,
      };
      const db = t as Prisma.TransactionClient;
      const product = await db.product.create({ data: productData as Prisma.ProductUncheckedCreateInput });

      if (dto.categoryIds && dto.categoryIds.length > 0) {
        await t.productCategory.createMany({
          data: dto.categoryIds.map((cid: bigint, idx: number) => ({
            productId: product.id,
            categoryId: BigInt(cid),
            primary: idx === 0,
          })),
        });
      }

      if (dto.variants && dto.variants.length > 0) {
        for (const v of dto.variants as CreateProductVariantDto[]) {
          const created = await db.productVariant.create({
            data: {
            productId: product.id,
            attributeValues: v.attributeValues as Prisma.InputJsonValue,
            sku: v.sku ?? null,
            barcode: v.barcode ?? null,
            regularPrice: v.regularPrice ?? null,
            salePrice: v.salePrice ?? null,
            costPrice: v.costPrice ?? null,
            salePriceStartAt: v.salePriceStartAt ?? null,
            salePriceEndAt: v.salePriceEndAt ?? null,
            manageStock: v.manageStock,
            stockQty: 0,
            allowBackorder: v.allowBackorder,
            lowStockThreshold: v.lowStockThreshold ?? null,
            imageUrl: v.imageUrl ?? null,
            weight: v.weight ?? null,
            length: v.length ?? null,
            width: v.width ?? null,
            height: v.height ?? null,
            status: v.status,
            },
          });
          await setStockTotal(db, storeId, { productId: product.id, variantId: created.id }, v.stockQty, dto.name);
        }
      } else {
        await setStockTotal(db, storeId, { productId: product.id, variantId: null }, dto.stockQty, dto.name);
      }

      if (dto.imageUrls && dto.imageUrls.length > 0) {
        await t.productImage.createMany({
          data: dto.imageUrls.map((url: string, idx: number) => ({
            productId: product.id,
            imageUrl: url,
            sortOrder: idx,
          })),
        });
      }

      return product;
    });

    await this.invalidateProductCache(result.id);
    return this.products.findFull(this.ctx, result.id);
  }

  async updateProduct(id: bigint | number, dto: UpdateProductDto) {
    const storeId = this.ctx.storeId!;
    const productId = BigInt(id);

    const existing = await prisma.product.findFirst({ where: { id: productId, storeId } });
    if (!existing) throw new NotFoundError("product", id);
    if (existing.deletedAt) throw new BadRequestError("This product is in the Trash. Restore it before changing it.", "VALIDATION_FAILED");

    let uniqueSlug: string | undefined = undefined;
    if (dto.slug !== undefined && dto.slug !== existing.slug) {
      const baseSlug = dto.slug;
      uniqueSlug = await this.generateUniqueSlug(baseSlug, async (s) => {
        if (s === existing.slug) return false;
        const row = await prisma.product.findFirst({ where: { storeId, slug: s } });
        return row !== null;
      });
    }

    if (dto.variants !== undefined) {
      // This product's own variants are being updated, so only other products' SKUs conflict.
      for (const v of dto.variants) {
        if (v.sku) {
          const dup = await prisma.productVariant.findFirst({
            where: { sku: v.sku, product: { storeId }, NOT: { productId } },
          });
          if (dup) throw new ConflictError(`SKU already taken: ${v.sku}`, "DUPLICATE_SKU");
        }
      }
    }

    await tx(async (t: any) => {
      const db = t as Prisma.TransactionClient;
      const updateData: Record<string, unknown> = {};
      for (const key of Object.keys(dto)) {
        if (key === "categoryIds" || key === "variants" || key === "imageUrls" || key === "slug") continue;
        // Stock only changes through the ledger (below), and holds only through orders.
        if (key === "stockQty" || key === "reservedStock") continue;
        if (key === "translations") {
          updateData.translations = mergeTranslations(existing.translations, dto.translations ?? {});
          continue;
        }
        (updateData as any)[key] = (dto as any)[key];
      }
      if (uniqueSlug !== undefined) updateData.slug = uniqueSlug;
      updateData.updatedById = this.ctx.admin?.id ?? null;

      if (Object.keys(updateData).length > 0) {
        await t.product.update({ where: { id: productId }, data: updateData });
      }

      if (dto.categoryIds !== undefined) {
        await t.productCategory.deleteMany({ where: { productId } });
        if (dto.categoryIds.length > 0) {
          await t.productCategory.createMany({
            data: dto.categoryIds.map((cid: bigint, idx: number) => ({
              productId,
              categoryId: BigInt(cid),
              primary: idx === 0,
            })),
          });
        }
      }

      if (dto.variants !== undefined) {
        // Sync by id: update the variants sent back, create new ones, delete the rest.
        // Recreating everything would change variant ids and detach order lines and stock logs.
        const variants = dto.variants as CreateProductVariantDto[];
        const toData = (v: CreateProductVariantDto) => ({
          attributeValues: v.attributeValues as any,
          sku: v.sku ?? null,
          barcode: v.barcode ?? null,
          regularPrice: v.regularPrice ?? null,
          salePrice: v.salePrice ?? null,
          // Only when sent: purchases keep cost prices up to date, and a form without the field mustn't clear them.
          ...(v.costPrice !== undefined ? { costPrice: v.costPrice } : {}),
          salePriceStartAt: v.salePriceStartAt ?? null,
          salePriceEndAt: v.salePriceEndAt ?? null,
          manageStock: v.manageStock ?? true,
          allowBackorder: v.allowBackorder ?? false,
          lowStockThreshold: v.lowStockThreshold ?? null,
          imageUrl: v.imageUrl ?? null,
          weight: v.weight ?? null,
          length: v.length ?? null,
          width: v.width ?? null,
          height: v.height ?? null,
          status: v.status ?? "active",
        });
        const keepIds = variants.filter((v) => v.id !== undefined).map((v) => BigInt(v.id!));
        await t.productVariant.deleteMany({ where: { productId, id: { notIn: keepIds } } });
        for (const v of variants.filter((v) => v.id !== undefined)) {
          const updated = await db.productVariant.updateMany({ where: { id: BigInt(v.id!), productId }, data: toData(v) });
          if (updated.count) await setStockTotal(db, storeId, { productId, variantId: BigInt(v.id!) }, v.stockQty, existing.name);
        }
        for (const v of variants.filter((v) => v.id === undefined)) {
          const created = await db.productVariant.create({ data: { productId, ...toData(v), stockQty: 0 } });
          await setStockTotal(db, storeId, { productId, variantId: created.id }, v.stockQty, existing.name);
        }
        await resyncProductTotals(db, productId);
      }
      // A product without options: its stock box sets the total (difference in the default warehouse).
      if (dto.stockQty !== undefined && (await db.productVariant.count({ where: { productId } })) === 0) {
        await setStockTotal(db, storeId, { productId, variantId: null }, dto.stockQty, existing.name);
      }

      if (dto.imageUrls !== undefined) {
        await t.productImage.deleteMany({ where: { productId } });
        if (dto.imageUrls.length > 0) {
          await t.productImage.createMany({
            data: dto.imageUrls.map((url: string, idx: number) => ({
              productId,
              imageUrl: url,
              sortOrder: idx,
            })),
          });
        }
      }
    });

    // A new web address: the old one sends visitors (and search engines) to it.
    if (uniqueSlug !== undefined && uniqueSlug !== existing.slug) {
      await recordMove(prisma, storeId, `/products/${existing.slug}`, `/products/${uniqueSlug}`);
    }
    await this.invalidateProductCache(productId);
    return this.products.findFull(this.ctx, productId);
  }

  /** Hides products from the storefront but keeps them in the catalog (bulk "Archive"). */
  async softArchiveProduct(ids: bigint[]) {
    return this.setStatus(ids, "archived")
  }

  /** Back to draft: off the storefront until published again (bulk "Unpublish"). */
  async softUnpublishProduct(ids: bigint[]) {
    return this.setStatus(ids, "draft")
  }

  /** On the storefront (bulk "Publish"). */
  async publishProducts(ids: bigint[]) {
    return this.setStatus(ids, "published")
  }

  private async setStatus(ids: bigint[], status: "archived" | "draft" | "published") {
    const storeId = this.ctx.storeId!;
    const bigIds = ids.map((i) => BigInt(i));
    const result = await prisma.product.updateMany({
      where: { id: { in: bigIds }, storeId, deletedAt: null },
      data: { status, updatedById: this.ctx.admin?.id ?? null },
    });
    for (const id of bigIds) await this.invalidateProductCache(id);
    return result;
  }

  /**
   * Moves products to the Trash: hidden everywhere (status "archived"), their previous status kept
   * for Restore. Orders, carts and reports that name them are unaffected.
   */
  async trashProducts(ids: bigint[]) {
    const storeId = this.ctx.storeId!;
    const rows = await prisma.product.findMany({ where: { id: { in: ids }, storeId, deletedAt: null }, select: { id: true, status: true } });
    const by = this.ctx.admin?.id ?? null;
    const now = new Date();
    await prisma.$transaction(
      rows.map((r) =>
        prisma.product.update({ where: { id: r.id }, data: { deletedAt: now, deletedById: by, statusBeforeDelete: r.status, status: "archived" } }),
      ),
    );
    for (const r of rows) await this.invalidateProductCache(r.id);
    return { count: rows.length };
  }

  async softDeleteProduct(id: bigint | number) {
    const storeId = this.ctx.storeId!;
    const productId = BigInt(id);
    const existing = await prisma.product.findFirst({ where: { id: productId, storeId } });
    if (!existing) throw new NotFoundError("product", id);
    return this.trashProducts([productId]);
  }

  /** Takes products out of the Trash, back to the status they had. */
  async restoreProducts(ids: bigint[]) {
    const storeId = this.ctx.storeId!;
    const rows = await prisma.product.findMany({ where: { id: { in: ids }, storeId, deletedAt: { not: null } }, select: { id: true, statusBeforeDelete: true } });
    await prisma.$transaction(
      rows.map((r) =>
        prisma.product.update({
          where: { id: r.id },
          data: { deletedAt: null, deletedById: null, status: r.statusBeforeDelete ?? "draft", statusBeforeDelete: null, updatedById: this.ctx.admin?.id ?? null },
        }),
      ),
    );
    for (const r of rows) await this.invalidateProductCache(r.id);
    return { count: rows.length };
  }

  /**
   * Deletes products in the Trash for good. A product something else depends on (a gift box, a
   * landing page, a purchase, a stock transfer) stays in the Trash, with the reason. Past orders
   * and stock history keep their records: names and prices are copied onto them.
   */
  async purgeProducts(ids: bigint[]) {
    const storeId = this.ctx.storeId!;
    const rows = await prisma.product.findMany({ where: { id: { in: ids }, storeId, deletedAt: { not: null } }, select: { id: true, name: true } });
    const deleted: string[] = [];
    const kept: { id: string; name: string; reason: string }[] = [];
    for (const r of rows) {
      // Stock history and past orders keep their records (they lose only the link to the product).
      const [boxes, pages, purchases, transfers] = await Promise.all([
        prisma.giftBox.count({ where: { boxProductId: r.id } }),
        prisma.landingPage.count({ where: { productId: r.id } }),
        prisma.purchaseItem.count({ where: { productId: r.id } }),
        prisma.stockTransferItem.count({ where: { productId: r.id } }),
      ]);
      const reason = boxes
        ? "It's the box of a gift box"
        : pages
          ? "A landing page sells it"
          : purchases
            ? "It's on a purchase from a supplier"
            : transfers
              ? "It's on a stock transfer"
              : null;
      if (reason) {
        kept.push({ id: String(r.id), name: r.name, reason });
        continue;
      }
      try {
        await prisma.product.delete({ where: { id: r.id } });
        deleted.push(String(r.id));
      } catch (e) {
        if ((e as { code?: string }).code !== "P2003") throw e;
        kept.push({ id: String(r.id), name: r.name, reason: "Other records still use it" });
      }
    }
    return { deleted: deleted.length, kept };
  }

  async listProducts(filters: ProductSearchQueryDto): Promise<Paginated<any>> {
    return this.products.listWithJoins(this.ctx, filters);
  }

  async getProductById(id: bigint | number) {
    return this.products.findFull(this.ctx, id);
  }

  async getProductBySlug(slug: string) {
    const row = await this.products.findBySlug(this.ctx, slug);
    if (!row) throw new NotFoundError("product", slug);
    const productRow = row as { id: bigint };
    return this.products.findFull(this.ctx, productRow.id);
  }

  async listProductVariants(productId: bigint | number) {
    return this.variants.listForProduct(this.ctx, productId);
  }

  async createVariant(productId: bigint | number, dto: CreateProductVariantDto) {
    const storeId = this.ctx.storeId!;
    const pid = BigInt(productId);
    const product = await prisma.product.findFirst({ where: { id: pid, storeId } });
    if (!product) throw new NotFoundError("product", pid);

    if (dto.sku) {
      await this.checkVariantSkuUniqueness(storeId, dto.sku);
    }

    const variant = await tx(async (t: Prisma.TransactionClient) => {
      const v = await t.productVariant.create({
      data: {
        productId: pid,
        attributeValues: dto.attributeValues as any,
        sku: dto.sku ?? null,
        barcode: dto.barcode ?? null,
        regularPrice: dto.regularPrice ?? null,
        salePrice: dto.salePrice ?? null,
        salePriceStartAt: dto.salePriceStartAt ?? null,
        salePriceEndAt: dto.salePriceEndAt ?? null,
        manageStock: dto.manageStock,
        stockQty: 0,
        allowBackorder: dto.allowBackorder,
        lowStockThreshold: dto.lowStockThreshold ?? null,
        imageUrl: dto.imageUrl ?? null,
        weight: dto.weight ?? null,
        length: dto.length ?? null,
        width: dto.width ?? null,
        height: dto.height ?? null,
        status: dto.status,
      },
      });
      await setStockTotal(t, storeId, { productId: pid, variantId: v.id }, dto.stockQty, product.name);
      await resyncProductTotals(t, pid);
      return t.productVariant.findUniqueOrThrow({ where: { id: v.id } });
    });
    await this.invalidateProductCache(pid);
    return variant;
  }

  async updateVariant(variantId: bigint | number, dto: UpdateProductVariantDto) {
    const storeId = this.ctx.storeId!;
    const vid = BigInt(variantId);
    const existing = await prisma.productVariant.findFirst({
      where: { id: vid, product: { storeId } },
    });
    if (!existing) throw new NotFoundError("productVariant", vid);

    if (dto.sku && dto.sku !== existing.sku) {
      await this.checkVariantSkuUniqueness(storeId, dto.sku, vid);
    }

    const { stockQty, reservedStock: _held, ...rest } = dto as UpdateProductVariantDto & { reservedStock?: number };
    const updated = await tx(async (t: Prisma.TransactionClient) => {
      await t.productVariant.update({ where: { id: vid }, data: rest as Prisma.ProductVariantUpdateInput });
      await setStockTotal(t, storeId, { productId: existing.productId, variantId: vid }, stockQty);
      return t.productVariant.findUniqueOrThrow({ where: { id: vid } });
    });
    await this.invalidateProductCache(existing.productId);
    return updated;
  }

  async deleteVariant(variantId: bigint | number) {
    const storeId = this.ctx.storeId!;
    const vid = BigInt(variantId);
    const existing = await prisma.productVariant.findFirst({
      where: { id: vid, product: { storeId } },
    });
    if (!existing) throw new NotFoundError("productVariant", vid);
    const productId = existing.productId;
    await prisma.productVariant.update({
      where: { id: vid },
      data: { status: "disabled" },
    });
    await this.invalidateProductCache(productId);
    return { success: true as const, id: vid };
  }

  async createCategory(dto: CreateCategoryDto) {
    const storeId = this.ctx.storeId!;
    const parentId = dto.parentId ?? null;
    const baseSlug = dto.slug ?? slugify(dto.name);
    const uniqueSlug = await this.generateUniqueSlug(baseSlug, async (s) => {
      const row = await prisma.category.findFirst({
        where: {
          storeId,
          slug: s,
          parentId: parentId === null ? null : BigInt(parentId),
        },
      });
      return row !== null;
    });

    const data: Record<string, unknown> = {
      storeId,
      name: dto.name,
      slug: uniqueSlug,
      parentId: parentId === null ? null : BigInt(parentId),
      imageUrl: dto.imageUrl ?? null,
      bannerUrl: dto.bannerUrl ?? null,
      description: dto.description ?? null,
      translations: mergeTranslations(null, dto.translations ?? {}),
      displayMode: dto.displayMode,
      commissionRate: dto.commissionRate ?? null,
      sortOrder: dto.sortOrder,
      isActive: dto.isActive,
      menuIncluded: dto.menuIncluded,
      megaMenuConfig: dto.megaMenuConfig ?? null,
      seoTitle: dto.seoTitle ?? null,
      metaDesc: dto.metaDesc ?? null,
      canonicalUrl: dto.canonicalUrl ?? null,
      ogImageUrl: dto.ogImageUrl ?? null,
    };

    const category = await prisma.category.create({ data: data as any });
    await this.invalidateCategoryCache();
    return category;
  }

  async updateCategory(id: bigint | number, dto: UpdateCategoryDto) {
    const storeId = this.ctx.storeId!;
    const cid = BigInt(id);
    const existing = await prisma.category.findFirst({ where: { id: cid, storeId } });
    if (!existing) throw new NotFoundError("category", id);

    const parentId = dto.parentId !== undefined ? (dto.parentId === null ? null : BigInt(dto.parentId)) : existing.parentId;

    let uniqueSlug: string | undefined = undefined;
    if (dto.slug !== undefined && dto.slug !== existing.slug) {
      const baseSlug = dto.slug;
      uniqueSlug = await this.generateUniqueSlug(baseSlug, async (s) => {
        if (s === existing.slug && parentId === existing.parentId) return false;
        const row = await prisma.category.findFirst({
          where: {
            storeId,
            slug: s,
            parentId: parentId === null ? null : BigInt(parentId),
            NOT: { id: cid },
          },
        });
        return row !== null;
      });
    }

    const updateData: Record<string, unknown> = {};
    for (const key of Object.keys(dto)) {
      if (key === "slug") continue;
      if (key === "translations") {
        updateData.translations = mergeTranslations(existing.translations, dto.translations ?? {});
        continue;
      }
      (updateData as any)[key] = (dto as any)[key];
    }
    if (uniqueSlug !== undefined) updateData.slug = uniqueSlug;

    const updated = await prisma.category.update({
      where: { id: cid },
      data: updateData,
    });
    if (updated.slug !== existing.slug) {
      await recordMove(prisma, storeId, `/categories/${existing.slug}`, `/categories/${updated.slug}`);
    }
    await this.invalidateCategoryCache();
    return updated;
  }

  async deleteCategory(id: bigint | number) {
    const storeId = this.ctx.storeId!;
    const cid = BigInt(id);
    const hasChildren = await this.categories.hasChildren(this.ctx, cid);
    if (hasChildren) {
      throw new BadRequestError("Cannot delete category with children — reassign first", "BAD_REQUEST");
    }
    const existing = await prisma.category.findFirst({ where: { id: cid, storeId } });
    if (!existing) throw new NotFoundError("category", id);
    await prisma.category.delete({ where: { id: cid } });
    await this.invalidateCategoryCache();
    return { success: true as const, id: cid };
  }

  async getCategoryTree() {
    if (this.ctx.storeId === undefined) {
      return this.categories.findTree(this.ctx);
    }
    const cacheKey = CACHE_KEYS.categories(String(this.ctx.storeId));
    const cached = await cacheGet<any[]>(cacheKey);
    if (cached) return cached;
    const tree = await this.categories.findTree(this.ctx);
    await cacheSet(cacheKey, tree, CACHE_KEYS.TTL_PRODUCT);
    return tree;
  }

  async reorderCategoriesChildren(parentId: bigint | null, orderedIds: bigint[]) {
    const pid = parentId === null ? null : BigInt(parentId);
    const bigIds = orderedIds.map((i) => BigInt(i));
    await tx(async (_t: any) => {
      await this.categories.reorderChildren(this.ctx, pid, bigIds);
    });
    await this.invalidateCategoryCache();
    return { success: true as const, orderedIds: bigIds };
  }

  async getCategoryBreadcrumb(id: bigint | number) {
    return this.categories.findAncestorsChain(this.ctx, id);
  }

  async getCategory(id: bigint | number) {
    return this.categories.findById(this.ctx, id);
  }

  async createBrand(dto: CreateBrandDto) {
    const storeId = this.ctx.storeId!;
    const baseSlug = dto.slug ?? slugify(dto.name);
    const uniqueSlug = await this.generateUniqueSlug(baseSlug, async (s) => {
      const row = await prisma.brand.findFirst({ where: { storeId, slug: s } });
      return row !== null;
    });

    const data: Record<string, unknown> = {
      storeId,
      name: dto.name,
      slug: uniqueSlug,
      logoUrl: dto.logoUrl ?? null,
      bannerUrl: dto.bannerUrl ?? null,
      websiteUrl: dto.websiteUrl ?? null,
      description: dto.description ?? null,
      translations: mergeTranslations(null, dto.translations ?? {}),
      sortOrder: dto.sortOrder,
      isActive: dto.isActive,
      seoTitle: dto.seoTitle ?? null,
      metaDesc: dto.metaDesc ?? null,
      canonicalUrl: dto.canonicalUrl ?? null,
      ogImageUrl: dto.ogImageUrl ?? null,
    };

    return prisma.brand.create({ data: data as any });
  }

  async updateBrand(id: bigint | number, dto: UpdateBrandDto) {
    const storeId = this.ctx.storeId!;
    const bid = BigInt(id);
    const existing = await prisma.brand.findFirst({ where: { id: bid, storeId } });
    if (!existing) throw new NotFoundError("brand", id);

    let uniqueSlug: string | undefined = undefined;
    if (dto.slug !== undefined && dto.slug !== existing.slug) {
      uniqueSlug = await this.generateUniqueSlug(dto.slug, async (s) => {
        if (s === existing.slug) return false;
        const row = await prisma.brand.findFirst({ where: { storeId, slug: s, NOT: { id: bid } } });
        return row !== null;
      });
    }

    const updateData: Record<string, unknown> = {};
    for (const key of Object.keys(dto)) {
      if (key === "slug") continue;
      if (key === "translations") {
        updateData.translations = mergeTranslations(existing.translations, dto.translations ?? {});
        continue;
      }
      (updateData as any)[key] = (dto as any)[key];
    }
    if (uniqueSlug !== undefined) updateData.slug = uniqueSlug;

    return prisma.brand.update({ where: { id: bid }, data: updateData });
  }

  async deleteBrand(id: bigint | number) {
    const storeId = this.ctx.storeId!;
    const bid = BigInt(id);
    const existing = await prisma.brand.findFirst({ where: { id: bid, storeId } });
    if (!existing) throw new NotFoundError("brand", id);
    await prisma.brand.delete({ where: { id: bid } });
    return { success: true as const, id: bid };
  }

  async getBrand(id: bigint | number) {
    return this.brands.findById(this.ctx, id);
  }

  async listBrands(filters: ProductSearchQueryDto): Promise<Paginated<any>> {
    return this.brands.paginate(this.ctx, {
      ...filters,
      include: { _count: { select: { products: true } } },
    } as any);
  }

  async listActiveBrands() {
    return this.brands.listActive(this.ctx);
  }

  async createAttribute(dto: CreateAttributeDto) {
    const storeId = this.ctx.storeId!;
    const baseSlug = dto.slug ?? slugify(dto.name);
    const uniqueSlug = await this.generateUniqueSlug(baseSlug, async (s) => {
      const row = await prisma.attribute.findFirst({ where: { storeId, slug: s } });
      return row !== null;
    });

    const result = await tx(async (t: any) => {
      const attr = await t.attribute.create({
        data: {
          storeId,
          name: dto.name,
          slug: uniqueSlug,
          type: dto.type,
          sortOrder: dto.sortOrder,
          isFilterable: dto.isFilterable,
          isActive: dto.isActive,
        },
      });
      if (dto.options && dto.options.length > 0) {
        await t.attributeTerm.createMany({
          data: dto.options.map((opt: CreateAttributeTermDto, idx: number) => ({
            attributeId: attr.id,
            name: opt.name,
            slug: opt.slug ?? slugify(opt.name),
            value: opt.value ?? null,
            sortOrder: opt.sortOrder ?? idx,
            swatchUrl: opt.swatchUrl ?? null,
          })),
        });
      }
      return attr;
    });

    return this.attributes.findWithTerms(this.ctx, result.id);
  }

  async updateAttribute(id: bigint | number, dto: UpdateAttributeDto) {
    const storeId = this.ctx.storeId!;
    const aid = BigInt(id);
    const existing = await prisma.attribute.findFirst({ where: { id: aid, storeId } });
    if (!existing) throw new NotFoundError("attribute", id);

    let uniqueSlug: string | undefined = undefined;
    if (dto.slug !== undefined && dto.slug !== existing.slug) {
      uniqueSlug = await this.generateUniqueSlug(dto.slug, async (s) => {
        if (s === existing.slug) return false;
        const row = await prisma.attribute.findFirst({ where: { storeId, slug: s, NOT: { id: aid } } });
        return row !== null;
      });
    }

    await tx(async (t: any) => {
      const updateData: Record<string, unknown> = {};
      for (const key of Object.keys(dto)) {
        if (key === "slug" || key === "options") continue;
        (updateData as any)[key] = (dto as any)[key];
      }
      if (uniqueSlug !== undefined) updateData.slug = uniqueSlug;
      if (Object.keys(updateData).length > 0) {
        await t.attribute.update({ where: { id: aid }, data: updateData });
      }

      if (dto.options !== undefined) {
        await t.attributeTerm.deleteMany({ where: { attributeId: aid } });
        if (dto.options.length > 0) {
          await t.attributeTerm.createMany({
            data: dto.options.map((opt: CreateAttributeTermDto, idx: number) => ({
              attributeId: aid,
              name: opt.name,
              slug: opt.slug ?? slugify(opt.name),
              value: opt.value ?? null,
              sortOrder: opt.sortOrder ?? idx,
              swatchUrl: opt.swatchUrl ?? null,
            })),
          });
        }
      }
    });

    return this.attributes.findWithTerms(this.ctx, aid);
  }

  async deleteAttribute(id: bigint | number) {
    const storeId = this.ctx.storeId!;
    const aid = BigInt(id);
    const existing = await prisma.attribute.findFirst({ where: { id: aid, storeId } });
    if (!existing) throw new NotFoundError("attribute", id);
    await prisma.attribute.delete({ where: { id: aid } });
    return { success: true as const, id: aid };
  }

  async getAttribute(id: bigint | number) {
    return this.attributes.findWithTerms(this.ctx, id);
  }

  async listFullWithOptions() {
    return this.attributes.listFullWithOptions(this.ctx);
  }

  async addAttributeTerm(attributeId: bigint | number, dto: CreateAttributeTermDto) {
    const storeId = this.ctx.storeId!;
    const aid = BigInt(attributeId);
    const existing = await prisma.attribute.findFirst({ where: { id: aid, storeId } });
    if (!existing) throw new NotFoundError("attribute", aid);

    const termSlug = dto.slug ?? slugify(dto.name);
    return prisma.attributeTerm.create({
      data: {
        attributeId: aid,
        name: dto.name,
        slug: termSlug,
        value: dto.value ?? null,
        sortOrder: dto.sortOrder,
        swatchUrl: dto.swatchUrl ?? null,
      },
    });
  }

  async removeAttributeTerm(termId: bigint | number) {
    const storeId = this.ctx.storeId!;
    const tid = BigInt(termId);
    const existing = await prisma.attributeTerm.findFirst({
      where: { id: tid, attribute: { storeId } },
    });
    if (!existing) throw new NotFoundError("attributeTerm", tid);
    await prisma.attributeTerm.delete({ where: { id: tid } });
    return { success: true as const, id: tid };
  }

  async upsertAttributeTerms(attributeId: bigint | number, terms: CreateAttributeTermDto[]) {
    const storeId = this.ctx.storeId!;
    const aid = BigInt(attributeId);
    const existing = await prisma.attribute.findFirst({ where: { id: aid, storeId } });
    if (!existing) throw new NotFoundError("attribute", aid);

    const result = await tx(async (t: any) => {
      const created: unknown[] = [];
      for (let i = 0; i < terms.length; i++) {
        const opt = terms[i]!;
        const slug = opt.slug ?? slugify(opt.name);
        const term = await t.attributeTerm.upsert({
          where: {
            id: BigInt(-1),
          },
          update: {
            name: opt.name,
            value: opt.value ?? null,
            sortOrder: opt.sortOrder ?? i,
            swatchUrl: opt.swatchUrl ?? null,
          },
          create: {
            attributeId: aid,
            name: opt.name,
            slug,
            value: opt.value ?? null,
            sortOrder: opt.sortOrder ?? i,
            swatchUrl: opt.swatchUrl ?? null,
          },
        });
        created.push(term);
      }
      return created;
    });
    return result;
  }

  async setGalleryOrder(productId: bigint | number, orderedMediaIds: bigint[]) {
    const pid = BigInt(productId);
    const storeId = this.ctx.storeId!;
    const existing = await prisma.product.findFirst({ where: { id: pid, storeId } });
    if (!existing) throw new NotFoundError("product", pid);

    const bigIds = orderedMediaIds.map((i) => BigInt(i));
    await this.productImages.setGalleryOrder(this.ctx, pid, bigIds);
    await this.invalidateProductCache(pid);
    return { success: true as const, orderedIds: bigIds };
  }

  async uploadMedia(
    uploadDto: { productId?: bigint; altText?: string; sortOrder?: number },
    file: { buffer: Uint8Array; originalName: string; mimeType: string; sizeBytes: number },
  ) {
    const storeId = this.ctx.storeId!;
    const adminId = this.ctx.admin?.id;
    if (adminId === undefined) {
      throw new BadRequestError("Admin context required for uploads", "BAD_REQUEST");
    }

    const timestamp = Date.now();
    const rand = randomAlphanum(6);
    const safeName = sanitizeFilename(file.originalName);
    const key = `${storeId}/media/products/${timestamp}-${rand}-${safeName}`;

    const stored = await this.storageProvider.put(key, file.buffer, file.mimeType);

    const mediaFile = await prisma.mediaFile.create({
      data: {
        storeId,
        filename: key,
        originalName: file.originalName,
        mimeType: file.mimeType,
        sizeBytes: BigInt(file.sizeBytes),
        url: stored.url,
        kind: "image",
        uploadedByType: "ADMIN",
        uploadedById: adminId,
        altText: uploadDto.altText ?? null,
      } as any,
    });

    if (uploadDto.productId !== undefined) {
      await this.assignImageToProduct(
        uploadDto.productId,
        mediaFile.id,
        uploadDto.altText,
        uploadDto.sortOrder,
      );
    }

    return mediaFile;
  }

  async assignImageToProduct(
    productId: bigint | number,
    mediaId: bigint | number,
    altText?: string,
    sortOrder?: number,
  ) {
    const storeId = this.ctx.storeId!;
    const pid = BigInt(productId);
    const mid = BigInt(mediaId);

    const product = await prisma.product.findFirst({ where: { id: pid, storeId } });
    if (!product) throw new NotFoundError("product", pid);

    const media = await prisma.mediaFile.findFirst({ where: { id: mid, storeId } });
    if (!media) throw new NotFoundError("mediaFile", mid);

    const existing = await prisma.productImage.findFirst({
      where: { productId: pid, mediaId: mid },
    });

    let result;
    if (existing) {
      result = await prisma.productImage.update({
        where: { id: existing.id },
        data: {
          altText: altText ?? existing.altText,
          sortOrder: sortOrder ?? existing.sortOrder,
        },
      });
    } else {
      const maxSort = await prisma.productImage.aggregate({
        where: { productId: pid },
        _max: { sortOrder: true },
      });
      const nextSort = sortOrder ?? ((maxSort._max.sortOrder ?? -1) + 1);
      result = await prisma.productImage.create({
        data: {
          productId: pid,
          mediaId: mid,
          imageUrl: media.url,
          altText: altText ?? null,
          sortOrder: nextSort,
        },
      });
    }

    await this.invalidateProductCache(pid);
    return result;
  }
}
