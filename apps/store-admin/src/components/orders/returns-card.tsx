"use client";

/** Order page: return requests, their history, and refunds (by item, extra amount, or against a return). */
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, RotateCcw, Undo2, Wallet } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectItem,
  Textarea,
  cn,
} from "@/components/ui";
import {
  REFUND_METHODS,
  RETURN_LABELS,
  RETURN_NEXT,
  RETURN_REASONS,
  RETURN_STYLES,
  apiError,
  reasonLabel,
  refundMethodLabel,
  useCreateRefundMutation,
  useCreateReturnMutation,
  useMoveReturnMutation,
  type RefundMethod,
  type RefundRow,
  type ReturnRequest,
  type ReturnStatus,
} from "@/lib/features/operations/fulfilment-api-slice";
import type { OrderLine } from "@/lib/features/operations/operations-api-slice";
import { NoteDialog } from "./parcels-card";

const money = (n: number) => `৳ ${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const r2 = (n: number) => Math.round(n * 100) / 100;
const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const unit = (l: OrderLine) => (l.quantity > 0 ? l.lineTotal / l.quantity : 0);

const MOVE_LABEL: Partial<Record<ReturnStatus, string>> = {
  approved: "Approve",
  received: "Mark received",
  rejected: "Reject",
  cancelled: "Cancel",
};

interface Props {
  order: {
    id: string | number;
    status: string;
    paymentMethod: string;
    paymentStatus?: string;
    grandTotal: number;
    refundedTotal: number;
    returnStatus: string;
    lines: OrderLine[];
    returns?: ReturnRequest[];
    refunds?: RefundRow[];
  };
  canEdit: boolean;
}

export function ReturnsCard({ order, canEdit }: Props) {
  const returns = order.returns ?? [];
  const refunds = order.refunds ?? [];
  const [starting, setStarting] = useState(false);
  const [refunding, setRefunding] = useState<{ returnId?: string } | null>(null);
  const [moving, setMoving] = useState<{ ret: ReturnRequest; to: ReturnStatus } | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const names = useMemo(() => new Map(order.lines.map((l) => [String(l.id), l.productName])), [order.lines]);
  const refundable = r2(order.grandTotal - order.refundedTotal);
  const paid = ["PAID", "PARTIALLY_REFUNDED"].includes(order.paymentStatus ?? "");
  const canReturn = ["SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED", "COMPLETED", "REFUNDED"].includes(order.status);

  return (
    <Card className="border-slate-200 shadow-sm dark:border-slate-800">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <RotateCcw className="h-4 w-4 text-indigo-600" /> Returns &amp; refunds
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              Refunded {money(order.refundedTotal)} of {money(order.grandTotal)}
              {paid && refundable > 0 && <> · {money(refundable)} can still be refunded</>}
              {!paid && order.refundedTotal === 0 && <> · refunds open once the order is paid</>}
            </CardDescription>
          </div>
          {canEdit && (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="gap-1.5" disabled={!canReturn} onClick={() => setStarting(true)}
                title={canReturn ? undefined : "Only orders that went out can be returned"}>
                <Undo2 className="h-4 w-4" /> Start return
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5" disabled={!paid || refundable <= 0} onClick={() => setRefunding({})}
                title={paid ? undefined : "Only paid orders can be refunded"}>
                <Wallet className="h-4 w-4" /> Refund
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="pb-4 grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Returns</h3>
          {returns.length === 0 && <p className="text-sm text-slate-500">No return requests.</p>}
          {returns.map((r) => {
            const next = RETURN_NEXT[r.status] ?? [];
            return (
              <div key={r.id} className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 text-sm space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-semibold">{r.code}</span>
                  <Badge variant="outline" className={cn("text-[11px]", RETURN_STYLES[r.status])}>{RETURN_LABELS[r.status]}</Badge>
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-400 space-y-0.5">
                  <div>
                    {reasonLabel(r.reason)} · asked by {r.requestedBy === "staff" ? "staff" : "the customer"} · {when(r.createdAt)}
                  </div>
                  <div>
                    {r.items.map((i) => `${i.quantity} × ${i.name ?? names.get(i.orderItemId) ?? "Item"}${i.restocked ? " (restocked)" : ""}`).join(", ")}
                  </div>
                  <div>Worth {money(r.requestedAmount)}</div>
                  {r.customerNote && <div className="italic">“{r.customerNote}”</div>}
                  {r.adminNotes && <div className="text-red-600">{r.adminNotes}</div>}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    className="text-xs text-slate-500 hover:text-indigo-600 inline-flex items-center gap-0.5"
                    onClick={() => setOpen({ ...open, [r.id]: !open[r.id] })}
                  >
                    {open[r.id] ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    History ({r.events.length})
                  </button>
                  {canEdit && (
                    <div className="flex flex-wrap gap-1">
                      {next.map((s) => (
                        <Button key={s} size="sm" variant={s === "rejected" || s === "cancelled" ? "ghost" : "outline"} className="h-7 text-xs"
                          onClick={() => setMoving({ ret: r, to: s })}>
                          {MOVE_LABEL[s] ?? RETURN_LABELS[s]}
                        </Button>
                      ))}
                      {r.status === "received" && paid && (
                        <Button size="sm" className="h-7 text-xs" onClick={() => setRefunding({ returnId: r.id })}>Refund</Button>
                      )}
                    </div>
                  )}
                </div>
                {open[r.id] && (
                  <ol className="border-l-2 border-slate-200 dark:border-slate-700 ml-1 pl-3 space-y-1.5">
                    {r.events.map((e) => (
                      <li key={e.id} className="text-xs">
                        <span className="font-medium">{RETURN_LABELS[e.status as ReturnStatus] ?? e.status}</span>
                        <span className="text-slate-500"> · {when(e.createdAt)}</span>
                        {e.note && <div className="text-slate-500">{e.note}</div>}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            );
          })}
        </div>
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Refunds</h3>
          {refunds.length === 0 && <p className="text-sm text-slate-500">No refunds.</p>}
          {refunds.map((f) => (
            <div key={f.id} className="rounded-lg border border-purple-200 dark:border-purple-500/20 bg-purple-50/40 dark:bg-purple-500/5 p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="font-medium text-purple-700 dark:text-purple-400">{refundMethodLabel(f.method)}</span>
                <span className="font-bold">{money(f.amount)}</span>
              </div>
              {f.reason && <div className="text-xs text-slate-600 dark:text-slate-400">{f.reason}</div>}
              {f.items.length > 0 && (
                <div className="text-xs text-slate-500">{f.items.map((i) => `${i.quantity} × ${names.get(i.orderItemId) ?? "Item"}`).join(", ")}</div>
              )}
              <div className="text-xs text-slate-500">
                {when(f.createdAt)}
                {f.returnRequestId && <> · for {returns.find((r) => r.id === f.returnRequestId)?.code ?? "a return"}</>}
                {f.gatewayRefunded && <> · sent back through the gateway</>}
              </div>
            </div>
          ))}
        </div>
      </CardContent>

      {starting && <StartReturnDialog order={order} onClose={() => setStarting(false)} />}
      {refunding && <RefundDialog order={order} returnId={refunding.returnId} onClose={() => setRefunding(null)} />}
      {moving && <MoveReturnDialog orderId={order.id} ret={moving.ret} to={moving.to} names={names} onClose={() => setMoving(null)} />}
    </Card>
  );
}

function MoveReturnDialog({
  orderId,
  ret,
  to,
  names,
  onClose,
}: {
  orderId: string | number;
  ret: ReturnRequest;
  to: ReturnStatus;
  names: Map<string, string>;
  onClose: () => void;
}) {
  const [moveReturn, { isLoading }] = useMoveReturnMutation();
  const [restock, setRestock] = useState<Record<string, boolean>>(() => Object.fromEntries(ret.items.map((i) => [i.orderItemId, true])));

  async function confirm(note: string) {
    try {
      await moveReturn({
        id: ret.id,
        orderId,
        status: to,
        note: note || undefined,
        ...(to === "received" ? { noRestockItemIds: ret.items.filter((i) => !restock[i.orderItemId]).map((i) => i.orderItemId) } : {}),
      }).unwrap();
      toast.success(`${ret.code}: ${RETURN_LABELS[to]}`);
      onClose();
    } catch (e) {
      toast.error(apiError(e, "Couldn't update the return"));
    }
  }

  const copy: Partial<Record<ReturnStatus, string>> = {
    approved: "The customer can send the items back.",
    received: "The items are back with you. Ticked items go back into stock.",
    rejected: "Say why, e.g. used or outside the return window. If the items were received, they stay in stock.",
    cancelled: "Close the request without a refund (e.g. the customer changed their mind).",
  };
  return (
    <NoteDialog
      title={`${MOVE_LABEL[to] ?? RETURN_LABELS[to]}: ${ret.code}`}
      description={copy[to]}
      confirm={MOVE_LABEL[to] ?? "Save"}
      required={to === "rejected"}
      busy={isLoading}
      onClose={onClose}
      onConfirm={confirm}
    >
      {to === "received" && (
        <div className="space-y-2">
          {ret.items.map((i) => (
            <label key={i.id} className="flex items-center gap-2 text-sm">
              <Checkbox checked={!!restock[i.orderItemId]} onCheckedChange={(c) => setRestock({ ...restock, [i.orderItemId]: c })} />
              Put {i.quantity} × {i.name ?? names.get(i.orderItemId) ?? "item"} back in stock
            </label>
          ))}
        </div>
      )}
    </NoteDialog>
  );
}

function StartReturnDialog({ order, onClose }: { order: Props["order"]; onClose: () => void }) {
  // Units not already in an open or finished return.
  const left = useMemo(() => {
    const taken = new Map<string, number>();
    for (const r of order.returns ?? []) {
      if (r.status === "cancelled" || r.status === "rejected") continue;
      for (const i of r.items) taken.set(i.orderItemId, (taken.get(i.orderItemId) ?? 0) + i.quantity);
    }
    return new Map(order.lines.map((l) => [String(l.id), l.quantity - (taken.get(String(l.id)) ?? 0)]));
  }, [order]);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [reason, setReason] = useState<string>(RETURN_REASONS[0].value);
  const [note, setNote] = useState("");
  const [createReturn, { isLoading }] = useCreateReturnMutation();
  const items = Object.entries(qty).filter(([, q]) => q > 0).map(([orderItemId, quantity]) => ({ orderItemId, quantity }));

  async function submit() {
    try {
      const r = await createReturn({ orderId: order.id, items, reason, note: note.trim() || undefined }).unwrap();
      toast.success(`Return ${r.code} opened`);
      onClose();
    } catch (e) {
      toast.error(apiError(e, "Couldn't start the return"));
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Start a return</DialogTitle>
          <DialogDescription>For a customer who called or messaged. Nothing is refunded yet: receive the items, then refund.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            {order.lines.map((l) => {
              const max = left.get(String(l.id)) ?? 0;
              return (
                <div key={l.id} className="flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{l.productName}</div>
                    <div className="text-xs text-slate-500">{max} of {l.quantity} can be returned</div>
                  </div>
                  <Input type="number" min={0} max={max} disabled={max <= 0} value={qty[String(l.id)] ?? 0}
                    onChange={(e) => setQty({ ...qty, [String(l.id)]: Math.max(0, Math.min(max, parseInt(e.target.value) || 0)) })}
                    className="h-8 w-20" aria-label={`Quantity of ${l.productName} to return`} />
                </div>
              );
            })}
          </div>
          <div>
            <Label className="text-xs mb-1 block">Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              {RETURN_REASONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
            </Select>
          </div>
          <div>
            <Label className="text-xs mb-1 block">Note</Label>
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What the customer said" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={isLoading || !items.length}>Open return</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RefundDialog({ order, returnId, onClose }: { order: Props["order"]; returnId?: string; onClose: () => void }) {
  const ret = (order.returns ?? []).find((r) => r.id === returnId);
  const refundedQty = useMemo(() => {
    const m = new Map<string, number>();
    for (const f of order.refunds ?? []) for (const i of f.items) m.set(i.orderItemId, (m.get(i.orderItemId) ?? 0) + i.quantity);
    return m;
  }, [order.refunds]);
  const [qty, setQty] = useState<Record<string, number>>(() =>
    ret ? Object.fromEntries(ret.items.map((i) => [i.orderItemId, i.quantity])) : {},
  );
  const [extra, setExtra] = useState("");
  const isOnline = !["COD", "BANK_TRANSFER"].includes(order.paymentMethod);
  const [method, setMethod] = useState<RefundMethod>(isOnline ? "original" : "cash");
  const [reason, setReason] = useState(ret ? reasonLabel(ret.reason) : "");
  const [note, setNote] = useState("");
  const [restock, setRestock] = useState(!ret);
  const [createRefund, { isLoading }] = useCreateRefundMutation();

  const items = Object.entries(qty).filter(([, q]) => q > 0).map(([orderItemId, quantity]) => ({ orderItemId, quantity }));
  const itemsTotal = r2(items.reduce((s, i) => {
    const l = order.lines.find((x) => String(x.id) === i.orderItemId);
    return s + (l ? unit(l) * i.quantity : 0);
  }, 0));
  const total = r2(itemsTotal + (Number(extra) || 0));
  const room = r2(order.grandTotal - order.refundedTotal);

  async function submit() {
    try {
      const f = await createRefund({
        orderId: order.id,
        items: items.length ? items : undefined,
        extraAmount: Number(extra) > 0 ? Number(extra) : undefined,
        method,
        reason: reason.trim(),
        note: note.trim() || undefined,
        restock,
        returnRequestId: returnId,
      }).unwrap();
      toast.success(`Refunded ${money(f.amount)}${f.gatewayRefunded ? " through the payment gateway" : ""}`);
      onClose();
    } catch (e) {
      toast.error(apiError(e, "Couldn't refund"));
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{ret ? `Refund return ${ret.code}` : "Refund"}</DialogTitle>
          <DialogDescription>
            Items are refunded at the price the customer paid (after discounts). {money(room)} can still be refunded on this order.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            {order.lines.map((l) => {
              const max = l.quantity - (refundedQty.get(String(l.id)) ?? 0);
              const q = qty[String(l.id)] ?? 0;
              return (
                <div key={l.id} className="flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{l.productName}</div>
                    <div className="text-xs text-slate-500">{money(r2(unit(l)))} each · {max} of {l.quantity} not refunded</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 w-20 text-right">{q > 0 ? money(r2(unit(l) * q)) : ""}</span>
                    <Input type="number" min={0} max={max} disabled={max <= 0} value={q}
                      onChange={(e) => setQty({ ...qty, [String(l.id)]: Math.max(0, Math.min(max, parseInt(e.target.value) || 0)) })}
                      className="h-8 w-20" aria-label={`Quantity of ${l.productName} to refund`} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs mb-1 block">Extra amount (৳)</Label>
              <Input type="number" min={0} step="0.01" value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="e.g. delivery charge" className="h-9" />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Refund by</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as RefundMethod)}>
                {REFUND_METHODS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs mb-1 block">Reason</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Damaged in delivery" className="h-9" />
          </div>
          <div>
            <Label className="text-xs mb-1 block">Note</Label>
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Transaction ID of a manual transfer, etc." />
          </div>
          {!ret && items.length > 0 && (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={restock} onCheckedChange={setRestock} />
              Put the refunded items back in stock
            </label>
          )}
          {method === "store_credit" && (
            <p className="text-xs text-slate-500">The amount is added to the customer's store credit.</p>
          )}
          <div className="flex justify-between items-center pt-3 border-t border-slate-200 dark:border-slate-800">
            <span className="text-sm text-slate-500">Refund total</span>
            <span className={cn("text-2xl font-bold", total > room ? "text-red-600" : "text-slate-900 dark:text-white")}>{money(total)}</span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" onClick={submit} disabled={isLoading || total <= 0 || total > room + 0.001 || reason.trim().length < 2}>
            Refund {money(total)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
