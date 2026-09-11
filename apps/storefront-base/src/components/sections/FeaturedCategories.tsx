"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { cn } from "@ecom/utils";

export type FeaturedCategory = {
  id: string | number;
  slug: string;
  name: string;
  image?: string;
  icon?: string;
  productCount?: number;
  color?: string;
};

export type FeaturedCategoriesProps = {
  categories?: FeaturedCategory[];
  variant?: "circles" | "squares" | "cards";
  cols?: 4 | 6 | 8;
  className?: string;
  heading?: string;
  subheading?: string;
  showCount?: boolean;
};

const DEFAULT_CATEGORIES: FeaturedCategory[] = [
  { id: 1, slug: "women-dresses", name: "Women Dresses", productCount: 420, color: "from-pink-400 to-rose-500" },
  { id: 2, slug: "men-shirts", name: "Men Shirts", productCount: 310, color: "from-blue-400 to-indigo-500" },
  { id: 3, slug: "kids", name: "Kids", productCount: 180, color: "from-amber-400 to-orange-500" },
  { id: 4, slug: "accessories", name: "Accessories", productCount: 260, color: "from-emerald-400 to-teal-500" },
  { id: 5, slug: "shoes", name: "Shoes", productCount: 340, color: "from-violet-400 to-purple-500" },
  { id: 6, slug: "bags", name: "Bags", productCount: 190, color: "from-cyan-400 to-sky-500" },
  { id: 7, slug: "watches", name: "Watches", productCount: 150, color: "from-slate-400 to-slate-600" },
  { id: 8, slug: "perfumes", name: "Perfumes", productCount: 120, color: "from-fuchsia-400 to-pink-500" },
];

export const FeaturedCategories: React.FC<FeaturedCategoriesProps> = ({
  categories = DEFAULT_CATEGORIES,
  variant = "circles",
  cols = 8,
  className,
  heading = "Shop by Category",
  subheading = "Browse our wide range of curated collections",
  showCount = true,
}) => {
  const colsClass =
    cols === 4
      ? "grid-cols-2 sm:grid-cols-4"
      : cols === 6
      ? "grid-cols-3 sm:grid-cols-4 md:grid-cols-6"
      : "grid-cols-3 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8";

  return (
    <section className={cn("py-10 md:py-14", className)}>
      {(heading || subheading) && (
        <div className="text-center mb-8 md:mb-10">
          {heading && (
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-2">{heading}</h2>
          )}
          {subheading && <p className="text-muted-foreground">{subheading}</p>}
        </div>
      )}

      <div className={cn("grid gap-4 md:gap-6", colsClass)}>
        {categories.map((cat, idx) => (
          <motion.div
            key={cat.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05, duration: 0.3 }}
            className="flex flex-col items-center"
          >
            <Link
              href={`/categories/${cat.slug}`}
              className="group block w-full focus:outline-none"
            >
              {variant === "circles" ? (
                <div className="w-full aspect-square max-w-[110px] mx-auto">
                  <div
                    className={cn(
                      "h-full w-full rounded-full overflow-hidden relative group-hover:scale-105 transition-transform duration-300 bg-gradient-to-br shadow-soft",
                      cat.color ?? "from-primary to-primary/60",
                    )}
                  >
                    {cat.image ? (
                      <img
                        src={cat.image}
                        alt={cat.name}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center">
                        <span className="text-4xl font-bold text-white/80">{cat.name[0]}</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : variant === "squares" ? (
                <div className="w-full aspect-square overflow-hidden rounded-xl relative group-hover:scale-105 transition-transform duration-300 shadow-soft">
                  <div
                    className={cn(
                      "h-full w-full bg-gradient-to-br",
                      cat.color ?? "from-primary to-primary/60",
                    )}
                  >
                    {cat.image ? (
                      <img src={cat.image} alt={cat.name} className="h-full w-full object-cover opacity-90" loading="lazy" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-white">
                        <span className="text-5xl font-bold">{cat.name[0]}</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="w-full aspect-[4/3] overflow-hidden rounded-xl relative group-hover:shadow-hover transition-shadow duration-300">
                  <div
                    className={cn(
                      "h-full w-full bg-gradient-to-br",
                      cat.color ?? "from-primary to-primary/60",
                    )}
                  >
                    {cat.image ? (
                      <img src={cat.image} alt={cat.name} className="h-full w-full object-cover opacity-80" loading="lazy" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-white">
                        <span className="text-6xl font-bold">{cat.name[0]}</span>
                      </div>
                    )}
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                    <h3 className="font-bold text-lg leading-tight">{cat.name}</h3>
                    {showCount && cat.productCount !== undefined && (
                      <p className="text-xs text-white/80">{cat.productCount} products</p>
                    )}
                  </div>
                </div>
              )}

              {variant !== "cards" && (
                <div className="mt-3 text-center">
                  <h3 className="font-semibold text-sm group-hover:text-primary transition-colors line-clamp-2">
                    {cat.name}
                  </h3>
                  {showCount && cat.productCount !== undefined && (
                    <p className="text-xs text-muted-foreground mt-0.5">{cat.productCount} items</p>
                  )}
                </div>
              )}
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
};

export default FeaturedCategories;
