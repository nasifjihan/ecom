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
  useT,
  msg,
  type OrderPayment,
  type TransferInput,
} from "@ecom/storefront-base";

const HOW: Record<string, string> = { personal: msg("Send Money"), agent: msg("Cash Out"), merchant: msg("Make Payment") };
const STATE: Record<string, { label: string; tone: string }> = {
  to_verify: { label: msg("Checking"), tone: "bg-amber-100 text-amber-800" },
  verified: { label: msg("Received"), tone: "bg-emerald-100 text-emerald-800" },
  rejected: { label: msg("Not accepted"), tone: "bg-red-100 text-red-800" },
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
  const t = useT();
  if (!p.manual) return null;
  const bank = p.method === "bank_transfer";
  const lastRejected = p.transfers.length > 0 && p.transfers[p.transfers.length - 1]!.status === "rejected";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await onSubmit({ transactionId: trx.trim(), senderNumber: sender.trim() || undefined });
      toast.success(t("Thanks! We'll check your payment shortly"));
      setTrx("");
      setSender("");
    } catch (err) {
      toast.error(t("Couldn't send the transaction ID"), { description: apiErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Wallet className="h-5 w-5 text-primary" /> {t("{method} payment", { method: p.methodName })}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {p.due > 0 && (
          <div className="rounded-lg border bg-muted/40 p-3">
            {bank ? (
              <>
                <p className="text-muted-foreground">{t("Transfer {amount} to:", { amount: formatMoney(p.due, currency) })}</p>
                <p className="mt-1 whitespace-pre-line">{p.instructions}</p>
              </>
            ) : (
              <>
                <p className="text-muted-foreground">
                  {t(HOW[p.accountType ?? "personal"] ?? "Send Money")} <strong className="text-foreground">{formatMoney(p.due, currency)}</strong>{" "}
                  {t("to our {brand} number:", { brand: p.methodName })}
                </p>
                <p className="mt-1 text-lg font-bold font-mono tracking-wide select-all">{p.accountNumber}</p>
                {p.instructions && <p className="mt-1 text-xs text-muted-foreground whitespace-pre-line">{p.instructions}</p>}
              </>
            )}
          </div>
        )}

        {p.transfers.length > 0 && (
          <ul className="space-y-2">
            {p.transfers.map((tr, i) => (
              <li key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
                <div>
                  <span className="font-mono">{tr.transactionId}</span>
                  <span className="text-muted-foreground"> · {formatMoney(tr.amount, currency)}</span>
                  {tr.rejectReason && <p className="text-xs text-red-700 mt-0.5">{tr.rejectReason}</p>}
                </div>
                <Badge className={cn("border-0", STATE[tr.status]?.tone)}>{t(STATE[tr.status]?.label ?? tr.status)}</Badge>
              </li>
            ))}
          </ul>
        )}

        {p.canSubmit && (
          <form onSubmit={submit} className="space-y-3">
            <p className="font-medium">
              {lastRejected ? t("Send the correct transaction ID") : p.transfers.length ? t("Paid the rest? Send its transaction ID") : t("Paid? Send us the transaction ID")}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {!bank && (
                <div className="space-y-1.5">
                  <Label htmlFor="pay-sender">{t("Your {brand} number", { brand: p.methodName })}</Label>
                  <Input id="pay-sender" inputMode="numeric" placeholder="01XXXXXXXXX" value={sender} onChange={(e) => setSender(e.target.value)} required />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="pay-trx">{bank ? t("Transfer reference") : t("Transaction ID (TrxID)")}</Label>
                <Input id="pay-trx" className="font-mono uppercase" value={trx} onChange={(e) => setTrx(e.target.value.toUpperCase())} required minLength={4} />
              </div>
            </div>
            <Button type="submit" disabled={busy || trx.trim().length < 4}>{busy ? t("Sending...") : t("Send")}</Button>
          </form>
        )}
        {!p.canSubmit && p.due > 0 && p.transfers.some((tr) => tr.status === "to_verify") && (
          <p className="text-muted-foreground">{t("We're checking your payment. The order is confirmed as soon as it's verified.")}</p>
        )}
      </CardContent>
    </Card>
  );
}
