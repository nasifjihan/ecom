"use client";

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
  Note,
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
  type Customer,
  type CustomerGroup,
} from "@/lib/features/operations/operations-api-slice";
import { cn } from "@/components/ui";

const GROUP_STYLES: Record<CustomerGroup, string> = {
  WHOLESALE: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20",
  RETAIL: "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/20",
  VIP: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/20",
  GUEST: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20",
};
const GROUP_LABELS: Record<CustomerGroup, string> = {
  WHOLESALE: "Wholesale", RETAIL: "Retail", VIP: "VIP", GUEST: "Guest",
};

function getAvatarColor(name: string) {
  const colors = ["bg-indigo-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-blue-500", "bg-purple-500", "bg-cyan-500", "bg-orange-500"];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}
function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
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

function mockCustomer(id: string | number): Customer {
  const spent = 500 + ((Number(id) * 1277) % 95000);
  const orders = 1 + (Number(id) % 15);
  return {
    id, firstName: "Farhana", lastName: "Rahman", name: "Farhana Rahman",
    email: "farhana.rahman@example.com",
    phone: "+880 1712 345 678",
    group: (Number(id) % 4 === 0 ? "VIP" : "RETAIL") as CustomerGroup,
    isVerified: true, emailVerified: true, phoneVerified: true,
    totalSpent: spent, ordersCount: orders,
    ltv: Math.ceil(spent * 1.15), aov: Math.round(spent / orders),
    refundsCount: Number(id) % 11 === 0 ? 1 : 0,
    lastOrderAt: new Date(Date.now() - Number(id) * 86400000).toISOString(),
    lastActiveAt: new Date(Date.now() - Number(id) * 3600000 * 3).toISOString(),
    createdAt: new Date(Date.now() - Number(id) * 86400000 * 180).toISOString(),
    billingAddress: {
      firstName: "Farhana", lastName: "Rahman",
      address1: "House 15, Road 7, Block A", address2: "Banani",
      country: "Bangladesh", division: "Dhaka", district: "Dhaka", postcode: "1213",
      phone: "+880 1712 345 678",
    },
    shippingAddress: {
      firstName: "Farhana", lastName: "Rahman",
      address1: "House 15, Road 7, Block A", address2: "Banani",
      country: "Bangladesh", division: "Dhaka", district: "Dhaka", postcode: "1213",
      phone: "+880 1712 345 678",
    },
  };
}

const MOCK_ORDERS = [
  { id: 1, orderNumber: "#ORD-10234", date: new Date(Date.now() - 86400000 * 2).toISOString(), status: "DELIVERED", total: 4850, itemsCount: 2 },
  { id: 2, orderNumber: "#ORD-10201", date: new Date(Date.now() - 86400000 * 30).toISOString(), status: "COMPLETED", total: 12500, itemsCount: 3 },
  { id: 3, orderNumber: "#ORD-10155", date: new Date(Date.now() - 86400000 * 75).toISOString(), status: "COMPLETED", total: 3200, itemsCount: 1 },
  { id: 4, orderNumber: "#ORD-10120", date: new Date(Date.now() - 86400000 * 120).toISOString(), status: "COMPLETED", total: 8900, itemsCount: 4 },
  { id: 5, orderNumber: "#ORD-10099", date: new Date(Date.now() - 86400000 * 160).toISOString(), status: "RETURNED", total: 2100, itemsCount: 1 },
];

const MOCK_WISHLIST = [
  { id: 1, name: "Premium Leather Handbag", sku: "LH-BRN-002", price: 4500, image: "" },
  { id: 2, name: "Silk Saree - Maroon", sku: "SS-MAR-005", price: 7800, image: "" },
  { id: 3, name: "Gold Plated Earrings", sku: "GP-ER-012", price: 1890, image: "" },
];

const MOCK_REVIEWS = [
  { id: 1, product: "Premium Cotton Panjabi", rating: 5, comment: "Excellent quality, perfect fit. Will order again!", date: new Date(Date.now() - 86400000 * 10).toISOString() },
  { id: 2, product: "Linen Shirt", rating: 4, comment: "Good fabric, runs slightly large.", date: new Date(Date.now() - 86400000 * 45).toISOString() },
];

