"use client";

import { motion } from "framer-motion";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
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
} from "@/components/ui";
import { useGetSuperDashboardStatsQuery } from "@/lib/features/auth/auth-api-slice";
import { useGetPlatformStatsQuery, useGetStoresQuery } from "@/lib/features/platform/platform-api-slice";

/** Fills the 30-day signup series so days without signups still show as zero. */
function last30Days(rows: { date: string; count: number }[]) {
  const byDay = new Map(rows.map((r) => [r.date.slice(0, 10), r.count]));
  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return { day: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }), signups: byDay.get(key) ?? 0 };
  });
}

export default function ReportsPage() {
  const { data: overview, isLoading: overviewLoading } = useGetSuperDashboardStatsQuery();
  const { data: stats, isLoading: statsLoading } = useGetPlatformStatsQuery();
  const { data: storesData } = useGetStoresQuery({ perPage: 100 });

  const stores = [...(storesData?.items ?? [])].sort((a, b) => b.orders - a.orders);
  const signups = last30Days(stats?.newSignupsByDay ?? []);
  const mrrTrend = (overview?.monthlyMRR ?? []).map((m) => ({
    month: m.month,
    mrr: m.trial + m.starter + m.pro + m.enterprise,
  }));

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Platform Reports</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Growth and revenue across all stores, from live platform data.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="border-slate-200 dark:border-slate-800">
          <CardHeader>
            <CardTitle className="text-lg">New stores</CardTitle>
            <CardDescription>Signups per day, last 30 days</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            {statsLoading ? (
              <Skeleton className="h-full w-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={signups}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} interval={4} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={30} />
                  <Tooltip />
                  <Bar dataKey="signups" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200 dark:border-slate-800">
          <CardHeader>
            <CardTitle className="text-lg">MRR</CardTitle>
            <CardDescription>Monthly recurring revenue from active subscriptions, last 12 months (USD)</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            {overviewLoading ? (
              <Skeleton className="h-full w-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={mrrTrend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={40} />
                  <Tooltip />
                  <Bar dataKey="mrr" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 dark:border-slate-800">
        <CardHeader>
          <CardTitle className="text-lg">Stores by volume</CardTitle>
          <CardDescription>
            {overview
              ? `${overview.totalStores} stores · ${overview.platformOrders} orders · ${overview.activeAdmins} active staff accounts`
              : "Loading…"}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Store</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Orders</TableHead>
                <TableHead className="text-right">Products</TableHead>
                <TableHead className="text-right">Customers</TableHead>
                <TableHead className="text-right">MRR</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stores.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>{s.planName}</TableCell>
                  <TableCell className="capitalize">{s.status}</TableCell>
                  <TableCell className="text-right">{s.orders}</TableCell>
                  <TableCell className="text-right">{s.products}</TableCell>
                  <TableCell className="text-right">{s.customers}</TableCell>
                  <TableCell className="text-right">${s.mrr}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
