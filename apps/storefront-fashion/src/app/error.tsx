"use client";

/** A page crashed while showing: a friendly page instead of a blank one, with a way to carry on. */
import * as React from "react";
import Link from "next/link";
import { Button, useT } from "@ecom/storefront-base";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useT();
  React.useEffect(() => {
    console.error(error);
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) void import("@sentry/nextjs").then((S) => S.captureException(error));
  }, [error]);

  return (
    <div className="container flex flex-col items-center py-20 text-center">
      <p className="text-6xl font-black text-primary">500</p>
      <h1 className="mt-4 text-2xl font-bold">{t("Something went wrong")}</h1>
      <p className="mt-2 max-w-md text-muted-foreground">{t("This page couldn't be shown. Your cart is safe. Please try again in a moment.")}</p>
      <div className="mt-6 flex gap-2">
        <Button onClick={reset}>{t("Try again")}</Button>
        <Button asChild variant="outline">
          <Link href="/">{t("Home")}</Link>
        </Button>
      </div>
      {error.digest && <p className="mt-6 text-xs text-muted-foreground">{t("Error code: {code}", { code: error.digest })}</p>}
    </div>
  );
}
