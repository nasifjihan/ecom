"use client";

/**
 * Order page, inside Payment Details: the order's transfers, cash and online payments (with verify /
 * reject / record), and its tries at paying online (bKash, SSLCommerz) with "Check again".
 */
import { useState } from "react";
import { toast } from "sonner";
import { Plus, RefreshCw } from "lucide-react";
import { Badge, Button, Separator, cn } from "@/components/ui";
import {
  PAYMENT_LABELS,
  PAYMENT_STYLES,
  methodLabel,
  useOrderPaymentsQuery,
  useRecheckPaymentAttemptMutation,
  type PaymentAttempt,
  type PaymentRow,
} from "@/lib/features/operations/payments-api-slice";
import { apiError } from "@/lib/features/operations/fulfilment-api-slice";
import { RecordPaymentDialog, RejectDialog, VerifyDialog, money } from "./payment-dialogs";
import { useCan } from "@/lib/permissions";

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const MANUAL = ["bkash", "nagad", "rocket", "bank_transfer"];
const EVENT_SOURCES: Record<string, string> = {
  return: "Customer came back",
  ipn: "Gateway notice",
  recheck: "Checked again",
  refund: "Refund",
  refund_check: "Refund checked",
};
const TRY_LABELS: Record<string, string> = { started: "Not finished", paid: "Paid", failed: "Failed", cancelled: "Cancelled", review: "Needs a check" };
const TRY_STYLES: Record<string, string> = {
  started: "text-slate-600",
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  failed: "bg-red-50 text-red-700 border-red-200",
  cancelled: "text-slate-500",
  review: "bg-amber-50 text-amber-800 border-amber-200",
};

export function OrderPayments({ orderId, method, closed }: { orderId: string | number; method: string; closed: boolean }) {
  const { can } = useCan();
  const { data } = useOrderPaymentsQuery(orderId, { skip: !can("payments.view") });
  const canEdit = can("payments.edit");
  const [verifying, setVerifying] = useState<PaymentRow | null>(null);
  const [rejecting, setRejecting] = useState<PaymentRow | null>(null);
  const [recording, setRecording] = useState(false);
  if (!data) return null;
  const canRecord = canEdit && !closed && data.due > 0 && MANUAL.includes(method.toLowerCase());
  if (!data.records.length && !data.attempts.length && !canRecord) return null;

  return (
    <>
      <Separator className="my-2" />
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Payments</span>
          {data.due > 0 && data.records.some((r) => r.kind === "transfer") && <span className="text-xs text-slate-500">{money(data.due)} due</span>}
        </div>
        {data.records.map((r) => (
          <div key={r.id} className="rounded-lg border border-slate-200 dark:border-slate-800 p-2.5 text-xs space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-sm">{methodLabel(r.method)} {money(r.amount)}</span>
              <Badge variant="outline" className={cn("text-[10px]", PAYMENT_STYLES[r.status])}>{PAYMENT_LABELS[r.status] ?? r.status}</Badge>
            </div>
            {r.transactionId && (
              <div className="text-slate-500">
                <span className="font-mono text-slate-700 dark:text-slate-300">{r.transactionId}</span>
                {r.senderNumber && <> from {r.senderNumber}</>}
              </div>
            )}
            {r.kind === "cod" && (
              <div className="text-slate-500">
                {r.courierName ? `${r.courierName}${r.shipment ? ` · ${r.shipment.code}` : ""}` : "At the shop"}
                {r.settlement && <> · paid out in {r.settlement.code}</>}
              </div>
            )}
            {r.rejectReason && <div className="text-red-600">{r.rejectReason}</div>}
            <div className="text-slate-400">{when(r.createdAt)}{r.submittedBy === "customer" ? " · from the customer" : ""}</div>
            {canEdit && r.status === "to_verify" && (
              <div className="flex gap-1 pt-1">
                <Button size="sm" className="h-7 text-xs" onClick={() => setVerifying(r)}>Verify</Button>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setRejecting(r)}>Reject</Button>
              </div>
            )}
          </div>
        ))}
        {data.attempts.length > 0 && <OnlineTries tries={data.attempts} canEdit={canEdit} />}
        {canRecord && (
          <Button size="sm" variant="outline" className="w-full gap-1.5" onClick={() => setRecording(true)}>
            <Plus className="h-4 w-4" /> Record a payment
          </Button>
        )}
      </div>
      {verifying && <VerifyDialog payment={verifying} onClose={() => setVerifying(null)} />}
      {rejecting && <RejectDialog payment={rejecting} onClose={() => setRejecting(null)} />}
      {recording && <RecordPaymentDialog orderId={orderId} defaultMethod={method.toLowerCase()} due={data.due} onClose={() => setRecording(false)} />}
    </>
  );
}

/** Tries at paying online, newest first. "Check again" asks the gateway about one that didn't finish. */
function OnlineTries({ tries, canEdit }: { tries: PaymentAttempt[]; canEdit: boolean }) {
  const [recheck, { isLoading, originalArgs }] = useRecheckPaymentAttemptMutation();
  const onRecheck = async (t: PaymentAttempt) => {
    try {
      const r = await recheck(t.id).unwrap();
      toast.success(r.status === "paid" ? "Paid: the order is updated" : `The gateway says: ${TRY_LABELS[r.status] ?? r.status}`);
    } catch (e) {
      toast.error(apiError(e, "Couldn't check with the gateway"));
    }
  };
  return (
    <div className="space-y-1.5 pt-1">
      <span className="text-[11px] font-medium text-slate-500">Online payment tries</span>
      {tries.map((t) => (
        <div key={t.id} className="rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">
              {methodLabel(t.gateway)} {money(t.amount)}
              {t.mode === "sandbox" && <span className="ml-1 font-normal text-slate-400">(sandbox)</span>}
            </span>
            <Badge variant="outline" className={cn("text-[10px]", TRY_STYLES[t.status])}>{TRY_LABELS[t.status] ?? t.status}</Badge>
          </div>
          <div className="mt-0.5 font-mono text-[11px] text-slate-500">{t.code}{t.transactionId ? ` · ${t.transactionId}` : ""}</div>
          {t.note && <div className={cn("mt-0.5", t.status === "review" ? "text-amber-800 dark:text-amber-400" : "text-slate-500")}>{t.note}</div>}
          {t.refundedAmount > 0 && <div className="mt-0.5 text-purple-700 dark:text-purple-400">{money(t.refundedAmount)} sent back</div>}
          {t.events.length > 0 && (
            <details className="mt-1">
              <summary className="cursor-pointer text-[11px] text-slate-500">Gateway notices ({t.events.length})</summary>
              <ul className="mt-1 space-y-0.5 text-[11px] text-slate-500">
                {t.events.map((e, i) => (
                  <li key={i}>
                    {when(e.at)} · {EVENT_SOURCES[e.source] ?? e.source}: <span className="font-medium">{e.outcome}</span>
                    {e.note ? ` — ${e.note}` : ""}
                  </li>
                ))}
              </ul>
            </details>
          )}
          <div className="mt-0.5 flex items-center justify-between gap-2 text-slate-400">
            <span>{when(t.createdAt)}</span>
            {canEdit && (t.status === "started" || t.status === "failed") && (
              <Button size="sm" variant="ghost" className="h-6 gap-1 px-2 text-[11px]" disabled={isLoading && originalArgs === t.id} onClick={() => void onRecheck(t)}>
                <RefreshCw className="h-3 w-3" /> Check again
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
