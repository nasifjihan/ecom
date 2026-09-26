"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Percent,
  Plus,
  Search,
  Filter,
  Download,
  MoreHorizontal,
  Pencil,
  Copy,
  Trash2,
  Eye,
  Layers,
  CheckCircle2,
  XCircle,
  ChevronDown,
  Loader2,
  X,
} from "lucide-react";
import { CouponType, ExportFormat } from "@ecom/shared-types";
import { formatMoney } from "@ecom/utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Select,
  SelectItem,
  Badge,
  Checkbox,
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
  Label,
} from "@/components/ui";
import {
  useGetCouponsQuery,
  useBulkUpdateCouponsMutation,
  useDeleteCouponMutation,
  useExportCouponsMutation,
  type Coupon,
} from "@/lib/features/marketing/marketing-api-slice";
import Link from "next/link";

const couponTypeColors: Record<CouponType, string> = {
  [CouponType.FIXED_CART]: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
  [CouponType.PERCENT_CART]: "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300",
  [CouponType.FIXED_PRODUCT]: "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300",
  [CouponType.PERCENT_PRODUCT]: "bg-pink-100 text-pink-700 dark:bg-pink-500/20 dark:text-pink-300",
  [CouponType.BUY_X_GET_Y]: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  [CouponType.FREE_SHIPPING]: "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300",
  [CouponType.STORE_CREDIT]: "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300",
};

const couponTypeLabels: Record<CouponType, string> = {
  [CouponType.FIXED_CART]: "Fixed Cart",
  [CouponType.PERCENT_CART]: "% Cart",
  [CouponType.FIXED_PRODUCT]: "Fixed Product",
  [CouponType.PERCENT_PRODUCT]: "% Product",
  [CouponType.BUY_X_GET_Y]: "BOGO",
  [CouponType.FREE_SHIPPING]: "Free Shipping",
  [CouponType.STORE_CREDIT]: "Store Credit",
};

function formatDiscount(coupon: Coupon): string {
  switch (coupon.type) {
    case CouponType.FIXED_CART:
    case CouponType.FIXED_PRODUCT:
      return formatMoney(coupon.amount);
    case CouponType.PERCENT_CART:
    case CouponType.PERCENT_PRODUCT:
      return `${coupon.amount}%`;
    case CouponType.BUY_X_GET_Y:
      return `Buy ${coupon.bogoBuyQty ?? 1} Get ${coupon.bogoGetQty ?? 1}`;
    case CouponType.FREE_SHIPPING:
      return "Free Ship";
    case CouponType.STORE_CREDIT:
      return formatMoney(coupon.amount);
    default:
      return String(coupon.amount);
  }
}

function computeCouponStatus(coupon: Coupon): "active" | "expired" | "upcoming" {
  const now = new Date();
  if (coupon.validUntil && new Date(coupon.validUntil) < now) return "expired";
  if (coupon.validFrom && new Date(coupon.validFrom) > now) return "upcoming";
  if (coupon.usageLimit !== undefined && (coupon.usageCount ?? 0) >= coupon.usageLimit) return "expired";
  return "active";
}

