"use client";

/**
 * A product's options and variants: the variant generator (pick option values → every
 * combination, with SKUs, price, cost and stock) and a table to edit each variant.
 * Variants are saved with the product (the API keeps existing ones by id).
 */
import { useMemo, useState } from "react";
import { Plus, Trash2, Wand2, X } from "lucide-react";
import { generateVariants, optionKey, optionsOf, type VariantOption } from "@ecom/utils";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label, cn } from "@/components/ui";
import type { ProductVariant } from "@/lib/features/catalog/catalog-api-slice";

/** A variant in the form, with a key that survives edits (never sent: the API ignores it). */
export type EditableVariant = ProductVariant & { _key?: string };

let seq = 0;
const newKey = () => `v${Date.now().toString(36)}${(seq++).toString(36)}`;
export const keyOf = (v: EditableVariant) => v._key ?? (v.id !== undefined ? `id${v.id}` : "");
/** Gives every variant a stable key (call when loading a product). */
export const withKeys = (vs: ProductVariant[]): EditableVariant[] => vs.map((v) => ({ ...v, _key: v.id !== undefined ? `id${v.id}` : newKey() }));

const num = (s: string) => (s.trim() === "" ? null : Number(s));
const title = (k: string) => k.charAt(0).toUpperCase() + k.slice(1);

interface Draft {
  id: string;
  name: string;
  values: string;
}

