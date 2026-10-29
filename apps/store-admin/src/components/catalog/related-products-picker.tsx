"use client";

import { useState } from "react";
import { Package, Search, X } from "lucide-react";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, Checkbox, Input, ScrollArea, cn } from "@/components/ui";
import { useGetProductsQuery } from "@/lib/features/catalog/catalog-api-slice";
import { useDebounced } from "@/components/orders/order-pickers";

/** Products picked to show first under "You may also like", in the order picked. */
export function RelatedProductsPicker({
  value,
  onChange,
  initial = [],
  excludeId,
}: {
  value: (string | bigint)[];
  onChange: (ids: string[]) => void;
  /** The saved picks with their names (they may not be in the search results). */
  initial?: { id: string; name: string }[];
  /** The product being edited, which can't be its own related product. */
  excludeId?: string | number;
}) {
  const [search, setSearch] = useState("");
  const query = useDebounced(search.trim());
  const { data } = useGetProductsQuery({ page: 1, perPage: 30, search: query || undefined });
  const [names, setNames] = useState<Record<string, string>>(() => Object.fromEntries(initial.map((r) => [String(r.id), r.name])));
  const ids = value.map(String);
  const toggle = (id: string, name?: string) => {
    if (name) setNames((m) => ({ ...m, [id]: name }));
    onChange(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);
  };
  const products = (data?.items ?? []).filter((p) => String(p.id) !== String(excludeId));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Related Products</CardTitle>
        <CardDescription>
          Shown first under &quot;You may also like&quot; on the product page, in the order picked. The rest is filled with products from the same category.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {ids.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {ids.map((id) => (
              <Badge key={id} variant="secondary" className="gap-1 pr-1">
                {names[id] ?? `#${id}`}
                <button type="button" onClick={() => toggle(id)} aria-label="Remove" className="rounded p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search products to link..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <ScrollArea className="h-64 border rounded-md p-2">
          {products.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No products found.</p>
          ) : (
            <div className="space-y-1">
              {products.map((p) => {
                const id = String(p.id);
                const isSelected = ids.includes(id);
                const img = p.thumbnailUrl || p.imageUrls?.[0];
                return (
                  <div
                    key={id}
                    onClick={() => toggle(id, p.name)}
                    className={cn("flex items-center gap-3 p-2 rounded cursor-pointer", isSelected ? "bg-primary/10" : "hover:bg-slate-50 dark:hover:bg-slate-800")}
                  >
                    <Checkbox checked={isSelected} onCheckedChange={() => {}} />
                    <div className="h-9 w-9 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden shrink-0">
                      {img ? <img src={img} className="w-full h-full object-cover" alt="" /> : <Package className="h-4 w-4 text-slate-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{p.name}</div>
                      <div className="text-xs text-muted-foreground truncate">SKU: {p.sku || "—"}</div>
                    </div>
                    <span className="text-sm font-medium whitespace-nowrap">{p.regularPrice != null ? `৳${p.regularPrice}` : "—"}</span>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
