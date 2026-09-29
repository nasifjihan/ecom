/**
 * STOREFRONT SERVICE — public catalog + guest checkout (Batch #10).
 *
 * Everything here is scoped to the tenant resolved by 10-tenant.ts (ctx.storeId),
 * only exposes published/active rows, and returns plain JSON (ids as strings,
 * Decimals as numbers) in the shapes storefront-base's RTK slices expect.
 *
 * Checkout never trusts client money: every line is re-priced from the DB, shipping
 * comes from ShippingService, tax from the TaxRate table, and coupon discounts are
 * recomputed here.
 */
import { Prisma, type Coupon } from "@prisma/client";
import { prisma, tx } from "../../config";
import { BadRequestError, ConflictError, NotFoundError, type ErrorCode, type RequestContext, tr } from "../../core";
import { OrdersService } from "../orders/orders.service";
import { ShippingService } from "../shipping";
import { getPaymentProvider } from "../../services/payments";
import type { PaymentMethod } from "../../services/payments/types";
import { newId } from "@ecom/utils";
import type {
  StorefrontProductsQueryDto,
  ApplyCouponDto,
  PlaceOrderDto,
  CartLineDto,
  StorefrontAddressDto,
} from "./storefront.dto";
import { emitOrderPlaced } from "../notifications";
import { FlashSales, flashView, type FlashDeal, type PricedProduct } from "./flash-sales";
import { addressWithLocation, offInChain, storeLocationsOff } from "../locations/locations.service";
import { FulfilmentService } from "../fulfilment/fulfilment.service";
import { chooseWarehouse, moveStock } from "../stock";
import { checkoutLoyalty, onOrderPlaced } from "../loyalty/loyalty.ledger";
import { memberDiscount as memberDiscountFor, walletUse } from "../loyalty/loyalty.rules";
import { PaymentsService } from "../payments/payments.service";
import { recordPaidAtEntry } from "../payments/payments.records";
import { isManualCapable, normalizeBdMobile, normalizeTrxId, trxIdProblem } from "../payments/payments.rules";
import { categoryLineage, livePromotionRules } from "../marketing/promotions.service";
import { evaluatePromotions, type PromoResult } from "../marketing/promotions.rules";
import { storefrontInfo, type StorefrontInfo } from "../storefronts/storefronts.context";
import { gatewayOffered, onStorefront, storefrontPriceRow, type OwnPrice } from "../storefronts/storefronts.rules";
import { isBusinessBuyer, tiersByProduct } from "../wholesale/wholesale.context";
import { tierFor, tierQty, withTier } from "../wholesale/wholesale.rules";

const OFFLINE_GATEWAYS = new Set(["cod", "bank_transfer"]);

type Num = Prisma.Decimal | number | string | null | undefined;
const num = (v: Num): number => (v === null || v === undefined ? 0 : Number(v));
const round2 = (n: number): number => Math.round(n * 100) / 100;

function saleActive(sale: Num, startAt?: Date | null, endAt?: Date | null, now = new Date()): boolean {
  if (sale === null || sale === undefined) return false;
  if (startAt && startAt > now) return false;
  if (endAt && endAt < now) return false;
  return true;
}

/** Effective selling price + compare-at price for a product or variant row. */
function priceOf(row: {
  regularPrice: Num;
  salePrice: Num;
  salePriceStartAt?: Date | null;
  salePriceEndAt?: Date | null;
}): { price: number; compareAtPrice: number | null } {
  const regular = num(row.regularPrice);
  if (saleActive(row.salePrice, row.salePriceStartAt, row.salePriceEndAt) && num(row.salePrice) < regular) {
    return { price: num(row.salePrice), compareAtPrice: regular };
  }
  return { price: regular, compareAtPrice: null };
}

type PriceRow = Parameters<typeof priceOf>[0];

/** A variant's price row: its own prices, falling back to the product's. */
function variantPriceRow(
  p: PriceRow,
  v: { regularPrice: Num; salePrice: Num; salePriceStartAt: Date | null; salePriceEndAt: Date | null },
): PriceRow {
  return {
    regularPrice: v.regularPrice ?? p.regularPrice,
    salePrice: v.salePrice ?? (v.regularPrice ? null : p.salePrice),
    salePriceStartAt: v.salePriceStartAt,
    salePriceEndAt: v.salePriceEndAt,
  };
}

/** priceOf with running flash sales applied. */
function pricedWith(
  flash: FlashSales,
  p: PricedProduct,
  variantId: bigint | null,
  row: PriceRow,
): { price: number; compareAtPrice: number | null; flash: FlashDeal | null } {
  const base = priceOf(row);
  const deal = flash.best(p, variantId, num(row.regularPrice), base.price, base.compareAtPrice !== null);
  return deal ? { price: deal.price, compareAtPrice: num(row.regularPrice), flash: deal } : { ...base, flash: null };
}

function available(row: { manageStock: boolean; stockQty: number | null; reservedStock: number; allowBackorder: boolean }): number {
  if (!row.manageStock || row.allowBackorder) return Number.POSITIVE_INFINITY;
  return Math.max(0, (row.stockQty ?? 0) - (row.reservedStock ?? 0));
}

function stockStatus(qty: number, lowThreshold?: number | null): "IN_STOCK" | "OUT_OF_STOCK" | "LOW_STOCK" {
  if (qty <= 0) return "OUT_OF_STOCK";
  if (qty !== Number.POSITIVE_INFINITY && qty <= (lowThreshold ?? 5)) return "LOW_STOCK";
  return "IN_STOCK";
}

function variantLabel(values: unknown): string {
  if (!values || typeof values !== "object") return "";
  return Object.entries(values as Record<string, unknown>)
    .map(([k, v]) => `${k.charAt(0).toUpperCase()}${k.slice(1)}: ${String(v)}`)
    .join(" • ");
}

/** A product's row for the request's storefront (own price / whether it's sold there), if any. */
const ownRow = (storefrontId: bigint) => ({
  where: { storefrontId },
  select: { listed: true, regularPrice: true, salePrice: true },
});

/** Products sold in a storefront (see storefronts.rules listedIn). */
function inRange(sf: StorefrontInfo): Prisma.ProductWhereInput {
  return sf.includeNewProducts
    ? { storefronts: { none: { storefrontId: sf.id, listed: false } } }
    : { storefronts: { some: { storefrontId: sf.id, listed: true } } };
}

const LIST_INCLUDE = {
  brand: { select: { id: true, name: true, slug: true, translations: true } },
  categories: { include: { category: { select: { id: true, name: true, slug: true, translations: true } } } },
  images: { orderBy: { sortOrder: "asc" as const }, take: 2 },
  variants: { where: { status: "active" }, select: { stockQty: true, reservedStock: true, manageStock: true, allowBackorder: true } },
};

type PricedLine = NonNullable<Awaited<ReturnType<StorefrontService["quoteLines"]>>[number]["priced"]>;

export type DeliveryOption = {
  id: string;
  zoneId: string | null;
  code: string;
  name: string;
  fee: number;
  freeReason: string | null;
  minDays: number | null;
  maxDays: number | null;
};

/** What an order is made of before it's priced. */
export type OrderDraft = {
  /** Throw on the first problem (checkout) instead of collecting them (admin form). */
  strict: boolean;
  items: CartLineDto[];
  email?: string | null;
  shippingAddress: StorefrontAddressDto;
  billingAddress?: StorefrontAddressDto;
  billingSameAsShipping?: boolean;
  /** A zone method, a fee typed by staff, or pickup (no delivery charge). */
  delivery: { methodId: bigint | string } | { customFee: number; name?: string } | { pickup: true };
  /** Also list the zone's delivery options (for the admin form) when delivery isn't a zone method. */
  listShippingOptions?: boolean;
  couponCode?: string;
  /** Automatic promotions (default on); staff can leave them off a manual order. */
  applyPromotions?: boolean;
  manualDiscount?: { type: "percent" | "fixed"; value: number };
  paymentGateway: string;
  requireEnabledGateway: boolean;
  applyGatewayFee: boolean;
  /** The customer the order is for: their loyalty level's discount applies. */
  customerId?: bigint | null;
  /** Pay what the wallet allows from the customer's balance. */
  useWallet?: boolean;
};

export type OrderQuote = Awaited<ReturnType<StorefrontService["quoteOrder"]>>;

/** Who and what an order is recorded as. */
export type OrderMeta = {
  customerId: bigint | null;
  customerNote?: string | null;
  source: string;
  createdByAdminId?: bigint | null;
  status?: "PENDING" | "PROCESSING";
  paid?: boolean;
  transactionId?: string | null;
  /** A transfer the customer says they made (checked shape and not used before). */
  transfer?: { transactionId: string; senderNumber: string | null };
  historyNote: string;
  notifyCustomer?: boolean;
};

export class StorefrontService {
  private shipping = new ShippingService();

  constructor(private readonly ctx: RequestContext) {}

  private get storeId(): bigint {
    if (this.ctx.storeId === undefined) {
      throw new BadRequestError("Could not resolve which store this request belongs to", "TENANT_NOT_RESOLVED");
    }
    return this.ctx.storeId;
  }

  // ------------------------------------------------------------------ catalog

  /** The shopper's language (see core/translations). */
  private get locale(): string {
    return this.ctx.locale;
  }

  /** The storefront this request is for (its range, price adjustment). */
  private sfInfo?: Promise<StorefrontInfo>;
  storefront(): Promise<StorefrontInfo> {
    this.sfInfo ??= storefrontInfo(this.storeId, this.ctx.storefrontId);
    return this.sfInfo;
  }

