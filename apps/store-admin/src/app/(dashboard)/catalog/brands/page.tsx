"use client";

import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  type ColumnDef,
  type RowSelectionState,
  flexRender,
} from "@tanstack/react-table";
import {
  Plus,
  Search,
  Trash2,
  Edit3,
  Copy,
  ExternalLink,
  Store,
  X,
  RefreshCw,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Building2,
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  ScrollArea,
  Separator,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  cn,
} from "@/components/ui";
import {
  useGetBrandsQuery,
  useCreateBrandMutation,
  useUpdateBrandMutation,
  useDeleteBrandMutation,
  type Brand,
} from "@/lib/features/catalog/catalog-api-slice";
import { banglaOf, bnTexts } from "@/components/catalog/bangla-fields";

const brandSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters" }).max(255),
  slug: z
    .string()
    .max(200)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
      message: "Slug must contain only lowercase letters, numbers, and hyphens",
    })
    .optional()
    .or(z.literal("")),
  logoUrl: z.string().max(500).optional().or(z.literal("")),
  websiteUrl: z.string().max(500).optional().or(z.literal("")),
  description: z.string().max(5000).optional().or(z.literal("")),
  /** The name and description in Bangla (optional; the storefront shows them in Bangla). */
  nameBn: z.string().max(255).optional().or(z.literal("")),
  descriptionBn: z.string().max(5000).optional().or(z.literal("")),
  sortOrder: z.coerce.number().int().default(0),
  isActive: z.boolean().default(true),
  seoTitle: z.string().max(255).optional().or(z.literal("")),
  metaDesc: z.string().max(500).optional().or(z.literal("")),
});

type BrandFormValues = z.infer<typeof brandSchema>;

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
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
          <DialogTitle>Delete Brand{name ? `: ${name}` : ""}</DialogTitle>
          <DialogDescription>
            This action cannot be undone. Products associated with this brand will not be deleted.
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

