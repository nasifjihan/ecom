/**
 * SMS PROVIDERS — Bangladeshi bulk-SMS gateways, each behind the same `send(to, text, ref)`.
 *
 * Request shapes follow each provider's published API and open-source clients (see the Batch 24
 * journal entry). None of them could be reached from the development container, so they were
 * tested against scripts/mock-sms.mjs; check each with a real account before relying on it.
 *
 * - log         records the message only (nothing is sent) — for setting up and testing
 * - bulksmsbd   GET  https://bulksmsbd.net/api/smsapi  (api_key, senderid, number, message) → response_code 202
 * - alphasms    POST https://api.sms.net.bd/sendsms     (api_key, msg, to, sender_id?)       → error 0
 * - sslwireless POST https://smsplus.sslwireless.com/api/v3/send-sms (JSON api_token, sid, msisdn, sms, csms_id) → status_code 200
 *
 * `fetch` is injectable for tests; base URLs can point at a test server via env.
 */
import { env } from "../../config"

export type Fetch = typeof fetch

export const SMS_PROVIDERS = ["log", "bulksmsbd", "alphasms", "sslwireless"] as const
export type SmsProviderCode = (typeof SMS_PROVIDERS)[number]

export const SMS_PROVIDER_INFO: Record<
  SmsProviderCode,
  {
    name: string
    fields: { key: string; label: string; secret?: boolean }[]
    senderId: "required" | "optional" | "none"
  }
> = {
  log: { name: "Record only (nothing is sent)", fields: [], senderId: "none" },
  bulksmsbd: {
    name: "BulkSMSBD",
    fields: [{ key: "apiKey", label: "API key", secret: true }],
    senderId: "required",
  },
  alphasms: {
    name: "Alpha SMS (sms.net.bd)",
    fields: [{ key: "apiKey", label: "API key", secret: true }],
    senderId: "optional",
  },
  sslwireless: {
    name: "SSL Wireless (SMS Plus)",
    fields: [
      { key: "apiToken", label: "API token", secret: true },
      { key: "sid", label: "SID" },
    ],
    senderId: "none",
  },
}

export const isSmsProvider = (v: string): v is SmsProviderCode =>
  (SMS_PROVIDERS as readonly string[]).includes(v)

export class SmsError extends Error {}

export interface SmsResult {
  /** The provider's id for the message, when it gives one. */
  ref: string | null
  /** True when nothing was sent (the "log" provider). */
  logged?: boolean
}

export interface SmsProvider {
  send(to: string, text: string, ref: string): Promise<SmsResult>
}

/** "01712345678" -> "8801712345678", the form every provider accepts. */
export const intl = (local: string) => `88${local}`

const base = (v: string | undefined, fallback: string) =>
  (v?.trim() ? v.trim() : fallback).replace(/\/+$/, "")
const str = (v: unknown) => (typeof v === "string" || typeof v === "number" ? String(v) : "")

async function readJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text()
  try {
    const j: unknown = JSON.parse(text)
    return j && typeof j === "object" ? (j as Record<string, unknown>) : {}
  } catch {
    throw new SmsError(`The SMS provider answered ${res.status} with something that isn't JSON`)
  }
}

async function call(f: Fetch, url: string, init: RequestInit = {}) {
  try {
    return await f(url, { ...init, signal: AbortSignal.timeout(15_000) })
  } catch (e) {
    throw new SmsError(
      `Couldn't reach the SMS provider (${e instanceof Error ? e.message : "network error"})`,
    )
  }
}

class LogProvider implements SmsProvider {
  send(): Promise<SmsResult> {
    return Promise.resolve({ ref: null, logged: true })
  }
}

/** Fallback wording for BulkSMSBD error codes when the reply has no error_message. */
const BULKSMSBD_ERRORS: Record<string, string> = {
  "1001": "Invalid phone number",
  "1002": "The sender ID is wrong or not approved",
  "1003": "A required field is missing",
  "1005": "BulkSMSBD had an internal error",
  "1006": "The balance has expired",
  "1007": "Not enough SMS balance",
  "1011": "The account wasn't found",
  "1012": "Masked SMS to this number must be in Bangla",
  "1018": "The account is disabled",
  "1031": "The account isn't verified yet",
  "1032": "This server's IP address isn't whitelisted in BulkSMSBD",
}

