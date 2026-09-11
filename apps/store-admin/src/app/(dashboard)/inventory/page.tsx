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

function genStock(count: number): StockItem[] {
  const warehouses = [{ id: "W1", name: "Dhaka Warehouse" }, { id: "W2", name: "Chittagong Warehouse" }];
  const products = [
    "Premium Cotton Panjabi - Navy Blue (M)", "Premium Cotton Panjabi - Navy Blue (L)",
    "Linen Shirt - White (L)", "Linen Shirt - White (XL)",
    "Leather Wallet - Brown", "Silk Saree - Maroon",
    "Gold Plated Earrings", "Premium Leather Handbag",
    "Denim Jeans - Black (32)", "Casual T-Shirt - Gray (M)",
  ];
  const out: StockItem[] = [];
  for (let i = 0; i < count; i++) {
    const w = warehouses[i % 2];
    const p = products[i % products.length];
    const available = Math.max(0, (i * 7) % 150 - (i % 10 === 0 ? 2 : 0));
    const reserved = available > 50 ? (i % 5) * 2 : 0;
    const cost = 200 + ((i * 137) % 8000);
    out.push({
      id: 100 + i,
      productVariantId: 1000 + i,
      productName: p,
      sku: `SKU-${(1000 + i).toString().padStart(5, "0")}`,
      warehouseId: w.id, warehouseName: w.name,
      availableQty: available,
      reservedQty: reserved,
      physicalQty: available + reserved,
      lowStockThreshold: i % 9 === 0 ? 3 : 5,
      reorderPoint: 20,
      unitCost: cost,
      lastAdjustedAt: new Date(Date.now() - i * 86400000).toISOString(),
      lastAdjustedBy: i % 3 === 0 ? "Admin User" : "Staff Member",
    });
  }
  return out;
}

function genLogs(count: number): InventoryLog[] {
  const types: AdjustmentType[] = ["ADD", "DEDUCT", "SET", "INVENTORY_COUNT", "DAMAGE"];
  const reasons: AdjustmentReason[] = ["DAMAGED", "EXPIRED", "COUNTED", "RECEIVED", "THEFT", "OTHER"];
  const users = ["Admin User", "Staff Member A", "Staff Member B"];
  const out: InventoryLog[] = [];
  for (let i = 0; i < count; i++) {
    const t = types[i % types.length];
    const delta =
      t === "DEDUCT" || t === "DAMAGE"
        ? -((i % 20) - 1)
        : t === "SET"
        ? 0
        : (i % 25) + 1;
    out.push({
      id: 5000 + i,
      createdAt: new Date(Date.now() - i * 3600000 * 6).toISOString(),
      referenceNo: `REF-${(2000 + i).toString()}`,
      type: t,
      productVariantId: 1000 + (i % 20),
      productName: ["Panjabi Navy M", "Shirt White L", "Wallet Brown", "Saree Maroon"][i % 4],
      sku: `SKU-${(1000 + (i % 20)).toString().padStart(5, "0")}`,
      qtyChange: delta,
      reason: reasons[i % reasons.length],
      note: i % 4 === 0 ? "Periodic count" : undefined,
      userId: i, userName: users[i % users.length],
      warehouseId: "W1", warehouseName: "Dhaka Warehouse",
      newQty: 80 + (i * 3) % 100,
    });
  }
  return out;
}

function genTransfers(count: number): StockTransfer[] {
  const statuses: StockTransfer["status"][] = ["DRAFT", "SENT", "RECEIVED", "CANCELLED"];
  const out: StockTransfer[] = [];
  for (let i = 0; i < count; i++) {
    out.push({
      id: 300 + i,
      referenceNo: `TRF-${(1500 + i).toString()}`,
      fromWarehouseId: "W1", fromWarehouseName: "Dhaka Warehouse",
      toWarehouseId: "W2", toWarehouseName: "Chittagong Warehouse",
      productVariantId: 1000 + i,
      productName: ["Panjabi Navy Blue M", "Linen Shirt White L", "Wallet Brown", "Saree Maroon"][i % 4],
      sku: `SKU-${(1000 + i).toString().padStart(5, "0")}`,
      quantity: 5 + (i * 3) % 30,
      status: statuses[i % statuses.length],
      createdAt: new Date(Date.now() - i * 86400000).toISOString(),
      receivedAt: i % 4 === 2 ? new Date(Date.now() - i * 86400000 + 3600000 * 48).toISOString() : undefined,
    });
  }
  return out;
}

