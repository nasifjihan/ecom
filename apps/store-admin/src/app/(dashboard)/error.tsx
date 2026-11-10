"use client";

/** An admin page crashed while showing: keep the menu, say so, and offer another try. */
import * as React from "react";
import { Button } from "@ecom/ui";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  React.useEffect(() => {
    console.error(error);
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) void import("@sentry/nextjs").then((S) => S.captureException(error));
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-xl font-semibold">This page couldn&apos;t be shown</h1>
      <p className="max-w-md text-sm text-muted-foreground">Nothing was lost. Try again; if it keeps happening, tell support what you were doing.</p>
      {error.digest && <p className="text-xs text-muted-foreground">Error code: {error.digest}</p>}
      <div className="mt-2 flex gap-2">
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" onClick={() => (window.location.href = "/dashboard")}>
          Dashboard
        </Button>
      </div>
    </div>
  );
}
