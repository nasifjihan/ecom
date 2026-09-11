"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Plus,
  Search,
  Trash2,
  Edit3,
  Check,
  X,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Palette,
  ListChecks,
  CircleDot,
  Image,
  SlidersHorizontal,
  GripVertical,
  Tag,
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
  Form,
  FormProvider,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  Skeleton,
  ScrollArea,
  Separator,
  cn,
} from "@/components/ui";
import {
  useGetAttributeListQuery,
  useCreateAttributeMutation,
  useCreateTermMutation,
  useDeleteTermMutation,
  useDeleteAttributeMutation,
  type ProductAttribute,
  type AttributeTerm,
} from "@/lib/features/catalog/catalog-api-slice";

const attributeSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters" }).max(255),
  slug: z
    .string()
    .max(200)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
      message: "Slug must contain only lowercase letters, numbers, and hyphens",
    })
    .optional()
    .or(z.literal("")),
  type: z.enum(["select", "radio", "swatch-color", "swatch-image"]).default("select"),
  isActive: z.boolean().default(true),
  isGlobal: z.boolean().default(true),
  isFilterable: z.boolean().default(true),
  sortOrder: z.coerce.number().int().default(0),
});

type AttributeFormValues = z.infer<typeof attributeSchema>;

const termSchema = z.object({
  name: z.string().min(1, { message: "Term name is required" }).max(255),
  slug: z.string().optional().or(z.literal("")),
  value: z.string().optional().or(z.literal("")),
  sortOrder: z.coerce.number().int().default(0),
  swatchUrl: z.string().optional().or(z.literal("")),
});

type TermFormValues = z.infer<typeof termSchema>;

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

const ATTR_TYPES = [
  { value: "select", label: "Dropdown / Select", icon: ListChecks },
  { value: "radio", label: "Radio Buttons", icon: CircleDot },
  { value: "swatch-color", label: "Color Swatch", icon: Palette },
  { value: "swatch-image", label: "Image Swatch", icon: Image },
];

function TypeBadge({ type }: { type: string }) {
  const t = type?.toLowerCase();
  const info = ATTR_TYPES.find((a) => a.value === t) || ATTR_TYPES[0];
  const Icon = info.icon;
  return (
    <Badge variant="outline" className="gap-1.5 px-2">
      <Icon className="h-3 w-3" />
      {info.label}
    </Badge>
  );
}