export default function InventoryPage() {
  const [tab, setTab] = useState("stock");
  const [stockSearch, setStockSearch] = useState("");
  const [lowStock, setLowStock] = useState(false);
  const [outOfStock, setOutOfStock] = useState(false);
  const [warehouses, setWarehouses] = useState<string[]>([]);
  const [showAdjustSheet, setShowAdjustSheet] = useState(false);
  const [pageStock, setPageStock] = useState<StockItem | null>(null);

  const { data: stockRaw, isLoading: stockLoading } = useGetStockListQuery({
    search: stockSearch || undefined,
    lowStock: lowStock || undefined,
    outOfStock: outOfStock || undefined,
    warehouseIds: warehouses.length > 0 ? warehouses : undefined,
    page: 1, limit: 50,
  });
  const { data: logsRaw, isLoading: logsLoading } = useGetInventoryLogsQuery({ page: 1, limit: 50 });
  const { data: transfersRaw, isLoading: transfersLoading } = useGetStockTransfersQuery({ page: 1, limit: 50 });
  const [adjustStock] = useAdjustStockMutation();
  const [createTransfer] = useCreateTransferMutation();
  void createTransfer;

  const stock = stockRaw?.items ?? genStock(30);
  const summary: StockSummary = stockRaw?.summary ?? {
    totalSkus: stock.length,
    totalStockValue: stock.reduce((s, x) => s + x.physicalQty * x.unitCost, 0),
    outOfStockCount: stock.filter((s) => s.availableQty === 0).length,
    lowStockCount: stock.filter((s) => s.availableQty > 0 && s.availableQty <= s.lowStockThreshold).length,
    stockTurnoverRatio: 4.7,
  };
  const logs = logsRaw?.items ?? genLogs(25);
  const transfers = transfersRaw?.items ?? genTransfers(12);

  const [adjustForm, setAdjustForm] = useState({
    productVariantId: "", productName: "", warehouseId: "W1", warehouseName: "Dhaka Warehouse",
    quantity: 1, type: "ADD" as AdjustmentType, reason: "RECEIVED" as AdjustmentReason,
    note: "", referenceNo: "", date: "", attachment: "",
  });

  useEffect(() => {
    if (pageStock) {
      setAdjustForm((f) => ({
        ...f,
        productVariantId: String(pageStock.productVariantId),
        productName: pageStock.productName,
        warehouseId: String(pageStock.warehouseId),
        warehouseName: pageStock.warehouseName,
      }));
      setShowAdjustSheet(true);
    }
  }, [pageStock]);

  const [editingQty, setEditingQty] = useState<Record<string, number>>({});
  const [editingThresh, setEditingThresh] = useState<Record<string, number>>({});

  function setEditQty(id: string | number, v: number) { setEditingQty({ ...editingQty, [String(id)]: v }); }
  function setEditThresh(id: string | number, v: number) { setEditingThresh({ ...editingThresh, [String(id)]: v }); }
  function saveQty(s: StockItem) {
    const val = editingQty[String(s.id)] ?? s.availableQty;
    toast.success(`Saved ${s.sku}: qty updated to ${val}`);
    const next = { ...editingQty }; delete next[String(s.id)]; setEditingQty(next);
  }
  function saveThresh(s: StockItem) {
    toast.success(`${s.sku} threshold updated`);
    const next = { ...editingThresh }; delete next[String(s.id)]; setEditingThresh(next);
  }

  async function submitAdjust() {
    try {
      await adjustStock({
        productVariantId: Number(adjustForm.productVariantId) || 0,
        warehouseId: adjustForm.warehouseId,
        quantity: adjustForm.quantity,
        type: adjustForm.type,
        reason: adjustForm.reason,
        note: adjustForm.note || undefined,
        referenceNo: adjustForm.referenceNo || undefined,
        date: adjustForm.date || undefined,
      }).unwrap();
      toast.success(`Stock ${ADJUSTMENT_TYPE_LABELS[adjustForm.type]}: ${adjustForm.quantity} applied`);
      setShowAdjustSheet(false);
      setPageStock(null);
      setAdjustForm({ productVariantId: "", productName: "", warehouseId: "W1", warehouseName: "Dhaka Warehouse", quantity: 1, type: "ADD", reason: "RECEIVED", note: "", referenceNo: "", date: "", attachment: "" });
    } catch { toast.error("Failed to adjust stock"); }
  }

  const statCards = [
    { icon: Package, label: "Total SKUs", value: summary.totalSkus.toLocaleString(), color: "text-indigo-600", bg: "bg-indigo-50 dark:bg-indigo-500/10", hint: "Active variants" },
    { icon: DollarSign, label: "Total Stock Value", value: fc(summary.totalStockValue), color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-500/10", hint: "Sum (qty × unit cost)" },
    { icon: AlertOctagon, label: "Out of Stock", value: summary.outOfStockCount.toString(), color: "text-red-600", bg: "bg-red-50 dark:bg-red-500/10", hint: "Available = 0" },
    { icon: AlertTriangle, label: "Low Stock", value: summary.lowStockCount.toString(), color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-500/10", hint: `Turnover: ${summary.stockTurnoverRatio?.toFixed(1)}x` },
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
      { accessorKey: "warehouseName", header: "Warehouse", cell: ({ row }) => <span className="text-sm text-slate-700 dark:text-slate-300">{row.getValue("warehouseName")}</span> },
      {
        accessorKey: "availableQty",
        header: "Available",
        cell: ({ row }) => {
          const s = row.original;
          const v = editingQty[String(s.id)];
          const edit = v !== undefined;
          const low = s.availableQty <= s.lowStockThreshold;
          const oos = s.availableQty === 0;
          return (
            <div className="flex items-center gap-2">
              <Input
                type="number"
                className={cn("h-8 w-20 text-sm text-right font-semibold",
                  oos ? "text-red-600 dark:text-red-400" : low ? "text-amber-600 dark:text-amber-400" : "text-slate-900 dark:text-white"
                )}
                value={edit ? v : s.availableQty}
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
        id: "physical",
        header: "Physical",
        cell: ({ row }) => {
          const s = row.original;
          return <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 tabular-nums">{s.availableQty + s.reservedQty}</span>;
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
      { accessorKey: "reorderPoint", header: "Reorder Pt", cell: ({ row }) => <span className="text-sm text-slate-700 dark:text-slate-300 tabular-nums">{row.getValue("reorderPoint")}</span> },
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
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-slate-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-500/10 dark:hover:text-purple-400" title="Transfer" onClick={() => toast.info("Open transfer sheet...")}>
                <ArrowLeftRight className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-500/10 dark:hover:text-amber-400" title="View Log">
                <History className="h-4 w-4" />
              </Button>
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editingQty, editingThresh],
  );

  const stockTable = useReactTable({ data: stock, columns: stockCols, getCoreRowModel: getCoreRowModel() });
  const WAREHOUSES = [{ id: "W1", name: "Dhaka Warehouse" }, { id: "W2", name: "Chittagong Warehouse" }, { id: "W3", name: "Sylhet Warehouse" }];

  return (
    <div className="space-y-6 pb-12">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Inventory & Stock</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Manage stock levels, adjustments, transfers, and audit trail across warehouses.
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
                <TabsTrigger value="transfers">Stock Transfers</TabsTrigger>
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
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-1.5 h-10"><Boxes className="h-4 w-4" /> Warehouse <ChevronDown className="h-3.5 w-3.5 opacity-60" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel>Filter by warehouse</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {WAREHOUSES.map((w) => (
                        <DropdownMenuItem key={w.id} onClick={() => {
                          setWarehouses((prev) => prev.includes(w.id) ? prev.filter((x) => x !== w.id) : [...prev, w.id]);
                        }}>
                          <div className="flex items-center gap-2 w-full">
                            <Checkbox checked={warehouses.includes(w.id)} onCheckedChange={() => {}} /> {w.name}
                          </div>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-1.5 h-10"><DownloadIcon className="h-4 w-4" /> Export <ChevronDown className="h-3.5 w-3.5 opacity-60" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem onClick={() => toast.info("Exporting CSV...")}><FileSpreadsheet className="h-4 w-4 mr-2 text-green-600" />Stock CSV</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toast.info("Exporting XLSX...")}><FileSpreadsheet className="h-4 w-4 mr-2 text-emerald-600" />Stock XLSX</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toast.info("Exporting PDF...")}><File className="h-4 w-4 mr-2 text-red-600" />Stock PDF</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button variant="outline" size="sm" className="gap-1.5 h-10" onClick={() => toast.info("Stock import dialog...")}>
                    <Upload className="h-4 w-4" /> Import Stock
                  </Button>
                  <Button size="sm" className="gap-1.5 h-10" onClick={() => { setPageStock(null); setShowAdjustSheet(true); }}>
                    <Plus className="h-4 w-4" /> Adjust Stock
                  </Button>
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

              <TabsContent value="transfers" className="mt-2">
                <Card className="border-slate-200 dark:border-slate-800">
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader className="bg-slate-50/50 dark:bg-slate-900/50">
                          <TableRow className="border-slate-200 dark:border-slate-800">
                            <TableHead className="text-xs">Reference</TableHead>
                            <TableHead className="text-xs">From → To</TableHead>
                            <TableHead className="text-xs">Product</TableHead>
                            <TableHead className="text-xs">Qty</TableHead>
                            <TableHead className="text-xs">Status</TableHead>
                            <TableHead className="text-xs">Created</TableHead>
                            <TableHead className="text-xs">Received</TableHead>
                            <TableHead className="text-xs text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {transfersLoading ? Array.from({ length: 10 }).map((_, i) => (
                            <TableRow key={i}><TableCell colSpan={8} className="p-0"><Skeleton className="h-12 m-2" /></TableCell></TableRow>
                          )) : transfers.map((t) => (
                            <TableRow key={t.id} className="border-slate-200 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                              <TableCell className="text-sm font-mono font-semibold text-indigo-600 dark:text-indigo-400">{t.referenceNo}</TableCell>
                              <TableCell>
                                <div className="text-sm">
                                  <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300"><Boxes className="h-3 w-3 text-slate-400" />{t.fromWarehouseName}</div>
                                  <div className="flex items-center gap-1.5 text-slate-500"><ArrowLeftRight className="h-3 w-3 ml-0.5" /> <span className="ml-0.5">{t.toWarehouseName}</span></div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="text-sm font-medium leading-tight text-slate-900 dark:text-white">{t.productName}</div>
                                <div className="text-xs text-slate-500 font-mono">{t.sku}</div>
                              </TableCell>
                              <TableCell className="text-sm font-semibold tabular-nums">{t.quantity}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className={cn(
                                  "text-xs font-medium",
                                  t.status === "RECEIVED" ? "text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-transparent"
                                  : t.status === "SENT" ? "text-indigo-700 bg-indigo-50 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-transparent"
                                  : t.status === "CANCELLED" ? "text-slate-700 bg-slate-100 border-slate-200 dark:bg-slate-500/10 dark:text-slate-400 dark:border-transparent"
                                  : "text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-transparent"
                                )}>{t.status}</Badge>
                              </TableCell>
                              <TableCell className="text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">{fdd(t.createdAt)}</TableCell>
                              <TableCell className="text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">{t.receivedAt ? fdd(t.receivedAt) : "—"}</TableCell>
                              <TableCell className="text-right">
                                {t.status === "SENT" && (
                                  <Button size="sm" variant="outline" className="gap-1 h-8 text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400"
                                    onClick={() => toast.success(`Transfer ${t.referenceNo} marked as received`)}
                                  >
                                    <CheckCircle2 className="h-4 w-4" /> Receive
                                  </Button>
                                )}
                              </TableCell>
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
            <SheetDescription>Adjust inventory quantity. Creates an InventoryLog entry and updates ProductVariant availableQty.</SheetDescription>
          </SheetHeader>
          <Separator />
          <div className="py-5 space-y-4">
            <div>
              <Label className="text-xs mb-1.5 block">Product</Label>
              {adjustForm.productName ? (
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-3 text-sm font-medium">{adjustForm.productName}</div>
              ) : (
                <Input placeholder="Search and select product..." value={adjustForm.productName} onChange={(e) => setAdjustForm({ ...adjustForm, productName: e.target.value })} />
              )}
            </div>
            <div>
              <Label className="text-xs mb-1.5 block">Warehouse</Label>
              <Select value={adjustForm.warehouseId} onValueChange={(v) => {
                const wh = WAREHOUSES.find((x) => x.id === v);
                setAdjustForm({ ...adjustForm, warehouseId: v, warehouseName: wh?.name ?? "" });
              }}>
                {WAREHOUSES.map((w) => (
                  <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                ))}
              </Select>
            </div>
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1.5 block">Reference #</Label>
                <Input placeholder="e.g. GRN-1234" value={adjustForm.referenceNo} onChange={(e) => setAdjustForm({ ...adjustForm, referenceNo: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs mb-1.5 block">Date</Label>
                <Input type="date" value={adjustForm.date} onChange={(e) => setAdjustForm({ ...adjustForm, date: e.target.value })} />
              </div>
            </div>
            <div>
              <Label className="text-xs mb-1.5 block">Attach Count Sheet (optional)</Label>
              <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-5 text-center text-sm text-slate-500 dark:text-slate-400 hover:border-indigo-400 transition-colors cursor-pointer">
                <ImageIcon className="h-6 w-6 mx-auto mb-1 text-slate-400" />
                Click to upload photo
              </div>
            </div>
          </div>
          <Separator />
          <SheetFooter>
            <Button variant="outline" onClick={() => { setShowAdjustSheet(false); setPageStock(null); }}>Cancel</Button>
            <Button onClick={submitAdjust} disabled={adjustForm.quantity <= 0} className="gap-1.5">
              <Save className="h-4 w-4" /> Submit Adjustment
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
