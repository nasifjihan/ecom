"use client";

/**
 * Purchase page dialogs: a delivery arriving against a purchase order, and goods sent back to the
 * supplier. Both list the purchase's lines with how many can still arrive / go back.
 */
import * as React from "react";
import { toast } from "sonner";
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input } from "@/components/ui";
import { Field } from "@/components/content/shared";
import { errorText } from "@/lib/features/content/content-api-slice";
import {
  tk,
  today,
  useCreateSupplierReturnMutation,
  useReceivePurchaseMutation,
  type PurchaseDetail,
} from "@/lib/features/purchasing/purchasing-api-slice";

const whole = (s: string) => (/^\d+$/.test(s.trim()) ? Number(s) : NaN);

export function ReceiveDialog({ purchase, open, onOpenChange }: { purchase: PurchaseDetail; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [receive, { isLoading }] = useReceivePurchaseMutation();
  const [qty, setQty] = React.useState<Record<string, string>>({});
  const [on, setOn] = React.useState(today());
  const [note, setNote] = React.useState("");
  React.useEffect(() => {
    if (!open) return;
    // Everything still to come, by default.
    setQty(Object.fromEntries(purchase.items.map((i) => [i.id, String(i.qty - i.qtyReceived)])));
    setOn(today());
    setNote("");
  }, [open, purchase]);

  const rows = purchase.items.map((i) => ({ ...i, left: i.qty - i.qtyReceived, n: whole(qty[i.id] ?? "0") }));
  const bad = rows.find((r) => Number.isNaN(r.n) || r.n > r.left);
  const units = rows.reduce((s, r) => s + (Number.isNaN(r.n) ? 0 : r.n), 0);

  const save = async () => {
    try {
      await receive({ id: purchase.id, items: rows.filter((r) => r.n > 0).map((r) => ({ itemId: r.id, qty: r.n })), receivedOn: on, note: note.trim() || undefined }).unwrap();
      toast.success(`${units} unit${units === 1 ? "" : "s"} received into stock`);
      onOpenChange(false);
    } catch (e) {
      toast.error(errorText(e));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Receive delivery · {purchase.number}</DialogTitle>
          <DialogDescription>What arrived goes into stock at its landed cost, and is added to what you owe {purchase.supplier.name}.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center gap-3 text-sm">
              <span className="flex-1">
                {r.name}
                <span className="block text-xs text-slate-500">
                  {r.qtyReceived} of {r.qty} arrived · {tk(r.landedUnitCost)} each
                </span>
              </span>
              <Input
                aria-label={`Arrived now: ${r.name}`}
                className="w-24 text-right"
                inputMode="numeric"
                disabled={r.left === 0}
                value={qty[r.id] ?? ""}
                onChange={(e) => setQty({ ...qty, [r.id]: e.target.value })}
              />
            </div>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Arrived on" htmlFor="rcv-on">
            <Input id="rcv-on" type="date" value={on} onChange={(e) => setOn(e.target.value)} />
          </Field>
          <Field label="Note (optional)" htmlFor="rcv-note">
            <Input id="rcv-note" value={note} maxLength={300} placeholder="e.g. challan 4512" onChange={(e) => setNote(e.target.value)} />
          </Field>
        </div>
        {bad && <p className="text-sm text-destructive">{`"${bad.name}": enter a whole number up to ${bad.left}`}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={isLoading || !!bad || units === 0}>
            Receive {units > 0 ? `${units} unit${units === 1 ? "" : "s"}` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SendBackDialog({ purchase, open, onOpenChange }: { purchase: PurchaseDetail; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [create, { isLoading }] = useCreateSupplierReturnMutation();
  const [qty, setQty] = React.useState<Record<string, string>>({});
  const [reason, setReason] = React.useState("");
  const [on, setOn] = React.useState(today());
  React.useEffect(() => {
    if (!open) return;
    setQty({});
    setReason("");
    setOn(today());
  }, [open]);

  const rows = purchase.items.filter((i) => i.qtyReceived > 0).map((i) => ({ ...i, n: (qty[i.id] ?? "").trim() === "" ? 0 : whole(qty[i.id]!) }));
  const bad = rows.find((r) => Number.isNaN(r.n) || r.n > r.qtyReceived);
  const picked = rows.filter((r) => r.n > 0);
  const credit = picked.reduce((s, r) => s + r.n * r.landedUnitCost, 0);

  const save = async () => {
    try {
      const r = await create({
        supplierId: purchase.supplier.id,
        purchaseId: purchase.id,
        returnedOn: on,
        reason: reason.trim(),
        items: picked.map((x) => ({ productId: x.productId, variantId: x.variantId, qty: x.n })),
      }).unwrap();
      toast.success(`${r.number}: ${tk(r.total)} credited by ${purchase.supplier.name}`);
      onOpenChange(false);
    } catch (e) {
      toast.error(errorText(e));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Send back to {purchase.supplier.name}</DialogTitle>
          <DialogDescription>The units leave stock (only ones not held for orders) and your balance with the supplier goes down by their landed cost.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center gap-3 text-sm">
              <span className="flex-1">
                {r.name}
                <span className="block text-xs text-slate-500">
                  {r.qtyReceived} arrived · {tk(r.landedUnitCost)} each
                </span>
              </span>
              <Input aria-label={`Send back: ${r.name}`} className="w-24 text-right" inputMode="numeric" placeholder="0" value={qty[r.id] ?? ""} onChange={(e) => setQty({ ...qty, [r.id]: e.target.value })} />
            </div>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Why they go back" htmlFor="rts-reason">
            <Input id="rts-reason" value={reason} maxLength={200} placeholder="e.g. Torn, wrong colour" onChange={(e) => setReason(e.target.value)} />
          </Field>
          <Field label="Sent on" htmlFor="rts-on">
            <Input id="rts-on" type="date" value={on} onChange={(e) => setOn(e.target.value)} />
          </Field>
        </div>
        {bad && <p className="text-sm text-destructive">{`"${bad.name}": enter a whole number up to ${bad.qtyReceived}`}</p>}
        <DialogFooter>
          <span className="mr-auto self-center text-sm text-slate-600">{picked.length > 0 && `Credit ${tk(Math.round(credit * 100) / 100)}`}</span>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={isLoading || !!bad || picked.length === 0 || reason.trim().length < 2}>
            Send back
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
