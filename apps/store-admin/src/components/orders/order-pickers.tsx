"use client";

/** Customer and product search boxes for staff forms (New order, quotations). */
import { useEffect, useState } from "react";
import { Search, ShoppingBag, X } from "lucide-react";
import { Button, Input } from "@/components/ui";
import {
  usePickCustomersQuery,
  usePickProductsQuery,
  usePickVariantsQuery,
  type PickCustomer,
  type PickProduct,
} from "@/lib/features/operations/manual-order-api-slice";

export const taka = (n: number | null | undefined) =>
  `৳${Number(n ?? 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

// ------------------------------------------------------------------ pickers

export function CustomerPicker({ onPick }: { onPick: (c: PickCustomer) => void }) {
  const [q, setQ] = useState("");
  const search = useDebounced(q.trim());
  const { data = [], isFetching } = usePickCustomersQuery(search, { skip: search.length < 2 });
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
      <Input className="pl-9" placeholder="Find a customer by name, phone or email" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Find customer" />
      {search.length >= 2 && (
        <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border bg-white shadow-lg dark:bg-slate-900">
          {data.length === 0 ? (
            <li className="p-3 text-sm text-slate-500">{isFetching ? "Searching…" : "No customer found — fill in the details below."}</li>
          ) : (
            data.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                  onClick={() => {
                    onPick(c);
                    setQ("");
                  }}
                >
                  <span>
                    <span className="font-medium">{c.name}</span>
                    <span className="ml-2 text-slate-500">{[c.phone, c.email].filter(Boolean).join(" · ")}</span>
                  </span>
                  <span className="text-xs text-slate-400">{c.orderCount} orders</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

export function VariantChooser({ product, onPick, onCancel }: { product: PickProduct; onPick: (id: string, label: string) => void; onCancel: () => void }) {
  const { data = [], isLoading } = usePickVariantsQuery(product.id);
  return (
    <div className="rounded-md border p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium">Choose an option of {product.name}</p>
        <Button type="button" variant="ghost" size="icon" onClick={onCancel} aria-label="Cancel">
          <X className="h-4 w-4" />
        </Button>
      </div>
      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {data.map((v) => {
            const out = v.manageStock && (v.stockQty ?? 0) <= 0;
            return (
              <Button key={v.id} type="button" variant="outline" size="sm" disabled={out} onClick={() => onPick(v.id, v.label)}>
                {v.label} · {taka(v.price)}
                <span className="ml-1 text-xs text-slate-400">{out ? "out of stock" : v.manageStock ? `${v.stockQty} left` : ""}</span>
              </Button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function ProductPicker({ onAdd }: { onAdd: (p: PickProduct, variant?: { id: string; label: string }) => void }) {
  const [q, setQ] = useState("");
  const [choosing, setChoosing] = useState<PickProduct | null>(null);
  const search = useDebounced(q.trim());
  const { data = [], isFetching } = usePickProductsQuery(search, { skip: search.length < 2 });
  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
        <Input className="pl-9" placeholder="Search products by name or SKU" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search products" />
        {search.length >= 2 && !choosing && (
          <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border bg-white shadow-lg dark:bg-slate-900">
            {data.length === 0 ? (
              <li className="p-3 text-sm text-slate-500">{isFetching ? "Searching…" : "No published product matches."}</li>
            ) : (
              data.map((p) => {
                const out = p.variantCount === 0 && p.manageStock && (p.stockQty ?? 0) <= 0;
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      disabled={out}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50 disabled:opacity-50 dark:hover:bg-slate-800"
                      onClick={() => {
                        if (p.variantCount > 0) setChoosing(p);
                        else {
                          onAdd(p);
                          setQ("");
                        }
                      }}
                    >
                      {p.imageUrl ? <img src={p.imageUrl} alt="" className="h-9 w-9 rounded object-cover" /> : <ShoppingBag className="h-9 w-9 p-2 text-slate-400" />}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{p.name}</span>
                        <span className="text-xs text-slate-500">
                          {p.sku} · {p.variantCount > 0 ? `${p.variantCount} options` : out ? "Out of stock" : p.manageStock ? `${p.stockQty} in stock` : "In stock"}
                        </span>
                      </span>
                      <span>{taka(p.price)}</span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        )}
      </div>
      {choosing && (
        <VariantChooser
          product={choosing}
          onCancel={() => setChoosing(null)}
          onPick={(id, label) => {
            onAdd(choosing, { id, label });
            setChoosing(null);
            setQ("");
          }}
        />
      )}
    </div>
  );
}