function BrandDialog({
  open,
  onOpenChange,
  brand,
  onSubmit,
  isSubmitting,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  brand?: Brand | null;
  onSubmit: (v: BrandFormValues) => void;
  isSubmitting: boolean;
}) {
  const methods = useForm<BrandFormValues>({
    resolver: zodResolver(brandSchema),
    defaultValues: {
      name: brand?.name || "",
      slug: brand?.slug || "",
      logoUrl: brand?.logoUrl || "",
      websiteUrl: brand?.websiteUrl || "",
      description: brand?.description || "",
      nameBn: banglaOf(brand).name ?? "",
      descriptionBn: banglaOf(brand).description ?? "",
      sortOrder: brand?.sortOrder ?? 0,
      isActive: brand?.isActive !== false,
      seoTitle: brand?.seoTitle || "",
      metaDesc: brand?.metaDesc || "",
    },
    values: open
      ? {
          name: brand?.name || "",
          slug: brand?.slug || "",
          logoUrl: brand?.logoUrl || "",
          websiteUrl: brand?.websiteUrl || "",
          description: brand?.description || "",
          nameBn: banglaOf(brand).name ?? "",
          descriptionBn: banglaOf(brand).description ?? "",
          sortOrder: brand?.sortOrder ?? 0,
          isActive: brand?.isActive !== false,
          seoTitle: brand?.seoTitle || "",
          metaDesc: brand?.metaDesc || "",
        }
      : undefined,
    mode: "onSubmit",
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!isSubmitting) onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{brand ? "Edit Brand" : "Add New Brand"}</DialogTitle>
          <DialogDescription>
            {brand ? "Update brand details." : "Create a new brand for your products."}
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-1 -mx-6 px-6">
          <FormProvider {...methods}>
            <Form onSubmit={methods.handleSubmit(onSubmit)} className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={methods.control}
                  name="name"
                  render={({ field, fieldState }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Brand Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Nike, Apple, Samsung" {...field} />
                      </FormControl>
                      <FormMessage>{fieldState.error?.message}</FormMessage>
                    </FormItem>
                  )}
                />

                <FormField
                  control={methods.control}
                  name="slug"
                  render={({ field, fieldState }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Slug</FormLabel>
                      <FormControl>
                        <Input placeholder="auto-generated" {...field} />
                      </FormControl>
                      <FormMessage>{fieldState.error?.message}</FormMessage>
                    </FormItem>
                  )}
                />

                <FormField
                  control={methods.control}
                  name="websiteUrl"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Website URL</FormLabel>
                      <FormControl>
                        <Input placeholder="https://brand-website.com" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={methods.control}
                  name="logoUrl"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Logo Image URL</FormLabel>
                      <FormControl>
                        <Input placeholder="https://.../logo.png" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={methods.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea rows={3} placeholder="About the brand..." {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={methods.control}
                  name="nameBn"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Name in Bangla (বাংলা)</FormLabel>
                      <FormControl>
                        <Input lang="bn" placeholder="Optional: shown when a shopper picks বাংলা" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={methods.control}
                  name="descriptionBn"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Description in Bangla</FormLabel>
                      <FormControl>
                        <Textarea lang="bn" rows={2} {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={methods.control}
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
                  control={methods.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="justify-center flex flex-col h-full">
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

                <FormField
                  control={methods.control}
                  name="seoTitle"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>SEO Title (optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Search engine title..." {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={methods.control}
                  name="metaDesc"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Meta Description (optional)</FormLabel>
                      <FormControl>
                        <Textarea rows={2} placeholder="Meta description..." {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
              <Separator />
              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="mr-2 h-4 w-4" />
                  )}
                  {brand ? "Update Brand" : "Create Brand"}
                </Button>
              </DialogFooter>
            </Form>
          </FormProvider>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

export default function BrandsPage() {
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id?: string | number; name?: string }>({
    open: false,
  });

  const { data, isLoading, refetch } = useGetBrandsQuery({
    page,
    perPage,
    search: appliedSearch || undefined,
  });

  const [createBrand, { isLoading: isCreating }] = useCreateBrandMutation();
  const [updateBrand, { isLoading: isUpdating }] = useUpdateBrandMutation();
  const [deleteBrand, { isLoading: isDeleting }] = useDeleteBrandMutation();

  const brands = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const columns: ColumnDef<Brand>[] = useMemo(
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
        id: "logo",
        header: "Logo",
        cell: ({ row }) => {
          const b = row.original;
          return (
            <div className="h-12 w-16 rounded-md border bg-white dark:bg-slate-800 overflow-hidden flex items-center justify-center shrink-0">
              {b.logoUrl ? (
                <img src={b.logoUrl} alt={b.name} className="max-w-full max-h-full object-contain p-1" />
              ) : (
                <Building2 className="h-5 w-5 text-slate-400" />
              )}
            </div>
          );
        },
        size: 90,
      },
      {
        id: "name",
        header: "Name",
        cell: ({ row }) => {
          const b = row.original;
          return (
            <div className="min-w-0">
              <button
                onClick={() => {
                  setEditingBrand(b);
                  setDialogOpen(true);
                }}
                className="font-medium text-left hover:text-primary hover:underline truncate block"
              >
                {b.name}
              </button>
            </div>
          );
        },
      },
      {
        id: "slug",
        header: "Slug",
        cell: ({ row }) => (
          <code className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-slate-600 dark:text-slate-300 whitespace-nowrap">
            {row.original.slug}
          </code>
        ),
      },
      {
        id: "websiteUrl",
        header: "Website",
        cell: ({ row }) => {
          const url = row.original.websiteUrl;
          if (!url) return <span className="text-muted-foreground text-sm">—</span>;
          return (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              <span className="truncate max-w-[150px]">{url.replace(/^https?:\/\//, "")}</span>
              <ExternalLink className="h-3 w-3 shrink-0" />
            </a>
          );
        },
      },
      {
        id: "productCount",
        header: "Products",
        cell: ({ row }) => (
          <Badge variant="outline" className="font-normal whitespace-nowrap">
            {row.original.productCount ?? 0} products
          </Badge>
        ),
      },
      {
        id: "description",
        header: "Description",
        cell: ({ row }) => (
          <p className="text-sm text-muted-foreground line-clamp-2 max-w-xs">
            {row.original.description || "—"}
          </p>
        ),
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
        size: 140,
        cell: ({ row }) => {
          const b = row.original;
          return (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setEditingBrand(b);
                  setDialogOpen(true);
                }}
                title="Edit"
              >
                <Edit3 className="h-4 w-4 text-slate-600 dark:text-slate-300" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  toast.success("Brand duplicated (simulated)");
                }}
                title="Duplicate"
              >
                <Copy className="h-4 w-4 text-slate-600 dark:text-slate-300" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDeleteDialog({ open: true, id: b.id, name: b.name })}
                title="Delete"
              >
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </div>
          );
        },
      },
    ],
    []
  );

  const table = useReactTable({
    data: brands,
    columns,
    onRowSelectionChange: setRowSelection,
    state: { rowSelection },
    pageCount: totalPages,
    manualPagination: true,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const selectedIds = Object.keys(rowSelection).map((k) => brands[Number(k)]?.id).filter(Boolean);

  const handleBrandSubmit = async (values: BrandFormValues) => {
    try {
      const body = {
        name: values.name,
        slug: values.slug || slugify(values.name),
        logoUrl: values.logoUrl || null,
        websiteUrl: values.websiteUrl || null,
        description: values.description || null,
        translations: bnTexts({ name: values.nameBn, description: values.descriptionBn }),
        sortOrder: values.sortOrder,
        isActive: values.isActive,
        seoTitle: values.seoTitle || null,
        metaDesc: values.metaDesc || null,
      };
      if (editingBrand) {
        await updateBrand({ id: editingBrand.id, body }).unwrap();
        toast.success("Brand updated successfully");
      } else {
        await createBrand(body).unwrap();
        toast.success("Brand created successfully");
      }
      setDialogOpen(false);
      setEditingBrand(null);
    } catch (err: any) {
      const msg = err?.data?.message;
      if (typeof msg === "string") toast.error(msg);
      else if (typeof msg === "object") {
        Object.entries(msg).forEach(([k, v]) => {
          if (Array.isArray(v)) toast.error(`${k}: ${v[0]}`);
        });
      } else {
        toast.error(editingBrand ? "Failed to update brand" : "Failed to create brand");
      }
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteDialog.id) return;
    try {
      await deleteBrand(deleteDialog.id).unwrap();
      toast.success("Brand deleted successfully");
      setDeleteDialog({ open: false });
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to delete brand");
    }
  };

  const handleOpenNew = () => {
    setEditingBrand(null);
    setDialogOpen(true);
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Brands</h1>
          <p className="text-sm text-muted-foreground">
            Manage product brands and manufacturers.
          </p>
        </div>
        <div className="flex items-center gap-2">
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
          <Button onClick={handleOpenNew} className="gap-2">
            <Plus className="h-4 w-4" /> Add Brand
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search brands by name, website..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setAppliedSearch(search);
                    setPage(1);
                  }
                }}
              />
            </div>
            <Button
              variant="outline"
              onClick={() => {
                setAppliedSearch(search);
                setPage(1);
              }}
            >
              Search
            </Button>
          </div>

          <Separator />

          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-2">
                  <Skeleton className="h-4 w-4 rounded" />
                  <Skeleton className="h-12 w-16 rounded-md" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/4" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          ) : brands.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="h-20 w-20 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center mb-6">
                <Store className="h-10 w-10 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h2 className="text-xl font-semibold mb-2">No brands yet</h2>
              <p className="text-muted-foreground max-w-sm mb-6">
                Create your first brand. Brands help customers filter products by manufacturer.
              </p>
              <Button onClick={handleOpenNew}>
                <Plus className="mr-2 h-4 w-4" /> Add Brand
              </Button>
            </div>
          ) : (
            <>
              <ScrollArea className="rounded-md border">
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

              <div className="flex items-center justify-between px-2 pt-4 flex-wrap gap-4">
                <div className="flex items-center gap-6 text-sm text-muted-foreground">
                  <span>
                    Showing {brands.length > 0 ? (page - 1) * perPage + 1 : 0}–
                    {Math.min(page * perPage, total)} of {total}
                  </span>
                  <div className="flex items-center gap-2">
                    <Label className="whitespace-nowrap">Rows per page:</Label>
                    <Select
                      value={String(perPage)}
                      onValueChange={(v) => {
                        setPerPage(Number(v));
                        setPage(1);
                      }}
                      className="w-24"
                    >
                      {[10, 20, 50, 100].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n}
                        </SelectItem>
                      ))}
                    </Select>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={() => setPage(1)} disabled={page === 1}>
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="flex items-center px-3 text-sm">
                    Page <span className="mx-1 font-medium">{page}</span> of{" "}
                    <span className="mx-1">{totalPages}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setPage(totalPages)}
                    disabled={page >= totalPages}
                  >
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <BrandDialog
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) setEditingBrand(null);
        }}
        brand={editingBrand}
        onSubmit={handleBrandSubmit}
        isSubmitting={isCreating || isUpdating}
      />

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
