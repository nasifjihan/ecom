"use client";

import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  useReactTable,
  getCoreRowModel,
  type ColumnDef,
  type RowSelectionState,
  flexRender,
} from "@tanstack/react-table";
import {
  Plus,
  Search,
  Trash2,
  Edit3,
  Folder,
  FolderPlus,
  X,
  RefreshCw,
  Check,
  ChevronRight,
  Home,
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
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Skeleton,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  ScrollArea,
  Separator,
  cn,
} from "@/components/ui";
import {
  useGetCategoriesQuery,
  useGetCategoryTreeQuery,
  useCreateCategoryMutation,
  useUpdateCategoryMutation,
  useDeleteCategoryMutation,
  type Category,
} from "@/lib/features/catalog/catalog-api-slice";

const categorySchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters" }).max(255),
  slug: z
    .string()
    .max(200)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
      message: "Slug must contain only lowercase letters, numbers, and hyphens",
    })
    .optional()
    .or(z.literal("")),
  parentId: z.string().optional().or(z.literal("")),
  description: z.string().max(5000).optional().or(z.literal("")),
  imageUrl: z.string().max(500).optional().or(z.literal("")),
  displayMode: z.enum(["products", "children", "both"]).default("products"),
  sortOrder: z.coerce.number().int().default(0),
  isActive: z.boolean().default(true),
  seoTitle: z.string().max(255).optional().or(z.literal("")),
  metaDesc: z.string().max(500).optional().or(z.literal("")),
});

type CategoryFormValues = z.infer<typeof categorySchema>;

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function flattenWithDepth(categories: Category[], depth = 0): (Category & { depth: number })[] {
  const result: (Category & { depth: number })[] = [];
  for (const cat of categories) {
    result.push({ ...cat, depth });
    if (cat.children && cat.children.length > 0) {
      result.push(...flattenWithDepth(cat.children, depth + 1));
    }
  }
  return result;
}

function DisplayModeBadge({ mode }: { mode?: string }) {
  const m = mode?.toLowerCase();
  if (m === "both") {
    return <Badge variant="default">Products + Children</Badge>;
  }
  if (m === "children") {
    return <Badge variant="secondary">Subcategories</Badge>;
  }
  return <Badge variant="outline">Products</Badge>;
}

