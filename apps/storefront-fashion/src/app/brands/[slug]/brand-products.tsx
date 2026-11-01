"use client";

import Link from "next/link";
import { Button, ProductGrid, useT, type ProductSummary } from "@ecom/storefront-base";
import { useProductGridActions } from "../../_components/product-actions";

/** The brand's first products (loaded on the server, so search engines see them) and a link to all, with filters. */
export function BrandProducts({ slug, items, total }: { slug: string; items: ProductSummary[]; total: number }) {
  const t = useT();
  const actions = useProductGridActions();
  if (!items.length) return <p className="py-16 text-center text-muted-foreground">{t("No products from this brand yet.")}</p>;
  return (
    <>
      <ProductGrid products={items} loading={false} cols={4} {...actions} />
      <div className="mt-8 text-center">
        <Button variant="outline" asChild>
          <Link href={`/products?brand=${encodeURIComponent(slug)}`}>
            {total > items.length ? t("See all {n} products", { n: total }) : t("Filter by size, colour and more")}
          </Link>
        </Button>
      </div>
    </>
  );
}
