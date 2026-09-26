"use client";

import { motion } from "framer-motion";
import {
  Building2,
  DollarSign,
  UserPlus,
  TrendingDown,
  TrendingUp,
  ShoppingCart,
  BarChart3,
  Users,
  Cpu,
  HardDrive,
  Database,
  Radio,
  PieChart,
  Activity,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Skeleton,
  Badge,
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui";
import { cn } from "@/components/ui";
import {
  useGetSuperDashboardStatsQuery,
} from "@/lib/features/auth/auth-api-slice";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar,
} from "recharts";

const PLAN_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#f43f5e", "#8b5cf6", "#64748b"];

function StatCard({
  icon: Icon,
  label,
  value,
  delta,
  deltaLabel,
  iconColor,
  iconBgColor,
  delay = 0,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  delta?: number;
  deltaLabel?: string;
  iconColor: string;
  iconBgColor: string;
  delay?: number;
  children?: React.ReactNode;
}) {
  const isPositive = (delta ?? 0) >= 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
    >
      <Card className="overflow-hidden border-slate-200/70 dark:border-slate-800/70 h-full">
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                {label}
              </p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                {value}
              </p>
              {delta !== undefined && (
                <div className="flex items-center gap-1.5">
                  {isPositive ? (
                    <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                  )}
                  <span
                    className={cn(
                      "text-xs font-semibold",
                      isPositive
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-red-600 dark:text-red-400",
                    )}
                  >
                    {isPositive ? "+" : ""}
                    {delta}%
                  </span>
                  {deltaLabel && (
                    <span className="text-xs text-slate-400">
                      {deltaLabel}
                    </span>
                  )}
                </div>
              )}
            </div>
            <div
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-xl",
                iconBgColor,
              )}
            >
              <Icon className={cn("h-5.5 w-5.5", iconColor)} />
            </div>
          </div>
          {children}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function StatCardSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
    >
      <Card className="h-full">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-2 w-full">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-11 w-11 rounded-xl" />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function HealthIndicator({
  label,
  icon: Icon,
  status,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  status: string;
}) {
  const statusConfig = {
    good: { color: "bg-emerald-500", text: "text-emerald-600", bg: "bg-emerald-500/10", label: "Healthy" },
    warning: { color: "bg-amber-500", text: "text-amber-600", bg: "bg-amber-500/10", label: "Warning" },
    critical: { color: "bg-red-500", text: "text-red-600", bg: "bg-red-500/10", label: "Critical" },
  };
  const config =
    statusConfig[status as keyof typeof statusConfig] ??
    statusConfig.good;
  return (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
      <div
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-md",
          config.bg,
        )}
      >
        <Icon className={cn("h-3.5 w-3.5", config.text)} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 leading-tight">
          {label}
        </p>
        <p className={cn("text-xs font-semibold leading-tight", config.text)}>
          {config.label}
        </p>
      </div>
      <div className={cn("h-2 w-2 rounded-full", config.color)} />
    </div>
  );
}

const storesPieColors = ["#10b981", "#3b82f6", "#ef4444", "#64748b"];

