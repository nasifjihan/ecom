"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  DollarSign,
  Users,
  CreditCard,
  BarChart3,
  Globe2,
  FileText,
  ShieldCheck,
  PauseCircle,
  Send,
  Download,
  Plus,
  Mail,
  Phone,
  MapPin,
  CheckCircle2,
  XCircle,
  Clock,
  Calendar,
  Package,
  HardDrive,
  UserCog,
  UserPlus,
  TrendingUp,
  ShoppingCart,
  Eye,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Badge,
  Avatar,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  Input,
  Select,
  SelectItem,
  Progress,
  Skeleton,
  Separator,
  Alert,
  AlertDescription,
} from "@/components/ui";
import { cn } from "@/components/ui";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const metricsData = Array.from({ length: 30 }, (_, i) => ({
  day: `${i + 1}`,
  revenue: Math.floor(Math.random() * 2000) + 500,
  orders: Math.floor(Math.random() * 80) + 10,
  visits: Math.floor(Math.random() * 5000) + 1000,
}));

const planColors: Record<string, string> = {
  Free: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
  Starter: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  Pro: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  Enterprise: "bg-rose-500/10 text-rose-700 dark:text-rose-400",
};

function StatBlock({
  label,
  value,
  icon: Icon,
  iconColor,
  iconBg,
  sub,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  iconBg: string;
  sub?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-xl",
          iconBg,
        )}
      >
        <Icon className={cn("h-5 w-5", iconColor)} />
      </div>
      <div>
        <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
        <p className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
          {value}
        </p>
        {sub && <p className="text-[11px] text-emerald-600">{sub}</p>}
      </div>
    </div>
  );
}