function SwatchPreview({ term, type }: { term: AttributeTerm; type: string }) {
  const t = type?.toLowerCase();
  if (t === "swatch-color") {
    const color = term.value || term.slug || "#ccc";
    return (
      <div
        className={cn(
          "h-6 w-6 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm shrink-0",
          term.swatchUrl || /^#|^rgb|^hsl/.test(color) ? "" : "bg-gradient-to-br from-slate-200 to-slate-400"
        )}
        style={{
          backgroundColor: /^#|^rgb|^hsl/.test(color) ? color : undefined,
          backgroundImage: term.swatchUrl ? `url(${term.swatchUrl})` : undefined,
          backgroundSize: "cover",
        }}
        title={term.name}
      />
    );
  }
  if (t === "swatch-image" && (term.swatchUrl || term.value)) {
    return (
      <div className="h-7 w-7 rounded-md border border-slate-200 dark:border-slate-700 overflow-hidden shrink-0 bg-slate-100 dark:bg-slate-800">
        <img
          src={term.swatchUrl || term.value || ""}
          alt={term.name}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }
  return (
    <div className="h-6 w-6 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center justify-center shrink-0">
      <SlidersHorizontal className="h-3 w-3 text-slate-400" />
    </div>
  );
}

export default function AttributesPage() {
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | number | null>(null);

  const { data: attributes, isLoading, refetch } = useGetAttributeListQuery();
  const [createAttribute, { isLoading: isCreating }] = useCreateAttributeMutation();
  const [createTerm, { isLoading: isCreatingTerm }] = useCreateTermMutation();
  const [deleteTerm, { isLoading: isDeletingTerm }] = useDeleteTermMutation();
  const [deleteAttribute] = useDeleteAttributeMutation();

  const attrMethods = useForm<AttributeFormValues>({
    resolver: zodResolver(attributeSchema),
    defaultValues: {
      name: "",
      slug: "",
      type: "select",
      isActive: true,
      isGlobal: true,
      isFilterable: true,
      sortOrder: 0,
    },
    mode: "onSubmit",
  });

  const [termAttrId, setTermAttrId] = useState<string | number | null>(null);
  const termMethods = useForm<TermFormValues>({
    resolver: zodResolver(termSchema),
    defaultValues: {
      name: "",
      slug: "",
      value: "",
      sortOrder: 0,
      swatchUrl: "",
    },
    mode: "onSubmit",
  });

  const filteredAttrs = (attributes || []).filter((a) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      a.name.toLowerCase().includes(q) ||
      a.slug.toLowerCase().includes(q) ||
      (a.terms || []).some((t) => t.name.toLowerCase().includes(q))
    );
  });

  const handleCreateAttr = async (values: AttributeFormValues) => {
    try {
      await createAttribute({
        name: values.name,
        slug: values.slug || slugify(values.name),
        type: values.type,
        isActive: values.isActive,
        isFilterable: values.isFilterable,
        sortOrder: values.sortOrder,
      } as any).unwrap();
      toast.success("Attribute created successfully");
      attrMethods.reset();
      setExpandedId(null);
    } catch (err: any) {
      const msg = err?.data?.message;
      if (typeof msg === "string") toast.error(msg);
      else if (typeof msg === "object") {
        Object.entries(msg).forEach(([k, v]) => {
          if (Array.isArray(v)) toast.error(`${k}: ${v[0]}`);
        });
      } else {
        toast.error("Failed to create attribute");
      }
    }
  };

  const handleCreateTerm = async (values: TermFormValues) => {
    if (!termAttrId) return;
    try {
      await createTerm({
        attributeId: termAttrId,
        body: {
          name: values.name,
          slug: values.slug || slugify(values.name),
          value: values.value || null,
          sortOrder: values.sortOrder,
          swatchUrl: values.swatchUrl || null,
        },
      }).unwrap();
      toast.success("Term added");
      termMethods.reset();
    } catch (err: any) {
      const msg = err?.data?.message;
      if (typeof msg === "string") toast.error(msg);
      else toast.error("Failed to add term");
    }
  };

  const handleDeleteTerm = async (termId: string | number) => {
    try {
      await deleteTerm(termId).unwrap();
      toast.success("Term removed");
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to delete term");
    }
  };

  const handleDeleteAttribute = async (attr: ProductAttribute) => {
    if (!confirm(`Delete attribute "${attr.name}" and all its terms?`)) return;
    try {
      await deleteAttribute(attr.id).unwrap();
      toast.success("Attribute deleted");
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to delete");
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Attributes</h1>
          <p className="text-sm text-muted-foreground">
            Define global attributes like Size, Color, Material and their possible values.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <Card className="border-primary/30 shadow-md">
            <CardHeader className="bg-gradient-to-r from-primary/10 to-transparent rounded-t-lg">
              <CardTitle className="text-lg flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
                  <Plus className="h-4 w-4" />
                </div>
                Create Attribute
              </CardTitle>
              <CardDescription>
                Define a new product attribute (e.g. Size, Color).
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <FormProvider {...attrMethods}>
                <Form onSubmit={attrMethods.handleSubmit(handleCreateAttr)} className="space-y-5">
                  <FormField
                    control={attrMethods.control}
                    name="name"
                    render={({ field, fieldState }) => (
                      <FormItem>
                        <FormLabel>Attribute Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Color, Size, Material" {...field} />
                        </FormControl>
                        <FormMessage>{fieldState.error?.message}</FormMessage>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={attrMethods.control}
                    name="slug"
                    render={({ field, fieldState }) => (
                      <FormItem>
                        <FormLabel>Slug</FormLabel>
                        <FormControl>
                          <Input placeholder="auto-generated" {...field} />
                        </FormControl>
                        <FormMessage>{fieldState.error?.message}</FormMessage>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={attrMethods.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Display Type</FormLabel>
                        <FormControl>
                          <Select value={field.value} onValueChange={field.onChange}>
                            {ATTR_TYPES.map((t) => (
                              <SelectItem key={t.value} value={t.value}>
                                <span className="flex items-center gap-2 inline-flex">
                                  <t.icon className="h-4 w-4" />
                                  {t.label}
                                </span>
                              </SelectItem>
                            ))}
                          </Select>
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={attrMethods.control}
                      name="sortOrder"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Sort Order</FormLabel>
                          <FormControl>
                            <Input type="number" step="1" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={attrMethods.control}
                      name="isActive"
                      render={({ field }) => (
                        <FormItem className="flex flex-col justify-end h-full">
                          <FormLabel>Status</FormLabel>
                          <FormControl>
                            <div className="flex items-center h-10 px-3 space-x-2 rounded-md border border-input bg-background">
                              <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                              <span className="text-sm">Active</span>
                            </div>
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={attrMethods.control}
                      name="isGlobal"
                      render={({ field }) => (
                        <FormItem className="flex items-start gap-2 flex-row">
                          <FormControl>
                            <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                          <div>
                            <FormLabel className="cursor-pointer">Global</FormLabel>
                            <p className="text-xs text-muted-foreground">
                              Available across all product types
                            </p>
                          </div>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={attrMethods.control}
                      name="isFilterable"
                      render={({ field }) => (
                        <FormItem className="flex items-start gap-2 flex-row">
                          <FormControl>
                            <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                          <div>
                            <FormLabel className="cursor-pointer">Filterable</FormLabel>
                            <p className="text-xs text-muted-foreground">Show in product filters</p>
                          </div>
                        </FormItem>
                      )}
                    />
                  </div>

                  <Separator />
                  <Button type="submit" className="w-full" disabled={isCreating}>
                    {isCreating ? (
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="mr-2 h-4 w-4" />
                    )}
                    Create Attribute
                  </Button>
                </Form>
              </FormProvider>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardContent className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search attributes or terms..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-6 w-6 rounded" />
                      <Skeleton className="h-5 w-40" />
                      <Skeleton className="h-5 w-24 ml-auto" />
                    </div>
                    <div className="mt-4 space-y-2 pl-9">
                      <Skeleton className="h-8 w-full rounded" />
                      <Skeleton className="h-8 w-full rounded" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredAttrs.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-20 text-center">
                <div className="h-20 w-20 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center mb-6">
                  <Tag className="h-10 w-10 text-indigo-600 dark:text-indigo-400" />
                </div>
                <h2 className="text-xl font-semibold mb-2">No attributes yet</h2>
                <p className="text-muted-foreground max-w-sm mb-6">
                  Create attributes like Size, Color, Material that customers can use to filter and select product variants.
                </p>
                <p className="text-xs text-muted-foreground">
                  Tip: Use the form on the left to add your first attribute.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredAttrs.map((attr) => {
                const isExpanded = expandedId === attr.id;
                const terms = attr.terms || [];
                return (
                  <Card key={String(attr.id)} className="overflow-hidden">
                    <div
                      className="p-4 flex items-center gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors"
                      onClick={() => setExpandedId(isExpanded ? null : attr.id)}
                    >
                      <div className="flex items-center justify-center h-10 w-10 rounded-md bg-primary/10 text-primary shrink-0">
                        <SlidersHorizontal className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold">{attr.name}</h3>
                          <TypeBadge type={attr.type} />
                          {attr.isFilterable && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                              Filterable
                            </Badge>
                          )}
                          {attr.isActive === false && (
                            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                              Inactive
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <code className="text-xs text-muted-foreground">{attr.slug}</code>
                          <span className="text-xs text-muted-foreground">•</span>
                          <span className="text-xs text-muted-foreground">{terms.length} term(s)</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toast.info(`Edit: ${attr.name} (edit not implemented in this batch)`)}
                          className="text-muted-foreground"
                        >
                          <Edit3 className="h-3.5 w-3.5 mr-1" />
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteAttribute(attr)}
                          className="text-red-500 hover:text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                        {isExpanded ? (
                          <ChevronDown className="h-5 w-5 text-muted-foreground ml-1" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-muted-foreground ml-1" />
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <>
                        <Separator />
                        <CardContent className="pt-5 pb-5 space-y-5">
                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <Label className="text-sm font-medium flex items-center gap-1.5">
                                <Tag className="h-3.5 w-3.5" />
                                Terms / Values
                              </Label>
                              <span className="text-xs text-muted-foreground">
                                {terms.length} item{terms.length !== 1 ? "s" : ""}
                              </span>
                            </div>

                            <div className="space-y-2 mb-5">
                              {terms.length === 0 ? (
                                <div className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-md">
                                  No terms yet. Add your first value below.
                                </div>
                              ) : (
                                terms.map((term, idx) => (
                                  <div
                                    key={String(term.id ?? idx)}
                                    className="flex items-center gap-3 p-2.5 rounded-md border bg-slate-50/50 dark:bg-slate-900/30 hover:bg-slate-100 dark:hover:bg-slate-900/50 group transition-colors"
                                  >
                                    <GripVertical className="h-4 w-4 text-slate-400 cursor-grab opacity-50 group-hover:opacity-100 shrink-0" />
                                    <SwatchPreview term={term} type={attr.type} />
                                    <div className="flex-1 min-w-0">
                                      <div className="font-medium text-sm">{term.name}</div>
                                      <div className="text-xs text-muted-foreground truncate">
                                        slug: {term.slug || "—"}
                                        {term.value && ` • value: ${term.value}`}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                      <span className="text-xs tabular-nums text-muted-foreground">
                                        #{term.sortOrder ?? idx}
                                      </span>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleDeleteTerm(term.id!)}
                                        disabled={isDeletingTerm || !term.id}
                                        title="Remove term"
                                        className="h-8 w-8 text-slate-400 hover:text-red-500"
                                      >
                                        <X className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>

                            <div className="p-4 rounded-lg border bg-slate-50 dark:bg-slate-900/30">
                              <div className="flex items-center gap-2 mb-3">
                                <div className="h-7 w-7 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                  <Plus className="h-3.5 w-3.5" />
                                </div>
                                <span className="text-sm font-medium">Add New Term</span>
                              </div>
                              <FormProvider {...termMethods}>
                                <Form
                                  onSubmit={termMethods.handleSubmit(handleCreateTerm)}
                                  onFocus={() => setTermAttrId(attr.id)}
                                  className="grid grid-cols-1 md:grid-cols-12 gap-3"
                                >
                                  <FormField
                                    control={termMethods.control}
                                    name="name"
                                    render={({ field, fieldState }) => (
                                      <FormItem className="md:col-span-4">
                                        <FormLabel className="text-xs text-muted-foreground">
                                          Term Name *
                                        </FormLabel>
                                        <FormControl>
                                          <Input placeholder="e.g. Red, XL, Cotton" {...field} size={undefined as any} />
                                        </FormControl>
                                        <FormMessage className="text-xs">{fieldState.error?.message}</FormMessage>
                                      </FormItem>
                                    )}
                                  />

                                  <FormField
                                    control={termMethods.control}
                                    name="slug"
                                    render={({ field }) => (
                                      <FormItem className="md:col-span-3">
                                        <FormLabel className="text-xs text-muted-foreground">Slug</FormLabel>
                                        <FormControl>
                                          <Input placeholder="auto" {...field} size={undefined as any} />
                                        </FormControl>
                                      </FormItem>
                                    )}
                                  />

                                  {(attr.type === "swatch-color" || attr.type === "swatch-image" || true) && (
                                    <FormField
                                      control={termMethods.control}
                                      name={attr.type === "swatch-color" ? "value" : "swatchUrl"}
                                      render={({ field }) => (
                                        <FormItem className="md:col-span-3">
                                          <FormLabel className="text-xs text-muted-foreground">
                                            {attr.type === "swatch-color"
                                              ? "Color (hex)"
                                              : attr.type === "swatch-image"
                                                ? "Image URL"
                                                : "Value / Metadata"}
                                          </FormLabel>
                                          <FormControl>
                                            <Input
                                              placeholder={
                                                attr.type === "swatch-color"
                                                  ? "#ff0000"
                                                  : attr.type === "swatch-image"
                                                    ? "https://..."
                                                    : "Optional"
                                              }
                                              {...field}
                                              size={undefined as any}
                                            />
                                          </FormControl>
                                        </FormItem>
                                      )}
                                    />
                                  )}

                                  <FormField
                                    control={termMethods.control}
                                    name="sortOrder"
                                    render={({ field }) => (
                                      <FormItem className="md:col-span-2">
                                        <FormLabel className="text-xs text-muted-foreground">Order</FormLabel>
                                        <FormControl>
                                          <Input type="number" step="1" {...field} size={undefined as any} />
                                        </FormControl>
                                      </FormItem>
                                    )}
                                  />

                                  <div className="md:col-span-12 flex items-end justify-end pt-1">
                                    <Button
                                      type="submit"
                                      size="sm"
                                      disabled={isCreatingTerm}
                                      onClick={() => setTermAttrId(attr.id)}
                                    >
                                      {isCreatingTerm ? (
                                        <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                      ) : (
                                        <Plus className="mr-1.5 h-3.5 w-3.5" />
                                      )}
                                      Add Term
                                    </Button>
                                  </div>
                                </Form>
                              </FormProvider>
                            </div>
                          </div>
                        </CardContent>
                      </>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
