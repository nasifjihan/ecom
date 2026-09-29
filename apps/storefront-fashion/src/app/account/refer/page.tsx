"use client";

/** Refer a friend: the customer's link to share, what each side gets, and friends who joined. */
import * as React from "react";
import { Copy, Gift, MessageCircle, Share2 } from "lucide-react";
import { Button, Input, msg, toast, useT } from "@ecom/storefront-base";
import { AccountShell, formatBDT, formatDate } from "../_components";
import { useMyReferralQuery } from "@/lib/loyalty";

const STATUS: Record<string, string> = {
  signed_up: msg("Joined, no order yet"),
  ordered: msg("Ordered, waiting for delivery"),
  rewarded: msg("Rewarded"),
};

export default function ReferPage() {
  const { data, isLoading } = useMyReferralQuery();
  const t = useT();
  const [origin, setOrigin] = React.useState("");
  React.useEffect(() => setOrigin(window.location.origin), []);
  const link = data?.code ? `${origin}/?ref=${data.code}` : "";
  const message = data
    ? t("Shop with my link and get {amount} in your wallet on your first order: {link}", { amount: formatBDT(data.friendGets), link })
    : "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success(t("Link copied"));
    } catch {
      toast.error(t("Couldn't copy; select the link and copy it"));
    }
  };
  const share = async () => {
    if (navigator.share) await navigator.share({ text: message }).catch(() => undefined);
    else await copy();
  };

  return (
    <AccountShell title={msg("Refer a friend")} description={msg("Share your link. When a friend's first order is delivered, you both get money in your wallets.")}>
      {isLoading || !data ? (
        <div className="h-40 animate-pulse rounded-xl bg-muted" />
      ) : !data.enabled ? (
        <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">{t("Referrals aren't running right now. Check back soon.")}</div>
      ) : (
        <div className="space-y-6">
          <div className="rounded-xl border bg-card p-5">
            <p className="flex items-center gap-2 font-semibold">
              <Gift className="h-5 w-5 text-primary" /> {t("You get {you}, your friend gets {friend}", { you: formatBDT(data.youGet), friend: formatBDT(data.friendGets) })}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {data.minOrder > 0
                ? t("For friends who are new to the shop, once their first order of {amount} or more is delivered.", { amount: formatBDT(data.minOrder) })
                : t("For friends who are new to the shop, once their first order is delivered.")}
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Input readOnly value={link} aria-label={t("Your referral link")} onFocus={(e) => e.currentTarget.select()} />
              <div className="flex gap-2">
                <Button variant="outline" onClick={copy}>
                  <Copy className="mr-1.5 h-4 w-4" /> {t("Copy")}
                </Button>
                <Button variant="outline" asChild>
                  <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="mr-1.5 h-4 w-4" /> WhatsApp
                  </a>
                </Button>
                <Button onClick={share}>
                  <Share2 className="mr-1.5 h-4 w-4" /> {t("Share")}
                </Button>
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {t("Your code:")} <b className="font-mono">{data.code}</b>
            </p>
          </div>

          <div className="rounded-xl border bg-card">
            <div className="flex items-center justify-between border-b px-5 py-3">
              <h2 className="font-semibold">{t("Friends")}</h2>
              <p className="text-sm text-muted-foreground">{t("Earned {amount}", { amount: formatBDT(data.earned) })}</p>
            </div>
            {!data.friends.length ? (
              <p className="p-5 text-sm text-muted-foreground">{t("No friends have joined with your link yet.")}</p>
            ) : (
              <ul className="divide-y">
                {data.friends.map((f, i) => (
                  <li key={i} className="flex items-center justify-between px-5 py-3 text-sm">
                    <span>
                      <span className="font-medium">{f.name}</span>
                      <span className="block text-xs text-muted-foreground">{formatDate(f.at)}</span>
                    </span>
                    <span className={f.status === "rewarded" ? "font-medium text-green-700" : "text-muted-foreground"}>
                      {f.status === "rewarded" ? `+${formatBDT(f.reward)}` : t(STATUS[f.status] ?? f.status)}
                    </span>
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
