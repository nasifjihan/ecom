"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useForm, FormProvider, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { formatMoney } from "@ecom/utils";
import Link from "next/link";
import { ArrowLeft, Save, Loader2, Calendar, Zap, Search, Plus, X, Package } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Input,
  Label,
  Select,
  SelectItem,
  Checkbox,
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
  Badge,
} from "@/components/ui";
import {
  useCreateFlashSaleMutation,
  useGetFlashSaleQuery,
  useUpdateFlashSaleMutation,
  type CreateFlashSaleDto,
  type FlashSaleProduct,
} from "@/lib/features/marketing/marketing-api-slice";
import { useGetCategoriesQuery, useGetProductsQuery } from "@/lib/features/catalog/catalog-api-slice";

const flashSaleSchema = z
  .object({
    title: z.string().min(3, "Title must be at least 3 characters").max(100),
    bannerImage: z.string().optional().or(z.literal("")),
    startDate: z.string().min(1, "Start date is required"),
    endDate: z.string().min(1, "End date is required"),
    discountType: z.enum(["percentage", "fixed"]),
    discountValue: z.coerce.number().min(0),
    applyTo: z.enum(["all", "products", "categories"]),
    excludeOnSale: z.boolean().default(false),
    visibility: z.boolean().default(true),
    priority: z.coerce.number().int().default(0),
  })
  .superRefine((v, ctx) => {
    if (new Date(v.endDate) <= new Date(v.startDate)) {
      ctx.addIssue({ path: ["endDate"], code: z.ZodIssueCode.custom, message: "End date must be after start date" });
    }
    if (v.discountType === "percentage" && v.discountValue > 100) {
      ctx.addIssue({ path: ["discountValue"], code: z.ZodIssueCode.custom, message: "Percentage must be 0–100" });
    }
  });

type FlashSaleForm = z.infer<typeof flashSaleSchema>;