  /** LIST_INCLUDE plus the product's own row for this storefront. */
  private async listInclude() {
    const sf = await this.storefront();
    return { ...LIST_INCLUDE, storefronts: ownRow(sf.id) };
  }

  /** The price row a product (or one of its options) sells from in this storefront. */
  private sfRow(sf: StorefrontInfo, p: { storefronts?: OwnPrice[] }, row: PriceRow): PriceRow {
    return storefrontPriceRow(row, sf, p.storefronts?.[0]);
  }

  private toSummary(p: any, flashSales: FlashSales, sf: StorefrontInfo) {
    const L = this.locale;
    const own = p as { storefronts?: OwnPrice[] } & PriceRow;
    const { price, compareAtPrice, flash } = pricedWith(flashSales, p, null, this.sfRow(sf, own, own));
    const primary = p.categories?.find((c: any) => c.primary) ?? p.categories?.[0];
    const variants: any[] = p.variants ?? [];
    const qty = variants.length > 0
      ? variants.reduce((s: number, v: any) => s + available(v), 0)
      : available(p);
    const images: string[] = (p.images ?? []).map((i: any) => i.imageUrl);
    const createdAt = p.createdAt ? new Date(p.createdAt) : null;
    return {
      id: String(p.id),
      slug: p.slug,
      title: tr(p, L, "name"),
      image: images[0] ?? "",
      images,
      price,
      compareAtPrice,
      isOnSale: compareAtPrice !== null,
      discountPercent: compareAtPrice ? Math.round(((compareAtPrice - price) / compareAtPrice) * 100) : undefined,
      flashSale: flashView(flash),
      rating: num(p.averageRating),
      reviewCount: p.reviewCount ?? 0,
      isNew: createdAt ? Date.now() - createdAt.getTime() < 30 * 86_400_000 : false,
      isOutOfStock: qty <= 0,
      hasVariants: variants.length > 0,
      stockStatus: stockStatus(qty, p.lowStockThreshold),
      sku: p.sku ?? undefined,
      weightKG: p.weight !== null && p.weight !== undefined ? num(p.weight) : undefined,
      brandId: p.brandId ? String(p.brandId) : undefined,
      brand: p.brand ? { id: String(p.brand.id), name: tr(p.brand, L, "name"), slug: p.brand.slug } : undefined,
      categoryId: primary ? String(primary.category.id) : undefined,
      category: primary
        ? { id: String(primary.category.id), slug: primary.category.slug, name: tr(primary.category, L, "name") }
        : undefined,
      shortDescription: tr(p, L, "shortDescription") ?? undefined,
    };
  }

  /** Category ids plus all of their active descendants. */
  private async expandCategories(ids: bigint[]): Promise<bigint[]> {
    const all = await prisma.category.findMany({
      where: { storeId: this.storeId, isActive: true },
      select: { id: true, parentId: true },
    });
    const out = new Set<bigint>(ids);
    let grew = true;
    while (grew) {
      grew = false;
      for (const c of all) {
        if (c.parentId !== null && out.has(c.parentId) && !out.has(c.id)) {
          out.add(c.id);
          grew = true;
        }
      }
    }
    return [...out];
  }

