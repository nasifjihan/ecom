/**
 * FLASH SALES — loads the store's running sales for the storefront; the pricing rules are in
 * flash-pricing.ts.
 */
import { prisma } from "../../config";
import { bestFlashDeal, flashRules, type FlashDeal, type PricedProduct, type RunningFlashSale } from "./flash-pricing";

export { flashView, type FlashDeal, type PricedProduct } from "./flash-pricing";

export class FlashSales {
  private constructor(private readonly sales: RunningFlashSale[]) {}

  static none = new FlashSales([]);

  /** The store's running sales, with only the items for these products. */
  static async load(storeId: bigint, productIds: bigint[], now = new Date()): Promise<FlashSales> {
    const rows = await prisma.flashSale.findMany({
      where: { storeId, isActive: true, startsAt: { lte: now }, endsAt: { gt: now } },
      include: { items: { where: { productId: { in: productIds } } } },
      orderBy: [{ position: "asc" }, { id: "asc" }],
    });
    if (!rows.length) return FlashSales.none;

    const sales: RunningFlashSale[] = rows.map((r) => ({ ...r, rules: flashRules(r.rules), categories: new Set<string>() }));
    if (sales.some((s) => s.rules.appliesTo === "categories")) {
      const all = await prisma.category.findMany({ where: { storeId }, select: { id: true, parentId: true } });
      for (const s of sales) {
        if (s.rules.appliesTo !== "categories") continue;
        const set = new Set(s.rules.categoryIds);
        let grew = true;
        while (grew) {
          grew = false;
          for (const c of all) {
            if (c.parentId !== null && set.has(String(c.parentId)) && !set.has(String(c.id))) {
              set.add(String(c.id));
              grew = true;
            }
          }
        }
        s.categories = set;
      }
    }
    return new FlashSales(sales);
  }

  /** See bestFlashDeal. */
  best(p: PricedProduct, variantId: bigint | null, regular: number, current: number, ownSale: boolean): FlashDeal | null {
    return this.sales.length ? bestFlashDeal(this.sales, p, variantId, regular, current, ownSale) : null;
  }
}
