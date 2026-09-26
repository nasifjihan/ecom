"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { formatMoney } from "@ecom/utils";
import Link from "next/link";
import {
  ArrowLeft,
  Save,
  ImagePlus,
  Eye,
  Loader2,
  Calendar,
  Zap,
} from "lucide-react";
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
  Controller,
  Textarea,
} from "@/components/ui";
import {
  useCreateFlashSaleMutation,
  useGetFlashSaleQuery,
  useUpdateFlashSaleMutation,
  type CreateFlashSaleDto,
} from "@/lib/features/marketing/marketing-api-slice";

const createFlashSaleSchema = z
  .object({
    title: z.string().min(3, "Title must be at least 3 characters").max(100),
    bannerImage: z.string().optional().or(z.literal("")),
    startDate: z.string().min(1, "Start date is required"),
    endDate: z.string().min(1, "End date is required"),
    discountType: z.enum(["percentage", "fixed"]),
    discountValue: z.coerce.number().min(0),
    applyTo: z.enum(["all", "products", "categories"]),
    productIds: z.string().optional(),
    categoryIds: z.string().optional(),
    excludeOnSale: z.boolean().default(false),
    minQtyPerOrder: z.coerce.number().int().min(1).optional(),
    maxQtyPerOrder: z.coerce.number().int().min(1).optional(),
    perUserLimit: z.coerce.number().int().min(1).optional(),
    visibility: z.boolean().default(true),
    priority: z.coerce.number().int().default(0),
  })
  .superRefine((v, ctx) => {
    if (new Date(v.endDate) <= new Date(v.startDate)) {
      ctx.addIssue({
        path: ["endDate"],
        code: z.ZodIssueCode.custom,
        message: "End date must be after start date",
      });
    }
    if (v.discountType === "percentage" && (v.discountValue < 0 || v.discountValue > 100)) {
      ctx.addIssue({
        path: ["discountValue"],
        code: z.ZodIssueCode.custom,
        message: "Percentage must be 0–100",
      });
    }
    if (
      v.maxQtyPerOrder !== undefined &&
      v.minQtyPerOrder !== undefined &&
      v.maxQtyPerOrder < v.minQtyPerOrder
    ) {
      ctx.addIssue({
        path: ["maxQtyPerOrder"],
        code: z.ZodIssueCode.custom,
        message: "Max must be >= min",
      });
    }
  });

type FlashSaleForm = z.infer<typeof createFlashSaleSchema>;

function formToDto(form: FlashSaleForm): CreateFlashSaleDto {
  const split = (s?: string) =>
    s
      ? s
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean)
          .map((x) => (isNaN(Number(x)) ? x : Number(x)))
      : [];
  return {
    title: form.title,
    bannerImage: form.bannerImage || undefined,
    startDate: form.startDate,
    endDate: form.endDate,
    discountType: form.discountType,
    discountValue: form.discountValue,
    applyTo: form.applyTo,
    productIds: form.applyTo === "products" ? split(form.productIds) : undefined,
    categoryIds: form.applyTo === "categories" ? split(form.categoryIds) : undefined,
    excludeOnSale: form.excludeOnSale,
    minQtyPerOrder: form.minQtyPerOrder,
    maxQtyPerOrder: form.maxQtyPerOrder,
    perUserLimit: form.perUserLimit,
    visibility: form.visibility,
    priority: form.priority,
  };
}

