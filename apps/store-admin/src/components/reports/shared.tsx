"use client";

/**
 * Pieces every report page uses: the date range (kept in the URL so a report can be shared or
 * reloaded), summary tiles, tables with "Download CSV", and number formatting.
 */
import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Download, Info } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Skeleton, cn } from "@/components/ui";
import type { Basis, RangeArgs } from "@/lib/features/reports/reports-api-slice";

// ------------------------------------------------------------------ formatting

export const tk = (v: number) => `${v < 0 ? "−" : ""}৳${Math.abs(v).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
export const int = (v: number) => v.toLocaleString("en-IN");
export const pctText = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `${v}%`);
export const words = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ") : s);
export const shortDay = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
export const fullDay = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

const localDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return localDay(d);
};

/** Quick ranges; the API treats both ends as whole days in the shop's time zone. */
export const PRESETS: { key: string; label: string; range: () => { from: string; to: string } }[] = [
  { key: "today", label: "Today", range: () => ({ from: daysAgo(0), to: daysAgo(0) }) },
  { key: "7d", label: "7 days", range: () => ({ from: daysAgo(6), to: daysAgo(0) }) },
  { key: "30d", label: "30 days", range: () => ({ from: daysAgo(29), to: daysAgo(0) }) },
  {
    key: "month",
    label: "This month",
    range: () => {
      const d = new Date();
      return { from: localDay(new Date(d.getFullYear(), d.getMonth(), 1)), to: localDay(d) };
    },
  },
  {
    key: "last-month",
    label: "Last month",
    range: () => {
      const d = new Date();
      return { from: localDay(new Date(d.getFullYear(), d.getMonth() - 1, 1)), to: localDay(new Date(d.getFullYear(), d.getMonth(), 0)) };
    },
  },
  {
    key: "year",
    label: "This year",
    range: () => {
      const d = new Date();
      return { from: localDay(new Date(d.getFullYear(), 0, 1)), to: localDay(d) };
    },
  },
];

// ------------------------------------------------------------------ range in the URL

/** The range and basis in the URL (?from=&to=&basis=); missing means the last 30 days. */
export function useReportRange() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const fallback = PRESETS[2]!.range();
  const from = params.get("from") ?? fallback.from;
  const to = params.get("to") ?? fallback.to;
  const basis: Basis = params.get("basis") === "delivered" ? "delivered" : "placed";
  const set = (next: Partial<{ from: string; to: string; basis: Basis }>) => {
    const q = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) if (v) q.set(k, v);
    if (q.get("basis") === "placed") q.delete("basis");
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
  };
  const args: RangeArgs = { from, to, basis };
  return { from, to, basis, args, set, query: params.toString() };
}

/** Presets, custom from / to, and "placed" vs "delivered only". */
export function RangeBar({ showBasis = true }: { showBasis?: boolean }) {
  const { from, to, basis, set } = useReportRange();
  const active = PRESETS.find((p) => {
    const r = p.range();
    return r.from === from && r.to === to;
  })?.key;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap gap-1 rounded-lg border bg-white p-1 dark:bg-slate-900" role="group" aria-label="Date range">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            aria-pressed={active === p.key}
            onClick={() => set(p.range())}
            className={cn(
              "rounded-md px-2.5 py-1 text-sm",
              active === p.key ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
      <Input type="date" className="h-9 w-40" value={from} max={to} onChange={(e) => e.target.value && set({ from: e.target.value })} aria-label="From" />
      <span className="text-sm text-slate-500">to</span>
      <Input type="date" className="h-9 w-40" value={to} min={from} onChange={(e) => e.target.value && set({ to: e.target.value })} aria-label="To" />
      {showBasis && (
        <select
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          value={basis}
          onChange={(e) => set({ basis: e.target.value as Basis })}
          aria-label="Which orders"
          title="Placed = every order not cancelled or failed. Delivered = only orders the customer received."
        >
          <option value="placed">All placed orders</option>
          <option value="delivered">Delivered orders only</option>
        </select>
      )}
    </div>
  );
}

export const REPORT_TABS = [
  { href: "/reports", label: "Sales & profit" },
  { href: "/reports/products", label: "Products" },
  { href: "/reports/discounts", label: "Coupons & promotions" },
  { href: "/reports/customers", label: "Customers" },
  { href: "/reports/couriers", label: "Couriers & COD" },
  { href: "/reports/returns", label: "Returns & refunds" },
  { href: "/reports/tax", label: "Tax" },
  { href: "/reports/stock", label: "Stock value" },
];

export function ReportTabs() {
  const pathname = usePathname();
  const { query } = useReportRange();
  return (
    <nav className="flex gap-1 overflow-x-auto border-b" aria-label="Reports">
      {REPORT_TABS.map((t) => {
        const on = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={query ? `${t.href}?${query}` : t.href}
            aria-current={on ? "page" : undefined}
            className={cn(
              "-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm",
              on ? "border-blue-600 font-medium text-blue-700 dark:text-blue-400" : "border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

// ------------------------------------------------------------------ tiles and notes

export function Kpi({ label, value, change, hint, tone }: { label: string; value: string; change?: number | null; hint?: string; tone?: "bad" }) {
  return (
    <Card>
      <CardContent className="space-y-1 p-4">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
        <p className={cn("text-2xl font-semibold tabular-nums", tone === "bad" && "text-red-700 dark:text-red-400")}>{value}</p>
        {change !== undefined && change !== null ? (
          <p className={cn("flex items-center gap-0.5 text-xs", change >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400")}>
            {change >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
            {Math.abs(change)}% vs previous period
          </p>
        ) : hint ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">{hint}</p>
        ) : change === null ? (
          <p className="text-xs text-slate-400">No earlier sales to compare</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

/** Shown when some units sold had no cost price, so profit is too high. */
export function CostCoverageNote({ coverage }: { coverage: number | null }) {
  if (coverage === null || coverage >= 100) return null;
  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <p>
        Only <b>{coverage}%</b> of the units sold have a cost price, so gross profit is shown higher than it really is. Set cost prices in the product editor, or record
        purchases (Purchasing → Record purchase) to fill them in. Orders placed from now on keep the cost at the time of sale.
      </p>
    </div>
  );
}

export function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 text-xs text-slate-500 dark:text-slate-400">
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

// ------------------------------------------------------------------ tables + CSV

export interface Column<T> {
  key: string;
  label: string;
  /** Cell as shown; `csv` is the raw value written to the file. */
  cell: (row: T) => React.ReactNode;
  csv: (row: T) => string | number | null;
  align?: "right";
}

const csvCell = (v: string | number | null) => {
  if (v === null) return "";
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Builds the CSV (with a BOM so Excel reads Bangla and ৳) and saves it. */
export function downloadCsv<T>(filename: string, columns: Column<T>[], rows: T[]) {
  const lines = [columns.map((c) => csvCell(c.label)).join(","), ...rows.map((r) => columns.map((c) => csvCell(c.csv(r))).join(","))];
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ReportTable<T>({
  title,
  description,
  columns,
  rows,
  filename,
  empty = "Nothing in this period.",
  limit,
}: {
  title: string;
  description?: string;
  columns: Column<T>[];
  rows: T[];
  /** CSV name without extension; the range is added. */
  filename: string;
  empty?: string;
  /** Rows shown on screen (the CSV has all of them). */
  limit?: number;
}) {
  const { from, to } = useReportRange();
  const shown = limit ? rows.slice(0, limit) : rows;
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          {description && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>}
        </div>
        <Button variant="outline" size="sm" disabled={!rows.length} onClick={() => downloadCsv(`${filename}-${from}-to-${to}.csv`, columns, rows)}>
          <Download className="mr-1 h-4 w-4" /> CSV
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {!rows.length ? (
          <p className="px-6 pb-6 text-sm text-slate-500">{empty}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y bg-slate-50 text-left text-xs text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                  {columns.map((c) => (
                    <th key={c.key} scope="col" className={cn("whitespace-nowrap px-4 py-2 font-medium", c.align === "right" && "text-right")}>
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map((r, i) => (
                  <tr key={i} className="border-b last:border-0 hover:bg-slate-50 dark:hover:bg-slate-900">
                    {columns.map((c) => (
                      <td key={c.key} className={cn("px-4 py-2", c.align === "right" && "whitespace-nowrap text-right tabular-nums")}>
                        {c.cell(r)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {limit && rows.length > limit && <p className="px-4 py-2 text-xs text-slate-500">Showing {limit} of {rows.length}; the CSV has all of them.</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ReportLoading() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-72" />
    </div>
  );
}

export function ReportError({ error }: { error: unknown }) {
  const msg = (error as { data?: { message?: string } } | undefined)?.data?.message ?? "Couldn't load this report.";
  return <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{msg}</p>;
}
