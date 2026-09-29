"use client";

/** Every return request in the store. Approve, receive, reject and refund them on the order's page. */
import { useState } from "react";
import Link from "next/link";
import { Undo2 } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  cn,
} from "@/components/ui";
import {
  RETURN_LABELS,
  RETURN_STATUSES,
  RETURN_STYLES,
  reasonLabel,
  useListReturnsQuery,
} from "@/lib/features/operations/fulfilment-api-slice";

const money = (n: number) => `৳ ${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export default function ReturnsPage() {
  const [status, setStatus] = useState("requested");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const { data, isLoading, isFetching } = useListReturnsQuery({ status: status || undefined, search: search.trim() || undefined, page, perPage: 25 });
  const counts = data?.counts ?? {};
  const all = Object.values(counts).reduce((a, b) => a + b, 0);

  const tab = (value: string, label: string, n: number) => (
    <button
      key={value || "all"}
      type="button"
      onClick={() => { setStatus(value); setPage(1); }}
      className={cn(
        "px-3 py-1.5 rounded-md text-sm font-medium border transition-colors whitespace-nowrap",
        status === value
          ? "bg-indigo-600 text-white border-indigo-600"
          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-700",
      )}
    >
      {label} <span className="opacity-70">{n}</span>
    </button>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Undo2 className="h-5 w-5" /> Returns
        </CardTitle>
        <p className="text-sm text-slate-500">
          Return requests from customers and staff. Open the order to approve, receive (restocks the items), reject or refund.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {RETURN_STATUSES.map((s) => tab(s, RETURN_LABELS[s], counts[s] ?? 0))}
          {tab("", "All", all)}
        </div>
        <Input
          className="h-9 max-w-sm"
          placeholder="Return code, order number, name or phone"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          aria-label="Search returns"
        />
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Return</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead className="text-right">Worth</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}><TableCell colSpan={7}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                ))}
              {!isLoading && (data?.items.length ?? 0) === 0 && (
                <TableRow><TableCell colSpan={7} className="py-12 text-center text-sm text-slate-500">No returns here.</TableCell></TableRow>
              )}
              {data?.items.map((r) => (
                <TableRow key={r.id} className={cn(isFetching && "opacity-60")}>
                  <TableCell>
                    <div className="font-mono text-xs font-semibold">{r.code}</div>
                    <div className="text-xs text-slate-500">{when(r.createdAt)} · by {r.requestedBy === "staff" ? "staff" : "customer"}</div>
                  </TableCell>
                  <TableCell className="text-sm">
                    <div className="font-medium">{r.order.customerName}</div>
                    <div className="text-xs text-slate-500">{r.order.phone}</div>
                  </TableCell>
                  <TableCell className="text-xs text-slate-600 dark:text-slate-400 max-w-[240px]">
                    {r.items.map((i) => `${i.quantity} × ${i.name ?? "Item"}`).join(", ")}
                  </TableCell>
                  <TableCell className="text-sm">
                    {reasonLabel(r.reason)}
                    {r.customerNote && <div className="text-xs text-slate-500 italic max-w-[200px] truncate" title={r.customerNote}>“{r.customerNote}”</div>}
                  </TableCell>
                  <TableCell className="text-right text-sm">{money(r.requestedAmount)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn("text-[11px]", RETURN_STYLES[r.status])}>{RETURN_LABELS[r.status]}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild size="sm" variant="outline" className="h-8 text-xs">
                      <Link href={`/orders/${r.order.id}`}>Order {r.order.number}</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>{data.total} returns · page {page} of {data.totalPages}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage(page + 1)}>Next</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
