"use client";

import { motion } from "framer-motion";
import {
  LayoutGrid,
  ShoppingCart,
  User2,
  TrendingUp,
} from "lucide-react";
import StatCard, { StatCardSkeleton } from "@/components/dashboard/StatCard";
import RevenueChart from "@/components/dashboard/RevenueChart";
import TopProductsChart from "@/components/dashboard/TopProductsChart";
import RecentOrdersTable from "@/components/dashboard/RecentOrdersTable";
import { useGetDashboardStatsQuery } from "@/lib/features/dashboard/dashboard-api-slice";

export default function DashboardHomePage() {
  const { data: stats, isLoading: statsLoading } = useGetDashboardStatsQuery({});

  const statConfigs = [
    {
      icon: TrendingUp,
      label: "Total Revenue",
      value: stats ? `৳ ${stats.totalRevenue.toLocaleString()}` : "৳ 0",
      delta: stats?.revenueDelta ?? 12.5,
      iconColor: "text-emerald-600 dark:text-emerald-400",
      iconBgColor: "bg-emerald-50 dark:bg-emerald-500/10",
    },
    {
      icon: ShoppingCart,
      label: "Orders",
      value: stats ? stats.ordersCount.toLocaleString() : "0",
      delta: stats?.ordersDelta ?? 8.2,
      iconColor: "text-indigo-600 dark:text-indigo-400",
      iconBgColor: "bg-indigo-50 dark:bg-indigo-500/10",
    },
    {
      icon: User2,
      label: "Customers",
      value: stats ? stats.customersCount.toLocaleString() : "0",
      delta: stats?.customersDelta ?? 5.3,
      iconColor: "text-purple-600 dark:text-purple-400",
      iconBgColor: "bg-purple-50 dark:bg-purple-500/10",
    },
    {
      icon: LayoutGrid,
      label: "Conversion Rate",
      value: stats ? `${stats.conversionRate.toFixed(1)}%` : "0%",
      delta: stats?.conversionDelta ?? -1.8,
      iconColor: "text-amber-600 dark:text-amber-400",
      iconBgColor: "bg-amber-50 dark:bg-amber-500/10",
    },
  ];

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Welcome back! Here's what's happening with your store today.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statsLoading
          ? statConfigs.map((_, i) => <StatCardSkeleton key={i} delay={i * 0.05} />)
          : statConfigs.map((config, i) => (
              <StatCard key={config.label} {...config} delay={i * 0.05} />
            ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RevenueChart loading={statsLoading} days={30} />
        </div>
        <div className="lg:col-span-1">
          <TopProductsChart loading={statsLoading} limit={5} />
        </div>
      </div>

      <RecentOrdersTable loading={statsLoading} limit={10} />
    </div>
  );
}