function DeleteDialog({
  open,
  onOpenChange,
  onConfirm,
  name,
  loading,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onConfirm: () => void;
  name?: string;
  loading?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Category{name ? `: ${name}` : ""}</DialogTitle>
          <DialogDescription>
            This action cannot be undone. Any subcategories may become orphaned.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={loading}>
            {loading ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function CategoriesPage() {
  const [search, setSearch] = useState("");
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id?: string | number; name?: string }>({
    open: false,
  });
  const [breadcrumbs, setBreadcrumbs] = useState<Category[]>([]);

  const { data: categoriesFlat, isLoading: isLoadingFlat } = useGetCategoriesQuery();
  const { data: categoryTree, isLoading: isLoadingTree, refetch } = useGetCategoryTreeQuery();

  const [createCategory, { isLoading: isCreating }] = useCreateCategoryMutation();
  const [updateCategory, { isLoading: isUpdating }] = useUpdateCategoryMutation();
  const [deleteCategory, { isLoading: isDeleting }] = useDeleteCategoryMutation();

  const flatWithDepth = useMemo(() => {
    if (categoryTree && categoryTree.length > 0) {
      return flattenWithDepth(categoryTree);
    }
    return (categoriesFlat || []).map((c) => ({ ...c, depth: (c as any).depth || 0 }));
  }, [categoryTree, categoriesFlat]);

  const filteredCategories = useMemo(() => {
    if (!search.trim()) return flatWithDepth;
    const q = search.toLowerCase();
    return flatWithDepth.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.slug.toLowerCase().includes(q) ||
        (c.description && c.description.toLowerCase().includes(q))
    );
  }, [flatWithDepth, search]);

  const defaultValues: CategoryFormValues = {
    name: "",
    slug: "",
    parentId: "",
    description: "",
    imageUrl: "",
    displayMode: "products",
    sortOrder: 0,
    isActive: true,
    seoTitle: "",
    metaDesc: "",
  };

  const methods = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues,
    mode: "onSubmit",
  });

  const { watch, setValue, reset, control, handleSubmit } = methods;
  const nameValue = watch("name");

  useEffect(() => {
    if (nameValue && !editingId && !watch("slug")) {
      setValue("slug", slugify(nameValue), { shouldValidate: false });
    }
  }, [nameValue, editingId, setValue, watch]);

  useEffect(() => {
    if (editingId) {
      const editing = flatWithDepth.find((c) => String(c.id) === String(editingId));
      if (editing) {
        reset({
          name: editing.name,
          slug: editing.slug,
          parentId: editing.parentId ? String(editing.parentId) : "",
          description: editing.description || "",
          imageUrl: editing.imageUrl || "",
          displayMode: (editing.displayMode as any) || "products",
          sortOrder: editing.sortOrder ?? 0,
          isActive: editing.isActive !== false,
          seoTitle: editing.seoTitle || "",
          metaDesc: editing.metaDesc || "",
        });
      }
    } else {
      reset(defaultValues);
    }
  }, [editingId, flatWithDepth, reset]);

  const onSubmit = async (values: CategoryFormValues) => {
    try {
      const body = {
        name: values.name,
        slug: values.slug || slugify(values.name),
        parentId: values.parentId ? (BigInt(values.parentId) as any) : null,
        description: values.description || null,
        imageUrl: values.imageUrl || null,
        displayMode: values.displayMode,
        sortOrder: values.sortOrder,
        isActive: values.isActive,
        seoTitle: values.seoTitle || null,
        metaDesc: values.metaDesc || null,
      };
      if (editingId) {
        await updateCategory({ id: editingId, body }).unwrap();
        toast.success("Category updated successfully");
        setEditingId(null);
      } else {
        await createCategory(body).unwrap();
        toast.success("Category created successfully");
      }
      reset(defaultValues);
    } catch (err: any) {
      const msg = err?.data?.message;
      if (typeof msg === "string") toast.error(msg);
      else if (typeof msg === "object") {
        Object.entries(msg).forEach(([k, v]) => {
          if (Array.isArray(v)) toast.error(`${k}: ${v[0]}`);
        });
      } else {
        toast.error(editingId ? "Failed to update category" : "Failed to create category");
      }
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteDialog.id) return;
    try {
      await deleteCategory(deleteDialog.id).unwrap();
      toast.success("Category deleted successfully");
      setDeleteDialog({ open: false });
      if (editingId === deleteDialog.id) {
        setEditingId(null);
      }
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to delete category");
    }
  };

  const columns: ColumnDef<Category & { depth: number }>[] = useMemo(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
          />
        ),
        size: 40,
        enableSorting: false,
        enableHiding: false,
      },
      {
        id: "name",
        header: "Name",
        cell: ({ row }) => {
          const c = row.original;
          const indent = c.depth || 0;
          return (
            <div className="flex items-center gap-2">
              <div className="flex-shrink-0 h-10 w-10 rounded-md border bg-slate-100 dark:bg-slate-800 overflow-hidden flex items-center justify-center">
                {c.imageUrl ? (
                  <img src={c.imageUrl} alt={c.name} className="w-full h-full object-cover" />
                ) : (
                  <Folder className="h-4 w-4 text-slate-400" />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span style={{ width: indent * 16 }} className="flex-shrink-0 inline-block">
                    {indent > 0 && (
                      <span className="text-slate-400">
                        {"— ".repeat(indent)}
                      </span>
                    )}
                  </span>
                  <button
                    onClick={() => setEditingId(c.id)}
                    className="font-medium text-left hover:text-primary hover:underline truncate"
                  >
                    {c.name}
                  </button>
                </div>
              </div>
            </div>
          );
        },
      },
      {
        id: "slug",
        header: "Slug",
        cell: ({ row }) => (
          <code className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-slate-600 dark:text-slate-300">
            {row.original.slug}
          </code>
        ),
      },
      {
        id: "parent",
        header: "Parent",
        cell: ({ row }) => {
          const p = row.original.parent;
          if (p) {
            return <span className="text-sm">{p.name}</span>;
          }
          const parentId = row.original.parentId;
          if (parentId) {
            const parent = categoriesFlat?.find((c) => String(c.id) === String(parentId));
            return <span className="text-sm">{parent?.name || "—"}</span>;
          }
          return <span className="text-muted-foreground text-sm">—</span>;
        },
      },
      {
        id: "productCount",
        header: "Products",
        cell: ({ row }) => (
          <Badge variant="outline" className="font-normal">
            {row.original.productCount ?? 0}
          </Badge>
        ),
      },
      {
        id: "displayMode",
        header: "Display",
        cell: ({ row }) => <DisplayModeBadge mode={row.original.displayMode} />,
      },
      {
        id: "sortOrder",
        header: "Sort",
        cell: ({ row }) => <span className="text-sm tabular-nums">{row.original.sortOrder ?? 0}</span>,
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => {
          const active = row.original.isActive !== false;
          if (active) {
            return (
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-green-500" />
                <span className="text-sm">Active</span>
              </div>
            );
          }
          return (
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-slate-400" />
              <span className="text-sm text-muted-foreground">Inactive</span>
            </div>
          );
        },
      },
      {
        id: "actions",
        header: "Actions",
        size: 120,
        cell: ({ row }) => {
          const c = row.original;
          return (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setEditingId(c.id)}
                title="Edit"
              >
                <Edit3 className="h-4 w-4 text-slate-600 dark:text-slate-300" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDeleteDialog({ open: true, id: c.id, name: c.name })}
                title="Delete"
              >
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </div>
          );
        },
      },
    ],
    [categoriesFlat]
  );

  const table = useReactTable({
    data: filteredCategories,
    columns,
    onRowSelectionChange: setRowSelection,
    state: { rowSelection },
    getCoreRowModel: getCoreRowModel(),
  });

  const selectedIds = Object.keys(rowSelection).map((k) => filteredCategories[Number(k)]?.id).filter(Boolean);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Categories</h1>
          <p className="text-sm text-muted-foreground">
            Organize your products into categories and subcategories.
          </p>
        </div>
        {selectedIds.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary">
                <Check className="mr-2 h-4 w-4" /> Bulk ({selectedIds.length})
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Bulk Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => toast.success("Bulk edit not implemented")}>
                <Edit3 className="mr-2 h-4 w-4" /> Bulk Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => toast.success(`${selectedIds.length} deleted (simulated)`)}
                className="text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" /> Bulk Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <nav className="flex items-center text-sm text-muted-foreground">
        <Button variant="link" className="h-auto p-0" onClick={() => setBreadcrumbs([])}>
          <Home className="h-3.5 w-3.5 mr-1" />
          All Categories
        </Button>
        {breadcrumbs.map((bc, i) => (
          <span key={String(bc.id)} className="flex items-center">
            <ChevronRight className="h-3.5 w-3.5 mx-1" />
            <Button
              variant="link"
              className="h-auto p-0"
              onClick={() => setBreadcrumbs(breadcrumbs.slice(0, i + 1))}
            >
              {bc.name}
            </Button>
          </span>
        ))}
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <Card className="lg:sticky lg:top-6">
            <CardHeader>
              <CardTitle>{editingId ? "Edit Category" : "Add New Category"}</CardTitle>
              <CardDescription>
                {editingId ? "Update category details." : "Create a new category or subcategory."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FormProvider {...methods}>
                <Form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={control}
                    name="name"
                    render={({ field, fieldState }) => (
                      <FormItem>
                        <FormLabel>Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Electronics, Clothing..." {...field} />
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
                        <FormControl>
                          <Input placeholder="auto-generated" {...field} />
                        </FormControl>
                        <FormMessage>{fieldState.error?.message}</FormMessage>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={control}
                    name="parentId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Parent Category</FormLabel>
                        <FormControl>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectItem value="">— None (Top Level)</SelectItem>
                            {flatWithDepth
                              .filter((c) => editingId ? String(c.id) !== String(editingId) : true)
                              .map((c) => {
                                const indent = "— ".repeat(c.depth);
                                return (
                                  <SelectItem key={String(c.id)} value={String(c.id)}>
                                    {indent}
                                    {c.name}
                                  </SelectItem>
                                );
                              })}
                          </Select>
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea rows={3} placeholder="Briefly describe this category..." {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={control}
                    name="imageUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Thumbnail Image URL</FormLabel>
                        <FormControl>
                          <Input placeholder="https://..." {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={control}
                    name="displayMode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Display Mode</FormLabel>
                        <FormControl>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectItem value="products">Products Only</SelectItem>
                            <SelectItem value="children">Subcategories Only</SelectItem>
                            <SelectItem value="both">Both Products & Children</SelectItem>
                          </Select>
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={control}
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
                      control={control}
                      name="isActive"
                      render={({ field }) => (
                        <FormItem className="h-full justify-center flex flex-col">
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

                  <Separator />
                  <div>
                    <Label className="text-xs text-muted-foreground">SEO (Optional)</Label>
                  </div>
                  <FormField
                    control={control}
                    name="seoTitle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SEO Title</FormLabel>
                        <FormControl>
                          <Input placeholder="Search engine title..." {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={control}
                    name="metaDesc"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Meta Description</FormLabel>
                        <FormControl>
                          <Textarea rows={2} placeholder="Meta description..." {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <Separator />
                  <div className="flex gap-2">
                    <Button type="submit" className="flex-1" disabled={isCreating || isUpdating}>
                      {isCreating || isUpdating ? (
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="mr-2 h-4 w-4" />
                      )}
                      {editingId ? "Update Category" : "Add Category"}
                    </Button>
                    {editingId && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setEditingId(null);
                          reset(defaultValues);
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </Form>
              </FormProvider>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-3">
          <Card>
            <CardContent className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search categories by name, slug..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              {isLoadingFlat && isLoadingTree ? (
                <div className="space-y-3 p-4">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4 p-2">
                      <Skeleton className="h-4 w-4 rounded" />
                      <Skeleton className="h-10 w-10 rounded-md" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-1/3" />
                        <Skeleton className="h-3 w-1/4" />
                      </div>
                      <Skeleton className="h-4 w-16" />
                    </div>
                  ))}
                </div>
              ) : filteredCategories.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="h-20 w-20 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center mb-6">
                    <FolderPlus className="h-10 w-10 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <h2 className="text-xl font-semibold mb-2">No categories yet</h2>
                  <p className="text-muted-foreground max-w-sm mb-6">
                    Create your first category to start organizing your product catalog.
                  </p>
                  <Button
                    onClick={() => {
                      setEditingId(null);
                      methods.reset(defaultValues);
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" /> Create category
                  </Button>
                </div>
              ) : (
                <ScrollArea className="rounded-md">
                  <Table>
                    <TableHeader>
                      {table.getHeaderGroups().map((headerGroup) => (
                        <TableRow key={headerGroup.id}>
                          {headerGroup.headers.map((header) => (
                            <TableHead key={header.id} style={{ width: header.getSize() }}>
                              {header.isPlaceholder
                                ? null
                                : flexRender(header.column.columnDef.header, header.getContext())}
                            </TableHead>
                          ))}
                        </TableRow>
                      ))}
                    </TableHeader>
                    <TableBody>
                      {table.getRowModel().rows?.length ? (
                        table.getRowModel().rows.map((row) => (
                          <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                            {row.getVisibleCells().map((cell) => (
                              <TableCell key={cell.id} style={{ width: cell.column.getSize() }}>
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={columns.length} className="h-24 text-center">
                            No results.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <DeleteDialog
        open={deleteDialog.open}
        onOpenChange={(o) => setDeleteDialog({ open: o })}
        onConfirm={handleDeleteConfirm}
        name={deleteDialog.name}
        loading={isDeleting}
      />
    </div>
  );
}
