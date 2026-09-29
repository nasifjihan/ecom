"use client";

/**
 * Bulk prices on a product: "buy N or more, each costs ৳X", for approved business accounts or for
 * every shopper, on the whole product or one option. Saved on its own (not with the product form).
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Layers, Loader2, Plus, Trash2 } from "lucide-react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Select, SelectItem } from "@/components/ui";
import { errorText } from "@/lib/features/content/content-api-slice";
import { useCan } from "@/lib/permissions";
import { useProductTiersQuery, useSaveProductTiersMutation, type PriceTier } from "@/lib/features/wholesale/wholesale-api-slice";

interface Row {
  key: number;
  variantId: string;
  minQty: string;
  price: string;
  audience: "business" | "everyone";
}

const ALL = "all";
const tk = (n: number) => `৳${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
let seq = 0;
const toRow = (t: PriceTier): Row => ({
  key: ++seq,
  variantId: t.variantId ?? ALL,
  minQty: String(t.minQty),
  price: String(t.price),
  audience: t.forEveryone ? "everyone" : "business",
});
const same = (a: Row[], b: Row[]) => JSON.stringify(a.map(({ key: _k, ...r }) => r)) === JSON.stringify(b.map(({ key: _k, ...r }) => r));

export function ProductBulkPrices({ productId }: { productId: string }) {
  const { data } = useProductTiersQuery(productId, { skip: !productId });
  const [save, { isLoading }] = useSaveProductTiersMutation();
  const { can } = useCan();
  const canEdit = can("products.edit");
  const [rows, setRows] = useState<Row[]>([]);
  const [saved, setSaved] = useState<Row[]>([]);

  useEffect(() => {
    if (!data) return;
    const r = data.tiers.map(toRow);
    setRows(r);
    setSaved(r);
  }, [data]);

  if (!data) return null;
  const hasOptions = data.variants.length > 0;
  const set = (key: number, patch: Partial<Row>) => setRows((cur) => cur.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const optionOf = (id: string) => data.variants.find((v) => v.id === id);
  const listPrice = (r: Row) => (r.variantId === ALL ? data.price : optionOf(r.variantId)?.price ?? data.price);
  const costOf = (r: Row) => (r.variantId === ALL ? data.cost : optionOf(r.variantId)?.cost ?? data.cost);
  const problem = (r: Row): string | null => {
    const q = Number(r.minQty);
    const p = Number(r.price);
    if (!Number.isInteger(q) || q < 2) return "The minimum is 2 or more";
    if (!(p > 0)) return "Enter a price";
    const list = listPrice(r);
    if (list !== null && p >= list) return `Not below the normal price (${tk(list)})`;
    return null;
  };
  const note = (r: Row): string | null => {
    const cost = costOf(r);
    const p = Number(r.price);
    if (cost === null || !(p > 0)) return null;
    const m = Math.round(((p - cost) / p) * 1000) / 10;
    return `${m}% margin${p < cost ? " — below cost" : ""}`;
  };
  const valid = rows.every((r) => !problem(r));

  const onSave = async () => {
    try {
      await save({
        productId,
        tiers: rows.map((r) => ({
          variantId: r.variantId === ALL ? null : r.variantId,
          minQty: Number(r.minQty),
          price: Number(r.price),
          forEveryone: r.audience === "everyone",
        })),
      }).unwrap();
      toast.success("Bulk prices saved");
    } catch (e) {
      toast.error(errorText(e));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Layers className="h-4 w-4" /> Bulk prices
        </CardTitle>
        <CardDescription>
          A lower price per piece when someone buys more. “Businesses” prices go to approved business accounts only; “Everyone”
          prices to any shopper.
          {hasOptions ? " Prices for all options count every option together (5 M + 5 L reach 10+); an option with its own prices counts on its own." : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.length === 0 && <p className="text-sm text-slate-500">No bulk prices.</p>}
        {rows.map((r) => {
          const err = problem(r);
          const info = note(r);
          return (
            <div key={r.key} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1.4fr)_6rem_8rem_minmax(0,1fr)_auto] sm:items-center">
                {hasOptions ? (
                  <Select aria-label="Which option" value={r.variantId} onValueChange={(v) => canEdit && set(r.key, { variantId: v })}>
                    <SelectItem value={ALL}>All options</SelectItem>
                    {data.variants.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.label}
                      </SelectItem>
                    ))}
                  </Select>
                ) : (
                  <span className="text-sm text-slate-500">This product</span>
                )}
                <Input
                  type="number"
                  min={2}
                  step={1}
                  aria-label="Minimum quantity"
                  placeholder="Min qty"
                  value={r.minQty}
                  disabled={!canEdit}
                  onChange={(e) => set(r.key, { minQty: e.target.value })}
                />
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  aria-label="Price each (৳)"
                  placeholder="৳ each"
                  value={r.price}
                  disabled={!canEdit}
                  onChange={(e) => set(r.key, { price: e.target.value })}
                />
                <Select aria-label="Who gets this price" value={r.audience} onValueChange={(v) => canEdit && set(r.key, { audience: v as Row["audience"] })}>
                  <SelectItem value="business">Businesses</SelectItem>
                  <SelectItem value="everyone">Everyone</SelectItem>
                </Select>
                {canEdit && (
                  <Button type="button" variant="ghost" size="icon" aria-label="Remove this price" onClick={() => setRows((cur) => cur.filter((x) => x.key !== r.key))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {(err ?? info) && <p className={`mt-1 text-xs ${err ? "text-red-600" : "text-slate-500"}`}>{err ?? info}</p>}
            </div>
          );
        })}
        {canEdit && (
          <div className="flex flex-wrap justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRows((cur) => [...cur, { key: ++seq, variantId: ALL, minQty: "", price: "", audience: "business" }])}
            >
              <Plus className="mr-1.5 h-4 w-4" /> Add a bulk price
            </Button>
            <Button type="button" onClick={onSave} disabled={same(rows, saved) || !valid || isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save bulk prices
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
