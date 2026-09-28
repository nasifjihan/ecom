"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Search,
  Calendar,
  Filter,
  ChevronDown,
  Download,
  Mail,
  Printer,
  Eye,
  XCircle,
  CheckSquare,
  Square,
  FileText,
  FileSpreadsheet,
  File,
  CreditCard,
  ArrowUpDown,
  Inbox,
  SlidersHorizontal,
  Plus,
  Truck,
} from "lucide-react";
import { toast } from "sonner";
import { openFile } from "@ecom/api-client";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  RowSelectionState,
} from "@tanstack/react-table";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Badge,
  Button,
  Checkbox,
  Tabs,
  TabsList,
  TabsTrigger,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Avatar,
  AvatarFallback,
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
  Select,
  SelectItem,
  Skeleton,
  ScrollArea,
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
} from "@/components/ui";
import {
  useGetOrderListQuery,
  useBulkUpdateOrderStatusMutation,
  useOrderInvoiceMutation,
  useOrderInvoicesMutation,
  VALID_STATUS_TRANSITIONS,
  type Order,
  type OrderStatus,
  type PaymentMethod,
  type ShippingZone,
  PAYMENT_METHOD_META,
  ORDER_SOURCES,
  sourceLabel,
} from "@/lib/features/operations/operations-api-slice";
import { FULFILLMENT_LABELS, RETURN_LABELS, type ReturnStatus } from "@/lib/features/operations/fulfilment-api-slice";
import { BulkBookDialog } from "@/components/orders/bulk-book-dialog";
import { useCan } from "@/lib/permissions";
import { cn } from "@/components/ui";
import { useSearchParams } from "next/navigation";
import { useStorefrontOptionsQuery } from "@/lib/features/storefronts/storefronts-api-slice";

const ORDER_STATUSES: { key: OrderStatus | "ALL"; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "PENDING", label: "Pending" },
  { key: "PROCESSING", label: "Processing" },
  { key: "ON_HOLD", label: "On Hold" },
  { key: "SHIPPED", label: "Shipped" },
  { key: "OUT_FOR_DELIVERY", label: "Out for Delivery" },
  { key: "DELIVERED", label: "Delivered" },
  { key: "COMPLETED", label: "Completed" },
  { key: "CANCELLED", label: "Cancelled" },
  { key: "REFUNDED", label: "Refunded" },
  { key: "FAILED", label: "Failed" },
];

const STATUS_STYLES: Record<OrderStatus, string> = {
  PENDING:
    "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20",
  PROCESSING:
    "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20",
  ON_HOLD:
    "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-500/10 dark:text-yellow-400 dark:border-yellow-500/20",
  COMPLETED:
    "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20",
  CANCELLED:
    "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/20",
  REFUNDED:
    "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/20",
  FAILED:
    "bg-slate-900 text-white border-slate-800 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700",
  SHIPPED:
    "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20",
  DELIVERED:
    "bg-green-50 text-green-700 border-green-200 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/20",
  OUT_FOR_DELIVERY:
    "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-500/10 dark:text-cyan-400 dark:border-cyan-500/20",
};

const DATE_PRESETS = ["Today", "Yesterday", "7 days", "30 days", "Custom"];

