"use client";

/**
 * Price by margin: every product (or option) with its cost, price and margin. Pick rows, set the
 * margin you want and how to round, check the new prices, then save them together.
 * Margin = profit as a share of the price: (price − cost) ÷ price. Prices are rounded up, so
 * rounding never lowers the margin.
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Calculator, Search } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  Checkbox,
  Input,
  Select,
  SelectItem,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  cn,
} from "@/components/ui";
import { EmptyState, Field, PageTitle } from "@/components/content/shared";
import { errorText } from "@/lib/features/content/content-api-slice";
import { useGetCategoriesQuery } from "@/lib/features/catalog/catalog-api-slice";
import { useCan } from "@/lib/permissions";
import { useApplyPricesMutation, useMarginsQuery, type MarginRow } from "@/lib/features/wholesale/wholesale-api-slice";

type Rounding = "none" | "1" | "5" | "10" | "end9";
const ROUNDING_LABELS: Record<Rounding, string> = {
  none: "No rounding (paisa)",
  "1": "Whole taka",
  "5": "Up to the next ৳5",
  "10": "Up to the next ৳10",
  end9: "Ending in 9 (e.g. ৳1,249)",
};

/** Same rounding as the API's wholesale.rules roundUp. */
function roundUp(price: number, r: Rounding): number {
  const c = Math.round(price * 100) / 100;
  if (r === "none") return c;
  if (r === "1") return Math.ceil(c - 1e-9);
  if (r === "5") return Math.ceil(c / 5 - 1e-9) * 5;
  if (r === "10") return Math.ceil(c / 10 - 1e-9) * 10;
  return Math.ceil((Math.ceil(c - 1e-9) + 1) / 10 - 1e-9) * 10 - 1;
}
const marginOf = (cost: number | null, price: number | null) =>
  cost === null || price === null || price <= 0 ? null : Math.round(((price - cost) / price) * 1000) / 10;
const tk = (n: number | null) => (n === null ? "—" : `৳${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`);
const keyOf = (r: MarginRow) => `${r.productId}:${r.variantId ?? ""}`;

function MarginCell({ value }: { value: number | null }) {
  if (value === null) return <span className="text-slate-400">—</span>;
  return (
    <span className={cn("tabular-nums font-medium", value < 0 ? "text-red-600" : value < 15 ? "text-amber-600" : "text-green-700 dark:text-green-400")}>
      {value}%
    </span>
  );
}

function Tile({ label, value, tone }: { label: string; value: string | number; tone?: "warn" | "bad" }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-slate-500">{label}</p>
        <p className={cn("text-2xl font-semibold tabular-nums", tone === "bad" && "text-red-600", tone === "warn" && "text-amber-600")}>{value}</p>
      </CardContent>
    </Card>
  );
}

