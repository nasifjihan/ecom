/**
 * SMS rules with no I/O (table-tested in tests/unit/sms.test.ts): Bangladeshi mobile numbers,
 * message length in SMS parts, order-SMS templates and one-time sign-in codes.
 */
import { createHmac, randomInt, timingSafeEqual } from "node:crypto"

// ------------------------------------------------------------------ numbers

/** "+880 1712-345678", "8801712345678", "1712345678" -> "01712345678"; null if not a BD mobile. */
export function bdMobile(v: string | null | undefined): string | null {
  if (!v) return null
  const d = v.replace(/[^\d]/g, "").replace(/^(?:00)?880/, "0")
  const n = d.length === 10 && d.startsWith("1") ? `0${d}` : d
  return /^01[3-9]\d{8}$/.test(n) ? n : null
}

/** How a number may already be stored on a customer or order (for finding them by phone). */
export function phoneVariants(local: string): string[] {
  const rest = local.slice(1)
  return [local, `880${rest}`, `+880${rest}`, `+880 ${rest}`, `880 ${rest}`]
}

/** "01712345678" -> "017•••••678" for logs and messages to staff. */
export const maskPhone = (local: string) => `${local.slice(0, 3)}•••••${local.slice(-3)}`

// ------------------------------------------------------------------ length

/** Characters allowed in plain (GSM-7) SMS; anything else (Bangla, emoji) makes it Unicode. */
const GSM7 =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà"
const GSM7_EXT = "^{}\\[~]|€"

/** Parts an SMS is billed as: 160 / 153 per part for plain text, 70 / 67 for Unicode. */
export function smsParts(text: string): { unicode: boolean; length: number; parts: number } {
  const chars = Array.from(text)
  const unicode = chars.some((c) => !GSM7.includes(c) && !GSM7_EXT.includes(c))
  const length = unicode
    ? chars.length
    : chars.reduce((n, c) => n + (GSM7_EXT.includes(c) ? 2 : 1), 0)
  const [single, multi] = unicode ? [70, 67] : [160, 153]
  const parts = length === 0 ? 0 : length <= single ? 1 : Math.ceil(length / multi)
  return { unicode, length, parts }
}

/**
 * "Tk 4,588.50": the taka sign (৳) isn't in the plain SMS alphabet, and one such character
 * turns the whole message Unicode (70 characters a part instead of 160).
 */
export function smsMoney(n: number): string {
  const whole = Number.isInteger(Math.round(n * 100) / 100)
  return `Tk ${n.toLocaleString("en-US", { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 })}`
}

// ------------------------------------------------------------------ templates

export const SMS_EVENTS = [
  "order_placed",
  "order_confirmed",
  "order_shipped",
  "order_delivered",
  "order_cancelled",
] as const
export type SmsEvent = (typeof SMS_EVENTS)[number]

export const SMS_EVENT_INFO: Record<
  SmsEvent,
  { label: string; template: string; defaultOn: boolean }
> = {
  order_placed: {
    label: "Order placed",
    template: "Hi {name}, we got your order {order} ({total}). We'll call to confirm. - {store}",
    defaultOn: true,
  },
  order_confirmed: {
    label: "Order confirmed (Processing)",
    template: "Your order {order} is confirmed and being packed. - {store}",
    defaultOn: false,
  },
  order_shipped: {
    label: "Order shipped",
    template: "Your order {order} is on the way{courier}. {tracking} - {store}",
    defaultOn: true,
  },
  order_delivered: {
    label: "Order delivered",
    template: "Your order {order} was delivered. Thank you for shopping with {store}!",
    defaultOn: false,
  },
  order_cancelled: {
    label: "Order cancelled",
    template: "Your order {order} was cancelled. Questions? Call {phone}. - {store}",
    defaultOn: true,
  },
}

/** Which event an order status sends. */
export const STATUS_EVENTS: Record<string, SmsEvent> = {
  PROCESSING: "order_confirmed",
  SHIPPED: "order_shipped",
  DELIVERED: "order_delivered",
  CANCELLED: "order_cancelled",
}

export const TEMPLATE_VARS = [
  "name",
  "order",
  "total",
  "store",
  "phone",
  "courier",
  "tracking",
  "link",
] as const

export interface EventSetting {
  enabled: boolean
  template: string
}

/** Stored settings over the defaults: every event gets an on/off and a template. */
export function eventSettings(stored: unknown): Record<SmsEvent, EventSetting> {
  const s = (stored && typeof stored === "object" ? stored : {}) as Record<
    string,
    Partial<EventSetting>
  >
  return Object.fromEntries(
    SMS_EVENTS.map((e) => {
      const v = s[e] ?? {}
      return [
        e,
        {
          enabled: typeof v.enabled === "boolean" ? v.enabled : SMS_EVENT_INFO[e].defaultOn,
          template:
            typeof v.template === "string" && v.template.trim()
              ? v.template
              : SMS_EVENT_INFO[e].template,
        },
      ]
    }),
  ) as Record<SmsEvent, EventSetting>
}

/** Fills {name}, {order}… ; unknown placeholders are left as typed. Collapses doubled spaces. */
export function renderSms(
  template: string,
  vars: Partial<Record<(typeof TEMPLATE_VARS)[number], string>>,
): string {
  return template
    .replace(/\{(\w+)\}/g, (m, k: string) => (vars as Record<string, string | undefined>)[k] ?? m)
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([.,!])/g, "$1")
    .trim()
}

// ------------------------------------------------------------------ one-time codes

export const OTP_LENGTH = 6
export const OTP_TTL_MINUTES = 5
export const OTP_MAX_ATTEMPTS = 5
/** A new code for the same number: not within a minute, at most 5 an hour. */
export const OTP_RESEND_SECONDS = 60
export const OTP_PER_HOUR = 5

export const newOtp = () => String(randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, "0")

/** Keyed hash of a code, bound to the store and number, so a leaked table row is useless. */
export function hashOtp(secret: string, storeId: bigint, phone: string, code: string): string {
  return createHmac("sha256", secret).update(`${storeId}:${phone}:${code}`).digest("hex")
}

export function otpMatches(
  secret: string,
  storeId: bigint,
  phone: string,
  code: string,
  hash: string,
): boolean {
  const a = Buffer.from(hashOtp(secret, storeId, phone, code), "hex")
  const b = Buffer.from(hash, "hex")
  return a.length === b.length && timingSafeEqual(a, b)
}

export const otpMessage = (code: string, store: string) =>
  `${code} is your ${store} sign-in code. It expires in ${OTP_TTL_MINUTES} minutes. Don't share it with anyone.`

/** What the SMS log keeps instead of the code. */
export const maskOtp = (text: string, code: string) => text.split(code).join("••••••")

/**
 * Whether another code may be sent: `recent` are the send times for this number in the last hour.
 * Returns the seconds to wait, or 0.
 */
export function otpWait(recent: Date[], now = new Date()): number {
  const last = recent.reduce<Date | null>((m, d) => (!m || d > m ? d : m), null)
  if (last) {
    const since = (now.getTime() - last.getTime()) / 1000
    if (since < OTP_RESEND_SECONDS) return Math.ceil(OTP_RESEND_SECONDS - since)
  }
  const hourAgo = now.getTime() - 3600_000
  const inHour = recent
    .filter((d) => d.getTime() > hourAgo)
    .sort((a, b) => a.getTime() - b.getTime())
  if (inHour.length >= OTP_PER_HOUR)
    return Math.ceil((inHour[0]!.getTime() + 3600_000 - now.getTime()) / 1000)
  return 0
}
