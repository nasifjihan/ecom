"use client";

/**
 * "Continue with Google / Facebook": asks the API for the provider's sign-in address, keeps the
 * signed state in this tab (the callback page checks it is the same one), then goes there.
 */
import * as React from "react";
import { Button, apiErrorMessage, toast, useT } from "@ecom/storefront-base";
import { useStartSocialLoginMutation } from "@/lib/account";

export const OAUTH_STATE_KEY = "oauthState";
type Provider = "google" | "facebook";

export function SocialButtons({ google, facebook, testMode, next }: { google: boolean; facebook: boolean; testMode: boolean; next: string }) {
  const [start] = useStartSocialLoginMutation();
  const [busy, setBusy] = React.useState<Provider | null>(null);
  const t = useT();
  if (!google && !facebook) return null;

  const go = async (provider: Provider) => {
    setBusy(provider);
    try {
      const r = await start({ provider, next }).unwrap();
      try {
        sessionStorage.setItem(OAUTH_STATE_KEY, r.state);
      } catch {
        /* storage blocked: the callback page will ask to try again */
      }
      window.location.assign(r.url);
    } catch (err) {
      setBusy(null);
      toast.error(apiErrorMessage(err, t("Couldn't start signing in. Please try again.")));
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 text-xs uppercase text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        {t("or")}
        <span className="h-px flex-1 bg-border" />
      </div>
      {(
        [
          ["google", google, t("Continue with Google"), "G", "text-[#4285F4]"],
          ["facebook", facebook, t("Continue with Facebook"), "f", "text-[#1877F2]"],
        ] as const
      )
        .filter(([, on]) => on)
        .map(([p, , label, mark, color]) => (
          <Button key={p} type="button" variant="outline" className="w-full gap-2" disabled={busy !== null} onClick={() => void go(p)}>
            <span aria-hidden className={`text-base font-bold leading-none ${color}`}>
              {mark}
            </span>
            {busy === p ? t("Opening...") : label}
            {testMode && <span className="text-xs text-muted-foreground">({t("test")})</span>}
          </Button>
        ))}
    </div>
  );
}
