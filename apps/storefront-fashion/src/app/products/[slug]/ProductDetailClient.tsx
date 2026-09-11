"use client";

import * as React from "react";
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
  MessageSquare,
  Send,
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
  Input,
  Label,
  Select,
  SelectItem,
  ProductGrid,
  ProductCardData,
  useCart,
  cn,
  formatMoney,
  toast,
} from "@ecom/storefront-base";
import "swiper/css";
import "swiper/css/thumbs";
import "swiper/css/free-mode";
import "swiper/css/navigation";

const PLACEHOLDER_IMG = (seed: string) =>
  `https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=${encodeURIComponent(
    `fashion product ${seed} studio photo e-commerce clean white background professional`,
  )}&image_size=portrait_4_3`.replace("/v1/text_to_image?", `/v1/text_to_image?cache=pdp-${seed}&`);

const COLORS = [
  { name: "Navy", value: "#1e3a8a", id: "navy" },
  { name: "Black", value: "#0f172a", id: "black" },
  { name: "White", value: "#ffffff", id: "white" },
  { name: "Gray", value: "#64748b", id: "gray" },
];

const SIZES = ["S", "M", "L", "XL", "XXL"];

const MOCK_PRODUCT = (slug: string): ProductCardData & any => ({
  id: "p-richman-navy",
  slug: slug || "richman-navy-cotton-shirt",
  title: "Richman Navy Cotton Shirt — Premium Long Sleeve",
  images: [
    PLACEHOLDER_IMG("shirt-navy-front"),
    PLACEHOLDER_IMG("shirt-navy-side"),
    PLACEHOLDER_IMG("shirt-navy-back"),
    PLACEHOLDER_IMG("shirt-navy-detail"),
    PLACEHOLDER_IMG("shirt-navy-model"),
  ],
  price: 3290,
  compareAtPrice: 3990,
  rating: 4.5,
  reviewCount: 238,
  isOnSale: true,
  discountPercent: 18,
  isNew: false,
  sku: "RCM-NS-00781",
  stockStatus: "IN_STOCK",
  shortDescription:
    "Crafted from 100% premium combed cotton for all-day comfort. Richman's signature navy shirt features a tailored slim fit, spread collar, and mother-of-pearl buttons — perfect for office, weddings and day-to-day.",
  description: `The Richman Navy Cotton Shirt is a wardrobe essential designed for the modern Bangladeshi gentleman.

## Premium Craftsmanship
- **Fabric:** 100% long-staple combed cotton (120 GSM)
- **Weave:** Oxford — breathable yet durable
- **Fit:** Tailored slim — true-to-size, size chart below
- **Collar:** Cutaway spread collar with removable stays
- **Cuffs:** Adjustable two-button barrel cuffs
- **Buttons:** Mother-of-pearl effect resin buttons
- **Stitching:** 18 SPI reinforced seams for longevity

## Why You'll Love It
✓ Soft against skin, no scratchy tags
✓ Breathable — perfect for Dhaka summers
✓ Retains shape & color after 30+ washes (tested)
✓ Versatile — tuck in for office, roll sleeves for casual
✓ Proudly made in Bangladesh with imported fabric

## Package Contents
- 1 × Richman Navy Cotton Shirt
- 1 × Richman branded storage bag
- 1 × Size & care guide booklet`,
  specifications: [
    { name: "Brand", value: "Richman" },
    { name: "SKU", value: "RCM-NS-00781" },
    { name: "Fabric", value: "100% Premium Combed Cotton" },
    { name: "Weave", value: "Oxford, 120 GSM" },
    { name: "Fit Type", value: "Tailored Slim Fit" },
    { name: "Collar Style", value: "Cutaway Spread" },
    { name: "Sleeve Length", value: "Long Sleeve" },
    { name: "Pattern", value: "Solid" },
    { name: "Care", value: "Machine wash cold, hang dry, low iron" },
    { name: "Origin", value: "Made in Bangladesh" },
    { name: "Warranty", value: "15 days against manufacturing defects" },
  ],
  reviews: [
    { id: 1, name: "Rahim Ahmed", rating: 5, date: "12 Aug 2026", verified: true, title: "Exceptional quality at this price!", body: "The fabric feels premium — way better than my other 3k+ shirts. True to size, color matches the photo perfectly. Already ordered the white one too." },
    { id: 2, name: "Fatima K.", rating: 4, date: "03 Aug 2026", verified: true, title: "Great shirt, fast delivery", body: "Bought for my brother as Eid gift — arrived in 3 days. Fit is perfect for M size. Only 4 stars because they forgot the branded bag. Customer support sent one free though!" },
    { id: 3, name: "Tanvir H.", rating: 5, date: "28 Jul 2026", verified: true, title: "Best office shirt I own", body: "I wear this to the office 2-3 times a week. Doesn't wrinkle as much as my Ecstasy ones. The navy is a really nice deep shade." },
    { id: 4, name: "Nusrat Jahan", rating: 4, date: "15 Jul 2026", verified: true, title: "Good quality overall", body: "Liked the fabric, sizing runs slightly slim — I'm normally L but XL fits me better. Returned and swapped with no hassle!" },
    { id: 5, name: "Sabbir R.", rating: 5, date: "02 Jul 2026", verified: true, title: "Highly recommended", body: "This is my 3rd Richman shirt from Fashion BD. Consistently good quality. COD was quick." },
  ],
});

