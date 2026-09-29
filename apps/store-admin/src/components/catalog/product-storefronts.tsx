"use client";

/**
 * Where a product is sold and at what price, per storefront. Shown only when the store has more
 * than one storefront. Saved on its own (not with the product form).
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Store } from "lucide-react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Checkbox, Input } from "@/components/ui";
import { errorText } from "@/lib/features/content/content-api-slice";
import {
  useProductStorefrontsQuery,
  useSaveProductStorefrontsMutation,
  type ProductStorefront,
} from "@/lib/features/storefronts/storefronts-api-slice";

interface Row {
  storefrontId: string;
  listed: boolean;
  regular: string;
  sale: string;
}

const toRow = (s: ProductStorefront): Row => ({
  storefrontId: s.storefrontId,
  listed: s.listed,
  regular: s.regularPrice === null ? "" : String(s.regularPrice),
  sale: s.salePrice === null ? "" : String(s.salePrice),
});
const tk = (n: number) => `৳${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
/** The product's price with a storefront's change, as the storefront shows it (whole taka). */
const adjusted = (price: number, pct: number) => (pct ? Math.max(0, Math.round(price * (1 + pct / 100))) : price);
const money = (v: string) => (v.trim() === "" ? null : Number(v));

export function ProductStorefronts({ productId, basePrice, hasOptions }: { productId: string; basePrice: number | null; hasOptions: boolean }) {
  const { data } = useProductStorefrontsQuery(productId, { skip: !productId });
  const [save, { isLoading }] = useSaveProductStorefrontsMutation();
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    if (data) setRows(data.map(toRow));
  }, [data]);

  if (!data || data.length < 2) return null;

  const set = (id: string, patch: Partial<Row>) => setRows((cur) => cur.map((r) => (r.storefrontId === id ? { ...r, ...patch } : r)));
  const problem = (r: Row): string | null => {
    const reg = money(r.regular);
    const sale = money(r.sale);
    if (reg !== null && (!Number.isFinite(reg) || reg < 0)) return "Check the price";
    if (sale !== null && (reg === null || !Number.isFinite(sale) || sale >= reg)) return "The sale price must be below the price";
    return null;
  };
  const dirty = JSON.stringify(rows) !== JSON.stringify(data.map(toRow));
  const valid = rows.every((r) => !problem(r));

  const onSave = async () => {
    try {
      await save({
        productId,
        storefronts: rows.map((r) => ({ storefrontId: r.storefrontId, listed: r.listed, regularPrice: money(r.regular), salePrice: money(r.sale) })),
      }).unwrap();
      toast.success("Storefronts saved");
    } catch (e) {
      toast.error(errorText(e));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Store className="h-4 w-4" /> Storefronts
        </CardTitle>
        <CardDescription>
          Where this product is sold, and its price in each storefront. Leave the price empty to use the product&apos;s price
          {hasOptions ? " (an own price here applies to every option)" : ""}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.map((s) => {
          const r = rows.find((x) => x.storefrontId === s.storefrontId);
          if (!r) return null;
          const err = problem(r);
          return (
            <div key={s.storefrontId} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <Checkbox
                    checked={r.listed}
                    onCheckedChange={(v) => set(s.storefrontId, { listed: v === true })}
                    aria-label={`Sold on ${s.name}`}
                  />
                  Sold on {s.name}
                  {s.isDefault && <span className="text-xs font-normal text-slate-500">(default)</span>}
                  {!s.isActive && <span className="text-xs font-normal text-slate-500">(closed)</span>}
                </label>
                <span className="text-xs text-slate-500">
                  {basePrice !== null && !r.regular
                    ? `Shows ${tk(adjusted(basePrice, s.priceAdjustPercent))}${s.priceAdjustPercent ? ` (${s.priceAdjustPercent > 0 ? "+" : ""}${s.priceAdjustPercent}%)` : ""}`
                    : r.regular
                      ? "Own price"
                      : ""}
                </span>
              </div>
              {r.listed && (
                <div className="mt-2 grid grid-cols-2 gap-2 sm:max-w-sm">
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="Own price (৳)"
                    aria-label={`Price on ${s.name}`}
                    value={r.regular}
                    onChange={(e) => set(s.storefrontId, { regular: e.target.value, ...(e.target.value ? {} : { sale: "" }) })}
                  />
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="Sale price (৳)"
                    aria-label={`Sale price on ${s.name}`}
                    value={r.sale}
                    disabled={!r.regular}
                    onChange={(e) => set(s.storefrontId, { sale: e.target.value })}
                  />
                </div>
              )}
              {err && <p className="mt-1 text-xs text-red-600">{err}</p>}
            </div>
          );
        })}
        <div className="flex justify-end">
          <Button type="button" onClick={onSave} disabled={!dirty || !valid || isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save storefronts
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
