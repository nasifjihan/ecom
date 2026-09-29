"use client";

import * as React from "react";
import { PromoSlotStrip } from "@/app/_components/promotions";
import { useWishlist } from "@/lib/engagement";
import { BulkPrices, bulkUnitPrice } from "./bulk-prices";
import { tiersForOption, useProductBulkPrices } from "@/lib/wholesale";
import { QuestionsSection, ReviewForm } from "./engagement-sections";
import Link from "next/link";
import { Swiper, SwiperSlide } from "swiper/react";
import { Thumbs, FreeMode, Navigation } from "swiper/modules";
import { motion } from "framer-motion";
import {
  ChevronRight,
  Home,
  Minus,
  Plus,
  Heart,
  ShoppingCart,
  Share2,
  ShieldCheck,
  Truck,
  RotateCcw,
  Star,
  CheckCircle2,
  Zap,
} from "lucide-react";
import {
  Card,
  CardContent,
  Button,
  Badge,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Label,
  Select,
  SelectItem,
  ProductGrid,
  ProductCardData,
  Skeleton,
  useCart,
  useT,
  msg,
  useGetProductBySlugQuery,
  useGetProductsQuery,
  type ProductDetail,
  cn,
  formatMoney,
  toast,
} from "@ecom/storefront-base";
import "swiper/css";
import "swiper/css/thumbs";
import "swiper/css/free-mode";
import "swiper/css/navigation";

const COLOR_SWATCHES: Record<string, string> = {
  navy: "#1e3a8a", black: "#0f172a", white: "#ffffff", gray: "#64748b", grey: "#64748b", red: "#dc2626",
  blue: "#2563eb", green: "#16a34a", rose: "#f43f5e", pink: "#ec4899", sky: "#38bdf8", beige: "#e7d7b8",
  maroon: "#7f1d1d", tan: "#d2b48c", brown: "#78350f", yellow: "#facc15",
};

function swatch(color: string): string {
  return COLOR_SWATCHES[color.toLowerCase()] ?? "#cbd5e1";
}

/** Flash-sale strip with a live countdown. Rendered after mount so server and browser clocks can't disagree. */
function FlashSaleStrip({ sale }: { sale: NonNullable<ProductDetail["flashSale"]> }) {
  const [now, setNow] = React.useState<number | null>(null);
  const t = useT();
  React.useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const left = now === null ? null : Math.max(0, new Date(sale.endsAt).getTime() - now);
  const pad = (n: number) => String(n).padStart(2, "0");
  const parts =
    left === null
      ? null
      : {
          d: Math.floor(left / 86_400_000),
          h: Math.floor(left / 3_600_000) % 24,
          m: Math.floor(left / 60_000) % 60,
          s: Math.floor(left / 1000) % 60,
        };
  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl bg-gradient-to-r from-orange-500 via-rose-500 to-pink-600 px-4 py-2.5 text-white shadow-sm">
      <span className="flex items-center gap-1.5 font-bold tracking-wide">
        <Zap className="h-4 w-4 fill-current" /> {sale.name}
      </span>
      {left === 0 ? (
        <span className="text-sm font-medium">{t("This sale has ended")}</span>
      ) : (
        <span className="flex items-center gap-1.5 text-sm" aria-live="off">
          {t("Ends in")}
          <span className="font-mono font-bold tabular-nums">
            {parts ? `${parts.d > 0 ? `${parts.d}d ` : ""}${pad(parts.h)}:${pad(parts.m)}:${pad(parts.s)}` : "--:--:--"}
          </span>
        </span>
      )}
      {sale.remaining !== null && left !== 0 && (
        <span className="ml-auto text-xs font-semibold rounded-full bg-white/20 px-2 py-0.5">
          {t("Only {n} left at this price", { n: sale.remaining })}
        </span>
      )}
    </div>
  );
}

function formatReviewDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

type Props = {
  slug: string;
};

