"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Eye, Heart, ShoppingCart, Star } from "lucide-react";
import {
  Card,
  CardContent,
  Button,
  Badge,
  Skeleton,
} from "../ui";
import { cn, formatMoney } from "@ecom/utils";
import { useT } from "../../i18n/provider";

export type ProductCardData = {
  id: string;
  slug: string;
  title: string;
  image: string;
  images?: string[];
  price: number;
  compareAtPrice?: number | null;
  rating?: number;
  reviewCount?: number;
  isOnSale?: boolean;
  discountPercent?: number;
  /** Set while a flash sale sets the price. */
  flashSale?: { name: string; endsAt: string } | null;
  badge?: string;
  badgeVariant?: "default" | "secondary" | "destructive" | "outline" | "success";
  isNew?: boolean;
  isOutOfStock?: boolean;
};

export type ProductCardProps = {
  product: ProductCardData;
  onAddToCart?: (product: ProductCardData) => void;
  onToggleWishlist?: (product: ProductCardData) => void;
  onQuickView?: (product: ProductCardData) => void;
  isWishlisted?: boolean;
  className?: string;
  currency?: string;
};

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onAddToCart,
  onToggleWishlist,
  onQuickView,
  isWishlisted = false,
  className,
  currency = "BDT",
}) => {
  const [isHovered, setIsHovered] = React.useState(false);
  const [liked, setLiked] = React.useState(isWishlisted);
  const t = useT();

  const handleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setLiked(!liked);
    onToggleWishlist?.(product);
  };

  const handleQuickView = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onQuickView?.(product);
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onAddToCart?.(product);
  };

  const discountPercent =
    product.discountPercent ??
    (product.compareAtPrice && product.compareAtPrice > product.price
      ? Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)
      : null);

  const isOnSale = product.isOnSale ?? !!discountPercent;

  const rating = product.rating ?? 0;
  const reviewCount = product.reviewCount ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, scale: 1.02 }}
      transition={{ type: "spring", stiffness: 260, damping: 20 }}
      className={cn("h-full", className)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Link href={`/products/${product.slug}`} className="block h-full">
        <Card className="h-full overflow-hidden group transition-shadow hover:shadow-hover">
          <div className="relative overflow-hidden bg-slate-100 aspect-[4/5]">
            <img
              src={product.image}
              alt={product.title}
              loading="lazy"
              className={cn(
                "h-full w-full object-cover transition-all duration-300",
                isHovered && "scale-105",
              )}
            />

            <div className="absolute top-2 left-2 flex flex-col items-start gap-1">
              {product.flashSale && (
                <Badge
                  variant="destructive"
                  className="text-[10px] font-semibold bg-gradient-to-r from-orange-500 to-rose-600 border-0"
                  title={product.flashSale.name}
                >
                  ⚡ {t("FLASH SALE")}
                </Badge>
              )}
              {isOnSale && discountPercent && (
                <Badge variant="destructive" className="text-[10px] font-semibold">
                  -{discountPercent}%
                </Badge>
              )}
              {product.isNew && (
                <Badge variant="success" className="text-[10px] font-semibold">
                  {t("NEW")}
                </Badge>
              )}
              {product.badge && (
                <Badge variant={product.badgeVariant ?? "default"} className="text-[10px] font-semibold">
                  {product.badge}
                </Badge>
              )}
            </div>

            {product.isOutOfStock && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <Badge variant="destructive" className="px-3 py-1 text-sm">
                  {t("Out of Stock")}
                </Badge>
              </div>
            )}

            <div
              className={cn(
                "absolute right-2 top-2 flex flex-col gap-1 transition-all duration-200",
                isHovered ? "opacity-100 translate-x-0" : "opacity-0 translate-x-2 pointer-events-none",
              )}
            >
              <Button
                size="icon"
                variant="outline"
                className="h-9 w-9 rounded-full bg-white/90 backdrop-blur hover:bg-white"
                onClick={handleQuickView}
                aria-label={t("Quick view")}
              >
                <Eye className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="outline"
                className={cn(
                  "h-9 w-9 rounded-full bg-white/90 backdrop-blur hover:bg-white",
                  liked && "text-red-500 bg-red-50",
                )}
                onClick={handleWishlist}
                aria-label={t("Add to wishlist")}
              >
                <Heart className={cn("h-4 w-4", liked && "fill-current")} />
              </Button>
            </div>

            <motion.div
              initial={false}
              animate={{ y: isHovered ? 0 : "100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="absolute inset-x-0 bottom-0 p-3"
            >
              <Button
                className="w-full bg-primary text-white hover:bg-primary/90 shadow-soft"
                onClick={handleAddToCart}
                disabled={product.isOutOfStock}
              >
                <ShoppingCart className="h-4 w-4 mr-2" />
                {product.isOutOfStock ? t("Out of Stock") : t("Add to Cart")}
              </Button>
            </motion.div>
          </div>

          <CardContent className="p-4 space-y-2">
            <h3 className="font-medium text-sm leading-snug line-clamp-2 min-h-[2.5rem] text-foreground group-hover:text-primary transition-colors">
              {product.title}
            </h3>

            {(rating > 0 || reviewCount > 0) && (
              <div className="flex items-center gap-1.5">
                <div className="flex items-center">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star
                      key={i}
                      className={cn(
                        "h-3.5 w-3.5",
                        i <= Math.round(rating) ? "text-amber-400 fill-amber-400" : "text-slate-200 fill-slate-200",
                      )}
                    />
                  ))}
                </div>
                <span className="text-xs text-muted-foreground">
                  {rating.toFixed(1)} {reviewCount > 0 && `(${reviewCount})`}
                </span>
              </div>
            )}

            <div className="flex items-baseline gap-2 pt-1">
              <span className="font-bold text-foreground">
                {formatMoney(product.price, currency)}
              </span>
              {product.compareAtPrice && product.compareAtPrice > product.price && (
                <span className="text-sm text-muted-foreground line-through">
                  {formatMoney(product.compareAtPrice, currency)}
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  );
};

export const ProductCardSkeleton: React.FC<{ className?: string }> = ({ className }) => (
  <Card className={cn("h-full overflow-hidden", className)}>
    <Skeleton className="aspect-[4/5] w-full rounded-none" />
    <CardContent className="p-4 space-y-3">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-24" />
      <div className="flex items-baseline gap-2 pt-1">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-3 w-16" />
      </div>
    </CardContent>
  </Card>
);

export default ProductCard;
