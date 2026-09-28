"use client";

/**
 * Net sales and gross profit per day / week / month. One ৳ axis for both (same unit), thin lines,
 * a hover tooltip with both values, and a legend. The period table under it is the same data as a table.
 */
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { SalesReport } from "@/lib/features/reports/reports-api-slice";
import { shortDay, tk } from "./shared";

// Categorical slots 1 and 2, checked for colour-blind separation and contrast on light and dark.
const SERIES = [
  { key: "netSales", label: "Net sales", color: "var(--series-1)" },
  { key: "grossProfit", label: "Gross profit", color: "var(--series-2)" },
] as const;

const periodLabel = (p: string, bucket: SalesReport["bucket"]) =>
  bucket === "month" ? new Date(`${p}T00:00:00`).toLocaleDateString("en-GB", { month: "short", year: "numeric" }) : bucket === "week" ? `w/c ${shortDay(p)}` : shortDay(p);

const compact = (v: number) => {
  const a = Math.abs(v);
  const s = a >= 10_000_000 ? `${Math.round(a / 1_000_000) / 10}cr` : a >= 100_000 ? `${Math.round(a / 10_000) / 10}L` : a >= 1000 ? `${Math.round(a / 100) / 10}k` : String(Math.round(a));
  return `${v < 0 ? "−" : ""}৳${s}`;
};

export function SalesChart({ data }: { data: SalesReport }) {
  const rows = data.series.map((s) => ({ ...s, label: periodLabel(s.period, data.bucket) }));
  return (
    <div
      className="h-72 w-full [--series-1:#2a78d6] [--series-2:#eb6834] dark:[--series-1:#3987e5] dark:[--series-2:#d95926]"
      role="img"
      aria-label={`Net sales and gross profit by ${data.bucket}, ${data.from} to ${data.to}`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 4 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-800" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} tick={{ fontSize: 12, fill: "currentColor" }} className="text-slate-500" />
          <YAxis tickFormatter={compact} tickLine={false} axisLine={false} width={64} tick={{ fontSize: 12, fill: "currentColor" }} className="text-slate-500" />
          <Tooltip
            cursor={{ stroke: "currentColor", strokeOpacity: 0.25 }}
            content={({ active, payload }) => {
              const row = active ? (payload?.[0]?.payload as (typeof rows)[number] | undefined) : undefined;
              if (!row) return null;
              return (
                <div className="rounded-lg border bg-white px-3 py-2 text-xs shadow-md dark:bg-slate-900">
                  <p className="mb-1 font-medium text-slate-900 dark:text-white">{row.label}</p>
                  {SERIES.map((s) => (
                    <p key={s.key} className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                      <span className="inline-block h-0.5 w-3 rounded" style={{ background: s.color }} />
                      {s.label} <span className="ml-auto pl-3 font-medium tabular-nums">{tk(row[s.key])}</span>
                    </p>
                  ))}
                  <p className="mt-1 text-slate-500">
                    {row.orders} orders{row.margin !== null ? ` · ${row.margin}% margin` : ""}
                  </p>
                </div>
              );
            }}
          />
          <Legend verticalAlign="top" align="right" height={28} iconType="plainline" wrapperStyle={{ fontSize: 12 }} />
          {SERIES.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              strokeWidth={2}
              dot={rows.length <= 12 ? { r: 4, strokeWidth: 2, fill: "var(--chart-surface, #fff)" } : false}
              activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
