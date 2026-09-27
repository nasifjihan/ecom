import { describe, it, expect } from "vitest";
import { bestFlashDeal, flashRules, type RunningFlashSale } from "../../src/modules/storefront/flash-pricing";

const sale = (over: Partial<RunningFlashSale> = {}): RunningFlashSale => ({
  id: 1n,
  name: "Eid Sale",
  slug: "eid-sale",
  endsAt: new Date("2026-10-01"),
  discountPercent: 20,
  discountFixed: null,
  rules: flashRules(null),
  categories: new Set(),
  items: [],
  ...over,
});
const item = (over: Partial<RunningFlashSale["items"][number]> = {}) => ({
  id: 10n,
  productId: 5n,
  variantId: null,
  salePrice: null,
  discountPct: null,
  stockLimit: null,
  soldCount: 0,
  ...over,
});
const product = { id: 5n, categories: [{ categoryId: 7n }] };

describe("flash-sale pricing", () => {
  it("takes the sale's % off the regular price for listed products only", () => {
    const s = sale({ items: [item()] });
    expect(bestFlashDeal([s], product, null, 1000, 1000, false)?.price).toBe(800);
    expect(bestFlashDeal([s], { id: 6n }, null, 1000, 1000, false)).toBeNull();
  });

  it("uses a product's own sale price and counts down its stock limit", () => {
    const s = sale({ items: [item({ salePrice: 650, stockLimit: 3, soldCount: 1 })] });
    expect(bestFlashDeal([s], product, null, 1000, 1000, false)).toMatchObject({ price: 650, remaining: 2, itemId: 10n });
    const soldOut = sale({ items: [item({ salePrice: 650, stockLimit: 3, soldCount: 3 })] });
    expect(bestFlashDeal([soldOut], product, null, 1000, 1000, false)).toBeNull();
  });

  it("covers categories and whole stores", () => {
    const cats = sale({ rules: flashRules({ appliesTo: "categories", categoryIds: ["7"] }), categories: new Set(["7"]) });
    expect(bestFlashDeal([cats], product, null, 1000, 1000, false)?.price).toBe(800);
    expect(bestFlashDeal([cats], { id: 5n, categories: [{ categoryId: 8n }] }, null, 1000, 1000, false)).toBeNull();
    const all = sale({ rules: flashRules({ appliesTo: "all" }), discountPercent: null, discountFixed: 150 });
    expect(bestFlashDeal([all], { id: 99n }, null, 1000, 1000, false)?.price).toBe(850);
  });

  it("never raises a price, skips products on their own sale when asked, and picks the lowest", () => {
    const s = sale({ items: [item()] });
    expect(bestFlashDeal([s], product, null, 1000, 700, true)).toBeNull();
    const skip = sale({ items: [item()], rules: { ...flashRules(null), excludeOnSale: true } });
    expect(bestFlashDeal([skip], product, null, 1000, 900, true)).toBeNull();
    const deeper = sale({ id: 2n, name: "Mega", items: [item({ id: 11n, discountPct: 30 })] });
    expect(bestFlashDeal([s, deeper], product, null, 1000, 1000, false)).toMatchObject({ price: 700, name: "Mega" });
  });

  it("matches variant items before product-wide items", () => {
    const s = sale({ items: [item(), item({ id: 12n, variantId: 3n, salePrice: 500 })] });
    expect(bestFlashDeal([s], product, 3n, 1000, 1000, false)?.price).toBe(500);
    expect(bestFlashDeal([s], product, 4n, 1000, 1000, false)?.price).toBe(800);
  });
});
