"use client";

/** Order page, inside Payment Details: the order's transfers and cash, with verify / reject / record. */
import { useState } from "react";
import { Plus } from "lucide-react";
import { Badge, Button, Separator, cn } from "@/components/ui";
import {
  PAYMENT_LABELS,
  PAYMENT_STYLES,
  methodLabel,
  useOrderPaymentsQuery,
  type PaymentRow,
} from "@/lib/features/operations/payments-api-slice";
import { RecordPaymentDialog, RejectDialog, VerifyDialog, money } from "./payment-dialogs";
import { useCan } from "@/lib/permissions";

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const MANUAL = ["bkash", "nagad", "rocket", "bank_transfer"];

export function OrderPayments({ orderId, method, closed }: { orderId: string | number; method: string; closed: boolean }) {
  const { can } = useCan();
  const { data } = useOrderPaymentsQuery(orderId, { skip: !can("payments.view") });
  const canEdit = can("payments.edit");
  const [verifying, setVerifying] = useState<PaymentRow | null>(null);
  const [rejecting, setRejecting] = useState<PaymentRow | null>(null);
  const [recording, setRecording] = useState(false);
  if (!data) return null;
  const canRecord = canEdit && !closed && data.due > 0 && MANUAL.includes(method.toLowerCase());
  if (!data.records.length && !canRecord) return null;

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
