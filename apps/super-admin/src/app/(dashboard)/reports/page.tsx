"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Building2, DollarSign, Download, ShoppingCart, TrendingUp, Users } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  cn,
} from "@/components/ui";
import { formatMoney, useGetPlatformReportsQuery, type PlatformReports } from "@/lib/features/platform/platform-api-slice";
import { EmptyRow, PlanBadge } from "@/components/platform/shared";

const RANGES = [3, 6, 12, 24];

/** Downloads the monthly table as CSV. */
function exportCsv(r: PlatformReports) {
  const header = ["month", "orders", "gmv_bdt", "aov_bdt", "new_stores", "new_customers"];
  const lines = r.monthly.map((m) => [m.month, m.orders, m.revenue, m.aov, m.newStores, m.newCustomers].join(","));
  const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `platform-report-${r.months}m-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function SuperReportsPage() {
  const [months, setMonths] = useState(12);
  const { data, isLoading, isError, isFetching } = useGetPlatformReportsQuery({ months });

  const kpis = data
    ? [
        { label: "GMV", value: formatMoney(data.totals.revenue, "BDT"), icon: DollarSign, color: "text-emerald-600", bg: "bg-emerald-500/10" },
        { label: "Orders", value: data.totals.orders.toLocaleString(), icon: ShoppingCart, color: "text-blue-600", bg: "bg-blue-500/10" },
        { label: "Avg. order value", value: formatMoney(data.totals.aov, "BDT"), icon: TrendingUp, color: "text-rose-600", bg: "bg-rose-500/10" },
        { label: "New stores", value: data.totals.newStores.toLocaleString(), icon: Building2, color: "text-amber-600", bg: "bg-amber-500/10" },
        { label: "New customers", value: data.totals.newCustomers.toLocaleString(), icon: Users, color: "text-purple-600", bg: "bg-purple-500/10" },
      ]
    : [];

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Platform Reports</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            All tenant stores combined. GMV counts orders that were not cancelled or failed.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
            {RANGES.map((m) => (
              <Button
                key={m}
                size="sm"
                variant={months === m ? "default" : "ghost"}
                className={cn("h-8", months === m && "bg-rose-600 hover:bg-rose-500 text-white")}
                onClick={() => setMonths(m)}
              >
                {m}M
              </Button>
            ))}
          </div>
          <Button variant="outline" size="sm" disabled={!data} onClick={() => data && exportCsv(data)}>
            <Download className="h-4 w-4 mr-1.5" />
            Export CSV
          </Button>
        </div>
      </motion.div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-80 rounded-xl" />
        </div>
      ) : isError || !data ? (
        <Card>
          <CardContent className="p-10 text-center text-slate-500">Couldn&apos;t load reports. Check that the API is running.</CardContent>
        </Card>
      ) : (
        <div className={cn("space-y-6", isFetching && "opacity-70")}>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            {kpis.map((k) => (
              <Card key={k.label}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", k.bg)}>
                    <k.icon className={cn("h-5 w-5", k.color)} />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">{k.label}</p>
                    <p className="text-lg font-bold text-slate-900 dark:text-white">{k.value}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">GMV and Orders</CardTitle>
              <CardDescription>Last {data.months} months, all stores</CardDescription>
            </CardHeader>
            <CardContent className="h-80 pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data.monthly} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-200/50 dark:text-slate-800" />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#64748b" }} />
                  <YAxis yAxisId="gmv" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#64748b" }} tickFormatter={(v) => (v >= 1000 ? `৳${v / 1000}k` : `৳${v}`)} />
                  <YAxis yAxisId="orders" orientation="right" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#64748b" }} allowDecimals={false} />
                  <RechartsTooltip
                    formatter={(value: number, name: string) => (name === "GMV" ? [formatMoney(value, "BDT"), name] : [value, name])}
                    contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0" }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                  <Bar yAxisId="gmv" dataKey="revenue" name="GMV" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                  <Line yAxisId="orders" type="monotone" dataKey="orders" name="Orders" stroke="#3b82f6" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Growth</CardTitle>
                <CardDescription>New stores and new customers per month</CardDescription>
              </CardHeader>
              <CardContent className="h-72 pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.monthly} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-200/50 dark:text-slate-800" />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#64748b" }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#64748b" }} allowDecimals={false} />
                    <RechartsTooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0" }} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="newStores" name="New stores" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="newCustomers" name="New customers" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Orders by Status</CardTitle>
                <CardDescription>Last {data.months} months</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                  <Table>
                    <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
                      <TableRow>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Orders</TableHead>
                        <TableHead className="text-right">Value</TableHead>
                        <TableHead className="text-right">Share</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.ordersByStatus.length === 0 ? (
                        <EmptyRow colSpan={4} icon={ShoppingCart} title="No orders in this range" />
                      ) : (
                        data.ordersByStatus.map((s) => (
                          <TableRow key={s.status}>
                            <TableCell>
                              <Badge variant={s.status === "CANCELLED" || s.status === "FAILED" ? "destructive" : "secondary"} className="border-0">
                                {s.status.replace(/_/g, " ")}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{s.count}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatMoney(s.revenue, "BDT")}</TableCell>
                            <TableCell className="text-right tabular-nums text-slate-500">
                              {data.totals.orders ? Math.round((s.count / data.totals.orders) * 100) : 0}%
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Top Stores</CardTitle>
              <CardDescription>By GMV in the last {data.months} months</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                <Table>
                  <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
                    <TableRow>
                      <TableHead>Store</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead className="text-right">Orders</TableHead>
                      <TableHead className="text-right">Buyers</TableHead>
                      <TableHead className="text-right">GMV</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.topStores.length === 0 ? (
                      <EmptyRow colSpan={5} icon={Building2} title="No store sales in this range" />
                    ) : (
                      data.topStores.map((s) => (
                        <TableRow key={s.storeId}>
                          <TableCell>
                            <Link href={`/stores/${s.storeId}`} className="font-medium hover:text-rose-600">
                              {s.storeName}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <PlanBadge name={s.plan} />
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{s.orders}</TableCell>
                          <TableCell className="text-right tabular-nums">{s.customers}</TableCell>
                          <TableCell className="text-right tabular-nums font-semibold">{formatMoney(s.revenue, "BDT")}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
