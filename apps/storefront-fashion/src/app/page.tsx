"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { ArrowRight, ShoppingBag, Truck, Shield, CreditCard } from "lucide-react";
import {
  HeroSlider,
  FeaturedCategories,
  ProductGrid,
  Button,
  ProductCardData,
  useCart,
  useGetProductsQuery,
  useGetCategoriesTreeQuery,
  type ProductSummary,
} from "@ecom/storefront-base";
import { toast } from "sonner";

const CATEGORY_COLORS = [
  "from-pink-400 to-rose-500",
  "from-blue-400 to-indigo-500",
  "from-emerald-400 to-teal-500",
  "from-amber-400 to-orange-500",
  "from-violet-400 to-purple-500",
  "from-cyan-400 to-sky-500",
  "from-slate-400 to-slate-600",
  "from-fuchsia-400 to-pink-500",
];

export default function HomePage() {
  const { addItem } = useCart();
  const router = useRouter();
  const { data: featured, isLoading: featuredLoading } = useGetProductsQuery({ featured: true, perPage: 8, sort: "popular" });
  const { data: newest, isLoading: newestLoading } = useGetProductsQuery({ perPage: 8, sort: "newest" });
  const { data: categoryTree = [] } = useGetCategoriesTreeQuery();
  const [wishlisted, setWishlisted] = React.useState<Set<string>>(new Set());

  const handleAddToCart = React.useCallback(
    (p: ProductCardData) => {
      const summary = p as ProductSummary;
      if (summary.hasVariants) {
        router.push(`/products/${p.slug}`);
        return;
      }
      addItem({
        productId: p.id,
        variantId: undefined,
        title: p.title,
        slug: p.slug,
        image: p.image,
        price: p.price,
        weightKG: summary.weightKG,
      });
      toast.success("Added to cart", {
        description: (
          <span className="line-clamp-1">{p.title.slice(0, 40)}</span>
        ),
        action: {
          label: "View Cart",
          onClick: () => (window.location.href = "/cart"),
        },
      });
    },
    [addItem, router],
  );

  const toggleWishlist = React.useCallback((p: ProductCardData) => {
    setWishlisted((prev) => {
      const next = new Set(prev);
      if (next.has(p.id)) next.delete(p.id);
      else next.add(p.id);
      return next;
    });
    toast.info(wishlisted.has(p.id) ? "Removed from wishlist" : "Added to wishlist");
  }, [wishlisted]);

  // Leaf categories read best as shop-by-category tiles; fall back to roots for flat trees.
  const sectionCats = React.useMemo(() => {
    const leaves = categoryTree.flatMap((c) => (c.children?.length ? c.children : [c]));
    return leaves.slice(0, 8).map((c, i) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      image: c.image,
      productCount: c.productCount,
      color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
    }));
  }, [categoryTree]);

  const featureItems = [
    { icon: <Truck className="h-6 w-6 text-primary" />, title: "Free Delivery", desc: "On orders above ৳1000 inside Bangladesh" },
    { icon: <Shield className="h-6 w-6 text-primary" />, title: "Easy Returns", desc: "7-day no-questions-asked return policy" },
    { icon: <CreditCard className="h-6 w-6 text-primary" />, title: "Secure Payment", desc: "bKash, Nagad, Rocket, SSL, Visa — all secure" },
    { icon: <ShoppingBag className="h-6 w-6 text-primary" />, title: "Authentic Brands", desc: "100% genuine products from authorized brands" },
  ];

  return (
    <div className="flex flex-col gap-10 md:gap-16 pb-10 md:pb-16">
      <section className="container pt-4 md:pt-6">
        <HeroSlider
          height={{ sm: "360px", md: "460px", lg: "560px" } as unknown as number}
          slides={[
            {
              id: 1,
              badge: "Eid Collection 2026",
              title: "Eid Collection 2026 — Up to 50% OFF",
              subtitle: "Discover our exclusive festive collection for men, women and kids. Shop now and enjoy free delivery across Bangladesh!",
              ctaText: "Shop Now →",
              ctaHref: "/products",
              bgGradient: "from-violet-500 via-purple-600 to-fuchsia-600",
              alignment: "left",
              textColor: "light",
            },
            {
              id: 2,
              badge: "Summer Sale",
              title: "Beat the Heat in Style",
              subtitle: "Lightweight summer essentials from ৳490 only. Limited time offer — hurry before stock runs out!",
              ctaText: "View Collection",
              ctaHref: "/products?category=women",
              bgGradient: "from-amber-400 via-orange-500 to-red-500",
              alignment: "center",
              textColor: "light",
            },
            {
              id: 3,
              badge: "New Arrivals",
              title: "Men's Premium Collection",
              subtitle: "Premium quality shirts, panjabis and formal wear. Quality guaranteed by leading brands.",
              ctaText: "Explore Now",
              ctaHref: "/products?category=men",
              bgGradient: "from-slate-800 via-slate-900 to-black",
              alignment: "right",
              textColor: "light",
            },
          ]}
        />
      </section>

      <section className="container">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-6 rounded-2xl bg-gradient-to-r from-primary/5 via-secondary/5 to-primary/5 border"
        >
          {featureItems.map((f) => (
            <div key={f.title} className="flex items-start gap-3 p-2">
              <div className="h-12 w-12 rounded-xl bg-white shadow-soft flex items-center justify-center flex-shrink-0">
                {f.icon}
              </div>
              <div>
                <h4 className="font-semibold text-sm md:text-base">{f.title}</h4>
                <p className="text-xs md:text-sm text-muted-foreground">{f.desc}</p>
              </div>
            </div>
          ))}
        </motion.div>
      </section>

      <section className="container">
        {sectionCats.length > 0 && (
          <FeaturedCategories categories={sectionCats} heading="Shop by Category" subheading="Find exactly what you need from our curated collections" />
        )}
      </section>

      <section className="container">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3"
        >
          <div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Featured Products</h2>
            <p className="text-muted-foreground mt-1">Handpicked bestsellers our customers love</p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/products">
              View All Products
              <ArrowRight className="h-4 w-4 ml-2" />
            </Link>
          </Button>
        </motion.div>
        <ProductGrid
          products={featured?.items ?? []}
          loading={featuredLoading}
          onAddToCart={handleAddToCart}
          onToggleWishlist={toggleWishlist}
          wishlistedIds={wishlisted}
        />
      </section>

      <section className="w-full bg-gradient-to-r from-primary to-purple-600 text-white">
        <div className="container py-8 flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-left">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-sm font-semibold mb-3">
              <Truck className="h-4 w-4" /> Limited Time
            </div>
            <h3 className="text-xl md:text-2xl font-bold">Free Delivery on orders above ৳1000!</h3>
            <p className="text-white/80 text-sm mt-1">Nationwide delivery across Bangladesh — including Sylhet, Chattogram, Rajshahi.</p>
          </div>
          <Button
            size="lg"
            className="bg-white text-primary hover:bg-white/90 shadow-lg min-w-[160px]"
            onClick={() => (window.location.href = "/products")}
          >
            Shop Now
          </Button>
        </div>
      </section>

      <section className="container">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">New Arrivals</h2>
            <p className="text-muted-foreground mt-1">Fresh styles, just landed this week</p>
          </div>
          <Button variant="ghost" asChild>
            <Link href="/products?sort=newest">
              See all new
              <ArrowRight className="h-4 w-4 ml-2" />
            </Link>
          </Button>
        </div>
        <ProductGrid
          products={newest?.items ?? []}
          loading={newestLoading}
          cols={4}
          onAddToCart={handleAddToCart}
          onToggleWishlist={toggleWishlist}
          wishlistedIds={wishlisted}
        />
      </section>

    </div>
  );
}
