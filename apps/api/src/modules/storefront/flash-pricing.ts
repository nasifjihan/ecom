/**
 * FLASH-SALE PRICING RULES — pure functions, no database (see flash-sales.ts for loading).
 *
 * A running sale (active, inside its start/end window) lowers the price of the products it covers:
 *   - rules.appliesTo "products" (the default): the products listed as its items. An item can set its
 *     own sale price or % off and a stock limit (units sold at the sale price, tracked in soldCount).
 *   - "categories": every product in rules.categoryIds, subcategories included.
 *   - "all": every product in the store.
 * The sale-wide % or fixed amount off is taken from the regular price. When several sales cover a
 * product, the lowest price wins, and a sale never raises a price (a lower own sale price stays).
 */
import type { Prisma } from "@prisma/client";

export type FlashScope = "products" | "categories" | "all";

export interface FlashRules {
  appliesTo: FlashScope;
  categoryIds: string[];
  /** Skip products that already have their own sale price running. */
  excludeOnSale: boolean;
}

/** Reads FlashSale.rules, treating missing or unknown values as a product-list sale. */
export function flashRules(v: Prisma.JsonValue | null | undefined): FlashRules {
  const r = v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  const appliesTo: FlashScope = r.appliesTo === "all" || r.appliesTo === "categories" ? r.appliesTo : "products";
  const categoryIds = Array.isArray(r.categoryIds) ? r.categoryIds.map(String).filter((s) => /^\d+$/.test(s)) : [];
  return { appliesTo, categoryIds, excludeOnSale: r.excludeOnSale === true };
}

/** The flash-sale price a shopper gets for one product or variant. */
export interface FlashDeal {
  saleId: bigint;
  itemId: bigint | null;
  name: string;
  slug: string;
  endsAt: Date;
  price: number;
  /** Units left at this price, or null when the sale has no stock limit for it. */
  remaining: number | null;
}

/** What the storefront shows about a flash deal. */
export function flashView(d: FlashDeal | null) {
  return d ? { name: d.name, slug: d.slug, endsAt: d.endsAt.toISOString(), remaining: d.remaining } : null;
}

type Money = Prisma.Decimal | number | null | undefined;

/** A running sale with its items and, for a category sale, the category ids it covers (subcategories expanded). */
export interface RunningFlashSale {
  id: bigint;
  name: string;
  slug: string;
  endsAt: Date;
  discountPercent: Money;
  discountFixed: Money;
  rules: FlashRules;
  categories: Set<string>;
  items: {
    id: bigint;
    productId: bigint;
    variantId: bigint | null;
    salePrice: Money;
    discountPct: Money;
    stockLimit: number | null;
    soldCount: number;
  }[];
}

export interface PricedProduct {
  id: bigint;
  categories?: { categoryId: bigint }[];
}

const round2 = (n: number): number => Math.round(n * 100) / 100;
const num = (v: Money) => (v === null || v === undefined ? null : Number(v));

/**
 * The best running deal for a product (or one of its variants), or null.
 * `regular` is the regular price, `current` what the shopper would pay without flash sales,
 * and `ownSale` whether that current price is the product's own sale price.
 */
export function bestFlashDeal(
  sales: RunningFlashSale[],
  p: PricedProduct,
  variantId: bigint | null,
  regular: number,
  current: number,
  ownSale: boolean,
): FlashDeal | null {
  let best: FlashDeal | null = null;
  for (const s of sales) {
    if (s.rules.excludeOnSale && ownSale) continue;
    const item =
      s.items.find((i) => i.productId === p.id && variantId !== null && i.variantId === variantId) ??
      s.items.find((i) => i.productId === p.id && i.variantId === null);
    const covered =
      item !== undefined ||
      s.rules.appliesTo === "all" ||
      (s.rules.appliesTo === "categories" && (p.categories ?? []).some((c) => s.categories.has(String(c.categoryId))));
    if (!covered) continue;

    const remaining = item && item.stockLimit !== null ? Math.max(0, item.stockLimit - item.soldCount) : null;
    if (remaining === 0) continue;

    const pct = num(item?.discountPct) ?? num(s.discountPercent);
    const fixed = num(s.discountFixed);
    const fromDiscount = pct !== null ? regular * (1 - pct / 100) : fixed !== null ? regular - fixed : null;
    const price = num(item?.salePrice) ?? fromDiscount;
    if (price === null) continue;
    const rounded = round2(Math.max(0, price));
    if (rounded >= current || (best && rounded >= best.price)) continue;
    best = { saleId: s.id, itemId: item?.id ?? null, name: s.name, slug: s.slug, endsAt: s.endsAt, price: rounded, remaining };
  }
  return best;
}
