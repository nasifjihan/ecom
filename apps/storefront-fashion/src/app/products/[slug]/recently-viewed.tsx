"use client";

/** "Recently viewed": the last products this browser opened, newest first (kept in the browser only). */
import * as React from "react";
import { ProductGrid, useGetProductsQuery, useT } from "@ecom/storefront-base";
import { useProductGridActions } from "../../_components/product-actions";

const KEY = "recentlyViewed";
const MAX = 12;

function read(): string[] {
  try {
    const v = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && /^\d+$/.test(x)) : [];
  } catch {
    return [];
  }
}

/** Remembers this product, and shows the ones viewed before it. */
export function RecentlyViewed({ productId }: { productId: string }) {
  const t = useT();
  const actions = useProductGridActions();
  const [before, setBefore] = React.useState<string[]>([]);
  React.useEffect(() => {
    const seen = read().filter((id) => id !== productId);
    setBefore(seen.slice(0, 4));
    try {
      window.localStorage.setItem(KEY, JSON.stringify([productId, ...seen].slice(0, MAX)));
    } catch {
      // Private mode or full storage: just don't remember.
    }
  }, [productId]);
  const ids = before.join(",");
  const { data } = useGetProductsQuery({ ids, perPage: 4 }, { skip: !ids });
  const items = React.useMemo(() => [...(data?.items ?? [])].sort((a, b) => before.indexOf(String(a.id)) - before.indexOf(String(b.id))), [data, before]);
  if (!items.length) return null;
  return (
    <section className="mb-16">
      <h2 className="mb-6 text-2xl md:text-3xl font-bold tracking-tight">{t("Recently viewed")}</h2>
      <ProductGrid products={items} loading={false} {...actions} />
    </section>
  );
}
