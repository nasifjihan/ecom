"use client";

/** Commission by order: the order, its state, what it's on and what it earns (lines on hover). */
import Link from "next/link";
import { Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, cn } from "@/components/ui";
import { taka } from "@/components/orders/order-pickers";
import { COMMISSION_STATE_LABELS, COMMISSION_STATE_STYLE, type CommissionRow, type CommissionState } from "@/lib/features/sales/sales-api-slice";

const date = (s: string | null) => (s ? new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—");

export function CommissionBadge({ state }: { state: CommissionState }) {
  return (
    <Badge variant="outline" className={cn("font-medium", COMMISSION_STATE_STYLE[state])}>
      {COMMISSION_STATE_LABELS[state].replace(/ \(.*\)$/, "")}
    </Badge>
  );
}

const SOURCE: Record<string, string> = { product: "product rate", category: "category rate", store: "store rate" };

export function CommissionTable({ rows, showSalesperson, linkOrders }: { rows: CommissionRow[]; showSalesperson?: boolean; linkOrders: boolean }) {
  if (!rows.length) return <p className="p-4 text-sm text-slate-500">No orders here.</p>;
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Order</TableHead>
            {showSalesperson && <TableHead>Salesperson</TableHead>}
            <TableHead>Customer</TableHead>
            <TableHead className="text-right">Sales</TableHead>
            <TableHead className="text-right">Commission</TableHead>
            <TableHead>State</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell>
                {linkOrders ? (
                  <Link href={`/orders/${r.orderId}`} className="font-medium hover:underline">
                    #{r.orderNumber}
                  </Link>
                ) : (
                  <span className="font-medium">#{r.orderNumber}</span>
                )}
                <p className="text-xs text-slate-500">
                  {date(r.orderedAt)} · {r.orderStatus.toLowerCase().replace(/_/g, " ")} · {r.paymentStatus.replace(/_/g, " ")}
                </p>
              </TableCell>
              {showSalesperson && <TableCell>{r.salesperson.name}</TableCell>}
              <TableCell className="text-sm">{r.customer}</TableCell>
              <TableCell className="text-right tabular-nums">{taka(r.base)}</TableCell>
              <TableCell className="text-right tabular-nums">
                <span title={r.lines.map((l) => `${l.name}: ${taka(l.base)} × ${l.rate}% (${SOURCE[l.source] ?? l.source}) = ${taka(l.amount)}`).join("\n")} className="cursor-help font-medium">
                  {taka(r.amount)}
                </span>
                <p className="text-xs text-slate-500">
                  {[...new Set(r.lines.map((l) => `${l.rate}%`))].join(", ")}
                </p>
              </TableCell>
              <TableCell>
                <CommissionBadge state={r.state} />
                {r.earnedAt && r.state !== "PENDING" && <p className="mt-1 text-xs text-slate-500">{r.state === "PAID" ? `paid ${date(r.paidOutAt)}` : `earned ${date(r.earnedAt)}`}</p>}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** A thin bar for target progress (the number beside it carries the value). */
export function ProgressBar({ value }: { value: number | null }) {
  if (value === null) return null;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800" role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn("h-full rounded-full", value >= 100 ? "bg-green-600" : "bg-blue-600")} style={{ width: `${Math.min(100, value)}%` }} />
    </div>
  );
}
