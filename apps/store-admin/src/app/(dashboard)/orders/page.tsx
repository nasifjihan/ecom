"use client";

import { useState, useMemo, useRef, useEffect } from "react";
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
} from "lucide-react";
import { toast } from "sonner";
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
  useLazyGenerateOrderInvoicePdfQuery,
  VALID_STATUS_TRANSITIONS,
  type Order,
  type OrderStatus,
  type PaymentMethod,
  type ShippingZone,
} from "@/lib/features/operations/operations-api-slice";
import { cn } from "@/components/ui";

const ORDER_STATUSES: { key: OrderStatus | "ALL"; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "PENDING_PAYMENT", label: "Pending Payment" },
  { key: "PROCESSING", label: "Processing" },
  { key: "ON_HOLD", label: "On Hold" },
  { key: "COMPLETED", label: "Completed" },
  { key: "CANCELLED", label: "Cancelled" },
  { key: "REFUNDED", label: "Refunded" },
  { key: "FAILED", label: "Failed" },
  { key: "SHIPPED", label: "Shipped" },
  { key: "DELIVERED", label: "Delivered" },
  { key: "RETURNED", label: "Returned" },
];

const STATUS_STYLES: Record<OrderStatus, string> = {
  PENDING_PAYMENT:
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
  RETURNED:
    "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20",
};

const PAYMENT_METHOD_META: Record<
  PaymentMethod,
  { label: string; color: string }
