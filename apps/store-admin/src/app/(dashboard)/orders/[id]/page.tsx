"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Printer,
  FileText,
  Mail,
  ChevronDown,
  MapPin,
  Phone,
  Mail as MailIcon,
  Building,
  Package,
  Truck,
  CreditCard,
  Plus,
  Send,
  Tag,
  Clock,
  User,
  History,
  RotateCcw,
  Tag as TagIcon,
  FileCheck,
  Image as ImageIcon,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
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
  Separator,
  Textarea,
} from "@/components/ui";
import {
  useGetOrderQuery,
  useUpdateOrderStatusMutation,
  useOrderInvoiceMutation,
  useSendOrderEmailMutation,
  useCreateOrderNoteMutation,
  VALID_STATUS_TRANSITIONS,
  PAYMENT_METHOD_META,
  sourceLabel,
  type Order,
  type OrderStatus,
  type OrderNote,
  type AppliedPromotion,
  type OrderLine,
} from "@/lib/features/operations/operations-api-slice";
import { FULFILLMENT_LABELS, FULFILLMENT_STYLES, RETURN_LABELS, RETURN_STYLES, type ReturnStatus } from "@/lib/features/operations/fulfilment-api-slice";
import { ParcelsCard } from "@/components/orders/parcels-card";
import { ReturnsCard } from "@/components/orders/returns-card";
import { OrderSmsCard } from "@/components/orders/order-sms-card";
import { ShipsFromCard } from "@/components/orders/ships-from-card";
import { OrderPayments } from "@/components/orders/order-payments";
import { useCan } from "@/lib/permissions";
import { OrderSalesperson } from "@/components/sales/order-salesperson";
import { openFile } from "@ecom/api-client";
import { cn } from "@/components/ui";