const RELATED: ProductCardData[] = [
  { id: "r1", slug: "related-white-shirt", title: "Richman White Premium Cotton Shirt", image: PLACEHOLDER_IMG("rel-shirt-white"), price: 3290, compareAtPrice: 3990, rating: 4.4, reviewCount: 156, isOnSale: true, discountPercent: 18 },
  { id: "r2", slug: "related-black-panjabi", title: "Aarong Black Embroidery Panjabi", image: PLACEHOLDER_IMG("rel-panjabi-black"), price: 4290, compareAtPrice: 4990, rating: 4.7, reviewCount: 82 },
  { id: "r3", slug: "related-jeans-blue", title: "Levi's 511 Slim Fit Blue Jeans", image: PLACEHOLDER_IMG("rel-jeans-blue"), price: 5490, rating: 4.6, reviewCount: 310, isNew: true },
  { id: "r4", slug: "related-formal-shoes", title: "Bata Classic Black Formal Leather Shoes", image: PLACEHOLDER_IMG("rel-shoes-black"), price: 4590, compareAtPrice: 5290, rating: 4.5, reviewCount: 168, isOnSale: true, discountPercent: 13 },
];

type Props = {
  slug: string;
};

export default function ProductDetailClient({ slug }: Props) {
  const { addItem } = useCart();
  const product = React.useMemo(() => MOCK_PRODUCT(slug), [slug]);

  const [thumbsSwiper, setThumbsSwiper] = React.useState<any>(null);
  const [selectedSize, setSelectedSize] = React.useState<string>("M");
  const [selectedColor, setSelectedColor] = React.useState<string>("navy");
  const [qty, setQty] = React.useState(1);
  const [wishlisted, setWishlisted] = React.useState(false);
  const [reviewSort, setReviewSort] = React.useState<"latest" | "top">("latest");

  const discountPct = product.discountPercent ?? 18;

  const handleAddToCart = () => {
    const color = COLORS.find((c) => c.id === selectedColor);
    addItem({
      productId: product.id,
      variantId: `${product.id}-${selectedColor}-${selectedSize}`,
      title: product.title,
      slug: product.slug,
      image: product.images[0],
      price: product.price,
      qty,
      variantLabel: `${color?.name ?? ""} • Size ${selectedSize}`,
    });
    toast.success("Added to cart", {
      description: `${product.title.slice(0, 40)} × ${qty}`,
      action: { label: "View Cart", onClick: () => (window.location.href = "/cart") },
    });
  };

  const sortedReviews = React.useMemo(() => {
    const r = [...product.reviews];
    if (reviewSort === "top") r.sort((a: any, b: any) => b.rating - a.rating);
    return r;
  }, [product.reviews, reviewSort]);

  const averageRating = product.rating ?? 4.5;
  const ratingCounts = React.useMemo(() => {
    const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } as Record<number, number>;
    product.reviews.forEach((r: any) => {
      counts[r.rating] = (counts[r.rating] ?? 0) + 1;
    });
    return counts;
  }, [product.reviews]);

  return (
    <div className="container py-6 md:py-10">
      <nav aria-label="Breadcrumb" className="mb-6">
        <ol className="flex items-center flex-wrap gap-1 text-sm text-muted-foreground">
          <li className="flex items-center gap-1">
            <Link href="/" className="flex items-center gap-1 hover:text-foreground hover:underline transition-colors">
              <Home className="h-3.5 w-3.5" /> Home
            </Link>
          </li>
          <li className="flex items-center"><ChevronRight className="h-3 w-3 mx-1" /></li>
          <li><Link href="/categories/men" className="hover:text-foreground hover:underline">Men</Link></li>
          <li className="flex items-center"><ChevronRight className="h-3 w-3 mx-1" /></li>
          <li><Link href="/categories/men-shirts" className="hover:text-foreground hover:underline">Shirts</Link></li>
          <li className="flex items-center"><ChevronRight className="h-3 w-3 mx-1" /></li>
          <li className="text-foreground font-medium line-clamp-1 max-w-[40vw]">{product.title}</li>
        </ol>
      </nav>

      <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 mb-16">
        <div className="space-y-3">
          <div className="grid grid-cols-[80px_1fr] gap-3">
            <Swiper
              modules={[FreeMode, Navigation, Thumbs]}
              direction="vertical"
              spaceBetween={8}
              slidesPerView="auto"
              freeMode={true}
              watchSlidesProgress={true}
              onSwiper={setThumbsSwiper}
              className="!h-full !w-[80px]"
              style={{ height: "100%", minHeight: 400 }}
            >
              {product.images.map((img: string, i: number) => (
                <SwiperSlide key={i} className="!h-[80px] !w-[80px] !flex-shrink-0">
                  <div className="h-full w-full rounded-lg overflow-hidden border-2 cursor-pointer hover:border-primary transition-colors">
                    <img src={img} alt={`${product.title} view ${i + 1}`} className="h-full w-full object-cover" />
                  </div>
                </SwiperSlide>
              ))}
            </Swiper>

            <div className="relative">
              <Swiper modules={[Thumbs, Navigation]} thumbs={{ swiper: thumbsSwiper && !thumbsSwiper.destroyed ? thumbsSwiper : null }} className="aspect-[4/5] w-full rounded-2xl overflow-hidden border bg-slate-50">
                {product.images.map((img: string, i: number) => (
                  <SwiperSlide key={i}>
                    <img src={img} alt={`${product.title} — view ${i + 1}`} className="h-full w-full object-cover" />
                  </SwiperSlide>
                ))}
              </Swiper>

              {product.isOnSale && discountPct > 0 && (
                <div className="absolute top-4 left-4 flex flex-col gap-1">
                  <Badge variant="destructive" className="text-xs px-2.5 py-1">-{discountPct}% OFF</Badge>
                  {product.isNew && <Badge variant="success" className="text-xs px-2.5 py-1">NEW</Badge>}
                </div>
              )}

              <div className="absolute top-4 right-4 flex flex-col gap-1.5">
                <button
                  onClick={() => { setWishlisted(!wishlisted); toast.info(wishlisted ? "Removed from wishlist" : "Added to wishlist"); }}
                  className={cn("h-10 w-10 rounded-full shadow-lg flex items-center justify-center transition-colors", wishlisted ? "bg-red-50 text-red-500" : "bg-white hover:bg-red-50 hover:text-red-500 text-slate-600")}
                  aria-label="Wishlist"
                >
                  <Heart className={cn("h-5 w-5", wishlisted && "fill-current")} />
                </button>
                <button
                  onClick={() => toast.success("Link copied to clipboard!")}
                  className="h-10 w-10 rounded-full bg-white shadow-lg flex items-center justify-center hover:bg-accent text-slate-600"
                  aria-label="Share"
                >
                  <Share2 className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-2">
            {[
              { icon: <Truck className="h-5 w-5" />, title: "Free Delivery", desc: "On orders > ৳1000" },
              { icon: <RotateCcw className="h-5 w-5" />, title: "7-day Returns", desc: "No questions asked" },
              { icon: <ShieldCheck className="h-5 w-5" />, title: "Authentic", desc: "100% genuine products" },
            ].map((f) => (
              <div key={f.title} className="flex items-center gap-2 p-3 rounded-xl bg-card border">
                <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">{f.icon}</div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold leading-tight">{f.title}</div>
                  <div className="text-[11px] text-muted-foreground leading-tight">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col">
          <div className="flex items-start justify-between gap-3 mb-2">
            <Badge variant="secondary" className="uppercase tracking-wider text-[10px] py-1">Richman • Men's Shirt</Badge>
            <Badge variant="success" className="gap-1">
              <CheckCircle2 className="h-3 w-3" /> In Stock
            </Badge>
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
              <a href="#reviews" className="text-sm text-muted-foreground hover:underline">({product.reviewCount} reviews)</a>
            </div>
            <span className="text-slate-300">|</span>
            <span className="text-sm text-muted-foreground">SKU: <span className="font-mono text-foreground">{product.sku}</span></span>
          </div>

          <div className="flex items-baseline gap-3 mb-5 p-4 rounded-2xl bg-gradient-to-r from-primary/5 to-secondary/5 border">
            <span className="text-3xl md:text-4xl font-black text-primary">{formatMoney(product.price)}</span>
            {product.compareAtPrice && (
              <>
                <span className="text-lg text-muted-foreground line-through">{formatMoney(product.compareAtPrice)}</span>
                <Badge variant="destructive" className="text-xs px-2 py-0.5">Save ৳{product.compareAtPrice - product.price}</Badge>
              </>
            )}
            <div className="ml-auto text-right">
              <div className="text-xs text-muted-foreground">or 4 installments</div>
              <div className="text-sm font-semibold">৳{Math.round(product.price / 4)}/month • bKash Nagad</div>
            </div>
          </div>

          <p className="text-muted-foreground leading-relaxed mb-6">{product.shortDescription}</p>

          <div className="space-y-5">
            <div>
              <Label className="text-sm font-semibold mb-2.5 block">Color: <span className="font-normal text-muted-foreground capitalize">{COLORS.find((c) => c.id === selectedColor)?.name}</span></Label>
              <div className="flex items-center gap-2.5 flex-wrap">
                {COLORS.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedColor(c.id)}
                    className={cn(
                      "h-9 w-9 rounded-full flex items-center justify-center relative transition-all",
                      selectedColor === c.id && "ring-2 ring-primary ring-offset-2 scale-110",
                    )}
                    aria-label={`Color ${c.name}`}
                  >
                    <span className={cn("h-7 w-7 rounded-full border shadow-inner", c.id === "white" && "border-slate-300")} style={{ backgroundColor: c.value }} />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2.5">
                <Label className="text-sm font-semibold">Size: <span className="font-normal text-muted-foreground">{selectedSize}</span></Label>
                <a href="#size-guide" className="text-xs text-primary hover:underline">Size guide</a>
              </div>
              <div className="flex flex-wrap gap-2">
                {SIZES.map((s) => (
                  <Button
                    key={s}
                    type="button"
                    variant={selectedSize === s ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedSize(s)}
                    className={cn("h-10 min-w-[3rem] px-4", selectedSize === s ? "bg-primary text-white" : "bg-transparent")}
                  >
                    {s}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-[120px_1fr] gap-3 items-end">
              <div>
                <Label className="text-sm font-semibold mb-2 block">Quantity</Label>
                <div className="flex items-center border rounded-lg overflow-hidden">
                  <button
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    className="h-11 w-10 flex items-center justify-center hover:bg-accent transition-colors"
                    aria-label="Decrease quantity"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="h-11 min-w-[3rem] flex items-center justify-center font-semibold border-x px-2">{qty}</span>
                  <button
                    onClick={() => setQty((q) => q + 1)}
                    className="h-11 w-10 flex items-center justify-center hover:bg-accent transition-colors"
                    aria-label="Increase quantity"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                Only <span className="font-semibold text-foreground">42 pieces</span> left in stock
              </div>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <Button size="lg" className="flex-1 min-w-[220px] h-12 text-base shadow-soft" onClick={handleAddToCart}>
                <ShoppingCart className="h-5 w-5 mr-2" />
                Add to Cart — {formatMoney(product.price * qty)}
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => { setWishlisted(!wishlisted); toast.info(wishlisted ? "Removed from wishlist" : "Added to wishlist"); }}
                className={cn("h-12 min-w-[130px]", wishlisted && "bg-red-50 text-red-500 border-red-200 hover:bg-red-100")}
              >
                <Heart className={cn("h-5 w-5 mr-2", wishlisted && "fill-current")} />
                Wishlist
              </Button>
            </div>

            <div className="pt-2 text-xs text-muted-foreground space-y-1.5">
              <div className="flex items-center gap-2">
                <Truck className="h-3.5 w-3.5 text-primary" />
                Delivery inside Dhaka: 24-48hrs • Outside: 2-4 days
              </div>
              <div className="flex items-center gap-2">
                <RotateCcw className="h-3.5 w-3.5 text-primary" />
                Cash on Delivery available nationwide
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
                  Description
                </TabsTrigger>
                <TabsTrigger value="specifications" className="!rounded-none !shadow-none !bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary px-5 py-4 !h-auto text-sm font-medium text-muted-foreground data-[state=active]:text-foreground">
                  Specifications
                </TabsTrigger>
                <TabsTrigger value="reviews" className="!rounded-none !shadow-none !bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary px-5 py-4 !h-auto text-sm font-medium text-muted-foreground data-[state=active]:text-foreground" id="reviews">
                  Reviews <span className="ml-1 text-xs">({product.reviewCount})</span>
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="description" className="mt-0 p-6 md:p-8 prose prose-slate max-w-none prose-headings:font-bold prose-p:text-foreground/80 prose-li:text-foreground/80 prose-strong:text-foreground">
              <pre className="!bg-transparent !p-0 !m-0 whitespace-pre-wrap font-sans text-[15px] leading-7">{product.description}</pre>
            </TabsContent>

            <TabsContent value="specifications" className="mt-0">
              <div className="divide-y">
                {product.specifications.map((row: any) => (
                  <div key={row.name} className="grid grid-cols-[160px_1fr] md:grid-cols-[220px_1fr]">
                    <div className="px-6 md:px-8 py-3.5 bg-muted/50 text-sm font-medium text-muted-foreground">{row.name}</div>
                    <div className="px-6 md:px-8 py-3.5 text-sm">{row.value}</div>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="reviews" className="mt-0 p-6 md:p-8">
              <div className="grid lg:grid-cols-[280px_1fr] gap-8 mb-8">
                <div className="p-6 border rounded-2xl bg-card">
                  <div className="text-center">
                    <div className="text-5xl font-black mb-1">{averageRating.toFixed(1)}</div>
                    <div className="flex justify-center mb-2">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Star key={i} className={cn("h-5 w-5", i <= Math.round(averageRating) ? "text-amber-400 fill-amber-400" : "text-slate-200 fill-slate-200")} />
                      ))}
                    </div>
                    <div className="text-sm text-muted-foreground">Based on {product.reviewCount} verified reviews</div>
                  </div>
                  <div className="mt-6 space-y-2">
                    {[5, 4, 3, 2, 1].map((star) => {
                      const count = ratingCounts[star] ?? 0;
                      const pct = product.reviewCount ? (count / product.reviewCount) * 100 : 0;
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

                <Card>
                  <CardContent className="p-5 space-y-3">
                    <h4 className="font-semibold flex items-center gap-2"><MessageSquare className="h-5 w-5 text-primary" /> Write a Review</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Your Name</Label>
                        <Input placeholder="e.g. John Doe" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Your Rating</Label>
                        <Select defaultValue="5">
                          <SelectItem value="5">★★★★★ (5 stars)</SelectItem>
                          <SelectItem value="4">★★★★☆ (4 stars)</SelectItem>
                          <SelectItem value="3">★★★☆☆ (3 stars)</SelectItem>
                          <SelectItem value="2">★★☆☆☆ (2 stars)</SelectItem>
                          <SelectItem value="1">★☆☆☆☆ (1 star)</SelectItem>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Review Title</Label>
                      <Input placeholder="Summary of your experience" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Your Review</Label>
                      <textarea className="flex min-h-[96px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-y" placeholder="Share your thoughts... (minimum 20 characters)" />
                    </div>
                    <div className="flex justify-end">
                      <Button onClick={() => toast.success("Review submitted! It will appear after approval.")}>
                        <Send className="h-4 w-4 mr-2" /> Submit Review
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold">Customer Reviews ({product.reviewCount})</h4>
                <Select value={reviewSort} onValueChange={(v: string) => setReviewSort(v as any)}>
                  <SelectItem value="latest">Latest First</SelectItem>
                  <SelectItem value="top">Top Rated</SelectItem>
                </Select>
              </div>

              <div className="space-y-4">
                {sortedReviews.map((r: any) => (
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
                            {r.verified && <Badge variant="success" className="h-5 text-[10px] px-1.5"><CheckCircle2 className="h-2.5 w-2.5 mr-1" /> Verified</Badge>}
                          </div>
                          <div className="text-xs text-muted-foreground">{r.date}</div>
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

              <div className="mt-8 text-center">
                <Button variant="outline">Load More Reviews</Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <section className="mb-16">
        <div className="flex items-end justify-between mb-6 gap-3">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">You May Also Like</h2>
            <p className="text-muted-foreground mt-1">Frequently bought together</p>
          </div>
          <Button variant="ghost" asChild>
            <Link href="/products">View all <ChevronRight className="h-4 w-4 ml-1" /></Link>
          </Button>
        </div>
        <ProductGrid products={RELATED} />
      </section>
    </div>
  );
}
