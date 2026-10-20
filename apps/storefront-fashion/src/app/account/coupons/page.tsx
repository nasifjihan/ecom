"use client";

/** My coupons: the codes I can use now (with what each gives and how many uses I have left), and the orders that used one. */
import Link from "next/link";
import { Copy, Ticket } from "lucide-react";
import { Button, msg, toast, useT } from "@ecom/storefront-base";
import { AccountShell, formatBDT, formatDate } from "../_components";
import { useMyCouponsQuery } from "@/lib/promotions";

export default function MyCouponsPage() {
  const { data, isLoading } = useMyCouponsQuery();
  const t = useT();

  const copy = (code: string) =>
    void navigator.clipboard.writeText(code).then(
      () => toast.success(t("Copied {code}", { code })),
      () => toast.error(t("Couldn't copy. Type the code at checkout.")),
    );

  return (
    <AccountShell title={msg("My coupons")} description={msg("Codes you can use at checkout, and the orders that used one.")}>
      {isLoading || !data ? (
        <div className="h-40 animate-pulse rounded-xl bg-muted" />
      ) : (
        <div className="space-y-8">
          <section className="space-y-3">
            <h2 className="font-semibold">{t("Usable now")}</h2>
            {data.usable.length === 0 ? (
              <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                <Ticket className="mx-auto mb-2 h-6 w-6" />
                {t("No coupons for you right now. Offers you get by email or SMS will show here too.")}
              </div>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {data.usable.map((c) => (
                  <li key={c.code} className="flex flex-col gap-2 rounded-xl border bg-card p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-mono text-lg font-bold tracking-wide">{c.code}</p>
                        <p className="text-sm font-medium">{c.summary}</p>
                      </div>
                      <Button type="button" size="sm" variant="outline" className="gap-1" onClick={() => copy(c.code)} aria-label={t("Copy {code}", { code: c.code })}>
                        <Copy className="h-3.5 w-3.5" /> {t("Copy")}
                      </Button>
                    </div>
                    {c.description && <p className="text-xs text-muted-foreground">{c.description}</p>}
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      {c.forYou && <span className="rounded bg-primary/10 px-1.5 font-medium text-primary">{t("For you")}</span>}
                      {c.minSubtotal ? <span>{t("on orders over {amount}", { amount: formatBDT(c.minSubtotal) })}</span> : null}
                      {c.expiresAt && <span>{t("until {date}", { date: formatDate(c.expiresAt) })}</span>}
                      {c.usesLeft !== null && <span>{c.usesLeft === 1 ? t("1 use left") : t("{n} uses left", { n: c.usesLeft })}</span>}
                      {!c.worksWithPromotions && <span>{t("not with other offers")}</span>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="font-semibold">{t("Used")}</h2>
            {data.used.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("You haven't used a coupon yet.")}</p>
            ) : (
              <ul className="divide-y rounded-xl border">
                {data.used.map((u) => (
                  <li key={u.orderNumber} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                    <span>
                      <span className="font-mono font-semibold">{u.code}</span>{" "}
                      <span className="text-muted-foreground">
                        {t("on order")}{" "}
                        <Link href={`/account/orders/${u.orderNumber}`} className="text-primary hover:underline">
                          {u.orderNumber}
                        </Link>
                        , {formatDate(u.date)}
                      </span>
                    </span>
                    {u.discount > 0 && <span className="font-medium tabular-nums">−{formatBDT(u.discount)}</span>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </AccountShell>
  );
}
