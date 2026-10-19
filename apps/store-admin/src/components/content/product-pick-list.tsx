"use client";

/** Search published products and keep an ordered list of picks (product rows, blog "shop this"). */
import * as React from "react";
import { ArrowDown, ArrowUp, X } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { Field } from "./shared";
import { useGetProductsQuery } from "@/lib/features/catalog/catalog-api-slice";

export interface PickedProduct {
  id: string;
  name: string;
}

export function ProductPickList({ id, value, onChange, max }: { id: string; value: PickedProduct[]; onChange: (v: PickedProduct[]) => void; max: number }) {
  const [q, setQ] = React.useState("");
  const [search, setSearch] = React.useState("");
  React.useEffect(() => {
    const t = setTimeout(() => setSearch(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);
  const { data: found, isFetching } = useGetProductsQuery({ search, perPage: 8, status: "published" }, { skip: search.length < 2 });
  const move = (i: number, by: number) => {
    const next = [...value];
    const [item] = next.splice(i, 1);
    next.splice(i + by, 0, item!);
    onChange(next);
  };
  return (
    <div className="space-y-3">
      <Field label="Add products" htmlFor={id} hint={`Type at least 2 letters of a name or SKU. Up to ${max}.`}>
        <Input id={id} value={q} placeholder="Search products…" disabled={value.length >= max} onChange={(e) => setQ(e.target.value)} />
      </Field>
      {search.length >= 2 && (
        <div className="rounded-md border">
          {isFetching && !found ? (
            <p className="p-2 text-sm text-slate-500">Searching…</p>
          ) : !found?.items.length ? (
            <p className="p-2 text-sm text-slate-500">No published products match.</p>
          ) : (
            found.items.map((p) => {
              const added = value.some((x) => x.id === String(p.id));
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={added || value.length >= max}
                  onClick={() => onChange([...value, { id: String(p.id), name: p.name }])}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 disabled:opacity-50 dark:hover:bg-slate-800"
                >
                  <span className="truncate">{p.name}</span>
                  <span className="shrink-0 text-xs text-slate-500">{added ? "Added" : (p.sku ?? "")}</span>
                </button>
              );
            })
          )}
        </div>
      )}
      {value.length > 0 && (
        <ol className="divide-y rounded-md border">
          {value.map((p, i) => (
            <li key={p.id} className="flex items-center gap-2 px-3 py-1.5 text-sm">
              <span className="w-5 text-xs text-slate-500">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate">{p.name}</span>
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move ${p.name} up`}>
                <ArrowUp className="h-3.5 w-3.5" />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={i === value.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${p.name} down`}>
                <ArrowDown className="h-3.5 w-3.5" />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => onChange(value.filter((x) => x.id !== p.id))} aria-label={`Remove ${p.name}`}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