const MOCK_NOTES = [
  { id: 1, content: "Customer called regarding delivery time preferences - prefers after 5 PM.", author: "Admin User", createdAt: new Date(Date.now() - 86400000 * 5).toISOString() },
  { id: 2, content: "Customer is a bulk buyer - flagged for VIP consideration after 12th order.", author: "Staff Member A", createdAt: new Date(Date.now() - 86400000 * 60).toISOString() },
];

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const cid = params.id ?? "1";
  const { data: customerRaw, isLoading } = useGetCustomerQuery(cid);
  const c = (customerRaw as Customer) ?? mockCustomer(cid);
  const [tab, setTab] = useState("overview");
  const [newNote, setNewNote] = useState("");

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-40" />
        <Card className="p-6"><div className="flex items-center gap-6"><Skeleton className="h-24 w-24 rounded-full" /><div className="space-y-2 flex-1"><Skeleton className="h-7 w-60" /><Skeleton className="h-4 w-80" /><Skeleton className="h-5 w-40" /></div></div></Card>
        <div className="grid grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
      </div>
    );
  }

  const stats = [
    { icon: ShoppingCart, label: "Orders", value: c.ordersCount.toLocaleString(), color: "text-indigo-600", bg: "bg-indigo-50 dark:bg-indigo-500/10", hint: `AOV ${fc(c.aov ?? 0)}` },
    { icon: Wallet, label: "Total Spent", value: fc(c.totalSpent), color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-500/10", hint: `LTV ~${fc(c.ltv ?? c.totalSpent)}` },
    { icon: BarChart3, label: "Avg Order Value", value: fc(c.aov ?? 0), color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-500/10", hint: `${c.ordersCount} orders` },
    { icon: RotateCcw, label: "Refunds", value: `${c.refundsCount ?? 0}`, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-500/10", hint: c.lastOrderAt ? `Last: ${fdd(c.lastOrderAt)}` : "No orders" },
  ];

  function addNote() {
    if (!newNote.trim()) return;
    toast.success("Internal note added");
    setNewNote("");
  }

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
                  <Badge variant="outline" className={cn(GROUP_STYLES[c.group], "font-medium")}>
                    {GROUP_LABELS[c.group]}
                  </Badge>
                  {c.isVerified && <Badge variant="success" className="text-xs"><TrendingUp className="h-3 w-3 mr-1" />Verified</Badge>}
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
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => toast.success(`Email composer opened for ${c.email}`)}>
                  <Send className="h-4 w-4" /> Send Email
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => toast.success("Creating manual order...")}>
                  <PlusCircle className="h-4 w-4" /> Create Order
                </Button>
                <Button size="sm" className="gap-1.5" onClick={() => toast.success(`Impersonating ${c.name}...`)}>
                  <LogIn className="h-4 w-4" /> Login As
                </Button>
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
                <TabsTrigger value="wishlist">Wishlist ({MOCK_WISHLIST.length})</TabsTrigger>
                <TabsTrigger value="reviews">Reviews ({MOCK_REVIEWS.length})</TabsTrigger>
                <TabsTrigger value="points">Points & Rewards</TabsTrigger>
                <TabsTrigger value="notes">Notes ({MOCK_NOTES.length})</TabsTrigger>
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
                            { color: "bg-indigo-500", text: "Placed order #ORD-10234", sub: fd(MOCK_ORDERS[0].date) },
                            { color: "bg-emerald-500", text: "Order #ORD-10234 delivered", sub: fd(MOCK_ORDERS[0].date) },
                            { color: "bg-amber-500", text: "Verified phone number", sub: fd(c.createdAt) },
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
                          ["Group", GROUP_LABELS[c.group]],
                          ["Verified", c.isVerified ? "Yes" : "No"],
                          ["Email verified", c.emailVerified ? "Yes" : "No"],
                          ["Phone verified", c.phoneVerified ? "Yes" : "No"],
                          ["Last order", fdd(c.lastOrderAt)],
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
                        {MOCK_ORDERS.map((o) => (
                          <TableRow key={o.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                            <TableCell>
                              <Link href={`/orders/${o.id}`} className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">{o.orderNumber}</Link>
                            </TableCell>
                            <TableCell className="text-sm text-slate-600">{fdd(o.date)}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={cn(
                                o.status === "DELIVERED" || o.status === "COMPLETED" ? "text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-transparent"
                                : o.status === "RETURNED" ? "text-red-700 bg-red-50 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-transparent"
                                : "text-indigo-700 bg-indigo-50 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-transparent"
                              )}>{o.status}</Badge>
                            </TableCell>
                            <TableCell className="text-sm">{o.itemsCount}</TableCell>
                            <TableCell className="text-right font-semibold">{fc(o.total)}</TableCell>
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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {MOCK_WISHLIST.map((w) => (
                    <Card key={w.id} className="border-slate-200 dark:border-slate-800 overflow-hidden">
                      <div className="aspect-square bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                        <Heart className="h-10 w-10" />
                      </div>
                      <CardContent className="p-4">
                        <div className="font-semibold text-slate-900 dark:text-white text-sm">{w.name}</div>
                        <div className="text-xs text-slate-500 font-mono mb-2">{w.sku}</div>
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-indigo-600 dark:text-indigo-400">{fc(w.price)}</span>
                          <Button size="sm" variant="outline" className="h-8">Move to cart</Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="reviews" className="mt-2 space-y-4">
                {MOCK_REVIEWS.map((r) => (
                  <Card key={r.id} className="border-slate-200 dark:border-slate-800">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-white">{r.product}</div>
                          <div className="text-xs text-slate-500">{fdd(r.date)}</div>
                        </div>
                        <div className="flex items-center gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} className={cn("h-4 w-4", i < r.rating ? "fill-amber-400 text-amber-400" : "text-slate-300")} />
                          ))}
                        </div>
                      </div>
                      <p className="text-sm text-slate-700 dark:text-slate-300">&ldquo;{r.comment}&rdquo;</p>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              <TabsContent value="points" className="mt-2">
                <Card className="border-slate-200 dark:border-slate-800">
                  <CardContent className="p-8 text-center">
                    <Gift className="h-12 w-12 text-amber-500 mx-auto mb-3" />
                    <h3 className="text-lg font-semibold mb-1 text-slate-900 dark:text-white">Points & Rewards</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-5">
                      Loyalty program module coming soon. This customer will be migrated with a starting points balance proportional to lifetime spend.
                    </p>
                    <div className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 font-semibold">
                      Estimated starting balance: <span className="text-xl">{Math.floor(c.totalSpent / 100).toLocaleString()} pts</span>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="notes" className="mt-2 space-y-5">
                <div className="flex gap-3">
                  <div className="flex-1">
                    <Textarea
                      placeholder="Add an internal staff note about this customer..."
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      rows={3}
                    />
                  </div>
                  <Button onClick={addNote} disabled={!newNote.trim()} className="gap-1.5 h-auto px-4 self-end">
                    <Note className="h-4 w-4" /> Add Note
                  </Button>
                </div>
                <div className="space-y-3">
                  {MOCK_NOTES.map((n) => (
                    <div key={n.id} className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50/50 dark:bg-slate-900/50">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7">
                            <AvatarFallback className="bg-slate-400 text-white text-[10px] font-bold">{getInitials(n.author)}</AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-semibold text-slate-900 dark:text-white">{n.author}</span>
                          <Badge variant="outline" className="text-[10px] bg-slate-200/50 text-slate-700 dark:bg-slate-700 dark:text-slate-300 border-0">Internal</Badge>
                        </div>
                        <span className="text-xs text-slate-500">{fd(n.createdAt)}</span>
                      </div>
                      <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{n.content}</p>
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
