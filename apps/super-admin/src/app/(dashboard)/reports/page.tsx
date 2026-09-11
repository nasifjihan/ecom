"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  BarChart3,
  PieChart,
  ShoppingCart,
  Users,
  TrendingDown,
  Download,
  Calendar,
  ArrowUpDown,
  TrendingUp,
  DollarSign,
  Building2,
  Activity,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Badge,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Input,
  Select,
  SelectItem,
  Skeleton,
  Progress,
} from "@/components/ui";
import { cn } from "@/components/ui";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  PieChart as RePieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from "recharts";

const monthlyData = Array.from({ length: 12 }, (_, i) => ({
  month: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][i],
  revenue: Math.floor(Math.random() * 40000) + 15000,
  revenuePrev: Math.floor(Math.random() * 35000) + 12000,
  orders: Math.floor(Math.random() * 3000) + 800,
  ordersPrev: Math.floor(Math.random() * 2500) + 700,
  newStores: Math.floor(Math.random() * 50) + 15,
  newStoresPrev: Math.floor(Math.random() * 40) + 12,
  newCustomers: Math.floor(Math.random() * 3000) + 1000,
  newCustomersPrev: Math.floor(Math.random() * 2500) + 800,
}));

const cohortData = [
  { cohort: "Jan 26", m0: 100, m1: 68, m2: 52, m3: 41, m4: 35, m5: 29 },
  { cohort: "Dec 25", m0: 100, m1: 71, m2: 56, m3: 45, m4: 38, m5: 32 },
  { cohort: "Nov 25", m0: 100, m1: 65, m2: 49, m3: 39, m4: 33 },
  { cohort: "Oct 25", m0: 100, m1: 73, m2: 58, m3: 47 },
  { cohort: "Sep 25", m0: 100, m1: 69, m2: 53 },
  { cohort: "Aug 25", m0: 100, m1: 72 },
];

const plansBreakdown = [
  { name: "Enterprise", value: 19, color: "#f43f5e" },
  { name: "Pro", value: 52, color: "#f59e0b" },
  { name: "Starter", value: 47, color: "#10b981" },
  { name: "Trial", value: 24, color: "#3b82f6" },
];

const countryBreakdown = [
  { country: "Bangladesh", stores: 78, revenue: 98400, flag: "🇧🇩" },
  { country: "United States", stores: 24, revenue: 62100, flag: "🇺🇸" },
  { country: "United Kingdom", stores: 14, revenue: 38400, flag: "🇬🇧" },
  { country: "Singapore", stores: 11, revenue: 28500, flag: "🇸🇬" },
  { country: "Malaysia", stores: 9, revenue: 14200, flag: "🇲🇾" },
  { country: "India", stores: 6, revenue: 6900, flag: "🇮🇳" },
];

const sourceBreakdown = [
  { source: "Organic Search", value: 38, color: "#10b981" },
  { source: "Paid Ads", value: 27, color: "#3b82f6" },
  { source: "Referral", value: 18, color: "#8b5cf6" },
  { source: "Social Media", value: 12, color: "#f59e0b" },
  { source: "Direct", value: 5, color: "#64748b" },
];

const churnMonths = Array.from({ length: 12 }, (_, i) => ({
  month: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][i],
  gross: (Math.random() * 3 + 1.5).toFixed(1),
  net: (Math.random() * 1.5 + 0.5).toFixed(1),
}));

function HeatmapCell({ value }: { value: number }) {
  const pct = value;
  let bg = "bg-emerald-500/5 text-slate-500";
  if (pct >= 70) bg = "bg-emerald-500 text-white font-bold";
  else if (pct >= 50) bg = "bg-emerald-500/70 text-white font-semibold";
  else if (pct >= 40) bg = "bg-emerald-500/50 text-white";
  else if (pct >= 30) bg = "bg-emerald-500/30 text-emerald-900 dark:text-emerald-100";
  else if (pct >= 15) bg = "bg-amber-500/30 text-amber-800 dark:text-amber-200";
  return (
    <div className={cn("h-9 flex items-center justify-center text-xs rounded-sm tabular-nums", bg)}>
      {pct}%
    </div>
  );
}