const STATUS_STYLES_LOCAL: Record<OrderStatus, string> = {
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

const TIMELINE_STATUSES: OrderStatus[] = [
  "PENDING",
  "PROCESSING",
  "SHIPPED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "COMPLETED",
];

const TIMELINE_LABELS: Record<OrderStatus, string> = {
  PENDING: "Received",
  PROCESSING: "Processing",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  COMPLETED: "Completed",
  ON_HOLD: "On Hold",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
  FAILED: "Failed",
  OUT_FOR_DELIVERY: "Out for Delivery",
};

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase();
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatCurrency(n: number) {
  return `৳ ${n.toLocaleString()}`;
}

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const orderId = params.id ?? "1";

  const { data: orderRaw, isLoading } = useGetOrderQuery(orderId);
  // Placeholder keeps the hooks below safe until the order loads (or turns out not to exist).
  // Loyalty lines, read from the typed order.
  const loyalty = { discount: orderRaw?.memberDiscount ?? 0, level: orderRaw?.memberLevel, wallet: orderRaw?.walletUsed ?? 0, cashback: orderRaw?.cashback ?? 0 };
  const order = (orderRaw as any) ?? { id: orderId, status: "PENDING", lines: [], notes: [], refunds: [], timeline: [], auditLog: [] };
  const placedOn = orderRaw?.storefront;

  const [updateStatus] = useUpdateOrderStatusMutation();
  const [loadInvoice] = useOrderInvoiceMutation();
  const [sendEmail] = useSendOrderEmailMutation();
  const [createNote] = useCreateOrderNoteMutation();
  const { can } = useCan();
  const canEdit = can("orders.edit");

  const [newNote, setNewNote] = useState("");
  const [noteType, setNoteType] = useState<"INTERNAL" | "CUSTOMER">("INTERNAL");
  const [tab, setTab] = useState("notes");

  const allowedTransitions = VALID_STATUS_TRANSITIONS[order.status as OrderStatus] ?? [];

  function handleStatusChange(s: OrderStatus) {
    updateStatus({ id: order.id, status: s })
      .unwrap()
      .then(() => toast.success(`Status changed to ${s.replace(/_/g, " ")}`))
      .catch(() => toast.error("Failed to update status"));
  }

  /** Opens the invoice PDF in a new tab (print it from there), or saves it. */
  async function handleInvoice(mode: "open" | "download") {
    try {
      await openFile(() => loadInvoice(order.id).unwrap(), { filename: `invoice-INV-${order.orderNumber}.pdf`, mode });
    } catch {
      toast.error("Couldn't load the invoice. Please try again.");
    }
  }

  async function handleSendEmail() {
    try { await sendEmail(order.id).unwrap(); toast.success("Order confirmation sent to the customer"); }
    catch { toast.error("Couldn't send the email. Check Settings > Emails > Sent emails."); }
  }

  async function handleAddNote() {
    if (!newNote.trim()) return;
    try {
      await createNote({ id: order.id, content: newNote.trim(), type: noteType }).unwrap();
      setNewNote("");
      toast.success("Note added");
    } catch { toast.error("Failed to add note"); }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-96 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!orderRaw) {
    return (
      <div className="py-24 text-center">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Order not found</h1>
        <p className="mt-2 text-sm text-slate-500">It may have been deleted, or it belongs to another store.</p>
        <Link href="/orders" className="mt-6 inline-block text-sm font-medium text-indigo-600 hover:underline">
          Back to orders
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <Link href="/orders" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 mb-3">
          <ArrowLeft className="h-4 w-4" /> Back to Orders
        </Link>
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Order {order.orderNumber}
            </h1>
            <Badge variant="outline" className={cn(STATUS_STYLES_LOCAL[order.status as OrderStatus], "capitalize font-medium px-3 py-1")}>
              {(order.status as string).replace(/_/g, " ")}
            </Badge>
            {order.fulfillmentStatus && order.fulfillmentStatus.toUpperCase() !== order.status && (
              <Badge variant="outline" className={cn(FULFILLMENT_STYLES[order.fulfillmentStatus], "font-medium px-3 py-1")}>
                {FULFILLMENT_LABELS[order.fulfillmentStatus] ?? order.fulfillmentStatus}
              </Badge>
            )}
            {order.returnStatus && order.returnStatus !== "none" && (
              <Badge variant="outline" className={cn(RETURN_STYLES[order.returnStatus as ReturnStatus], "font-medium px-3 py-1")}>
                Return {RETURN_LABELS[order.returnStatus as ReturnStatus]?.toLowerCase() ?? order.returnStatus}
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Tag className="h-4 w-4" />
                  Change Status
                  <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>Next allowed status</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {allowedTransitions.length === 0 && (
                  <DropdownMenuItem disabled>No valid transitions</DropdownMenuItem>
                )}
                {allowedTransitions.map((s) => (
                  <DropdownMenuItem key={s} onClick={() => handleStatusChange(s)}>
                    {s.replace(/_/g, " ")}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handleInvoice("download")}>
              <FileText className="h-4 w-4" />
              Download Invoice
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleSendEmail}>
              <Mail className="h-4 w-4" />
              Send Email
            </Button>
            <Button size="sm" className="gap-1.5" onClick={() => handleInvoice("open")}>
              <Printer className="h-4 w-4" />
              Print Invoice
            </Button>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="border-slate-200 shadow-sm dark:border-slate-800">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <User className="h-4 w-4 text-indigo-600" /> General Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <Avatar className="h-11 w-11 border-2 border-white shadow">
                  <AvatarFallback className="bg-indigo-500 text-white text-sm font-semibold">
                    {getInitials(order.customerName)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-semibold text-slate-900 dark:text-white">{order.customerName}</div>
                  <div className="text-xs text-slate-500">Customer #{order.customerId}</div>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <a href={`mailto:${order.customerEmail}`} className="flex items-center gap-2 text-slate-600 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400">
                  <MailIcon className="h-4 w-4 text-slate-400" /> {order.customerEmail}
                </a>
                <a href={`tel:${order.customerPhone}`} className="flex items-center gap-2 text-slate-600 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400">
                  <Phone className="h-4 w-4 text-slate-400" /> {order.customerPhone}
                </a>
              </div>
            </div>

            <Separator />

            <div>
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="h-4 w-4 text-emerald-600" />
                <h3 className="text-sm font-semibold">Billing Address</h3>
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-400 space-y-0.5 pl-6">
                <div className="font-medium text-slate-800 dark:text-slate-200">{order.billingAddress?.firstName} {order.billingAddress?.lastName}</div>
                {order.billingAddress?.company && <div className="text-xs flex items-center gap-1"><Building className="h-3 w-3" />{order.billingAddress.company}</div>}
                {order.billingAddress?.address1 && <div>{order.billingAddress.address1}</div>}
                {order.billingAddress?.address2 && <div>{order.billingAddress.address2}</div>}
                <div>
                  {[order.billingAddress?.upazila, order.billingAddress?.district, order.billingAddress?.division, order.billingAddress?.postcode].filter(Boolean).join(", ")}
                </div>
                {order.billingAddress?.country && <div>{order.billingAddress.country}</div>}
                {order.billingAddress?.phone && <div className="text-xs text-slate-500">{order.billingAddress.phone}</div>}
              </div>
            </div>

            <Separator />

            <div>
              <div className="flex items-center gap-2 mb-2">
                <Truck className="h-4 w-4 text-indigo-600" />
                <h3 className="text-sm font-semibold">Shipping Address</h3>
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-400 space-y-0.5 pl-6">
                <div className="font-medium text-slate-800 dark:text-slate-200">{order.shippingAddress?.firstName} {order.shippingAddress?.lastName}</div>
                {order.shippingAddress?.address1 && <div>{order.shippingAddress.address1}</div>}
                {order.shippingAddress?.address2 && <div>{order.shippingAddress.address2}</div>}
                <div>
                  {[order.shippingAddress?.upazila, order.shippingAddress?.district, order.shippingAddress?.division, order.shippingAddress?.postcode].filter(Boolean).join(", ")}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm dark:border-slate-800 lg:col-span-1 overflow-hidden">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Package className="h-4 w-4 text-indigo-600" /> Products
            </CardTitle>
            <CardDescription className="text-xs">{order.itemsCount} items</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="max-h-[420px]">
              <Table>
                <TableHeader className="sticky top-0 bg-card z-10">
                  <TableRow className="border-slate-200 dark:border-slate-800">
                    <TableHead className="text-xs">Item</TableHead>
                    <TableHead className="text-xs text-right">Qty</TableHead>
                    <TableHead className="text-xs text-right">Unit</TableHead>
                    <TableHead className="text-xs text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.lines.map((l: OrderLine) => (
                    <Fragment key={l.id}>
                    <TableRow className="border-slate-200 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 shrink-0 overflow-hidden">
                            {l.imageUrl ? (
                              <img src={l.imageUrl} alt={l.productName} className="h-full w-full object-cover" />
                            ) : (
                              <Package className="h-5 w-5" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-slate-900 dark:text-white text-sm leading-tight">{l.productName}</div>
                            {l.giftFrom && (
                              <span className="mt-0.5 inline-block rounded bg-pink-100 px-1.5 text-[11px] font-medium text-pink-800 dark:bg-pink-500/15 dark:text-pink-300">
                                Free gift · {l.giftFrom}
                              </span>
                            )}
                            {l.giftBox && (
                              <span className="mt-0.5 block text-[11px] font-medium text-violet-700 dark:text-violet-300">
                                {l.giftBox.role === "box" ? "Gift box" : "In gift box"} · {l.giftBox.name}
                              </span>
                            )}
                            <div className="text-xs text-slate-500 font-mono">{l.sku}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-sm">× {l.quantity}</TableCell>
                      <TableCell className="text-right text-sm text-slate-600 dark:text-slate-400">{formatCurrency(l.unitPrice)}</TableCell>
                      <TableCell className="text-right text-sm font-semibold">{formatCurrency(l.lineTotal)}</TableCell>
                    </TableRow>
                    {l.giftBox?.role === "box" && l.giftBox.message && (
                      <TableRow className="border-slate-200 dark:border-slate-800">
                        <TableCell colSpan={4} className="bg-violet-50/60 py-2 text-sm dark:bg-violet-500/10">
                          <span className="font-medium text-violet-700 dark:text-violet-300">Card for {l.giftBox.name}:</span>{" "}
                          <span className="italic text-slate-700 dark:text-slate-200">“{l.giftBox.message}”</span>
                        </TableCell>
                      </TableRow>
                    )}
                    </Fragment>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
            <div className="p-4 space-y-2 border-t border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40">
              <div className="flex justify-between text-sm"><span className="text-slate-600 dark:text-slate-400">Subtotal</span><span className="font-medium">{formatCurrency(order.subtotal)}</span></div>
              {order.promotions
                .filter((p: AppliedPromotion) => p.amount > 0)
                .map((p: AppliedPromotion) => (
                  <div key={`${p.id}-${p.type}`} className="flex justify-between text-sm">
                    <span className="text-slate-600 dark:text-slate-400">
                      {p.name}
                      {p.type === "bxgy" && p.freeUnits ? <span className="ml-1 text-xs">({p.freeUnits} free)</span> : null}
                    </span>
                    <span className="font-medium text-red-600">-{formatCurrency(p.amount)}</span>
                  </div>
                ))}
              {order.discountAmount - order.manualDiscount - order.promotionDiscount - loyalty.discount > 0.004 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400">
                    Discount {order.couponCode && <span className="text-indigo-600 dark:text-indigo-400 font-mono text-xs ml-1">({order.couponCode})</span>}
                  </span>
                  <span className="font-medium text-red-600">-{formatCurrency(order.discountAmount - order.manualDiscount - order.promotionDiscount - loyalty.discount)}</span>
                </div>
              )}
              {loyalty.discount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400">{loyalty.level ?? "Member"} discount</span>
                  <span className="font-medium text-red-600">-{formatCurrency(loyalty.discount)}</span>
                </div>
              )}
              {order.manualDiscount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400">Staff discount</span>
                  <span className="font-medium text-red-600">-{formatCurrency(order.manualDiscount)}</span>
                </div>
              )}
              {order.promotions.some((p: AppliedPromotion) => p.type === "free_delivery") && (
                <div className="text-xs text-emerald-700 dark:text-emerald-400">
                  Free delivery: {order.promotions.find((p: AppliedPromotion) => p.type === "free_delivery")!.name}
                </div>
              )}
              <div className="flex justify-between text-sm"><span className="text-slate-600 dark:text-slate-400">Shipping ({order.shippingMethod})</span><span className="font-medium">{formatCurrency(order.shippingCost)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-slate-600 dark:text-slate-400">VAT (15%)</span><span className="font-medium">{formatCurrency(order.vatAmount)}</span></div>
              {loyalty.wallet > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400">Paid from wallet</span>
                  <span className="font-medium text-indigo-600">-{formatCurrency(loyalty.wallet)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between items-baseline pt-1">
                <span className="font-semibold text-slate-900 dark:text-white">{loyalty.wallet > 0 ? "To pay" : "Grand Total"}</span>
                <span className="text-xl font-bold text-slate-900 dark:text-white">{formatCurrency(order.grandTotal)}</span>
              </div>
              {loyalty.cashback > 0 && <p className="text-xs text-emerald-700">{formatCurrency(loyalty.cashback)} cashback credited to the customer&apos;s wallet.</p>}
            </div>

            {order.refundedTotal > 0 && (
              <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 bg-purple-50/50 dark:bg-purple-500/5 flex justify-between text-sm">
                <span className="flex items-center gap-2 text-purple-700 dark:text-purple-400 font-medium"><RotateCcw className="h-4 w-4" /> Refunded</span>
                <span className="font-semibold text-purple-700 dark:text-purple-400">-{formatCurrency(order.refundedTotal)}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-slate-200 shadow-sm dark:border-slate-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <FileCheck className="h-4 w-4 text-indigo-600" /> Status Timeline
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="relative pl-6">
                <div className="absolute left-[11px] top-2 bottom-2 w-[2px] bg-slate-200 dark:bg-slate-700" />
                {TIMELINE_STATUSES.map((s, idx) => {
                  const reachedIdx = order.timeline?.findIndex((t: any) => t.status === s);
                  const reached = reachedIdx !== -1;
                  const isCurrent = order.status === s;
                  const stamp = order.timeline?.find((t: any) => t.status === s)?.timestamp;
                  return (
                    <div key={s} className="relative pb-5 last:pb-0">
                      <div
                        className={cn(
                          "absolute -left-6 top-0.5 h-5 w-5 rounded-full border-2 flex items-center justify-center",
                          reached
                            ? isCurrent
                              ? "border-indigo-500 bg-indigo-500"
                              : "border-emerald-500 bg-emerald-500"
                            : "border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900",
                        )}
                      >
                        {reached && !isCurrent && (
                          <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <div className="min-h-6">
                        <div className={cn("text-sm font-medium", reached ? "text-slate-900 dark:text-white" : "text-slate-400 dark:text-slate-500")}>
                          {TIMELINE_LABELS[s]} {isCurrent && <Badge className="ml-2 px-1.5 py-0 text-[10px]">Current</Badge>}
                        </div>
                        {stamp && (
                          <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                            <Clock className="h-3 w-3" />
                            {formatDate(stamp)}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {["ON_HOLD", "CANCELLED", "REFUNDED", "FAILED"].includes(order.status) && (
                  <div className="relative mt-2">
                    <div className={cn(
                      "absolute -left-6 top-0.5 h-5 w-5 rounded-full border-2",
                      "border-red-500 bg-red-500",
                    )} />
                    <div>
                      <div className="text-sm font-medium text-red-600 dark:text-red-400">
                        {TIMELINE_LABELS[order.status as OrderStatus]}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <OrderSalesperson orderId={orderId} />

          <Card className="border-slate-200 shadow-sm dark:border-slate-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-indigo-600" /> Payment Details
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Method</span>
                <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium", (PAYMENT_METHOD_META as Record<string, { label: string; color: string } | undefined>)[String(order.paymentMethod)]?.color ?? "bg-slate-100 text-slate-700")}>
                  <CreditCard className="h-3 w-3" /> {(PAYMENT_METHOD_META as Record<string, { label: string; color: string } | undefined>)[String(order.paymentMethod)]?.label ?? String(order.paymentMethod).replace(/_/g, " ").toLowerCase()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Source</span>
                <span>{sourceLabel(order.source)}</span>
              </div>
              {placedOn && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Storefront</span>
                  <span>{placedOn.name}</span>
                </div>
              )}
              {order.createdByName && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Entered by</span>
                  <span>{order.createdByName}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">Transaction ID</span>
                <span className="font-mono text-xs">{order.transactionId ?? "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Paid on</span>
                <span className="text-xs">{order.paidAt ? formatDate(order.paidAt) : "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Status</span>
                <Badge variant="outline" className={cn(
                  order.paymentStatus === "PAID" ? "text-emerald-700 bg-emerald-50 border-emerald-200" : "text-amber-700 bg-amber-50 border-amber-200",
                  "dark:border-transparent",
                )}>
                  {(order.paymentStatus ?? "UNKNOWN").replace(/_/g, " ")}
                </Badge>
              </div>
              <OrderPayments orderId={order.id} method={String(order.paymentMethod)} closed={["CANCELLED", "FAILED", "REFUNDED"].includes(order.status)} />
            </CardContent>
          </Card>

          <ParcelsCard order={order} canEdit={canEdit} />
          <ShipsFromCard orderId={orderId} canEdit={canEdit} />
        </div>
      </div>

      <ReturnsCard order={order} canEdit={canEdit} />
      <OrderSmsCard orderId={order.id} phone={order.shippingAddress?.phone ?? order.customerPhone} canEdit={canEdit} />

      <Card className="border-slate-200 shadow-sm dark:border-slate-800">
        <CardContent className="p-0">
          <Tabs defaultValue="notes" value={tab} onValueChange={setTab}>
            <div className="px-4 pt-4">
              <TabsList className="w-full justify-start">
                <TabsTrigger value="notes">Order Notes</TabsTrigger>
                <TabsTrigger value="audit">Audit Log</TabsTrigger>
              </TabsList>
            </div>
            <div className="p-4">
              <TabsContent value="notes" className="mt-2">
                <div className="flex flex-col sm:flex-row gap-3 mb-4">
                  <div className="flex-1">
                    <Textarea
                      placeholder={noteType === "INTERNAL" ? "Add an internal note (staff only)" : "Add a note to send to the customer"}
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      rows={2}
                    />
                  </div>
                  <div className="flex sm:flex-col gap-2 sm:min-w-[140px]">
                    <div className="flex gap-1 flex-1">
                      <button
                        type="button"
                        onClick={() => setNoteType("INTERNAL")}
                        className={cn(
                          "flex-1 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors",
                          noteType === "INTERNAL"
                            ? "bg-slate-900 text-white border-slate-900 dark:bg-slate-200 dark:text-slate-900 dark:border-slate-200"
                            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-700",
                        )}
                      >
                        Internal
                      </button>
                      <button
                        type="button"
                        onClick={() => setNoteType("CUSTOMER")}
                        className={cn(
                          "flex-1 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors",
                          noteType === "CUSTOMER"
                            ? "bg-indigo-600 text-white border-indigo-600"
                            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-700",
                        )}
                      >
                        Customer
                      </button>
                    </div>
                    <Button size="sm" className="gap-1.5" onClick={handleAddNote} disabled={!newNote.trim()}>
                      <Plus className="h-4 w-4" /> Add Note
                    </Button>
                  </div>
                </div>
                <div className="space-y-3">
                  {order.notes?.length === 0 && (
                    <div className="py-12 text-center text-sm text-slate-500">No notes yet.</div>
                  )}
                  {order.notes?.map((n: OrderNote) => (
                    <div
                      key={n.id}
                      className={cn(
                        "rounded-xl p-4 border",
                        n.type === "INTERNAL"
                          ? "bg-slate-50 border-slate-200 dark:bg-slate-900/50 dark:border-slate-800"
                          : "bg-indigo-50/50 border-indigo-200 dark:bg-indigo-500/5 dark:border-indigo-500/20",
                      )}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7">
                            <AvatarFallback className="bg-slate-400 text-white text-[10px] font-semibold">
                              {n.userName ? getInitials(n.userName) : "??"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="text-sm">
                            <span className="font-semibold text-slate-900 dark:text-white">{n.userName ?? "Staff"}</span>
                            <Badge className={cn("ml-2 px-1.5 py-0 text-[10px]", n.type === "INTERNAL" ? "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300" : "bg-indigo-200 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-400")}>
                              {n.type === "INTERNAL" ? "Internal" : "To Customer"}
                            </Badge>
                          </div>
                        </div>
                        <div className="text-xs text-slate-500 flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {formatDate(n.createdAt)}
                        </div>
                      </div>
                      <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{n.content}</p>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="audit" className="mt-2">
                <div className="relative pl-6 space-y-4">
                  <div className="absolute left-[11px] top-1 bottom-1 w-[2px] bg-slate-200 dark:bg-slate-800" />
                  {order.auditLog?.map((entry: any) => (
                    <div key={entry.id} className="relative">
                      <div className="absolute -left-6 top-1 h-4 w-4 rounded-full border-2 border-white dark:border-slate-900 bg-indigo-400" />
                      <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3 border border-slate-200 dark:border-slate-800">
                        <div className="flex items-center justify-between mb-1">
                          <div className="text-sm font-semibold text-slate-900 dark:text-white">{entry.action}</div>
                          <div className="text-xs text-slate-500">{formatDate(entry.createdAt)}</div>
                        </div>
                        {entry.field && (
                          <div className="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
                            <span className="font-mono">{entry.field}</span>
                            {entry.oldValue && (
                              <>
                                <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400">
                                  {entry.oldValue}
                                </span>
                                <History className="h-3 w-3" />
                                <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                                  {entry.newValue}
                                </span>
                              </>
                            )}
                          </div>
                        )}
                        <div className="text-xs text-slate-500 mt-1.5">By {entry.userName ?? "System"}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </CardContent>
      </Card>

    </div>
  );
}