export default function NewFlashSalePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams?.get("edit");
  const isEdit = !!editId;

  const methods = useForm<FlashSaleForm>({
    resolver: zodResolver(createFlashSaleSchema),
    defaultValues: {
      title: "",
      bannerImage: "",
      startDate: new Date(Date.now() + 3_600_000).toISOString().slice(0, 16),
      endDate: new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 16),
      discountType: "percentage",
      discountValue: 20,
      applyTo: "all",
      productIds: "",
      categoryIds: "",
      excludeOnSale: true,
      perUserLimit: 3,
      visibility: true,
      priority: 0,
    },
  });
  const { watch, control, reset } = methods;
  const applyTo = watch("applyTo");
  const discountType = watch("discountType");
  const title = watch("title");
  const discountValue = watch("discountValue");

  const [createSale, { isLoading: createLoading }] = useCreateFlashSaleMutation();
  const [updateSale, { isLoading: updateLoading }] = useUpdateFlashSaleMutation();

  const { data: existing } = useGetFlashSaleQuery(editId as string, {
    skip: !isEdit,
  });

  useEffect(() => {
    if (existing && isEdit) {
      reset({
        title: existing.title,
        bannerImage: existing.bannerImage ?? "",
        startDate: existing.startDate.slice(0, 16),
        endDate: existing.endDate.slice(0, 16),
        discountType: existing.discountType,
        discountValue: existing.discountValue,
        applyTo: existing.applyTo,
        productIds: existing.productIds?.join(", ") ?? "",
        categoryIds: existing.categoryIds?.join(", ") ?? "",
        excludeOnSale: existing.excludeOnSale ?? true,
        minQtyPerOrder: existing.minQtyPerOrder,
        maxQtyPerOrder: existing.maxQtyPerOrder,
        perUserLimit: existing.perUserLimit,
        visibility: existing.visibility ?? true,
        priority: existing.priority ?? 0,
      });
    }
  }, [existing, isEdit, reset]);

  const onSubmit = async (data: FlashSaleForm) => {
    try {
      const dto = formToDto(data);
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
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              {isEdit ? "Edit Flash Sale" : "Create Flash Sale"}
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Set up a timed discount campaign with urgency cues.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Eye className="h-4 w-4 mr-2" /> Preview
          </Button>
          <Button
            onClick={methods.handleSubmit(onSubmit)}
            disabled={createLoading || updateLoading}
          >
            {createLoading || updateLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Campaign
          </Button>
        </div>
      </motion.div>

      <FormProvider {...methods}>
        <Form onSubmit={methods.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Campaign</CardTitle>
                  <CardDescription>Banner, title, and scheduling.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Campaign Title</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Mega Eid Sale — Up to 50% OFF" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={control}
                    name="bannerImage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Banner Image URL</FormLabel>
                        <FormControl>
                          <div className="flex gap-2">
                            <Input placeholder="https://.../banner.jpg" {...field} />
                            <Button type="button" variant="outline">
                              <ImagePlus className="h-4 w-4 mr-2" /> Upload
                            </Button>
                          </div>
                        </FormControl>
                        <FormDescription>
                          Recommended 1600×400 px for a crisp storefront banner.
                        </FormDescription>
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
                  <CardDescription>
                    Amount, applicability, and product scope.
                  </CardDescription>
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
                              <SelectItem value="percentage">% OFF</SelectItem>
                              <SelectItem value="fixed">Fixed Amount (৳) OFF</SelectItem>
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
                          <FormLabel>
                            {discountType === "percentage" ? "Percentage" : "Amount (৳)"}
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step={discountType === "percentage" ? "1" : "0.01"}
                              {...field}
                            />
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
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectItem value="all">All Products</SelectItem>
                            <SelectItem value="products">Specific Products</SelectItem>
                            <SelectItem value="categories">Specific Categories</SelectItem>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {applyTo === "products" && (
                    <FormField
                      control={control}
                      name="productIds"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Product IDs (comma-separated)</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. 101, 204, 320" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  {applyTo === "categories" && (
                    <FormField
                      control={control}
                      name="categoryIds"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Category IDs (comma-separated)</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. 5, 12, 22" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <Controller
                    control={control}
                    name="excludeOnSale"
                    render={({ field }) => (
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={!!field.value}
                          onCheckedChange={(v) => field.onChange(v)}
                        />
                        <Label className="text-sm font-normal">
                          Exclude products already on sale
                        </Label>
                      </div>
                    )}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Quantity & Limits</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <FormField
                    control={control}
                    name="minQtyPerOrder"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Min Qty per Order</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="1"
                            {...field}
                            value={field.value ?? ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={control}
                    name="maxQtyPerOrder"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Max Qty per Order</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="Unlimited"
                            {...field}
                            value={field.value ?? ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={control}
                    name="perUserLimit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Per User Limit</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="Unlimited"
                            {...field}
                            value={field.value ?? ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
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
                      <Badge className="bg-white/20 text-white border-0">
                        FLASH SALE
                      </Badge>
                      <Badge className="bg-white text-rose-600 border-0">
                        {discountType === "percentage"
                          ? `${discountValue ?? 0}% OFF`
                          : `${formatMoney(discountValue ?? 0)} OFF`}
                      </Badge>
                    </div>
                    <h3 className="mt-4 text-xl font-bold leading-tight">
                      {title || "Your Campaign Title"}
                    </h3>
                    <p className="mt-1 text-sm text-white/80">Limited time only</p>
                    <Button
                      size="sm"
                      className="mt-4 bg-white text-rose-600 hover:bg-white/90"
                    >
                      Shop Now
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border bg-background p-2.5">
                      <div className="text-[11px] uppercase text-slate-500">
                        Applies to
                      </div>
                      <div className="text-sm font-medium capitalize">{applyTo}</div>
                    </div>
                    <div className="rounded-lg border bg-background p-2.5">
                      <div className="text-[11px] uppercase text-slate-500">
                        Priority
                      </div>
                      <div className="text-sm font-medium">
                        {watch("priority")}
                      </div>
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
                        <Checkbox
                          checked={!!field.value}
                          onCheckedChange={(v) => field.onChange(v)}
                        />
                        <Label className="text-sm font-normal">
                          Visible on storefront
                        </Label>
                      </div>
                    )}
                  />

                  <FormField
                    control={control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Priority Sort Order</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} />
                        </FormControl>
                        <FormDescription>
                          Higher = shown first when multiple sales overlap.
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
