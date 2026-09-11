"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useForm, FormProvider, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CouponType } from "@ecom/shared-types";
import { formatMoney, moneyMul } from "@ecom/utils";
import {
  ArrowLeft,
  Save,
  Wand2,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Input,
  Textarea,
  Select,
  SelectItem,
  Label,
  Checkbox,
  Badge,
  Form,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
  FormField,
} from "@/components/ui";
import {
  useCreateCouponMutation,
  useLazyCheckCouponUniqueQuery,
  useGetCouponQuery,
  useUpdateCouponMutation,
  type CreateCouponDto,
} from "@/lib/features/marketing/marketing-api-slice";

const CouponTypeSchema = z.nativeEnum(CouponType);

const createCouponSchema = z
  .object({
    code: z.string().min(3, "Code must be at least 3 chars").max(50, "Max 50 chars"),
    description: z.string().max(255).optional().or(z.literal("")),
    type: CouponTypeSchema,
    amount: z.coerce.number().min(0, "Amount must be >= 0"),
    minimumSpend: z.coerce.number().min(0).optional(),
    maximumSpend: z.coerce.number().min(0).optional(),
    individualUseOnly: z.boolean().default(false),
    excludeSaleItems: z.boolean().default(false),
    productIds: z.string().optional(),
    excludeProductIds: z.string().optional(),
    categoryIds: z.string().optional(),
    excludeCategoryIds: z.string().optional(),
    allowedEmails: z.string().optional(),
    usageLimit: z.coerce.number().int().min(0).optional(),
    usageLimitPerXCustomers: z.coerce.number().int().min(0).optional(),
    usageLimitPerUser: z.coerce.number().int().min(1).default(1),
    freeShipping: z.boolean().default(false),
    validFrom: z.string().optional().or(z.literal("")),
    validUntil: z.string().optional().or(z.literal("")),
    bogoBuyQty: z.coerce.number().int().min(1).optional(),
    bogoGetQty: z.coerce.number().int().min(1).optional(),
  })
  .superRefine((v, ctx) => {
    if (
      (v.type === CouponType.PERCENT_CART || v.type === CouponType.PERCENT_PRODUCT) &&
      (v.amount < 0 || v.amount > 100)
    ) {
      ctx.addIssue({
        path: ["amount"],
        code: z.ZodIssueCode.custom,
        message: "Percentage must be between 0 and 100",
      });
    }
    if (
      v.maximumSpend !== undefined &&
      v.minimumSpend !== undefined &&
      v.maximumSpend > 0 &&
      v.minimumSpend > v.maximumSpend
    ) {
      ctx.addIssue({
        path: ["maximumSpend"],
        code: z.ZodIssueCode.custom,
        message: "Maximum must be >= minimum",
      });
    }
  });

type CreateCouponForm = z.infer<typeof createCouponSchema>;

function generateRandomCode(): string {
  const prefix = "EID";
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return `${prefix}${out}`;
}

function formToDto(form: CreateCouponForm): CreateCouponDto {
  const split = (s?: string) =>
    s
      ? s
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean)
      : [];
  const splitEmails = (s?: string) =>
    s
      ? s
          .split(/[,;\n]+/)
          .map((x) => x.trim())
          .filter(Boolean)
      : [];
  return {
    code: form.code.trim().toUpperCase(),
    description: form.description || undefined,
    type: form.type,
    amount: form.amount,
    minimumSpend: form.minimumSpend,
    maximumSpend: form.maximumSpend,
    individualUseOnly: form.individualUseOnly,
    excludeSaleItems: form.excludeSaleItems,
    productIds: split(form.productIds).map((x) => isNaN(Number(x)) ? x : Number(x)),
    excludeProductIds: split(form.excludeProductIds).map((x) =>
      isNaN(Number(x)) ? x : Number(x),
    ),
    categoryIds: split(form.categoryIds).map((x) => isNaN(Number(x)) ? x : Number(x)),
    excludeCategoryIds: split(form.excludeCategoryIds).map((x) =>
      isNaN(Number(x)) ? x : Number(x),
    ),
    allowedEmails: splitEmails(form.allowedEmails),
    usageLimit: form.usageLimit,
    usageLimitPerXCustomers: form.usageLimitPerXCustomers,
    usageLimitPerUser: form.usageLimitPerUser,
    freeShipping: form.freeShipping,
    validFrom: form.validFrom || undefined,
    validUntil: form.validUntil || undefined,
    bogoBuyQty: form.bogoBuyQty,
    bogoGetQty: form.bogoGetQty,
  };
}

