"use client";

/** bKash / Nagad / Rocket / bank transfers customers reported: check each against the statement. */
import { useState } from "react";
import Link from "next/link";
import { CreditCard } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Select,
  SelectItem,
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
  PAYMENT_LABELS,
  PAYMENT_STYLES,
  TRANSFER_TABS,
  methodLabel,
  useListPaymentsQuery,
  type PaymentRow,
} from "@/lib/features/operations/payments-api-slice";
import { RejectDialog, VerifyDialog, money } from "@/components/orders/payment-dialogs";
import { useCan } from "@/lib/permissions";

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default function PaymentsToVerifyPage() {
  const [status, setStatus] = useState("to_verify");
  const [method, setMethod] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [verifying, setVerifying] = useState<PaymentRow | null>(null);
  const [rejecting, setRejecting] = useState<PaymentRow | null>(null);
  const { can } = useCan();
  const canEdit = can("payments.edit");
  const { data, isLoading, isFetching } = useListPaymentsQuery({
    kind: "transfer",
    status,
    method: method || undefined,
    search: search.trim() || undefined,
    page,
    perPage: 25,
  });
  const counts = data?.counts ?? {};

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <CreditCard className="h-5 w-5" /> Payments to verify
        </CardTitle>
        <p className="text-sm text-slate-500">
          Customers who paid by bKash, Nagad, Rocket or bank transfer gave these transaction IDs. Find each in your statement, then verify it
          (the order is marked paid once its total is covered) or reject it with a reason the customer will see.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {TRANSFER_TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => { setStatus(t.value); setPage(1); }}
              className={cn(
                "px-3 py-1.5 rounded-md text-sm font-medium border transition-colors whitespace-nowrap",
                status === t.value
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-700",
              )}
            >
              {t.label} <span className="opacity-70">{counts[t.value]?.count ?? 0}</span>
            </button>
          ))}
          {status === "to_verify" && (counts.to_verify?.amount ?? 0) > 0 && (
            <span className="self-center text-sm text-slate-500 ml-2">{money(counts.to_verify!.amount)} waiting</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Input
            className="h-9 max-w-sm"
            placeholder="Transaction ID, sender number, order number or name"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            aria-label="Search payments"
          />
          <Select value={method} onValueChange={(v) => { setMethod(v); setPage(1); }} className="w-44">
            <SelectItem value="">All methods</SelectItem>
            {["bkash", "nagad", "rocket", "bank_transfer"].map((m) => <SelectItem key={m} value={m}>{methodLabel(m)}</SelectItem>)}
          </Select>
        </div>
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Transaction ID</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading &&
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}><TableCell colSpan={7}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                ))}
              {!isLoading && (data?.items.length ?? 0) === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center text-sm text-slate-500">
                    {status === "to_verify" ? "Nothing to check right now." : "No payments here."}
                  </TableCell>
                </TableRow>
              )}
              {data?.items.map((p) => (
                <TableRow key={p.id} className={cn(isFetching && "opacity-60")}>
                  <TableCell>
                    <Link href={`/orders/${p.orderId}`} className="text-sm font-medium text-indigo-600 hover:underline">{p.order?.number}</Link>
                    <div className="text-xs text-slate-500">{when(p.createdAt)} · by {p.submittedBy === "staff" ? "staff" : "customer"}</div>
                  </TableCell>
                  <TableCell className="text-sm">
                    <div className="font-medium">{p.order?.customerName}</div>
                    <div className="text-xs text-slate-500">{p.order?.phone}</div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {methodLabel(p.method)}
                    {p.senderNumber && <div className="text-xs text-slate-500">from {p.senderNumber}</div>}
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-sm font-semibold select-all">{p.transactionId}</span>
                    {p.rejectReason && <div className="text-xs text-red-600 max-w-[220px]">{p.rejectReason}</div>}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    <div className="font-semibold">{money(p.amount)}</div>
                    {p.order && Math.abs(p.order.grandTotal - p.amount) > 0.01 && (
                      <div className="text-xs text-slate-500">order {money(p.order.grandTotal)}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn("text-[11px]", PAYMENT_STYLES[p.status])}>{PAYMENT_LABELS[p.status] ?? p.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {canEdit && p.status === "to_verify" && (
                      <div className="flex justify-end gap-1">
                        <Button size="sm" className="h-8 text-xs" onClick={() => setVerifying(p)}>Verify</Button>
                        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setRejecting(p)}>Reject</Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>{data.total} payments · page {page} of {data.totalPages}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage(page + 1)}>Next</Button>
            </div>
          </div>
        )}
      </CardContent>
      {verifying && <VerifyDialog payment={verifying} onClose={() => setVerifying(null)} />}
      {rejecting && <RejectDialog payment={rejecting} onClose={() => setRejecting(null)} />}
    </Card>
  );
}