export default function CouponsPage() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [usageMin, setUsageMin] = useState<string>("");
  const [usageMax, setUsageMax] = useState<string>("");
  const [perUserLimit, setPerUserLimit] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<Coupon | null>(null);
  const [usageTarget, setUsageTarget] = useState<Coupon | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const { data: listData, isLoading } = useGetCouponsQuery({
    search: search || undefined,
    type: (typeFilter as CouponType) || undefined,
    status: (statusFilter as "active" | "expired" | "upcoming") || undefined,
    usageMin: usageMin ? Number(usageMin) : undefined,
    usageMax: usageMax ? Number(usageMax) : undefined,
    usagePerCustomer: perUserLimit ? Number(perUserLimit) : undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });

  const coupons = listData?.items ?? [];

  const allSelected = coupons.length > 0 && coupons.every((c) => selectedIds.has(c.id));
  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(coupons.map((c) => c.id)));
    }
  };
  const toggleOne = (id: string | number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const [bulkUpdate, { isLoading: bulkLoading }] = useBulkUpdateCouponsMutation();
  const [deleteCoupon, { isLoading: deleteLoading }] = useDeleteCouponMutation();
  const [exportCoupons, { isLoading: exportLoading }] = useExportCouponsMutation();

  const runBulk = async (action: "enable" | "disable" | "delete") => {
    if (selectedIds.size === 0) {
      toast.warning("Select at least one coupon first.");
      return;
    }
    try {
      await bulkUpdate({ ids: Array.from(selectedIds), action }).unwrap();
      toast.success(`Bulk ${action} applied to ${selectedIds.size} coupon(s).`);
      setSelectedIds(new Set());
    } catch (e: any) {
      toast.error(e?.data?.message || `Failed to run bulk ${action}.`);
    }
  };

  const runExport = async (format: ExportFormat) => {
    try {
      await exportCoupons({
        format,
        search: search || undefined,
        type: (typeFilter as CouponType) || undefined,
        status: (statusFilter as "active" | "expired" | "upcoming") || undefined,
      }).unwrap();
      toast.success(`Export (${format.toUpperCase()}) initiated.`);
    } catch (e: any) {
      toast.error(e?.data?.message || "Export failed.");
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteCoupon(deleteTarget.id).unwrap();
      toast.success("Coupon deleted.");
      setDeleteTarget(null);
    } catch (e: any) {
      toast.error(e?.data?.message || "Delete failed.");
    }
  };

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Coupon code copied.");
    } catch {
      toast.error("Clipboard unavailable.");
    }
  };

  const duplicateUrl = useMemo(() => "/marketing/coupons/new", []);

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Percent className="h-6 w-6 text-amber-600" /> Coupons
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Create and manage discount coupons, BOGO offers, free shipping, and store credit.
          </p>
        </div>
        <Link href="/marketing/coupons/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" /> Create Coupon
          </Button>
        </Link>
      </motion.div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Find coupons</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by code, description..."
                className="pl-9"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectItem value="">All Types</SelectItem>
              {Object.values(CouponType).map((t) => (
                <SelectItem key={t} value={t}>
                  {couponTypeLabels[t]}
                </SelectItem>
              ))}
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectItem value="">All Statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
              <SelectItem value="upcoming">Upcoming</SelectItem>
            </Select>
            <Button variant="outline" onClick={() => setShowFilters((s) => !s)}>
              <Filter className="h-4 w-4 mr-2" />
              Filters <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </div>
          {showFilters && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div>
                <Label className="text-xs">Usage Count Min</Label>
                <Input
                  type="number"
                  value={usageMin}
                  onChange={(e) => setUsageMin(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div>
                <Label className="text-xs">Usage Count Max</Label>
                <Input
                  type="number"
                  value={usageMax}
                  onChange={(e) => setUsageMax(e.target.value)}
                  placeholder="e.g. 1000"
                />
              </div>
              <div>
                <Label className="text-xs">Per User Limit</Label>
                <Input
                  type="number"
                  value={perUserLimit}
                  onChange={(e) => setPerUserLimit(e.target.value)}
                  placeholder="e.g. 1"
                />
              </div>
              <div>
                <Label className="text-xs">Created From</Label>
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Created To</Label>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pt-2 border-t">
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => runBulk("enable")}
                disabled={bulkLoading || selectedIds.size === 0}
              >
                {bulkLoading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                Enable
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => runBulk("disable")}
                disabled={bulkLoading || selectedIds.size === 0}
              >
                {bulkLoading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <XCircle className="h-4 w-4 mr-1" />}
                Disable
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => runBulk("delete")}
                disabled={bulkLoading || selectedIds.size === 0}
              >
                <Trash2 className="h-4 w-4 mr-1" /> Delete
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">{selectedIds.size} selected</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" disabled={exportLoading}>
                    {exportLoading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    Export
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Export Format</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => runExport(ExportFormat.CSV)}>Export CSV</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => runExport(ExportFormat.EXCEL)}>Export XLSX</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => runExport(ExportFormat.PDF)}>Export PDF</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                </TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Min Spend</TableHead>
                <TableHead>Usage</TableHead>
                <TableHead>Per User</TableHead>
                <TableHead>Valid Range</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-10 text-slate-500">
                    <Loader2 className="h-6 w-6 mx-auto animate-spin mb-2" /> Loading coupons...
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && coupons.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-10 text-slate-500">
                    No coupons found. Create one to get started.
                  </TableCell>
                </TableRow>
              )}
              {!isLoading &&
                coupons.map((c) => {
                  const status = computeCouponStatus(c);
                  return (
                    <TableRow key={String(c.id)} data-selected={selectedIds.has(c.id)}>
                      <TableCell>
                        <Checkbox checked={selectedIds.has(c.id)} onCheckedChange={() => toggleOne(c.id)} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <code className="font-mono text-sm bg-slate-100 dark:bg-slate-800 rounded px-2 py-1">
                            {c.code}
                          </code>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => copyCode(c.code)}
                            title="Copy code"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={couponTypeColors[c.type]} variant="outline">
                          {couponTypeLabels[c.type]}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{formatDiscount(c)}</TableCell>
                      <TableCell>{c.minimumSpend ? formatMoney(c.minimumSpend) : "—"}</TableCell>
                      <TableCell>
                        {c.usageCount ?? 0}
                        {c.usageLimit !== undefined ? ` / ${c.usageLimit}` : ""}
                      </TableCell>
                      <TableCell>{c.usageLimitPerUser ?? "∞"}</TableCell>
                      <TableCell className="text-xs text-slate-500 whitespace-nowrap">
                        {c.validFrom ? new Date(c.validFrom).toLocaleDateString() : "Now"}
                        <span className="mx-1">→</span>
                        {c.validUntil ? new Date(c.validUntil).toLocaleDateString() : "Never"}
                      </TableCell>
                      <TableCell>
                        {status === "active" ? (
                          <Badge variant="success">Active</Badge>
                        ) : status === "expired" ? (
                          <Badge variant="destructive">Expired</Badge>
                        ) : (
                          <Badge variant="secondary">Upcoming</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <Link
                              href={`/marketing/coupons/new?duplicate=${c.id}`}
                              className="w-full"
                            >
                              <DropdownMenuItem>
                                <Pencil className="h-4 w-4 mr-2" /> Edit
                              </DropdownMenuItem>
                            </Link>
                            <Link href={duplicateUrl + `?duplicate=${c.id}`} className="w-full">
                              <DropdownMenuItem>
                                <Layers className="h-4 w-4 mr-2" /> Duplicate
                              </DropdownMenuItem>
                            </Link>
                            <DropdownMenuItem onClick={() => setUsageTarget(c)}>
                              <Eye className="h-4 w-4 mr-2" /> View Usage
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setDeleteTarget(c)}
                              className="text-red-600 dark:text-red-400 focus:text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!deleteTarget} onOpenChange={(o: any) => !o && setDeleteTarget(null)}>
        <DialogTrigger asChild><span /></DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Coupon</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete coupon{" "}
              <code className="font-mono bg-slate-100 dark:bg-slate-800 rounded px-1.5 py-0.5">
                {deleteTarget?.code}
              </code>
              ? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleteLoading}>
              {deleteLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!usageTarget} onOpenChange={(o: any) => !o && setUsageTarget(null)}>
        <DialogTrigger asChild><span /></DialogTrigger>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Usage — {usageTarget?.code}
              <Badge variant="secondary" className="ml-2">
                {usageTarget?.usageCount ?? 0} redemptions
              </Badge>
            </DialogTitle>
            <DialogDescription>Orders that used this coupon.</DialogDescription>
          </DialogHeader>
          <div className="max-h-80 overflow-auto rounded border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Saved</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-6 text-slate-500 text-xs">
                    Usage history will load from the API once implemented.
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button onClick={() => setUsageTarget(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
