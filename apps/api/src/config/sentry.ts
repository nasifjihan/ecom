/**
 * Error reports to Sentry, only when SENTRY_DSN is set (nothing changes without it). Private
 * data is stripped before anything is sent (scrubEvent). The release is the image's commit.
 */
import * as Sentry from "@sentry/node"
import { scrubEvent } from "@ecom/utils"
import { env } from "./env"

let on = false

/** Call once at start-up; `role` tells the API, worker and backup reports apart. */
export function initSentry(role: "api" | "worker" | "backup") {
  if (!env.SENTRY_DSN || on) return
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    release: process.env.IMAGE_TAG,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    initialScope: { tags: { role } },
    beforeSend: (event) => scrubEvent(event),
  })
  on = true
}

/** Reports an error (no-op without SENTRY_DSN), with tags such as the request ID. */
export function reportError(err: unknown, tags: Record<string, string> = {}) {
  if (on) Sentry.captureException(err, { tags })
}
