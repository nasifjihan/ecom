"use client";

/** What a product card's buttons do: add to cart (or open the product to pick an option) and the wishlist heart. */
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast, useCart, useT, type ProductCardData, type ProductSummary } from "@ecom/storefront-base";
import { useWishlist } from "@/lib/engagement";

export function useProductGridActions() {
  const { addItem } = useCart();
  const router = useRouter();
  const wishlist = useWishlist();
  const t = useT();

  const onAddToCart = React.useCallback(
    (p: ProductCardData) => {
      const summary = p as ProductSummary;
      if (summary.hasVariants) {
        router.push(`/products/${p.slug}`);
        return;
      }
      addItem({ productId: p.id, variantId: undefined, title: p.title, slug: p.slug, image: p.image, price: p.price, weightKG: summary.weightKG });
      toast.success(t("Added to cart"), {
        description: <span className="line-clamp-1">{p.title.slice(0, 40)}</span>,
        action: { label: t("View Cart"), onClick: () => (window.location.href = "/cart") },
      });
    },
    [addItem, router, t],
  );

  const onToggleWishlist = React.useCallback((p: ProductCardData) => void wishlist.toggle(p.id, p.title), [wishlist]);

  return { onAddToCart, onToggleWishlist, wishlistedIds: wishlist.ids };
}
