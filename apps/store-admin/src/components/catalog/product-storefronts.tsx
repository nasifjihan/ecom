"use client";

/**
 * Where a product is sold and at what price, per storefront. Shown only when the store has more
 * than one storefront. Saved on its own (not with the product form).
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, Loader2, Store } from "lucide-react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Checkbox, Input } from "@/components/ui";
import { errorText } from "@/lib/features/content/content-api-slice";
import {
  useProductStorefrontsQuery,
  useSaveProductStorefrontsMutation,
  type ProductStorefront,
} from "@/lib/features/storefronts/storefronts-api-slice";

interface PriceInputs {
  regular: string;
  sale: string;
}

interface Row extends PriceInputs {
  storefrontId: string;
  listed: boolean;
  /** Own prices per option, by variant id. */
  options: Record<string, PriceInputs>;
}

const text = (n: number | null) => (n === null ? "" : String(n));
const toRow = (s: ProductStorefront): Row => ({
  storefrontId: s.storefrontId,
  listed: s.listed,
  regular: text(s.regularPrice),
  sale: text(s.salePrice),
  options: Object.fromEntries(s.options.map((o) => [o.variantId, { regular: text(o.regularPrice), sale: text(o.salePrice) }])),
});
const tk = (n: number) => `৳${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
/** The product's price with a storefront's change, as the storefront shows it (whole taka). */
const adjusted = (price: number, pct: number) => (pct ? Math.max(0, Math.round(price * (1 + pct / 100))) : price);
const money = (v: string) => (v.trim() === "" ? null : Number(v));

export function ProductStorefronts({ productId, basePrice, hasOptions }: { productId: string; basePrice: number | null; hasOptions: boolean }) {
  const { data } = useProductStorefrontsQuery(productId, { skip: !productId });
  const [save, { isLoading }] = useSaveProductStorefrontsMutation();
  const [rows, setRows] = useState<Row[]>([]);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (data) setRows(data.map(toRow));
  }, [data]);

  if (!data || data.length < 2) return null;

  const set = (id: string, patch: Partial<Row>) => setRows((cur) => cur.map((r) => (r.storefrontId === id ? { ...r, ...patch } : r)));
  const setOption = (id: string, variantId: string, patch: Partial<PriceInputs>) =>
    setRows((cur) =>
      cur.map((r) => {
        if (r.storefrontId !== id) return r;
        const prev = r.options[variantId] ?? { regular: "", sale: "" };
        const next = { ...prev, ...patch };
        if (!next.regular) next.sale = "";
        return { ...r, options: { ...r.options, [variantId]: next } };
      }),
    );
  const priceProblem = (p: PriceInputs): string | null => {
    const reg = money(p.regular);
    const sale = money(p.sale);
    if (reg !== null && (!Number.isFinite(reg) || reg < 0)) return "Check the price";
    if (sale !== null && (reg === null || !Number.isFinite(sale) || sale >= reg)) return "The sale price must be below the price";
    return null;
  };
  const optionProblem = (r: Row) => Object.values(r.options).map(priceProblem).find(Boolean) ?? null;
  const problem = (r: Row): string | null => priceProblem(r) ?? (optionProblem(r) ? `Options: ${optionProblem(r)?.toLowerCase()}` : null);
  const dirty = JSON.stringify(rows) !== JSON.stringify(data.map(toRow));
  const valid = rows.every((r) => !problem(r));

  const onSave = async () => {
    try {
      await save({
        productId,
        storefronts: rows.map((r) => ({
          storefrontId: r.storefrontId,
          listed: r.listed,
          regularPrice: money(r.regular),
          salePrice: money(r.sale),
          options: Object.entries(r.options).map(([variantId, o]) => ({ variantId, regularPrice: money(o.regular), salePrice: money(o.sale) })),
        })),
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
          {hasOptions ? ". An own price here applies to every option, unless an option has its own price below" : ""}.
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
              {r.listed && s.options.length > 0 && (
                <div className="mt-2">
                  <button
                    type="button"
                    className="flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                    aria-expanded={open[s.storefrontId] === true}
                    onClick={() => setOpen((o) => ({ ...o, [s.storefrontId]: !o[s.storefrontId] }))}
                  >
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open[s.storefrontId] ? "rotate-180" : ""}`} />
                    Prices per option
                    {(() => {
                      const count = Object.values(r.options).filter((o) => o.regular).length;
                      return count ? ` (${count} of ${s.options.length} set)` : "";
                    })()}
                  </button>
                  {open[s.storefrontId] && (
                    <div className="mt-2 space-y-1.5">
                      {s.options.map((o) => {
                        const v = r.options[o.variantId] ?? { regular: "", sale: "" };
                        // What the option sells for here without its own price: the product's own price, else its price with the change.
                        const fallback = money(r.regular) ?? (o.basePrice === null ? null : adjusted(o.basePrice, s.priceAdjustPercent));
                        return (
                          <div key={o.variantId} className="grid grid-cols-1 items-center gap-1.5 sm:grid-cols-[minmax(0,1fr)_7rem_7rem]">
                            <div className="min-w-0 text-sm">
                              <span className="block truncate">{o.label}</span>
                              <span className="text-xs text-slate-500">
                                {v.regular ? "Own price" : fallback !== null ? `Shows ${tk(money(r.sale) ?? fallback)}` : ""}
                              </span>
                            </div>
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              placeholder="Price (৳)"
                              aria-label={`Price of ${o.label} on ${s.name}`}
                              value={v.regular}
                              onChange={(e) => setOption(s.storefrontId, o.variantId, { regular: e.target.value })}
                            />
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              placeholder="Sale (৳)"
                              aria-label={`Sale price of ${o.label} on ${s.name}`}
                              value={v.sale}
                              disabled={!v.regular}
                              onChange={(e) => setOption(s.storefrontId, o.variantId, { sale: e.target.value })}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
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
