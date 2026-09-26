"use client";

import { motion } from "framer-motion";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
} from "@/components/ui";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";
import { useMemo } from "react";

export interface TopProduct {
  id: string | number;
  name: string;
  sales: number;
  revenue: number;
}

const BAR_COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#a855f7",
  "#d946ef",
  "#ec4899",
];

interface TopProductsChartProps {
  data?: TopProduct[];
  loading?: boolean;
  limit?: number;
}

export default function TopProductsChart({
  data,
  loading = false,
  limit = 5,
}: TopProductsChartProps) {
  const products = data ?? [];
  const chartData = useMemo(
    () =>
      products.slice(0, limit).map((p) => ({
        name:
          p.name.length > 14 ? p.name.substring(0, 14) + "…" : p.name,
        sales: p.sales,
      })),
    [products, limit],
  );

  if (loading) {
    return (
      <Card className="border-slate-200 shadow-sm dark:border-slate-800">
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[320px] w-full rounded-xl" />
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.25 }}
    >
      <Card className="border-slate-200 shadow-sm dark:border-slate-800 h-full">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white">
            Top 5 Products
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  horizontal={false}
                  className="stroke-slate-200 dark:stroke-slate-700"
                />
                <XAxis
                  type="number"
                  tick={{ fill: "#64748b", fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={110}
                  tick={{ fill: "#475569", fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  cursor={{ fill: "rgba(99, 102, 241, 0.05)" }}
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
                  formatter={(value: number) => [`${value} units`, "Sales"]}
                />
                <Bar
                  dataKey="sales"
                  radius={[0, 6, 6, 0]}
                  barSize={24}
                >
                  {chartData.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={BAR_COLORS[index % BAR_COLORS.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
