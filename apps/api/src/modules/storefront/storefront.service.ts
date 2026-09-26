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
import { Prisma } from "@prisma/client";
import { prisma, tx } from "../../config";
import { BadRequestError, NotFoundError, type RequestContext } from "../../core";
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

const LIST_INCLUDE = {
  brand: { select: { id: true, name: true, slug: true } },
  categories: { include: { category: { select: { id: true, name: true, slug: true } } } },
  images: { orderBy: { sortOrder: "asc" as const }, take: 2 },
  variants: { where: { status: "active" }, select: { stockQty: true, reservedStock: true, manageStock: true, allowBackorder: true } },
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

  private toSummary(p: any) {
    const { price, compareAtPrice } = priceOf(p);
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
      title: p.name,
      image: images[0] ?? "",
      images,
      price,
      compareAtPrice,
      isOnSale: compareAtPrice !== null,
      discountPercent: compareAtPrice ? Math.round(((compareAtPrice - price) / compareAtPrice) * 100) : undefined,
      rating: num(p.averageRating),
      reviewCount: p.reviewCount ?? 0,
      isNew: createdAt ? Date.now() - createdAt.getTime() < 30 * 86_400_000 : false,
      isOutOfStock: qty <= 0,
      hasVariants: variants.length > 0,
      stockStatus: stockStatus(qty, p.lowStockThreshold),
      sku: p.sku ?? undefined,
      weightKG: p.weight !== null && p.weight !== undefined ? num(p.weight) : undefined,
      brandId: p.brandId ? String(p.brandId) : undefined,
      brand: p.brand ? { id: String(p.brand.id), name: p.brand.name, slug: p.brand.slug } : undefined,
      categoryId: primary ? String(primary.category.id) : undefined,
      category: primary
        ? { id: String(primary.category.id), slug: primary.category.slug, name: primary.category.name }
        : undefined,
      shortDescription: p.shortDescription ?? undefined,
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
    const where: Prisma.ProductWhereInput = { storeId: this.storeId, status: "published" };
    const and: Prisma.ProductWhereInput[] = [];

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
    if (q.search) {
      and.push({
        OR: [
          { name: { contains: q.search, mode: "insensitive" } },
          { sku: { contains: q.search, mode: "insensitive" } },
          { shortDescription: { contains: q.search, mode: "insensitive" } },
        ],
      });
    }
    if (q.minPrice !== undefined || q.maxPrice !== undefined) {
      // Filter on the price a shopper pays: salePrice when set, otherwise regularPrice.
      const range: Prisma.DecimalNullableFilter = {};
      if (q.minPrice !== undefined) range.gte = q.minPrice;
      if (q.maxPrice !== undefined) range.lte = q.maxPrice;
      and.push({ OR: [{ salePrice: range }, { salePrice: null, regularPrice: range }] });
    }
    if (and.length) where.AND = and;

    if (q.sort === "price_asc" || q.sort === "price_desc") {
      // Sort on the price a shopper pays (sale price inside its window), which Prisma's
      // orderBy cannot express, so rank the matching ids in memory and load one page.
      const candidates = await prisma.product.findMany({
        where,
        select: { id: true, regularPrice: true, salePrice: true, salePriceStartAt: true, salePriceEndAt: true },
      });
      const dir = q.sort === "price_asc" ? 1 : -1;
      const ranked = candidates
        .map((c) => ({ id: c.id, price: priceOf(c).price }))
        .sort((a, b) => dir * (a.price - b.price) || Number(a.id - b.id));
      const pageIds = ranked.slice((q.page - 1) * q.perPage, q.page * q.perPage).map((r) => r.id);
      const rows = await prisma.product.findMany({ where: { id: { in: pageIds } }, include: LIST_INCLUDE });
      const byId = new Map(rows.map((r) => [r.id, r]));
      const ordered = pageIds.map((id) => byId.get(id)).filter((r): r is (typeof rows)[number] => Boolean(r));
      return this.page(ordered.map((r) => this.toSummary(r)), ranked.length, q);
    }

    const orderBy: Prisma.ProductOrderByWithRelationInput[] =
      q.sort === "newest"
        ? [{ createdAt: "desc" }, { id: "desc" }]
        : q.sort === "rating"
          ? [{ averageRating: "desc" }, { reviewCount: "desc" }, { id: "desc" }]
          : [{ saleCount: "desc" }, { id: "desc" }];
    const [total, rows] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        orderBy,
        skip: (q.page - 1) * q.perPage,
        take: q.perPage,
        include: LIST_INCLUDE,
      }),
    ]);
    return this.page(rows.map((r) => this.toSummary(r)), total, q);
  }

  private page<T>(items: T[], total: number, q: { page: number; perPage: number }) {
    return { items, page: q.page, perPage: q.perPage, total, totalPages: Math.max(1, Math.ceil(total / q.perPage)) };
  }

  async getProductBySlug(slug: string) {
    const p = await prisma.product.findFirst({
      where: { storeId: this.storeId, slug, status: "published" },
      include: {
        brand: { select: { id: true, name: true, slug: true } },
        categories: { include: { category: { select: { id: true, name: true, slug: true, parentId: true } } } },
        images: { orderBy: { sortOrder: "asc" } },
        variants: { where: { status: "active" }, orderBy: { id: "asc" } },
        attributes: { include: { attribute: true, terms: { include: { term: true } } } },
        reviews: {
          where: { status: "approved" },
          orderBy: { createdAt: "desc" },
          take: 20,
          include: { customer: { select: { firstName: true, lastName: true } } },
        },
      },
    });
    if (!p) throw new NotFoundError("Product");

    const summary = this.toSummary(p);
    const primary = p.categories.find((c) => c.primary) ?? p.categories[0];
    const parent = primary?.category.parentId
      ? await prisma.category.findFirst({
          where: { id: primary.category.parentId, storeId: this.storeId },
          select: { id: true, name: true, slug: true },
        })
      : null;

    const specifications = [
      ...(p.brand ? [{ name: "Brand", value: p.brand.name }] : []),
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
      description: p.description ?? undefined,
      breadcrumbs: [parent, primary?.category]
        .filter((c): c is { id: bigint; name: string; slug: string; parentId?: bigint | null } => Boolean(c))
        .map((c) => ({ id: String(c.id), name: c.name, slug: c.slug })),
      specifications,
      reviews,
      variants: p.variants.map((v) => {
        const vp = priceOf({
          regularPrice: v.regularPrice ?? p.regularPrice,
          salePrice: v.salePrice ?? (v.regularPrice ? null : p.salePrice),
          salePriceStartAt: v.salePriceStartAt,
          salePriceEndAt: v.salePriceEndAt,
        });
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
        name: c.name,
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
      name: b.name,
      logo: b.logoUrl ?? undefined,
      productCount: b._count.products,
    }));
  }

  // ------------------------------------------------------------------ pricing

  /** Loads and re-prices cart lines from the DB. Throws on unknown / unavailable items. */
  private async priceLines(lines: CartLineDto[]) {
    const productIds = [...new Set(lines.map((l) => l.productId))];
    const products = await prisma.product.findMany({
      where: { storeId: this.storeId, id: { in: productIds }, status: "published" },
      include: {
        variants: { where: { status: "active" } },
        images: { orderBy: { sortOrder: "asc" }, take: 1 },
        categories: { select: { categoryId: true } },
      },
    });
    const byId = new Map(products.map((p) => [p.id, p]));

    return lines.map((line) => {
      const p = byId.get(line.productId);
      if (!p) throw new BadRequestError(`A product in your cart is no longer available (id=${line.productId})`, "CART_INVALID");
      let variant: (typeof p.variants)[number] | null = null;
      if (line.variantId) {
        variant = p.variants.find((v) => v.id === line.variantId) ?? null;
        if (!variant) throw new BadRequestError(`The selected option of "${p.name}" is no longer available`, "CART_INVALID");
      } else if (p.variants.length > 0) {
        throw new BadRequestError(`Please choose an option for "${p.name}"`, "CART_INVALID");
      }
      const priced = variant
        ? priceOf({
            regularPrice: variant.regularPrice ?? p.regularPrice,
            salePrice: variant.salePrice ?? (variant.regularPrice ? null : p.salePrice),
            salePriceStartAt: variant.salePriceStartAt,
            salePriceEndAt: variant.salePriceEndAt,
          })
        : priceOf(p);
      const stockRow = variant ?? p;
      if (available(stockRow) < line.qty) {
        const left = Math.max(0, available(stockRow));
        const what = `"${p.name}"${variant ? ` (${variantLabel(variant.attributeValues)})` : ""}`;
        throw new BadRequestError(left === 0 ? `${what} is out of stock` : `Only ${left} left of ${what}`, "INSUFFICIENT_STOCK");
      }
      return {
        product: p,
        variant,
        qty: line.qty,
        unitPrice: priced.price,
        onSale: priced.compareAtPrice !== null,
        lineSubtotal: round2(priced.price * line.qty),
        weightKG: num(variant?.weight ?? p.weight) * line.qty,
      };
    });
  }

  /**
   * Validates a coupon against re-priced lines. Returns the discount, or an error message
   * (never throws for business-rule failures so /coupons/apply can answer `valid:false`).
   */
  private async evaluateCoupon(
    code: string,
    lines: Awaited<ReturnType<StorefrontService["priceLines"]>>,
    email: string | undefined,
  ): Promise<
    | { ok: true; coupon: any; discount: number; freeShipping: boolean; subtotal: number }
    | { ok: false; error: string }
  > {
    const coupon = await prisma.coupon.findFirst({ where: { storeId: this.storeId, code } });
    const subtotal = round2(lines.reduce((s, l) => s + l.lineSubtotal, 0));
    if (!coupon || !coupon.isActive) return { ok: false, error: "This coupon code is not valid" };
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
    const eligible = lines.filter((l) => {
      const pid = String(l.product.id);
      if (exclude.includes(pid)) return false;
      if (coupon.excludeSales && l.onSale) return false;
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
        discount = eligible.reduce((s, l) => s + Math.min(l.unitPrice, amount) * l.qty, 0);
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

  async applyCoupon(dto: ApplyCouponDto) {
    const lines = await this.priceLines(dto.items);
    const result = await this.evaluateCoupon(dto.code, lines, dto.email);
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
      newSubtotal: round2(result.subtotal - result.discount),
    };
  }

  // ------------------------------------------------------------------ checkout

  private async nextOrderNumber(t: Prisma.TransactionClient): Promise<string> {
    const d = new Date();
    const datePart = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
    const count = await t.order.count({ where: { number: { startsWith: datePart } } });
    return `${datePart}${String(count + 1).padStart(6, "0")}`;
  }

  async placeOrder(dto: PlaceOrderDto) {
    const storeId = this.storeId;

    const gateway = await prisma.paymentGatewayConfig.findFirst({ where: { storeId, code: dto.paymentGateway } });
    if (!gateway || !gateway.enabled) {
      throw new BadRequestError(`Payment method "${dto.paymentGateway}" is not available for this store`, "PAYMENT_GATEWAY_ERROR");
    }

    const lines = await this.priceLines(dto.items);
    const itemsSubtotal = round2(lines.reduce((s, l) => s + l.lineSubtotal, 0));
    const qty = lines.reduce((s, l) => s + l.qty, 0);
    const weightKG = lines.reduce((s, l) => s + l.weightKG, 0);
    const ship = dto.shippingAddress;
    const bill: StorefrontAddressDto = dto.billingSameAsShipping || !dto.billingAddress ? ship : dto.billingAddress;

    // Shipping: the chosen method must be one the zone matcher offers for this address.
    const rates: any = await this.shipping.computeShippingOptions(this.ctx, {
      countryCode: ship.country,
      division: ship.division || undefined,
      district: ship.district,
      postcode: ship.postcode || undefined,
      subtotal: itemsSubtotal,
      weightKG,
      qty,
    } as any);
    const option = (rates.options as any[]).find((o) => String(o.id) === String(dto.shippingMethodId));
    if (!option) {
      throw new BadRequestError("The selected delivery option is not available for this address", "SHIPPING_UNAVAILABLE_FOR_ZONE");
    }

    // Coupon
    let coupon: any = null;
    let discountTotal = 0;
    let freeShipping = false;
    const code = dto.couponCodes[0];
    if (code) {
      const r = await this.evaluateCoupon(code, lines, dto.email);
      if (!r.ok) throw new BadRequestError(r.error, "COUPON_INVALID");
      coupon = r.coupon;
      discountTotal = r.discount;
      freeShipping = r.freeShipping;
    }
    const shippingTotal = freeShipping ? 0 : round2(option.finalRateBDT);

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
    const feeTotal = round2(num(gateway.feeFixed) + ((itemsSubtotal - discountTotal) * num(gateway.feePercent)) / 100);
    const grandTotal = round2(itemsSubtotal - discountTotal + shippingTotal + taxTotal + feeTotal);

    const customerId = this.ctx.customer?.id ?? null;
    const orderKey = newId("ok");

    const order = await tx(async (t: Prisma.TransactionClient) => {
      // Decrement stock atomically; the WHERE guard stops overselling under concurrency.
      for (const l of lines) {
        const row = l.variant ?? l.product;
        if (!row.manageStock) continue;
        const where = { id: row.id, ...(row.allowBackorder ? {} : { stockQty: { gte: l.qty + row.reservedStock } }) };
        const updated = l.variant
          ? await t.productVariant.updateMany({ where, data: { stockQty: { decrement: l.qty } } })
          : await t.product.updateMany({ where, data: { stockQty: { decrement: l.qty } } });
        if (updated.count === 0) {
          throw new BadRequestError(`"${l.product.name}" just sold out — please update your cart`, "INSUFFICIENT_STOCK");
        }
        await t.inventoryLog.create({
          data: {
            productId: l.product.id,
            variantId: l.variant?.id ?? null,
            changeQty: -l.qty,
            reason: "ORDER_CREATE",
            referenceId: orderKey,
            qtyBefore: row.stockQty ?? 0,
            qtyAfter: (row.stockQty ?? 0) - l.qty,
          },
        });
      }
      await t.product.updateMany({ where: { id: { in: lines.map((l) => l.product.id) } }, data: { saleCount: { increment: 1 } } });

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

      const discountRatio = discountTotal > 0 && itemsSubtotal > 0 ? discountTotal / itemsSubtotal : 0;
      // Spread the item share of the tax (tax total minus the shipping share) across lines.
      const taxable = itemsSubtotal - discountTotal;
      const itemTaxRatio = taxable > 0 ? (taxTotal * (taxable / (taxable + shippingTotal))) / taxable : 0;

      return t.order.create({
        data: {
          storeId,
          number: await this.nextOrderNumber(t),
          orderKey,
          status: "PENDING",
          currencyCode: "BDT",
          customerId,
          isGuest: customerId === null,
          customerNote: dto.customerNote ?? null,
          ipAddress: null,
          billingFirstName: bill.firstName,
          billingLastName: bill.lastName,
          billingCompany: bill.company ?? null,
          billingAddress1: bill.addressLine1,
          billingAddress2: bill.addressLine2 || null,
          billingCity: bill.district,
          billingState: bill.division || null,
          billingPostcode: bill.postcode || null,
          billingCountryCode: bill.country,
          billingEmail: dto.email,
          billingPhone: bill.phone,
          shippingSameAsBilling: bill === ship,
          shippingFirstName: ship.firstName,
          shippingLastName: ship.lastName,
          shippingCompany: ship.company ?? null,
          shippingAddress1: ship.addressLine1,
          shippingAddress2: ship.addressLine2 || null,
          shippingCity: ship.district,
          shippingState: ship.division || null,
          shippingPostcode: ship.postcode || null,
          shippingCountryCode: ship.country,
          shippingPhone: ship.phone,
          shippingZoneId: option.zoneId ? BigInt(option.zoneId) : null,
          shippingMethodCode: option.code,
          shippingMethodName: option.name,
          itemsSubtotal,
          discountTotal,
          shippingTotal,
          taxTotal,
          feeTotal,
          grandTotal,
          couponUsed: coupon?.code ?? null,
          couponDiscountAmount: discountTotal,
          paymentGatewayCode: dto.paymentGateway,
          paymentStatus: "unpaid",
          items: {
            create: lines.map((l) => {
              const lineDiscount = round2(l.lineSubtotal * discountRatio);
              const lineTax = round2((l.lineSubtotal - lineDiscount) * itemTaxRatio);
              return {
                productId: l.product.id,
                variantId: l.variant?.id ?? null,
                productName: l.product.name,
                productSku: l.variant?.sku ?? l.product.sku,
                variantValues: (l.variant?.attributeValues as Prisma.InputJsonValue) ?? undefined,
                imageUrl: l.variant?.imageUrl ?? l.product.images[0]?.imageUrl ?? null,
                quantity: l.qty,
                unitPrice: l.unitPrice,
                lineSubtotal: l.lineSubtotal,
                lineDiscount,
                lineTax,
                lineTotal: round2(l.lineSubtotal - lineDiscount + lineTax),
              };
            }),
          },
          statusHistory: {
            create: { status: "PENDING", note: `Order placed on storefront (${gateway.name})`, notifyCustomer: true },
          },
        },
      });
    });

    let redirectPaymentURL: string | undefined;
    if (!OFFLINE_GATEWAYS.has(dto.paymentGateway)) {
      try {
        const provider = getPaymentProvider(dto.paymentGateway as PaymentMethod);
        const init = await provider.initiate({
          orderId: order.id,
          orderNumber: order.number,
          amount: grandTotal,
          currencyCode: "BDT",
          customerEmail: dto.email,
          customerName: `${bill.firstName} ${bill.lastName}`,
          customerPhone: bill.phone,
          redirectUrl: "",
          ipnUrl: "",
          metadata: { orderKey },
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
  async paymentMethods() {
    const rows = await prisma.paymentGatewayConfig.findMany({
      where: { storeId: this.storeId, enabled: true },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    });
    return rows.map((g) => ({
      code: g.code,
      name: g.name,
      description: g.description ?? undefined,
      instructions: g.instructions ?? undefined,
      feeFixed: num(g.feeFixed),
      feePercent: num(g.feePercent),
    }));
  }

  /** Guest-safe order lookup for the thank-you page. The orderKey is the secret. */
  async getOrderByKey(orderKey: string) {
    const o = await prisma.order.findFirst({
      where: { storeId: this.storeId, orderKey },
      include: { items: true },
    });
    if (!o) throw new NotFoundError("Order");
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
        division: o.shippingState ?? o.billingState,
        postcode: o.shippingPostcode ?? o.billingPostcode,
        country: o.shippingCountryCode ?? o.billingCountryCode,
      },
      billing: {
        name: `${o.billingFirstName} ${o.billingLastName}`,
        address: [o.billingAddress1, o.billingAddress2].filter(Boolean).join(", "),
        city: o.billingCity,
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
      })),
      itemsSubtotal: num(o.itemsSubtotal),
      discountTotal: num(o.discountTotal),
      couponUsed: o.couponUsed,
      shippingTotal: num(o.shippingTotal),
      taxTotal: num(o.taxTotal),
      feeTotal: num(o.feeTotal),
      grandTotal: num(o.grandTotal),
      currency: o.currencyCode,
    };
  }
}
