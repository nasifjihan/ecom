"use client";

import * as React from "react";
import { ProductCard, ProductCardSkeleton, ProductCardData } from "./ProductCard";
import { cn } from "@ecom/utils";

export type ProductGridProps = {
  products?: ProductCardData[];
  skeletonCount?: number;
  onAddToCart?: (product: ProductCardData) => void;
  onToggleWishlist?: (product: ProductCardData) => void;
  onQuickView?: (product: ProductCardData) => void;
  wishlistedIds?: Set<string>;
  className?: string;
  cols?: 2 | 3 | 4 | 5;
  currency?: string;
};

export const ProductGrid: React.FC<ProductGridProps> = ({
  products = [],
  skeletonCount = 8,
  onAddToCart,
  onToggleWishlist,
  onQuickView,
  wishlistedIds,
  className,
  cols,
  currency,
}) => {
  const isLoading = products.length === 0;
  const items = isLoading ? Array.from({ length: skeletonCount }) : products;

  const colsClass =
    cols === 5
      ? "2xl:grid-cols-5"
      : cols === 3
      ? "lg:grid-cols-3 xl:grid-cols-3"
      : cols === 2
      ? "md:grid-cols-2"
      : "md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

  return (
    <div
      className={cn(
        "grid gap-3 sm:gap-4 grid-cols-2",
        colsClass,
        className,
      )}
    >
      {items.map((item, idx) =>
        isLoading ? (
          <ProductCardSkeleton key={`sk-${idx}`} />
        ) : (
          <ProductCard
            key={(item as ProductCardData).id}
            product={item as ProductCardData}
            onAddToCart={onAddToCart}
            onToggleWishlist={onToggleWishlist}
            onQuickView={onQuickView}
            isWishlisted={wishlistedIds?.has((item as ProductCardData).id)}
            currency={currency}
          />
        ),
      )}
    </div>
  );
};

export default ProductGrid;
