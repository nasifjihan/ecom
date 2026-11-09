"use client";

/** Up to 4 products side by side: price, rating, stock, sizes and colours, and their details. */
import * as React from "react";
import Link from "next/link";
import { Star, X } from "lucide-react";
import { Button, formatMoney, removeFromCompare, useCompare, useGetProductBySlugQuery, useT, type CompareItem, type ProductDetail } from "@ecom/storefront-base";

type Loaded = Record<string, ProductDetail | undefined>;

/** Loads one product and hands it up (hooks can't run in a loop). */
function Load({ item, onLoad }: { item: CompareItem; onLoad: (id: string, p: ProductDetail) => void }) {
  const { data } = useGetProductBySlugQuery(item.slug);
  React.useEffect(() => {
    if (data) onLoad(item.id, data);
  }, [data, item.id, onLoad]);
  return null;
}

export default function ComparePage() {
  const t = useT();
  const { items } = useCompare();
  const [loaded, setLoaded] = React.useState<Loaded>({});
  const onLoad = React.useCallback((id: string, p: ProductDetail) => setLoaded((l) => (l[id] === p ? l : { ...l, [id]: p })), []);
  const products = items.map((i) => ({ item: i, p: loaded[i.id] }));

  if (!items.length) {
    return (
      <div className="container flex min-h-[40vh] flex-col items-center justify-center gap-4 py-16 text-center">
        <p className="text-muted-foreground">{t("Pick products to compare with the compare button on a product.")}</p>
        <Button asChild>
          <Link href="/products">{t("Shop products")}</Link>
        </Button>
      </div>
    );
  }

  // Every detail name any of them has, in the order first seen.
  const specNames = [...new Set(products.flatMap(({ p }) => (p?.specifications ?? []).map((s) => s.name)))];
  const options = (p?: ProductDetail) => [...new Set((p?.variants ?? []).map((v) => v.label))].join(", ");
  const rows: { label: string; cell: (p?: ProductDetail) => React.ReactNode }[] = [
    { label: t("Price"), cell: (p) => p && <span className="font-semibold">{formatMoney(p.price, "BDT")}{p.compareAtPrice ? <s className="ml-2 text-xs font-normal text-muted-foreground">{formatMoney(p.compareAtPrice, "BDT")}</s> : null}</span> },
    { label: t("Rating"), cell: (p) => p && (p.reviewCount ? <span className="inline-flex items-center gap-1"><Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />{p.rating.toFixed(1)} ({p.reviewCount})</span> : <span className="text-muted-foreground">{t("No reviews yet")}</span>) },
    { label: t("Availability"), cell: (p) => p && (p.stockStatus === "OUT_OF_STOCK" || p.isOutOfStock ? <span className="text-destructive">{t("Out of stock")}</span> : <span className="text-emerald-600">{t("In stock")}</span>) },
    { label: t("Sizes and colours"), cell: (p) => (p ? options(p) || "—" : null) },
    { label: t("Category"), cell: (p) => p?.category?.name ?? (p ? "—" : null) },
    ...specNames.map((n) => ({ label: t(n), cell: (p?: ProductDetail) => (p ? p.specifications.find((s) => s.name === n)?.value ?? "—" : null) })),
    { label: t("About it"), cell: (p) => p && <span className="line-clamp-4 text-muted-foreground">{p.shortDescription || p.description?.replace(/<[^>]*>/g, " ").slice(0, 200) || "—"}</span> },
  ];

  return (
    <div className="container py-8">
      {items.map((i) => (
        <Load key={i.id} item={i} onLoad={onLoad} />
      ))}
      <h1 className="mb-6 text-2xl font-bold">{t("Compare products")}</h1>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] table-fixed border-collapse text-sm">
          <thead>
            <tr>
              <th className="w-28 p-2 sm:w-40" />
              {products.map(({ item, p }) => (
                <th key={item.id} className="p-2 text-left align-top font-normal">
                  <div className="relative">
                    <button type="button" onClick={() => removeFromCompare(item.id)} aria-label={t("Remove {title}", { title: item.title })} className="absolute right-0 top-0 rounded-full bg-background/90 p-1 shadow">
                      <X className="h-4 w-4" />
                    </button>
                    <Link href={`/products/${item.slug}`}>
                      <div className="aspect-square overflow-hidden rounded-lg bg-muted">{(p?.image ?? item.image) && <img src={p?.image ?? item.image} alt={item.title} className="h-full w-full object-cover" />}</div>
                      <p className="mt-2 line-clamp-2 font-medium hover:underline">{p?.title ?? item.title}</p>
                    </Link>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-t">
                <th scope="row" className="p-2 text-left align-top text-xs font-medium text-muted-foreground">
                  {r.label}
                </th>
                {products.map(({ item, p }) => (
                  <td key={item.id} className="p-2 align-top">
                    {r.cell(p) ?? <span className="text-muted-foreground">…</span>}
                  </td>
                ))}
              </tr>
            ))}
            <tr className="border-t">
              <th />
              {products.map(({ item }) => (
                <td key={item.id} className="p-2">
                  <Button asChild size="sm" className="w-full">
                    <Link href={`/products/${item.slug}`}>{t("View product")}</Link>
                  </Button>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
