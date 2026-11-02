"use client";

/**
 * The order page's checks: the phone's delivery record (every shop on the platform, counts only),
 * the COD confirmation call with its history, and blocking the number for cash on delivery.
 */
import { useState } from "react";
import { toast } from "sonner";
import { Ban, PhoneCall, ShieldCheck } from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Skeleton, Textarea, cn } from "@/components/ui";
import { errorText } from "@/lib/features/content/content-api-slice";
import {
  CALL_LABELS,
  CALL_OUTCOMES,
  RISK_LABELS,
  RISK_STYLES,
  useBlockPhoneMutation,
  useGetOrderChecksQuery,
  useLogCallMutation,
  useUnblockPhoneMutation,
  type CallOutcome,
} from "@/lib/features/orders/order-checks-api-slice";

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function OrderChecksCard({ order, canEdit }: { order: { id: string | number; status: string; paymentMethod: string }; canEdit: boolean }) {
  const id = String(order.id);
  const { data, isLoading } = useGetOrderChecksQuery(id);
  const [logCall, { isLoading: saving }] = useLogCallMutation();
  const [block, { isLoading: blocking }] = useBlockPhoneMutation();
  const [unblock] = useUnblockPhoneMutation();
  const [outcome, setOutcome] = useState<CallOutcome | null>(null);
  const [note, setNote] = useState("");
  const [alsoBlock, setAlsoBlock] = useState(true);
  const [reason, setReason] = useState("");

  if (isLoading) return <Skeleton className="h-40 w-full rounded-xl" />;
  if (!data) return null;
  const cod = order.paymentMethod.toLowerCase() === "cod";
  const callable = cod && ["PENDING", "ON_HOLD"].includes(order.status);
  const rec = data.now;

  const save = async () => {
    if (!outcome) return;
    try {
      await logCall({ id, outcome, note: note.trim() || undefined, block: outcome === "fake" && alsoBlock }).unwrap();
      toast.success(outcome === "confirmed" ? "Confirmed. The order is now processing." : `Saved: ${CALL_LABELS[outcome]}`);
      setOutcome(null);
      setNote("");
    } catch (e) {
      toast.error(errorText(e));
    }
  };

  return (
    <Card className="border-slate-200 shadow-sm dark:border-slate-800">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4 text-indigo-600" /> Order checks
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {!data.phone ? (
          <p className="text-slate-500">No valid mobile number on this order, so there's no delivery record.</p>
        ) : (
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono">{data.phone}</span>
              {rec && <Badge className={cn("border-transparent", RISK_STYLES[rec.level])}>{RISK_LABELS[rec.level]}</Badge>}
              {data.blocked && <Badge className="border-transparent bg-red-600 text-white">COD blocked</Badge>}
            </div>
            {rec && (
              <p className="text-slate-600 dark:text-slate-300">
                {rec.all.delivered + rec.all.returned === 0
                  ? "No earlier orders to this number went out."
                  : `${rec.all.delivered + rec.all.returned} earlier parcels: ${rec.all.delivered} delivered, ${rec.all.returned} returned (${rec.rate}%).`}
                {rec.here.delivered + rec.here.returned > 0 && ` At your shop: ${rec.here.delivered} delivered, ${rec.here.returned} returned.`}
              </p>
            )}
            {data.atOrder && rec && data.atOrder.level !== rec.level && (
              <p className="text-xs text-slate-500">When ordered: {RISK_LABELS[data.atOrder.level]} ({data.atOrder.delivered} delivered, {data.atOrder.returned} returned).</p>
            )}
            <p className="text-xs text-slate-400">Counted across every shop on the platform; other shops' orders and names are never shown.</p>
          </div>
        )}

        {cod && (
          <div className="space-y-2 border-t pt-3">
            <p className="flex items-center gap-2 font-medium">
              <PhoneCall className="h-4 w-4" /> Confirmation call
              {data.call.status && <span className="font-normal text-slate-500">· {CALL_LABELS[data.call.status]}{data.call.attempts > 1 ? ` (${data.call.attempts} calls)` : ""}</span>}
            </p>
            {data.call.nextCallAt && <p className="text-xs text-slate-500">Call again after {when(data.call.nextCallAt)}.</p>}
            {canEdit && callable && (
              <>
                <div className="flex flex-wrap gap-2">
                  {CALL_OUTCOMES.map((o) => (
                    <Button key={o} type="button" size="sm" variant={outcome === o ? "default" : "outline"} onClick={() => setOutcome(o)}>
                      {CALL_LABELS[o]}
                    </Button>
                  ))}
                </div>
                {outcome && (
                  <div className="space-y-2">
                    <Textarea rows={2} maxLength={500} placeholder="Note (optional): size changed to L, call after 5pm…" value={note} onChange={(e) => setNote(e.target.value)} />
                    {outcome === "fake" && data.phone && !data.blocked && (
                      <label className="flex items-center gap-2 text-xs">
                        <input type="checkbox" className="h-4 w-4" checked={alsoBlock} onChange={(e) => setAlsoBlock(e.target.checked)} /> Also block this number for cash on delivery
                      </label>
                    )}
                    {(outcome === "fake" || outcome === "cancelled") && <p className="text-xs text-amber-700">This cancels the order and puts its stock back.</p>}
                    <Button size="sm" onClick={save} disabled={saving}>
                      {saving ? "Saving…" : "Save call"}
                    </Button>
                  </div>
                )}
              </>
            )}
            {data.calls.length > 0 && (
              <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                {data.calls.map((c) => (
                  <li key={c.id}>
                    {when(c.createdAt)} · {CALL_LABELS[c.outcome]}
                    {c.note ? ` · ${c.note}` : ""}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {canEdit && data.phone && (
          <div className="space-y-2 border-t pt-3">
            {data.blocked ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-slate-600">Blocked for cash on delivery: {data.blocked.reason}</p>
                <Button size="sm" variant="outline" onClick={() => unblock({ id: data.blocked!.id, orderId: id }).unwrap().then(() => toast.success("Number unblocked"), (e) => toast.error(errorText(e)))}>
                  Unblock
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <Input className="h-9 flex-1" maxLength={200} placeholder="Why block? (e.g. refused 3 parcels)" value={reason} onChange={(e) => setReason(e.target.value)} />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={blocking}
                  onClick={() =>
                    block({ phone: data.phone!, reason, orderId: id })
                      .unwrap()
                      .then(() => {
                        setReason("");
                        toast.success("Blocked: this number must pay online from now on");
                      }, (e) => toast.error(errorText(e)))
                  }
                >
                  <Ban className="mr-1 h-4 w-4" /> Block COD
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
