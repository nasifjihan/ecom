"use client";

/** Saved products: on the account when signed in, in this browser for guests. */
import * as React from "react";
import Link from "next/link";
import { Heart } from "lucide-react";
import { Button, ProductGrid, useGetProductsQuery, useT } from "@ecom/storefront-base";
import { useWishlist, useWishlistProductsQuery } from "@/lib/engagement";
import { useProductGridActions } from "../_components/product-actions";

export default function WishlistPage() {
  const wishlist = useWishlist();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const actions = useProductGridActions();
  const t = useT();
  const mine = useWishlistProductsQuery(undefined, { skip: !wishlist.signedIn });
  const guestIds = wishlist.guestIds;
  const guest = useGetProductsQuery({ ids: guestIds.join(","), perPage: 60 }, { skip: wishlist.signedIn || !guestIds.length });
  // Keep the order the customer saved them in, and drop ones taken off since.
  const products = wishlist.signedIn
    ? (mine.data ?? []).filter((p) => wishlist.has(p.id))
    : guestIds.flatMap((id) => guest.data?.items.find((p) => p.id === id) ?? []);
  const loading = !mounted || (wishlist.signedIn ? mine.isLoading : guest.isLoading && guestIds.length > 0);

  return (
    <div className="container space-y-6 py-6 md:py-10">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold md:text-3xl">
          <Heart className="h-7 w-7 text-primary" /> {t("Wishlist")}
        </h1>
        <p className="mt-1 text-muted-foreground">
          {wishlist.signedIn ? t("Saved on your account.") : t("Saved in this browser. Log in to keep them on your account.")}
        </p>
      </div>
      {loading ? (
        <ProductGrid loading skeletonCount={4} />
      ) : products.length ? (
        <ProductGrid products={products} cols={4} {...actions} />
      ) : (
        <div className="rounded-2xl border p-10 text-center">
          <p className="mb-4 text-muted-foreground">{t("Nothing saved yet. Tap the heart on any product to keep it here.")}</p>
          <Button asChild>
            <Link href="/products">{t("Browse products")}</Link>
          </Button>
        </div>
      )}
      {!wishlist.signedIn && products.length > 0 && (
        <p className="text-sm text-muted-foreground">
          <Link href="/account/login?next=/wishlist" className="font-medium text-primary hover:underline">
            {t("Log in")}
          </Link>{" "}
          {t("to save these to your account.")}
        </p>
      )}
    </div>
  );
}
