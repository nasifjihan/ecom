"use client";

import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Search,
  Upload,
  Plus,
  Package,
  Boxes,
  AlertTriangle,
  AlertOctagon,
  DollarSign,
  Download as DownloadIcon,
  Save,
  ArrowLeftRight,
  History,
  PlusCircle,
  CheckCircle2,
  Clock,
  User,
  Image as ImageIcon,
  FileSpreadsheet,
  File,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Input,
  Label,
  Badge,
  Button,
  Checkbox,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  Select,
  SelectItem,
  Skeleton,
  Separator,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  Textarea,
} from "@/components/ui";
import {
  useGetStockListQuery,
  useGetInventoryLogsQuery,
  useGetStockTransfersQuery,
  useAdjustStockMutation,
  useUpdateStockThresholdMutation,
  useCreateTransferMutation,
  type StockItem,
  type InventoryLog,
  type StockTransfer,
  type StockSummary,
  type AdjustmentType,
  type AdjustmentReason,
} from "@/lib/features/operations/operations-api-slice";
import { cn } from "@/components/ui";

const ADJUSTMENT_TYPE_STYLES: Record<AdjustmentType, string> = {
  ADD: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-transparent",
  DEDUCT: "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-transparent",
  SET: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-transparent",
  INVENTORY_COUNT: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-500/10 dark:text-purple-400 dark:border-transparent",
  DAMAGE: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-transparent",
};
const ADJUSTMENT_TYPE_LABELS: Record<AdjustmentType, string> = {
  ADD: "Add", DEDUCT: "Deduct", SET: "Set", INVENTORY_COUNT: "Inventory Count", DAMAGE: "Damage",
};