> = {
  STRIPE: { label: "Stripe", color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400" },
  BKASH: { label: "bKash", color: "bg-pink-100 text-pink-700 dark:bg-pink-500/10 dark:text-pink-400" },
  NAGAD: { label: "Nagad", color: "bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400" },
  ROCKET: { label: "Rocket", color: "bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400" },
  SSLCOMMERZ: { label: "SSLCommerz", color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-400" },
  COD: { label: "COD", color: "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400" },
  BANK_TRANSFER: { label: "Bank Transfer", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" },
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
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
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

function generateMockOrders(count: number): Order[] {
  const statuses: OrderStatus[] = [
    "PENDING_PAYMENT",
    "PROCESSING",
    "ON_HOLD",
    "COMPLETED",
    "CANCELLED",
    "REFUNDED",
    "FAILED",
    "SHIPPED",
    "DELIVERED",
    "RETURNED",
  ];
  const paymentMethods: PaymentMethod[] = [
    "STRIPE",
    "BKASH",
    "NAGAD",
    "ROCKET",
    "SSLCOMMERZ",
    "COD",
    "BANK_TRANSFER",
  ];
  const names = [
    "Farhana Rahman",
    "MD. Karim Hossain",
    "Nusrat Jahan",
    "Sakib Ahmed",
    "Tasnim Akter",
    "Rafiqul Islam",
    "Ayesha Siddika",
    "Hasan Mahmud",
    "Fatema Khatun",
    "Jahidul Hasan",
    "Samia Sultana",
    "Imran Khan",
  ];
  const orders: Order[] = [];
  for (let i = 0; i < count; i++) {
    const name = names[i % names.length];
    const status = statuses[i % statuses.length];
    const pm = paymentMethods[i % paymentMethods.length];
    const total = 500 + (i * 317) % 50000;
    orders.push({
      id: 1000 + i,
      orderNumber: `#ORD-${10234 - i}`,
      customerName: name,
      customerEmail: `${name.toLowerCase().replace(/\s+/g, ".")}@example.com`,
      customerPhone: `+880 17${String(10000000 + i).slice(-8)}`,
      status,
      paymentMethod: pm,
      shippingMethod: i % 3 === 0 ? "Pathao Express" : i % 3 === 1 ? "RedX Delivery" : "eCourier Standard",
      shippingZone: i % 3 === 0 ? "DHAKA_METRO" : i % 3 === 1 ? "REST_BD" : "INTERNATIONAL",
      subtotal: Math.round(total * 0.85),
      shippingCost: i % 5 === 0 ? 120 : 60,
      vatAmount: Math.round(total * 0.15),
      discountAmount: i % 4 === 0 ? 200 : 0,
      couponCode: i % 4 === 0 ? "WELCOME10" : undefined,
      grandTotal: total,
      createdAt: new Date(Date.now() - i * 3600000 * 6).toISOString(),
      updatedAt: new Date(Date.now() - i * 3600000 * 6).toISOString(),
      lines: [],
      itemsCount: 1 + (i % 4),
    });
  }
  return orders;
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
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [page, setPage] = useState(1);
  const [cancelDialogOrder, setCancelDialogOrder] = useState<Order | null>(null);
  const [bulkStatus, setBulkStatus] = useState<OrderStatus | null>(null);
  const [showBulkStatus, setShowBulkStatus] = useState(false);
  const printRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const { data, isLoading } = useGetOrderListQuery({
    status: activeTab === "ALL" ? undefined : activeTab,
    search: search || undefined,
    page,
    limit: 20,
  });

  const [bulkUpdateStatus] = useBulkUpdateOrderStatusMutation();
  const [triggerInvoicePdf] = useLazyGenerateOrderInvoicePdfQuery();

  const orders = data?.items ?? generateMockOrders(20);
  const statusCounts: Record<string, number> = data?.statusCounts ?? {
    PENDING_PAYMENT: 4,
    PROCESSING: 6,
    ON_HOLD: 2,
    COMPLETED: 12,
    CANCELLED: 3,
    REFUNDED: 1,
    FAILED: 1,
    SHIPPED: 5,
    DELIVERED: 8,
    RETURNED: 2,
  };

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
          return (
            <Badge
              variant="outline"
              className={cn(STATUS_STYLES[status], "capitalize font-medium whitespace-nowrap")}
            >
              {status.replace(/_/g, " ")}
            </Badge>
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
          const meta = PAYMENT_METHOD_META[pm];
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
          const canCancel = ["PENDING_PAYMENT", "PROCESSING", "ON_HOLD"].includes(o.status);
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
              <div
                ref={(el) => {
                  printRefs.current[String(o.id)] = el;
                }}
                className="hidden"
                aria-hidden="true"
              >
                <InvoicePrintTemplate order={o} />
              </div>
            </div>
          );
        },
      },
    ],
    [],
  );

  const table = useReactTable({
    data: orders,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onRowSelectionChange: setRowSelection,
    state: { rowSelection },
  });

  function handlePrint(order: Order) {
    const el = printRefs.current[String(order.id)];
    if (!el) return;
    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) {
      toast.error("Pop-up blocked. Please allow pop-ups.");
      return;
    }
    printWindow.document.write(`
      <!DOCTYPE html><html><head><title>Invoice ${order.orderNumber}</title>
      <style>
        * { box-sizing: border-box; }
        body { font-family: Arial, sans-serif; margin: 0; padding: 40px; color: #0f172a; }
        .invoice-header { display: flex; justify-content: space-between; border-bottom: 2px solid #e2e8f0; padding-bottom: 24px; margin-bottom: 32px; }
        .company h1 { margin: 0; font-size: 24px; color: #4f46e5; }
        .company p { margin: 4px 0; color: #64748b; font-size: 13px; }
        .invoice-meta { text-align: right; }
        .invoice-meta h2 { margin: 0 0 8px 0; font-size: 20px; }
        .invoice-meta p { margin: 2px 0; font-size: 13px; color: #64748b; }
        .section-title { font-size: 14px; font-weight: 600; margin: 0 0 8px 0; color: #334155; text-transform: uppercase; letter-spacing: 0.05em; }
        .addr-block { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-bottom: 32px; }
        .addr p { margin: 2px 0; font-size: 13px; color: #475569; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
        th { background: #f1f5f9; text-align: left; padding: 12px; font-size: 13px; color: #334155; border-bottom: 1px solid #cbd5e1; }
        td { padding: 12px; font-size: 13px; border-bottom: 1px solid #f1f5f9; color: #1e293b; }
        .totals { margin-left: auto; width: 320px; border-top: 2px solid #e2e8f0; padding-top: 16px; }
        .totals-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; color: #475569; }
        .totals-row.grand { font-size: 18px; font-weight: bold; color: #0f172a; padding-top: 12px; border-top: 1px solid #e2e8f0; margin-top: 8px; }
        .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; margin-top: 80px; padding-top: 40px; }
        .sig-line { border-top: 1px solid #94a3b8; padding-top: 8px; text-align: center; font-size: 13px; color: #64748b; }
        .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #94a3b8; }
        .status-badge { display: inline-block; padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 600; background: #dcfce7; color: #15803d; }
        @media print { body { padding: 20px; } }
      </style></head><body>${el.innerHTML}</body></html>
    `);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 300);
  }

  async function handleBulkStatusChange(status: OrderStatus) {
    if (selectedIds.length === 0) return;
    try {
      await bulkUpdateStatus({ ids: selectedIds, status }).unwrap();
      toast.success(`Updated ${selectedIds.length} order(s) to ${status}`);
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

  function handleBulkInvoice() {
    toast.info(`Generating ${selectedCount || "all"} invoice(s)...`);
  }

  function handleBulkEmail() {
    toast.success(`Email notification queued for ${selectedCount || "all"} order(s)`);
  }

  async function handleBulkCancel() {
    if (selectedIds.length === 0) return;
    try {
      await bulkUpdateStatus({ ids: selectedIds, status: "CANCELLED" }).unwrap();
      toast.success(`Cancelled ${selectedIds.length} order(s)`);
    } catch (e) {
      toast.error("Failed to cancel orders");
    }
    setRowSelection({});
  }

  async function handleConfirmCancel() {
    if (!cancelDialogOrder) return;
    try {
      await bulkUpdateStatus({
        ids: [cancelDialogOrder.id],
        status: "CANCELLED",
      }).unwrap();
      toast.success(`Order ${cancelDialogOrder.orderNumber} cancelled`);
    } catch (e) {
      toast.error("Failed to cancel order");
    }
    setCancelDialogOrder(null);
  }

  const totalPages = data?.totalPages ?? 5;

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
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Orders</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Manage orders, fulfillments, refunds, and customer invoices.
        </p>
      </motion.div>

      <Tabs defaultValue="ALL" value={activeTab as string} onValueChange={(v) => { setActiveTab(v as any); setPage(1); }}>
        <ScrollArea className="w-full -mx-1 px-1">
          <TabsList className="h-auto flex-wrap !gap-1 mb-4 p-1">
            {ORDER_STATUSES.map((s) => {
              const count = s.key === "ALL"
                ? orders.length
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

              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={selectedCount === 0}
                onClick={() => toast.success(`Marked ${selectedCount} order(s) as paid`)}
              >
                <CheckSquare className="h-4 w-4" />
                Mark as Paid
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={handleBulkInvoice}
                disabled={selectedCount === 0}
              >
                <FileText className="h-4 w-4" />
                Generate Invoice
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
    </div>
  );
}

function InvoicePrintTemplate({ order }: { order: Order }) {
  const subtotal = order.subtotal ?? Math.round(order.grandTotal * 0.85);
  const shipping = order.shippingCost ?? 60;
  const vat = order.vatAmount ?? Math.round(order.grandTotal * 0.15);
  const discount = order.discountAmount ?? 0;
  const lineItems = order.lines.length > 0 ? order.lines : [
    {
      id: 1,
      productVariantId: 1,
      productName: "Sample Product",
      sku: "SKU-001",
      quantity: 1,
      unitPrice: subtotal,
      lineTotal: subtotal,
    },
  ];
  return (
    <div className="invoice-print-root">
      <div className="invoice-header">
        <div className="company">
          <h1>ShopName BD</h1>
          <p>House 42, Road 11, Banani, Dhaka 1213</p>
          <p>Phone: +880 2-555-1234 | Email: billing@shopname.bd</p>
          <p>Trade License: 2024-12345 | VAT Reg: 1234567890</p>
        </div>
        <div className="invoice-meta">
          <h2>INVOICE</h2>
          <p><strong>{order.orderNumber}</strong></p>
          <p>Date: {new Date(order.createdAt).toLocaleDateString()}</p>
          <p>Due: On Receipt</p>
          <span className="status-badge">{order.status.replace(/_/g, " ")}</span>
        </div>
      </div>

      <div className="addr-block">
        <div>
          <div className="section-title">Bill To</div>
          <p><strong>{order.customerName}</strong></p>
          {order.billingAddress?.address1 && <p>{order.billingAddress.address1}</p>}
          {order.billingAddress && (
            <p>{[order.billingAddress.district, order.billingAddress.division, order.billingAddress.postcode].filter(Boolean).join(", ")}</p>
          )}
          {order.customerPhone && <p>Phone: {order.customerPhone}</p>}
          {order.customerEmail && <p>Email: {order.customerEmail}</p>}
        </div>
        <div>
          <div className="section-title">Ship To</div>
          <p><strong>{order.customerName}</strong></p>
          {order.shippingAddress?.address1 && <p>{order.shippingAddress.address1}</p>}
          {order.shippingAddress && (
            <p>{[order.shippingAddress.district, order.shippingAddress.division, order.shippingAddress.postcode].filter(Boolean).join(", ")}</p>
          )}
          {order.shippingMethod && <p>Method: {order.shippingMethod}</p>}
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style={{ width: "60px" }}>#</th>
            <th>Item</th>
            <th>SKU</th>
            <th style={{ width: "80px", textAlign: "right" }}>Qty</th>
            <th style={{ width: "120px", textAlign: "right" }}>Unit Price</th>
            <th style={{ width: "120px", textAlign: "right" }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {lineItems.map((li, i) => (
            <tr key={li.id}>
              <td>{i + 1}</td>
              <td>{li.productName}</td>
              <td>{li.sku}</td>
              <td style={{ textAlign: "right" }}>{li.quantity}</td>
              <td style={{ textAlign: "right" }}>৳ {li.unitPrice.toLocaleString()}</td>
              <td style={{ textAlign: "right" }}>৳ {li.lineTotal.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="totals">
        <div className="totals-row"><span>Subtotal</span><span>৳ {subtotal.toLocaleString()}</span></div>
        <div className="totals-row"><span>Shipping</span><span>৳ {shipping.toLocaleString()}</span></div>
        <div className="totals-row"><span>VAT (15%)</span><span>৳ {vat.toLocaleString()}</span></div>
        {discount > 0 && (
          <div className="totals-row">
            <span>Discount {order.couponCode ? `(${order.couponCode})` : ""}</span>
            <span>-৳ {discount.toLocaleString()}</span>
          </div>
        )}
        <div className="totals-row grand"><span>Grand Total</span><span>৳ {order.grandTotal.toLocaleString()}</span></div>
      </div>

      <div className="signatures">
        <div>
          <div className="sig-line">Customer Signature / Stamp</div>
        </div>
        <div>
          <div className="sig-line">Authorized Signature — ShopName BD</div>
        </div>
      </div>

      <div className="footer">
        <p>Thank you for your business! For inquiries, contact support@shopname.bd</p>
        <p>This is a computer-generated invoice. No signature required.</p>
      </div>
    </div>
  );
}