export default function SuperStoreDetailPage() {
  const params = useParams();
  const router = useRouter();
  const storeId = params.id as string;
  const [tab, setTab] = useState("overview");

  const mockStore = {
    id: storeId,
    logo: "FB",
    name: "Fashion BD Premium",
    domain: "fashionbd.com",
    domainVerified: true,
    ownerName: "Rahim Ahmed",
    ownerEmail: "rahim@fashionbd.com",
    ownerPhone: "+880 1700 000000",
    country: "Bangladesh",
    plan: "Pro" as any,
    status: "active",
    mrr: 249,
    billingCycle: "Monthly",
    nextBillingDate: "Oct 15, 2026",
    daysUntilBilling: 12,
    createdDate: "Mar 14, 2025",
    invoicesCount: 18,
    usersCount: 5,
  };

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-start justify-between flex-wrap gap-4"
      >
        <div className="space-y-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/stores")}
            className="-ml-2"
          >
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Back to All Stores
          </Button>
          <div className="flex items-center gap-4">
            <Avatar className="h-14 w-14 border-2 border-slate-200 dark:border-slate-700">
              <div className="h-full w-full flex items-center justify-center text-sm font-bold bg-gradient-to-br from-amber-500 to-orange-500 text-white">
                {mockStore.logo}
              </div>
            </Avatar>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                  {mockStore.name}
                </h1>
                <Badge
                  variant="secondary"
                  className={cn("border-0", planColors[mockStore.plan])}
                >
                  {mockStore.plan} Plan
                </Badge>
                <Badge variant="success" className="border-0">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Active
                </Badge>
              </div>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <Globe2 className="h-3.5 w-3.5" />
                  <a
                    href={`https://${mockStore.domain}`}
                    target="_blank"
                    className="hover:underline"
                    rel="noreferrer"
                  >
                    {mockStore.domain}
                  </a>
                  {mockStore.domainVerified && (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  )}
                </span>
                <Separator
                  orientation="vertical"
                  className="h-3 hidden sm:block"
                />
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  ID: {mockStore.id}
                </span>
                <Separator
                  orientation="vertical"
                  className="h-3 hidden sm:block"
                />
                <span className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {mockStore.country}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => toast.success("Export data queued")}
          >
            <Download className="h-4 w-4 mr-1.5" />
            Export Data
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              toast.success("Warning email sent to owner")
            }
          >
            <Send className="h-4 w-4 mr-1.5" />
            Send Warning
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => toast.warning("Suspend store: confirm in production")}
          >
            <PauseCircle className="h-4 w-4 mr-1.5" />
            Suspend Store
          </Button>
          <Button
            size="sm"
            className="bg-rose-600 hover:bg-rose-500 text-white"
            onClick={() =>
              toast.success("Impersonating owner: Redirecting to store admin...", {
                description: "Logging in as Rahim Ahmed with SUPER privilege token.",
              })
            }
          >
            <ShieldCheck className="h-4 w-4 mr-1.5" />
            Login as Owner
          </Button>
        </div>
      </motion.div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto border-b border-slate-200 dark:border-slate-800 bg-transparent h-auto p-0 space-x-1 mb-0 rounded-none">
          {[
            { id: "overview", label: "Overview", icon: Building2 },
            { id: "billing", label: "Billing", icon: CreditCard },
            { id: "users", label: "Users", icon: Users },
            { id: "plan", label: "Plan & Features", icon: Package },
            { id: "metrics", label: "Metrics", icon: BarChart3 },
            { id: "domains", label: "Domains", icon: Globe2 },
            { id: "audit", label: "Audit Log", icon: FileText },
          ].map((t) => (
            <TabsTrigger
              key={t.id}
              value={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-3 data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none border-b-2 border-transparent",
                tab === t.id
                  ? "!border-rose-500 !text-rose-600 dark:!text-rose-400"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white",
              )}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatBlock
              label="MRR (Monthly)"
              value={`$${mockStore.mrr}`}
              icon={DollarSign}
              iconBg="bg-emerald-500/10"
              iconColor="text-emerald-600"
              sub="+$19 vs last month"
            />
            <StatBlock
              label="Billing Cycle"
              value={mockStore.billingCycle}
              icon={Calendar}
              iconBg="bg-blue-500/10"
              iconColor="text-blue-600"
              sub={`Next: ${mockStore.nextBillingDate}`}
            />
            <StatBlock
              label="Store Users"
              value={mockStore.usersCount.toString()}
              icon={Users}
              iconBg="bg-purple-500/10"
              iconColor="text-purple-600"
            />
            <StatBlock
              label="Invoices Paid"
              value={mockStore.invoicesCount.toString()}
              icon={FileText}
              iconBg="bg-amber-500/10"
              iconColor="text-amber-600"
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Usage Quotas</CardTitle>
                <CardDescription>
                  {mockStore.plan} Plan limits and current usage
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5 pt-2">
                {[
                  { label: "Products", used: 184, limit: 500, icon: Package, color: "bg-emerald-500" },
                  { label: "Storage", used: 4.2, limit: 20, unit: "GB", icon: HardDrive, color: "bg-blue-500" },
                  { label: "Staff Users", used: 5, limit: 10, icon: UserCog, color: "bg-purple-500" },
                  { label: "API Calls", used: 28472, limit: 100000, icon: Eye, color: "bg-amber-500" },
                  { label: "Bandwidth", used: 86, limit: 500, unit: "GB", icon: Globe2, color: "bg-rose-500" },
                ].map((q) => {
                  const pct = Math.min(
                    100,
                    (q.used / q.limit) * 100,
                  );
                  return (
                    <div key={q.label}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <q.icon className="h-4 w-4 text-slate-500" />
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            {q.label}
                          </span>
                        </div>
                        <span className="text-xs text-slate-500 tabular-nums">
                          {q.used.toLocaleString()}
                          {q.unit ?? ""} / {q.limit.toLocaleString()}
                          {q.unit ?? ""}
                        </span>
                      </div>
                      <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={cn("h-full rounded-full transition-all", q.color)}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Owner Details</CardTitle>
                <CardDescription>Primary store contact</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-2">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <div className="h-full w-full flex items-center justify-center text-sm font-bold bg-gradient-to-br from-indigo-500 to-purple-500 text-white">
                      RA
                    </div>
                  </Avatar>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {mockStore.ownerName}
                    </p>
                    <p className="text-xs text-slate-500">Store Owner</p>
                  </div>
                </div>
                <Separator />
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                    <Mail className="h-4 w-4 text-slate-400" />
                    {mockStore.ownerEmail}
                  </div>
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                    <Phone className="h-4 w-4 text-slate-400" />
                    {mockStore.ownerPhone}
                  </div>
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                    <MapPin className="h-4 w-4 text-slate-400" />
                    {mockStore.country}
                  </div>
                </div>
                <Button variant="outline" size="sm" className="w-full mt-2">
                  <UserPlus className="h-4 w-4 mr-1.5" />
                  Contact Owner
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="billing" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Invoices & Transactions</CardTitle>
              <CardDescription>
                Complete billing history for this store
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
                <Table>
                  <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array.from({ length: 6 }, (_, i) => {
                      const paid = i < 5;
                      return (
                        <TableRow key={i}>
                          <TableCell className="font-mono text-xs">
                            INV-{(2000 - i).toString()}
                          </TableCell>
                          <TableCell>Sep {15 - i * 30}, 2026</TableCell>
                          <TableCell>Monthly Subscription</TableCell>
                          <TableCell className="font-semibold tabular-nums">
                            $249.00
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={paid ? "success" : "destructive"}
                              className="border-0"
                            >
                              {paid ? "Paid" : "Failed"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-slate-500">
                            Visa ••{paid ? "4242" : "0000"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm">
                              <Download className="h-3.5 w-3.5 mr-1" />
                              PDF
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="mt-6 space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Store Admins
              </h2>
              <p className="text-sm text-slate-500">
                Users with access to {mockStore.name} store admin
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => toast.success("Invite sheet opened (Demo)")}
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Invite Store Admin
            </Button>
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Last Login</TableHead>
                    <TableHead>2FA</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    { name: "Rahim Ahmed", email: "rahim@fashionbd.com", role: "Store Owner", last: "2h ago", tfa: true, status: "Active" },
                    { name: "Karim Hassan", email: "karim@fashionbd.com", role: "Store Manager", last: "1d ago", tfa: true, status: "Active" },
                    { name: "Fatima Khatun", email: "fatima@fashionbd.com", role: "Catalog Manager", last: "3d ago", tfa: false, status: "Active" },
                    { name: "Tanvir Rahman", email: "tanvir@fashionbd.com", role: "Support Agent", last: "2w ago", tfa: false, status: "Active" },
                  ].map((u, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <Avatar className="h-8 w-8">
                            <div className="h-full w-full flex items-center justify-center text-xs font-bold bg-gradient-to-br from-rose-500 to-pink-500 text-white">
                              {u.name
                                .split(" ")
                                .map((n) => n[0])
                                .slice(0, 2)
                                .join("")}
                            </div>
                          </Avatar>
                          <span className="text-sm font-medium text-slate-900 dark:text-white">
                            {u.name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-slate-600 dark:text-slate-300">
                        {u.email}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {u.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">
                        {u.last}
                      </TableCell>
                      <TableCell>
                        {u.tfa ? (
                          <Badge variant="success" className="border-0 px-1.5 py-0 text-[10px]">
                            2FA
                          </Badge>
                        ) : (
                          <XCircle className="h-4 w-4 text-slate-400" />
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="success" className="border-0">
                          {u.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plan" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg">Current Plan & Features</CardTitle>
                <CardDescription>
                  {mockStore.plan} plan subscription details
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20">
                  <div>
                    <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-1">
                      Current Plan
                    </p>
                    <p className="text-xl font-bold text-slate-900 dark:text-white">
                      {mockStore.plan}
                    </p>
                    <p className="text-sm text-slate-500">
                      ${mockStore.mrr} / {mockStore.billingCycle.toLowerCase()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      Downgrade
                    </Button>
                    <Button
                      size="sm"
                      className="bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500"
                    >
                      Upgrade to Enterprise
                    </Button>
                  </div>
                </div>
                <Separator />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { label: "Products", value: "500" },
                    { label: "Staff Users", value: "10" },
                    { label: "Storage", value: "20 GB" },
                    { label: "API Calls", value: "100k/mo" },
                    { label: "Custom Domain", value: "Yes" },
                    { label: "SSL Certificates", value: "Auto" },
                    { label: "Priority Support", value: "Email" },
                    { label: "Analytics", value: "Advanced" },
                  ].map((f) => (
                    <div
                      key={f.label}
                      className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50"
                    >
                      <span className="text-sm text-slate-600 dark:text-slate-300">
                        {f.label}
                      </span>
                      <span className="text-sm font-semibold text-slate-900 dark:text-white">
                        {f.value}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Actions</CardTitle>
                <CardDescription>Subscription controls</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                <Button variant="outline" className="w-full justify-start">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Add-ons
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Calendar className="h-4 w-4 mr-2" />
                  Switch Billing Cycle
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Apply Credit
                </Button>
                <Separator className="my-2" />
                <Button
                  variant="outline"
                  className="w-full justify-start text-amber-600 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/20 border-amber-200 dark:border-amber-900"
                >
                  <Clock className="h-4 w-4 mr-2" />
                  Schedule Cancel at End
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start text-red-600 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 border-red-200 dark:border-red-900"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Cancel Immediately
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="metrics" className="mt-6 space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Last 30 Days Performance</CardTitle>
              <CardDescription>
                Revenue, orders & visits trend
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-4 mt-2">
                <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                  <p className="text-xs text-slate-500">Revenue (30d)</p>
                  <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                    $28,472
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/10">
                  <p className="text-xs text-slate-500">Orders (30d)</p>
                  <p className="text-xl font-bold text-blue-700 dark:text-blue-400 tabular-nums">
                    1,284
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-purple-500/5 border border-purple-500/10">
                  <p className="text-xs text-slate-500">Visits (30d)</p>
                  <p className="text-xl font-bold text-purple-700 dark:text-purple-400 tabular-nums">
                    92,347
                  </p>
                </div>
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={metricsData}
                    margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="ordGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-800" />
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <RechartsTooltip />
                    <Area type="monotone" dataKey="revenue" stroke="#10b981" fill="url(#revGrad)" name="Revenue" />
                    <Area type="monotone" dataKey="orders" stroke="#3b82f6" fill="url(#ordGrad)" name="Orders" />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="domains" className="mt-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Custom Domains
              </h2>
              <p className="text-sm text-slate-500">
                Connect custom domains and manage SSL
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => toast.success("Add domain dialog (Demo)")}
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Add Custom Domain
            </Button>
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
                  <TableRow>
                    <TableHead>Domain</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Primary</TableHead>
                    <TableHead>SSL</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Added</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>
                      <span className="text-sm font-medium text-slate-900 dark:text-white">
                        fashionbd.com
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">Root Domain</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="success" className="border-0">✓ Primary</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="success" className="border-0">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Auto SSL
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="success" className="border-0">Active</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">Mar 14, 2025</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>
                      <span className="text-sm font-medium text-slate-900 dark:text-white">
                        shop.fashionbd.com
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">Subdomain</Badge>
                    </TableCell>
                    <TableCell>—</TableCell>
                    <TableCell>
                      <Badge variant="success" className="border-0">
                        Auto SSL
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="success" className="border-0">Active</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">Jun 2, 2025</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="ml-2">
              SSL certificates are automatically provisioned via Caddy. New
              domains may take a few minutes to verify DNS before HTTPS
              becomes active.
            </AlertDescription>
          </Alert>
        </TabsContent>

        <TabsContent value="audit" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Store Audit Log</CardTitle>
              <CardDescription>
                Recent admin actions on {mockStore.name}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>IP Address</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    { t: "2h ago", user: "Karim Hassan", action: "product.updated", ip: "103.xx.xx.42", detail: 'Updated product "Premium Denim Jacket"' },
                    { t: "5h ago", user: "Rahim Ahmed", action: "order.status_changed", ip: "103.xx.xx.42", detail: "Order #FB-38292 → Shipped" },
                    { t: "1d ago", user: "Fatima Khatun", action: "category.created", ip: "202.xx.xx.17", detail: 'Created category "Winter Collection 2026"' },
                    { t: "3d ago", user: "Rahim Ahmed", action: "settings.updated", ip: "103.xx.xx.42", detail: "Updated payment gateway settings (SSLCommerz)" },
                    { t: "1w ago", user: "Tanvir Rahman", action: "customer.replied", ip: "175.xx.xx.88", detail: "Replied to ticket #TC-8847" },
                  ].map((log, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs text-slate-500 w-28">
                        {log.t}
                      </TableCell>
                      <TableCell className="text-sm font-medium text-slate-900 dark:text-white w-40">
                        {log.user}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-mono text-[10px] px-2 py-0.5">
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-mono text-slate-500 w-28">
                        {log.ip}
                      </TableCell>
                      <TableCell className="text-sm text-slate-600 dark:text-slate-300">
                        {log.detail}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
