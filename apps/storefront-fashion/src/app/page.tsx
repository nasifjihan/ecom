"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, ShoppingBag, Truck, Shield, CreditCard, Instagram } from "lucide-react";
import {
  HeroSlider,
  FeaturedCategories,
  ProductGrid,
  Button,
  ProductCardData,
  useCart,
} from "@ecom/storefront-base";
import { toast } from "sonner";
import { slugify } from "@ecom/utils";

const PLACEHOLDER_IMG = (seed: string, w = 600, h = 750) =>
  `https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=${encodeURIComponent(
    `fashion product ${seed} studio photo e-commerce clean white background professional`,
  )}&image_size=portrait_4_3`.replace("/v1/text_to_image?", `/v1/text_to_image?cache=${seed}&`);

const mockCategoryImg = (seed: string) =>
  PLACEHOLDER_IMG(`${seed} category`, 400, 400);

const FEATURED_PRODUCTS: ProductCardData[] = [
  { id: "p1", slug: "richman-navy-cotton-shirt", title: "Richman Navy Cotton Shirt", image: PLACEHOLDER_IMG("shirt-navy-1"), price: 3290, compareAtPrice: 3990, rating: 4.5, reviewCount: 128, isNew: true },
  { id: "p2", slug: "elegance-floral-maxi-dress", title: "Elegance Floral Maxi Dress — Summer Edition", image: PLACEHOLDER_IMG("dress-floral-1"), price: 4890, compareAtPrice: 5990, rating: 4.7, reviewCount: 89, isOnSale: true, discountPercent: 18 },
  { id: "p3", slug: "leatherite-casual-sneakers", title: "Leatherite Casual Sneakers White", image: PLACEHOLDER_IMG("sneakers-white-1"), price: 3490, compareAtPrice: null, rating: 4.3, reviewCount: 210 },
  { id: "p4", slug: "luxury-leather-handbag", title: "Luxury Premium Leather Handbag Tan", image: PLACEHOLDER_IMG("handbag-tan-1"), price: 5790, compareAtPrice: 6990, rating: 4.8, reviewCount: 56, isOnSale: true, discountPercent: 17 },
  { id: "p5", slug: "trendy-kids-casual-tshirt", title: "Trendy Kids Casual T-Shirt Set", image: PLACEHOLDER_IMG("kids-tee-1"), price: 1490, compareAtPrice: 1890, rating: 4.4, reviewCount: 145 },
  { id: "p6", slug: "classic-leather-wallet", title: "Classic Genuine Leather Wallet Brown", image: PLACEHOLDER_IMG("wallet-brown-1"), price: 2490, compareAtPrice: null, rating: 4.6, reviewCount: 78 },
  { id: "p7", slug: "casio-gold-stainless-watch", title: "Casio Gold Stainless Steel Watch", image: PLACEHOLDER_IMG("watch-gold-1"), price: 8990, compareAtPrice: 10990, rating: 4.9, reviewCount: 201, isNew: true },
  { id: "p8", slug: "summer-vibes-perfume", title: "Summer Vibes EDT Perfume 100ml", image: PLACEHOLDER_IMG("perfume-1"), price: 3790, compareAtPrice: 4490, rating: 4.2, reviewCount: 67 },
  { id: "p9", slug: "aarong-premium-panjabi", title: "Aarong Premium Cotton Panjabi White", image: PLACEHOLDER_IMG("panjabi-white-1"), price: 4290, compareAtPrice: 4990, rating: 4.6, reviewCount: 92 },
  { id: "p10", slug: "denim-slim-fit-jeans", title: "Levi's Slim Fit Denim Jeans Blue", image: PLACEHOLDER_IMG("jeans-blue-1"), price: 5490, compareAtPrice: null, rating: 4.5, reviewCount: 310 },
  { id: "p11", slug: "winter-knit-sweater", title: "Winter Cozy Knit Sweater Gray", image: PLACEHOLDER_IMG("sweater-gray-1"), price: 3990, compareAtPrice: 4790, rating: 4.4, reviewCount: 44, isOnSale: true, discountPercent: 17 },
  { id: "p12", slug: "office-formal-shoes", title: "Bata Office Formal Leather Shoes Black", image: PLACEHOLDER_IMG("shoes-black-1"), price: 4590, compareAtPrice: 5290, rating: 4.5, reviewCount: 168 },
];

