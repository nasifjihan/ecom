"use client";

/** My quotes: price offers from the shop, and quotes I asked for. */
import Link from "next/link";
import { FileText } from "lucide-react";
import { Button, Card, CardContent, Skeleton, cn, msg, useT } from "@ecom/storefront-base";
import { AccountShell, formatBDT, formatDate } from "../_components";
import { QUOTE_STATUS_TONE, QUOTE_STATUS_WORDS, useMyQuotesQuery } from "@/lib/quotes";

export default function QuotesPage() {
  const t = useT();
  const { data, isLoading, isError } = useMyQuotesQuery();
  return (
    <AccountShell title={msg("Quotes")} description={msg("Price offers from the shop for larger orders.")}>
      {isLoading ? (
        <Skeleton className="h-40 w-full rounded-xl" />
      ) : isError || !data ? (
        <p className="text-sm text-destructive">{t("Couldn't load your quotes. Please refresh the page.")}</p>
      ) : data.length === 0 ? (
        <Card>
          <CardContent className="space-y-3 p-10 text-center">
            <FileText className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="font-medium">{t("No quotes yet.")}</p>
            <p className="text-sm text-muted-foreground">{t("Business accounts can ask for a quote from their cart.")}</p>
            <Button asChild variant="outline">
              <Link href="/cart">{t("Go to cart")}</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {data.map((q) => (
            <Link key={q.id} href={`/account/quotes/${q.number}`} className="block">
              <Card className="transition-colors hover:border-primary/40">
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{q.number}</p>
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", QUOTE_STATUS_TONE[q.status])}>{t(QUOTE_STATUS_WORDS[q.status])}</span>
                    </div>
                    <p className="truncate text-sm text-muted-foreground">
                      {q.items[0]?.name}
                      {q.items.length > 1 ? ` ${t("and {n} more", { n: q.items.length - 1 })}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {q.status === "SENT" && q.validUntil ? t("Valid until {date}", { date: formatDate(q.validUntil) }) : formatDate(q.sentAt ?? q.createdAt)}
                    </p>
                  </div>
                  <p className="font-semibold tabular-nums">{formatBDT(q.total)}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </AccountShell>
  );
}