function getAvatarColor(name: string) {
  const colors = [
    "bg-indigo-500",
    "bg-emerald-500",
    "bg-amber-500",
    "bg-rose-500",
    "bg-blue-500",
    "bg-purple-500",
    "bg-cyan-500",
    "bg-orange-500",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase();
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCurrency(n: number) {
  return `৳ ${n.toLocaleString()}`;
}

export default function OrdersPage() {
  const [activeTab, setActiveTab] = useState<OrderStatus | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [datePreset, setDatePreset] = useState<string>("30 days");
  const [customDateFrom, setCustomDateFrom] = useState("");
  const [customDateTo, setCustomDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filterPaymentMethod, setFilterPaymentMethod] = useState<string>("");
  const [filterMinTotal, setFilterMinTotal] = useState<string>("");
  const [filterMaxTotal, setFilterMaxTotal] = useState<string>("");
  const [filterStaff, setFilterStaff] = useState<string>("");
  const [filterCoupon, setFilterCoupon] = useState(false);
  const [filterShippingZone, setFilterShippingZone] = useState<string>("");
  const [filterSource, setFilterSource] = useState<string>("");
  // Storefront filter (the Storefronts page links here with ?storefrontId=); shown with 2+ storefronts.
  const searchParams = useSearchParams();
  const [filterStorefront, setFilterStorefront] = useState<string>(searchParams.get("storefrontId") ?? "");
  const { data: storefronts = [] } = useStorefrontOptionsQuery();
  const severalFronts = storefronts.length > 1;
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [page, setPage] = useState(1);
  const [cancelDialogOrder, setCancelDialogOrder] = useState<Order | null>(null);
  const [bulkStatus, setBulkStatus] = useState<OrderStatus | null>(null);
  const [showBulkStatus, setShowBulkStatus] = useState(false);
  const [bulkBooking, setBulkBooking] = useState(false);
  const { can } = useCan();

  const { data, isLoading } = useGetOrderListQuery({
    status: activeTab === "ALL" ? undefined : activeTab,
    search: search || undefined,
    source: filterSource || undefined,
    storefrontId: filterStorefront || undefined,
    page,
    limit: 20,
  });

  const [bulkUpdateStatus] = useBulkUpdateOrderStatusMutation();
  const [loadInvoice] = useOrderInvoiceMutation();
  const [loadInvoices] = useOrderInvoicesMutation();

  const orders = data?.items ?? [];
  const statusCounts: Record<string, number> = data?.statusCounts ?? {};

  const selectedCount = Object.keys(rowSelection).length;
  const selectedIds = orders
    .filter((_o, i) => rowSelection[i])
    .map((o) => o.id);

  const columns = useMemo<ColumnDef<Order>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            onCheckedChange={(val) => table.toggleAllPageRowsSelected(!!val)}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(val) => row.toggleSelected(!!val)}
          />
        ),
        enableSorting: false,
        size: 40,
      },
      {
        accessorKey: "orderNumber",
        header: "Order #",
        cell: ({ row }) => {
          const o = row.original;
          return (
            <div className="flex items-center gap-3">
              <Avatar className="h-9 w-9 border-2 border-white shadow-sm">
                <AvatarFallback className={cn(getAvatarColor(o.customerName), "text-white text-xs font-semibold")}>
                  {getInitials(o.customerName)}
                </AvatarFallback>
              </Avatar>
              <Link
                href={`/orders/${o.id}`}
                className="font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 hover:underline"
              >
                {o.orderNumber}
              </Link>
              {severalFronts && o.storefront && (
                <span
                  title={`Placed on ${o.storefront.name}`}
                  className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                >
                  {o.storefront.code}
                </span>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "customerName",
        header: "Customer",
        cell: ({ row }) => {
          const o = row.original;
          return (
            <div className="min-w-[180px]">
              <div className="font-medium text-slate-900 dark:text-slate-100">
                {o.customerName}
              </div>
              {o.source !== "website" && (
                <div className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
                  via {sourceLabel(o.source)}
                  {o.createdByName ? ` · by ${o.createdByName}` : ""}
                </div>
              )}
              {o.customerEmail && (
                <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {o.customerEmail}
                </div>
              )}
              {o.customerPhone && (
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {o.customerPhone}
                </div>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "createdAt",
        header: "Date Created",
        cell: ({ row }) => (
          <span className="text-sm text-slate-600 dark:text-slate-300 whitespace-nowrap">
            {formatDate(row.getValue("createdAt"))}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const status = row.getValue("status") as OrderStatus;
          const o = row.original;
          // Parcel and return state, when there is something to say beyond the order status.
          const extra = [
            o.fulfillmentStatus !== "unfulfilled" && o.fulfillmentStatus.toUpperCase() !== status
              ? FULFILLMENT_LABELS[o.fulfillmentStatus]
              : null,
            o.returnStatus !== "none" ? `Return ${RETURN_LABELS[o.returnStatus as ReturnStatus]?.toLowerCase() ?? o.returnStatus}` : null,
          ].filter(Boolean);
          return (
            <div className="space-y-1">
              <Badge
                variant="outline"
                className={cn(STATUS_STYLES[status], "capitalize font-medium whitespace-nowrap")}
              >
                {status.replace(/_/g, " ")}
              </Badge>
              {extra.length > 0 && <div className="text-[11px] text-slate-500 whitespace-nowrap">{extra.join(" · ")}</div>}
            </div>
          );
        },
      },
      {
        accessorKey: "grandTotal",
        header: "Total",
        cell: ({ row }) => (
          <span className="font-bold text-slate-900 dark:text-white whitespace-nowrap">
            {formatCurrency(row.getValue("grandTotal"))}
          </span>
        ),
      },
      {
        accessorKey: "paymentMethod",
        header: "Payment Method",
        cell: ({ row }) => {
          const pm = row.getValue("paymentMethod") as PaymentMethod;
          const meta = PAYMENT_METHOD_META[pm] ?? {
            label: String(pm).replace(/_/g, " ").toLowerCase(),
            color: "bg-slate-100 text-slate-700 dark:bg-slate-500/10 dark:text-slate-300",
          };
          return (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap",
                meta.color,
              )}
            >
              <CreditCard className="h-3 w-3" />
              {meta.label}
            </span>
          );
        },
      },
      {
        accessorKey: "itemsCount",
        header: "Items",
        cell: ({ row }) => (
          <span className="text-sm text-slate-700 dark:text-slate-300">
            {row.getValue("itemsCount")}
          </span>
        ),
      },
      {
        accessorKey: "shippingMethod",
        header: "Shipping",
        cell: ({ row }) => (
          <span className="text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap max-w-[150px] truncate block">
            {row.getValue("shippingMethod") ?? "—"}
          </span>
        ),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => {
          const o = row.original;
          const canCancel = ["PENDING", "PROCESSING", "ON_HOLD"].includes(o.status);
          return (
            <div className="flex items-center gap-1 justify-end">
              <Link href={`/orders/${o.id}`}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-400"
                  title="View"
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-400"
                title="Print Invoice"
                onClick={() => handlePrint(o)}
              >
                <Printer className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                disabled={!canCancel}
                className={cn(
                  "h-8 w-8 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 dark:hover:text-red-400",
                  !canCancel && "opacity-40 pointer-events-none",
                )}
                title="Cancel"
                onClick={() => setCancelDialogOrder(o)}
              >
                <XCircle className="h-4 w-4" />
              </Button>
            </div>
          );
        },
      },
    ],
    [severalFronts],
  );

  const table = useReactTable({
    data: orders,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onRowSelectionChange: setRowSelection,
    state: { rowSelection },
  });

  /** Opens the order's invoice PDF in a new tab, where it can be printed. */
  async function handlePrint(order: Order) {
    try {
      await openFile(() => loadInvoice(order.id).unwrap(), { filename: `invoice-INV-${order.orderNumber}.pdf`, mode: "open" });
    } catch {
      toast.error("Couldn't load the invoice. Please try again.");
    }
  }

  async function handleBulkStatusChange(status: OrderStatus) {
    if (selectedIds.length === 0) return;
    try {
      const r = await bulkUpdateStatus({ ids: selectedIds, status }).unwrap();
      if (r.failed) toast.warning(`Updated ${r.updated}, ${r.failed} not allowed to move to ${status}`);
      else toast.success(`Updated ${r.updated} order(s) to ${status}`);
    } catch (e) {
      toast.error("Failed to update status");
    }
    setShowBulkStatus(false);
    setBulkStatus(null);
    setRowSelection({});
  }

  async function handleBulkExport(format: "CSV" | "XLSX" | "PDF") {
    toast.info(`Exporting ${selectedCount || "all"} orders as ${format}...`);
  }

  /** One PDF with the invoices of every selected order, one after another. */
  async function handleBulkInvoice() {
    if (selectedIds.length === 0) return;
    try {
      await openFile(() => loadInvoices(selectedIds).unwrap(), { filename: "invoices.pdf", mode: "open" });
    } catch {
      toast.error("Couldn't load the invoices. Please try again.");
    }
  }


  function handleBulkEmail() {
    toast.info("Order emails are not available yet (no email queue on the API).");
  }

  async function handleBulkCancel() {
    if (selectedIds.length === 0) return;
    try {
      const r = await bulkUpdateStatus({ ids: selectedIds, status: "CANCELLED" }).unwrap();
      if (r.failed) toast.warning(`Cancelled ${r.updated}, ${r.failed} could not be cancelled`);
      else toast.success(`Cancelled ${r.updated} order(s)`);
    } catch (e) {
      toast.error("Failed to cancel orders");
    }
    setRowSelection({});
  }

  async function handleConfirmCancel() {
    if (!cancelDialogOrder) return;
    try {
      const r = await bulkUpdateStatus({
        ids: [cancelDialogOrder.id],
        status: "CANCELLED",
      }).unwrap();
      if (r.failed) toast.error(`Order ${cancelDialogOrder.orderNumber} can no longer be cancelled`);
      else toast.success(`Order ${cancelDialogOrder.orderNumber} cancelled`);
    } catch (e) {
      toast.error("Failed to cancel order");
    }
    setCancelDialogOrder(null);
  }

  const totalPages = data?.totalPages ?? 1;

  return (
    <div className="space-y-6 pb-12">
      <style jsx global>{`
        @media print {
          body > *:not(.invoice-print-root) { display: none !important; }
        }
      `}</style>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Orders</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Manage orders, fulfillments, refunds, and customer invoices.
            </p>
          </div>
          <Button asChild>
            <Link href="/orders/new">
              <Plus className="mr-2 h-4 w-4" /> New order
            </Link>
          </Button>
        </div>
      </motion.div>

      <Tabs defaultValue="ALL" value={activeTab as string} onValueChange={(v) => { setActiveTab(v as any); setPage(1); }}>
        <ScrollArea className="w-full -mx-1 px-1">
          <TabsList className="h-auto flex-wrap !gap-1 mb-4 p-1">
            {ORDER_STATUSES.map((s) => {
              const count = s.key === "ALL"
                ? Object.values(statusCounts).reduce((n, c) => n + c, 0)
                : (statusCounts[s.key] ?? 0);
              const isActive = activeTab === s.key;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => { setActiveTab(s.key); setPage(1); }}
                  className={cn(
                    "inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-all",
                    isActive
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-background/50",
                  )}
                >
                  {s.label}
                  {s.key !== "ALL" && (
                    <span className={cn(
                      "inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-[10px] font-semibold",
                      isActive ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-400" : "bg-muted",
                    )}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </TabsList>
        </ScrollArea>
      </Tabs>

      <Card className="border-slate-200 shadow-sm dark:border-slate-800">
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search Order #, Customer name, email, phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <select
                aria-label="Filter by source"
                value={filterSource}
                onChange={(e) => {
                  setFilterSource(e.target.value);
                  setPage(1);
                }}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="">All sources</option>
                {ORDER_SOURCES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              {severalFronts && (
                <select
                  aria-label="Filter by storefront"
                  value={filterStorefront}
                  onChange={(e) => {
                    setFilterStorefront(e.target.value);
                    setPage(1);
                  }}
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                >
                  <option value="">All storefronts</option>
                  {storefronts.map((sf) => (
                    <option key={sf.id} value={sf.id}>
                      {sf.name}
                    </option>
                  ))}
                </select>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <Calendar className="h-4 w-4" />
                    {datePreset}
                    <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  {DATE_PRESETS.map((p) => (
                    <DropdownMenuItem
                      key={p}
                      onClick={() => setDatePreset(p)}
                      className={cn(datePreset === p && "font-medium text-indigo-600 dark:text-indigo-400")}
                    >
                      {p}
                    </DropdownMenuItem>
                  ))}
                  {datePreset === "Custom" && (
                    <>
                      <DropdownMenuSeparator />
                      <div className="p-2 space-y-2">
                        <div>
                          <Label className="text-xs mb-1 block">From</Label>
                          <Input type="date" value={customDateFrom} onChange={(e) => setCustomDateFrom(e.target.value)} size={1} className="h-8" />
                        </div>
                        <div>
                          <Label className="text-xs mb-1 block">To</Label>
                          <Input type="date" value={customDateTo} onChange={(e) => setCustomDateTo(e.target.value)} size={1} className="h-8" />
                        </div>
                      </div>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                variant={showFilters ? "default" : "outline"}
                size="sm"
                className="gap-1.5"
                onClick={() => setShowFilters((s) => !s)}
              >
                <SlidersHorizontal className="h-4 w-4" />
                Filters
              </Button>
            </div>
          </div>

          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/50"
            >
              <div>
                <Label className="text-xs mb-1.5 block">Payment Method</Label>
                <Select value={filterPaymentMethod} onValueChange={setFilterPaymentMethod}>
                  <SelectItem value="">All</SelectItem>
                  {Object.entries(PAYMENT_METHOD_META).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs mb-1.5 block">Min ৳</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={filterMinTotal}
                    onChange={(e) => setFilterMinTotal(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Max ৳</Label>
                  <Input
                    type="number"
                    placeholder="∞"
                    value={filterMaxTotal}
                    onChange={(e) => setFilterMaxTotal(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs mb-1.5 block">Assigned to Staff</Label>
                <Select value={filterStaff} onValueChange={setFilterStaff}>
                  <SelectItem value="">Any</SelectItem>
                  <SelectItem value="1">Admin User</SelectItem>
                  <SelectItem value="2">Staff Member A</SelectItem>
                  <SelectItem value="3">Staff Member B</SelectItem>
                </Select>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2 h-10">
                  <Checkbox checked={filterCoupon} onCheckedChange={setFilterCoupon} />
                  <Label className="text-sm cursor-pointer">Has coupon applied</Label>
                </div>
              </div>
              <div className="md:col-span-2 lg:col-span-4">
                <Label className="text-xs mb-1.5 block">Shipping Zone</Label>
                <div className="flex flex-wrap gap-2">
                  {(["DHAKA_METRO", "REST_BD", "INTERNATIONAL"] as ShippingZone[]).map((z) => (
                    <button
                      key={z}
                      type="button"
                      onClick={() => setFilterShippingZone(filterShippingZone === z ? "" : z)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                        filterShippingZone === z
                          ? "bg-indigo-600 text-white border-indigo-600"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-800",
                      )}
                    >
                      {z.replace(/_/g, " ")}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
            <div className="text-sm text-slate-600 dark:text-slate-400">
              {selectedCount > 0 ? (
                <span className="inline-flex items-center gap-2">
                  <CheckSquare className="h-4 w-4 text-indigo-600" />
                  {selectedCount} selected
                </span>
              ) : (
                <span>Showing {orders.length} of {data?.total ?? 42}</span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5" disabled={selectedCount === 0}>
                    <ArrowUpDown className="h-4 w-4" />
                    Change Status
                    <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuLabel>Set status for {selectedCount} orders</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {(Object.keys(VALID_STATUS_TRANSITIONS) as OrderStatus[]).map((s) => (
                    <DropdownMenuItem key={s} onClick={() => handleBulkStatusChange(s)}>
                      {s.replace(/_/g, " ")}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {can("orders.edit") && (
                <Button variant="outline" size="sm" className="gap-1.5" disabled={selectedCount === 0} onClick={() => setBulkBooking(true)}>
                  <Truck className="h-4 w-4" />
                  Book courier
                </Button>
              )}

              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={handleBulkInvoice}
                disabled={selectedCount === 0}
              >
                <FileText className="h-4 w-4" />
                Print Invoices
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <Download className="h-4 w-4" />
                    Export
                    <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => handleBulkExport("CSV")}>
                    <FileSpreadsheet className="h-4 w-4 mr-2 text-green-600" />
                    Export CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleBulkExport("XLSX")}>
                    <FileSpreadsheet className="h-4 w-4 mr-2 text-emerald-600" />
                    Export XLSX
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleBulkExport("PDF")}>
                    <File className="h-4 w-4 mr-2 text-red-600" />
                    Export PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={handleBulkEmail}
                disabled={selectedCount === 0}
              >
                <Mail className="h-4 w-4" />
                Send Email
              </Button>

              <Button
                variant="destructive"
                size="sm"
                className="gap-1.5"
                onClick={handleBulkCancel}
                disabled={selectedCount === 0}
              >
                <XCircle className="h-4 w-4" />
                Bulk Cancel
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm dark:border-slate-800 overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-0">
              {Array.from({ length: 15 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 py-3 border-b border-slate-100 dark:border-slate-800 last:border-0">
                  <Skeleton className="h-4 w-4" />
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-5 w-28" />
                  <Skeleton className="h-6 w-24 rounded-full" />
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-4 w-8" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-24 ml-auto" />
                </div>
              ))}
            </div>
          ) : orders.length === 0 ? (
            <div className="py-20 text-center">
              <div className="mx-auto h-16 w-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                <Inbox className="h-8 w-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">No orders found</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                Try adjusting your filters or search query to find orders.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((hg) => (
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
                  {table.getRowModel().rows.map((row, i) => (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() && "selected"}
                      className="border-slate-200 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className="py-3">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {!isLoading && orders.length > 0 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              />
            </PaginationItem>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              let pageNo = i + 1;
              if (totalPages > 5) {
                if (page > 3) pageNo = page - 2 + i;
                if (page > totalPages - 2) pageNo = totalPages - 4 + i;
              }
              if (pageNo < 1 || pageNo > totalPages) return null;
              return (
                <PaginationItem key={pageNo}>
                  <PaginationLink
                    isActive={pageNo === page}
                    onClick={() => setPage(pageNo)}
                  >
                    {pageNo}
                  </PaginationLink>
                </PaginationItem>
              );
            })}
            {totalPages > 5 && page < totalPages - 2 && (
              <PaginationItem>
                <PaginationEllipsis />
              </PaginationItem>
            )}
            <PaginationItem>
              <PaginationNext
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}

      {cancelDialogOrder && (
        <Dialog open={!!cancelDialogOrder} onOpenChange={(o) => !o && setCancelDialogOrder(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cancel Order {cancelDialogOrder.orderNumber}?</DialogTitle>
              <DialogDescription>
                This action cannot be undone. The customer will be notified of the cancellation.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-lg bg-red-50 dark:bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300">
              <strong>Warning:</strong> Cancelling this order will release all reserved stock back to inventory.
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCancelDialogOrder(null)}>
                Keep Order
              </Button>
              <Button variant="destructive" onClick={handleConfirmCancel}>
                Cancel Order
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {bulkBooking && <BulkBookDialog orderIds={selectedIds} onClose={() => { setBulkBooking(false); setRowSelection({}); }} />}
    </div>
  );
}