export default function NewCouponPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const duplicateId = searchParams?.get("duplicate");

  const methods = useForm<CreateCouponForm>({
    resolver: zodResolver(createCouponSchema),
    defaultValues: {
      code: "",
      description: "",
      type: CouponType.PERCENT_CART,
      amount: 10,
      minimumSpend: 0,
      maximumSpend: 0,
      individualUseOnly: false,
      excludeSaleItems: false,
      productIds: "",
      excludeProductIds: "",
      categoryIds: "",
      excludeCategoryIds: "",
      allowedEmails: "",
      usageLimitPerUser: 1,
      freeShipping: false,
      validFrom: "",
      validUntil: "",
      bogoBuyQty: 1,
      bogoGetQty: 1,
    },
  });

  const { watch, control, setValue, reset } = methods;
  const type = watch("type");
  const code = watch("code");
  const amount = watch("amount");
  const freeShipping = watch("freeShipping");

  const [createCoupon, createLoading] = useCreateCouponMutation();
  const [updateCoupon, updateLoading] = useUpdateCouponMutation();
  const [checkUnique, checkState] = useLazyCheckCouponUniqueQuery();
  const [uniquenessState, setUniquenessState] = useState<
    "idle" | "checking" | "unique" | "taken"
  >("idle");

  const isEdit = !!duplicateId;

  const { data: existing } = useGetCouponQuery(duplicateId as string, {
    skip: !isEdit,
  });

  useEffect(() => {
    if (existing && isEdit) {
      reset({
        code: existing.code,
        description: existing.description ?? "",
        type: existing.type,
        amount: existing.amount,
        minimumSpend: existing.minimumSpend ?? 0,
        maximumSpend: existing.maximumSpend ?? 0,
        individualUseOnly: existing.individualUseOnly ?? false,
        excludeSaleItems: existing.excludeSaleItems ?? false,
        productIds: existing.productIds?.join(", ") ?? "",
        excludeProductIds: existing.excludeProductIds?.join(", ") ?? "",
        categoryIds: existing.categoryIds?.join(", ") ?? "",
        excludeCategoryIds: existing.excludeCategoryIds?.join(", ") ?? "",
        allowedEmails: existing.allowedEmails?.join(", ") ?? "",
        usageLimit: existing.usageLimit,
        usageLimitPerXCustomers: existing.usageLimitPerXCustomers,
        usageLimitPerUser: existing.usageLimitPerUser ?? 1,
        freeShipping: existing.freeShipping ?? false,
        validFrom: existing.validFrom?.slice(0, 16) ?? "",
        validUntil: existing.validUntil?.slice(0, 16) ?? "",
        bogoBuyQty: existing.bogoBuyQty ?? 1,
        bogoGetQty: existing.bogoGetQty ?? 1,
      });
    }
  }, [existing, isEdit, reset]);

  useEffect(() => {
    if (!code || code.length < 3) {
      setUniquenessState("idle");
      return;
    }
    setUniquenessState("checking");
    const t = setTimeout(async () => {
      try {
        const res = await checkUnique(code).unwrap();
        setUniquenessState(res.unique ? "unique" : "taken");
      } catch {
        setUniquenessState("idle");
      }
    }, 400);
    return () => clearTimeout(t);
  }, [code, checkUnique]);

  const previewSaved = useMemo(() => {
    const exampleSubtotal = 5000;
    switch (type) {
      case CouponType.FIXED_CART:
        return Math.min(amount, exampleSubtotal);
      case CouponType.PERCENT_CART:
        return moneyMul(exampleSubtotal, amount / 100);
      case CouponType.FIXED_PRODUCT:
      case CouponType.PERCENT_PRODUCT:
        return 0;
      case CouponType.BUY_X_GET_Y:
        return 0;
      case CouponType.FREE_SHIPPING:
        return 0;
      case CouponType.STORE_CREDIT:
        return amount;
      default:
        return 0;
    }
  }, [type, amount]);

  const onSubmit = async (data: CreateCouponForm) => {
    if (uniquenessState === "taken") {
      toast.error("Coupon code is already in use.");
      return;
    }
    try {
      const dto = formToDto(data);
      if (isEdit && duplicateId) {
        await updateCoupon({ id: duplicateId, body: dto }).unwrap();
        toast.success("Coupon updated.");
      } else {
        await createCoupon(dto).unwrap();
        toast.success("Coupon created.");
      }
      router.push("/marketing/coupons");
    } catch (e: any) {
      toast.error(e?.data?.message || "Failed to save coupon.");
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
          <Link href="/marketing/coupons">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              {isEdit ? "Edit Coupon" : "Create Coupon"}
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Configure discount rules, restrictions, and validity.
            </p>
          </div>
        </div>
        <Button onClick={methods.handleSubmit(onSubmit)} disabled={createLoading || updateLoading}>
          {createLoading || updateLoading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save Coupon
        </Button>
      </motion.div>

      <FormProvider {...methods}>
        <Form onSubmit={methods.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Basics</CardTitle>
                  <CardDescription>
                    Coupon code, type, and discount amount.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={control}
                    name="code"
                    render={({ field, fieldState }) => (
                      <FormItem>
                        <FormLabel>Coupon Code</FormLabel>
                        <FormControl>
                          <div className="flex gap-2">
                            <Input
                              {...field}
                              placeholder="e.g. EID20OFF"
                              className="uppercase font-mono tracking-wider"
                              onChange={(e) =>
                                field.onChange(e.target.value.toUpperCase())
                              }
                            />
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => {
                                setValue("code", generateRandomCode(), {
                                  shouldDirty: true,
                                  shouldTouch: true,
                                });
                              }}
                            >
                              <Wand2 className="h-4 w-4 mr-2" /> Generate
                            </Button>
                          </div>
                        </FormControl>
                        <div className="flex items-center gap-2 text-xs">
                          {uniquenessState === "checking" && (
                            <span className="text-slate-500 flex items-center gap-1">
                              <Loader2 className="h-3 w-3 animate-spin" /> Checking
                              uniqueness…
                            </span>
                          )}
                          {uniquenessState === "unique" && (
                            <span className="text-green-600 flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" /> Code is unique
                            </span>
                          )}
                          {uniquenessState === "taken" && (
                            <span className="text-red-600 flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" /> Code already exists
                            </span>
                          )}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Internal Description</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            rows={2}
                            placeholder="For admin eyes only — why this coupon exists."
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField
                      control={control}
                      name="type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Discount Type</FormLabel>
                          <FormControl>
                            <Select value={field.value} onValueChange={field.onChange}>
                              {Object.values(CouponType).map((t) => (
                                <SelectItem key={t} value={t}>
                                  {t.replace(/_/g, " ")}
                                </SelectItem>
                              ))}
                            </Select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {type !== CouponType.BUY_X_GET_Y &&
                      type !== CouponType.FREE_SHIPPING && (
                        <FormField
                          control={control}
                          name="amount"
                          render={({ field, fieldState }) => (
                            <FormItem>
                              <FormLabel>
                                {type === CouponType.FIXED_CART ||
                                type === CouponType.FIXED_PRODUCT ||
                                type === CouponType.STORE_CREDIT
                                  ? "Amount (৳)"
                                  : "Discount %"}
                              </FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  step={
                                    type === CouponType.PERCENT_CART ||
                                    type === CouponType.PERCENT_PRODUCT
                                      ? "1"
                                      : "0.01"
                                  }
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}

                    {type === CouponType.BUY_X_GET_Y && (
                      <>
                        <FormField
                          control={control}
                          name="bogoBuyQty"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Buy Quantity</FormLabel>
                              <FormControl>
                                <Input type="number" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={control}
                          name="bogoGetQty"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Get Quantity</FormLabel>
                              <FormControl>
                                <Input type="number" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </>
                    )}
                  </div>

                  {type === CouponType.FREE_SHIPPING && (
                    <div className="rounded-md bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/30 p-3 text-sm text-cyan-800 dark:text-cyan-200">
                      <Sparkles className="h-4 w-4 inline mr-1" />
                      This coupon will grant free shipping. Toggle Free Shipping below to
                      enable.
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Spend Restrictions</CardTitle>
                  <CardDescription>
                    Cart-level limits before this coupon applies.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={control}
                    name="minimumSpend"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Minimum Subtotal (৳)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={control}
                    name="maximumSpend"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Maximum Subtotal (৳)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Applicability</CardTitle>
                  <CardDescription>
                    Products, categories, and customer restrictions.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <FormField
                      control={control}
                      name="productIds"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Include Products (IDs, comma-separated)</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. 101, 204, 320" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={control}
                      name="excludeProductIds"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Exclude Products</FormLabel>
                          <FormControl>
                            <Input placeholder="IDs separated by comma" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={control}
                      name="categoryIds"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Include Categories</FormLabel>
                          <FormControl>
                            <Input placeholder="IDs separated by comma" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={control}
                      name="excludeCategoryIds"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Exclude Categories</FormLabel>
                          <FormControl>
                            <Input placeholder="IDs separated by comma" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={control}
                    name="allowedEmails"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Allowed Customer Emails</FormLabel>
                        <FormControl>
                          <Textarea
                            rows={2}
                            placeholder="customer@example.com, partner@corp.com…"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Comma, semicolon, or newline separated. Leave empty to allow all.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex flex-wrap gap-4 pt-2">
                    <Controller
                      control={control}
                      name="individualUseOnly"
                      render={({ field }) => (
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={!!field.value}
                            onCheckedChange={(v) => field.onChange(v)}
                          />
                          <Label className="text-sm font-normal">Individual use only</Label>
                        </div>
                      )}
                    />
                    <Controller
                      control={control}
                      name="excludeSaleItems"
                      render={({ field }) => (
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={!!field.value}
                            onCheckedChange={(v) => field.onChange(v)}
                          />
                          <Label className="text-sm font-normal">Exclude sale items</Label>
                        </div>
                      )}
                    />
                    <Controller
                      control={control}
                      name="freeShipping"
                      render={({ field }) => (
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={!!field.value}
                            onCheckedChange={(v) => field.onChange(v)}
                          />
                          <Label className="text-sm font-normal">Free shipping</Label>
                        </div>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Usage Limits</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={control}
                    name="usageLimit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Usage limit per coupon</FormLabel>
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
                    name="usageLimitPerXCustomers"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Usage limit per X customers</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="—"
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
                    name="usageLimitPerUser"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Usage limit per user</FormLabel>
                        <FormControl>
                          <Input type="number" min={1} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Validity</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={control}
                    name="validFrom"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Valid From</FormLabel>
                        <FormControl>
                          <Input type="datetime-local" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={control}
                    name="validUntil"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Expires On</FormLabel>
                        <FormControl>
                          <Input type="datetime-local" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <Card className="border-2 border-amber-200 dark:border-amber-500/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-amber-500" /> Preview Savings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Example cart subtotal</span>
                    <span>{formatMoney(5000)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-green-600 dark:text-green-400 font-medium">
                    <span>Saved</span>
                    <span>− {formatMoney(previewSaved)}</span>
                  </div>
                  <div className="h-px bg-slate-200 dark:bg-slate-700 my-2" />
                  <div className="flex justify-between font-semibold">
                    <span>Final cart</span>
                    <span>{formatMoney(5000 - previewSaved)}</span>
                  </div>
                  {freeShipping && (
                    <Badge variant="outline" className="mt-2 w-full justify-center">
                      + Free shipping included
                    </Badge>
                  )}
                  {(type === CouponType.FIXED_PRODUCT ||
                    type === CouponType.PERCENT_PRODUCT ||
                    type === CouponType.BUY_X_GET_Y) && (
                    <p className="text-xs text-slate-500 mt-2">
                      Preview unavailable for product-level coupons — depends on cart
                      composition.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </Form>
      </FormProvider>
    </div>
  );
}