/** "2026-09-27T15:30" in the admin's own time zone, for <input type="datetime-local">. */
function toLocalInput(d: Date | string): string {
  const date = new Date(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const optionalNumber = (v: string): number | null => (v.trim() === "" || Number.isNaN(Number(v)) ? null : Number(v));

/** Search the catalogue and add products to the sale. */
function ProductPicker({ selected, onAdd }: { selected: Set<string>; onAdd: (p: FlashSaleProduct) => void }) {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);
  const { data, isFetching } = useGetProductsQuery({ search: query || undefined, perPage: 8 });
  const results = data?.items ?? [];

  return (
    <div className="rounded-lg border">
      <div className="relative border-b">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products by name or SKU"
          className="border-0 pl-9 focus-visible:ring-0 focus-visible:ring-offset-0"
          aria-label="Search products"
        />
      </div>
      <div className="max-h-64 overflow-y-auto divide-y">
        {results.map((p) => {
          const id = String(p.id);
          const added = selected.has(id);
          return (
            <div key={id} className="flex items-center gap-3 px-3 py-2">
              {p.thumbnailUrl ? (
                <img src={p.thumbnailUrl} alt="" className="h-9 w-9 rounded object-cover bg-slate-100" />
              ) : (
                <div className="h-9 w-9 rounded bg-slate-100 flex items-center justify-center">
                  <Package className="h-4 w-4 text-slate-400" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{p.name}</div>
                <div className="text-xs text-slate-500">
                  {p.sku ? `${p.sku} · ` : ""}
                  {formatMoney(p.regularPrice ?? 0)}
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant={added ? "ghost" : "outline"}
                disabled={added}
                onClick={() =>
                  onAdd({
                    productId: id,
                    name: p.name,
                    sku: p.sku ?? null,
                    image: p.thumbnailUrl ?? null,
                    regularPrice: p.regularPrice ?? null,
                    salePrice: null,
                    stockLimit: null,
                    soldCount: 0,
                  })
                }
              >
                {added ? "Added" : (
                  <>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add
                  </>
                )}
              </Button>
            </div>
          );
        })}
        {!isFetching && results.length === 0 && (
          <div className="px-3 py-6 text-center text-sm text-slate-500">No products match “{query}”.</div>
        )}
        {isFetching && results.length === 0 && (
          <div className="px-3 py-6 text-center text-sm text-slate-500">Searching…</div>
        )}
      </div>
    </div>
  );
}

export default function FlashSaleEditorPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams?.get("edit");
  const isEdit = !!editId;

  const methods = useForm<FlashSaleForm>({
    resolver: zodResolver(flashSaleSchema),
    defaultValues: {
      title: "",
      bannerImage: "",
      startDate: toLocalInput(new Date(Date.now() + 3_600_000)),
      endDate: toLocalInput(new Date(Date.now() + 7 * 86_400_000)),
      discountType: "percentage",
      discountValue: 20,
      applyTo: "products",
      excludeOnSale: false,
      visibility: true,
      priority: 0,
    },
  });
  const { watch, control, reset } = methods;
  const applyTo = watch("applyTo");
  const discountType = watch("discountType");
  const title = watch("title");
  const discountValue = Number(watch("discountValue")) || 0;

  const [products, setProducts] = useState<FlashSaleProduct[]>([]);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [scopeError, setScopeError] = useState<string | null>(null);
  const selectedIds = useMemo(() => new Set(products.map((p) => p.productId)), [products]);

  const { data: categories = [] } = useGetCategoriesQuery(undefined, { skip: applyTo !== "categories" });

  const [createSale, { isLoading: createLoading }] = useCreateFlashSaleMutation();
  const [updateSale, { isLoading: updateLoading }] = useUpdateFlashSaleMutation();
  const { data: existing } = useGetFlashSaleQuery(editId as string, { skip: !isEdit });

  useEffect(() => {
    if (existing && isEdit) {
      reset({
        title: existing.title,
        bannerImage: existing.bannerImage ?? "",
        startDate: toLocalInput(existing.startDate),
        endDate: toLocalInput(existing.endDate),
        discountType: existing.discountType,
        discountValue: existing.discountValue,
        applyTo: existing.applyTo,
        excludeOnSale: existing.excludeOnSale,
        visibility: existing.visibility,
        priority: existing.priority,
      });
      setProducts(existing.products);
      setCategoryIds(existing.categoryIds);
    }
  }, [existing, isEdit, reset]);

  /** What a product costs in this sale when it has no price of its own. */
  const salePriceFor = (regular: number | null | undefined) => {
    if (regular === null || regular === undefined) return null;
    const p = discountType === "percentage" ? regular * (1 - discountValue / 100) : regular - discountValue;
    return Math.max(0, Math.round(p * 100) / 100);
  };

  const updateProduct = (id: string, patch: Partial<FlashSaleProduct>) =>
    setProducts((prev) => prev.map((p) => (p.productId === id ? { ...p, ...patch } : p)));

  const onSubmit = async (data: FlashSaleForm) => {
    if (data.applyTo === "products" && products.length === 0) {
      setScopeError("Add at least one product.");
      return;
    }
    if (data.applyTo === "categories" && categoryIds.length === 0) {
      setScopeError("Choose at least one category.");
      return;
    }
    setScopeError(null);
    const dto: CreateFlashSaleDto = {
      title: data.title,
      bannerImage: data.bannerImage || undefined,
      startDate: new Date(data.startDate).toISOString(),
      endDate: new Date(data.endDate).toISOString(),
      discountType: data.discountType,
      discountValue: Number(data.discountValue),
      applyTo: data.applyTo,
      products,
      categoryIds,
      excludeOnSale: data.excludeOnSale,
      visibility: data.visibility,
      priority: data.priority,
    };
    try {
      if (isEdit && editId) {
        await updateSale({ id: editId, body: dto }).unwrap();
        toast.success("Flash sale updated.");
      } else {
        await createSale(dto).unwrap();
        toast.success("Flash sale created.");
      }
      router.push("/marketing/flash-sales");
    } catch (e: any) {
      toast.error(e?.data?.message || "Failed to save flash sale.");
    }
  };

  const saving = createLoading || updateLoading;

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex items-center gap-3">
          <Link href="/marketing/flash-sales">
            <Button variant="ghost" size="icon" aria-label="Back to flash sales">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              {isEdit ? "Edit Flash Sale" : "Create Flash Sale"}
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              A timed discount. Prices change on the storefront and at checkout while it runs.
            </p>
          </div>
        </div>
        <Button onClick={methods.handleSubmit(onSubmit)} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save Campaign
        </Button>
      </motion.div>

      <FormProvider {...methods}>
        <Form onSubmit={methods.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Campaign</CardTitle>
                  <CardDescription>Title, banner and when the sale runs.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Campaign Title</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Mega Eid Sale" {...field} />
                        </FormControl>
                        <FormDescription>Shown to shoppers next to the sale price.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={control}
                    name="bannerImage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Banner Image URL (optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="https://.../banner.jpg" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField
                      control={control}
                      name="startDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" /> Starts At
                          </FormLabel>
                          <FormControl>
                            <Input type="datetime-local" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={control}
                      name="endDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" /> Ends At
                          </FormLabel>
                          <FormControl>
                            <Input type="datetime-local" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Discount</CardTitle>
                  <CardDescription>How much comes off, and which products it covers.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField
                      control={control}
                      name="discountType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Discount Type</FormLabel>
                          <FormControl>
                            <Select value={field.value} onValueChange={field.onChange}>
                              <SelectItem value="percentage">% off the regular price</SelectItem>
                              <SelectItem value="fixed">Fixed amount (৳) off</SelectItem>
                            </Select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={control}
                      name="discountValue"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{discountType === "percentage" ? "Percentage" : "Amount (৳)"}</FormLabel>
                          <FormControl>
                            <Input type="number" min={0} step={discountType === "percentage" ? "1" : "0.01"} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={control}
                    name="applyTo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Apply To</FormLabel>
                        <FormControl>
                          <Select
                            value={field.value}
                            onValueChange={(v) => {
                              field.onChange(v);
                              setScopeError(null);
                            }}
                          >
                            <SelectItem value="products">Specific products</SelectItem>
                            <SelectItem value="categories">Specific categories</SelectItem>
                            <SelectItem value="all">All products</SelectItem>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {applyTo === "products" && (
                    <div className="space-y-3">
                      <ProductPicker
                        selected={selectedIds}
                        onAdd={(p) => {
                          setProducts((prev) => [...prev, p]);
                          setScopeError(null);
                        }}
                      />
                      {products.length > 0 && (
                        <div className="rounded-lg border overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs text-slate-500">
                              <tr>
                                <th className="px-3 py-2 text-left font-medium">Product</th>
                                <th className="px-3 py-2 text-left font-medium whitespace-nowrap">Sale price</th>
                                <th className="px-3 py-2 text-left font-medium whitespace-nowrap">Stock limit</th>
                                <th className="px-3 py-2" />
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {products.map((p) => {
                                const auto = salePriceFor(p.regularPrice);
                                return (
                                  <tr key={p.productId}>
                                    <td className="px-3 py-2">
                                      <div className="font-medium leading-tight">{p.name ?? `Product #${p.productId}`}</div>
                                      <div className="text-xs text-slate-500">
                                        Regular {formatMoney(p.regularPrice ?? 0)}
                                        {p.soldCount ? ` · ${p.soldCount} sold in this sale` : ""}
                                      </div>
                                    </td>
                                    <td className="px-3 py-2">
                                      <Input
                                        type="number"
                                        min={0}
                                        step="0.01"
                                        className="h-8 w-28"
                                        aria-label={`Sale price for ${p.name ?? p.productId}`}
                                        placeholder={auto !== null ? String(auto) : ""}
                                        value={p.salePrice ?? ""}
                                        onChange={(e) => updateProduct(p.productId, { salePrice: optionalNumber(e.target.value) })}
                                      />
                                    </td>
                                    <td className="px-3 py-2">
                                      <Input
                                        type="number"
                                        min={0}
                                        step="1"
                                        className="h-8 w-24"
                                        aria-label={`Stock limit for ${p.name ?? p.productId}`}
                                        placeholder="No limit"
                                        value={p.stockLimit ?? ""}
                                        onChange={(e) => updateProduct(p.productId, { stockLimit: optionalNumber(e.target.value) })}
                                      />
                                    </td>
                                    <td className="px-2 py-2 text-right">
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        aria-label={`Remove ${p.name ?? p.productId}`}
                                        onClick={() => setProducts((prev) => prev.filter((x) => x.productId !== p.productId))}
                                      >
                                        <X className="h-4 w-4" />
                                      </Button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                          <p className="border-t px-3 py-2 text-xs text-slate-500">
                            Leave the sale price empty to use the discount above. A stock limit caps how many
                            units sell at the sale price; after that the product goes back to its normal price.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {applyTo === "categories" && (
                    <div className="rounded-lg border max-h-72 overflow-y-auto p-2">
                      {categories.map((c) => {
                        const id = String(c.id);
                        const checked = categoryIds.includes(id);
                        return (
                          <label
                            key={id}
                            className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer"
                            style={{ paddingLeft: `${0.5 + (c.depth ?? 0) * 1.25}rem` }}
                          >
                            <Checkbox
                              checked={checked}
                              aria-label={c.name}
                              onCheckedChange={(v) => {
                                setCategoryIds((prev) => (v ? [...prev, id] : prev.filter((x) => x !== id)));
                                setScopeError(null);
                              }}
                            />
                            <span>{c.name}</span>
                            {c.productCount !== undefined && (
                              <span className="text-xs text-slate-400">({c.productCount})</span>
                            )}
                          </label>
                        );
                      })}
                      {categories.length === 0 && (
                        <div className="px-2 py-4 text-center text-sm text-slate-500">No categories yet.</div>
                      )}
                      <p className="px-2 pt-2 text-xs text-slate-500">Subcategories are included.</p>
                    </div>
                  )}

                  {scopeError && <p className="text-sm font-medium text-destructive">{scopeError}</p>}

                  <Controller
                    control={control}
                    name="excludeOnSale"
                    render={({ field }) => (
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="excludeOnSale"
                          checked={!!field.value}
                          onCheckedChange={(v) => field.onChange(v)}
                        />
                        <Label htmlFor="excludeOnSale" className="text-sm font-normal">
                          Skip products that already have their own sale price
                        </Label>
                      </div>
                    )}
                  />
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="border-2 border-orange-200 dark:border-orange-500/30 bg-gradient-to-br from-orange-50 to-rose-50 dark:from-orange-500/10 dark:to-rose-500/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-orange-700 dark:text-orange-300">
                    <Zap className="h-4 w-4" /> Live Preview
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-orange-500 via-rose-500 to-pink-600 p-5 text-white shadow-lg">
                    <div className="flex items-start justify-between">
                      <Badge className="bg-white/20 text-white border-0">FLASH SALE</Badge>
                      <Badge className="bg-white text-rose-600 border-0">
                        {discountType === "percentage" ? `${discountValue}% OFF` : `${formatMoney(discountValue)} OFF`}
                      </Badge>
                    </div>
                    <h3 className="mt-4 text-xl font-bold leading-tight">{title || "Your Campaign Title"}</h3>
                    <p className="mt-1 text-sm text-white/80">Limited time only</p>
                  </div>
                  <div className="rounded-lg border bg-background p-2.5">
                    <div className="text-[11px] uppercase text-slate-500">Applies to</div>
                    <div className="text-sm font-medium">
                      {applyTo === "all"
                        ? "Every product in the store"
                        : applyTo === "categories"
                          ? `${categoryIds.length} ${categoryIds.length === 1 ? "category" : "categories"}`
                          : `${products.length} ${products.length === 1 ? "product" : "products"}`}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Publishing</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Controller
                    control={control}
                    name="visibility"
                    render={({ field }) => (
                      <div className="flex items-center gap-2">
                        <Checkbox id="visibility" checked={!!field.value} onCheckedChange={(v) => field.onChange(v)} />
                        <Label htmlFor="visibility" className="text-sm font-normal">
                          Active (untick to pause the sale)
                        </Label>
                      </div>
                    )}
                  />

                  <FormField
                    control={control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sort Order</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} />
                        </FormControl>
                        <FormDescription>
                          Lower numbers are listed first. When sales overlap, shoppers always get the lowest price.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        </Form>
      </FormProvider>
    </div>
  );
}
