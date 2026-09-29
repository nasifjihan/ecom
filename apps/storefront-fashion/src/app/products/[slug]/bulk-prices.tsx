"use client";

/**
 * Bulk prices on the product page: "10+ ৳850 each", the row the chosen quantity reaches
 * highlighted, and a note for shoppers who could get business prices by applying.
 */
import Link from "next/link";
import { Briefcase, Layers } from "lucide-react";
import { cn, formatMoney, useT } from "@ecom/storefront-base";
import type { BulkTier, ProductBulkPrices } from "@/lib/wholesale";

/** The price each for `qty`: the tier it reaches, when cheaper than the normal price. */
export function bulkUnitPrice(listPrice: number, tiers: BulkTier[], qty: number): number {
  let best: BulkTier | null = null;
  for (const t of tiers) if (t.minQty <= qty && (!best || t.minQty > best.minQty || (t.minQty === best.minQty && t.price < best.price))) best = t;
  return best && best.price < listPrice ? best.price : listPrice;
}

export function BulkPrices({
  data,
  tiers,
  listPrice,
  qty,
  onPick,
}: {
  data: ProductBulkPrices;
  tiers: BulkTier[];
  listPrice: number;
  qty: number;
  onPick: (qty: number) => void;
}) {
  const t = useT();
  const shown = tiers.filter((x) => x.price < listPrice);
  const current = bulkUnitPrice(listPrice, shown, qty);
  const reached = shown.filter((x) => x.minQty <= qty && x.price === current).at(-1);
  const teaser = !data.business && data.hasBusinessPrices;
  if (!shown.length && !teaser) return null;

  return (
    <div className="mb-5 rounded-2xl border p-4">
      {shown.length > 0 && (
        <>
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <Layers className="h-4 w-4 text-primary" /> {data.business ? t("Your business prices") : t("Buy more, pay less")}
          </p>
          <div className="flex flex-wrap gap-2">
            {shown.map((x) => (
              <button
                key={`${x.minQty}-${x.business}`}
                type="button"
                onClick={() => onPick(x.minQty)}
                aria-pressed={reached === x}
                className={cn(
                  "rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                  reached === x ? "border-primary bg-primary/10" : "hover:bg-accent",
                )}
              >
                <span className="block font-semibold">{t("{n}+ pieces", { n: x.minQty })}</span>
                <span className="block">
                  {t("{price} each", { price: formatMoney(x.price) })}
                  {x.business && <span className="ml-1 text-xs text-muted-foreground">· {t("Business price")}</span>}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
      {teaser && (
        <p className={cn("flex items-start gap-2 text-sm text-muted-foreground", shown.length > 0 && "mt-3")}>
          <Briefcase className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {t("Buying for a shop or business? Lower prices for business accounts.")}{" "}
            <Link href="/account/business" className="font-medium text-primary underline-offset-2 hover:underline">
              {t("Apply for a business account")}
            </Link>
          </span>
        </p>
      )}
    </div>
  );
}
