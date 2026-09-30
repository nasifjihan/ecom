"use client";

import { useCallback, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
  Filter,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Star,
  MoreHorizontal,
  Eye,
  Copy,
  Trash2,
  Download,
  Edit3,
  Package,
  Check,
  X,
  RotateCcw,
  Upload,
} from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Badge,
  Checkbox,
  Select,
  SelectItem,
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
} from "@/components/ui";
import {
  useGetProductsQuery,
  useDeleteProductMutation,
  useBulkDeleteProductsMutation,
  useBulkUpdateProductsMutation,
  useRestoreProductsMutation,
  usePurgeProductsMutation,
  useExportProductsMutation,
  useGetCategoriesQuery,
  useGetBrandsQuery,
  type Product,
} from "@/lib/features/catalog/catalog-api-slice";
import { cn } from "@/components/ui";
import { openFile } from "@ecom/api-client";
import { errorText } from "@/lib/features/content/content-api-slice";

const STATUS_OPTIONS = [
  { value: "", label: "All Status" },
  { value: "published", label: "Published" },
  { value: "draft", label: "Draft" },
  { value: "scheduled", label: "Scheduled" },
  { value: "archived", label: "Archived" },
  { value: "deleted", label: "Deleted (Trash)" },
];

/** Quick views over the list; "Deleted" is the Trash. */
const VIEWS = [
  { value: "", label: "All" },
  { value: "published", label: "Published" },
  { value: "draft", label: "Drafts" },
  { value: "archived", label: "Archived" },
  { value: "deleted", label: "Deleted" },
];

const PRODUCT_TYPE_LABELS: Record<string, string> = {
  SIMPLE: "Simple",
  VARIABLE: "Variable",
  DIGITAL: "Digital",
  SUBSCRIPTION: "Subscription",
  MADE_TO_ORDER: "Made to Order",
};

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

