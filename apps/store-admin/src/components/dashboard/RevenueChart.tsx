"use client";

import { motion } from "framer-motion";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
} from "@/components/ui";

export interface RevenueChartPoint {
  date: string;
  revenue: number;
}

interface RevenueChartProps {
  data?: RevenueChartPoint[];
  loading?: boolean;
  days?: number;
}

const MOCK_DATA: RevenueChartPoint[] = Array.from({ length: 30 }, (_, i) => {
  const date = new Date();
  date.setDate(date.getDate() - (29 - i));
  return {
    date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    revenue: Math.floor(Math.random() * 80000) + 20000,
  };
});

export default function RevenueChart({
  data,
  loading = false,
  days = 30,
}: RevenueChartProps) {
  const chartData = data ?? MOCK_DATA;

  if (loading) {
    return (
      <Card className="border-slate-200 shadow-sm dark:border-slate-800">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[320px] w-full rounded-xl" />
        </CardContent>
      </Card>
    );
  }

  const formatter = (value: number) => `৳ ${value.toLocaleString()}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
    >
      <Card className="border-slate-200 shadow-sm dark:border-slate-800">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white">
            Revenue Last {days} Days
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="#6366f1"
                      stopOpacity={0.3}
                    />
                    <stop
                      offset="95%"
                      stopColor="#6366f1"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-slate-200 dark:stroke-slate-700"
                />
                <XAxis
                  dataKey="date"
                  tick={{
                    fill: "#64748b",
                    fontSize: 12,
                  }}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={24}
                />
                <YAxis
                  tick={{
                    fill: "#64748b",
                    fontSize: 12,
                  }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) =>
                    `৳${value >= 1000 ? `${value / 1000}k` : value}`
                  }
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "0.5rem",
                    boxShadow:
                      "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
                  }}
                  labelStyle={{
                    color: "hsl(var(--card-foreground))",
                    fontWeight: 600,
                    marginBottom: 4,
                  }}
                  itemStyle={{
                    color: "hsl(var(--card-foreground))",
                  }}
                  formatter={(value: number) => [formatter(value), "Revenue"]}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#6366f1"
                  strokeWidth={2.5}
                  fill="url(#colorRevenue)"
                  activeDot={{
                    r: 6,
                    fill: "#6366f1",
                    stroke: "#fff",
                    strokeWidth: 2,
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
