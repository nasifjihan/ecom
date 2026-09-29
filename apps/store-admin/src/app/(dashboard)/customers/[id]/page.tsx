"use client";

import { CustomerWalletPanel } from "@/components/customers/wallet-panel";
import { CustomerBusinessPanel } from "@/components/customers/business-account";
import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ShoppingCart,
  Wallet,
  BarChart3,
  RotateCcw,
  Clock,
  Mail,
  Phone,
  PlusCircle,
  LogIn,
  Send,
  MapPin,
  Edit,
  Trash2,
  Star,
  Heart,
  Gift,
  Calendar,
  TrendingUp,
  Package,
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
  Skeleton,
  Separator,
  Textarea,
} from "@/components/ui";
import {
  useGetCustomerQuery,
  useGetOrderListQuery,
  type Customer,
  type CustomerGroup,
} from "@/lib/features/operations/operations-api-slice";
import { useGetReviewsQuery } from "@/lib/features/marketing/marketing-api-slice";
import { cn } from "@/components/ui";

// Groups are store-defined; known names get a colour, anything else the neutral style.
const GROUP_STYLES: Record<string, string> = {
  wholesale: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20",
  vip: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/20",
  guest: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20",
};
const groupStyle = (g: CustomerGroup) =>
  GROUP_STYLES[g.toLowerCase()] ??
  "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/20";

function getAvatarColor(name: string) {
  const colors = ["bg-indigo-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-blue-500", "bg-purple-500", "bg-cyan-500", "bg-orange-500"];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}
