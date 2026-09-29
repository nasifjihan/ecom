"use client";

/** One quote: its lines and prices, the shop's terms, and Accept / Decline while it's open. */
import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Check, X } from "lucide-react";
import { Button, Card, CardContent, Label, Skeleton, apiErrorMessage, cn, msg, toast, useT } from "@ecom/storefront-base";
import { AccountShell, formatBDT, formatDate } from "../../_components";
import { QUOTE_STATUS_TONE, QUOTE_STATUS_WORDS, useMyQuoteQuery, useRespondQuoteMutation } from "@/lib/quotes";

export default function QuotePage() {
  const { number } = useParams<{ number: string }>();
  const t = useT();
  const { data: q, isLoading, isError } = useMyQuoteQuery(number);
  const [respond, { isLoading: answering }] = useRespondQuoteMutation();
  const [note, setNote] = React.useState("");

  const answer = async (action: "accept" | "decline") => {
    try {
      await respond({ number, action, note: note.trim() || null }).unwrap();
      toast.success(action === "accept" ? t("Quote accepted. The shop will confirm your order.") : t("Quote declined"));
      setNote("");
    } catch (err) {
      toast.error(t("Couldn't send your answer"), { description: apiErrorMessage(err) });
    }
  };

  return (
    <AccountShell title={msg("Quote")}>
      <Link href="/account/quotes" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> {t("All quotes")}
      </Link>
      {isLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : isError || !q ? (
        <p className="text-sm text-destructive">{t("We couldn't find this quote.")}</p>
      ) : (
        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-1 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-lg font-semibold">{q.number}</p>
                <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", QUOTE_STATUS_TONE[q.status])}>{t(QUOTE_STATUS_WORDS[q.status])}</span>
              </div>
              {q.validUntil && q.status !== "REQUESTED" && <p className="text-sm text-muted-foreground">{t("Valid until {date}", { date: formatDate(q.validUntil) })}</p>}
              {q.status === "REQUESTED" && <p className="text-sm text-muted-foreground">{t("The shop is preparing prices for you. We'll email you when the quote is ready.")}</p>}
              {q.status === "EXPIRED" && <p className="text-sm text-amber-700">{t("This quote has expired. Ask the shop for a new one.")}</p>}
              {q.order?.number && (
                <p className="text-sm">
                  {t("Made into order")}{" "}
                  <Link href={`/account/orders/${q.order.number}`} className="font-medium text-primary hover:underline">
                    #{q.order.number}
                  </Link>
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <ul className="divide-y">
                {q.items.map((i) => (
                  <li key={i.id} className="flex items-start justify-between gap-3 p-4 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {i.name}
                        {i.option && <span className="text-muted-foreground"> — {i.option}</span>}
                      </p>
                      <p className="text-muted-foreground">
                        {i.qty} × {formatBDT(i.unitPrice)}
                        {i.unitPrice < i.listPrice && <span className="ml-1 line-through">{formatBDT(i.listPrice)}</span>}
                      </p>
                    </div>
                    <p className="font-medium tabular-nums">{formatBDT(i.lineTotal)}</p>
                  </li>
                ))}
              </ul>
              <div className="space-y-1 border-t p-4 text-sm">
                <p className="flex justify-between">
                  <span>{t("Items")}</span>
                  <span className="tabular-nums">{formatBDT(q.subtotal)}</span>
                </p>
                {q.discount > 0 && (
                  <p className="flex justify-between text-green-700">
                    <span>{t("Discount")}</span>
                    <span className="tabular-nums">−{formatBDT(q.discount)}</span>
                  </p>
                )}
                {q.deliveryFee > 0 && (
                  <p className="flex justify-between">
                    <span>{t("Delivery")}</span>
                    <span className="tabular-nums">{formatBDT(q.deliveryFee)}</span>
                  </p>
                )}
                <p className="flex justify-between pt-1 text-base font-semibold">
                  <span>{t("Total")}</span>
                  <span className="tabular-nums">{formatBDT(q.total)}</span>
                </p>
                <p className="text-right text-xs text-muted-foreground">{t("VAT, if it applies, is added to the order.")}</p>
                {q.listTotal > q.subtotal - q.discount && (
                  <p className="text-right text-xs text-green-700">{t("You save {amount}", { amount: formatBDT(q.listTotal - (q.subtotal - q.discount)) })}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {q.terms && (
            <Card>
              <CardContent className="p-5 text-sm">
                <p className="mb-1 font-semibold">{t("Terms")}</p>
                <p className="whitespace-pre-line text-muted-foreground">{q.terms}</p>
              </CardContent>
            </Card>
          )}
          {q.customerNote && (
            <p className="text-sm text-muted-foreground">
              <b>{t("Your note:")}</b> {q.customerNote}
            </p>
          )}

          {q.canRespond && (
            <Card>
              <CardContent className="space-y-3 p-5">
                <Label htmlFor="quote-note">{t("Anything to add? (optional)")}</Label>
                <textarea
                  id="quote-note"
                  rows={2}
                  maxLength={1000}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder={t("e.g. delivery date, or why it doesn't work for you")}
                />
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => answer("accept")} disabled={answering}>
                    <Check className="mr-1.5 h-4 w-4" /> {t("Accept quote")}
                  </Button>
                  <Button variant="outline" onClick={() => answer("decline")} disabled={answering}>
                    <X className="mr-1.5 h-4 w-4" /> {t("Decline")}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">{t("When you accept, the shop confirms the order and delivery with you.")}</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </AccountShell>
  );
}
