"use client";

/** "Shop this post": the products picked in the admin, live from the catalog, in the picked order. */
import * as React from "react";
import { ProductGrid, useGetProductsQuery, useT } from "@ecom/storefront-base";
import { useProductGridActions } from "../../_components/product-actions";

export function ShopThis({ productIds }: { productIds: string[] }) {
  const t = useT();
  const actions = useProductGridActions();
  const ids = productIds.join(",");
  const { data, isLoading } = useGetProductsQuery({ ids, perPage: productIds.length }, { skip: !productIds.length });
  const items = React.useMemo(() => {
    const order = ids.split(",");
    return [...(data?.items ?? [])].sort((a, b) => order.indexOf(String(a.id)) - order.indexOf(String(b.id)));
  }, [data, ids]);
  // Products since unpublished or deleted drop out; with none left, so does the section.
  if (!productIds.length || (!isLoading && !items.length)) return null;
  return (
    <section className="mt-12 border-t pt-10" aria-labelledby="shop-this">
      <h2 id="shop-this" className="mb-6 text-2xl font-bold tracking-tight">
        {t("Shop this post")}
      </h2>
      <ProductGrid products={items} loading={isLoading} cols={3} {...actions} />
    </section>
  );
}
