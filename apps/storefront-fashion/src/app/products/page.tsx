"use client";

import * as React from "react";
import { PromoSlotStrip } from "@/app/_components/promotions";
import { useProductGridActions } from "@/app/_components/product-actions";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  SlidersHorizontal,
  Grid3X3,
  List,
  Star,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  Filter,
} from "lucide-react";
import {
  ProductGrid,
  ProductCardData,
  Button,
  Input,
  Slider,
  Checkbox,
  Select,
  SelectItem,
  Badge,
  Pagination,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
  Separator,
  ScrollArea,
  Skeleton,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  useCart,
  useGetProductsQuery,
  useGetCategoriesTreeQuery,
  useGetBrandsQuery,
  type ProductSummary,
} from "@ecom/storefront-base";
import { cn, formatMoney } from "@ecom/utils";
import { toast } from "sonner";

const SORT_OPTIONS = [
  { value: "popular", label: "Most Popular" },
  { value: "newest", label: "Newest First" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "rating", label: "Top Rated" },
] as const;

const PRICE_MAX = 20000;

function useDebounced<T>(value: T, ms = 350): T {
  const [v, setV] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export default function ProductsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { addItem } = useCart();

  const [priceRange, setPriceRange] = React.useState<number[]>([0, PRICE_MAX]);
  const [selectedCats, setSelectedCats] = React.useState<Set<string>>(new Set());
  const [selectedBrands, setSelectedBrands] = React.useState<Set<string>>(new Set());
  const [minRating, setMinRating] = React.useState<number>(0);
  const [sort, setSort] = React.useState<(typeof SORT_OPTIONS)[number]["value"]>(() => {
    const fromUrl = searchParams.get("sort");
    return SORT_OPTIONS.find((o) => o.value === fromUrl)?.value ?? "popular";
  });
  const [viewMode, setViewMode] = React.useState<"grid" | "list">("grid");
  const [search, setSearch] = React.useState(searchParams.get("search") ?? "");
  const [page, setPage] = React.useState(1);
  const [mobileFiltersOpen, setMobileFiltersOpen] = React.useState(false);

  const perPage = 16;
  const categorySlug = searchParams.get("category") ?? undefined;
  const rawTag = (searchParams.get("tag") ?? "").trim().toLowerCase();
  const tag = rawTag.length ? rawTag : undefined;
  const { onToggleWishlist, wishlistedIds } = useProductGridActions();
  const debouncedSearch = useDebounced(search.trim());
  const debouncedPrice = useDebounced(priceRange);

  const { data: categoryTree = [] } = useGetCategoriesTreeQuery();
  const { data: brands = [] } = useGetBrandsQuery();
  const { data, isFetching, isError } = useGetProductsQuery({
    page,
    perPage,
    sort,
    search: debouncedSearch || undefined,
    categoryId: selectedCats.size ? [...selectedCats].join(",") : undefined,
    categorySlug: selectedCats.size ? undefined : categorySlug,
    brandId: selectedBrands.size ? [...selectedBrands].join(",") : undefined,
    minPrice: debouncedPrice[0]! > 0 ? debouncedPrice[0] : undefined,
    maxPrice: debouncedPrice[1]! < PRICE_MAX ? debouncedPrice[1] : undefined,
    rating: minRating || undefined,
    tag,
  });

  const paged: ProductCardData[] = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const loading = isFetching && !data;

  React.useEffect(() => {
    setPage(1);
  }, [debouncedSearch, debouncedPrice, selectedCats, selectedBrands, minRating, sort]);

  const handleAddToCart = React.useCallback(
    (p: ProductCardData) => {
      if ((p as ProductSummary).hasVariants) {
        toast.info("Choose a size first", { description: p.title.slice(0, 40) });
        router.push(`/products/${p.slug}`);
        return;
      }
      addItem({ productId: p.id, variantId: undefined, title: p.title, slug: p.slug, image: p.image, price: p.price, weightKG: (p as ProductSummary).weightKG });
      toast.success("Added to cart", { description: p.title.slice(0, 40) });
    },
    [addItem, router],
  );

  const toggle = (set: Set<string>, id: string): Set<string> => {
    const next = new Set(set);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  };

  const activeFiltersCount =
    (priceRange[0] !== 0 || priceRange[1] !== PRICE_MAX ? 1 : 0) +
    selectedCats.size +
    selectedBrands.size +
    (minRating > 0 ? 1 : 0);

  const clearAll = () => {
    setPriceRange([0, PRICE_MAX]);
    setSelectedCats(new Set());
    setSelectedBrands(new Set());
    setMinRating(0);
  };

  const FiltersSidebar = (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <Filter className="h-4 w-4" /> Filters
        </h3>
        {activeFiltersCount > 0 && (
          <button onClick={clearAll} className="text-sm text-primary hover:underline flex items-center gap-1">
            <X className="h-3.5 w-3.5" /> Clear all
          </button>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-medium text-sm">Price Range (৳)</h4>
          <span className="text-xs text-muted-foreground">
            {formatMoney(priceRange[0]!)} – {formatMoney(priceRange[1]!)}
          </span>
        </div>
        <Slider value={priceRange} onValueChange={setPriceRange} min={0} max={PRICE_MAX} step={100} />
      </div>

      <Separator />

      <div>
        <h4 className="font-medium text-sm mb-3">Categories</h4>
        <ScrollArea className="max-h-56 pr-2 -mr-2">
          <div className="space-y-3">
            {categoryTree.map((cat) => (
              <div key={cat.id}>
                <label className="flex items-start gap-2 cursor-pointer">
                  <Checkbox
                    checked={selectedCats.has(cat.id)}
                    onCheckedChange={() => setSelectedCats((s) => toggle(s, cat.id))}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between text-sm">
                      <span className={cn(selectedCats.has(cat.id) && "text-primary font-medium")}>{cat.name}</span>
                      <span className="text-xs text-muted-foreground">{cat.productCount}</span>
                    </div>
                  </div>
                </label>
                {cat.children && (
                  <div className="ml-6 mt-1.5 space-y-1.5">
                    {cat.children.map((ch) => (
                      <label key={ch.id} className="flex items-center justify-between gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                        <span className="flex items-center gap-2">
                          <Checkbox
                            checked={selectedCats.has(ch.id)}
                            onCheckedChange={() => setSelectedCats((s) => toggle(s, ch.id))}
                          />
                          <span>{ch.name}</span>
                        </span>
                        <span className="text-xs">{ch.productCount}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      <Separator />

      <div>
        <h4 className="font-medium text-sm mb-3">Brands</h4>
        <ScrollArea className="max-h-56 pr-2 -mr-2">
          <div className="space-y-2">
            {brands.map((b) => (
              <label key={b.id} className="flex items-center justify-between gap-2 cursor-pointer text-sm">
                <span className="flex items-center gap-2">
                  <Checkbox
                    checked={selectedBrands.has(b.id)}
                    onCheckedChange={() => setSelectedBrands((s) => toggle(s, b.id))}
                  />
                  <span className={cn(selectedBrands.has(b.id) && "text-primary font-medium")}>{b.name}</span>
                </span>
                <span className="text-xs text-muted-foreground">{b.productCount}</span>
              </label>
            ))}
          </div>
        </ScrollArea>
      </div>

      <Separator />

      <div>
        <h4 className="font-medium text-sm mb-3">Customer Rating</h4>
        <div className="space-y-2">
          {[4, 3, 2, 1].map((r) => (
            <button
              key={r}
              onClick={() => setMinRating(minRating === r ? 0 : r)}
              className={cn(
                "w-full flex items-center justify-between gap-2 text-sm p-2 rounded-md hover:bg-accent transition-colors",
                minRating === r && "bg-primary/10 text-primary",
              )}
            >
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star
                    key={i}
                    className={cn("h-3.5 w-3.5", i <= r ? "text-amber-400 fill-amber-400" : "text-slate-200 fill-slate-200")}
                  />
                ))}
                <span className="ml-1">& up</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="container py-6 md:py-10">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-2">{tag ? `Tagged “${tag}”` : "All Products"}</h1>
        <p className="text-muted-foreground">{total > 0 ? `Browse ${total} fashion item${total === 1 ? "" : "s"}` : "Browse our catalog"}</p>
      </div>

      {categorySlug && <PromoSlotStrip slot="category_banner" categorySlug={categorySlug} className="mb-6" />}

      <div className="flex flex-col md:flex-row gap-6 md:gap-8">
        <aside className="hidden md:block w-64 lg:w-72 flex-shrink-0">
          <div className="sticky top-24">
            <div className="border rounded-xl p-5 bg-card shadow-soft">
              {FiltersSidebar}
            </div>
          </div>
        </aside>

        <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
          <SheetContent className="!left-0 !right-auto border-r w-full sm:w-80 p-6 overflow-y-auto">
            <SheetHeader className="mb-4">
              <SheetTitle>Filters</SheetTitle>
            </SheetHeader>
            {FiltersSidebar}
          </SheetContent>
        </Sheet>

        <div className="flex-1 min-w-0">
          <div className="mb-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search products..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  className="pl-10 pr-10"
                />
                {search && (
                  <button
                    onClick={() => { setSearch(""); setPage(1); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-accent"
                  >
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                )}
              </div>
              <Button variant="outline" className="md:hidden" onClick={() => setMobileFiltersOpen(true)}>
                <SlidersHorizontal className="h-4 w-4 mr-2" />
                Filters
                {activeFiltersCount > 0 && <Badge className="ml-2 px-1.5">{activeFiltersCount}</Badge>}
              </Button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 p-3 border rounded-xl bg-card">
              <div className="flex items-center gap-3 text-sm">
                <span className="text-muted-foreground">
                  {loading ? <Skeleton className="h-4 w-28 inline-block" /> : total === 0 ? "No results" : `Showing ${(page - 1) * perPage + 1}–${Math.min(page * perPage, total)} of ${total} results`}
                </span>
                {activeFiltersCount > 0 && (
                  <Badge variant="secondary" className="md:hidden">
                    {activeFiltersCount} filters
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3">
                <div className="w-[180px]">
                  <Select value={sort} onValueChange={(v) => setSort(v as any)}>
                    {SORT_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </Select>
                </div>
                <div className="hidden sm:flex items-center rounded-md border overflow-hidden">
                  <button
                    onClick={() => setViewMode("grid")}
                    className={cn("h-9 w-9 flex items-center justify-center transition-colors", viewMode === "grid" ? "bg-primary text-white" : "hover:bg-accent")}
                    aria-label="Grid view"
                  >
                    <Grid3X3 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setViewMode("list")}
                    className={cn("h-9 w-9 flex items-center justify-center transition-colors", viewMode === "list" ? "bg-primary text-white" : "hover:bg-accent")}
                    aria-label="List view"
                  >
                    <List className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {activeFiltersCount > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                {priceRange[0] !== 0 || priceRange[1] !== PRICE_MAX ? (
                  <Badge variant="secondary" className="gap-1 pr-1.5 cursor-pointer" onClick={() => setPriceRange([0, PRICE_MAX])}>
                    ৳{priceRange[0]}–{priceRange[1]} <X className="h-3 w-3" />
                  </Badge>
                ) : null}
                {minRating > 0 && (
                  <Badge variant="secondary" className="gap-1 pr-1.5 cursor-pointer" onClick={() => setMinRating(0)}>
                    ⭐ {minRating}+ <X className="h-3 w-3" />
                  </Badge>
                )}
                {Array.from(selectedCats).map((c) => {
                  const find = (arr: any[]): any =>
                    arr.find((x: any) => x.id === c) ??
                    arr.reduce((acc, x) => acc || (x.children && find(x.children)), null);
                  const match = find(categoryTree);
                  return (
                    <Badge key={c} variant="secondary" className="gap-1 pr-1.5 cursor-pointer" onClick={() => setSelectedCats((s) => toggle(s, c))}>
                      {match?.name ?? c} <X className="h-3 w-3" />
                    </Badge>
                  );
                })}
                {Array.from(selectedBrands).map((b) => {
                  const match = brands.find((x) => x.id === b);
                  return (
                    <Badge key={b} variant="secondary" className="gap-1 pr-1.5 cursor-pointer" onClick={() => setSelectedBrands((s) => toggle(s, b))}>
                      {match?.name ?? b} <X className="h-3 w-3" />
                    </Badge>
                  );
                })}
              </div>
            )}
          </div>

          {loading ? (
            <ProductGrid loading skeletonCount={perPage} />
          ) : paged.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center py-24 text-center border rounded-2xl bg-card"
            >
              <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center mb-4">
                <Search className="h-10 w-10 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-xl mb-1">{isError ? "Could not load products" : "No products found"}</h3>
              <p className="text-muted-foreground mb-6 max-w-sm">
                {isError
                  ? "The store is not reachable right now. Please try again in a moment."
                  : "Try adjusting your filters, clearing some, or searching for something else."}
              </p>
              <div className="flex gap-3">
                <Button variant="outline" onClick={clearAll}>Clear all filters</Button>
                <Button onClick={() => (window.location.href = "/products")}>Show all</Button>
              </div>
            </motion.div>
          ) : viewMode === "grid" ? (
            <ProductGrid products={paged} onAddToCart={handleAddToCart} onToggleWishlist={onToggleWishlist} wishlistedIds={wishlistedIds} />
          ) : (
            <div className="space-y-3">
              {paged.map((p) => (
                <Link
                  key={p.id}
                  href={`/products/${p.slug}`}
                  className="flex gap-4 p-3 border rounded-xl hover:shadow-hover hover:border-primary/30 transition-all group"
                >
                  <div className="h-36 w-36 flex-shrink-0 rounded-lg overflow-hidden bg-slate-100">
                    <img src={p.image} alt={p.title} className="h-full w-full object-cover group-hover:scale-105 transition-transform" />
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col">
                    <h3 className="font-semibold group-hover:text-primary transition-colors line-clamp-2">{p.title}</h3>
                    <div className="flex items-center gap-1.5 my-1 text-sm">
                      <div className="flex">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <Star key={i} className={cn("h-3.5 w-3.5", i <= Math.round(p.rating ?? 0) ? "text-amber-400 fill-amber-400" : "text-slate-200 fill-slate-200")} />
                        ))}
                      </div>
                      <span className="text-muted-foreground text-xs">({p.reviewCount})</span>
                    </div>
                    {(p as ProductSummary).shortDescription && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{(p as ProductSummary).shortDescription}</p>
                    )}
                    <div className="mt-auto flex items-center justify-between pt-2">
                      <div className="flex items-baseline gap-2">
                        <span className="font-bold text-lg">{formatMoney(p.price)}</span>
                        {p.compareAtPrice && (
                          <span className="text-sm text-muted-foreground line-through">{formatMoney(p.compareAtPrice)}</span>
                        )}
                        {p.isOnSale && p.discountPercent && (
                          <Badge variant="destructive" className="text-[10px]">-{p.discountPercent}%</Badge>
                        )}
                        {p.flashSale && (
                          <Badge variant="destructive" className="text-[10px] bg-gradient-to-r from-orange-500 to-rose-600 border-0">
                            ⚡ Flash sale
                          </Badge>
                        )}
                      </div>
                      <Button
                        size="sm"
                        onClick={(e) => { e.preventDefault(); handleAddToCart(p); }}
                      >
                        Add to Cart
                      </Button>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {!loading && total > perPage && (
            <div className="mt-10">
              <Pagination>
                <PaginationItem>
                  <PaginationPrevious onClick={() => setPage((p) => Math.max(1, p - 1))}>
                    <ChevronLeft className="h-4 w-4 mr-1" /> Prev
                  </PaginationPrevious>
                </PaginationItem>

                {Array.from({ length: totalPages }).map((_, i) => {
                  const n = i + 1;
                  const show = n === 1 || n === totalPages || Math.abs(n - page) <= 1;
                  if (!show) {
                    if (Math.abs(n - page) === 2) return <PaginationItem key={n}><PaginationEllipsis /></PaginationItem>;
                    return null;
                  }
                  return (
                    <PaginationItem key={n}>
                      <PaginationLink isActive={page === n} onClick={() => setPage(n)}>{n}</PaginationLink>
                    </PaginationItem>
                  );
                })}

                <PaginationItem>
                  <PaginationNext onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                    Next <ChevronRight className="h-4 w-4 ml-1" />
                  </PaginationNext>
                </PaginationItem>
              </Pagination>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