export default function SuperReportsPage() {
  const [activeTab, setActiveTab] = useState("revenue");
  const [range, setRange] = useState("12m");
  const [compare, setCompare] = useState("yoy");
  const [dimension, setDimension] = useState("plan");

  const runExport = (format: string) => {
    toast.success(`Export ${format} queued`, {
      description: `${activeTab.toUpperCase()} report — ${range} range. Will download shortly.`,
    });
  };

  const tabs = [
    { id: "revenue", label: "Revenue", icon: DollarSign },
    { id: "stores", label: "Stores", icon: Building2 },
    { id: "orders", label: "Orders", icon: ShoppingCart },
    { id: "customers", label: "Customers", icon: Users },
    { id: "churn", label: "Churn", icon: TrendingDown },
  ];

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-center justify-between flex-wrap gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Platform Reports
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Comprehensive analytics across all tenant stores. Exportable to
            PDF & XLSX.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={dimension} onValueChange={setDimension}>
            <SelectItem value="plan">By Plan</SelectItem>
            <SelectItem value="country">By Country</SelectItem>
            <SelectItem value="source">By Signup Source</SelectItem>
          </Select>
          <Select value={compare} onValueChange={setCompare}>
            <SelectItem value="yoy">Compare YoY</SelectItem>
            <SelectItem value="mom">Compare MoM</SelectItem>
            <SelectItem value="none">No Comparison</SelectItem>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => runExport("XLSX")}
          >
            <Download className="h-4 w-4 mr-1.5" />
            Export XLSX
          </Button>
          <Button
            size="sm"
            className="bg-rose-600 hover:bg-rose-500 text-white"
            onClick={() => runExport("PDF")}
          >
            <Download className="h-4 w-4 mr-1.5" />
            Export PDF
          </Button>
        </div>
      </motion.div>

      <div className="flex items-center gap-2 flex-wrap bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200 dark:border-slate-800 w-fit">
        {["7d", "30d", "90d", "12m", "ytd", "all"].map((r) => (
          <Button
            key={r}
            onClick={() => setRange(r)}
            variant={range === r ? "default" : "ghost"}
            size="sm"
            className={cn(
              range === r && "bg-rose-600 hover:bg-rose-500 text-white",
            )}
          >
            {r.toUpperCase()}
          </Button>
        ))}
        <div className="w-px h-7 bg-slate-200 dark:bg-slate-700 mx-1" />
        <Input
          type="date"
          className="h-8 w-40 text-xs"
          defaultValue="2026-09-01"
        />
        <span className="text-sm text-slate-500 mx-1">→</span>
        <Input
          type="date"
          className="h-8 w-40 text-xs"
          defaultValue="2026-09-12"
        />
      </div>

      <Tabs defaultValue="revenue" className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto border-b border-slate-200 dark:border-slate-800 bg-transparent h-auto p-0 space-x-1 mb-0 rounded-none">
          {tabs.map((t) => (
            <TabsTrigger
              key={t.id}
              value={t.id}
              onClick={() => setActiveTab(t.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-3 data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none border-b-2 border-transparent",
                activeTab === t.id
                  ? "!border-rose-500 !text-rose-600 dark:!text-rose-400"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white",
              )}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="revenue" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Total Revenue", value: "$284,729", delta: "+12.4%", color: "emerald", icon: DollarSign, good: true },
              { label: "Avg. Order Value", value: "$47.92", delta: "+3.2%", color: "blue", icon: ShoppingCart, good: true },
              { label: "MRR Growth", value: "6.8%", delta: "+1.1 MoM", color: "rose", icon: TrendingUp, good: true },
              { label: "YoY Growth", value: "+24.7%", delta: "+2.3 pts", color: "purple", icon: BarChart3, good: true },
            ].map((k, i) => (
              <motion.div
                key={k.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.3 }}
              >
                <Card>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{k.label}</p>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1 tracking-tight">{k.value}</p>
                        <p className="text-xs mt-1 font-medium text-emerald-600">{k.delta}</p>
                      </div>
                      <div
                        className={cn(
                          "h-10 w-10 rounded-xl flex items-center justify-center",
                          k.color === "emerald" && "bg-emerald-500/10 text-emerald-600",
                          k.color === "blue" && "bg-blue-500/10 text-blue-600",
                          k.color === "rose" && "bg-rose-500/10 text-rose-600",
                          k.color === "purple" && "bg-purple-500/10 text-purple-600",
                        )}
                      >
                        <k.icon className="h-5 w-5" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Revenue Trend</CardTitle>
                  <CardDescription>Monthly revenue vs previous period</CardDescription>
                </div>
                <Badge variant="outline">
                  <Activity className="h-3 w-3 mr-1.5 text-emerald-500" />
                  Growing
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revLineGrad" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#10b981" />
                        <stop offset="100%" stopColor="#f43f5e" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-800" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v / 1000}k`} />
                    <RechartsTooltip formatter={(v: any) => [`$${Number(v).toLocaleString()}`, ""]} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      name="Current Period"
                      stroke="url(#revLineGrad)"
                      strokeWidth={3}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="revenuePrev"
                      name="Previous Period"
                      stroke="#94a3b8"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Revenue by Country</CardTitle>
                <CardDescription>Top 6 countries by platform revenue</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {countryBreakdown.map((c, i) => (
                  <div key={c.country}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{c.flag}</span>
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          {c.country}
                        </span>
                        <Badge variant="outline" className="text-[10px]">
                          {c.stores} stores
                        </Badge>
                      </div>
                      <span className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                        ${c.revenue.toLocaleString()}
                      </span>
                    </div>
                    <Progress
                      value={(c.revenue / countryBreakdown[0].revenue) * 100}
                      className={cn(
                        "h-2",
                        i === 0 && "[&>div]:bg-rose-500",
                        i === 1 && "[&>div]:bg-amber-500",
                        i === 2 && "[&>div]:bg-blue-500",
                        i >= 3 && "[&>div]:bg-emerald-500",
                      )}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Signup Sources</CardTitle>
                <CardDescription>Where new stores come from</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <RePieChart>
                      <Pie
                        data={sourceBreakdown}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={70}
                        dataKey="value"
                        paddingAngle={3}
                      >
                        {sourceBreakdown.map((entry, idx) => (
                          <Cell key={idx} fill={entry.color} stroke="none" />
                        ))}
                      </Pie>
                      <RechartsTooltip formatter={(v) => [`${v}%`]} />
                    </RePieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-1.5 mt-1">
                  {sourceBreakdown.map((s) => (
                    <div key={s.source} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
                        <span className="text-slate-600 dark:text-slate-300">{s.source}</span>
                      </div>
                      <span className="font-semibold tabular-nums text-slate-700 dark:text-slate-200">
                        {s.value}%
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="stores" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            {[
              { l: "New Stores (Period)", v: "287", d: "+18.2%", g: true },
              { l: "Conversion → Paid", v: "62.4%", d: "+3.1 pts", g: true },
              { l: "Avg. Time to Activate", v: "2.3 days", d: "-0.4d", g: true },
              { l: "Free → Paid Rate", v: "38.7%", d: "+2.4 pts", g: true },
            ].map((k) => (
              <Card key={k.l}>
                <CardContent className="p-5">
                  <p className="text-xs text-slate-500 dark:text-slate-400">{k.l}</p>
                  <p className="text-2xl font-bold mt-1 tracking-tight text-slate-900 dark:text-white">
                    {k.v}
                  </p>
                  <p className={cn("text-xs font-medium mt-1", k.g ? "text-emerald-600" : "text-red-600")}>
                    {k.d}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">
                New Stores vs Activated Stores
              </CardTitle>
              <CardDescription>Monthly registration & activation trend</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-800" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <RechartsTooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="newStores" name="New Stores" fill="#f43f5e" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="newStoresPrev" name="Previous Period" fill="#e2e8f0" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <PieChart className="h-5 w-5 text-rose-500" />
                Monthly Cohort Retention Heatmap
              </CardTitle>
              <CardDescription>
                % of stores retained each month after signup cohort
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <div className="min-w-[720px]">
                <div className="grid grid-cols-7 gap-1.5 mb-2">
                  <div className="h-9 flex items-center text-xs font-semibold text-slate-500 px-2">
                    Cohort
                  </div>
                  {["M0", "M1", "M2", "M3", "M4", "M5"].map((m) => (
                    <div
                      key={m}
                      className="h-9 flex items-center justify-center text-xs font-semibold text-slate-500"
                    >
                      {m}
                    </div>
                  ))}
                </div>
                {cohortData.map((row, rIdx) => (
                  <div key={row.cohort} className="grid grid-cols-7 gap-1.5 mb-1.5">
                    <div className="h-9 flex items-center text-xs font-medium text-slate-700 dark:text-slate-300 px-2 rounded-sm bg-slate-50 dark:bg-slate-800/50">
                      {row.cohort}
                    </div>
                    {[row.m0, row.m1, row.m2, row.m3, row.m4, row.m5].map((v, i) =>
                      v !== undefined ? (
                        <HeatmapCell key={i} value={v} />
                      ) : (
                        <div key={i} className="h-9 rounded-sm bg-slate-100/50 dark:bg-slate-800/30" />
                      ),
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orders" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Orders Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="ordGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.5} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-800" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <RechartsTooltip />
                    <Legend />
                    <Area type="monotone" dataKey="orders" name="Orders" stroke="#3b82f6" fill="url(#ordGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="customers" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">New Customers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-800" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <RechartsTooltip />
                    <Bar dataKey="newCustomers" name="New Customers" fill="#10b981" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="newCustomersPrev" name="Prev Period" fill="#94a3b8" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="churn" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              { l: "Gross MRR Churn", v: "2.34%", d: "Monthly", color: "red" },
              { l: "Net MRR Churn", v: "0.98%", d: "Monthly", color: "amber" },
              { l: "Logo Churn (Stores)", v: "1.72%", d: "Monthly", color: "rose" },
            ].map((k, i) => (
              <motion.div
                key={k.l}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card>
                  <CardContent className="p-5">
                    <p className="text-xs text-slate-500">{k.l}</p>
                    <p className="text-3xl font-bold mt-1 text-slate-900 dark:text-white tracking-tight">
                      {k.v}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">{k.d}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Gross vs Net Churn Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={churnMonths}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-800" />
                    <XAxis dataKey="month" />
                    <YAxis tickFormatter={(v) => `${v}%`} />
                    <RechartsTooltip formatter={(v) => [`${v}%`]} />
                    <Legend />
                    <Line type="monotone" dataKey="gross" name="Gross Churn" stroke="#ef4444" strokeWidth={3} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="net" name="Net Churn" stroke="#f59e0b" strokeWidth={2} strokeDasharray="4 4" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