  async listProducts(q: StorefrontProductsQueryDto) {
    const sf = await this.storefront();
    const include = await this.listInclude();
    const where: Prisma.ProductWhereInput = { storeId: this.storeId, status: "published" };
    const and: Prisma.ProductWhereInput[] = [inRange(sf)];

    let categoryIds: bigint[] = q.categoryId ? q.categoryId.split(",").map((s) => BigInt(s)) : [];
    if (q.categorySlug) {
      const cat = await prisma.category.findFirst({ where: { storeId: this.storeId, slug: q.categorySlug, isActive: true } });
      if (!cat) return this.page([], 0, q);
      categoryIds.push(cat.id);
    }
    if (categoryIds.length) {
      categoryIds = await this.expandCategories(categoryIds);
      where.categories = { some: { categoryId: { in: categoryIds } } };
    }
    if (q.brandId) where.brandId = { in: q.brandId.split(",").map((s) => BigInt(s)) };
    if (q.featured !== undefined) where.featured = q.featured;
    if (q.rating) where.averageRating = { gte: q.rating };
    if (q.excludeId) where.id = { not: q.excludeId };
    if (q.tag) where.tags = { has: q.tag };
    if (q.ids) where.id = { in: q.ids.split(",").map((s) => BigInt(s)) };
    if (q.search) {
      const term = q.search.toLowerCase().trim();
      and.push({
        OR: [
          { name: { contains: q.search, mode: "insensitive" } },
          { translations: { path: ["bn", "name"], string_contains: q.search.trim() } },
          { sku: { contains: q.search, mode: "insensitive" } },
          { shortDescription: { contains: q.search, mode: "insensitive" } },
          { tags: { has: term } },
          { brand: { name: { contains: q.search, mode: "insensitive" } } },
        ],
      });
    }
    // A storefront with its own prices is filtered on them in memory (below), not in the database.
    const ownPrices = sf.priceAdjustPercent !== 0 ||
      (await prisma.productStorefront.count({ where: { storefrontId: sf.id, regularPrice: { not: null } } })) > 0;
    const priceRange = q.minPrice !== undefined || q.maxPrice !== undefined;
    if (priceRange && !ownPrices) {
      // Filter on the price a shopper pays: salePrice when set, otherwise regularPrice.
      const range: Prisma.DecimalNullableFilter = {};
      if (q.minPrice !== undefined) range.gte = q.minPrice;
      if (q.maxPrice !== undefined) range.lte = q.maxPrice;
      and.push({ OR: [{ salePrice: range }, { salePrice: null, regularPrice: range }] });
    }
    where.AND = and;

    if (q.sort === "price_asc" || q.sort === "price_desc" || (priceRange && ownPrices)) {
      // Sort on the price a shopper pays (sale price inside its window), which Prisma's
      // orderBy cannot express, so rank the matching ids in memory and load one page.
      const candidates = await prisma.product.findMany({
        where,
        select: {
          id: true,
          regularPrice: true,
          salePrice: true,
          salePriceStartAt: true,
          salePriceEndAt: true,
          categories: { select: { categoryId: true } },
          storefronts: ownRow(sf.id),
        },
      });
      const flash = await FlashSales.load(this.storeId, candidates.map((c) => c.id));
      const byPrice = q.sort === "price_asc" || q.sort === "price_desc";
      const dir = q.sort === "price_desc" ? -1 : 1;
      const ranked = candidates
        .map((c) => ({ id: c.id, price: pricedWith(flash, c, null, this.sfRow(sf, c, c)).price }))
        .filter((r) => (q.minPrice === undefined || r.price >= q.minPrice) && (q.maxPrice === undefined || r.price <= q.maxPrice));
      if (byPrice) ranked.sort((a, b) => dir * (a.price - b.price) || Number(a.id - b.id));
      const kept = byPrice
        ? ranked.map((r) => r.id)
        : (
            await prisma.product.findMany({
              where: { id: { in: ranked.map((r) => r.id) } },
              orderBy: this.orderBy(q.sort),
              select: { id: true },
            })
          ).map((r) => r.id);
      const pageIds = kept.slice((q.page - 1) * q.perPage, q.page * q.perPage);
      const rows = await prisma.product.findMany({ where: { id: { in: pageIds } }, include });
      const byId = new Map(rows.map((r) => [r.id, r]));
      const ordered = pageIds.map((id) => byId.get(id)).filter((r): r is (typeof rows)[number] => Boolean(r));
      return this.page(ordered.map((r) => this.toSummary(r, flash, sf)), kept.length, q);
    }

    const [total, rows] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        orderBy: this.orderBy(q.sort),
        skip: (q.page - 1) * q.perPage,
        take: q.perPage,
        include,
      }),
    ]);
    const flash = await FlashSales.load(this.storeId, rows.map((r) => r.id));
    return this.page(rows.map((r) => this.toSummary(r, flash, sf)), total, q);
  }

  private orderBy(sort: StorefrontProductsQueryDto["sort"]): Prisma.ProductOrderByWithRelationInput[] {
    return sort === "newest"
      ? [{ createdAt: "desc" }, { id: "desc" }]
      : sort === "rating"
        ? [{ averageRating: "desc" }, { reviewCount: "desc" }, { id: "desc" }]
        : [{ saleCount: "desc" }, { id: "desc" }];
  }

  /** Product cards for these ids, in the order given (unpublished ones and ones not sold here left out). */
  async productSummaries(ids: bigint[]) {
    if (!ids.length) return [];
    const sf = await this.storefront();
    const rows = await prisma.product.findMany({
      where: { storeId: this.storeId, id: { in: ids }, status: "published", ...inRange(sf) },
      include: await this.listInclude(),
    });
    const flash = await FlashSales.load(this.storeId, rows.map((r) => r.id));
    const byId = new Map(rows.map((r) => [r.id, r]));
    return ids.flatMap((id) => {
      const r = byId.get(id);
      return r ? [this.toSummary(r, flash, sf)] : [];
    });
  }

  private page<T>(items: T[], total: number, q: { page: number; perPage: number }) {
    return { items, page: q.page, perPage: q.perPage, total, totalPages: Math.max(1, Math.ceil(total / q.perPage)) };
  }

  async getProductBySlug(slug: string) {
    const sf = await this.storefront();
    const p = await prisma.product.findFirst({
      where: { storeId: this.storeId, slug, status: "published", ...inRange(sf) },
      include: {
        storefronts: ownRow(sf.id),
        brand: { select: { id: true, name: true, slug: true, translations: true } },
        categories: {
          include: { category: { select: { id: true, name: true, slug: true, parentId: true, translations: true } } },
        },
        images: { orderBy: { sortOrder: "asc" } },
        variants: { where: { status: "active" }, orderBy: { id: "asc" } },
        attributes: { include: { attribute: true, terms: { include: { term: true } } } },
        reviews: {
          where: { status: "approved" },
          orderBy: { createdAt: "desc" },
          take: 20,
          include: { customer: { select: { firstName: true, lastName: true } } },
        },
        questions: { where: { status: "published", answer: { not: null } }, orderBy: { answeredAt: "desc" }, take: 30 },
      },
    });
    if (!p) throw new NotFoundError("Product");

    const flash = await FlashSales.load(this.storeId, [p.id]);
    const summary = this.toSummary(p, flash, sf);
    const primary = p.categories.find((c) => c.primary) ?? p.categories[0];
    const parent = primary?.category.parentId
      ? await prisma.category.findFirst({
          where: { id: primary.category.parentId, storeId: this.storeId },
          select: { id: true, name: true, slug: true, translations: true },
        })
      : null;

    // The shop's own rows first (grouped as entered), then what we know from the product itself.
    const custom = Array.isArray(p.specifications)
      ? (p.specifications as { group?: string | null; label?: string; value?: string }[])
          .filter((r) => r?.label && r.value)
          .map((r) => ({ name: r.label!, value: r.value!, group: r.group ?? undefined }))
      : [];
    const specifications = [
      ...custom,
      ...(p.brand ? [{ name: "Brand", value: tr(p.brand, this.locale, "name") }] : []),
      ...(p.sku ? [{ name: "SKU", value: p.sku }] : []),
      ...p.attributes.map((a) => ({ name: a.attribute.name, value: a.terms.map((t) => t.term.name).join(", ") })),
      ...(p.weight ? [{ name: "Weight", value: `${num(p.weight)} kg` }] : []),
    ];

    const reviews = p.reviews.map((r) => ({
      id: String(r.id),
      name: `${r.customer.firstName} ${r.customer.lastName.charAt(0)}.`.trim(),
      rating: r.rating,
      title: r.title ?? "",
      body: r.body ?? "",
      verified: r.verified,
      date: r.createdAt.toISOString(),
    }));
    // Denormalised averageRating/reviewCount are not maintained yet, so fall back to the approved reviews.
    const rating = summary.rating || (reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0);

    return {
      ...summary,
      rating: round2(rating),
      reviewCount: summary.reviewCount || reviews.length,
      description: tr(p, this.locale, "description") ?? undefined,
      breadcrumbs: [parent, primary?.category]
        .filter((c): c is NonNullable<typeof parent> => Boolean(c))
        .map((c) => ({ id: String(c.id), name: tr(c, this.locale, "name"), slug: c.slug })),
      specifications,
      tags: p.tags,
      /** Orders that included it (shown as "N sold" once it's worth showing). */
      saleCount: p.saleCount,
      lowStockThreshold: p.lowStockThreshold ?? 5,
      allowReviews: p.allowReviews,
      questions: p.questions.map((q) => ({
        id: String(q.id),
        name: q.name,
        question: q.question,
        answer: q.answer ?? "",
        askedAt: q.createdAt.toISOString(),
      })),
      reviews,
      variants: p.variants.map((v) => {
        const vp = pricedWith(flash, p, v.id, this.sfRow(sf, p, variantPriceRow(p, v)));
        const values = (v.attributeValues ?? {}) as Record<string, unknown>;
        const qty = available(v);
        return {
          id: String(v.id),
          attributes: Object.fromEntries(Object.entries(values).map(([k, val]) => [k, String(val)])),
          size: values.size !== undefined ? String(values.size) : undefined,
          color: values.color !== undefined ? String(values.color) : undefined,
          label: variantLabel(values),
          price: vp.price,
          compareAtPrice: vp.compareAtPrice,
          flashSale: flashView(vp.flash),
          image: v.imageUrl ?? undefined,
          sku: v.sku ?? undefined,
          inStock: qty > 0,
          stockQty: qty === Number.POSITIVE_INFINITY ? null : qty,
        };
      }),
      stockQty: p.variants.length === 0 && available(p) !== Number.POSITIVE_INFINITY ? available(p) : null,
      seo: { title: p.seoTitle ?? undefined, description: p.metaDesc ?? undefined, ogImage: p.ogImageUrl ?? undefined },
    };
  }

  async categoriesTree() {
    const cats = await prisma.category.findMany({
      where: { storeId: this.storeId, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { _count: { select: { products: { where: { product: { status: "published" } } } } } },
    });
    type Node = { id: string; slug: string; name: string; image?: string; parentId: string | null; productCount: number; children: Node[] };
    const nodes = new Map<string, Node>();
    for (const c of cats) {
      nodes.set(String(c.id), {
        id: String(c.id),
        slug: c.slug,
        name: tr(c, this.locale, "name"),
        image: c.imageUrl ?? undefined,
        parentId: c.parentId ? String(c.parentId) : null,
        productCount: c._count.products,
        children: [],
      });
    }
    const roots: Node[] = [];
    for (const n of nodes.values()) {
      const parent = n.parentId ? nodes.get(n.parentId) : undefined;
      if (parent) parent.children.push(n);
      else roots.push(n);
    }
    // A parent's count covers its subtree (products are usually linked to leaf categories only).
    const total = (n: Node): number => {
      const childSum = n.children.reduce((s, c) => s + total(c), 0);
      n.productCount = Math.max(n.productCount, childSum);
      return n.productCount;
    };
    roots.forEach(total);
    return roots;
  }

  async brands() {
    const rows = await prisma.brand.findMany({
      where: { storeId: this.storeId, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { _count: { select: { products: { where: { status: "published" } } } } },
    });
    return rows.map((b) => ({
      id: String(b.id),
      slug: b.slug,
      name: tr(b, this.locale, "name"),
      logo: b.logoUrl ?? undefined,
      productCount: b._count.products,
    }));
  }

  // ------------------------------------------------------------------ pricing

  /**
   * Re-prices cart lines from the DB, flash sales included. Never throws for a bad line: each
   * line carries its `problem` (gone, out of stock, too few left) for the cart page to show.
   */
  async quoteLines(lines: CartLineDto[], buyerId: bigint | null | undefined = this.ctx.customer?.id) {
    const productIds = [...new Set(lines.map((l) => l.productId))];
    // Shoppers can only buy what their storefront sells; staff taking an order can sell anything.
    const sf = await this.storefront();
    const [products, flashSales, tiers, business] = await Promise.all([
      prisma.product.findMany({
        where: { storeId: this.storeId, id: { in: productIds }, status: "published", ...(this.ctx.admin ? {} : inRange(sf)) },
        include: {
          storefronts: ownRow(sf.id),
          variants: { where: { status: "active" } },
          images: { orderBy: { sortOrder: "asc" }, take: 1 },
          categories: { select: { categoryId: true } },
        },
      }),
      FlashSales.load(this.storeId, productIds),
      tiersByProduct(this.storeId, productIds),
      isBusinessBuyer(this.storeId, buyerId),
    ]);
    const byId = new Map(products.map((p) => [p.id, p]));

    return lines.map((line) => {
      const p = byId.get(line.productId);
      if (!p) {
        return { line, problem: { message: "This product is no longer available", code: "CART_INVALID" as const } };
      }
      let variant: (typeof p.variants)[number] | null = null;
      if (line.variantId) {
        variant = p.variants.find((v) => v.id === line.variantId) ?? null;
        if (!variant) {
          return { line, problem: { message: `The selected option of "${p.name}" is no longer available`, code: "CART_INVALID" as const } };
        }
      } else if (p.variants.length > 0) {
        return { line, problem: { message: `Please choose an option for "${p.name}"`, code: "CART_INVALID" as const } };
      }
      const base = pricedWith(flashSales, p, variant?.id ?? null, this.sfRow(sf, p, variant ? variantPriceRow(p, variant) : p));
      // Bulk price: the tier this product's quantity in the cart reaches, when cheaper.
      const productTiers = tiers.get(p.id) ?? [];
      const vId = variant?.id ?? null;
      const sameProduct = lines.filter((l) => l.productId === p.id).map((l) => ({ variantId: l.variantId ?? null, qty: l.qty }));
      const bulk = productTiers.length
        ? withTier(base.price, tierFor(productTiers, vId, tierQty(productTiers, sameProduct, vId), business))
        : { price: base.price, tier: null };
      const priced = bulk.tier
        ? { price: bulk.price, compareAtPrice: base.compareAtPrice ?? base.price, flash: null }
        : base;
      const stockRow = variant ?? p;
      const what = `"${p.name}"${variant ? ` (${variantLabel(variant.attributeValues)})` : ""}`;
      const left = available(stockRow);
      const flashLeft = priced.flash?.remaining ?? null;
      const problem =
        left < line.qty
          ? { message: left <= 0 ? `${what} is out of stock` : `Only ${left} left of ${what}`, code: "INSUFFICIENT_STOCK" as const }
          : flashLeft !== null && flashLeft < line.qty
            ? { message: `Only ${flashLeft} of ${what} left at the flash-sale price`, code: "INSUFFICIENT_STOCK" as const }
            : null;
      return {
        line,
        problem,
        priced: {
          product: p,
          variant,
          qty: line.qty,
          unitPrice: priced.price,
          compareAtPrice: priced.compareAtPrice,
          flash: priced.flash,
          tier: bulk.tier,
          onSale: priced.compareAtPrice !== null,
          lineSubtotal: round2(priced.price * line.qty),
          weightKG: num(variant?.weight ?? p.weight) * line.qty,
        },
      };
    });
  }

  /** Re-prices cart lines from the DB. Throws on the first unknown / unavailable item. */
  private async priceLines(lines: CartLineDto[]) {
    const quoted = await this.quoteLines(lines);
    return quoted.map((q) => {
      if (q.problem || !q.priced) {
        throw new BadRequestError(q.problem?.message ?? "A product in your cart is no longer available", q.problem?.code ?? "CART_INVALID");
      }
      return q.priced;
    });
  }

  /** Current prices for the cart page, so a cart saved earlier shows what checkout will charge. */
  async cartPrices(lines: CartLineDto[], couponCode?: string, email?: string) {
    const quoted = await this.quoteLines(lines);
    const priced = quoted.filter((q) => !q.problem && q.priced).map((q) => q.priced!);
    const promo = await this.promotionQuote(priced);
    const coupon = couponCode ? await this.evaluateCoupon(couponCode, priced, email, promo.lineOff) : null;
    const dropped = !!coupon?.ok && !coupon.coupon.worksWithPromotions;
    const promotions = this.promotionsView(promo, dropped);
    // A signed-in customer's loyalty level: its % off what's left after promotions and the coupon.
    const loyalty = await checkoutLoyalty(prisma, this.storeId, this.ctx.customer?.id);
    const subtotal = round2(priced.reduce((a, l) => a + l.lineSubtotal, 0));
    const afterOthers = round2(subtotal - promotions.total - (coupon?.ok ? coupon.discount : 0));
    return {
      member: loyalty.level
        ? { level: loyalty.level.name, percent: loyalty.level.discountPercent, discount: memberDiscountFor(afterOthers, loyalty.level.discountPercent) }
        : null,
      promotions,
      items: quoted.map((q) => ({
        productId: String(q.line.productId),
        variantId: q.line.variantId ? String(q.line.variantId) : null,
        qty: q.line.qty,
        price: q.priced ? q.priced.unitPrice : null,
        compareAtPrice: q.priced?.compareAtPrice ?? null,
        flashSale: flashView(q.priced?.flash ?? null),
        bulk: q.priced?.tier ? { minQty: q.priced.tier.minQty, business: !q.priced.tier.forEveryone } : null,
        problem: q.problem?.message ?? null,
      })),
    };
  }

  /**
   * Validates a coupon against re-priced lines. Returns the discount, or an error message
   * (never throws for business-rule failures so /coupons/apply can answer `valid:false`).
   */
  private async evaluateCoupon(
    code: string,
    lines: Awaited<ReturnType<StorefrontService["priceLines"]>>,
    email: string | undefined,
    /** What automatic promotions already take off each line (same order as `lines`). */
    promoOff: number[] = [],
  ): Promise<
    | { ok: true; coupon: Coupon; discount: number; freeShipping: boolean; subtotal: number }
    | { ok: false; error: string }
  > {
    const coupon = await prisma.coupon.findFirst({ where: { storeId: this.storeId, code: code.trim().toUpperCase() } });
    const subtotal = round2(lines.reduce((s, l) => s + l.lineSubtotal, 0));
    if (!coupon || !coupon.isActive || !onStorefront(coupon.storefrontIds, (await this.storefront()).id)) {
      return { ok: false, error: "This coupon code is not valid" };
    }
    const now = new Date();
    if (coupon.startsAt && coupon.startsAt > now) return { ok: false, error: "This coupon is not active yet" };
    if (coupon.expiresAt && coupon.expiresAt < now) return { ok: false, error: "This coupon has expired" };
    if (coupon.totalUsageLimit !== null && coupon.usageCount >= coupon.totalUsageLimit) {
      return { ok: false, error: "This coupon has reached its usage limit" };
    }
    if (coupon.minSubtotal !== null && subtotal < num(coupon.minSubtotal)) {
      return { ok: false, error: `Add ৳${round2(num(coupon.minSubtotal) - subtotal)} more to use this coupon (minimum ৳${num(coupon.minSubtotal)})` };
    }
    if (coupon.maxSubtotal !== null && subtotal > num(coupon.maxSubtotal)) {
      return { ok: false, error: `This coupon only applies to orders up to ৳${num(coupon.maxSubtotal)}` };
    }

    const allowedEmails = Array.isArray(coupon.customerEmails) ? (coupon.customerEmails as string[]).map((e) => e.toLowerCase()) : [];
    if (allowedEmails.length) {
      if (!email) return { ok: false, error: "Enter your email to use this coupon" };
      if (!allowedEmails.includes(email)) return { ok: false, error: "This coupon is not available for your account" };
    }
    if (email && (coupon.perCustomerLimit !== null || coupon.newCustomersOnly)) {
      const [usedCount, orderCount] = await Promise.all([
        prisma.order.count({ where: { storeId: this.storeId, billingEmail: email, couponUsed: coupon.code, status: { not: "CANCELLED" } } }),
        prisma.order.count({ where: { storeId: this.storeId, billingEmail: email, status: { not: "CANCELLED" } } }),
      ]);
      if (coupon.perCustomerLimit !== null && usedCount >= coupon.perCustomerLimit) {
        return { ok: false, error: "You have already used this coupon" };
      }
      if (coupon.newCustomersOnly && orderCount > 0) return { ok: false, error: "This coupon is for first orders only" };
    }

    const ids = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);
    const include = ids(coupon.productIds);
    const exclude = ids(coupon.excludeProductIds);
    const cats = ids(coupon.categoryIds);
    // A coupon that doesn't work with promotions doesn't count flash-sale items either, and is
    // worked out on full prices (the promotions are dropped when it's used).
    const off = coupon.worksWithPromotions ? promoOff : [];
    const eligible = lines.map((l, i) => ({ ...l, lineSubtotal: round2(l.lineSubtotal - (off[i] ?? 0)) })).filter((l) => {
      const pid = String(l.product.id);
      if (exclude.includes(pid)) return false;
      if (coupon.excludeSales && l.onSale) return false;
      if (!coupon.worksWithPromotions && l.flash) return false;
      if (include.length && !include.includes(pid)) return false;
      if (cats.length && !l.product.categories.some((c) => cats.includes(String(c.categoryId)))) return false;
      return true;
    });
    const eligibleSubtotal = eligible.reduce((s, l) => s + l.lineSubtotal, 0);
    const amount = num(coupon.amount);

    let discount = 0;
    let freeShipping = coupon.freeShipping;
    switch (coupon.type) {
      case "PERCENTAGE":
        discount = (eligibleSubtotal * amount) / 100;
        break;
      case "FIXED_CART":
        discount = eligible.length ? amount : 0;
        break;
      case "FIXED_PRODUCT":
        discount = eligible.reduce((s, l) => s + Math.min(l.lineSubtotal, Math.min(l.unitPrice, amount) * l.qty), 0);
        break;
      case "FREE_SHIPPING":
        freeShipping = true;
        break;
      default:
        return { ok: false, error: "This coupon type cannot be used at checkout yet" };
    }
    if (coupon.type !== "FREE_SHIPPING" && eligible.length === 0) {
      return { ok: false, error: "This coupon does not apply to the items in your cart" };
    }
    discount = round2(Math.min(discount, eligibleSubtotal));
    return { ok: true, coupon, discount, freeShipping, subtotal };
  }

  /**
   * Automatic promotions on priced lines (rules: marketing/promotions.rules.ts): what comes off each
   * line, the free gifts that are in stock, free delivery and nudges ("Add ৳300 more for …").
   */
  private async promotionQuote(lines: PricedLine[]) {
    const [rules, lineage] = lines.length
      ? await Promise.all([livePromotionRules(this.storeId, new Date(), (await this.storefront()).id), categoryLineage(this.storeId)])
      : [[], () => []];
    const result = evaluatePromotions(
      lines.map((l, i) => ({
        key: String(i),
        productId: String(l.product.id),
        name: l.product.name,
        // With parent categories, so an offer on "Men" covers "Men > Shirts".
        categoryIds: lineage(l.product.categories.map((c) => c.categoryId)),
        unitPrice: l.unitPrice,
        qty: l.qty,
        onSale: l.onSale,
      })),
      rules,
    );
    const lineOff = lines.map((_, i) => result.lineDiscounts[String(i)] ?? 0);
    const { gifts, notes } = await this.resolveGifts(result.gifts, lines);
    return { result, lineOff, gifts, notes };
  }

  /** Gift products that exist and have stock left after what the order itself buys. */
  private async resolveGifts(want: PromoResult["gifts"], lines: PricedLine[]) {
    const gifts: {
      promotionId: string;
      promotionName: string;
      product: Prisma.ProductGetPayload<{ include: { variants: true; images: true } }>;
      variant: Prisma.ProductVariantGetPayload<object> | null;
      qty: number;
      title: string;
      imageUrl: string | null;
    }[] = [];
    const notes: string[] = [];
    if (!want.length) return { gifts, notes };
    const products = await prisma.product.findMany({
      where: { storeId: this.storeId, id: { in: want.map((g) => BigInt(g.productId)) } },
      include: { variants: { where: { status: "active" } }, images: { orderBy: { sortOrder: "asc" }, take: 1 } },
    });
    for (const g of want) {
      const p = products.find((x) => String(x.id) === g.productId);
      const v = g.variantId ? (p?.variants.find((x) => String(x.id) === g.variantId) ?? null) : null;
      if (!p || (g.variantId && !v)) {
        notes.push(`The free gift from "${g.name}" is no longer available`);
        continue;
      }
      const bought = lines.filter((l) => l.product.id === p.id && (l.variant?.id ?? null) === (v?.id ?? null)).reduce((s, l) => s + l.qty, 0);
      if (available(v ?? p) - bought < g.qty) {
        notes.push(`The free gift from "${g.name}" has run out`);
        continue;
      }
      gifts.push({
        promotionId: g.id,
        promotionName: g.name,
        product: p,
        variant: v,
        qty: g.qty,
        title: v ? `${p.name} (${variantLabel(v.attributeValues)})` : p.name,
        imageUrl: v?.imageUrl ?? p.images[0]?.imageUrl ?? null,
      });
    }
    return { gifts, notes };
  }

  /** Promotions as the cart, checkout and admin order form show them. */
  private promotionsView(promo: Awaited<ReturnType<StorefrontService["promotionQuote"]>>, droppedForCoupon = false) {
    const r = promo.result;
    return {
      droppedForCoupon,
      total: droppedForCoupon ? 0 : r.total,
      discount: droppedForCoupon ? null : r.discount,
      bxgy: droppedForCoupon ? [] : r.bxgy,
      gifts: droppedForCoupon
        ? []
        : promo.gifts.map((g) => ({
            promotionId: g.promotionId,
            promotionName: g.promotionName,
            productId: String(g.product.id),
            variantId: g.variant ? String(g.variant.id) : null,
            title: g.title,
            qty: g.qty,
            imageUrl: g.imageUrl,
          })),
      freeDelivery: droppedForCoupon ? null : r.freeDelivery,
      nudges: droppedForCoupon ? [] : r.nudges,
      notes: droppedForCoupon ? [] : promo.notes,
    };
  }

  /**
   * Coupons the cart can offer: public ones anyone may use, plus ones given to the signed-in
   * customer. Private codes are never listed. Limits are checked again when one is applied.
   */
  async availableCoupons() {
    const now = new Date();
    const customerId = this.ctx.customer?.id;
    const email = customerId
      ? (await prisma.customer.findFirst({ where: { id: customerId, storeId: this.storeId }, select: { email: true } }))?.email?.toLowerCase()
      : undefined;
    const rows = await prisma.coupon.findMany({
      where: {
        storeId: this.storeId,
        isActive: true,
        audience: { in: email ? ["public", "given"] : ["public"] },
        AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }],
      },
      orderBy: [{ expiresAt: "asc" }, { id: "desc" }],
      take: 50,
    });
    const sf = await this.storefront();
    return rows
      .filter((c) => onStorefront(c.storefrontIds, sf.id))
      .filter((c) => c.totalUsageLimit === null || c.usageCount < c.totalUsageLimit)
      .filter((c) => c.audience !== "given" || (Array.isArray(c.customerEmails) && (c.customerEmails as string[]).some((e) => e.toLowerCase() === email)))
      .map((c) => {
        const amount = num(c.amount);
        const summary =
          c.type === "PERCENTAGE" ? `${amount}% off` : c.type === "FREE_SHIPPING" ? "Free delivery" : `৳${amount} off`;
        return {
          code: c.code,
          summary: c.freeShipping && c.type !== "FREE_SHIPPING" ? `${summary} + free delivery` : summary,
          description: c.description,
          minSubtotal: c.minSubtotal === null ? null : num(c.minSubtotal),
          expiresAt: c.expiresAt?.toISOString() ?? null,
          forYou: c.audience === "given",
          worksWithPromotions: c.worksWithPromotions,
        };
      });
  }

  async applyCoupon(dto: ApplyCouponDto) {
    const lines = await this.priceLines(dto.items);
    const promo = await this.promotionQuote(lines);
    const result = await this.evaluateCoupon(dto.code, lines, dto.email, promo.lineOff);
    if (!result.ok) {
      return { valid: false, couponCode: dto.code, discountAmount: 0, errorMessage: result.error };
    }
    const shippingDiscount = result.freeShipping ? round2(dto.shippingTotal ?? 0) : 0;
    return {
      valid: true,
      couponCode: result.coupon.code as string,
      discountAmount: result.discount,
      discountType: result.coupon.type as string,
      freeShipping: result.freeShipping,
      shippingDiscount,
      message: result.coupon.description ?? undefined,
      newSubtotal: round2(result.subtotal - result.discount - (result.coupon.worksWithPromotions ? promo.result.total : 0)),
      /** False: the automatic promotions come off the order while this coupon is on it. */
      worksWithPromotions: result.coupon.worksWithPromotions,
    };
  }

  // ------------------------------------------------------------------ checkout

  private async nextOrderNumber(t: Prisma.TransactionClient): Promise<string> {
    const d = new Date();
    const datePart = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
    const count = await t.order.count({ where: { number: { startsWith: datePart } } });
    return `${datePart}${String(count + 1).padStart(6, "0")}`;
  }

  /** A checkout address with its division/district/upazila names taken from the picked area. */
  private async withLocation(a: StorefrontAddressDto) {
    const r = await addressWithLocation({
      countryCode: a.country,
      locationId: a.locationId,
      division: a.division,
      district: a.district,
      upazila: a.upazila,
    });
    return { ...a, division: r.division ?? "", district: r.district ?? a.district, upazila: r.upazila ?? "", locationId: r.locationId, chain: r.chain };
  }

  /**
   * Prices an order without saving it: lines (flash sales included), delivery, coupon, a staff
   * discount, tax and payment fee. Storefront checkout and manual orders in the admin both use it,
   * so they charge the same way. With `strict`, the first problem throws; otherwise problems are
   * collected so the admin's order form can show them next to the totals.
   */
  async quoteOrder(input: OrderDraft) {
    const storeId = this.storeId;
    const problems: string[] = [];
    const fail = (message: string, code: ErrorCode) => {
      if (input.strict) throw new BadRequestError(message, code);
      problems.push(message);
    };

    const gateway = await prisma.paymentGatewayConfig.findFirst({ where: { storeId, code: input.paymentGateway } });
    const offered = gatewayOffered((await this.storefront()).paymentGateways, input.paymentGateway);
    if (!gateway || (input.requireEnabledGateway && (!gateway.enabled || !offered))) {
      fail(`Payment method "${input.paymentGateway}" is not available for this store`, "PAYMENT_GATEWAY_ERROR");
    }

    const quoted = await this.quoteLines(input.items, input.customerId ?? this.ctx.customer?.id);
    const lines: PricedLine[] = [];
    for (const q of quoted) {
      if (q.problem || !q.priced) fail(q.problem?.message ?? "A product is no longer available", q.problem?.code ?? "CART_INVALID");
      if (q.priced) lines.push(q.priced);
    }
    const itemsSubtotal = round2(lines.reduce((s, l) => s + l.lineSubtotal, 0));
    const qty = lines.reduce((s, l) => s + l.qty, 0);
    const weightKG = lines.reduce((s, l) => s + l.weightKG, 0);

    const ship = await this.withLocation(input.shippingAddress);
    const bill = input.billingSameAsShipping || !input.billingAddress ? ship : await this.withLocation(input.billingAddress);
    if (ship.chain.length) {
      const off = offInChain(ship.chain, await storeLocationsOff(storeId));
      if (off) fail(`Sorry, we don't deliver to ${off.nameEn} yet.`, "LOCATION_NOT_SERVED");
    }

    // Delivery: a method the zone matcher offers for this address, a fee the staff typed, or pickup.
    let shippingOptions: DeliveryOption[] = [];
    let delivery: { zoneId: bigint | null; code: string; name: string; fee: number } | null = null;
    if ("methodId" in input.delivery || input.listShippingOptions) {
      const rates: any = await this.shipping.computeShippingOptions(this.ctx, {
        countryCode: ship.country,
        division: ship.division || undefined,
        district: ship.district,
        upazila: ship.upazila || undefined,
        locationId: ship.locationId ?? undefined,
        postcode: ship.postcode || undefined,
        subtotal: itemsSubtotal,
        weightKG,
        qty,
      } as any);
      shippingOptions = (rates.options as any[]).map((o) => ({
        id: String(o.id),
        zoneId: o.zoneId ? String(o.zoneId) : null,
        code: o.code,
        name: o.name,
        fee: o.finalRateBDT,
        freeReason: o.freeReason ?? null,
        minDays: o.transit?.minDays ?? null,
        maxDays: o.transit?.maxDays ?? null,
      }));
      if (!shippingOptions.length && rates.reason && "methodId" in input.delivery) fail(rates.reason, "SHIPPING_UNAVAILABLE_FOR_ZONE");
    }
    if ("methodId" in input.delivery) {
      const methodId = String(input.delivery.methodId);
      const o = shippingOptions.find((x) => x.id === methodId);
      if (o) delivery = { zoneId: o.zoneId ? BigInt(o.zoneId) : null, code: o.code, name: o.name, fee: o.fee };
      else if (shippingOptions.length) fail("The selected delivery option is not available for this address", "SHIPPING_UNAVAILABLE_FOR_ZONE");
    } else if ("customFee" in input.delivery) {
      delivery = { zoneId: null, code: "custom", name: input.delivery.name || "Delivery", fee: round2(input.delivery.customFee) };
    } else {
      delivery = { zoneId: null, code: "pickup", name: "Pickup / walk-in", fee: 0 };
    }

    // Automatic promotions, then the coupon, then the staff discount on what's left.
    const promo = await this.promotionQuote(input.applyPromotions === false ? [] : lines);
    let coupon: Coupon | null = null;
    let couponDiscount = 0;
    let freeShipping = false;
    let couponError: string | null = null;
    if (input.couponCode && lines.length) {
      const r = await this.evaluateCoupon(input.couponCode, lines, input.email ?? undefined, promo.lineOff);
      if (r.ok) {
        coupon = r.coupon;
        couponDiscount = r.discount;
        freeShipping = r.freeShipping;
      } else {
        couponError = r.error;
        fail(r.error, "COUPON_INVALID");
      }
    }
    const promotionsOff = !!coupon && !coupon.worksWithPromotions;
    const promotions = this.promotionsView(promo, promotionsOff);
    const promotionDiscount = promotions.total;
    const promoLineOff = promotionsOff ? lines.map(() => 0) : promo.lineOff;
    const gifts = promotionsOff ? [] : promo.gifts;
    // Free delivery from a promotion applies to the store's delivery options, not a fee staff typed.
    const freeDeliveryApplied = !!promotions.freeDelivery && "methodId" in input.delivery && (delivery?.fee ?? 0) > 0;
    if (freeDeliveryApplied) freeShipping = true;
    const afterCoupon = round2(itemsSubtotal - promotionDiscount - couponDiscount);
    const manualDiscount = input.manualDiscount
      ? round2(
          Math.min(
            afterCoupon,
            input.manualDiscount.type === "percent"
              ? (itemsSubtotal * input.manualDiscount.value) / 100
              : input.manualDiscount.value,
          ),
        )
      : 0;
    // Loyalty level: its % off what's left after promotions, the coupon and any staff discount.
    const loyalty = await checkoutLoyalty(prisma, storeId, input.customerId);
    const memberDiscount = loyalty.level ? memberDiscountFor(round2(afterCoupon - manualDiscount), loyalty.level.discountPercent) : 0;
    const discountTotal = round2(promotionDiscount + couponDiscount + manualDiscount + memberDiscount);
    const shippingTotal = freeShipping ? 0 : round2(delivery?.fee ?? 0);

    // Tax on the discounted subtotal + shipping (same inputs the checkout page shows).
    const taxes = await this.shipping.resolveTaxes(this.ctx, {
      countryCode: ship.country,
      state: ship.division || undefined,
      city: ship.district,
      postcode: ship.postcode || undefined,
      subtotal: round2(itemsSubtotal - discountTotal),
      shippingTotal,
    });
    const taxTotal = round2(taxes.totalTax);
    const feeTotal =
      input.applyGatewayFee && gateway
        ? round2(num(gateway.feeFixed) + ((itemsSubtotal - discountTotal) * num(gateway.feePercent)) / 100)
        : 0;
    const orderTotal = round2(itemsSubtotal - discountTotal + shippingTotal + taxTotal + feeTotal);
    // The wallet pays part or all of it; grandTotal is what's left for the payment method.
    const walletUsed = input.useWallet ? walletUse(orderTotal, loyalty.balance, Number(loyalty.settings.walletMaxPercent)) : 0;
    const grandTotal = round2(orderTotal - walletUsed);

    return {
      problems,
      gateway,
      email: input.email ?? null,
      lines,
      quotedLines: quoted,
      ship,
      bill,
      shippingOptions,
      delivery,
      coupon,
      couponError,
      promotions,
      freeDeliveryApplied,
      promoLineOff,
      gifts,
      member: loyalty.level ? { level: loyalty.level.name, percent: loyalty.level.discountPercent } : null,
      wallet: { balance: loyalty.balance, enabled: loyalty.settings.walletEnabled, maxPercent: Number(loyalty.settings.walletMaxPercent) },
      totals: { itemsSubtotal, promotionDiscount, couponDiscount, manualDiscount, memberDiscount, discountTotal, shippingTotal, taxTotal, feeTotal, orderTotal, walletUsed, grandTotal, qty, weightKG },
    };
  }

  /**
   * Saves a priced order in one transaction: stock held for it in the warehouse it ships from
   * (guarded against overselling), flash-sale limits, coupon usage and the order with its lines
   * and first status entry. Stock leaves the shelf when a parcel is packed (fulfilment).
   */
  async createOrder(q: OrderQuote, meta: OrderMeta) {
    if (q.problems.length) throw new BadRequestError(q.problems[0]!, "CART_INVALID");
    if (!q.gateway || !q.delivery) throw new BadRequestError("The order is missing a payment or delivery method", "CART_INVALID");
    const storeId = this.storeId;
    const { lines, ship, bill, coupon, delivery, gateway } = q;
    const storefrontId = (await this.storefront()).id;
    const { itemsSubtotal, discountTotal, shippingTotal, taxTotal, feeTotal, grandTotal } = q.totals;
    const orderKey = newId("ok");
    const status = meta.status ?? "PENDING";

    return tx(async (t: Prisma.TransactionClient) => {
      // Hold the stock in the warehouse the order ships from; the guard stops overselling.
      const skuOf = (x: { product: { id: bigint }; variant?: { id: bigint } | null }) => ({ productId: x.product.id, variantId: x.variant?.id ?? null });
      const warehouseId = await chooseWarehouse(t, storeId, [...lines, ...q.gifts].map((x) => ({ sku: skuOf(x), qty: x.qty })));
      const held: number[] = [];
      for (const l of lines) {
        const r = await moveStock(t, { storeId, warehouseId, sku: skuOf(l), reserved: l.qty, guard: "available", reason: "ORDER_RESERVE", ref: orderKey, label: l.product.name });
        held.push(r.applied ? l.qty : 0);
      }
      await t.product.updateMany({ where: { id: { in: lines.map((l) => l.product.id) } }, data: { saleCount: { increment: 1 } } });

      // Units bought at a flash-sale price count against that item's stock limit.
      for (const l of lines) {
        if (!l.flash?.itemId) continue;
        const bumped = await t.$executeRaw`
          UPDATE "FlashSaleItem" SET "soldCount" = "soldCount" + ${l.qty}
          WHERE id = ${l.flash.itemId} AND ("stockLimit" IS NULL OR "soldCount" + ${l.qty} <= "stockLimit")`;
        if (bumped === 0) {
          throw new BadRequestError(`The flash-sale price for "${l.product.name}" just sold out — please review the order`, "INSUFFICIENT_STOCK");
        }
      }

      if (coupon) {
        const bumped = await t.coupon.updateMany({
          where: {
            id: coupon.id,
            ...(coupon.totalUsageLimit !== null ? { usageCount: { lt: coupon.totalUsageLimit } } : {}),
          },
          data: { usageCount: { increment: 1 } },
        });
        if (bumped.count === 0) throw new BadRequestError("This coupon has reached its usage limit", "COUPON_ALREADY_USED");
      }

      // Free gifts: taken from stock like any line; one that sold out meanwhile is left out.
      const giftItems: Prisma.OrderItemUncheckedCreateWithoutOrderInput[] = [];
      for (const g of q.gifts) {
        let giftHeld = 0;
        try {
          const r = await moveStock(t, { storeId, warehouseId, sku: skuOf(g), reserved: g.qty, guard: "available", reason: "ORDER_RESERVE", ref: orderKey, label: g.product.name });
          giftHeld = r.applied ? g.qty : 0;
        } catch (e) {
          if (e instanceof BadRequestError) continue;
          throw e;
        }
        giftItems.push({
          productId: g.product.id,
          variantId: g.variant?.id ?? null,
          productName: g.product.name,
          productSku: g.variant?.sku ?? g.product.sku,
          variantValues: (g.variant?.attributeValues as Prisma.InputJsonValue) ?? undefined,
          imageUrl: g.imageUrl,
          quantity: g.qty,
          qtyReserved: giftHeld,
          unitPrice: 0,
          // A free gift still cost the shop something.
          unitCost: g.variant?.costPrice ?? g.product.costPrice ?? null,
          lineSubtotal: 0,
          lineDiscount: 0,
          lineTax: 0,
          lineTotal: 0,
          meta: { gift: { promotionId: g.promotionId, promotionName: g.promotionName } },
        });
      }
      const applied = [
        ...(q.promotions.discount ? [{ id: q.promotions.discount.id, name: q.promotions.discount.name, type: "discount", amount: q.promotions.discount.amount }] : []),
        ...q.promotions.bxgy.map((b) => ({ id: b.id, name: b.name, type: "bxgy", amount: b.amount, productName: b.productName, freeUnits: b.freeUnits })),
        ...(q.promotions.freeDelivery && q.freeDeliveryApplied ? [{ id: q.promotions.freeDelivery.id, name: q.promotions.freeDelivery.name, type: "free_delivery", amount: 0 }] : []),
        ...giftItems.map((g) => {
          const m = (g.meta as { gift: { promotionId: string; promotionName: string } }).gift;
          return { id: m.promotionId, name: m.promotionName, type: "free_gift", amount: 0, gift: g.productName, qty: g.quantity };
        }),
      ];
      const usedIds = [...new Set(applied.map((a) => BigInt(a.id)))];
      if (usedIds.length) await t.promotion.updateMany({ where: { id: { in: usedIds }, storeId }, data: { usedCount: { increment: 1 } } });

      // Promotions come off the lines they apply to; the coupon and staff discount spread over what's left.
      const promoOff = q.promoLineOff;
      const promotionDiscount = q.totals.promotionDiscount;
      const restDiscount = round2(discountTotal - promotionDiscount);
      const restRatio = restDiscount > 0 && itemsSubtotal - promotionDiscount > 0 ? restDiscount / (itemsSubtotal - promotionDiscount) : 0;
      // Spread the item share of the tax (tax total minus the shipping share) across lines.
      const taxable = itemsSubtotal - discountTotal;
      const itemTaxRatio = taxable > 0 ? (taxTotal * (taxable / (taxable + shippingTotal))) / taxable : 0;

      const order = await t.order.create({
        data: {
          storeId,
          number: await this.nextOrderNumber(t),
          orderKey,
          status,
          currencyCode: "BDT",
          customerId: meta.customerId,
          isGuest: meta.customerId === null,
          customerNote: meta.customerNote ?? null,
          warehouseId,
          ipAddress: null,
          source: meta.source,
          createdByAdminId: meta.createdByAdminId ?? null,
          billingFirstName: bill.firstName,
          billingLastName: bill.lastName,
          billingCompany: bill.company ?? null,
          billingAddress1: bill.addressLine1,
          billingAddress2: bill.addressLine2 || null,
          billingCity: bill.district,
          billingState: bill.division || null,
          billingUpazila: bill.upazila || null,
          billingPostcode: bill.postcode || null,
          billingCountryCode: bill.country,
          billingEmail: q.email,
          billingPhone: bill.phone,
          shippingSameAsBilling: bill === ship,
          shippingFirstName: ship.firstName,
          shippingLastName: ship.lastName,
          shippingCompany: ship.company ?? null,
          shippingAddress1: ship.addressLine1,
          shippingAddress2: ship.addressLine2 || null,
          shippingCity: ship.district,
          shippingState: ship.division || null,
          shippingUpazila: ship.upazila || null,
          shippingLocationId: ship.locationId,
          shippingPostcode: ship.postcode || null,
          shippingCountryCode: ship.country,
          shippingPhone: ship.phone,
          shippingZoneId: delivery.zoneId,
          shippingMethodCode: delivery.code,
          shippingMethodName: delivery.name,
          itemsSubtotal,
          discountTotal,
          shippingTotal,
          taxTotal,
          feeTotal,
          grandTotal,
          couponUsed: coupon?.code ?? null,
          couponDiscountAmount: q.totals.couponDiscount,
          promotionDiscount,
          promotions: applied.length ? (applied as Prisma.InputJsonValue) : undefined,
          manualDiscount: q.totals.manualDiscount,
          memberDiscount: q.totals.memberDiscount,
          memberLevel: q.member?.level ?? null,
          walletUsed: q.totals.walletUsed,
          locale: this.ctx.locale,
          storefrontId,
          paymentGatewayCode: gateway.code,
          // Paid in full from the wallet: nothing left to collect.
          paymentStatus: meta.paid || (q.totals.walletUsed > 0 && grandTotal <= 0) ? "paid" : "unpaid",
          paidAt: meta.paid || (q.totals.walletUsed > 0 && grandTotal <= 0) ? new Date() : null,
          transactionId: meta.transactionId ?? null,
          items: {
            create: [
              ...lines.map((l, i) => {
              const lineDiscount = round2((promoOff[i] ?? 0) + (l.lineSubtotal - (promoOff[i] ?? 0)) * restRatio);
              const lineTax = round2((l.lineSubtotal - lineDiscount) * itemTaxRatio);
              return {
                productId: l.product.id,
                variantId: l.variant?.id ?? null,
                productName: l.product.name,
                productSku: l.variant?.sku ?? l.product.sku,
                variantValues: (l.variant?.attributeValues as Prisma.InputJsonValue) ?? undefined,
                imageUrl: l.variant?.imageUrl ?? l.product.images[0]?.imageUrl ?? null,
                quantity: l.qty,
                qtyReserved: held[i] ?? 0,
                unitPrice: l.unitPrice,
                unitCost: l.variant?.costPrice ?? l.product.costPrice ?? null,
                lineSubtotal: l.lineSubtotal,
                lineDiscount,
                lineTax,
                lineTotal: round2(l.lineSubtotal - lineDiscount + lineTax),
                meta: l.flash
                  ? { flashSale: { id: String(l.flash.saleId), itemId: l.flash.itemId ? String(l.flash.itemId) : null, name: l.flash.name } }
                  : undefined,
              };
            }),
              ...giftItems,
            ],
          },
          statusHistory: {
            create: { status, note: meta.historyNote, notifyCustomer: meta.notifyCustomer ?? true, adminId: meta.createdByAdminId ?? null },
          },
        },
      });
      if (meta.paid) await recordPaidAtEntry(t, order, meta.createdByAdminId ?? null);
      await onOrderPlaced(t, storeId, {
        id: order.id,
        number: order.number,
        customerId: meta.customerId,
        walletUsed: q.totals.walletUsed,
        itemsNet: round2(itemsSubtotal - discountTotal),
      });
      // A bKash / Nagad / bank payment the customer reported at checkout waits for staff to check it.
      if (meta.transfer) {
        await t.paymentRecord.create({
          data: {
            storeId, orderId: order.id, kind: "transfer", method: gateway.code, amount: grandTotal,
            transactionId: meta.transfer.transactionId, senderNumber: meta.transfer.senderNumber,
            status: "to_verify", moneyIsWith: "customer", submittedBy: "customer",
          },
        });
      }
      return order;
    });
  }

  /** A transaction ID typed at checkout: right shape, and not already used in this store. */
  private async checkTransfer(method: string, p: { transactionId: string; senderNumber?: string }) {
    const problem = trxIdProblem(method, p.transactionId);
    if (problem) throw new BadRequestError(problem, "VALIDATION_FAILED");
    const transactionId = method === "bank_transfer" ? p.transactionId.trim().toUpperCase() : normalizeTrxId(p.transactionId);
    let senderNumber: string | null = null;
    if (p.senderNumber) {
      senderNumber = method === "bank_transfer" ? p.senderNumber.trim() : normalizeBdMobile(p.senderNumber);
      if (!senderNumber) throw new BadRequestError("Enter the wallet number you paid from, e.g. 01712345678", "VALIDATION_FAILED");
    } else if (method !== "bank_transfer") {
      throw new BadRequestError("Enter the wallet number you paid from", "VALIDATION_FAILED");
    }
    const used = await prisma.paymentRecord.findFirst({ where: { storeId: this.storeId, method, transactionId, status: { not: "rejected" } } });
    if (used) throw new BadRequestError("This transaction ID has already been used", "VALIDATION_FAILED");
    return { transactionId, senderNumber };
  }

  async placeOrder(dto: PlaceOrderDto) {
    const quote = await this.quoteOrder({
      strict: true,
      items: dto.items,
      email: dto.email,
      shippingAddress: dto.shippingAddress,
      billingAddress: dto.billingAddress,
      billingSameAsShipping: dto.billingSameAsShipping,
      delivery: { methodId: dto.shippingMethodId },
      couponCode: dto.couponCodes[0],
      paymentGateway: dto.paymentGateway,
      requireEnabledGateway: true,
      applyGatewayFee: true,
      customerId: this.ctx.customer?.id ?? null,
      useWallet: !!dto.useWallet && !!this.ctx.customer,
    });
    const manual = quote.gateway!.mode === "manual" && isManualCapable(quote.gateway!.code);
    const transfer = manual && dto.payment?.transactionId ? await this.checkTransfer(quote.gateway!.code, dto.payment) : undefined;
    const order = await this.createOrder(quote, {
      customerId: this.ctx.customer?.id ?? null,
      customerNote: dto.customerNote,
      transfer,
      source: "website",
      historyNote: `Order placed on storefront (${quote.gateway!.name}${transfer ? `, transaction ${transfer.transactionId} to verify` : ""})`,
    });

    emitOrderPlaced({ storeId: String(this.storeId), orderId: String(order.id) });

    const { grandTotal } = quote.totals;
    const bill = quote.bill;
    let redirectPaymentURL: string | undefined;
    if (!OFFLINE_GATEWAYS.has(dto.paymentGateway) && !manual) {
      try {
        const provider = getPaymentProvider(dto.paymentGateway as PaymentMethod);
        const init = await provider.initiate({
          orderId: order.id,
          orderNumber: order.number,
          amount: grandTotal,
          currencyCode: "BDT",
          customerEmail: dto.email ?? "",
          customerName: `${bill.firstName} ${bill.lastName}`,
          customerPhone: bill.phone,
          redirectUrl: "",
          ipnUrl: "",
          metadata: { orderKey: order.orderKey },
        } as any);
        redirectPaymentURL = init.redirectUrl;
      } catch {
        redirectPaymentURL = undefined;
      }
    }

    return {
      orderId: String(order.id),
      orderRef: order.number,
      orderNumber: order.number,
      orderKey: order.orderKey,
      status: order.status,
      paymentStatus: order.paymentStatus,
      grandTotal,
      currency: "BDT",
      customerEmail: dto.email,
      createdAt: order.createdAt.toISOString(),
      redirectPaymentURL,
    };
  }

  /** Enabled payment gateways, in the admin's sort order. */
  /** The enabled payment methods this storefront offers. */
  async paymentMethods() {
    const [rows, sf] = await Promise.all([
      prisma.paymentGatewayConfig.findMany({
        where: { storeId: this.storeId, enabled: true },
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      }),
      this.storefront(),
    ]);
    return rows.filter((g) => gatewayOffered(sf.paymentGateways, g.code)).map((g) => ({
      code: g.code,
      name: g.name,
      description: g.description ?? undefined,
      instructions: g.instructions ?? undefined,
      /** "manual": send money to accountNumber and give the transaction ID at checkout. */
      mode: g.mode === "manual" && isManualCapable(g.code) ? "manual" : g.code === "cod" ? "cod" : "online",
      accountNumber: g.mode === "manual" ? g.accountNumber ?? undefined : undefined,
      accountType: g.mode === "manual" ? g.accountType ?? undefined : undefined,
      feeFixed: num(g.feeFixed),
      feePercent: num(g.feePercent),
    }));
  }

  /** Guest-safe order lookup for the thank-you page. The orderKey is the secret. */
  async getOrderByKey(orderKey: string) {
    const o = await prisma.order.findFirst({
      where: { storeId: this.storeId, orderKey },
      include: { items: true, paymentRecords: true },
    });
    if (!o) throw new NotFoundError("Order");
    return { ...orderView(o), payment: await this.paymentView(o) };
  }

  /**
   * How the customer pays a bKash / Nagad / Rocket / bank order by hand: where to send the money,
   * what's still due, and the transaction IDs they gave with their state (a rejection says why).
   */
  private async paymentView(o: Prisma.OrderGetPayload<{ include: { paymentRecords: true } }>) {
    const g = await prisma.paymentGatewayConfig.findFirst({ where: { storeId: this.storeId, code: o.paymentGatewayCode } });
    const manual = !!g && g.mode === "manual" && isManualCapable(g.code);
    const state = PaymentsService.transferState(o);
    return {
      method: o.paymentGatewayCode,
      methodName: g?.name ?? o.paymentGatewayCode,
      manual,
      accountNumber: manual ? g!.accountNumber : null,
      accountType: manual ? g!.accountType : null,
      instructions: manual ? g!.instructions : null,
      due: state.due,
      canSubmit: manual && state.canSubmit && !["CANCELLED", "FAILED", "REFUNDED"].includes(o.status),
      transfers: o.paymentRecords
        .filter((r) => r.kind === "transfer")
        .map((r) => ({
          transactionId: r.transactionId,
          amount: num(r.amount),
          status: r.status,
          rejectReason: r.rejectReason,
          createdAt: r.createdAt.toISOString(),
        })),
    };
  }

  /* ---------------------------- Customer account ---------------------------- */

  private get customerId(): bigint {
    const id = this.ctx.customer?.id;
    if (id === undefined) throw new BadRequestError("Sign in to see your orders", "BAD_REQUEST");
    return BigInt(id);
  }

  /** The signed-in customer's orders, newest first. */
  async listMyOrders(q: { page: number; perPage: number }) {
    const where = { storeId: this.storeId, customerId: this.customerId };
    const [total, rows] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (q.page - 1) * q.perPage,
        take: q.perPage,
        include: { items: { select: { quantity: true, productName: true, imageUrl: true } } },
      }),
    ]);
    return {
      items: rows.map((o) => ({
        orderRef: o.number,
        status: o.status,
        paymentStatus: o.paymentStatus,
        createdAt: o.createdAt.toISOString(),
        itemCount: o.items.reduce((n, i) => n + i.quantity, 0),
        firstItem: o.items[0] ? { title: o.items[0].productName, image: o.items[0].imageUrl ?? "" } : null,
        grandTotal: num(o.grandTotal),
        currency: o.currencyCode,
        canCancel: CUSTOMER_CANCELLABLE.has(o.status),
      })),
      meta: { page: q.page, perPage: q.perPage, total, totalPages: Math.max(1, Math.ceil(total / q.perPage)) },
    };
  }

  private async findMyOrder(orderRef: string) {
    const o = await prisma.order.findFirst({
      where: { storeId: this.storeId, customerId: this.customerId, number: orderRef },
      include: {
        items: true,
        statusHistory: { orderBy: { createdAt: "asc" } },
        shipments: { where: { status: { not: "cancelled" } }, include: { items: true }, orderBy: { id: "asc" } },
        returns: { include: { items: true }, orderBy: { id: "asc" } },
        paymentRecords: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!o) throw new NotFoundError("Order");
    return o;
  }

  async getMyOrder(orderRef: string) {
    const o = await this.findMyOrder(orderRef);
    const name = new Map(o.items.map((i) => [String(i.id), i.productName]));
    // What can still be returned (returns that are open or done hold their items).
    const taken = new Map<string, number>();
    for (const r of o.returns) {
      if (r.status === "cancelled" || r.status === "rejected") continue;
      for (const i of r.items) taken.set(String(i.orderItemId), (taken.get(String(i.orderItemId)) ?? 0) + i.quantity);
    }
    const window = new FulfilmentService(this.ctx).returnWindow(o);
    const returnable = o.items
      .map((i) => ({ orderItemId: String(i.id), title: i.productName, variantLabel: variantLabel(i.variantValues), quantity: i.quantity - (taken.get(String(i.id)) ?? 0) }))
      .filter((i) => i.quantity > 0);
    return {
      ...orderView(o),
      canCancel: CUSTOMER_CANCELLABLE.has(o.status),
      history: o.statusHistory.map((l) => ({ status: l.status, note: l.note, at: l.createdAt.toISOString() })),
      fulfillmentStatus: o.fulfillmentStatus,
      parcels: o.shipments.map((sh) => ({
        code: sh.code,
        status: sh.status,
        courier: sh.providerName,
        trackingNumber: sh.trackingNumber,
        trackingUrl: sh.trackingUrl,
        shippedAt: sh.shippedAt?.toISOString() ?? null,
        deliveredAt: sh.deliveredAt?.toISOString() ?? null,
        items: sh.items.map((i) => ({ title: name.get(String(i.orderItemId)) ?? "Item", quantity: i.quantity })),
      })),
      returns: o.returns.map((r) => ({
        code: r.code,
        status: r.status,
        reason: r.reason,
        createdAt: r.createdAt.toISOString(),
        amount: Number(r.resolutionAmount ?? r.requestedAmount),
        items: r.items.map((i) => ({ title: name.get(String(i.orderItemId)) ?? "Item", quantity: i.quantity })),
      })),
      returnWindowUntil: window.until?.toISOString() ?? null,
      payment: await this.paymentView(o),
      canRequestReturn: window.open && returnable.length > 0,
      returnable,
    };
  }

  /** Customers may cancel their own order until the shop starts processing it. Stock goes back. */
  async cancelMyOrder(orderRef: string) {
    const o = await this.findMyOrder(orderRef);
    if (o.status === "CANCELLED") throw new ConflictError("This order is already cancelled.", "ORDER_CANNOT_CANCEL");
    if (!CUSTOMER_CANCELLABLE.has(o.status)) {
      throw new ConflictError("This order is already being processed, so it can't be cancelled here. Please contact the shop.", "ORDER_CANNOT_CANCEL");
    }
    await new OrdersService(this.ctx).transitionStatus(o.id, { newStatus: "CANCELLED", note: "Cancelled by customer", notifyCustomer: true } as never);
    return this.getMyOrder(orderRef);
  }
}

const CUSTOMER_CANCELLABLE = new Set(["PENDING"]);

type OrderWithItems = Prisma.OrderGetPayload<{ include: { items: true } }>;

/** Customer-facing view of an order (thank-you page and My Account). */
function orderView(o: OrderWithItems) {
  return {
    orderId: String(o.id),
    orderRef: o.number,
    orderKey: o.orderKey,
    status: o.status,
    paymentStatus: o.paymentStatus,
    paymentGateway: o.paymentGatewayCode,
    createdAt: o.createdAt.toISOString(),
    email: o.billingEmail,
    phone: o.shippingPhone ?? o.billingPhone,
    shippingMethodName: o.shippingMethodName,
    shipping: {
      name: `${o.shippingFirstName ?? o.billingFirstName} ${o.shippingLastName ?? o.billingLastName}`,
      address: [o.shippingAddress1, o.shippingAddress2].filter(Boolean).join(", "),
      city: o.shippingCity ?? o.billingCity,
      upazila: o.shippingCity ? o.shippingUpazila : o.billingUpazila,
      division: o.shippingState ?? o.billingState,
      postcode: o.shippingPostcode ?? o.billingPostcode,
      country: o.shippingCountryCode ?? o.billingCountryCode,
    },
    billing: {
      name: `${o.billingFirstName} ${o.billingLastName}`,
      address: [o.billingAddress1, o.billingAddress2].filter(Boolean).join(", "),
      city: o.billingCity,
      upazila: o.billingUpazila,
      division: o.billingState,
      postcode: o.billingPostcode,
      country: o.billingCountryCode,
    },
    items: o.items.map((i) => ({
      id: String(i.id),
      productId: i.productId ? String(i.productId) : null,
      title: i.productName,
      variantLabel: variantLabel(i.variantValues),
      image: i.imageUrl ?? "",
      qty: i.quantity,
      price: num(i.unitPrice),
      lineTotal: num(i.lineSubtotal),
      /** A free gift from a promotion (price 0). */
      giftFrom: ((i.meta as { gift?: { promotionName?: string } } | null)?.gift?.promotionName) ?? null,
    })),
    itemsSubtotal: num(o.itemsSubtotal),
    discountTotal: num(o.discountTotal),
    promotionDiscount: num(o.promotionDiscount),
    promotions: (o.promotions as { name: string; type: string; amount: number }[] | null) ?? [],
    couponUsed: o.couponUsed,
    shippingTotal: num(o.shippingTotal),
    taxTotal: num(o.taxTotal),
    feeTotal: num(o.feeTotal),
    grandTotal: num(o.grandTotal),
    /** Loyalty level discount (part of discountTotal), wallet payment and cashback earned. */
    memberDiscount: num(o.memberDiscount),
    memberLevel: o.memberLevel,
    walletUsed: num(o.walletUsed),
    cashback: num(o.cashbackAmount),
    currency: o.currencyCode,
  };
}
