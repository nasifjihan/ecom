"use client";

/** Quotations: price offers to customers, by status, with requests from business customers first. */
import { useEffect, useState } from "react";
import Link from "next/link";
import { ClipboardList, Plus, Search } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
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
import { EmptyState, PageTitle } from "@/components/content/shared";
import { taka } from "@/components/orders/order-pickers";
import { QuoteStatusBadge } from "@/components/orders/quote-editor";
import { useCan } from "@/lib/permissions";
import { QUOTE_STATUS_LABELS, useQuotationsQuery, type QuoteStatus } from "@/lib/features/wholesale/quotations-api-slice";

const TABS: (QuoteStatus | "ALL")[] = ["ALL", "REQUESTED", "DRAFT", "SENT", "ACCEPTED", "EXPIRED", "DECLINED", "ORDERED", "CANCELLED"];
const date = (s: string | null) => (s ? new Date(`${s.length === 10 ? `${s}T00:00:00` : s}`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");

export default function QuotationsPage() {
  const { can } = useCan();
  const [tab, setTab] = useState<QuoteStatus | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);
  const { data, isFetching } = useQuotationsQuery({ status: tab === "ALL" ? undefined : tab, search: q || undefined, page });
  const counts = data?.counts ?? {};
  const all = Object.values(counts).reduce((a, b) => a + (b ?? 0), 0);
  const pages = data ? Math.max(1, Math.ceil(data.total / data.perPage)) : 1;

  return (
    <div className="space-y-6">
      <PageTitle
        icon={ClipboardList}
        title="Quotations"
        description="Price offers for bulk and business orders. Send one, the customer accepts it in their account, and you turn it into an order at the agreed prices."
        actions={
          can("orders.create") ? (
            <Button asChild>
              <Link href="/orders/quotations/new">
                <Plus className="mr-2 h-4 w-4" /> New quote
              </Link>
            </Button>
          ) : undefined
        }
      />
      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Status">
              {TABS.map((k) => {
                const n = k === "ALL" ? all : counts[k] ?? 0;
                if (k !== "ALL" && !n && tab !== k && !["REQUESTED", "SENT", "ACCEPTED"].includes(k)) return null;
                return (
                  <button
                    key={k}
                    role="tab"
                    aria-selected={tab === k}
                    onClick={() => {
                      setTab(k);
                      setPage(1);
                    }}
                    className={cn(
                      "rounded-full border px-3 py-1 text-sm transition-colors",
                      tab === k ? "border-primary bg-primary text-primary-foreground" : "hover:bg-slate-100 dark:hover:bg-slate-800",
                    )}
                  >
                    {k === "ALL" ? "All" : QUOTE_STATUS_LABELS[k]} <span className="tabular-nums opacity-75">{n}</span>
                  </button>
                );
              })}
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input className="pl-9" placeholder="Quote no., customer or business" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search quotations" />
            </div>
          </div>

          {!data ? (
            <Skeleton className="h-40" />
          ) : data.rows.length === 0 ? (
            <EmptyState icon={ClipboardList} title="No quotations here" text="Business customers can ask for a quote from their cart, or start one with New quote." />
          ) : (
            <div className={cn("overflow-x-auto", isFetching && "opacity-70")}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quote</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Items</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Valid until</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <Link href={`/orders/quotations/${r.id}`} className="font-medium hover:underline">
                          {r.number}
                        </Link>
                        <p className="text-xs text-slate-500">{date(r.createdAt)}</p>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{r.customer.business ?? r.customer.name}</p>
                        <p className="text-xs text-slate-500">{r.customer.business ? r.customer.name : r.customer.phone ?? r.customer.email}</p>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{r.items.reduce((a, i) => a + i.qty, 0)}</TableCell>
                      <TableCell className="text-right tabular-nums">{taka(r.total)}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm">{date(r.validUntil)}</TableCell>
                      <TableCell>
                        <QuoteStatusBadge status={r.status} />
                        {r.order && (
                          <Link href={`/orders/${r.order.id}`} className="ml-2 text-xs text-blue-600 hover:underline">
                            #{r.order.number}
                          </Link>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {pages > 1 && (
            <div className="flex items-center justify-end gap-2 text-sm">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <span className="tabular-nums">
                {page} / {pages}
              </span>
              <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