function formatBDT(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "—";
  return `৳${amount.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function StatusBadge({ status }: { status: string }) {
  const s = status.toUpperCase();
  if (s === "PUBLISHED" || s === "ACTIVE") {
    return <Badge variant="success">Published</Badge>;
  }
  if (s === "DRAFT") {
    return <Badge variant="secondary">Draft</Badge>;
  }
  if (s === "ARCHIVED") {
    return <Badge variant="destructive">Archived</Badge>;
  }
  if (s === "SCHEDULED") {
    return <Badge variant="default">Scheduled</Badge>;
  }
  return <Badge variant="outline">{status}</Badge>;
}

function StockBadge({ qty, threshold = 5 }: { qty: number | null | undefined; threshold?: number }) {
  if (qty === null || qty === undefined) {
    return <span className="text-muted-foreground">—</span>;
  }
  if (qty === 0) {
    return (
      <Badge variant="destructive" className="font-normal">
        0 — Out of Stock
      </Badge>
    );
  }
  if (qty < threshold) {
    return (
      <Badge variant="secondary" className="bg-amber-100 text-amber-800 hover:bg-amber-200 font-normal">
        {qty} — Low Stock
      </Badge>
    );
  }
  return (
    <Badge variant="success" className="font-normal">
      {qty} — In Stock
    </Badge>
  );
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
          <DialogTitle>Move to Trash{name ? `: ${name}` : ""}</DialogTitle>
          <DialogDescription>
            It's taken off the store at once. You can restore it from Deleted, or delete it for good from there.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={loading}>
            {loading ? "Moving..." : "Move to Trash"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BulkDeleteDialog({
  open,
  onOpenChange,
  onConfirm,
  count,
  loading,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onConfirm: () => void;
  count: number;
  loading?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move {count} products to the Trash</DialogTitle>
          <DialogDescription>
            They're taken off the store at once. You can restore them from Deleted, or delete them for good from there.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={loading}>
            {loading ? "Moving..." : `Move ${count} to Trash`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FilterPanel({
  open,
  onToggle,
  filters,
  setFilters,
  onApply,
  onClear,
}: {
  open: boolean;
  onToggle: () => void;
  filters: ProductFilters;
  setFilters: (f: ProductFilters) => void;
  onApply: () => void;
  onClear: () => void;
}) {
  const { data: categories } = useGetCategoriesQuery();
  const { data: brands } = useGetBrandsQuery({ page: 1, perPage: 100 });

  return (
    <div className="mb-4">
      <Card className="border bg-slate-50 dark:bg-slate-900/50">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select
                value={String(filters.categoryId || "")}
                onValueChange={(v) => setFilters({ ...filters, categoryId: v ? BigInt(v) : undefined })}
              >
                <SelectItem value="">All Categories</SelectItem>
                {categories?.map((c) => (
                  <SelectItem key={String(c.id)} value={String(c.id)}>
                    {c.name}
                  </SelectItem>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Brand</Label>
              <Select
                value={String(filters.brandId || "")}
                onValueChange={(v) => setFilters({ ...filters, brandId: v ? BigInt(v) : undefined })}
              >
                <SelectItem value="">All Brands</SelectItem>
                {brands?.items?.map((b) => (
                  <SelectItem key={String(b.id)} value={String(b.id)}>
                    {b.name}
                  </SelectItem>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={filters.status}
                onValueChange={(v) => setFilters({ ...filters, status: v })}
              >
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>In Stock</Label>
              <div className="flex items-center h-10 px-3 space-x-2 rounded-md border border-input bg-background">
                <Checkbox
                  checked={filters.inStock === true}
                  onCheckedChange={(v) => setFilters({ ...filters, inStock: v ? true : undefined })}
                />
                <span className="text-sm">Only in-stock products</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Min Price (৳)</Label>
              <Input
                type="number"
                min={0}
                value={filters.minPrice ?? ""}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    minPrice: e.target.value === "" ? undefined : Number(e.target.value),
                  })
                }
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Max Price (৳)</Label>
              <Input
                type="number"
                min={0}
                value={filters.maxPrice ?? ""}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    maxPrice: e.target.value === "" ? undefined : Number(e.target.value),
                  })
                }
                placeholder="99999"
              />
            </div>
            <div className="flex items-end space-x-2 lg:col-span-2">
              <Button onClick={onApply} className="flex-1">
                <Filter className="mr-2 h-4 w-4" /> Apply Filters
              </Button>
              <Button variant="outline" onClick={onClear}>
                <X className="mr-2 h-4 w-4" /> Clear
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

type ProductFilters = {
  categoryId?: bigint | undefined;
  brandId?: bigint | undefined;
  status: string;
  inStock?: boolean | undefined;
  minPrice?: number | undefined;
  maxPrice?: number | undefined;
};

export default function ProductsPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState<ProductFilters>({
    status: "",
  });
  const [appliedFilters, setAppliedFilters] = useState<ProductFilters>({
    status: "",
  });

  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id?: string | number; name?: string }>({
    open: false,
  });
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkMenuOpen, setBulkMenuOpen] = useState(false);

  const queryParams = useMemo(
    () => ({
      page,
      perPage,
      search: appliedSearch || undefined,
      categoryId: appliedFilters.categoryId?.toString(),
      brandId: appliedFilters.brandId?.toString(),
      status: appliedFilters.status || undefined,
      minPrice: appliedFilters.minPrice,
      maxPrice: appliedFilters.maxPrice,
      inStock: appliedFilters.inStock,
    }),
    [page, perPage, appliedSearch, appliedFilters]
  );

  const { data, isLoading, error, refetch } = useGetProductsQuery(queryParams);

  const [deleteProduct] = useDeleteProductMutation();
  const [restoreMut] = useRestoreProductsMutation();
  const [purge, { isLoading: purging }] = usePurgeProductsMutation();
  const [purgeIds, setPurgeIds] = useState<(string | number)[]>([]);
  const isTrash = appliedFilters.status === "deleted";
  const restore = useCallback(
    async (ids: (string | number)[]) => {
      try {
        const r = await restoreMut({ ids }).unwrap();
        toast.success(`${r.count} restored`, { description: "Back with the status they had." });
        setRowSelection({});
      } catch (err) {
        toast.error(errorText(err, "Couldn't restore"));
      }
    },
    [restoreMut],
  );
  const [bulkDelete] = useBulkDeleteProductsMutation();
  const [bulkUpdate] = useBulkUpdateProductsMutation();
  const [loadExport] = useExportProductsMutation();
  /** Downloads the catalog (or just `ids`) in the import's columns, so it can be edited and imported back. */
  const exportSheet = (format: "csv" | "xlsx", ids?: (string | number)[]) =>
    openFile(() => loadExport({ format, ids }).unwrap(), { filename: `products.${format}`, mode: "download" }).catch((err: unknown) =>
      toast.error(errorText(err, "Export failed")),
    );

  const products = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const selectedIds = useMemo(() => {
    return Object.keys(rowSelection).map((k) => products[Number(k)]?.id).filter((id): id is NonNullable<typeof id> => id !== undefined && id !== null && id !== "");
  }, [rowSelection, products]);

  const columns: ColumnDef<Product>[] = useMemo(
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
        id: "image",
        header: "Image",
        cell: ({ row }) => {
          const p = row.original;
          const img = p.thumbnailUrl || p.imageUrls?.[0] || null;
          return (
            <div className="h-14 w-14 rounded-md border bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden shrink-0">
              {img ? (
                <img src={img} alt={p.name} className="h-full w-full object-cover" />
              ) : (
                <Package className="h-6 w-6 text-slate-400" />
              )}
            </div>
          );
        },
        size: 80,
      },
      {
        id: "sku",
        header: "SKU",
        cell: ({ row }) => (
          <code className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-slate-600 dark:text-slate-300">
            {row.original.sku || "—"}
          </code>
        ),
      },
      {
        id: "name",
        header: "Name",
        cell: ({ row }) => {
          const p = row.original;
          return (
            <div className="max-w-xs">
              <button
                onClick={() => router.push(`/catalog/products/${p.id}`)}
                className="text-left font-medium text-foreground hover:text-primary hover:underline transition-colors"
              >
                <div className="line-clamp-2">{p.name}</div>
              </button>
              {p.type && (
                <Badge variant="outline" className="mt-1 text-[10px]">
                  {PRODUCT_TYPE_LABELS[p.type] || p.type}
                </Badge>
              )}
            </div>
          );
        },
      },
      {
        id: "category",
        header: "Category",
        cell: ({ row }) => {
          const cats = row.original.categories;
          if (!cats || cats.length === 0) return <span className="text-muted-foreground">—</span>;
          return (
            <div className="flex flex-wrap gap-1">
              {cats.slice(0, 2).map((c) => (
                <Badge key={String(c.id)} variant="secondary" className="text-xs">
                  {c.name}
                </Badge>
              ))}
              {cats.length > 2 && (
                <Badge variant="outline" className="text-xs">
                  +{cats.length - 2}
                </Badge>
              )}
            </div>
          );
        },
      },
      {
        id: "price",
        header: "Price",
        cell: ({ row }) => {
          const p = row.original;
          const sale = p.salePrice;
          const regular = p.regularPrice;
          if (sale != null && sale !== regular) {
            return (
              <div>
                <div className="font-semibold">{formatBDT(sale)}</div>
                <div className="text-xs text-muted-foreground line-through">{formatBDT(regular)}</div>
              </div>
            );
          }
          return <span className="font-semibold">{formatBDT(regular ?? p.regularPrice)}</span>;
        },
      },
      {
        id: "stock",
        header: "Stock",
        cell: ({ row }) => <StockBadge qty={row.original.stockQty} threshold={row.original.lowStockThreshold ?? 5} />,
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: "featured",
        header: "Featured",
        cell: ({ row }) => {
          const featured = !!row.original.featured;
          return (
            <Star
              className={cn(
                "h-5 w-5 cursor-pointer transition-colors",
                featured ? "fill-amber-400 text-amber-400" : "text-slate-300 hover:text-amber-400"
              )}
              onClick={() => {
                toast(featured ? "Removed from featured" : "Marked as featured");
              }}
            />
          );
        },
      },
      {
        id: "updatedAt",
        header: "Updated",
        cell: ({ row }) => <span className="text-sm text-muted-foreground whitespace-nowrap">{formatDate(row.original.updatedAt)}</span>,
      },
      {
        id: "actions",
        header: "Actions",
        size: 100,
        cell: ({ row }) => {
          const p = row.original;
          if (isTrash)
            return (
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => void restore([p.id])} title="Restore">
                  <RotateCcw className="mr-1 h-4 w-4" /> Restore
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setPurgeIds([p.id])} title="Delete forever" aria-label={`Delete ${p.name} forever`}>
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            );
          return (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.push(`/catalog/products/${p.id}`)}
                title="Edit"
              >
                <Eye className="h-4 w-4 text-slate-600 dark:text-slate-300" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDeleteDialog({ open: true, id: p.id, name: p.name })}
                title="Move to Trash"
              >
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </div>
          );
        },
      },
    ],
    [router, isTrash, restore]
  );

  const table = useReactTable({
    data: products,
    columns,
    onRowSelectionChange: setRowSelection,
    state: { rowSelection },
    pageCount: totalPages,
    manualPagination: true,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const handleApplyFilters = () => {
    setAppliedFilters(filters);
    setAppliedSearch(search);
    setPage(1);
  };

  const handleClearFilters = () => {
    const empty: ProductFilters = { status: "" };
    setFilters(empty);
    setAppliedFilters(empty);
    setSearch("");
    setAppliedSearch("");
    setPage(1);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteDialog.id) return;
    try {
      await deleteProduct(deleteDialog.id).unwrap();
      toast.success("Moved to the Trash", { description: "Restore it from Deleted if you change your mind." });
      setDeleteDialog({ open: false });
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to delete product");
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    try {
      await bulkDelete({ ids: selectedIds }).unwrap();
      toast.success(`${selectedIds.length} moved to the Trash`);
      setBulkDeleteOpen(false);
      setRowSelection({});
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to delete products");
    }
  };

  const handlePurge = async () => {
    try {
      const r = await purge({ ids: purgeIds }).unwrap();
      if (r.deleted) toast.success(`${r.deleted} deleted for good`);
      for (const k of r.kept) toast.error(`${k.name} stays in the Trash`, { description: k.reason });
      setPurgeIds([]);
      setRowSelection({});
    } catch (err) {
      toast.error(errorText(err, "Couldn't delete the products"));
    }
  };

  const setView = (status: string) => {
    const next = { ...appliedFilters, status };
    setFilters(next);
    setAppliedFilters(next);
    setRowSelection({});
    setPage(1);
  };

  const handleBulkStatus = async (status: string) => {
    if (selectedIds.length === 0) return;
    try {
      await bulkUpdate({ ids: selectedIds, patch: { status } }).unwrap();
      toast.success(`${selectedIds.length} products: ${status}`);
      setRowSelection({});
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to update status");
    }
  };

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Products</h1>
          <p className="text-sm text-muted-foreground">
            Manage your product catalog — create, edit, and organize products.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="gap-2" asChild>
            <Link href="/catalog/products/import">
              <Upload className="h-4 w-4" /> Import
            </Link>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Download className="h-4 w-4" /> Export
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>All products</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => void exportSheet("csv")}>CSV</DropdownMenuItem>
              <DropdownMenuItem onClick={() => void exportSheet("xlsx")}>Excel (.xlsx)</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={() => router.push("/catalog/products/new")} className="gap-2">
            <Plus className="h-4 w-4" /> Add Product
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products by name, SKU..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleApplyFilters();
                }}
              />
            </div>
            <Button variant="outline" onClick={() => setFilterOpen(!filterOpen)} className="gap-2">
              <Filter className="h-4 w-4" /> Filter
              <ChevronDown className={cn("h-4 w-4 transition-transform", filterOpen && "rotate-180")} />
            </Button>

            {selectedIds.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary" className="gap-2">
                    <Check className="h-4 w-4" /> Bulk Actions ({selectedIds.length})
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56">
                  <DropdownMenuLabel>Bulk Actions</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {isTrash ? (
                    <>
                      <DropdownMenuItem onClick={() => void restore(selectedIds)}>
                        <RotateCcw className="mr-2 h-4 w-4" /> Restore
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setPurgeIds(selectedIds)} className="text-red-600 focus:text-red-600">
                        <Trash2 className="mr-2 h-4 w-4" /> Delete forever
                      </DropdownMenuItem>
                    </>
                  ) : (
                  <>
                  <DropdownMenuLabel>Export selected</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => void exportSheet("csv", selectedIds)}>
                    <Download className="mr-2 h-4 w-4" /> Export CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => void exportSheet("xlsx", selectedIds)}>
                    <Download className="mr-2 h-4 w-4" /> Export Excel
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleBulkStatus("published")}>
                    <Badge variant="success" className="mr-2">
                      Published
                    </Badge>
                    Publish
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleBulkStatus("draft")}>
                    <Badge variant="secondary" className="mr-2">
                      Draft
                    </Badge>
                    Unpublish
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleBulkStatus("archived")}>
                    <Badge variant="outline" className="mr-2">
                      Archived
                    </Badge>
                    Archive
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setBulkDeleteOpen(true)}
                    className="text-red-600 focus:text-red-600"
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Move to Trash
                  </DropdownMenuItem>
                  </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          <div className="flex flex-wrap gap-1 border-b" role="tablist" aria-label="Product views">
            {VIEWS.map((v) => (
              <button
                key={v.value}
                type="button"
                role="tab"
                aria-selected={(appliedFilters.status ?? "") === v.value}
                onClick={() => setView(v.value)}
                className={cn(
                  "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                  (appliedFilters.status ?? "") === v.value
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {v.value === "deleted" && <Trash2 className="mr-1.5 inline h-3.5 w-3.5" aria-hidden />}
                {v.label}
              </button>
            ))}
          </div>
          {isTrash && (
            <p className="rounded-md bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
              Products in the Trash are off the store. Restore puts them back with the status they had; Delete forever removes them for good.
            </p>
          )}

          {filterOpen && (
            <FilterPanel
              open={filterOpen}
              onToggle={() => setFilterOpen(!filterOpen)}
              filters={filters}
              setFilters={setFilters}
              onApply={handleApplyFilters}
              onClear={handleClearFilters}
            />
          )}

          <Separator />

          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-2">
                  <Skeleton className="h-4 w-4 rounded" />
                  <Skeleton className="h-14 w-14 rounded-md" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-6 w-20" />
                </div>
              ))}
            </div>
          ) : error ? (
            <Card className="border-destructive">
              <CardContent className="p-6 text-center">
                <p className="text-destructive font-medium">Failed to load products</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {(error as any)?.data?.message || "Something went wrong."}
                </p>
                <Button variant="outline" className="mt-4" onClick={() => refetch()}>
                  Try Again
                </Button>
              </CardContent>
            </Card>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="h-20 w-20 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center mb-6">
                <Package className="h-10 w-10 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h2 className="text-xl font-semibold mb-2">No products yet</h2>
              <p className="text-muted-foreground max-w-sm mb-6">
                Start building your catalog by creating your first product. Add names, images, prices, and more.
              </p>
              <Button onClick={() => router.push("/catalog/products/new")} className="gap-2">
                <Plus className="h-4 w-4" /> Create first product
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

              <div className="flex items-center justify-between px-2 pt-4">
                <div className="flex items-center gap-6 text-sm text-muted-foreground">
                  <span>
                    Showing {products.length > 0 ? (page - 1) * perPage + 1 : 0}–
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

      <DeleteDialog
        open={deleteDialog.open}
        onOpenChange={(o) => setDeleteDialog({ open: o })}
        onConfirm={handleDeleteConfirm}
        name={deleteDialog.name}
      />
      <Dialog open={purgeIds.length > 0} onOpenChange={(o) => !o && setPurgeIds([])}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {purgeIds.length === 1 ? "this product" : `${purgeIds.length} products`} for good?</DialogTitle>
            <DialogDescription>
              This can't be undone. Past orders and stock history keep their lines. A product a gift box, landing page, purchase or stock transfer uses stays in the Trash.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPurgeIds([])} disabled={purging}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void handlePurge()} disabled={purging}>
              {purging ? "Deleting..." : "Delete forever"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <BulkDeleteDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        onConfirm={handleBulkDelete}
        count={selectedIds.length}
      />
    </div>
  );
}
