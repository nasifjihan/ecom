"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Plus,
  X,
  RefreshCw,
  ImagePlus,
  GripVertical,
  Eye,
  Upload,
  Tag,
  PlusCircle,
  Search,
  Check,
  ArrowLeft,
  Package,
  Star,
  Trash2,
} from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Input,
  Label,
  Badge,
  Checkbox,
  Select,
  SelectItem,
  Textarea,
  Form,
  FormProvider,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Separator,
  ScrollArea,
  Skeleton,
  cn,
} from "@/components/ui";
import {
  useGetProductQuery,
  useUpdateProductMutation,
  useGetCategoriesQuery,
  useGetBrandsQuery,
  useGetProductsQuery,
  useUploadMediaMutation,
  type ProductVariant,
} from "@/lib/features/catalog/catalog-api-slice";
import { ProductStatus, ProductType } from "@ecom/shared-types";
import { SpecificationsEditor, cleanSpecs, type SpecRow } from "@/components/catalog/specifications-editor";
import { BanglaFields, banglaOf, banglaPayload, type BanglaField, type BanglaTexts } from "@/components/catalog/bangla-fields";

const BANGLA_FIELDS: BanglaField[] = [
  { key: "name", label: "Name" },
  { key: "shortDescription", label: "Short description", rows: 2 },
  { key: "description", label: "Long description", rows: 6 },
];

const ProductTypeValues = [
  { value: ProductType.SIMPLE, label: "Simple Product" },
  { value: ProductType.VARIABLE, label: "Variable Product" },
  { value: ProductType.DIGITAL, label: "Digital Product" },
  { value: "SUBSCRIPTION" as any, label: "Subscription" },
  { value: "MADE_TO_ORDER" as any, label: "Made to Order" },
];

const StatusValues = [
  { value: "DRAFT", label: "Draft" },
  { value: "PUBLISHED", label: "Active / Published" },
  { value: "SCHEDULED", label: "Scheduled" },
  { value: "ARCHIVED", label: "Archived" },
];

const productEditSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters" }).max(200, {
    message: "Name must be at most 200 characters",
  }),
  slug: z
    .string()
    .max(200)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
      message: "Slug must contain only lowercase letters, numbers, and hyphens",
    })
    .optional()
    .or(z.literal("")),
  type: z.enum([ProductType.SIMPLE, ProductType.VARIABLE, ProductType.DIGITAL]).or(
    z.enum(["SUBSCRIPTION", "MADE_TO_ORDER"] as any)
  ),
  status: z.enum(["DRAFT", "PUBLISHED", "SCHEDULED", "ARCHIVED"] as any).default("DRAFT"),
  sku: z.string().min(1, { message: "SKU is required" }).max(100),
  shortDescription: z.string().max(500).optional().or(z.literal("")),
  description: z.string().max(20000).optional().or(z.literal("")),
  regularPrice: z.coerce
    .number()
    .min(0, { message: "Regular price cannot be negative" })
    .nullable()
    .optional(),
  salePrice: z.coerce
    .number()
    .min(0, { message: "Sale price cannot be negative" })
    .nullable()
    .optional(),
  costPrice: z.preprocess((v) => (v === "" || v === undefined ? null : v), z.coerce.number().min(0, { message: "Cost can't be negative" }).nullable()),
  salePriceStartAt: z.string().optional().or(z.literal("")),
  salePriceEndAt: z.string().optional().or(z.literal("")),
  stockQty: z.coerce.number().int().min(0, { message: "Stock cannot be negative" }).optional(),
  manageStock: z.boolean().default(true),
  lowStockThreshold: z.coerce.number().int().min(0).optional(),
  allowBackorder: z.boolean().default(false),
  weight: z.coerce.number().min(0).nullable().optional(),
  length: z.coerce.number().min(0).nullable().optional(),
  width: z.coerce.number().min(0).nullable().optional(),
  height: z.coerce.number().min(0).nullable().optional(),
  isFeatured: z.boolean().default(false),
  categoryIds: z.array(z.coerce.bigint()).default([]),
  brandId: z.coerce.bigint().nullable().optional(),
  tagNames: z.array(z.string()).default([]),
  relatedProductIds: z.array(z.coerce.bigint()).default([]),
  seoTitle: z.string().max(60).optional().or(z.literal("")),
  metaDesc: z.string().max(160).optional().or(z.literal("")),
});

type ProductEditFormValues = z.infer<typeof productEditSchema>;

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

type MediaImage = {
  id: string;
  url: string;
  name?: string;
  isFeatured?: boolean;
};

