"use client";

/**
 * Paying a bKash / Nagad / Rocket / bank order by hand: where to send the money, what the shop
 * made of each transaction ID, and a form to send one (thank-you page and the account's order page).
 * OnlinePaymentCard: an unpaid bKash / SSLCommerz order, with "Pay now" back to the gateway.
 */
import * as React from "react";
import { AlertTriangle, CreditCard, Loader2, Wallet } from "lucide-react";
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
  usePayOrderOnlineMutation,
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

/** What happened on the gateway's page, from the ?payment= the API adds when it sends the customer back. */
const OUTCOME: Record<string, string> = {
  failed: msg("The payment didn't go through. No money was taken; you can try again."),
  cancelled: msg("The payment was cancelled. You can pay again below."),
  pending: msg("We couldn't confirm the payment yet. If money was taken, it will show here shortly; otherwise, try again."),
  review: msg("We received a payment that needs a check by the shop. They'll contact you; please don't pay again."),
};

/** An unpaid bKash / SSLCommerz order: why, and "Pay now" to open the gateway's page again. */
export function OnlinePaymentCard({
  orderKey,
  payment: p,
  currency,
  outcome,
}: {
  orderKey: string;
  payment: OrderPayment;
  currency: string;
  outcome?: string | null;
}) {
  const t = useT();
  const [pay, { isLoading }] = usePayOrderOnlineMutation();
  const [opening, setOpening] = React.useState(false);
  const message = outcome ? OUTCOME[outcome] : undefined;
  const onPay = async () => {
    try {
      setOpening(true);
      const { payUrl } = await pay(orderKey).unwrap();
      window.location.href = payUrl;
    } catch (err) {
      setOpening(false);
      toast.error(apiErrorMessage(err, t("Could not open the payment page. Please try again.")));
    }
  };
  return (
    <Card className="border-amber-200 dark:border-amber-900">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-primary" /> {t("Payment not completed")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {message && (
          <p className={cn("flex items-start gap-2 rounded-lg p-3 text-sm", outcome === "review" ? "bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200" : "bg-muted")}>
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {t(message)}
          </p>
        )}
        <p className="text-sm text-muted-foreground">
          {t("Your order is saved. Pay {amount} with {method} to confirm it.", { amount: formatMoney(p.due, currency), method: p.methodName })}
        </p>
        {outcome !== "review" && (
          <Button className="w-full sm:w-auto" disabled={isLoading || opening} onClick={() => void onPay()}>
            {(isLoading || opening) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("Pay {amount} with {method}", { amount: formatMoney(p.due, currency), method: p.methodName })}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
