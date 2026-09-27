"use client";

/** Verify / reject a reported transfer, and record one for a customer (Payments to verify, order page). */
import { useState } from "react";
import { toast } from "sonner";
import {
  Button,
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
} from "@/components/ui";
import { apiError } from "@/lib/features/operations/fulfilment-api-slice";
import {
  methodLabel,
  useRecordPaymentMutation,
  useRejectPaymentMutation,
  useVerifyPaymentMutation,
  type PaymentRow,
} from "@/lib/features/operations/payments-api-slice";

export const money = (n: number) => `৳ ${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

export function VerifyDialog({ payment, onClose }: { payment: PaymentRow; onClose: () => void }) {
  const [amount, setAmount] = useState(String(payment.amount));
  const [note, setNote] = useState("");
  const [verify, { isLoading }] = useVerifyPaymentMutation();
  const value = Number(amount);

  async function submit() {
    try {
      await verify({
        id: payment.id,
        orderId: payment.orderId,
        amount: value !== payment.amount ? value : undefined,
        note: note.trim() || undefined,
      }).unwrap();
      toast.success(`${payment.transactionId} verified`);
      onClose();
    } catch (e) {
      toast.error(apiError(e, "Couldn't verify the payment"));
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Verify {methodLabel(payment.method)} payment</DialogTitle>
          <DialogDescription>
            Find transaction <span className="font-mono font-semibold">{payment.transactionId}</span>
            {payment.senderNumber && <> from {payment.senderNumber}</>} in your {methodLabel(payment.method)} statement before verifying.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs mb-1 block">Amount that arrived (৳)</Label>
            <Input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-9" />
            {value !== payment.amount && value > 0 && (
              <p className="text-xs text-amber-600 mt-1">The customer said {money(payment.amount)}. The order stays partly paid until the rest arrives.</p>
            )}
          </div>
          <div>
            <Label className="text-xs mb-1 block">Note (optional)</Label>
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={isLoading || !(value > 0)}>Verify {money(value || 0)}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const REJECT_REASONS = [
  "No payment with this transaction ID in our statement",
  "The amount doesn't match the order",
  "Sent from a different number than the one given",
  "This transaction was already used for another order",
];

export function RejectDialog({ payment, onClose }: { payment: PaymentRow; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const [reject, { isLoading }] = useRejectPaymentMutation();

  async function submit() {
    try {
      await reject({ id: payment.id, orderId: payment.orderId, reason: reason.trim() }).unwrap();
      toast.success(`${payment.transactionId} rejected`);
      onClose();
    } catch (e) {
      toast.error(apiError(e, "Couldn't reject the payment"));
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reject {payment.transactionId}</DialogTitle>
          <DialogDescription>The customer sees this reason on their order and can send the correct transaction ID.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {REJECT_REASONS.map((r) => (
            <button key={r} type="button" onClick={() => setReason(r)}
              className="block w-full text-left text-sm rounded-md border border-slate-200 dark:border-slate-700 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800">
              {r}
            </button>
          ))}
          <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Or write your own reason" aria-label="Reason" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" onClick={submit} disabled={isLoading || reason.trim().length < 3}>Reject</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const WALLETS = ["bkash", "nagad", "rocket", "bank_transfer"];

export function RecordPaymentDialog({
  orderId,
  defaultMethod,
  due,
  onClose,
}: {
  orderId: string | number;
  defaultMethod: string;
  due: number;
  onClose: () => void;
}) {
  const [method, setMethod] = useState(WALLETS.includes(defaultMethod) ? defaultMethod : "bkash");
  const [trx, setTrx] = useState("");
  const [sender, setSender] = useState("");
  const [amount, setAmount] = useState(String(due));
  const [verified, setVerified] = useState(true);
  const [note, setNote] = useState("");
  const [record, { isLoading }] = useRecordPaymentMutation();

  async function submit() {
    try {
      await record({
        orderId,
        method,
        transactionId: trx.trim(),
        senderNumber: sender.trim() || undefined,
        amount: Number(amount) || undefined,
        note: note.trim() || undefined,
        verified,
      }).unwrap();
      toast.success(verified ? "Payment recorded and verified" : "Payment added to the queue");
      onClose();
    } catch (e) {
      toast.error(apiError(e, "Couldn't record the payment"));
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record a payment</DialogTitle>
          <DialogDescription>For a customer who sent their transaction ID by phone, Messenger or WhatsApp. {money(due)} is still due.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs mb-1 block">Paid by</Label>
            <Select value={method} onValueChange={setMethod}>
              {WALLETS.map((m) => <SelectItem key={m} value={m}>{methodLabel(m)}</SelectItem>)}
            </Select>
          </div>
          <div>
            <Label className="text-xs mb-1 block">Amount (৳)</Label>
            <Input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-10" />
          </div>
          <div>
            <Label className="text-xs mb-1 block">{method === "bank_transfer" ? "Bank reference" : "Transaction ID"}</Label>
            <Input value={trx} onChange={(e) => setTrx(e.target.value)} className="h-9 font-mono" />
          </div>
          <div>
            <Label className="text-xs mb-1 block">{method === "bank_transfer" ? "From account (optional)" : "Sent from (optional)"}</Label>
            <Input value={sender} onChange={(e) => setSender(e.target.value)} placeholder={method === "bank_transfer" ? "" : "01XXXXXXXXX"} className="h-9" />
          </div>
          <div className="col-span-2">
            <Label className="text-xs mb-1 block">Note (optional)</Label>
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <label className="col-span-2 flex items-center gap-2 text-sm">
            <Checkbox checked={verified} onCheckedChange={setVerified} />
            I can see this payment in our account (verify it now)
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={isLoading || trx.trim().length < 4 || !(Number(amount) > 0)}>
            {verified ? "Record and verify" : "Add to queue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