export function VariantsEditor({
  variants,
  onChange,
  skuPrefix,
  defaultPrice,
  defaultCost,
}: {
  variants: EditableVariant[];
  onChange: (next: EditableVariant[]) => void;
  /** Usually the product's SKU. */
  skuPrefix?: string;
  defaultPrice?: number | null;
  defaultCost?: number | null;
}) {
  const [genOpen, setGenOpen] = useState(variants.length === 0);
  const [drafts, setDrafts] = useState<Draft[]>(() => {
    const had = optionsOf(variants);
    return had.length
      ? had.map((o) => ({ id: newKey(), name: o.name, values: o.values.join(", ") }))
      : [
          { id: newKey(), name: "Size", values: "" },
          { id: newKey(), name: "Colour", values: "" },
        ];
  });
  const [prefix, setPrefix] = useState(skuPrefix ?? "");
  const [price, setPrice] = useState(defaultPrice != null ? String(defaultPrice) : "");
  const [sale, setSale] = useState("");
  const [cost, setCost] = useState(defaultCost != null ? String(defaultCost) : "");
  const [stock, setStock] = useState("0");
  const [all, setAll] = useState({ price: "", sale: "", cost: "", stock: "" });

  const options: VariantOption[] = drafts.map((d) => ({ name: d.name, values: d.values.split(",") }));
  const plan = useMemo(
    () => generateVariants(options, prefix.trim() === "" ? (skuPrefix ?? "") : prefix, variants),
    [JSON.stringify(options), prefix, skuPrefix, variants],
  );

  /** The option columns of the table: every key any variant uses, in first-seen order. */
  const keys = useMemo(() => {
    const out: string[] = [];
    for (const v of variants) for (const k of Object.keys(v.attributeValues ?? {})) if (!out.includes(optionKey(k))) out.push(optionKey(k));
    return out;
  }, [variants]);

  const setDraft = (id: string, patch: Partial<Draft>) => setDrafts((ds) => ds.map((d) => (d.id === id ? { ...d, ...patch } : d)));

  const generate = () => {
    if (plan.tooMany || !plan.toAdd.length) return;
    onChange([
      ...variants,
      ...plan.toAdd.map((g) => ({
        _key: newKey(),
        attributeValues: g.attributeValues,
        sku: g.sku || null,
        regularPrice: num(price),
        salePrice: num(sale),
        costPrice: num(cost),
        stockQty: num(stock) ?? 0,
        manageStock: true,
        status: "active",
      })),
    ]);
    setGenOpen(false);
  };

  const edit = (key: string, patch: Partial<EditableVariant>) => onChange(variants.map((v) => (keyOf(v) === key ? { ...v, ...patch } : v)));
  const setOption = (key: string, option: string, value: string) =>
    onChange(
      variants.map((v) => {
        if (keyOf(v) !== key) return v;
        // Keep the option under the key it's stored with (older variants may use "Size").
        const values = { ...(v.attributeValues ?? {}) };
        const stored = Object.keys(values).find((k) => optionKey(k) === option) ?? option;
        values[stored] = value;
        return { ...v, attributeValues: values };
      }),
    );
  const applyAll = () =>
    onChange(
      variants.map((v) => ({
        ...v,
        ...(all.price.trim() ? { regularPrice: num(all.price) } : {}),
        ...(all.sale.trim() ? { salePrice: num(all.sale) } : {}),
        ...(all.cost.trim() ? { costPrice: num(all.cost) } : {}),
        ...(all.stock.trim() ? { stockQty: num(all.stock) ?? 0 } : {}),
      })),
    );
  const saleTooHigh = (v: EditableVariant) => v.salePrice != null && v.regularPrice != null && v.salePrice > v.regularPrice;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle>Options and variants</CardTitle>
          <CardDescription>Sizes, colours and other choices. Each combination is a variant with its own SKU, price and stock.</CardDescription>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant={genOpen ? "secondary" : "default"} size="sm" onClick={() => setGenOpen((o) => !o)}>
            <Wand2 className="mr-2 h-4 w-4" /> Generate variants
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              onChange([
                ...variants,
                { _key: newKey(), attributeValues: Object.fromEntries(keys.map((k) => [k, ""])), sku: null, regularPrice: num(price), stockQty: 0, manageStock: true, status: "active" },
              ])
            }
          >
            <Plus className="mr-2 h-4 w-4" /> Add one
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {genOpen && (
          <section className="space-y-4 rounded-lg border bg-muted/30 p-4" aria-label="Variant generator">
            <div className="space-y-2">
              <p className="text-sm font-medium">Options</p>
              {drafts.map((d, i) => (
                <div key={d.id} className="grid gap-2 sm:grid-cols-[160px_1fr_auto]">
                  <Input aria-label={`Option ${i + 1} name`} placeholder="e.g. Size" value={d.name} onChange={(e) => setDraft(d.id, { name: e.target.value })} />
                  <Input
                    aria-label={`Option ${i + 1} values`}
                    placeholder="Values, separated by commas: S, M, L, XL"
                    value={d.values}
                    onChange={(e) => setDraft(d.id, { values: e.target.value })}
                  />
                  <Button type="button" variant="ghost" size="icon" aria-label={`Remove option ${i + 1}`} onClick={() => setDrafts((ds) => ds.filter((x) => x.id !== d.id))}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {drafts.length < 3 && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setDrafts((ds) => [...ds, { id: newKey(), name: "", values: "" }])}>
                  <Plus className="mr-1 h-4 w-4" /> Add an option
                </Button>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-5">
              <div className="space-y-1">
                <Label htmlFor="gen-prefix" className="text-xs">SKU prefix</Label>
                <Input id="gen-prefix" value={prefix} placeholder={skuPrefix ?? "e.g. TS-01"} onChange={(e) => setPrefix(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="gen-price" className="text-xs">Price ৳</Label>
                <Input id="gen-price" type="number" min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="gen-sale" className="text-xs">Sale price ৳</Label>
                <Input id="gen-sale" type="number" min={0} step="0.01" value={sale} onChange={(e) => setSale(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="gen-cost" className="text-xs">Cost ৳</Label>
                <Input id="gen-cost" type="number" min={0} step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="gen-stock" className="text-xs">Stock each</Label>
                <Input id="gen-stock" type="number" min={0} step="1" value={stock} onChange={(e) => setStock(e.target.value)} />
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className={cn("text-sm", plan.tooMany ? "text-destructive" : "text-muted-foreground")} aria-live="polite">
                {plan.tooMany
                  ? `These options make ${plan.total} variants; the most is 100. Split the product or use fewer values.`
                  : plan.total === 0
                    ? "Give at least one option a name and values."
                    : `${plan.total} combinations: ${plan.toAdd.length} new${plan.alreadyThere ? `, ${plan.alreadyThere} already here (kept as they are)` : ""}.`}
              </p>
              <Button type="button" onClick={generate} disabled={plan.tooMany || plan.toAdd.length === 0}>
                <Wand2 className="mr-2 h-4 w-4" /> Add {plan.toAdd.length} variant{plan.toAdd.length === 1 ? "" : "s"}
              </Button>
            </div>
            {plan.toAdd.length > 0 && !plan.tooMany && (
              <div className="flex flex-wrap gap-1.5">
                {plan.toAdd.slice(0, 24).map((g) => (
                  <Badge key={g.sku || JSON.stringify(g.attributeValues)} variant="secondary" className="font-normal">
                    {Object.values(g.attributeValues).join(" / ")}
                    {g.sku && <span className="ml-1.5 font-mono text-[10px] opacity-70">{g.sku}</span>}
                  </Badge>
                ))}
                {plan.toAdd.length > 24 && <span className="text-xs text-muted-foreground">+{plan.toAdd.length - 24} more</span>}
              </div>
            )}
          </section>
        )}

        {variants.length === 0 ? (
          <p className="rounded-lg border-2 border-dashed py-10 text-center text-sm text-muted-foreground">No variants yet. Generate them from options, or add one.</p>
        ) : (
          <div className="space-y-2">
            <div className="flex flex-wrap items-end gap-2 rounded-md border bg-muted/20 p-2 text-sm">
              <span className="self-center pr-1 text-xs font-medium text-muted-foreground">Set for all {variants.length}:</span>
              {(
                [
                  ["price", "Price"],
                  ["sale", "Sale"],
                  ["cost", "Cost"],
                  ["stock", "Stock"],
                ] as const
              ).map(([k, label]) => (
                <Input
                  key={k}
                  aria-label={`${label} for all variants`}
                  placeholder={label}
                  type="number"
                  min={0}
                  className="h-8 w-20"
                  value={all[k]}
                  onChange={(e) => setAll((a) => ({ ...a, [k]: e.target.value }))}
                />
              ))}
              <Button type="button" size="sm" variant="outline" className="h-8" onClick={applyAll} disabled={!Object.values(all).some((x) => x.trim())}>
                Apply
              </Button>
            </div>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    {keys.map((k) => (
                      <th key={k} className="px-1 py-2 text-left font-medium">
                        {title(k)}
                      </th>
                    ))}
                    <th className="px-1 py-2 text-left font-medium">SKU</th>
                    <th className="px-1 py-2 text-left font-medium">Price ৳</th>
                    <th className="px-1 py-2 text-left font-medium">Sale ৳</th>
                    <th className="px-1 py-2 text-left font-medium">Cost ৳</th>
                    <th className="px-1 py-2 text-left font-medium">Stock</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {variants.map((v, i) => {
                    const key = keyOf(v) || `row${i}`;
                    const values = v.attributeValues ?? {};
                    const valueOf = (k: string) => {
                      const found = Object.entries(values).find(([x]) => optionKey(x) === k)?.[1];
                      return typeof found === "string" || typeof found === "number" ? String(found) : "";
                    };
                    return (
                      <tr key={key} className="border-t">
                        {keys.map((k) => (
                          <td key={k} className="px-1 py-1.5">
                            <Input aria-label={`${title(k)} of variant ${i + 1}`} className="h-8 w-20" value={valueOf(k)} onChange={(e) => setOption(key, k, e.target.value)} />
                          </td>
                        ))}
                        <td className="px-1 py-1.5">
                          <Input aria-label={`SKU of variant ${i + 1}`} className="h-8 w-32 font-mono text-xs" value={v.sku ?? ""} onChange={(e) => edit(key, { sku: e.target.value || null })} />
                        </td>
                        <td className="px-1 py-1.5">
                          <Input aria-label={`Price of variant ${i + 1}`} type="number" min={0} step="0.01" className="h-8 w-20" value={v.regularPrice ?? ""} onChange={(e) => edit(key, { regularPrice: num(e.target.value) })} />
                        </td>
                        <td className="px-1 py-1.5">
                          <Input
                            aria-label={`Sale price of variant ${i + 1}`}
                            aria-invalid={saleTooHigh(v)}
                            title={saleTooHigh(v) ? "Higher than the price" : undefined}
                            type="number"
                            min={0}
                            step="0.01"
                            className={cn("h-8 w-20", saleTooHigh(v) && "border-destructive")}
                            value={v.salePrice ?? ""}
                            onChange={(e) => edit(key, { salePrice: num(e.target.value) })}
                          />
                        </td>
                        <td className="px-1 py-1.5">
                          <Input aria-label={`Cost of variant ${i + 1}`} type="number" min={0} step="0.01" className="h-8 w-20" value={v.costPrice ?? ""} onChange={(e) => edit(key, { costPrice: num(e.target.value) })} />
                        </td>
                        <td className="px-1 py-1.5">
                          <Input aria-label={`Stock of variant ${i + 1}`} type="number" min={0} step="1" className="h-8 w-16" value={v.stockQty ?? 0} onChange={(e) => edit(key, { stockQty: num(e.target.value) ?? 0 })} />
                        </td>
                        <td className="px-1 py-1.5">
                          <Button type="button" variant="ghost" size="icon" aria-label={`Remove variant ${i + 1}`} onClick={() => onChange(variants.filter((x) => keyOf(x) !== key))}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">Changes are saved with the product. A removed variant is deleted when you save; past orders keep their lines.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