function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase();
}
function fc(n: number) { return `৳ ${n.toLocaleString()}`; }
function fd(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function fdd(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const cid = params.id ?? "1";
  const { data: customerRaw, isLoading } = useGetCustomerQuery(cid);
  const { data: ordersData } = useGetOrderListQuery({ customerId: cid, limit: 50 });
  const { data: reviewsData } = useGetReviewsQuery({ customerId: cid, perPage: 50 });
  const [tab, setTab] = useState("overview");
  const orders = ordersData?.items ?? [];
  const reviews = reviewsData?.items ?? [];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-40" />
        <Card className="p-6"><div className="flex items-center gap-6"><Skeleton className="h-24 w-24 rounded-full" /><div className="space-y-2 flex-1"><Skeleton className="h-7 w-60" /><Skeleton className="h-4 w-80" /><Skeleton className="h-5 w-40" /></div></div></Card>
        <div className="grid grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
      </div>
    );
  }

  if (!customerRaw) {
    return (
      <div className="py-24 text-center">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Customer not found</h1>
        <Link href="/customers" className="mt-6 inline-block text-sm font-medium text-indigo-600 hover:underline">Back to customers</Link>
      </div>
    );
  }
  const c: Customer = customerRaw;
  const lastOrderAt = orders[0]?.createdAt;
  const refundsCount = orders.filter((o) => o.status === "REFUNDED").length;

  const stats = [
    { icon: ShoppingCart, label: "Orders", value: c.ordersCount.toLocaleString(), color: "text-indigo-600", bg: "bg-indigo-50 dark:bg-indigo-500/10", hint: `AOV ${fc(c.aov ?? 0)}` },
    { icon: Wallet, label: "Total Spent", value: fc(c.totalSpent), color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-500/10", hint: `Store credit ${fc(c.storeCredit ?? 0)}` },
    { icon: BarChart3, label: "Avg Order Value", value: fc(c.aov ?? 0), color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-500/10", hint: `${c.ordersCount} orders` },
    { icon: RotateCcw, label: "Refunded orders", value: `${refundsCount}`, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-500/10", hint: lastOrderAt ? `Last order: ${fdd(lastOrderAt)}` : "No orders" },
  ];

  return (
    <div className="space-y-6 pb-12">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <Link href="/customers" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 mb-3">
          <ArrowLeft className="h-4 w-4" /> Back to Customers
        </Link>
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <Card className="flex-1 border-slate-200 dark:border-slate-800 shadow-sm">
            <CardContent className="p-5 flex flex-col sm:flex-row gap-5">
              <Avatar className="h-24 w-24 border-4 border-white shadow-lg shrink-0">
                <AvatarFallback className={cn(getAvatarColor(c.name), "text-white text-2xl font-bold")}>
                  {getInitials(c.name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{c.name}</h1>
                  <Badge variant="outline" className={cn(groupStyle(c.group), "font-medium")}>
                    {c.group}
                  </Badge>
                  {c.status && c.status !== "ACTIVE" && <Badge variant="outline" className="text-xs">{c.status}</Badge>}
                </div>
                <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-600 dark:text-slate-400">
                  <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1.5 hover:text-indigo-600 dark:hover:text-indigo-400">
                    <Mail className="h-3.5 w-3.5" /> {c.email}
                  </a>
                  <a href={`tel:${c.phone}`} className="inline-flex items-center gap-1.5 hover:text-indigo-600 dark:hover:text-indigo-400">
                    <Phone className="h-3.5 w-3.5" /> {c.phone ?? "—"}
                  </a>
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" /> Member since {fdd(c.createdAt)}
                  </span>
                </div>
                {c.lastActiveAt && (
                  <div className="text-xs text-slate-500 inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Last active {fd(c.lastActiveAt)}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap sm:flex-col sm:items-end gap-2">
                <a href={`mailto:${c.email}`}>
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <Send className="h-4 w-4" /> Send Email
                  </Button>
                </a>
              </div>
            </CardContent>
          </Card>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.05 }}
          >
            <Card className="border-slate-200 shadow-sm dark:border-slate-800 h-full">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{s.label}</p>
                    <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{s.value}</p>
                  </div>
                  <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center", s.bg)}>
                    <s.icon className={cn("h-5 w-5", s.color)} />
                  </div>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">{s.hint}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <Card className="border-slate-200 shadow-sm dark:border-slate-800 overflow-hidden">
        <CardContent className="p-0">
          <Tabs defaultValue="overview" value={tab} onValueChange={setTab}>
            <div className="px-5 pt-5">
              <TabsList className="w-full justify-start">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="orders">Orders ({c.ordersCount})</TabsTrigger>
                <TabsTrigger value="addresses">Addresses</TabsTrigger>
                <TabsTrigger value="wishlist">Wishlist ({c.wishlistCount ?? 0})</TabsTrigger>
                <TabsTrigger value="reviews">Reviews ({reviews.length})</TabsTrigger>
                <TabsTrigger value="points">Wallet & level</TabsTrigger>
                <TabsTrigger value="business">Business</TabsTrigger>
              </TabsList>
            </div>
            <div className="p-5">
              <TabsContent value="overview" className="mt-2 space-y-5">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                  <div className="lg:col-span-2 space-y-5">
                    <Card className="border-slate-200 dark:border-slate-800">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2"><Clock className="h-4 w-4 text-indigo-600" /> Recent Activity</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="relative pl-6 space-y-4">
                          <div className="absolute left-[11px] top-1 bottom-1 w-[2px] bg-slate-200 dark:bg-slate-700" />
                          {[
                            ...orders.slice(0, 5).map((o) => ({
                              color: "bg-indigo-500",
                              text: `Placed order ${o.orderNumber} (${o.status.replace(/_/g, " ").toLowerCase()})`,
                              sub: fd(o.createdAt),
                            })),
                            ...reviews.slice(0, 3).map((r) => ({
                              color: "bg-amber-500",
                              text: `Reviewed ${r.productName} (${r.rating}/5)`,
                              sub: fd(r.submittedAt),
                            })),
                            { color: "bg-purple-500", text: "Account created", sub: fd(c.createdAt) },
                          ].map((e, i) => (
                            <div key={i} className="relative">
                              <div className={cn("absolute -left-6 top-1 w-4 h-4 rounded-full border-2 border-white dark:border-slate-900", e.color)} />
                              <div>
                                <div className="text-sm font-medium text-slate-900 dark:text-white">{e.text}</div>
                                <div className="text-xs text-slate-500">{e.sub}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                  <div className="space-y-5">
                    <Card className="border-slate-200 dark:border-slate-800">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-semibold">Summary Snapshot</CardTitle>
                      </CardHeader>
                      <CardContent className="text-sm space-y-2.5">
                        {[
                          ["Customer ID", `#${c.id}`],
                          ["Group", c.group],
                          ["Status", c.status ?? "—"],
                          ["Loyalty points", (c.loyaltyPoints ?? 0).toLocaleString()],
                          ["Store credit", fc(c.storeCredit ?? 0)],
                          ["Last order", fdd(lastOrderAt)],
                          ["Last active", fdd(c.lastActiveAt)],
                          ["Signed up", fdd(c.createdAt)],
                        ].map(([k, v]) => (
                          <div key={k} className="flex justify-between">
                            <span className="text-slate-500">{k}</span>
                            <span className="font-medium text-slate-800 dark:text-slate-200">{v}</span>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="orders" className="mt-2">
                <Card className="border-slate-200 dark:border-slate-800">
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Order</TableHead>
                          <TableHead className="text-xs">Date</TableHead>
                          <TableHead className="text-xs">Status</TableHead>
                          <TableHead className="text-xs">Items</TableHead>
                          <TableHead className="text-xs text-right">Total</TableHead>
                          <TableHead className="text-xs text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orders.length === 0 && (
                          <TableRow><TableCell colSpan={6} className="text-center text-sm text-slate-500 py-8">No orders yet.</TableCell></TableRow>
                        )}
                        {orders.map((o) => (
                          <TableRow key={o.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                            <TableCell>
                              <Link href={`/orders/${o.id}`} className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">{o.orderNumber}</Link>
                            </TableCell>
                            <TableCell className="text-sm text-slate-600">{fdd(o.createdAt)}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={cn(
                                o.status === "DELIVERED" || o.status === "COMPLETED" ? "text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-transparent"
                                : o.status === "CANCELLED" || o.status === "REFUNDED" || o.status === "FAILED" ? "text-red-700 bg-red-50 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-transparent"
                                : "text-indigo-700 bg-indigo-50 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-transparent"
                              )}>{o.status}</Badge>
                            </TableCell>
                            <TableCell className="text-sm">{o.itemsCount}</TableCell>
                            <TableCell className="text-right font-semibold">{fc(o.grandTotal)}</TableCell>
                            <TableCell className="text-right">
                              <Link href={`/orders/${o.id}`}>
                                <Button variant="ghost" size="icon" className="h-8 w-8"><Eye className="h-4 w-4" /></Button>
                              </Link>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="addresses" className="mt-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {[
                    { title: "Billing Address", icon: Mail, addr: c.billingAddress },
                    { title: "Shipping Address", icon: Package, addr: c.shippingAddress },
                  ].map((b, i) => (
                    <Card key={i} className="border-slate-200 dark:border-slate-800">
                      <CardHeader className="pb-3 flex flex-row items-center justify-between">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2"><b.icon className="h-4 w-4 text-indigo-600" />{b.title}</CardTitle>
                        <Button variant="ghost" size="sm" className="gap-1 h-8"><Edit className="h-3.5 w-3.5" />Edit</Button>
                      </CardHeader>
                      <CardContent className="text-sm space-y-1 text-slate-700 dark:text-slate-300">
                        <div className="font-semibold text-slate-900 dark:text-white">{b.addr?.firstName} {b.addr?.lastName}</div>
                        {b.addr?.address1 && <div>{b.addr.address1}</div>}
                        {b.addr?.address2 && <div>{b.addr.address2}</div>}
                        <div>{[b.addr?.district, b.addr?.division, b.addr?.postcode].filter(Boolean).join(", ")}</div>
                        {b.addr?.country && <div>{b.addr.country}</div>}
                        {b.addr?.phone && <div className="text-slate-500 pt-1">Phone: {b.addr.phone}</div>}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="wishlist" className="mt-2">
                <Card className="border-slate-200 dark:border-slate-800">
                  <CardContent className="p-8 text-center text-sm text-slate-500">
                    <Heart className="h-10 w-10 mx-auto mb-3 text-slate-300" />
                    This customer has {c.wishlistCount ?? 0} wishlist item(s). Listing them here needs an admin wishlist endpoint, which the API does not have yet.
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="reviews" className="mt-2 space-y-4">
                {reviews.length === 0 && <p className="text-sm text-slate-500 py-6 text-center">No reviews yet.</p>}
                {reviews.map((r) => (
                  <Card key={r.id} className="border-slate-200 dark:border-slate-800">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-white">{r.productName}</div>
                          <div className="text-xs text-slate-500">{fdd(r.submittedAt)} · {r.status}</div>
                        </div>
                        <div className="flex items-center gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} className={cn("h-4 w-4", i < r.rating ? "fill-amber-400 text-amber-400" : "text-slate-300")} />
                          ))}
                        </div>
                      </div>
                      <p className="text-sm text-slate-700 dark:text-slate-300">&ldquo;{r.text}&rdquo;</p>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              <TabsContent value="points" className="mt-2">
                <CustomerWalletPanel customerId={cid} loyaltyPoints={c.loyaltyPoints ?? 0} />
              </TabsContent>

              <TabsContent value="business" className="mt-2">
                <CustomerBusinessPanel customerId={cid} />
              </TabsContent>

            </div>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