export default function PriceByMarginPage() {
  const { can } = useCan();
  const canEdit = can("products.edit");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [cost, setCost] = useState<"all" | "withCost" | "noCost">("all");
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState("35");
  const [rounding, setRounding] = useState<Rounding>("end9");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  /** New prices typed or worked out, by row key. */
  const [draft, setDraft] = useState<Record<string, string>>({});
  const { data: categories } = useGetCategoriesQuery();
  const { data, isFetching } = useMarginsQuery({ search: q || undefined, categoryId: categoryId || undefined, cost, page, perPage: 50 });
  const [apply, { isLoading: saving }] = useApplyPricesMutation();

  useEffect(() => {
    const t = setTimeout(() => {
      setQ(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const rows = useMemo(() => data?.rows ?? [], [data]);
  const changes = rows
    .map((r) => ({ r, v: draft[keyOf(r)] }))
    .filter(({ r, v }) => v !== undefined && v !== "" && Number(v) > 0 && Number(v) !== r.price);
  const allPicked = rows.length > 0 && rows.every((r) => picked.has(keyOf(r)));
  const t = Number(target);
  const targetOk = target !== "" && Number.isFinite(t) && t < 100 && t > -100;

  const toggle = (k: string, on: boolean) =>
    setPicked((cur) => {
      const next = new Set(cur);
      if (on) next.add(k);
      else next.delete(k);
      return next;
    });

  const fill = () => {
    const out: Record<string, string> = { ...draft };
    let skipped = 0;
    for (const r of rows) {
      if (!picked.has(keyOf(r))) continue;
      if (r.cost === null) {
        skipped += 1;
        continue;
      }
      out[keyOf(r)] = String(roundUp(r.cost / (1 - t / 100), rounding));
    }
    setDraft(out);
    if (skipped) toast.message(`${skipped} row${skipped === 1 ? "" : "s"} skipped — no cost price yet`);
  };

  const save = async () => {
    try {
      const res = await apply({
        rows: changes.map(({ r, v }) => ({ productId: r.productId, variantId: r.variantId, regularPrice: Number(v) })),
      }).unwrap();
      toast.success(`${res.updated} price${res.updated === 1 ? "" : "s"} updated`);
      setDraft({});
      setPicked(new Set());
    } catch (e) {
      toast.error(errorText(e));
    }
  };

  return (
    <div className="space-y-6">
      <PageTitle
        icon={Calculator}
        title="Price by margin"
        description="Cost, price and margin for every product and option. Set the margin you want and the new prices are worked out from the cost."
      />

      {data ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Tile label="Products & options" value={data.summary.rows} />
          <Tile label="Average margin" value={data.summary.averageMargin === null ? "—" : `${data.summary.averageMargin}%`} />
          <Tile label="No cost price yet" value={data.summary.missingCost} tone={data.summary.missingCost ? "warn" : undefined} />
          <Tile label="Priced below cost" value={data.summary.belowCost} tone={data.summary.belowCost ? "bad" : undefined} />
        </div>
      ) : (
        <Skeleton className="h-20" />
      )}

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_14rem_15rem]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input className="pl-9" placeholder="Search name or SKU" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search products" />
            </div>
            <Select
              aria-label="Category"
              value={categoryId}
              onValueChange={(v) => {
                setCategoryId(v);
                setPage(1);
              }}
            >
              <SelectItem value="">All categories</SelectItem>
              {(categories ?? []).map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name}
                </SelectItem>
              ))}
            </Select>
            <Select
              aria-label="Cost price"
              value={cost}
              onValueChange={(v) => {
                setCost(v as typeof cost);
                setPage(1);
              }}
            >
              <SelectItem value="all">With and without cost</SelectItem>
              <SelectItem value="withCost">Has a cost price</SelectItem>
              <SelectItem value="noCost">No cost price</SelectItem>
            </Select>
          </div>

          {canEdit && (
            <div className="flex flex-wrap items-end gap-3 rounded-lg border border-dashed p-3">
              <Field label="Margin you want (%)" htmlFor="m-target" className="w-40">
                <Input id="m-target" type="number" step="0.5" value={target} onChange={(e) => setTarget(e.target.value)} />
              </Field>
              <Field label="Round prices" htmlFor="m-round" className="w-60">
                <Select id="m-round" value={rounding} onValueChange={(v) => setRounding(v as Rounding)}>
                  {Object.entries(ROUNDING_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </Select>
              </Field>
              <Button type="button" variant="outline" onClick={fill} disabled={!picked.size || !targetOk}>
                Work out prices for {picked.size} selected
              </Button>
              <div className="ml-auto flex items-center gap-2">
                {changes.length > 0 && (
                  <Button type="button" variant="ghost" onClick={() => setDraft({})}>
                    Undo
                  </Button>
                )}
                <Button type="button" onClick={save} disabled={!changes.length || saving}>
                  Save {changes.length || ""} new price{changes.length === 1 ? "" : "s"}
                </Button>
              </div>
            </div>
          )}

          {!data ? (
            <Skeleton className="h-64" />
          ) : rows.length === 0 ? (
            <EmptyState icon={Calculator} title="Nothing to show" text="No products match these filters." />
          ) : (
            <div className={cn("overflow-x-auto", isFetching && "opacity-70")}>
              <Table>
                <TableHeader>
                  <TableRow>
                    {canEdit && (
                      <TableHead className="w-10">
                        <Checkbox
                          checked={allPicked}
                          aria-label="Select all rows"
                          onCheckedChange={(v) => rows.forEach((r) => toggle(keyOf(r), v === true))}
                        />
                      </TableHead>
                    )}
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Margin</TableHead>
                    <TableHead className="text-right">On sale</TableHead>
                    {canEdit && <TableHead className="w-44">New price</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => {
                    const k = keyOf(r);
                    const v = draft[k] ?? "";
                    const nm = v !== "" ? marginOf(r.cost, Number(v)) : null;
                    return (
                      <TableRow key={k} className={cn(picked.has(k) && "bg-slate-50 dark:bg-slate-900")}>
                        {canEdit && (
                          <TableCell>
                            <Checkbox checked={picked.has(k)} aria-label={`Select ${r.name}${r.option ? ` ${r.option}` : ""}`} onCheckedChange={(on) => toggle(k, on === true)} />
                          </TableCell>
                        )}
                        <TableCell>
                          <Link href={`/catalog/products/${r.productId}`} className="font-medium hover:underline">
                            {r.name}
                          </Link>
                          <p className="text-xs text-slate-500">
                            {[r.option, r.sku, r.status !== "published" ? r.status : null, r.tierCount ? `${r.tierCount} bulk price${r.tierCount === 1 ? "" : "s"}` : null]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{r.cost === null ? <span className="text-amber-600">not set</span> : tk(r.cost)}</TableCell>
                        <TableCell className="text-right tabular-nums">{tk(r.price)}</TableCell>
                        <TableCell className="text-right">
                          <MarginCell value={r.margin} />
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums">
                          {r.salePrice === null ? (
                            <span className="text-slate-400">—</span>
                          ) : (
                            <>
                              {tk(r.salePrice)} <span className="text-xs">({r.saleMargin === null ? "—" : `${r.saleMargin}%`})</span>
                            </>
                          )}
                        </TableCell>
                        {canEdit && (
                          <TableCell>
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              className="h-8"
                              aria-label={`New price for ${r.name}${r.option ? ` ${r.option}` : ""}`}
                              value={v}
                              placeholder={r.price === null ? "" : String(r.price)}
                              onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))}
                            />
                            {nm !== null && (
                              <p className="mt-0.5 text-xs">
                                <MarginCell value={nm} /> margin
                              </p>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          {data && data.total > data.perPage && (
            <div className="flex items-center justify-end gap-2 text-sm">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <span className="tabular-nums">
                {page} / {Math.ceil(data.total / data.perPage)}
              </span>
              <Button size="sm" variant="outline" disabled={page * data.perPage >= data.total} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          )}
          <p className="text-xs text-slate-500">
            Saving changes the normal price. Sale prices, storefront prices and bulk prices stay as they are — check them on the product if a new price
            passes them.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