export default function EditProductPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params?.id as string | number;

  const { data: product, isLoading: isProductLoading } = useGetProductQuery(productId, {
    skip: !productId,
  });

  const [updateProduct, { isLoading: isSaving }] = useUpdateProductMutation();
  const [uploadMedia, { isLoading: isUploading }] = useUploadMediaMutation();

  const { data: categoriesData } = useGetCategoriesQuery();
  const { data: brandsData } = useGetBrandsQuery({ page: 1, perPage: 100 });
  const { data: relatedProducts } = useGetProductsQuery({ page: 1, perPage: 50 });

  const [gallery, setGallery] = useState<MediaImage[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [relatedSearch, setRelatedSearch] = useState("");
  const [activeTab, setActiveTab] = useState("basic");

  const methods = useForm<ProductEditFormValues>({
    resolver: zodResolver(productEditSchema),
    defaultValues: {
      name: "",
      slug: "",
      type: ProductType.SIMPLE,
      status: "DRAFT",
      sku: "",
      shortDescription: "",
      description: "",
      regularPrice: null,
      salePrice: null,
      costPrice: null,
      salePriceStartAt: "",
      salePriceEndAt: "",
      stockQty: 0,
      manageStock: true,
      lowStockThreshold: 5,
      allowBackorder: false,
      weight: null,
      length: null,
      width: null,
      height: null,
      isFeatured: false,
      categoryIds: [],
      brandId: null,
      tagNames: [],
      relatedProductIds: [],
      seoTitle: "",
      metaDesc: "",
    },
    mode: "onSubmit",
  });

  const { watch, setValue, reset, control, handleSubmit } = methods;

  useEffect(() => {
    if (product) {
      reset({
        name: product.name || "",
        slug: product.slug || "",
        type: (product.type as any) || ProductType.SIMPLE,
        status: (product.status as any) || "DRAFT",
        sku: product.sku || "",
        shortDescription: product.shortDescription || "",
        description: product.description || "",
        regularPrice: product.regularPrice ?? null,
        salePrice: product.salePrice ?? null,
        costPrice: product.costPrice ?? null,
        salePriceStartAt: product.salePriceStartAt || "",
        salePriceEndAt: product.salePriceEndAt || "",
        stockQty: product.stockQty ?? 0,
        manageStock: product.manageStock ?? true,
        lowStockThreshold: product.lowStockThreshold ?? 5,
        allowBackorder: product.allowBackorder ?? false,
        weight: product.weight ?? null,
        length: product.length ?? null,
        width: product.width ?? null,
        height: product.height ?? null,
        isFeatured: !!product.featured,
        categoryIds: (product.categoryIds as any) || [],
        brandId: (product.brandId as any) || null,
        tagNames: product.tags ?? [],
        relatedProductIds: [],
        seoTitle: product.seoTitle || "",
        metaDesc: product.metaDesc || "",
      });

      if (product.imageUrls && product.imageUrls.length > 0) {
        const galleryImgs: MediaImage[] = product.imageUrls.map((url, i) => ({
          id: String(product.id) + "-" + i,
          url,
          isFeatured: (product.thumbnailUrl ? url === product.thumbnailUrl : i === 0),
        }));
        setGallery(galleryImgs);
      }

      if (product.variants && product.variants.length > 0) {
        setVariants(product.variants);
      }
      setSpecs(Array.isArray(product.specifications) ? product.specifications : []);
      setBangla(banglaOf(product));
    }
  }, [product, reset]);

  const typeValue = watch("type");
  const tags = watch("tagNames") || [];
  const [specs, setSpecs] = useState<SpecRow[]>([]);
  const [bangla, setBangla] = useState<BanglaTexts>({});
  const relatedIds = watch("relatedProductIds") || [];

  const handleSuggestSlug = () => {
    const nameValue = watch("name");
    if (!nameValue) return;
    const slug = slugify(nameValue);
    setValue("slug", slug, { shouldValidate: false });
    toast.success("Slug regenerated");
  };

  const handleFileUpload = async (files: FileList | File[]) => {
    const fileArr = Array.from(files);
    for (const file of fileArr) {
      if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
        toast.error(`${file.name}: Invalid file type`);
        continue;
      }
      if (file.size > 50 * 1024 * 1024) {
        toast.error(`${file.name}: File exceeds 50MB`);
        continue;
      }
      const fd = new FormData();
      fd.append("file", file);
      try {
        const result = await uploadMedia(fd).unwrap();
        setGallery((g) => [
          ...g,
          {
            id: String(result.id),
            url: result.url || URL.createObjectURL(file),
            name: result.filename || file.name,
            isFeatured: g.length === 0,
          },
        ]);
      } catch (err: any) {
        toast.error(err?.data?.message || `Failed to upload ${file.name}`);
      }
    }
  };

  const removeGalleryItem = (id: string) => {
    setGallery((g) => {
      const removed = g.filter((x) => x.id !== id);
      const hadFeatured = g.find((x) => x.id === id)?.isFeatured;
      if (hadFeatured && removed.length > 0) {
        removed[0]!.isFeatured = true;
      }
      return removed;
    });
  };

  const setFeatured = (id: string) => {
    setGallery((g) => g.map((x) => ({ ...x, isFeatured: x.id === id })));
  };

  const addTag = () => {
    const trimmed = tagInput.trim();
    if (!trimmed) return;
    if (!tags.includes(trimmed)) {
      setValue("tagNames", [...tags, trimmed]);
    }
    setTagInput("");
  };

  const removeTag = (t: string) => {
    setValue(
      "tagNames",
      tags.filter((x) => x !== t)
    );
  };

  const toggleRelated = (id: bigint) => {
    const idStr = String(id);
    const current = relatedIds.map((x) => String(x));
    if (current.includes(idStr)) {
      setValue(
        "relatedProductIds",
        relatedIds.filter((x) => String(x) !== idStr) as any
      );
    } else {
      setValue("relatedProductIds", [...relatedIds, id as any]);
    }
  };

  const addVariant = () => {
    setVariants((v) => [
      ...v,
      {
        sku: `VAR-${Date.now()}`,
        regularPrice: null,
        stockQty: 0,
        manageStock: true,
      },
    ]);
  };

  const removeVariant = (idx: number) => {
    setVariants((v) => v.filter((_, i) => i !== idx));
  };

  // Surface the first failing field instead of silently doing nothing.
  const onInvalid = (errors: Record<string, { message?: string } | undefined>) => {
    const [field, err] = Object.entries(errors)[0] ?? [];
    if (field) toast.error(`${field}: ${err?.message ?? "invalid value"}`);
  };

  const onSubmit = async (values: ProductEditFormValues) => {
    if (values.salePrice != null && values.regularPrice != null && values.salePrice > values.regularPrice) {
      toast.error("Sale price cannot exceed regular price");
      return;
    }

    try {
      const featuredImage = gallery.find((g) => g.isFeatured) || gallery[0];
      const imageUrls = gallery.map((g) => g.url);
      const thumbnailUrl = featuredImage?.url;

      await updateProduct({
        id: productId,
        body: {
          name: values.name,
          slug: values.slug || slugify(values.name),
          type: values.type as any,
          status: values.status,
          sku: values.sku,
          shortDescription: values.shortDescription || null,
          tags: values.tagNames,
          specifications: cleanSpecs(specs),
          description: values.description || null,
          translations: banglaPayload(BANGLA_FIELDS, bangla),
          regularPrice: values.regularPrice ?? null,
          salePrice: values.salePrice ?? null,
          costPrice: values.costPrice ?? null,
          salePriceStartAt: values.salePriceStartAt || null,
          salePriceEndAt: values.salePriceEndAt || null,
          manageStock: values.manageStock,
          stockQty: values.stockQty,
          lowStockThreshold: values.lowStockThreshold,
          allowBackorder: values.allowBackorder,
          weight: values.weight ?? null,
          length: values.length ?? null,
          width: values.width ?? null,
          height: values.height ?? null,
          categoryIds: values.categoryIds as any,
          brandId: values.brandId as any,
          featured: values.isFeatured,
          imageUrls,
          thumbnailUrl,
          variants,
          seoTitle: values.seoTitle || null,
          metaDesc: values.metaDesc || null,
        } as any,
      }).unwrap();

      toast.success("Product updated successfully");
      router.push("/catalog/products");
    } catch (err: any) {
      // baseQuery puts the API message (string) or field errors (object) directly on err.data.
      const msg = err?.data?.message ?? err?.data;
      if (typeof msg === "string") {
        toast.error(msg);
      } else if (typeof msg === "object") {
        Object.entries(msg).forEach(([k, v]) => {
          if (Array.isArray(v)) toast.error(`${k}: ${v[0]}`);
        });
      } else {
        toast.error("Failed to update product");
      }
    }
  };

  const categories = categoriesData || [];
  const brands = brandsData?.items || [];
  const products = relatedProducts?.items || [];
  const filteredProducts = relatedSearch
    ? products.filter((p) => p.name.toLowerCase().includes(relatedSearch.toLowerCase()))
    : products;

  if (isProductLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardContent className="space-y-5 p-6">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-3/4" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-32 w-full" />
              </CardContent>
            </Card>
          </div>
          <div className="space-y-6">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!product && !isProductLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
        <div className="h-20 w-20 rounded-2xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center mb-6">
          <Package className="h-10 w-10 text-red-600 dark:text-red-400" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Product Not Found</h1>
        <p className="text-muted-foreground mb-6 max-w-md">
          The product you are trying to edit may have been deleted or does not exist.
        </p>
        <Button onClick={() => router.push("/catalog/products")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Products
        </Button>
      </div>
    );
  }

  return (
    <FormProvider {...methods}>
      <Form onSubmit={handleSubmit(onSubmit, onInvalid)} className="min-h-screen">
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => router.back()} title="Back">
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold tracking-tight">
                    Edit Product
                  </h1>
                  <Badge variant="outline" className="text-xs">
                    ID: {product?.id}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Last updated: {product?.updatedAt ? new Date(product.updatedAt).toLocaleString() : "—"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={() => toast.success("Preview opened")}>
                <Eye className="mr-2 h-4 w-4" /> Preview
              </Button>
              <Button type="button" variant="secondary" onClick={handleSubmit(onSubmit, onInvalid)} disabled={isSaving}>
                {isSaving ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Save Draft
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Tabs defaultValue="basic" value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="w-full justify-start overflow-x-auto flex-nowrap">
                  <TabsTrigger value="basic">Basic Info</TabsTrigger>
                  <TabsTrigger value="media">Media</TabsTrigger>
                  {typeValue === ProductType.VARIABLE && <TabsTrigger value="variants">Variants</TabsTrigger>}
                  <TabsTrigger value="pricing">Pricing</TabsTrigger>
                  <TabsTrigger value="inventory">Inventory</TabsTrigger>
                  <TabsTrigger value="taxonomy">Categories & Tags</TabsTrigger>
                  <TabsTrigger value="related">Related</TabsTrigger>
                  <TabsTrigger value="seo">SEO</TabsTrigger>
                </TabsList>

                <TabsContent value="basic">
                  <Card>
                    <CardHeader>
                      <CardTitle>Basic Information</CardTitle>
                      <CardDescription>Core product details and attributes.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      <FormField
                        control={control}
                        name="name"
                        render={({ field, fieldState }) => (
                          <FormItem>
                            <FormLabel>Product Name *</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g. Premium Cotton T-Shirt" {...field} />
                            </FormControl>
                            <FormMessage>{fieldState.error?.message}</FormMessage>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={control}
                        name="slug"
                        render={({ field, fieldState }) => (
                          <FormItem>
                            <FormLabel>Slug</FormLabel>
                            <div className="flex gap-2">
                              <FormControl>
                                <Input placeholder="auto-generated-from-name" {...field} />
                              </FormControl>
                              <Button type="button" variant="outline" onClick={handleSuggestSlug}>
                                <RefreshCw className="mr-2 h-4 w-4" /> Suggest
                              </Button>
                            </div>
                            <FormMessage>{fieldState.error?.message}</FormMessage>
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={control}
                          name="type"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Product Type</FormLabel>
                              <FormControl>
                                <Select value={field.value} onValueChange={field.onChange}>
                                  {ProductTypeValues.map((v) => (
                                    <SelectItem key={v.value} value={v.value}>
                                      {v.label}
                                    </SelectItem>
                                  ))}
                                </Select>
                              </FormControl>
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={control}
                          name="status"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Status</FormLabel>
                              <FormControl>
                                <Select value={field.value} onValueChange={field.onChange}>
                                  {StatusValues.map((v) => (
                                    <SelectItem key={v.value} value={v.value}>
                                      {v.label}
                                    </SelectItem>
                                  ))}
                                </Select>
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={control}
                        name="shortDescription"
                        render={({ field, fieldState }) => (
                          <FormItem>
                            <FormLabel>Short Description</FormLabel>
                            <FormControl>
                              <Textarea
                                rows={3}
                                placeholder="Brief summary for product cards and search listings (max 500 chars)"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage>{fieldState.error?.message}</FormMessage>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={control}
                        name="description"
                        render={({ field, fieldState }) => (
                          <FormItem>
                            <FormLabel>Long Description</FormLabel>
                            <FormControl>
                              <Textarea
                                rows={8}
                                placeholder="Full product description — features, specifications, use cases..."
                                className="font-mono text-sm"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage>{fieldState.error?.message}</FormMessage>
                          </FormItem>
                        )}
                      />
                      <BanglaFields fields={BANGLA_FIELDS} value={bangla} onChange={setBangla} />
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="media">
                  <Card>
                    <CardHeader>
                      <CardTitle>Product Gallery</CardTitle>
                      <CardDescription>Upload images. The featured image is the thumbnail shown to customers.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div
                        className={cn(
                          "rounded-lg border-2 border-dashed p-8 text-center transition-colors cursor-pointer",
                          "border-slate-300 dark:border-slate-700 hover:border-primary bg-slate-50 dark:bg-slate-900/50 hover:bg-primary/5"
                        )}
                        onDragOver={(e) => {
                          e.preventDefault();
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (e.dataTransfer.files.length) handleFileUpload(e.dataTransfer.files);
                        }}
                        onClick={() => document.getElementById("edit-gallery-file-input")?.click()}
                      >
                        <Upload className="mx-auto h-10 w-10 text-muted-foreground mb-2" />
                        <p className="text-sm font-medium">Drag & drop files or click to browse</p>
                        <p className="text-xs text-muted-foreground mt-1">Images or PDF up to 50MB</p>
                        <input
                          id="edit-gallery-file-input"
                          type="file"
                          multiple
                          accept="image/*,application/pdf"
                          className="hidden"
                          onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
                        />
                      </div>

                      {gallery.length > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 mt-6">
                          {gallery.map((img, idx) => (
                            <div
                              key={img.id}
                              className={cn(
                                "relative group rounded-lg border overflow-hidden aspect-square",
                                img.isFeatured && "ring-2 ring-primary"
                              )}
                            >
                              <div className="absolute top-1 left-1 z-10 opacity-50 group-hover:opacity-100 cursor-grab">
                                <GripVertical className="h-4 w-4 text-white drop-shadow" />
                              </div>
                              <img
                                src={img.url}
                                alt={img.name || ""}
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
                                {!img.isFeatured && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => setFeatured(img.id)}
                                    className="text-xs py-1 px-2 h-auto"
                                  >
                                    <Star className="h-3 w-3 mr-1" /> Feature
                                  </Button>
                                )}
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => removeGalleryItem(img.id)}
                                  className="text-xs py-1 px-2 h-auto"
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                              {img.isFeatured && (
                                <div className="absolute top-1 right-1 bg-primary text-white text-[10px] px-2 py-0.5 rounded-sm z-10">
                                  FEATURED
                                </div>
                              )}
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() => document.getElementById("edit-gallery-file-input")?.click()}
                            className="flex flex-col items-center justify-center aspect-square rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-primary text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors"
                          >
                            <ImagePlus className="h-8 w-8 mb-1" />
                            <span className="text-xs">Add Media</span>
                          </button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="variants">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                      <div>
                        <CardTitle>Product Variants</CardTitle>
                        <CardDescription>Manage options like Size, Color, Material.</CardDescription>
                      </div>
                      <Button type="button" onClick={addVariant} variant="outline" size="sm">
                        <PlusCircle className="mr-2 h-4 w-4" /> Add Variant
                      </Button>
                    </CardHeader>
                    <CardContent>
                      {variants.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                          <Plus className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p>No variants yet. Add options like Color/Size.</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {variants.map((v, idx) => (
                            <div key={idx} className="border rounded-lg p-4 space-y-4">
                              <div className="flex items-center justify-between">
                                <Label className="font-medium">Variant #{idx + 1}</Label>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeVariant(idx)}
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" /> Remove
                                </Button>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div>
                                  <Label className="text-xs text-muted-foreground">Attribute Values</Label>
                                  <Input
                                    defaultValue={JSON.stringify(v.attributeValues || {})}
                                    placeholder='{"Color":"Red","Size":"M"}'
                                    onChange={(e) => {
                                      try {
                                        const parsed = JSON.parse(e.target.value || "{}");
                                        setVariants((vs) => vs.map((x, i) => (i === idx ? { ...x, attributeValues: parsed } : x)));
                                      } catch {}
                                    }}
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs text-muted-foreground">SKU</Label>
                                  <Input
                                    defaultValue={v.sku || ""}
                                    onChange={(e) => setVariants((vs) => vs.map((x, i) => (i === idx ? { ...x, sku: e.target.value } : x)))}
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs text-muted-foreground">Stock Qty</Label>
                                  <Input
                                    type="number"
                                    defaultValue={v.stockQty || 0}
                                    onChange={(e) => setVariants((vs) => vs.map((x, i) => (i === idx ? { ...x, stockQty: Number(e.target.value) } : x)))}
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs text-muted-foreground">Regular Price ৳</Label>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    defaultValue={v.regularPrice ?? ""}
                                    onChange={(e) => setVariants((vs) => vs.map((x, i) => (i === idx ? { ...x, regularPrice: e.target.value ? Number(e.target.value) : null } : x)))}
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs text-muted-foreground">Sale Price ৳</Label>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    defaultValue={v.salePrice ?? ""}
                                    onChange={(e) => setVariants((vs) => vs.map((x, i) => (i === idx ? { ...x, salePrice: e.target.value ? Number(e.target.value) : null } : x)))}
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="pricing">
                  <Card>
                    <CardHeader>
                      <CardTitle>Pricing</CardTitle>
                      <CardDescription>Set up regular and promotional pricing.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={control}
                          name="regularPrice"
                          render={({ field, fieldState }) => (
                            <FormItem>
                              <FormLabel>Regular Price (৳) *</FormLabel>
                              <FormControl>
                                <Input type="number" min={0} step="0.01" placeholder="0.00" {...field} />
                              </FormControl>
                              <FormMessage>{fieldState.error?.message}</FormMessage>
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={control}
                          name="salePrice"
                          render={({ field, fieldState }) => (
                            <FormItem>
                              <FormLabel>Sale Price (৳)</FormLabel>
                              <FormControl>
                                <Input type="number" min={0} step="0.01" placeholder="Discounted price" {...field} />
                              </FormControl>
                              <FormMessage>{fieldState.error?.message}</FormMessage>
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={control}
                          name="salePriceStartAt"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Sale Start Date</FormLabel>
                              <FormControl>
                                <Input type="datetime-local" {...field} />
                              </FormControl>
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={control}
                          name="salePriceEndAt"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Sale End Date</FormLabel>
                              <FormControl>
                                <Input type="datetime-local" {...field} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>

                      <Separator />

                      <FormField
                        control={control}
                        name="costPrice"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Cost price (৳)</FormLabel>
                            <FormControl>
                              <Input type="number" min={0} step="0.01" placeholder="What one unit costs you" {...field} value={watch("costPrice") ?? ""} />
                            </FormControl>
                            <FormMessage>{methods.formState.errors.costPrice?.message}</FormMessage>
                            <CostMargin cost={watch("costPrice")} price={watch("salePrice") ?? watch("regularPrice")} />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="inventory">
                  <Card>
                    <CardHeader>
                      <CardTitle>Inventory & Shipping</CardTitle>
                      <CardDescription>Track stock levels and shipping dimensions.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      <FormField
                        control={control}
                        name="sku"
                        render={({ field, fieldState }) => (
                          <FormItem>
                            <FormLabel>SKU (Stock Keeping Unit) *</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g. TS-PRM-COT-L-BLK" {...field} />
                            </FormControl>
                            <FormMessage>{fieldState.error?.message}</FormMessage>
                          </FormItem>
                        )}
                      />

                      <div className="flex items-start gap-3 p-3 rounded-lg border bg-slate-50 dark:bg-slate-900/50">
                        <FormField
                          control={control}
                          name="manageStock"
                          render={({ field }) => (
                            <FormItem className="flex items-start gap-2 flex-row">
                              <FormControl>
                                <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                              </FormControl>
                              <div>
                                <FormLabel className="cursor-pointer font-medium">Manage Stock</FormLabel>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  Track quantity and prevent overselling
                                </p>
                              </div>
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <FormField
                          control={control}
                          name="stockQty"
                          render={({ field, fieldState }) => (
                            <FormItem>
                              <FormLabel>Stock Quantity</FormLabel>
                              <FormControl>
                                <Input type="number" min={0} step="1" {...field} />
                              </FormControl>
                              <FormMessage>{fieldState.error?.message}</FormMessage>
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={control}
                          name="lowStockThreshold"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Low Stock Threshold</FormLabel>
                              <FormControl>
                                <Input type="number" min={0} step="1" {...field} />
                              </FormControl>
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={control}
                          name="allowBackorder"
                          render={({ field }) => (
                            <FormItem className="h-full">
                              <FormLabel>Backorders</FormLabel>
                              <FormControl>
                                <div className="flex items-center h-10 px-3 space-x-2 rounded-md border border-input bg-background">
                                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                  <span className="text-sm">Allow backorders</span>
                                </div>
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>

                      <Separator />

                      <div className="space-y-3">
                        <Label className="font-medium">Shipping Dimensions</Label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <FormField
                            control={control}
                            name="weight"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Weight (kg)</FormLabel>
                                <FormControl>
                                  <Input type="number" min={0} step="0.01" {...field} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={control}
                            name="length"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Length (cm)</FormLabel>
                                <FormControl>
                                  <Input type="number" min={0} step="0.1" {...field} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={control}
                            name="width"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Width (cm)</FormLabel>
                                <FormControl>
                                  <Input type="number" min={0} step="0.1" {...field} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={control}
                            name="height"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Height (cm)</FormLabel>
                                <FormControl>
                                  <Input type="number" min={0} step="0.1" {...field} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="taxonomy">
                  <Card>
                    <CardHeader>
                      <CardTitle>Categories & Tags</CardTitle>
                      <CardDescription>Organize products for discoverability.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <FormField
                        control={control}
                        name="categoryIds"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Categories (Multi-select)</FormLabel>
                            <FormControl>
                              <div className="border rounded-md max-h-72 overflow-y-auto p-3 space-y-1">
                                {categories.length === 0 ? (
                                  <p className="text-sm text-muted-foreground py-4 text-center">
                                    No categories yet.
                                  </p>
                                ) : (
                                  categories.map((c) => {
                                    const depth = (c as any).depth || 0;
                                    const indent = "— ".repeat(depth);
                                    const selected = field.value?.some((x: unknown) => String(x) === String(c.id));
                                    return (
                                      <div
                                        key={String(c.id)}
                                        className="flex items-center gap-2 py-1 hover:bg-slate-50 dark:hover:bg-slate-800 rounded px-1 cursor-pointer"
                                        onClick={() => {
                                          const current = (field.value || []) as bigint[];
                                          if (selected) {
                                            field.onChange(current.filter((x) => String(x) !== String(c.id)));
                                          } else {
                                            field.onChange([...current, c.id as any]);
                                          }
                                        }}
                                      >
                                        <Checkbox checked={!!selected} onCheckedChange={() => {}} />
                                        <span className="text-sm">
                                          {indent}
                                          {c.name}
                                        </span>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={control}
                        name="brandId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Brand</FormLabel>
                            <FormControl>
                              <Select
                                value={field.value ? String(field.value) : ""}
                                onValueChange={(v) => field.onChange(v ? (BigInt(v) as any) : null)}
                              >
                                <SelectItem value="">None</SelectItem>
                                {brands.map((b) => (
                                  <SelectItem key={String(b.id)} value={String(b.id)}>
                                    {b.name}
                                  </SelectItem>
                                ))}
                              </Select>
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <Separator />

                      <div className="space-y-2">
                        <FormLabel>Tags</FormLabel>
                        <div className="flex gap-2">
                          <Input
                            value={tagInput}
                            onChange={(e) => setTagInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === ",") {
                                e.preventDefault();
                                addTag();
                              }
                            }}
                            placeholder="Type and press Enter to add tag"
                          />
                          <Button type="button" variant="outline" onClick={addTag}>
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                        {tags.length > 0 && (
                          <div className="flex flex-wrap gap-2 pt-2">
                            {tags.map((t) => (
                              <Badge key={t} variant="secondary" className="gap-1 pr-1">
                                <Tag className="h-3 w-3" />
                                {t}
                                <button type="button" onClick={() => removeTag(t)} className="ml-1 hover:text-destructive">
                                  <X className="h-3 w-3" />
                                </button>
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                  <div className="mt-6">
                    <SpecificationsEditor value={specs} onChange={setSpecs} />
                  </div>
                </TabsContent>

                <TabsContent value="related">
                  <Card>
                    <CardHeader>
                      <CardTitle>Related Products</CardTitle>
                      <CardDescription>Upsell and cross-sell product suggestions.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          className="pl-9"
                          placeholder="Search products to link..."
                          value={relatedSearch}
                          onChange={(e) => setRelatedSearch(e.target.value)}
                        />
                      </div>
                      <ScrollArea className="h-64 border rounded-md p-2">
                        {filteredProducts.length === 0 ? (
                          <p className="text-center text-muted-foreground py-8">No products found.</p>
                        ) : (
                          <div className="space-y-1">
                            {filteredProducts.map((p) => {
                              if (String(p.id) === String(productId)) return null;
                              const isSelected = relatedIds.map((x) => String(x)).includes(String(p.id));
                              return (
                                <div
                                  key={String(p.id)}
                                  onClick={() => toggleRelated(BigInt(String(p.id)))}
                                  className={cn(
                                    "flex items-center gap-3 p-2 rounded cursor-pointer",
                                    isSelected ? "bg-primary/10" : "hover:bg-slate-50 dark:hover:bg-slate-800"
                                  )}
                                >
                                  <Checkbox checked={isSelected} onCheckedChange={() => {}} />
                                  <div className="h-9 w-9 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden shrink-0">
                                    {p.thumbnailUrl || p.imageUrls?.[0] ? (
                                      <img
                                        src={p.thumbnailUrl || p.imageUrls?.[0] || ""}
                                        className="w-full h-full object-cover"
                                        alt=""
                                      />
                                    ) : (
                                      <Package className="h-4 w-4 text-slate-400" />
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium truncate">{p.name}</div>
                                    <div className="text-xs text-muted-foreground truncate">SKU: {p.sku || "—"}</div>
                                  </div>
                                  <span className="text-sm font-medium whitespace-nowrap">
                                    {p.regularPrice != null ? `৳${p.regularPrice}` : "—"}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </ScrollArea>
                      {relatedIds.length > 0 && (
                        <p className="text-xs text-muted-foreground">{relatedIds.length} product(s) selected</p>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="seo">
                  <Card>
                    <CardHeader>
                      <CardTitle>Search Engine Optimization</CardTitle>
                      <CardDescription>Improve how this product appears in search.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      <FormField
                        control={control}
                        name="seoTitle"
                        render={({ field }) => (
                          <FormItem>
                            <div className="flex items-center justify-between">
                              <FormLabel>Meta Title</FormLabel>
                              <span
                                className={cn(
                                  "text-xs tabular-nums",
                                  (field.value || "").length > 60 ? "text-destructive" : "text-muted-foreground"
                                )}
                              >
                                {(field.value || "").length}/60
                              </span>
                            </div>
                            <FormControl>
                              <Input maxLength={120} placeholder="SEO title here..." {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={control}
                        name="metaDesc"
                        render={({ field }) => (
                          <FormItem>
                            <div className="flex items-center justify-between">
                              <FormLabel>Meta Description</FormLabel>
                              <span
                                className={cn(
                                  "text-xs tabular-nums",
                                  (field.value || "").length > 160 ? "text-destructive" : "text-muted-foreground"
                                )}
                              >
                                {(field.value || "").length}/160
                              </span>
                            </div>
                            <FormControl>
                              <Textarea rows={3} maxLength={320} placeholder="Meta description..." {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <Separator />

                      <div>
                        <Label>OG Image (Social Preview)</Label>
                        <div className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary mt-2">
                          <ImagePlus className="h-10 w-10 mx-auto text-muted-foreground mb-1" />
                          <p className="text-sm text-muted-foreground">Click to upload OG image</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>

            <div className="space-y-6 lg:sticky lg:top-6 lg:self-start">
              <Card>
                <CardHeader>
                  <CardTitle>Publish</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <FormField
                    control={control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <FormControl>
                          <Select value={field.value} onValueChange={field.onChange}>
                            {StatusValues.map((v) => (
                              <SelectItem key={v.value} value={v.value}>
                                {v.label}
                              </SelectItem>
                            ))}
                          </Select>
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <div className="space-y-1.5">
                    <Label>Visibility</Label>
                    <Select defaultValue="public">
                      <SelectItem value="public">Public</SelectItem>
                      <SelectItem value="private">Private</SelectItem>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Last Modified</Label>
                    <Input disabled defaultValue={product?.updatedAt ? new Date(product.updatedAt).toLocaleString() : "—"} />
                  </div>

                  <Separator />

                  <FormField
                    control={control}
                    name="isFeatured"
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-2 flex-row">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <FormLabel className="cursor-pointer">Mark as Featured Product</FormLabel>
                      </FormItem>
                    )}
                  />

                  <Separator />

                  <div className="grid grid-cols-3 gap-2">
                    <Button type="submit" variant="secondary" className="w-full" disabled={isSaving}>
                      {isSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                      Save Draft
                    </Button>
                    <Button type="button" variant="outline" onClick={() => toast.success("Preview opened")} className="w-full">
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button type="submit" className="w-full" disabled={isSaving}>
                      {isSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      Save
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Product Image</CardTitle>
                </CardHeader>
                <CardContent>
                  {gallery.length === 0 ? (
                    <div
                      onClick={() => setActiveTab("media")}
                      className="aspect-square border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-primary text-muted-foreground hover:text-primary"
                    >
                      <ImagePlus className="h-8 w-8 mb-1" />
                      <span className="text-xs">Set featured image</span>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="aspect-square rounded-lg overflow-hidden border">
                        <img
                          src={gallery.find((g) => g.isFeatured)?.url || gallery[0]?.url}
                          className="w-full h-full object-cover"
                          alt="Featured"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button type="button" variant="outline" size="sm" className="flex-1" onClick={() => setActiveTab("media")}>
                          Edit gallery
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </Form>
    </FormProvider>
  );
}

/** "Margin ৳X (Y%)" from the cost and the selling price; recording a purchase updates the cost. */
function CostMargin({ cost, price }: { cost: unknown; price: number | null | undefined }) {
  const c = cost === "" || cost == null ? null : Number(cost);
  const p = price == null ? null : Number(price);
  if (c === null || !p || Number.isNaN(c)) {
    return <p className="text-xs text-muted-foreground">Used for profit reports; not shown to customers. Recording a purchase sets it to the average cost.</p>;
  }
  const m = Math.round((p - c) * 100) / 100;
  return (
    <p className={m < 0 ? "text-xs text-red-600" : "text-xs text-muted-foreground"}>
      Margin ৳{m.toLocaleString("en-IN")} ({Math.round((m / p) * 1000) / 10}% of the selling price). Recording a purchase updates the cost.
    </p>
  );
}
