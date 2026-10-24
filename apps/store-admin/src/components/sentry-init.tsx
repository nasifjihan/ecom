"use client";

/**
 * Browser error reports to Sentry, only when NEXT_PUBLIC_SENTRY_DSN was set at build time.
 * Loaded after the page, so it adds nothing to the first load. Private data is stripped.
 */
import { useEffect } from "react";
import { sentryOptions } from "@ecom/utils";

export function SentryInit() {
  useEffect(() => {
    const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
    if (!dsn) return;
    void import("@sentry/nextjs").then((Sentry) => Sentry.init(sentryOptions(dsn, "store-admin-browser")));
  }, []);
  return null;
}