export default function ProductDetailClient({ slug }: Props) {
  const { data: product, isLoading, isError } = useGetProductBySlugQuery(slug);
  const { data: related } = useGetProductsQuery(
    { categoryId: product?.categoryId, excludeId: product?.id, perPage: 4, sort: "popular" },
    { skip: !product?.categoryId },
  );
  const t = useT();

  if (isLoading) {
    return (
      <div className="container py-10 grid lg:grid-cols-2 gap-8">
        <Skeleton className="aspect-[4/5] w-full rounded-2xl" />
        <div className="space-y-4">
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    );
  }
  if (isError || !product) {
    return (
      <div className="container py-24 text-center">
        <h1 className="text-2xl font-bold mb-2">{t("Product not found")}</h1>
        <p className="text-muted-foreground mb-6">{t("This product may have been removed or is no longer available.")}</p>
        <Button asChild>
          <Link href="/products">{t("Browse all products")}</Link>
        </Button>
      </div>
    );
  }
  return <ProductDetailView product={product} related={related?.items ?? []} />;
}

function ProductDetailView({ product, related }: { product: ProductDetail; related: ProductCardData[] }) {
  const { addItem } = useCart();
  const t = useT();

  const [thumbsSwiper, setThumbsSwiper] = React.useState<any>(null);
  const [qty, setQty] = React.useState(1);
  const wishlist = useWishlist();
  const wishlisted = wishlist.has(product.id);
  const toggleWishlist = () => void wishlist.toggle(product.id, product.title);
  const [reviewSort, setReviewSort] = React.useState<"latest" | "top">("latest");

  // Option axes (e.g. size, color) derived from the variants' attribute values.
  const optionAxes = React.useMemo(() => {
    const axes = new Map<string, string[]>();
    for (const v of product.variants) {
      for (const [k, val] of Object.entries(v.attributes)) {
        const list = axes.get(k) ?? [];
        if (!list.includes(val)) list.push(val);
        axes.set(k, list);
      }
    }
    return [...axes.entries()];
  }, [product.variants]);

  const [selected, setSelected] = React.useState<Record<string, string>>(() => {
    const first = product.variants.find((v) => v.inStock) ?? product.variants[0];
    return first ? { ...first.attributes } : {};
  });

  const selectedVariant = React.useMemo(
    () =>
      product.variants.find((v) => optionAxes.every(([axis]) => v.attributes[axis] === selected[axis])) ?? null,
    [product.variants, optionAxes, selected],
  );

  const hasVariants = product.variants.length > 0;
  const listPrice = selectedVariant?.price ?? product.price;
  // Bulk prices depend on the shopper (business accounts see theirs), so they load in the browser.
  const { data: bulk } = useProductBulkPrices(product.id);
  const bulkTiers = tiersForOption(bulk, selectedVariant?.id);
  const price = bulkUnitPrice(listPrice, bulkTiers, qty);
  const listCompareAt = selectedVariant ? selectedVariant.compareAtPrice ?? null : product.compareAtPrice ?? null;
  const compareAtPrice = price < listPrice ? listCompareAt ?? listPrice : listCompareAt;
  const flashSale = (hasVariants ? selectedVariant?.flashSale : product.flashSale) ?? null;
  const stockLeft = hasVariants ? selectedVariant?.stockQty ?? null : product.stockQty;
  const inStock = hasVariants ? Boolean(selectedVariant?.inStock) : !product.isOutOfStock;
  const images = product.images.length ? product.images : [product.image].filter(Boolean);
  const discountPct = compareAtPrice ? Math.round(((compareAtPrice - price) / compareAtPrice) * 100) : 0;
  // A flash sale with a stock limit only sells that many at the sale price.
  // Bulk buyers may need more than the usual 99.
  const cap = bulkTiers.length ? 9999 : 99;
  const maxQty = Math.min(stockLeft ?? cap, flashSale?.remaining ?? cap);

  const handleAddToCart = () => {
    if (hasVariants && !selectedVariant) {
      toast.error(t("Choose an option"), { description: t("Please pick a size/colour that is available") });
      return;
    }
    if (!inStock) {
      toast.error(t("Out of stock"));
      return;
    }
    addItem({
      productId: product.id,
      variantId: selectedVariant?.id,
      title: product.title,
      slug: product.slug,
      image: selectedVariant?.image ?? images[0] ?? "",
      price,
      compareAtPrice,
      flashSale: flashSale ? { name: flashSale.name, endsAt: flashSale.endsAt } : null,
      qty,
      weightKG: product.weightKG,
      variantLabel: selectedVariant?.label,
    });
    toast.success(t("Added to cart"), {
      description: `${product.title.slice(0, 40)} × ${qty}`,
      action: { label: t("View Cart"), onClick: () => (window.location.href = "/cart") },
    });
  };

  const sortedReviews = React.useMemo(() => {
    const r = [...product.reviews];
    if (reviewSort === "top") r.sort((a, b) => b.rating - a.rating);
    return r;
  }, [product.reviews, reviewSort]);

  const averageRating = product.rating ?? 0;
  const ratingCounts = React.useMemo(() => {
    const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } as Record<number, number>;
    product.reviews.forEach((r) => {
      counts[r.rating] = (counts[r.rating] ?? 0) + 1;
    });
    return counts;
  }, [product.reviews]);

  return (
    <div className="container py-6 md:py-10">
      <nav aria-label={t("Breadcrumb")} className="mb-6">
        <ol className="flex items-center flex-wrap gap-1 text-sm text-muted-foreground">
          <li className="flex items-center gap-1">
            <Link href="/" className="flex items-center gap-1 hover:text-foreground hover:underline transition-colors">
              <Home className="h-3.5 w-3.5" /> {t("Home")}
            </Link>
          </li>
          <li className="flex items-center"><ChevronRight className="h-3 w-3 mx-1" /></li>
          {product.breadcrumbs.map((c) => (
            <React.Fragment key={c.id}>
              <li><Link href={`/products?category=${c.slug}`} className="hover:text-foreground hover:underline">{c.name}</Link></li>
              <li className="flex items-center"><ChevronRight className="h-3 w-3 mx-1" /></li>
            </React.Fragment>
          ))}
          <li className="text-foreground font-medium line-clamp-1 max-w-[40vw]">{product.title}</li>
        </ol>
      </nav>

      <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 mb-16">
        <div className="space-y-3">
          {/* minmax(0,1fr) + fixed thumb height: Swiper measures its parent, so an auto-sized
              grid track lets it grow without bound (33M px pages). */}
          <div className="grid grid-cols-[80px_minmax(0,1fr)] gap-3">
            <Swiper
              modules={[FreeMode, Navigation, Thumbs]}
              direction="vertical"
              spaceBetween={8}
              slidesPerView="auto"
              freeMode={true}
              watchSlidesProgress={true}
              onSwiper={setThumbsSwiper}
              className="!w-[80px] h-[400px] md:h-[520px]"
            >
              {images.map((img: string, i: number) => (
                <SwiperSlide key={i} className="!h-[80px] !w-[80px] !flex-shrink-0">
                  <div className="h-full w-full rounded-lg overflow-hidden border-2 cursor-pointer hover:border-primary transition-colors">
                    <img src={img} alt={`${product.title} view ${i + 1}`} className="h-full w-full object-cover" />
                  </div>
                </SwiperSlide>
              ))}
            </Swiper>

            <div className="relative min-w-0">
              <Swiper modules={[Thumbs, Navigation]} thumbs={{ swiper: thumbsSwiper && !thumbsSwiper.destroyed ? thumbsSwiper : null }} className="aspect-[4/5] w-full rounded-2xl overflow-hidden border bg-slate-50">
                {images.map((img: string, i: number) => (
                  <SwiperSlide key={i}>
                    <img src={img} alt={t("{title} — view {n}", { title: product.title, n: i + 1 })} className="h-full w-full object-cover" />
                  </SwiperSlide>
                ))}
              </Swiper>

              {discountPct > 0 && (
                <div className="absolute top-4 left-4 flex flex-col gap-1">
                  <Badge variant="destructive" className="text-xs px-2.5 py-1">{t("-{n}% OFF", { n: discountPct })}</Badge>
                  {product.isNew && <Badge variant="success" className="text-xs px-2.5 py-1">{t("NEW")}</Badge>}
                </div>
              )}

              <div className="absolute top-4 right-4 flex flex-col gap-1.5">
                <button
                  onClick={toggleWishlist}
                  aria-pressed={wishlisted}
                  className={cn("h-10 w-10 rounded-full shadow-lg flex items-center justify-center transition-colors", wishlisted ? "bg-red-50 text-red-500" : "bg-white hover:bg-red-50 hover:text-red-500 text-slate-600")}
                  aria-label={t("Wishlist")}
                >
                  <Heart className={cn("h-5 w-5", wishlisted && "fill-current")} />
                </button>
                <button
                  onClick={() => toast.success(t("Link copied to clipboard!"))}
                  className="h-10 w-10 rounded-full bg-white shadow-lg flex items-center justify-center hover:bg-accent text-slate-600"
                  aria-label={t("Share")}
                >
                  <Share2 className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-2">
            {[
              { icon: <Truck className="h-5 w-5" />, title: msg("Free Delivery"), desc: msg("On orders > ৳1000") },
              { icon: <RotateCcw className="h-5 w-5" />, title: msg("7-day Returns"), desc: msg("No questions asked") },
              { icon: <ShieldCheck className="h-5 w-5" />, title: msg("Authentic"), desc: msg("100% genuine products") },
            ].map((f) => (
              <div key={f.title} className="flex items-center gap-2 p-3 rounded-xl bg-card border">
                <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">{f.icon}</div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold leading-tight">{t(f.title)}</div>
                  <div className="text-[11px] text-muted-foreground leading-tight">{t(f.desc)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col">
          <div className="flex items-start justify-between gap-3 mb-2">
            <Badge variant="secondary" className="uppercase tracking-wider text-[10px] py-1">
              {[product.brand?.name, product.category?.name].filter(Boolean).join(" • ") || "Fashion BD"}
            </Badge>
            {inStock ? (
              <Badge variant="success" className="gap-1">
                <CheckCircle2 className="h-3 w-3" /> {t("In Stock")}
              </Badge>
            ) : (
              <Badge variant="destructive">{t("Out of Stock")}</Badge>
            )}
          </div>

          <h1 className="text-2xl md:text-3xl font-bold leading-tight tracking-tight mb-3">{product.title}</h1>

          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <div className="flex items-center gap-1.5">
              <div className="flex">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star key={i} className={cn("h-4 w-4", i <= Math.round(averageRating) ? "text-amber-400 fill-amber-400" : "text-slate-200 fill-slate-200")} />
                ))}
              </div>
              <span className="text-sm font-semibold">{averageRating.toFixed(1)}</span>
              <a href="#reviews" className="text-sm text-muted-foreground hover:underline">({t("{n} reviews", { n: product.reviewCount })})</a>
            </div>
            <span className="text-slate-300">|</span>
            <span className="text-sm text-muted-foreground">{t("SKU:")} <span className="font-mono text-foreground">{selectedVariant?.sku ?? product.sku ?? "—"}</span></span>
          </div>

          {flashSale && <FlashSaleStrip sale={flashSale} />}
          <PromoSlotStrip slot="product_detail" productId={product.id} className="mb-4" />
          <div className="flex flex-wrap items-baseline gap-3 mb-5 p-4 rounded-2xl bg-gradient-to-r from-primary/5 to-secondary/5 border">
            <span className="text-3xl md:text-4xl font-black text-primary">{formatMoney(price)}</span>
            {compareAtPrice && (
              <>
                <span className="text-lg text-muted-foreground line-through">{formatMoney(compareAtPrice)}</span>
                <Badge variant="destructive" className="text-xs px-2 py-0.5">{t("Save {amount}", { amount: formatMoney(compareAtPrice - price) })}</Badge>
              </>
            )}
            <div className="ml-auto text-right">
              <div className="text-xs text-muted-foreground">{t("or 4 installments")}</div>
              <div className="text-sm font-semibold">{t("৳{amount}/month • bKash Nagad", { amount: Math.round(price / 4) })}</div>
            </div>
          </div>
          {bulk && <BulkPrices data={bulk} tiers={bulkTiers} listPrice={listPrice} qty={qty} onPick={(n) => setQty(Math.min(maxQty, n))} />}

          {product.shortDescription && <p className="text-muted-foreground leading-relaxed mb-6">{product.shortDescription}</p>}

          <div className="space-y-5">
            {optionAxes.map(([axis, values]) => (
              <div key={axis}>
                <Label className="text-sm font-semibold mb-2.5 block capitalize">
                  {t(axis)}: <span className="font-normal text-muted-foreground">{selected[axis] ?? "—"}</span>
                </Label>
                <div className="flex items-center gap-2.5 flex-wrap">
                  {values.map((val) => {
                    const candidate = { ...selected, [axis]: val };
                    const match = product.variants.find((v) =>
                      optionAxes.every(([a]) => v.attributes[a] === candidate[a]),
                    );
                    const disabled = !match || !match.inStock;
                    const isSelected = selected[axis] === val;
                    return axis.toLowerCase() === "color" ? (
                      <button
                        key={val}
                        onClick={() => setSelected(candidate)}
                        className={cn(
                          "h-9 w-9 rounded-full flex items-center justify-center relative transition-all",
                          isSelected && "ring-2 ring-primary ring-offset-2 scale-110",
                          disabled && "opacity-40",
                        )}
                        aria-label={t("Color {name}", { name: val })}
                        title={val}
                      >
                        <span className="h-7 w-7 rounded-full border shadow-inner" style={{ backgroundColor: swatch(val) }} />
                      </button>
                    ) : (
                      <Button
                        key={val}
                        type="button"
                        variant={isSelected ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelected(candidate)}
                        className={cn("h-10 min-w-[3rem] px-4", isSelected ? "bg-primary text-white" : "bg-transparent", disabled && "opacity-40 line-through")}
                      >
                        {val}
                      </Button>
                    );
                  })}
                </div>
              </div>
            ))}

            <div className="grid grid-cols-[120px_1fr] gap-3 items-end">
              <div>
                <Label className="text-sm font-semibold mb-2 block">{t("Quantity")}</Label>
                <div className="flex items-center border rounded-lg overflow-hidden">
                  <button
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    className="h-11 w-10 flex items-center justify-center hover:bg-accent transition-colors"
                    aria-label={t("Decrease quantity")}
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="h-11 min-w-[3rem] flex items-center justify-center font-semibold border-x px-2">{qty}</span>
                  <button
                    onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
                    className="h-11 w-10 flex items-center justify-center hover:bg-accent transition-colors"
                    aria-label={t("Increase quantity")}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                {!inStock ? (
                  <span className="text-destructive font-medium">{t("Currently out of stock")}</span>
                ) : stockLeft !== null && stockLeft <= (product.lowStockThreshold ?? 5) ? (
                  <span className="font-medium text-amber-600">{t("Hurry, only {n} left", { n: stockLeft })}</span>
                ) : null}
                {(product.saleCount ?? 0) >= 10 && (
                  <span className="ml-2 before:mr-2 before:content-['·'] first:ml-0 first:before:content-none">{t("{n}+ sold", { n: product.saleCount ?? 0 })}</span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <Button size="lg" className="flex-1 min-w-[220px] h-12 text-base shadow-soft" onClick={handleAddToCart} disabled={!inStock}>
                <ShoppingCart className="h-5 w-5 mr-2" />
                {inStock ? `${t("Add to Cart")} — ${formatMoney(price * qty)}` : t("Out of Stock")}
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={toggleWishlist}
                  aria-pressed={wishlisted}
                className={cn("h-12 min-w-[130px]", wishlisted && "bg-red-50 text-red-500 border-red-200 hover:bg-red-100")}
              >
                <Heart className={cn("h-5 w-5 mr-2", wishlisted && "fill-current")} />
                {t("Wishlist")}
              </Button>
            </div>

            {!!product.tags?.length && (
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-muted-foreground">{t("Tags:")}</span>
                {product.tags.map((tag) => (
                  <Link key={tag} href={`/products?tag=${encodeURIComponent(tag)}`} className="rounded-full border px-2 py-0.5 hover:border-primary hover:text-primary">
                    {tag}
                  </Link>
                ))}
              </div>
            )}

            <div className="pt-2 text-xs text-muted-foreground space-y-1.5">
              <div className="flex items-center gap-2">
                <Truck className="h-3.5 w-3.5 text-primary" />
                {t("Delivery inside Dhaka: 24-48hrs • Outside: 2-4 days")}
              </div>
              <div className="flex items-center gap-2">
                <RotateCcw className="h-3.5 w-3.5 text-primary" />
                {t("Cash on Delivery available nationwide")}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Card className="mb-12">
        <CardContent className="p-0">
          <Tabs defaultValue="description" className="w-full">
            <div className="border-b px-4 overflow-x-auto">
              <TabsList className="!bg-transparent !p-0 h-auto">
                <TabsTrigger value="description" className="!rounded-none !shadow-none !bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary px-5 py-4 !h-auto text-sm font-medium text-muted-foreground data-[state=active]:text-foreground">
                  {t("Description")}
                </TabsTrigger>
                <TabsTrigger value="specifications" className="!rounded-none !shadow-none !bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary px-5 py-4 !h-auto text-sm font-medium text-muted-foreground data-[state=active]:text-foreground">
                  {t("Specifications")}
                </TabsTrigger>
                <TabsTrigger value="reviews" className="!rounded-none !shadow-none !bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary px-5 py-4 !h-auto text-sm font-medium text-muted-foreground data-[state=active]:text-foreground" id="reviews">
                  {t("Reviews")} <span className="ml-1 text-xs">({product.reviewCount})</span>
                </TabsTrigger>
                <TabsTrigger value="questions" className="!rounded-none !shadow-none !bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary px-5 py-4 !h-auto text-sm font-medium text-muted-foreground data-[state=active]:text-foreground">
                  {t("Questions")} <span className="ml-1 text-xs">({product.questions?.length ?? 0})</span>
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="description" className="mt-0 p-6 md:p-8 prose prose-slate max-w-none prose-headings:font-bold prose-p:text-foreground/80 prose-li:text-foreground/80 prose-strong:text-foreground">
              <pre className="!bg-transparent !p-0 !m-0 whitespace-pre-wrap font-sans text-[15px] leading-7">{product.description ?? product.shortDescription ?? t("No description yet.")}</pre>
            </TabsContent>

            <TabsContent value="specifications" className="mt-0">
              <div className="divide-y">
                {product.specifications.map((row, i) => (
                  <React.Fragment key={`${row.group ?? ""}-${row.name}-${i}`}>
                  {row.group && row.group !== product.specifications[i - 1]?.group && (
                    <div className="px-6 md:px-8 pt-5 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{row.group}</div>
                  )}
                  <div className="grid grid-cols-[160px_1fr] md:grid-cols-[220px_1fr]">
                    <div className="px-6 md:px-8 py-3.5 bg-muted/50 text-sm font-medium text-muted-foreground">{t(row.name)}</div>
                    <div className="px-6 md:px-8 py-3.5 text-sm">{row.value}</div>
                  </div>
                  </React.Fragment>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="reviews" className="mt-0 p-6 md:p-8">
              <div className="mb-8 max-w-sm">
                <div className="p-6 border rounded-2xl bg-card">
                  <div className="text-center">
                    <div className="text-5xl font-black mb-1">{averageRating.toFixed(1)}</div>
                    <div className="flex justify-center mb-2">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Star key={i} className={cn("h-5 w-5", i <= Math.round(averageRating) ? "text-amber-400 fill-amber-400" : "text-slate-200 fill-slate-200")} />
                      ))}
                    </div>
                    <div className="text-sm text-muted-foreground">{t("Based on {n} reviews", { n: product.reviewCount })}</div>
                  </div>
                  <div className="mt-6 space-y-2">
                    {[5, 4, 3, 2, 1].map((star) => {
                      const count = ratingCounts[star] ?? 0;
                      const pct = product.reviews.length ? (count / product.reviews.length) * 100 : 0;
                      return (
                        <div key={star} className="flex items-center gap-3">
                          <div className="flex items-center gap-1 w-14 text-xs text-muted-foreground">{star} <Star className="h-3 w-3 text-amber-400 fill-amber-400" /></div>
                          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-amber-400" style={{ width: `${pct}%` }} />
                          </div>
                          <div className="text-xs text-muted-foreground w-8 text-right">{count}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>

              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold">{t("Customer Reviews ({n})", { n: product.reviewCount })}</h4>
                <Select value={reviewSort} onValueChange={(v: string) => setReviewSort(v as any)}>
                  <SelectItem value="latest">{t("Latest First")}</SelectItem>
                  <SelectItem value="top">{t("Top Rated")}</SelectItem>
                </Select>
              </div>

              <div className="space-y-4">
                {sortedReviews.length === 0 && (
                  <p className="text-sm text-muted-foreground">{t("No reviews yet. Be the first to review this product.")}</p>
                )}
                {sortedReviews.map((r) => (
                  <motion.div
                    key={r.id}
                    initial={{ opacity: 0, y: 4 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="p-5 border rounded-xl hover:shadow-soft transition-shadow"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 text-primary font-semibold flex items-center justify-center flex-shrink-0">
                          {r.name.split(" ").map((n: string) => n[0]).slice(0, 2).join("")}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{r.name}</span>
                            {r.verified && <Badge variant="success" className="h-5 text-[10px] px-1.5"><CheckCircle2 className="h-2.5 w-2.5 mr-1" /> {t("Verified")}</Badge>}
                          </div>
                          <div className="text-xs text-muted-foreground">{formatReviewDate(r.date)}</div>
                        </div>
                      </div>
                      <div className="flex items-center">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <Star key={i} className={cn("h-3.5 w-3.5", i <= r.rating ? "text-amber-400 fill-amber-400" : "text-slate-200 fill-slate-200")} />
                        ))}
                      </div>
                    </div>
                    <h5 className="font-semibold text-sm mb-1">{r.title}</h5>
                    <p className="text-sm text-muted-foreground leading-relaxed">{r.body}</p>
                  </motion.div>
                ))}
              </div>

              <div className="mt-8">
                <ReviewForm productId={product.id} slug={product.slug} allowReviews={product.allowReviews !== false} />
              </div>
            </TabsContent>

            <TabsContent value="questions" className="mt-0 p-6 md:p-8">
              <QuestionsSection productId={product.id} questions={product.questions ?? []} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {related.length > 0 && (
      <section className="mb-16">
        <div className="flex items-end justify-between mb-6 gap-3">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">{t("You May Also Like")}</h2>
            <p className="text-muted-foreground mt-1">{t("More from {name}", { name: product.category?.name ?? t("this category") })}</p>
          </div>
          <Button variant="ghost" asChild>
            <Link href="/products">{t("View all")} <ChevronRight className="h-4 w-4 ml-1" /></Link>
          </Button>
        </div>
        <ProductGrid products={related} />
      </section>
      )}
    </div>
  );
}
