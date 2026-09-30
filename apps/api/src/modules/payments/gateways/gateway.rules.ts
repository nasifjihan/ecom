/**
 * Online payment rules with no I/O (table-tested in tests/unit/online-payments.test.ts).
 */
import { randomBytes } from "node:crypto"
import type { GatewayResult, OnlineGatewayCode } from "./gateway.adapters"

/** Gateways that take payments online here. Nagad, Rocket and cards aren't connected yet. */
export const ONLINE_GATEWAYS: readonly OnlineGatewayCode[] = ["bkash", "sslcommerz"]
export const isOnlineGateway = (code: string): code is OnlineGatewayCode =>
  (ONLINE_GATEWAYS as readonly string[]).includes(code)

/**
 * Whether customers can pick a payment method: cash on delivery and hand-checked methods always;
 * an online one only when it's bKash / SSLCommerz with keys saved.
 */
export function methodUsable(
  g: { code: string; mode: string; secrets: string | null },
  manualCapable: boolean,
): boolean {
  if (g.code === "cod" || g.code === "bank_transfer") return true
  if (g.mode === "manual") return manualCapable
  return isOnlineGateway(g.code) && Boolean(g.secrets)
}

/** Our code for one try at paying an order: its number and a random tail ("FBD-1042-K7Q2XM"). */
export function attemptCode(orderNumber: string): string {
  const tail = randomBytes(5)
    .toString("base64url")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase()
    .slice(0, 6)
    .padEnd(6, "X")
  return `${orderNumber.replace(/[^A-Za-z0-9-]/g, "").slice(0, 30)}-${tail}`
}

export interface Verdict {
  /** paid: mark the order paid. review: the gateway took money but something doesn't match; staff check. */
  status: "paid" | "review" | "failed" | "cancelled" | "pending"
  note: string | null
}

/**
 * What a gateway's answer means for a try. Paid only when the gateway says so for this very try
 * (our code), in taka, for the amount asked. Money taken with a different code or amount, or
 * flagged by the bank, goes to staff instead of marking the order paid.
 */
export function judge(attempt: { code: string; amount: number }, r: GatewayResult): Verdict {
  if (r.state !== "paid") return { status: r.state, note: r.state === "pending" ? null : r.message }
  const problems: string[] = []
  if (r.code !== null && r.code !== attempt.code)
    problems.push(`the gateway has it as ${r.code}, not ${attempt.code}`)
  if (r.currency !== null && r.currency !== "BDT") problems.push(`it was paid in ${r.currency}`)
  if (r.amount === null) problems.push("the gateway didn't say how much was paid")
  else if (Math.abs(r.amount - attempt.amount) > 0.009)
    problems.push(`৳${r.amount.toFixed(2)} was paid, ৳${attempt.amount.toFixed(2)} was due`)
  if (r.risky) problems.push("the bank flagged the payment as risky")
  if (problems.length)
    return {
      status: "review",
      note: `Paid, but ${problems.join("; ")}. Check it in the gateway's panel.`,
    }
  return { status: "paid", note: null }
}

/** A try that's finished can't change (a paid one stays paid whatever arrives later). */
export const isFinal = (status: string) => ["paid", "review"].includes(status)

/**
 * Where the customer goes back to on the storefront: the address the checkout came from when it's
 * one of the store's own (never anywhere else), else the store's first address.
 */
export function storefrontOrigin(
  origin: string | null | undefined,
  hosts: string[],
  fallback: string,
): string {
  if (origin) {
    try {
      const u = new URL(origin)
      const host = u.host.toLowerCase().replace(/^www\./, "")
      if ((u.protocol === "https:" || u.protocol === "http:") && hosts.includes(host))
        return `${u.protocol}//${u.host}`
    } catch {
      // not a URL: use the fallback
    }
  }
  return fallback.replace(/\/$/, "")
}

/** "abcd1234wxyz" -> "abcd••••wxyz", for showing that a key is set. */
export function maskKey(v: string | undefined): string | null {
  if (!v) return null
  return v.length <= 8 ? "••••" : `${v.slice(0, 4)}••••${v.slice(-4)}`
}

/** The gateway's answer without anything that looks like a key, for storing. */
export function scrub(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(raw)) {
    if (/pass|secret|token|store_id|app_?key|signature|verify_sign|verify_key/i.test(k)) continue
    out[k] = typeof v === "string" ? v.slice(0, 500) : v
  }
  return out
}
