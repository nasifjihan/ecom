"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { ArrowRight, CreditCard, Gift, Phone, Shield, ShoppingBag, Truck } from "lucide-react";
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
import type { HomepageSection } from "@/lib/content";

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

/** Hero backgrounds the admin can pick (Online Store > Homepage). */
const GRADIENTS: Record<string, string> = {
  violet: "from-violet-500 via-purple-600 to-fuchsia-600",
  sunset: "from-amber-400 via-orange-500 to-red-500",
  midnight: "from-slate-800 via-slate-900 to-black",
  emerald: "from-emerald-500 via-teal-600 to-cyan-700",
  rose: "from-rose-400 via-pink-500 to-fuchsia-600",
  ocean: "from-sky-500 via-blue-600 to-indigo-700",
};

const FEATURE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  truck: Truck,
  shield: Shield,
  card: CreditCard,
  bag: ShoppingBag,
  gift: Gift,
  phone: Phone,
};

/** Shown only if the content API is unreachable. */
const FALLBACK: HomepageSection[] = [
  { type: "featured_products", enabled: true, config: { heading: "Featured Products", subheading: "", limit: 8 } },
  { type: "new_arrivals", enabled: true, config: { heading: "New Arrivals", subheading: "", limit: 8 } },
];

type SectionOf<T extends HomepageSection["type"]> = Extract<HomepageSection, { type: T }>;

export function HomeSections({ sections }: { sections: HomepageSection[] | null }) {
  const list = sections ?? FALLBACK;
  const { addItem } = useCart();
  const router = useRouter();
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
        description: <span className="line-clamp-1">{p.title.slice(0, 40)}</span>,
        action: {
          label: "View Cart",
          onClick: () => (window.location.href = "/cart"),
        },
      });
    },
    [addItem, router],
  );

  const toggleWishlist = React.useCallback(
    (p: ProductCardData) => {
      setWishlisted((prev) => {
        const next = new Set(prev);
        if (next.has(p.id)) next.delete(p.id);
        else next.add(p.id);
        return next;
      });
      toast.info(wishlisted.has(p.id) ? "Removed from wishlist" : "Added to wishlist");
    },
    [wishlisted],
  );

  const productProps = { onAddToCart: handleAddToCart, onToggleWishlist: toggleWishlist, wishlistedIds: wishlisted };

  return (
    <div className="flex flex-col gap-10 md:gap-16 pb-10 md:pb-16">
      {list.map((s) => {
        switch (s.type) {
          case "hero":
            return <Hero key={s.type} section={s} />;
          case "features":
            return <Features key={s.type} section={s} />;
          case "categories":
            return <Categories key={s.type} section={s} />;
          case "featured_products":
            return <ProductsBlock key={s.type} section={s} query={{ featured: true, sort: "popular" }} moreHref="/products" moreLabel="View All Products" {...productProps} />;
          case "new_arrivals":
            return <ProductsBlock key={s.type} section={s} query={{ sort: "newest" }} moreHref="/products?sort=newest" moreLabel="See all new" {...productProps} />;
          case "promo_banner":
            return <Promo key={s.type} section={s} />;
          default:
            return null;
        }
      })}
    </div>
  );
}

function Hero({ section }: { section: SectionOf<"hero"> }) {
  return (
    <section className="container pt-4 md:pt-6">
      <HeroSlider
        height={{ sm: "360px", md: "460px", lg: "560px" } as unknown as number}
        slides={section.config.slides.map((s, i) => ({
          id: i,
          badge: s.badge || undefined,
          title: s.title,
          subtitle: s.subtitle || undefined,
          ctaText: s.ctaText || undefined,
          ctaHref: s.ctaHref || undefined,
          backgroundImage: s.imageUrl || undefined,
          bgGradient: GRADIENTS[s.gradient] ?? GRADIENTS.violet,
          alignment: s.alignment,
          textColor: "light",
        }))}
      />
    </section>
  );
}

