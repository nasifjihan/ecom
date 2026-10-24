/**
 * Server-side error reports to Sentry, only when SENTRY_DSN is set. Private data is stripped
 * (scrubEvent in @ecom/utils). Next runs register() once when the server starts.
 */
import { sentryOptions } from "@ecom/utils";

export async function register() {
  if (!process.env.SENTRY_DSN || process.env.NEXT_RUNTIME !== "nodejs") return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.init(sentryOptions(process.env.SENTRY_DSN, "super-admin", process.env.IMAGE_TAG));
}

/** Errors while rendering a page or running a route on the server. */
export async function onRequestError(...args: Parameters<typeof import("@sentry/nextjs").captureRequestError>) {
  if (!process.env.SENTRY_DSN) return;
  (await import("@sentry/nextjs")).captureRequestError(...args);
}