export default function SuperDashboardPage() {
  const { data: stats, isLoading: statsLoading, isError } = useGetSuperDashboardStatsQuery();

  if (!stats) {
    return (
      <div className="py-24 text-center text-sm text-slate-500">
        {statsLoading ? "Loading platform metrics…" : isError ? "Could not load platform metrics." : null}
      </div>
    );
  }
  const data = {
    ...stats,
    plansDistribution: stats.plansDistribution.map((p, i) => ({ ...p, color: PLAN_COLORS[i % PLAN_COLORS.length] })),
  };
  const health = data.systemHealth;
  const newSignups = [
    { period: "Today", value: data.newSignupsToday },
    { period: "7 Days", value: data.newSignups7d },
    { period: "30 Days", value: data.newSignups30d },
  ];

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Platform Dashboard
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Platform-wide KPIs, revenue metrics, and system health — all
              tenant stores aggregated.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="success"
              className="px-2.5 py-1 text-xs"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mr-1.5 inline-block animate-pulse" />
              Live Data
            </Badge>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        {statsLoading ? (
          Array.from({ length: 9 }).map((_, i) => (
            <StatCardSkeleton key={i} delay={i * 0.05} />
          ))
        ) : (
          <>
            <div className="xl:col-span-1 sm:col-span-2">
              <StatCard
                icon={Building2}
                label="Total Stores"
                value={data.totalStores.toLocaleString()}
                iconColor="text-rose-600 dark:text-rose-400"
                iconBgColor="bg-rose-500/10"
              >
                <div className="mt-4 grid grid-cols-4 gap-1">
                  {[
                    { label: "Active", count: data.activeStores, color: "bg-emerald-500" },
                    { label: "Trial", count: data.trialStores, color: "bg-blue-500" },
                    { label: "Suspended", count: data.suspendedStores, color: "bg-red-500" },
                    { label: "Cancelled", count: data.cancelledStores, color: "bg-slate-500" },
                  ].map((segment) => (
                    <div key={segment.label}>
                      <div className="flex items-center gap-1">
                        <div className={cn("h-2 w-2 rounded-full", segment.color)} />
                        <span className="text-[10px] text-slate-500 dark:text-slate-400">
                          {segment.label}
                        </span>
                      </div>
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                        {segment.count}
                      </p>
                    </div>
                  ))}
                </div>
              </StatCard>
            </div>
            <StatCard
              icon={DollarSign}
              label="Total MRR"
              value={`$ ${data.totalMRR.toLocaleString()}`}
              iconColor="text-emerald-600 dark:text-emerald-400"
              iconBgColor="bg-emerald-500/10"
              delay={0.05}
            />
            <StatCard
              icon={UserPlus}
              label="New Signups"
              value={`${data.newSignups30d.toLocaleString()}`}
              iconColor="text-blue-600 dark:text-blue-400"
              iconBgColor="bg-blue-500/10"
              delay={0.1}
            >
              <div className="mt-4">
                <div className="space-y-1.5">
                  {newSignups.map((item) => (
                    <div
                      key={item.period}
                      className="flex items-center justify-between"
                    >
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        {item.period}
                      </span>
                      <div className="flex items-center gap-2 flex-1 mx-3 max-w-[100px]">
                        <div className="h-1.5 flex-1 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"
                            style={{
                              width: `${(item.value / Math.max(1, data.newSignups30d)) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                      <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 tabular-nums w-8 text-right">
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </StatCard>
            <StatCard
              icon={TrendingDown}
              label="Churn Rate"
              value={`${data.churnRate}%`}
              iconColor="text-red-600 dark:text-red-400"
              iconBgColor="bg-red-500/10"
              delay={0.15}
            />
            <StatCard
              icon={BarChart3}
              label="ARPU Avg"
              value={`$ ${data.arpu.toFixed(2)}`}
              iconColor="text-amber-600 dark:text-amber-400"
              iconBgColor="bg-amber-500/10"
              delay={0.2}
            />
            <StatCard
              icon={Activity}
              label="Est. LTV"
              value={`$ ${data.ltv.toFixed(0)}`}
              iconColor="text-purple-600 dark:text-purple-400"
              iconBgColor="bg-purple-500/10"
              delay={0.25}
            />
            <StatCard
              icon={ShoppingCart}
              label="Platform Orders"
              value={data.platformOrders.toLocaleString()}
              iconColor="text-indigo-600 dark:text-indigo-400"
              iconBgColor="bg-indigo-500/10"
              delay={0.3}
            />
            <StatCard
              icon={DollarSign}
              label="Paid Order Revenue (store currencies)"
              value={data.platformRevenue.toLocaleString()}
              iconColor="text-teal-600 dark:text-teal-400"
              iconBgColor="bg-teal-500/10"
              delay={0.35}
            />
            <StatCard
              icon={Users}
              label="Active Admins"
              value={data.activeAdmins.toLocaleString()}
              iconColor="text-cyan-600 dark:text-cyan-400"
              iconBgColor="bg-cyan-500/10"
              delay={0.4}
            >
              <div className="mt-4 grid grid-cols-2 gap-2">
                <HealthIndicator
                  label="CPU"
                  icon={Cpu}
                  status={health.cpu}
                />
                <HealthIndicator
                  label="Memory"
                  icon={HardDrive}
                  status={health.memory}
                />
                <HealthIndicator
                  label="Database"
                  icon={Database}
                  status={health.database}
                />
                <HealthIndicator
                  label="Redis"
                  icon={Radio}
                  status={health.redis}
                />
              </div>
            </StatCard>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.4 }}
          className="lg:col-span-2"
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-lg font-semibold">
                  Monthly MRR Breakdown
                </CardTitle>
                <CardDescription>
                  Last 12 months — stacked by plan tier
                </CardDescription>
              </div>
              <Badge variant="secondary" className="text-xs">
                12 Months
              </Badge>
            </CardHeader>
            <CardContent className="pt-2">
              {statsLoading ? (
                <Skeleton className="h-72 w-full rounded-lg" />
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={data.monthlyMRR}
                      margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="enterpriseGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.6} />
                          <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.05} />
                        </linearGradient>
                        <linearGradient id="proGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.5} />
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.05} />
                        </linearGradient>
                        <linearGradient id="starterGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.5} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0.05} />
                        </linearGradient>
                        <linearGradient id="trialGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="currentColor"
                        className="text-slate-200/50 dark:text-slate-800"
                      />
                      <XAxis
                        dataKey="month"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 12, fill: "#64748b" }}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 12, fill: "#64748b" }}
                        tickFormatter={(v) => `$${v / 1000}k`}
                      />
                      <RechartsTooltip
                        formatter={(value: number) => [
                          `$${value.toLocaleString()}`,
                        ]}
                        contentStyle={{
                          borderRadius: 12,
                          border: "1px solid #e2e8f0",
                          boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="enterprise"
                        stackId="1"
                        stroke="#f43f5e"
                        fill="url(#enterpriseGrad)"
                        name="Enterprise"
                      />
                      <Area
                        type="monotone"
                        dataKey="pro"
                        stackId="1"
                        stroke="#f59e0b"
                        fill="url(#proGrad)"
                        name="Pro"
                      />
                      <Area
                        type="monotone"
                        dataKey="starter"
                        stackId="1"
                        stroke="#10b981"
                        fill="url(#starterGrad)"
                        name="Starter"
                      />
                      <Area
                        type="monotone"
                        dataKey="trial"
                        stackId="1"
                        stroke="#3b82f6"
                        fill="url(#trialGrad)"
                        name="Trial"
                      />
                      <Legend
                        iconType="circle"
                        wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, duration: 0.4 }}
          className="lg:col-span-1"
        >
          <Card className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <PieChart className="h-5 w-5 text-rose-500" />
                Plans Distribution
              </CardTitle>
              <CardDescription>
                Current stores by billing plan
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              {statsLoading ? (
                <Skeleton className="h-60 w-full rounded-lg" />
              ) : (
                <>
                  <div className="h-60">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <Pie
                          data={data.plansDistribution}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={85}
                          paddingAngle={4}
                          dataKey="value"
                        >
                          {data.plansDistribution.map((entry, idx) => (
                            <Cell
                              key={`cell-${idx}`}
                              fill={entry.color}
                              stroke="none"
                            />
                          ))}
                        </Pie>
                        <RechartsTooltip
                          formatter={(value: number, _: any, item: any) => [
                            `${value} stores`,
                            item.payload.plan,
                          ]}
                          contentStyle={{
                            borderRadius: 8,
                            border: "1px solid #e2e8f0",
                          }}
                        />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {data.plansDistribution.map((plan) => (
                      <div
                        key={plan.plan}
                        className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50"
                      >
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: plan.color }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
                            {plan.plan}
                          </p>
                          <p className="text-[10px] text-slate-500">
                            {plan.count} stores
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.4 }}
      >
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-lg font-semibold">
                Top Stores by Revenue
              </CardTitle>
              <CardDescription>
                Ranked by all-time platform revenue contribution
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-xs">
              Top 8
            </Badge>
          </CardHeader>
          <CardContent className="pt-2">
            {statsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-md" />
                ))}
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
                <Table>
                  <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
                    <TableRow>
                      <TableHead className="w-14">Rank</TableHead>
                      <TableHead>Store</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead className="text-right">Orders</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.topStores.map((store) => (
                      <TableRow key={store.rank}>
                        <TableCell>
                          <div
                            className={cn(
                              "flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold",
                              store.rank === 1
                                ? "bg-amber-400/20 text-amber-700 dark:text-amber-400"
                                : store.rank === 2
                                  ? "bg-slate-300/30 text-slate-700 dark:text-slate-300"
                                  : store.rank === 3
                                    ? "bg-orange-400/20 text-orange-700 dark:text-orange-400"
                                    : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
                            )}
                          >
                            #{store.rank}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">
                              {store.storeName}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                              <Activity className="h-3 w-3" />
                              {store.domain}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              store.plan === "Enterprise"
                                ? "destructive"
                                : store.plan === "Pro"
                                  ? "default"
                                  : "secondary"
                            }
                            className={cn(
                              store.plan === "Enterprise" &&
                                "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-0",
                              store.plan === "Pro" &&
                                "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-0",
                            )}
                          >
                            {store.plan}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                            {store.revenue.toLocaleString()}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-sm text-slate-600 dark:text-slate-300 tabular-nums">
                            {store.orders.toLocaleString()}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
