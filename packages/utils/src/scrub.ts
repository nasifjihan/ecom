/**
 * Strips private data from an error report before it leaves our servers (Sentry's beforeSend in
 * the API and the three web apps): passwords, codes, tokens, keys, cookies, and customers'
 * phones and emails, wherever they sit in the event. The structure and everything else stay.
 */

/** Field names whose values are never sent. */
// "code" alone, not statusCode or an error code: those are what a report is for.
export const PRIVATE_KEY = /pass|secret|token|otp|^code$|backup.?codes?|login.?code|cookie|authorization|api[-_]?key|private|credential|signature|phone|mobile|email|card|cvv|nid/i

const MAX_DEPTH = 8
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g
// Bangladeshi mobiles (01XXXXXXXXX, +8801…) in free text such as error messages.
const BD_MOBILE = /(?:\+?88)?01[3-9]\d{8}/g

// A web address's query string (?token=…, ?code=…), wherever a URL appears.
const URL_QUERY = /(https?:\/\/[^\s?#"']+)\?[^\s#"']*/g

/** A string with emails, phone numbers and URL query strings masked. */
export function scrubText(s: string): string {
  return s.replace(URL_QUERY, "$1?[filtered]").replace(EMAIL, "[email]").replace(BD_MOBILE, "[phone]")
}

/** A copy of `value` with private fields replaced by "[filtered]" and text masked. */
export function scrub<T>(value: T, depth = 0): T {
  if (typeof value === "string") return scrubText(value) as T
  if (value === null || typeof value !== "object" || depth > MAX_DEPTH) return value
  if (Array.isArray(value)) return (value as unknown[]).map((v) => scrub(v, depth + 1)) as T
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = PRIVATE_KEY.test(k) ? "[filtered]" : scrub(v, depth + 1)
  }
  return out as T
}

/** The Sentry options every app uses: errors only (no tracing), never default personal data. */
export function sentryOptions(dsn: string, app: string, release?: string) {
  return {
    dsn,
    environment: process.env.NODE_ENV,
    release,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    initialScope: { tags: { app } },
    beforeSend: <E extends { user?: { id?: unknown } | null; request?: { query_string?: unknown } }>(event: E) => scrubEvent(event),
  }
}

/** Sentry's beforeSend: the event without private data; the user is kept by id only. */
export function scrubEvent<E extends { user?: { id?: unknown } | null; request?: { query_string?: unknown } }>(event: E): E {
  const clean = scrub(event)
  if (clean.user) clean.user = clean.user.id === undefined ? undefined : { id: clean.user.id }
  // Query strings can carry tokens and codes (?token=…, ?code=…): drop them.
  if (clean.request?.query_string) clean.request.query_string = "[filtered]"
  return clean
}
