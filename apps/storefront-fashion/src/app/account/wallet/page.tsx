"use client";

/** The customer's wallet: balance, cashback, loyalty level and every credit and debit. */
import { Award, Coins, Wallet } from "lucide-react";
import { msg, useT } from "@ecom/storefront-base";
import { AccountShell, formatBDT, formatDate } from "../_components";
import { WALLET_KIND_LABELS, useMyLoyaltyQuery } from "@/lib/loyalty";

export default function WalletPage() {
  const { data, isLoading } = useMyLoyaltyQuery();
  const t = useT();
  const pctToNext = data?.next ? Math.min(100, Math.round((data.spend / data.next.minSpend) * 100)) : 100;

  return (
    <AccountShell title={msg("Wallet")} description={msg("Money from cashback, refunds and rewards, to use on your next order.")}>
      {isLoading || !data ? (
        <div className="h-40 animate-pulse rounded-xl bg-muted" />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border bg-card p-5">
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Wallet className="h-4 w-4" /> {t("Balance")}
              </p>
              <p className="mt-1 text-3xl font-bold tabular-nums">{formatBDT(data.wallet.balance)}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                {data.wallet.enabled
                  ? data.wallet.maxPercent < 100
                    ? t("Tick “Pay from my wallet” at checkout (up to {percent}% of an order).", { percent: data.wallet.maxPercent })
                    : t("Tick “Pay from my wallet” at checkout.")
                  : t("The shop isn't taking wallet payments at the moment.")}
              </p>
            </div>
            <div className="rounded-xl border bg-card p-5">
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Coins className="h-4 w-4" /> {t("Cashback")}
              </p>
              {data.cashback.enabled && data.cashback.percent > 0 ? (
                <>
                  <p className="mt-1 text-3xl font-bold">{data.cashback.percent}%</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {t("Of what you buy, added to your wallet when the order is delivered")}
                    {data.cashback.minOrder > 0 ? ` ${t("(orders from {amount})", { amount: formatBDT(data.cashback.minOrder) })}` : ""}
                    {data.cashback.maxPerOrder ? t(", up to {amount} an order", { amount: formatBDT(data.cashback.maxPerOrder) }) : ""}
                    {t(".")}
                  </p>
                </>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">{t("No cashback running right now.")}</p>
              )}
            </div>
          </div>

          {data.level && (
            <div className="rounded-xl border bg-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-2 font-semibold">
                  <Award className="h-5 w-5" style={{ color: data.level.color ?? undefined }} /> {t("{level} member", { level: data.level.name })}
                </p>
                <p className="text-sm text-muted-foreground">
                  {[
                    data.level.discountPercent > 0 && t("{percent}% off every order", { percent: data.level.discountPercent }),
                    data.level.cashbackPercent > 0 && t("+{percent}% cashback", { percent: data.level.cashbackPercent }),
                  ]
                    .filter(Boolean)
                    .join(" · ") || t("Our thanks for shopping with us")}
                </p>
              </div>
              {data.next && (
                <div className="mt-4 space-y-1.5">
                  <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pctToNext} aria-valuemin={0} aria-valuemax={100} aria-label={t("Progress to {level}", { level: data.next.name })}>
                    <div className="h-full rounded-full bg-primary" style={{ width: `${pctToNext}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("{amount} more on delivered orders to reach {level}.", { amount: formatBDT(data.next.needed), level: data.next.name })}
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="rounded-xl border bg-card">
            <h2 className="border-b px-5 py-3 font-semibold">{t("History")}</h2>
            {!data.history.length ? (
              <p className="p-5 text-sm text-muted-foreground">{t("Nothing yet. Cashback and rewards will show up here.")}</p>
            ) : (
              <ul className="divide-y">
                {data.history.map((h) => (
                  <li key={h.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium">{t(WALLET_KIND_LABELS[h.kind] ?? h.kind)}</p>
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
                      <p className="text-xs text-muted-foreground">{t("Balance {amount}", { amount: formatBDT(h.balanceAfter) })}</p>
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
