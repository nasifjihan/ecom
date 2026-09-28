"use client";

/** The customer's wallet: balance, cashback, loyalty level and every credit and debit. */
import { Award, Coins, Wallet } from "lucide-react";
import { AccountShell, formatBDT, formatDate } from "../_components";
import { WALLET_KIND_LABELS, useMyLoyaltyQuery } from "@/lib/loyalty";

export default function WalletPage() {
  const { data, isLoading } = useMyLoyaltyQuery();
  const pctToNext = data?.next ? Math.min(100, Math.round((data.spend / data.next.minSpend) * 100)) : 100;

  return (
    <AccountShell title="Wallet" description="Money from cashback, refunds and rewards, to use on your next order.">
      {isLoading || !data ? (
        <div className="h-40 animate-pulse rounded-xl bg-muted" />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border bg-card p-5">
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Wallet className="h-4 w-4" /> Balance
              </p>
              <p className="mt-1 text-3xl font-bold tabular-nums">{formatBDT(data.wallet.balance)}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                {data.wallet.enabled
                  ? `Tick "Pay from my wallet" at checkout${data.wallet.maxPercent < 100 ? ` (up to ${data.wallet.maxPercent}% of an order)` : ""}.`
                  : "The shop isn't taking wallet payments at the moment."}
              </p>
            </div>
            <div className="rounded-xl border bg-card p-5">
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Coins className="h-4 w-4" /> Cashback
              </p>
              {data.cashback.enabled && data.cashback.percent > 0 ? (
                <>
                  <p className="mt-1 text-3xl font-bold">{data.cashback.percent}%</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Of what you buy, added to your wallet when the order is delivered
                    {data.cashback.minOrder > 0 ? ` (orders from ${formatBDT(data.cashback.minOrder)})` : ""}
                    {data.cashback.maxPerOrder ? `, up to ${formatBDT(data.cashback.maxPerOrder)} an order` : ""}.
                  </p>
                </>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">No cashback running right now.</p>
              )}
            </div>
          </div>

          {data.level && (
            <div className="rounded-xl border bg-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-2 font-semibold">
                  <Award className="h-5 w-5" style={{ color: data.level.color ?? undefined }} /> {data.level.name} member
                </p>
                <p className="text-sm text-muted-foreground">
                  {[
                    data.level.discountPercent > 0 && `${data.level.discountPercent}% off every order`,
                    data.level.cashbackPercent > 0 && `+${data.level.cashbackPercent}% cashback`,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "Our thanks for shopping with us"}
                </p>
              </div>
              {data.next && (
                <div className="mt-4 space-y-1.5">
                  <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pctToNext} aria-valuemin={0} aria-valuemax={100} aria-label={`Progress to ${data.next.name}`}>
                    <div className="h-full rounded-full bg-primary" style={{ width: `${pctToNext}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatBDT(data.next.needed)} more on delivered orders to reach <b>{data.next.name}</b>.
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="rounded-xl border bg-card">
            <h2 className="border-b px-5 py-3 font-semibold">History</h2>
            {!data.history.length ? (
              <p className="p-5 text-sm text-muted-foreground">Nothing yet. Cashback and rewards will show up here.</p>
            ) : (
              <ul className="divide-y">
                {data.history.map((h) => (
                  <li key={h.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium">{WALLET_KIND_LABELS[h.kind] ?? h.kind}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {formatDate(h.at)}
                        {h.note ? ` · ${h.note}` : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={h.amount > 0 ? "font-semibold text-green-700" : "font-semibold"}>
                        {h.amount > 0 ? "+" : "−"}
                        {formatBDT(Math.abs(h.amount))}
                      </p>
                      <p className="text-xs text-muted-foreground">Balance {formatBDT(h.balanceAfter)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </AccountShell>
  );
}