function fc(n: number) { return `৳ ${n.toLocaleString()}`; }
function fd(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function fdd(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function InventoryPage() {
  const [tab, setTab] = useState("stock");
  const [stockSearch, setStockSearch] = useState("");
  const [lowStock, setLowStock] = useState(false);
  const [outOfStock, setOutOfStock] = useState(false);
  const [showAdjustSheet, setShowAdjustSheet] = useState(false);
  const [pageStock, setPageStock] = useState<StockItem | null>(null);

  const { data: stockRaw, isLoading: stockLoading } = useGetStockListQuery({
    search: stockSearch || undefined,
    lowStock: lowStock || undefined,
    outOfStock: outOfStock || undefined,
    page: 1, limit: 50,
  });
  const { data: logsRaw, isLoading: logsLoading } = useGetInventoryLogsQuery({ page: 1, limit: 50 });
  const { data: transfersRaw, isLoading: transfersLoading } = useGetStockTransfersQuery({ page: 1, limit: 50 });
  const [adjustStock] = useAdjustStockMutation();
  const [updateThreshold] = useUpdateStockThresholdMutation();

  const stock = stockRaw?.items ?? [];
  const warehouses = (stockRaw?.warehouses ?? []).filter((w) => w.isActive);
  const defaultWarehouse = warehouses.find((w) => w.isDefault) ?? warehouses[0];
  const multi = warehouses.length > 1;
  /** On hand in one warehouse (the whole total when there's only one). */
  const onHandIn = (s: StockItem, warehouseId: string | undefined) =>
    multi ? (s.byWarehouse?.find((b) => b.warehouseId === warehouseId)?.onHand ?? 0) : s.physicalQty;
  const summary: StockSummary = stockRaw?.summary ?? { totalSkus: 0, totalStockValue: 0, outOfStockCount: 0, lowStockCount: 0 };
  const logs = logsRaw?.items ?? [];

  const emptyAdjust = {
    productId: "", variantId: null as string | null, currentQty: 0, productName: "", warehouseId: "",
    quantity: 1, type: "ADD" as AdjustmentType, reason: "RECEIVED" as AdjustmentReason,
    note: "",
  };
  const [adjustForm, setAdjustForm] = useState(emptyAdjust);

  useEffect(() => {
    if (pageStock) {
      setAdjustForm((f) => ({
        ...f,
        productId: pageStock.productId,
        variantId: pageStock.variantId,
        currentQty: onHandIn(pageStock, defaultWarehouse?.id),
        warehouseId: defaultWarehouse?.id ?? "",
        productName: pageStock.productName,
      }));
      setShowAdjustSheet(true);
    }
  }, [pageStock]);

  // API errors arrive as a message string or { field: [message] }.
  const errorText = (err: any, fallback: string) => {
    const d = err?.data;
    if (typeof d === "string") return d;
    const first = d && typeof d === "object" ? Object.values(d)[0] : undefined;
    return Array.isArray(first) ? String(first[0]) : fallback;
  };

  const [editingQty, setEditingQty] = useState<Record<string, number>>({});
  const [editingThresh, setEditingThresh] = useState<Record<string, number>>({});

  function setEditQty(id: string | number, v: number) { setEditingQty({ ...editingQty, [String(id)]: v }); }
  function setEditThresh(id: string | number, v: number) { setEditingThresh({ ...editingThresh, [String(id)]: v }); }
  // The quick-edit box shows on-hand (physical) stock; saving records a "set to" adjustment.
  async function saveQty(s: StockItem) {
    const val = editingQty[String(s.id)];
    const next = { ...editingQty }; delete next[String(s.id)]; setEditingQty(next);
    if (val === undefined || val === s.physicalQty) return;
    try {
      await adjustStock({
        productId: s.productId, variantId: s.variantId, currentQty: s.physicalQty,
        productVariantId: s.productVariantId, warehouseId: defaultWarehouse?.id ?? "", quantity: val, type: "SET", reason: "COUNTED",
      }).unwrap();
      toast.success(`${s.sku}: stock set to ${val}`);
    } catch (err) {
      toast.error(errorText(err, "Failed to update stock"));
    }
  }
  async function saveThresh(s: StockItem) {
    const val = editingThresh[String(s.id)];
    const next = { ...editingThresh }; delete next[String(s.id)]; setEditingThresh(next);
    if (val === undefined || val === s.lowStockThreshold) return;
    try {
      await updateThreshold({ productId: s.productId, variantId: s.variantId, threshold: val }).unwrap();
      toast.success(`${s.sku} threshold updated`);
    } catch (err) {
      toast.error(errorText(err, "Failed to update threshold"));
    }
  }

  async function submitAdjust() {
    try {
      await adjustStock({
        productId: adjustForm.productId,
        variantId: adjustForm.variantId,
        currentQty: adjustForm.currentQty,
        productVariantId: adjustForm.variantId ?? adjustForm.productId,
        warehouseId: adjustForm.warehouseId,
        quantity: adjustForm.quantity,
        type: adjustForm.type,
        reason: adjustForm.reason,
        note: adjustForm.note || undefined,
      }).unwrap();
      toast.success(`Stock ${ADJUSTMENT_TYPE_LABELS[adjustForm.type]}: ${adjustForm.quantity} applied`);
      setShowAdjustSheet(false);
      setPageStock(null);
      setAdjustForm(emptyAdjust);
    } catch (err) {
      toast.error(errorText(err, "Failed to adjust stock"));
    }
  }

  const statCards = [
    { icon: Package, label: "Total SKUs", value: summary.totalSkus.toLocaleString(), color: "text-indigo-600", bg: "bg-indigo-50 dark:bg-indigo-500/10", hint: "Active variants" },
    { icon: DollarSign, label: "Total Stock Value", value: fc(summary.totalStockValue), color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-500/10", hint: "On hand × supplier cost (or price)" },
    { icon: AlertOctagon, label: "Out of Stock", value: summary.outOfStockCount.toString(), color: "text-red-600", bg: "bg-red-50 dark:bg-red-500/10", hint: "Available = 0" },
    { icon: AlertTriangle, label: "Low Stock", value: summary.lowStockCount.toString(), color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-500/10", hint: "At or below threshold" },
  ];

  const stockCols = useMemo<ColumnDef<StockItem>[]>(
    () => [
      {
        accessorKey: "productName",
        header: "Product",
        cell: ({ row }) => {
          const s = row.original;
          return (
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 overflow-hidden">
                {s.imageUrl ? <img src={s.imageUrl} alt="" className="h-full w-full object-cover" /> : <Package className="h-5 w-5 text-slate-400" />}
              </div>
              <div className="min-w-[180px]">
                <div className="font-medium text-slate-900 dark:text-white text-sm leading-tight">{s.productName}</div>
                <div className="text-xs text-slate-500 font-mono">{s.sku}</div>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "physicalQty",
        header: "On Hand",
        cell: ({ row }) => {
          const s = row.original;
          const v = editingQty[String(s.id)];
          const edit = v !== undefined;
          const low = s.availableQty <= s.lowStockThreshold;
          const oos = s.availableQty === 0;
          // Several warehouses: counts are set per warehouse in the Adjust sheet.
          if (multi) {
            return (
              <div className="min-w-[110px]">
                <div className={cn("text-sm font-semibold tabular-nums", oos ? "text-red-600 dark:text-red-400" : low ? "text-amber-600 dark:text-amber-400" : "text-slate-900 dark:text-white")}>{s.physicalQty}</div>
                <div className="mt-0.5 flex flex-wrap gap-1">
                  {(s.byWarehouse ?? []).filter((b) => b.onHand || b.reserved).map((b) => (
                    <span key={b.warehouseId} className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300" title={b.reserved ? `${b.reserved} held for orders` : undefined}>
                      {b.code} {b.onHand}{b.reserved ? `/${b.reserved}` : ""}
                    </span>
                  ))}
                </div>
              </div>
            );
          }
          return (
            <div className="flex items-center gap-2">
              <Input
                type="number"
                className={cn("h-8 w-20 text-sm text-right font-semibold",
                  oos ? "text-red-600 dark:text-red-400" : low ? "text-amber-600 dark:text-amber-400" : "text-slate-900 dark:text-white"
                )}
                value={edit ? v : s.physicalQty}
                onChange={(e) => setEditQty(s.id, parseInt(e.target.value) || 0)}
                onBlur={() => edit && saveQty(s)}
                onKeyDown={(e) => { if (e.key === "Enter") saveQty(s); }}
              />
              {edit && <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50" onClick={() => saveQty(s)}><Save className="h-4 w-4" /></Button>}
            </div>
          );
        },
      },
      {
        accessorKey: "reservedQty",
        header: "Reserved",
        cell: ({ row }) => <span className="text-sm text-slate-500 dark:text-slate-400 font-mono tabular-nums">{row.getValue("reservedQty")}</span>,
      },
      {
        id: "available",
        header: "Available",
        cell: ({ row }) => {
          const s = row.original;
          return <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 tabular-nums">{s.availableQty}</span>;
        },
      },
      {
        accessorKey: "lowStockThreshold",
        header: "Low Stock Threshold",
        cell: ({ row }) => {
          const s = row.original;
          const v = editingThresh[String(s.id)];
          const edit = v !== undefined;
          return (
            <div className="flex items-center gap-2">
              <Input
                type="number"
                className="h-8 w-16 text-sm text-right"
                value={edit ? v : s.lowStockThreshold}
                onChange={(e) => setEditThresh(s.id, parseInt(e.target.value) || 0)}
                onBlur={() => edit && saveThresh(s)}
                onKeyDown={(e) => { if (e.key === "Enter") saveThresh(s); }}
              />
              {edit && <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50" onClick={() => saveThresh(s)}><Save className="h-4 w-4" /></Button>}
            </div>
          );
        },
      },
      {
        accessorKey: "unitCost",
        header: "Unit Cost",
        cell: ({ row }) => <span className="text-sm font-medium text-slate-800 dark:text-slate-200 tabular-nums">{fc(row.getValue("unitCost"))}</span>,
      },
      {
        id: "lastAdjusted",
        header: "Last Adjusted",
        cell: ({ row }) => {
          const s = row.original;
          return (
            <div className="text-xs">
              <div className="text-slate-600 dark:text-slate-300">{fdd(s.lastAdjustedAt)}</div>
              {s.lastAdjustedBy && <div className="text-slate-500">{s.lastAdjustedBy}</div>}
            </div>
          );
        },
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => {
          const s = row.original;
          return (
            <div className="flex items-center justify-end gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-400" title="Adjust" onClick={() => setPageStock(s)}>
                <PlusCircle className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-500/10 dark:hover:text-amber-400" title="View Log" onClick={() => setTab("logs")}>
                <History className="h-4 w-4" />
              </Button>
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [multi, editingQty, editingThresh],
  );

  const stockTable = useReactTable({ data: stock, columns: stockCols, getCoreRowModel: getCoreRowModel() });

  return (
    <div className="space-y-6 pb-12">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Inventory & Stock</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Manage stock levels, adjustments and the stock movement log.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: i * 0.05 }}>
            <Card className="border-slate-200 shadow-sm dark:border-slate-800 h-full">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-2">
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{s.label}</p>
                  <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center", s.bg)}><s.icon className={cn("h-5 w-5", s.color)} /></div>
                </div>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{s.value}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{s.hint}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <Card className="border-slate-200 shadow-sm dark:border-slate-800 overflow-hidden">
        <CardContent className="p-0">
          <Tabs defaultValue="stock" value={tab} onValueChange={setTab}>
            <div className="px-5 pt-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <TabsList className="w-full lg:w-auto justify-start">
                <TabsTrigger value="stock">Stock List</TabsTrigger>
                <TabsTrigger value="adjustments">Stock Adjustments</TabsTrigger>
                <TabsTrigger value="logs">Inventory Log</TabsTrigger>
              </TabsList>
              {tab === "stock" && (
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input placeholder="Search product / SKU" value={stockSearch} onChange={(e) => setStockSearch(e.target.value)} className="pl-9 w-64 h-10" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant={lowStock ? "default" : "outline"} size="sm" className="gap-1.5 h-10" onClick={() => setLowStock((v) => !v)}>
                      <AlertTriangle className="h-4 w-4" /> Low stock
                    </Button>
                    <Button variant={outOfStock ? "default" : "outline"} size="sm" className="gap-1.5 h-10" onClick={() => setOutOfStock((v) => !v)}>
                      <AlertOctagon className="h-4 w-4" /> Out of stock
                    </Button>
                  </div>
                </div>
              )}
            </div>
            <div className="p-5">
              <TabsContent value="stock" className="mt-2">
                {stockLoading ? (
                  <div className="p-2 space-y-0">
                    {Array.from({ length: 12 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-4 py-3 border-b border-slate-100 dark:border-slate-800 last:border-0">
                        <Skeleton className="h-10 w-10 rounded-lg" />
                        <div className="flex-1 space-y-1">
                          <Skeleton className="h-4 w-60" />
                          <Skeleton className="h-3 w-24" />
                        </div>
                        <Skeleton className="h-8 w-20" />
                        <Skeleton className="h-5 w-16" />
                        <Skeleton className="h-5 w-16" />
                        <Skeleton className="h-8 w-16" />
                        <Skeleton className="h-5 w-16" />
                        <Skeleton className="h-5 w-20" />
                        <Skeleton className="h-10 w-28" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="overflow-x-auto -mx-5 -mt-2">
                    <Table>
                      <TableHeader>
                        {stockTable.getHeaderGroups().map((hg) => (
                          <TableRow key={hg.id} className="border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                            {hg.headers.map((h) => (
                              <TableHead key={h.id} className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider py-3 whitespace-nowrap">
                                {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                              </TableHead>
                            ))}
                          </TableRow>
                        ))}
                      </TableHeader>
                      <TableBody>
                        {stockTable.getRowModel().rows.map((row) => (
                          <TableRow key={row.id} className="border-slate-200 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                            {row.getVisibleCells().map((c) => (
                              <TableCell key={c.id} className="py-3">
                                {flexRender(c.column.columnDef.cell, c.getContext())}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="adjustments" className="mt-2">
                <Card className="border-slate-200 dark:border-slate-800">
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader className="bg-slate-50/50 dark:bg-slate-900/50">
                          <TableRow className="border-slate-200 dark:border-slate-800">
                            <TableHead className="text-xs">Date</TableHead>
                            <TableHead className="text-xs">Reference #</TableHead>
                            <TableHead className="text-xs">Type</TableHead>
                            <TableHead className="text-xs">Product</TableHead>
                            <TableHead className="text-xs">Qty Change</TableHead>
                            <TableHead className="text-xs">Reason</TableHead>
                            <TableHead className="text-xs">User</TableHead>
                            <TableHead className="text-xs">Warehouse</TableHead>
                            <TableHead className="text-xs">New Qty</TableHead>
                            <TableHead className="text-xs">Note</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {logsLoading ? Array.from({ length: 10 }).map((_, i) => (
                            <TableRow key={i}><TableCell colSpan={10} className="p-0"><Skeleton className="h-12 m-2" /></TableCell></TableRow>
                          )) : logs.map((l) => (
                            <TableRow key={l.id} className="border-slate-200 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                              <TableCell className="text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">{fd(l.createdAt)}</TableCell>
                              <TableCell className="text-sm font-mono text-slate-700 dark:text-slate-300">{l.referenceNo}</TableCell>
                              <TableCell><Badge variant="outline" className={cn(ADJUSTMENT_TYPE_STYLES[l.type], "text-xs font-medium")}>{ADJUSTMENT_TYPE_LABELS[l.type]}</Badge></TableCell>
                              <TableCell>
                                <div className="text-sm font-medium text-slate-900 dark:text-white leading-tight">{l.productName}</div>
                                {l.sku && <div className="text-xs text-slate-500 font-mono">{l.sku}</div>}
                              </TableCell>
                              <TableCell className={cn("text-sm font-semibold tabular-nums", l.qtyChange > 0 ? "text-emerald-600 dark:text-emerald-400" : l.qtyChange < 0 ? "text-red-600 dark:text-red-400" : "")}>
                                {l.qtyChange > 0 ? "+" : ""}{l.qtyChange}
                              </TableCell>
                              <TableCell className="text-sm text-slate-700 dark:text-slate-300 capitalize">{(l.reason ?? "").toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) || "—"}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1.5 text-sm">
                                  <User className="h-3.5 w-3.5 text-slate-400" />{l.userName}
                                </div>
                              </TableCell>
                              <TableCell className="text-sm text-slate-700 dark:text-slate-300">{l.warehouseName}</TableCell>
                              <TableCell className="text-sm font-semibold tabular-nums">{l.newQty}</TableCell>
                              <TableCell className="text-xs text-slate-500 max-w-[180px] truncate">{l.note ?? "—"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="logs" className="mt-2">
                <Card className="border-slate-200 dark:border-slate-800">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2"><History className="h-4 w-4 text-indigo-600" /> Full Inventory Activity Log</CardTitle>
                    <CardDescription>Audit trail of every stock movement across all warehouses.</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="relative pl-6 pb-2 pt-1">
                      <div className="absolute left-[11px] top-2 bottom-2 w-[2px] bg-slate-200 dark:bg-slate-700" />
                      {logsLoading ? Array.from({ length: 8 }).map((_, i) => <div key={i} className="py-3 pl-2"><Skeleton className="h-12 rounded" /></div>)
                        : logs.slice(0, 15).map((l) => (
                          <div key={l.id} className="relative py-3 pl-2">
                            <div className={cn("absolute -left-[19px] top-5 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900", l.qtyChange > 0 ? "bg-emerald-500" : l.qtyChange < 0 ? "bg-red-500" : "bg-indigo-500")} />
                            <div className="bg-slate-50/50 dark:bg-slate-900/50 rounded-xl p-3 border border-slate-200 dark:border-slate-800">
                              <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge variant="outline" className={cn(ADJUSTMENT_TYPE_STYLES[l.type], "text-xs font-medium")}>{ADJUSTMENT_TYPE_LABELS[l.type]}</Badge>
                                  <span className={cn("font-semibold text-sm tabular-nums", l.qtyChange > 0 ? "text-emerald-600 dark:text-emerald-400" : l.qtyChange < 0 ? "text-red-600 dark:text-red-400" : "text-indigo-600")}>{l.qtyChange > 0 ? "+" : ""}{l.qtyChange}</span>
                                  <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{l.productName}</span>
                                  {l.reason && <span className="text-xs text-slate-500">· {l.reason.toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}</span>}
                                </div>
                                <div className="flex items-center gap-3 text-xs text-slate-500">
                                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {fd(l.createdAt)}</span>
                                  <span className="flex items-center gap-1"><User className="h-3 w-3" />{l.userName}</span>
                                  {l.referenceNo && <span className="font-mono">· {l.referenceNo}</span>}
                                </div>
                              </div>
                              {l.note && <p className="text-xs text-slate-600 dark:text-slate-400">{l.note}</p>}
                            </div>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </div>
          </Tabs>
        </CardContent>
      </Card>

      <Sheet open={showAdjustSheet} onOpenChange={(o) => { if (!o) { setShowAdjustSheet(false); setPageStock(null); } }}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2"><PlusCircle className="h-5 w-5 text-indigo-600" />Adjust Stock</SheetTitle>
            <SheetDescription>
              On the shelf{multi ? ` in ${warehouses.find((w) => w.id === adjustForm.warehouseId)?.name ?? "this warehouse"}` : ""}: {adjustForm.currentQty}. Every change is recorded in the inventory log.
            </SheetDescription>
          </SheetHeader>
          <Separator />
          <div className="py-5 space-y-4">
            <div>
              <Label className="text-xs mb-1.5 block">Product</Label>
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-3 text-sm font-medium">{adjustForm.productName}</div>
            </div>
            {multi && (
              <div>
                <Label className="text-xs mb-1.5 block">Warehouse</Label>
                <Select
                  value={adjustForm.warehouseId}
                  onValueChange={(v) => setAdjustForm({ ...adjustForm, warehouseId: v, currentQty: pageStock ? onHandIn(pageStock, v) : 0 })}
                >
                  {warehouses.map((w) => (
                    <SelectItem key={w.id} value={w.id}>{w.name} ({w.code})</SelectItem>
                  ))}
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1.5 block">Quantity</Label>
                <Input type="number" min={0} value={adjustForm.quantity} onChange={(e) => setAdjustForm({ ...adjustForm, quantity: parseInt(e.target.value) || 0 })} />
              </div>
              <div>
                <Label className="text-xs mb-1.5 block">Adjustment Type</Label>
                <Select value={adjustForm.type} onValueChange={(v) => setAdjustForm({ ...adjustForm, type: v as AdjustmentType })}>
                  {(Object.keys(ADJUSTMENT_TYPE_LABELS) as AdjustmentType[]).map((t) => (
                    <SelectItem key={t} value={t}>{ADJUSTMENT_TYPE_LABELS[t]}</SelectItem>
                  ))}
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs mb-1.5 block">Reason</Label>
              <Select value={adjustForm.reason} onValueChange={(v) => setAdjustForm({ ...adjustForm, reason: v as AdjustmentReason })}>
                {(["DAMAGED", "EXPIRED", "COUNTED", "RECEIVED", "THEFT", "OTHER"] as AdjustmentReason[]).map((r) => (
                  <SelectItem key={r} value={r}>{r.charAt(0) + r.slice(1).toLowerCase()}</SelectItem>
                ))}
              </Select>
            </div>
            <div>
              <Label className="text-xs mb-1.5 block">Note (optional)</Label>
              <Textarea rows={2} placeholder="Any extra context..." value={adjustForm.note} onChange={(e) => setAdjustForm({ ...adjustForm, note: e.target.value })} />
            </div>
          </div>
          <Separator />
          <SheetFooter>
            <Button variant="outline" onClick={() => { setShowAdjustSheet(false); setPageStock(null); }}>Cancel</Button>
            <Button onClick={submitAdjust} disabled={!adjustForm.productId || (adjustForm.quantity <= 0 && adjustForm.type !== "SET" && adjustForm.type !== "INVENTORY_COUNT")} className="gap-1.5">
              <Save className="h-4 w-4" /> Submit Adjustment
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
