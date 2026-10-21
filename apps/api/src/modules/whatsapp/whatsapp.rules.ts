/**
 * WhatsApp rules with no I/O (table-tested in tests/unit/whatsapp.test.ts): numbers, which
 * template each order event sends and with which values, webhook signatures and statuses.
 *
 * Meta only lets a business start a conversation with an approved template, so each event names
 * a template the shop created in WhatsApp Manager; its {{1}}, {{2}}… are filled from the order.
 */
import { createHmac, timingSafeEqual } from "node:crypto"
import { bdMobile } from "../sms/sms.rules"

export const WA_EVENTS = [
  "order_placed",
  "order_confirmed",
  "order_shipped",
  "order_delivered",
  "order_cancelled",
] as const
export type WaEvent = (typeof WA_EVENTS)[number]

/** The values a template gets, in order ({{1}}, {{2}}, …), as the admin shows them. */
export const WA_EVENT_INFO: Record<WaEvent, { label: string; template: string; params: WaVar[] }> =
  {
    order_placed: {
      label: "Order placed",
      template: "order_placed",
      params: ["name", "order", "total", "store"],
    },
    order_confirmed: {
      label: "Order confirmed (Processing)",
      template: "order_confirmed",
      params: ["name", "order", "store"],
    },
    order_shipped: {
      label: "Order shipped",
      template: "order_shipped",
      params: ["name", "order", "courier", "tracking"],
    },
    order_delivered: {
      label: "Order delivered",
      template: "order_delivered",
      params: ["name", "order", "store"],
    },
    order_cancelled: {
      label: "Order cancelled",
      template: "order_cancelled",
      params: ["name", "order", "phone"],
    },
  }

export type WaVar = "name" | "order" | "total" | "store" | "phone" | "courier" | "tracking" | "link"
export const WA_VAR_LABELS: Record<WaVar, string> = {
  name: "customer's first name",
  order: "order number",
  total: "order total",
  store: "shop name",
  phone: "shop phone",
  courier: "courier name",
  tracking: "tracking link or number",
  link: "order page link",
}

export const WA_LANGUAGES = ["en", "en_US", "bn"] as const
export type WaLanguage = (typeof WA_LANGUAGES)[number]

export interface WaEventSetting {
  enabled: boolean
  template: string
  language: WaLanguage
}

/** Stored settings over the defaults: every event gets on/off, a template name and a language. */
export function waEventSettings(stored: unknown): Record<WaEvent, WaEventSetting> {
  const s = (stored && typeof stored === "object" ? stored : {}) as Record<
    string,
    Partial<WaEventSetting>
  >
  return Object.fromEntries(
    WA_EVENTS.map((e) => {
      const v = s[e] ?? {}
      return [
        e,
        {
          enabled: v.enabled === true,
          template:
            typeof v.template === "string" && TEMPLATE_NAME.test(v.template)
              ? v.template
              : WA_EVENT_INFO[e].template,
          language: (WA_LANGUAGES as readonly string[]).includes(v.language ?? "")
            ? v.language!
            : "en",
        },
      ]
    }),
  ) as Record<WaEvent, WaEventSetting>
}

/** Meta's template names: lower-case letters, digits and underscores. */
export const TEMPLATE_NAME = /^[a-z0-9_]{1,512}$/

/** A Bangladeshi mobile in WhatsApp's form (8801712345678), or null. */
export function waNumber(v: string | null | undefined): string | null {
  const local = bdMobile(v)
  return local ? `88${local}` : null
}

/** The template values for an event, from the order's details. Empty values become "-" (Meta refuses blanks). */
export function waParams(event: WaEvent, vars: Partial<Record<WaVar, string>>): string[] {
  return WA_EVENT_INFO[event].params.map((k) => {
    const v = (vars[k] ?? "").trim()
    return v ? v.slice(0, 1000) : "-"
  })
}

/** Meta signs each webhook with the app secret: X-Hub-Signature-256: sha256=<hex of HMAC-SHA256(raw body)>. */
export function signatureOk(
  appSecret: string,
  rawBody: Buffer | string,
  header: string | undefined,
): boolean {
  if (!header?.startsWith("sha256=")) return false
  const want = createHmac("sha256", appSecret).update(rawBody).digest()
  const got = Buffer.from(header.slice(7), "hex")
  return got.length === want.length && timingSafeEqual(got, want)
}

/** A message's status from Meta's webhook, ranked so a late "sent" never undoes "read". */
export const WA_STATUS_RANK: Record<string, number> = {
  logged: 0,
  sending: 0,
  sent: 1,
  delivered: 2,
  read: 3,
  failed: 4,
}

export function nextStatus(current: string, incoming: string): string {
  if (!(incoming in WA_STATUS_RANK)) return current
  return (WA_STATUS_RANK[incoming] ?? 0) > (WA_STATUS_RANK[current] ?? 0) ? incoming : current
}

export interface WaStatusUpdate {
  phoneNumberId: string
  ref: string
  status: string
  error: string | null
}

/** The message statuses in a webhook payload (anything else, e.g. incoming chats, is ignored). */
export function statusUpdates(payload: unknown): WaStatusUpdate[] {
  const entries = (payload as { entry?: unknown[] } | null)?.entry
  if (!Array.isArray(entries)) return []
  const out: WaStatusUpdate[] = []
  for (const entry of entries) {
    const changes = (entry as { changes?: unknown[] }).changes
    if (!Array.isArray(changes)) continue
    for (const ch of changes) {
      const value = (ch as { value?: Record<string, unknown> }).value ?? {}
      const phoneNumberId = String(
        (value.metadata as { phone_number_id?: string } | undefined)?.phone_number_id ?? "",
      )
      const statuses = Array.isArray(value.statuses)
        ? (value.statuses as Record<string, unknown>[])
        : []
      for (const s of statuses) {
        const errors = Array.isArray(s.errors)
          ? (s.errors as { title?: string; message?: string }[])
          : []
        out.push({
          phoneNumberId,
          ref: typeof s.id === "string" ? s.id : "",
          status: typeof s.status === "string" ? s.status : "",
          error: errors.length ? (errors[0]!.message ?? errors[0]!.title ?? "Failed") : null,
        })
      }
    }
  }
  return out.filter((u) => u.ref && u.status)
}