const NEW_ARRIVALS: ProductCardData[] = FEATURED_PRODUCTS.slice(4, 12);

export default function HomePage() {
  const { addItem } = useCart();
  const [wishlisted, setWishlisted] = React.useState<Set<string>>(new Set());

  const handleAddToCart = React.useCallback(
    (p: ProductCardData) => {
      addItem({
        productId: p.id,
        variantId: undefined,
        title: p.title,
        slug: p.slug,
        image: p.image,
        price: p.price,
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
    [addItem],
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

  const sectionCats = [
    { id: "c1", slug: "women-dresses", name: "Women Dresses", image: mockCategoryImg("women-dresses"), productCount: 420, color: "from-pink-400 to-rose-500" },
    { id: "c2", slug: "men-shirts", name: "Men Shirts", image: mockCategoryImg("men-shirts"), productCount: 310, color: "from-blue-400 to-indigo-500" },
    { id: "c3", slug: "kids", name: "Kids", image: mockCategoryImg("kids"), productCount: 180, color: "from-amber-400 to-orange-500" },
    { id: "c4", slug: "accessories", name: "Accessories", image: mockCategoryImg("accessories"), productCount: 260, color: "from-emerald-400 to-teal-500" },
    { id: "c5", slug: "shoes", name: "Shoes", image: mockCategoryImg("shoes"), productCount: 340, color: "from-violet-400 to-purple-500" },
    { id: "c6", slug: "bags", name: "Bags", image: mockCategoryImg("bags"), productCount: 190, color: "from-cyan-400 to-sky-500" },
    { id: "c7", slug: "watches", name: "Watches", image: mockCategoryImg("watches"), productCount: 150, color: "from-slate-400 to-slate-600" },
    { id: "c8", slug: "perfumes", name: "Perfumes", image: mockCategoryImg("perfumes"), productCount: 120, color: "from-fuchsia-400 to-pink-500" },
  ];

  const featureItems = [
    { icon: <Truck className="h-6 w-6 text-primary" />, title: "Free Delivery", desc: "On orders above ৳1000 inside Bangladesh" },
    { icon: <Shield className="h-6 w-6 text-primary" />, title: "Easy Returns", desc: "7-day no-questions-asked return policy" },
    { icon: <CreditCard className="h-6 w-6 text-primary" />, title: "Secure Payment", desc: "bKash, Nagad, Rocket, SSL, Visa — all secure" },
    { icon: <ShoppingBag className="h-6 w-6 text-primary" />, title: "Authentic Brands", desc: "100% genuine products from authorized brands" },
  ];

  const instagramPosts = Array.from({ length: 6 }).map((_, i) => ({
    id: `ig-${i}`,
    url: mockCategoryImg(`fashion-ig-${i}`),
    likes: 200 + Math.floor(Math.random() * 900),
  }));

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
              ctaHref: "/categories/women",
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
              ctaHref: "/categories/men",
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
        <FeaturedCategories categories={sectionCats} heading="Shop by Category" subheading="Find exactly what you need from our curated collections" />
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
          products={FEATURED_PRODUCTS}
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
          products={NEW_ARRIVALS}
          cols={4}
          onAddToCart={handleAddToCart}
          onToggleWishlist={toggleWishlist}
          wishlistedIds={wishlisted}
        />
      </section>

      <section className="container">
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center justify-center gap-2">
            <Instagram className="h-7 w-7 text-pink-500" /> @FashionBD
          </h2>
          <p className="text-muted-foreground mt-1">Tag us with #FashionBD and get featured!</p>
        </div>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2 md:gap-3">
          {instagramPosts.map((p) => (
            <motion.a
              key={p.id}
              href="#"
              whileHover={{ y: -4, scale: 1.03 }}
              className="relative block aspect-square overflow-hidden rounded-xl group"
            >
              <img src={p.url} alt="Fashion BD Instagram post" className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-500" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-sm font-semibold">❤️ {p.likes}</span>
              </div>
            </motion.a>
          ))}
        </div>
      </section>
    </div>
  );
}
