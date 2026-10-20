"use client";

/**
 * Where Google and Facebook send the customer back (with ?code=&state=, or ?error= when they
 * cancelled). The state must be the one this tab started with, so nobody can sign someone in to
 * an account that isn't theirs with a link of their own.
 */
import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Card, CardContent, apiErrorMessage, toast, useT } from "@ecom/storefront-base";
import { useAppDispatch } from "@/lib/store";
import { fullName, signIn, useFinishSocialLoginMutation } from "@/lib/account";
import { OAUTH_STATE_KEY } from "../../login/social-buttons";
import { safeNext } from "../../_components";

export default function OAuthCallbackPage() {
  const router = useRouter();
  const params = useSearchParams();
  const dispatch = useAppDispatch();
  const [finish] = useFinishSocialLoginMutation();
  const [error, setError] = React.useState<string | null>(null);
  const started = React.useRef(false);
  const t = useT();

  React.useEffect(() => {
    if (started.current) return; // once, even when React runs effects twice
    started.current = true;
    const code = params.get("code");
    const state = params.get("state");
    let mine: string | null = null;
    try {
      mine = sessionStorage.getItem(OAUTH_STATE_KEY);
      sessionStorage.removeItem(OAUTH_STATE_KEY);
    } catch {
      /* storage blocked: treated as not started here */
    }
    if (params.get("error") || !code || !state) {
      setError(t("Signing in was cancelled."));
      return;
    }
    if (state !== mine) {
      setError(t("That sign-in link has expired. Please try again."));
      return;
    }
    finish({ code, state })
      .unwrap()
      .then((r) => {
        signIn(dispatch, r);
        toast.success(r.created ? t("Welcome, {name}! Your account is ready.", { name: fullName(r.user) }) : t("Welcome back, {name}", { name: fullName(r.user) }));
        router.replace(safeNext(r.next));
      })
      .catch((err: unknown) => setError(apiErrorMessage(err, t("Couldn't sign you in. Please try again."))));
  }, [params, finish, dispatch, router, t]);

  return (
    <div className="container py-12 flex justify-center">
      <Card className="w-full max-w-md">
        <CardContent className="p-6 md:p-8 space-y-4 text-center">
          {error ? (
            <>
              <h1 className="text-2xl font-bold">{t("Couldn't sign you in")}</h1>
              <p role="alert" className="text-sm text-muted-foreground">
                {error}
              </p>
              <Button asChild className="w-full">
                <Link href="/account/login">{t("Back to log in")}</Link>
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {t("Signing you in...")}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
