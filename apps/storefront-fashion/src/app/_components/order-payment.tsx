"use client";

/**
 * Paying a bKash / Nagad / Rocket / bank order by hand: where to send the money, what the shop
 * made of each transaction ID, and a form to send one (thank-you page and the account's order page).
 */
import * as React from "react";
import { Wallet } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  apiErrorMessage,
  cn,
  formatMoney,
  toast,
  type OrderPayment,
  type TransferInput,
} from "@ecom/storefront-base";

const HOW: Record<string, string> = { personal: "Send Money", agent: "Cash Out", merchant: "Make Payment" };
const STATE: Record<string, { label: string; tone: string }> = {
  to_verify: { label: "Checking", tone: "bg-amber-100 text-amber-800" },
  verified: { label: "Received", tone: "bg-emerald-100 text-emerald-800" },
  rejected: { label: "Not accepted", tone: "bg-red-100 text-red-800" },
};

export function OrderPaymentCard({
  payment: p,
  currency,
  onSubmit,
}: {
  payment: OrderPayment;
  currency: string;
  onSubmit: (input: TransferInput) => Promise<unknown>;
}) {
  const [trx, setTrx] = React.useState("");
  const [sender, setSender] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  if (!p.manual) return null;
  const bank = p.method === "bank_transfer";
  const lastRejected = p.transfers.length > 0 && p.transfers[p.transfers.length - 1]!.status === "rejected";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await onSubmit({ transactionId: trx.trim(), senderNumber: sender.trim() || undefined });
      toast.success("Thanks! We'll check your payment shortly");
      setTrx("");
      setSender("");
    } catch (err) {
      toast.error("Couldn't send the transaction ID", { description: apiErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Wallet className="h-5 w-5 text-primary" /> {p.methodName} payment
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {p.due > 0 && (
          <div className="rounded-lg border bg-muted/40 p-3">
            {bank ? (
              <>
                <p className="text-muted-foreground">Transfer <strong className="text-foreground">{formatMoney(p.due, currency)}</strong> to:</p>
                <p className="mt-1 whitespace-pre-line">{p.instructions}</p>
              </>
            ) : (
              <>
                <p className="text-muted-foreground">
                  {HOW[p.accountType ?? "personal"] ?? "Send Money"} <strong className="text-foreground">{formatMoney(p.due, currency)}</strong> to our{" "}
                  {p.methodName} number:
                </p>
                <p className="mt-1 text-lg font-bold font-mono tracking-wide select-all">{p.accountNumber}</p>
                {p.instructions && <p className="mt-1 text-xs text-muted-foreground whitespace-pre-line">{p.instructions}</p>}
              </>
            )}
          </div>
        )}

        {p.transfers.length > 0 && (
          <ul className="space-y-2">
            {p.transfers.map((t, i) => (
              <li key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
                <div>
                  <span className="font-mono">{t.transactionId}</span>
                  <span className="text-muted-foreground"> · {formatMoney(t.amount, currency)}</span>
                  {t.rejectReason && <p className="text-xs text-red-700 mt-0.5">{t.rejectReason}</p>}
                </div>
                <Badge className={cn("border-0", STATE[t.status]?.tone)}>{STATE[t.status]?.label ?? t.status}</Badge>
              </li>
            ))}
          </ul>
        )}

        {p.canSubmit && (
          <form onSubmit={submit} className="space-y-3">
            <p className="font-medium">
              {lastRejected ? "Send the correct transaction ID" : p.transfers.length ? "Paid the rest? Send its transaction ID" : "Paid? Send us the transaction ID"}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {!bank && (
                <div className="space-y-1.5">
                  <Label htmlFor="pay-sender">Your {p.methodName} number</Label>
                  <Input id="pay-sender" inputMode="numeric" placeholder="01XXXXXXXXX" value={sender} onChange={(e) => setSender(e.target.value)} required />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="pay-trx">{bank ? "Transfer reference" : "Transaction ID (TrxID)"}</Label>
                <Input id="pay-trx" className="font-mono uppercase" value={trx} onChange={(e) => setTrx(e.target.value.toUpperCase())} required minLength={4} />
              </div>
            </div>
            <Button type="submit" disabled={busy || trx.trim().length < 4}>{busy ? "Sending..." : "Send"}</Button>
          </form>
        )}
        {!p.canSubmit && p.due > 0 && p.transfers.some((t) => t.status === "to_verify") && (
          <p className="text-muted-foreground">We're checking your payment. The order is confirmed as soon as it's verified.</p>
        )}
      </CardContent>
    </Card>
  );
}