class BulkSmsBdProvider implements SmsProvider {
  constructor(
    private readonly apiKey: string,
    private readonly senderId: string,
    private readonly f: Fetch,
  ) {}

  async send(to: string, text: string): Promise<SmsResult> {
    const q = new URLSearchParams({
      api_key: this.apiKey,
      type: "text",
      number: intl(to),
      senderid: this.senderId,
      message: text,
    })
    const res = await call(
      this.f,
      `${base(env.BULKSMSBD_API_URL, "https://bulksmsbd.net")}/api/smsapi?${q.toString()}`,
    )
    const j = await readJson(res)
    const code = str(j.response_code)
    if (code === "202") return { ref: null }
    throw new SmsError(
      str(j.error_message) ||
        (BULKSMSBD_ERRORS[code] ?? `BulkSMSBD refused the message (code ${code || res.status})`),
    )
  }
}

class AlphaSmsProvider implements SmsProvider {
  constructor(
    private readonly apiKey: string,
    private readonly senderId: string | null,
    private readonly f: Fetch,
  ) {}

  async send(to: string, text: string): Promise<SmsResult> {
    const body = new URLSearchParams({ api_key: this.apiKey, msg: text, to: intl(to) })
    if (this.senderId) body.set("sender_id", this.senderId)
    const res = await call(
      this.f,
      `${base(env.ALPHASMS_API_URL, "https://api.sms.net.bd")}/sendsms`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body,
      },
    )
    const j = await readJson(res)
    if (str(j.error) === "0") {
      const data = j.data && typeof j.data === "object" ? (j.data as Record<string, unknown>) : {}
      return { ref: str(data.request_id) || null }
    }
    throw new SmsError(str(j.msg) || `Alpha SMS refused the message (${res.status})`)
  }
}

class SslWirelessProvider implements SmsProvider {
  constructor(
    private readonly apiToken: string,
    private readonly sid: string,
    private readonly f: Fetch,
  ) {}

  async send(to: string, text: string, ref: string): Promise<SmsResult> {
    const res = await call(
      this.f,
      `${base(env.SSLWIRELESS_API_URL, "https://smsplus.sslwireless.com")}/api/v3/send-sms`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          api_token: this.apiToken,
          sid: this.sid,
          msisdn: intl(to),
          sms: text,
          csms_id: ref,
        }),
      },
    )
    const j = await readJson(res)
    if (str(j.status_code) === "200" && str(j.status).toUpperCase() === "SUCCESS") {
      const info = Array.isArray(j.smsinfo)
        ? (j.smsinfo[0] as Record<string, unknown> | undefined)
        : undefined
      return { ref: str(info?.reference_id) || null }
    }
    throw new SmsError(
      str(j.error_message) ||
        `SSL Wireless refused the message (${str(j.status_code) || res.status})`,
    )
  }
}

/** The provider for stored settings; throws SmsError when a required key is missing. */
export function smsProvider(
  code: string,
  creds: Record<string, string>,
  senderId: string | null,
  f: Fetch = fetch,
): SmsProvider {
  const need = (k: string, label: string) => {
    const v = creds[k]?.trim()
    if (!v) throw new SmsError(`Add the ${label} in Settings → SMS`)
    return v
  }
  switch (code) {
    case "bulksmsbd":
      if (!senderId)
        throw new SmsError("Add the sender ID BulkSMSBD approved for you in Settings → SMS")
      return new BulkSmsBdProvider(need("apiKey", "BulkSMSBD API key"), senderId, f)
    case "alphasms":
      return new AlphaSmsProvider(need("apiKey", "Alpha SMS API key"), senderId, f)
    case "sslwireless":
      return new SslWirelessProvider(
        need("apiToken", "SSL Wireless API token"),
        need("sid", "SSL Wireless SID"),
        f,
      )
    default:
      return new LogProvider()
  }
}