function Features({ section }: { section: SectionOf<"features"> }) {
  const items = section.config.items;
  return (
    <section className="container">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4 }}
        className={`grid grid-cols-2 ${items.length >= 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"} gap-4 p-6 rounded-2xl bg-gradient-to-r from-primary/5 via-secondary/5 to-primary/5 border`}
      >
        {items.map((f) => {
          const Icon = FEATURE_ICONS[f.icon] ?? ShoppingBag;
          return (
            <div key={f.title} className="flex items-start gap-3 p-2">
              <div className="h-12 w-12 rounded-xl bg-white shadow-soft flex items-center justify-center flex-shrink-0">
                <Icon className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h4 className="font-semibold text-sm md:text-base">{f.title}</h4>
                <p className="text-xs md:text-sm text-muted-foreground">{f.desc}</p>
              </div>
            </div>
          );
        })}
      </motion.div>
    </section>
  );
}

function Categories({ section }: { section: SectionOf<"categories"> }) {
  const { data: categoryTree = [] } = useGetCategoriesTreeQuery();
  // Leaf categories read best as shop-by-category tiles; fall back to roots for flat trees.
  const cats = React.useMemo(() => {
    const leaves = categoryTree.flatMap((c) => (c.children?.length ? c.children : [c]));
    return leaves.slice(0, section.config.limit).map((c, i) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      image: c.image,
      productCount: c.productCount,
      color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
    }));
  }, [categoryTree, section.config.limit]);
  if (!cats.length) return null;
  return (
    <section className="container">
      <FeaturedCategories categories={cats} heading={section.config.heading} subheading={section.config.subheading || undefined} />
    </section>
  );
}

function ProductsBlock({
  section,
  query,
  moreHref,
  moreLabel,
  onAddToCart,
  onToggleWishlist,
  wishlistedIds,
}: {
  section: SectionOf<"featured_products" | "new_arrivals">;
  query: { featured?: boolean; sort: "popular" | "newest" };
  moreHref: string;
  moreLabel: string;
  onAddToCart: (p: ProductCardData) => void;
  onToggleWishlist: (p: ProductCardData) => void;
  wishlistedIds: Set<string>;
}) {
  const { data, isLoading } = useGetProductsQuery({ ...query, perPage: section.config.limit });
  if (!isLoading && !data?.items.length) return null;
  return (
    <section className="container">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3"
      >
        <div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">{section.config.heading}</h2>
          {section.config.subheading && <p className="text-muted-foreground mt-1">{section.config.subheading}</p>}
        </div>
        <Button variant="outline" asChild>
          <Link href={moreHref}>
            {moreLabel}
            <ArrowRight className="h-4 w-4 ml-2" />
          </Link>
        </Button>
      </motion.div>
      <ProductGrid
        products={data?.items ?? []}
        loading={isLoading}
        cols={4}
        onAddToCart={onAddToCart}
        onToggleWishlist={onToggleWishlist}
        wishlistedIds={wishlistedIds}
      />
    </section>
  );
}

function Promo({ section }: { section: SectionOf<"promo_banner"> }) {
  const c = section.config;
  return (
    <section className="w-full bg-gradient-to-r from-primary to-primary/70 text-white">
      <div className="container py-8 flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-left">
        <div>
          {c.badge && (
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-sm font-semibold mb-3">
              <Truck className="h-4 w-4" /> {c.badge}
            </div>
          )}
          <h3 className="text-xl md:text-2xl font-bold">{c.title}</h3>
          {c.text && <p className="text-white/80 text-sm mt-1">{c.text}</p>}
        </div>
        {c.ctaText && c.ctaHref && (
          <Button size="lg" className="bg-white text-primary hover:bg-white/90 shadow-lg min-w-[160px]" asChild>
            <Link href={c.ctaHref}>{c.ctaText}</Link>
          </Button>
        )}
      </div>
    </section>
  );
}
