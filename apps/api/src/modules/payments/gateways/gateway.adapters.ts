/**
 * ONLINE GATEWAYS — bKash Tokenized Checkout and SSLCommerz behind one interface.
 *
 * Request shapes follow each gateway's merchant documentation:
 *  - bKash Tokenized Checkout v1.2.0-beta: https://tokenized.pay.bka.sh/v1.2.0-beta (sandbox
 *    tokenized.sandbox.bka.sh). Grant a token with username/password headers and the app key and
 *    secret, then create a payment (the customer pays on bkashURL), and after the customer comes
 *    back, execute it; "payment/status" says how it ended when execute can't.
 *  - SSLCommerz v4: https://securepay.sslcommerz.com (sandbox sandbox.sslcommerz.com). Open a
 *    session (the customer pays on GatewayPageURL); a payment counts only once the validation API
 *    says VALID / VALIDATED for its val_id.
 * Nothing the browser sends is trusted: every "paid" comes from the gateway's own API.
 * Base URLs can be pointed elsewhere with BKASH_API_URL / SSLCOMMERZ_API_URL (a local mock).
 * `fetch` is injectable for unit tests.
 */
import { env } from "../../../config"

export type Fetch = typeof fetch
export type OnlineGatewayCode = "bkash" | "sslcommerz"

/** Keys and mode of one store's gateway (decrypted). */
export interface GatewayConfig {
  gateway: OnlineGatewayCode
  mode: "sandbox" | "live"
  credentials: Record<string, string>
}

export interface StartInput {
  /** Our code for this try (bKash merchantInvoiceNumber, SSLCommerz tran_id). */
  code: string
  amount: number
  /** Where the gateway sends the customer back (our API, which checks and then redirects). */
  returnUrl: string
  /** SSLCommerz only: where it posts its payment notice. */
  ipnUrl: string
  customer: { name: string; phone: string; email?: string | null; address: string; city: string }
  productName: string
  itemCount: number
}

export interface Started {
  /** The gateway's id for the payment (bKash paymentID, SSLCommerz sessionkey). */
  reference: string
  /** The page the customer pays on. */
  payUrl: string
}

/** What the gateway's API says about a payment. */
export interface GatewayResult {
  state: "paid" | "failed" | "cancelled" | "pending"
  /** Our code as the gateway has it (merchantInvoiceNumber / tran_id). */
  code: string | null
  amount: number | null
  currency: string | null
  /** bKash trxID, SSLCommerz bank_tran_id. */
  txnId: string | null
  /** SSLCommerz: risk_level 1 means the bank flagged it. */
  risky?: boolean
  message: string
  raw: Record<string, unknown>
}

export class GatewayError extends Error {
  constructor(
    message: string,
    readonly httpStatus?: number,
  ) {
    super(message)
  }
}

export interface OnlineGateway {
  /** Checks the keys; returns something to show. */
  test(): Promise<string>
  start(input: StartInput): Promise<Started>
  /** After the customer comes back: completes and checks the payment with the gateway. */
  confirm(input: {
    reference: string | null
    code: string
    valId?: string | null
  }): Promise<GatewayResult>
}

/** The keys each gateway needs, with labels for the admin form. */
export const GATEWAY_FIELDS: Record<
  OnlineGatewayCode,
  { key: string; label: string; secret?: boolean }[]
> = {
  bkash: [
    { key: "username", label: "Username" },
    { key: "password", label: "Password", secret: true },
    { key: "appKey", label: "App key" },
    { key: "appSecret", label: "App secret", secret: true },
  ],
  sslcommerz: [
    { key: "storeId", label: "Store ID" },
    { key: "storePassword", label: "Store password", secret: true },
  ],
}

const TIMEOUT_MS = 30_000

const str = (v: unknown): string =>
  typeof v === "string" || typeof v === "number" ? String(v) : ""
const numOrNull = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : Number(str(v))
  return str(v) !== "" && Number.isFinite(n) ? n : null
}
const baseUrl = (configured: string | undefined, fallback: string) =>
  (configured?.trim() ? configured.trim() : fallback).replace(/\/$/, "")

async function call(
  f: Fetch,
  url: string,
  init: {
    method?: string
    headers?: Record<string, string>
    json?: unknown
    form?: Record<string, string>
  },
): Promise<{ status: number; json: Record<string, unknown> }> {
  let res: Response
  try {
    res = await f(url, {
      method: init.method ?? "GET",
      headers: {
        Accept: "application/json",
        ...(init.json !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(init.form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
        ...init.headers,
      },
      body:
        init.json !== undefined
          ? JSON.stringify(init.json)
          : init.form
            ? new URLSearchParams(init.form).toString()
            : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (e) {
    const err = e as Error
    throw new GatewayError(
      err.name === "TimeoutError"
        ? "The payment gateway didn't answer in time"
        : `Couldn't reach the payment gateway (${err.message})`,
    )
  }
  const text = await res.text()
  let json: Record<string, unknown> = {}
  try {
    json = text ? (JSON.parse(text) as Record<string, unknown>) : {}
  } catch {
    json = { message: text.slice(0, 200) }
  }
  return { status: res.status, json }
}

const need = (c: Record<string, string>, keys: string[], name: string) => {
  const missing = keys.filter((k) => !c[k])
  if (missing.length) throw new GatewayError(`${name} keys are missing: ${missing.join(", ")}`)
}

// ===================================================================== bKash

/** Granted tokens by app key and mode; bKash asks merchants not to grant one per call. */
const bkashTokens = new Map<string, { token: string; expiresAt: number }>()

export class BkashGateway implements OnlineGateway {
  private readonly base: string
  constructor(
    private readonly cfg: GatewayConfig,
    private readonly f: Fetch = fetch,
  ) {
    need(cfg.credentials, ["username", "password", "appKey", "appSecret"], "bKash")
    this.base = baseUrl(
      env.BKASH_API_URL,
      cfg.mode === "live"
        ? "https://tokenized.pay.bka.sh/v1.2.0-beta"
        : "https://tokenized.sandbox.bka.sh/v1.2.0-beta",
    )
  }

  private get c() {
    return this.cfg.credentials as {
      username: string
      password: string
      appKey: string
      appSecret: string
    }
  }

  private message(json: Record<string, unknown>, fallback: string) {
    return str(json.statusMessage) || str(json.errorMessage) || str(json.message) || fallback
  }

  private async token(fresh = false): Promise<string> {
    const key = `${this.cfg.mode}:${this.c.appKey}:${this.c.username}`
    const cached = bkashTokens.get(key)
    if (!fresh && cached && cached.expiresAt > Date.now() + 60_000) return cached.token
    const { status, json } = await call(this.f, `${this.base}/tokenized/checkout/token/grant`, {
      method: "POST",
      headers: { username: this.c.username, password: this.c.password },
      json: { app_key: this.c.appKey, app_secret: this.c.appSecret },
    })
    const token = str(json.id_token)
    if (status !== 200 || !token)
      throw new GatewayError(this.message(json, "bKash refused the keys"), status)
    const seconds = numOrNull(json.expires_in) ?? 3600
    bkashTokens.set(key, { token, expiresAt: Date.now() + seconds * 1000 })
    return token
  }

  private async post(path: string, body: Record<string, unknown>) {
    const headers = async (fresh: boolean) => ({
      Authorization: await this.token(fresh),
      "X-App-Key": this.c.appKey,
    })
    let res = await call(this.f, `${this.base}${path}`, {
      method: "POST",
      headers: await headers(false),
      json: body,
    })
    // An expired or revoked token: grant a new one once.
    if (res.status === 401 || res.status === 403)
      res = await call(this.f, `${this.base}${path}`, {
        method: "POST",
        headers: await headers(true),
        json: body,
      })
    return res
  }

  async test() {
    await this.token(true)
    return `bKash ${this.cfg.mode === "live" ? "live" : "sandbox"} keys work`
  }

  async start(i: StartInput): Promise<Started> {
    const { status, json } = await this.post("/tokenized/checkout/create", {
      mode: "0011",
      payerReference: i.customer.phone || "0",
      callbackURL: i.returnUrl,
      amount: i.amount.toFixed(2),
      currency: "BDT",
      intent: "sale",
      merchantInvoiceNumber: i.code,
    })
    const paymentID = str(json.paymentID)
    const url = str(json.bkashURL)
    if (status !== 200 || str(json.statusCode) !== "0000" || !paymentID || !url)
      throw new GatewayError(this.message(json, "bKash didn't open the payment"), status)
    return { reference: paymentID, payUrl: url }
  }

  private result(json: Record<string, unknown>, fallbackCode: string): GatewayResult {
    const tx = str(json.transactionStatus)
    const state: GatewayResult["state"] =
      tx === "Completed"
        ? "paid"
        : tx === "Initiated" || tx === "Pending Authorized"
          ? "pending"
          : tx === "Cancelled"
            ? "cancelled"
            : "failed"
    return {
      state,
      code: str(json.merchantInvoiceNumber) || fallbackCode,
      amount: numOrNull(json.amount),
      currency: str(json.currency) || null,
      txnId: str(json.trxID) || null,
      message: state === "paid" ? "Paid" : this.message(json, tx || "Not paid"),
      raw: json,
    }
  }

  async confirm(i: { reference: string | null; code: string }): Promise<GatewayResult> {
    if (!i.reference) throw new GatewayError("No bKash payment to check")
    const exec = await this.post("/tokenized/checkout/execute", { paymentID: i.reference })
    if (
      exec.status === 200 &&
      str(exec.json.statusCode) === "0000" &&
      str(exec.json.transactionStatus) === "Completed"
    )
      return this.result(exec.json, i.code)
    // Execute refused (already executed, cancelled, failed …): ask how the payment ended.
    const q = await this.post("/tokenized/checkout/payment/status", { paymentID: i.reference })
    if (q.status !== 200 || !str(q.json.transactionStatus))
      throw new GatewayError(
        this.message(q.json, this.message(exec.json, "bKash couldn't say how the payment ended")),
        q.status,
      )
    const r = this.result(q.json, i.code)
    if (r.state === "cancelled") r.message = "Cancelled on bKash"
    else if (r.state === "failed" && !str(q.json.statusMessage))
      r.message = this.message(exec.json, r.message)
    return r
  }
}

// ================================================================ SSLCommerz

export class SslcommerzGateway implements OnlineGateway {
  private readonly base: string
  constructor(
    private readonly cfg: GatewayConfig,
    private readonly f: Fetch = fetch,
  ) {
    need(cfg.credentials, ["storeId", "storePassword"], "SSLCommerz")
    this.base = baseUrl(
      env.SSLCOMMERZ_API_URL,
      cfg.mode === "live" ? "https://securepay.sslcommerz.com" : "https://sandbox.sslcommerz.com",
    )
  }

  private get auth() {
    return {
      store_id: this.cfg.credentials.storeId!,
      store_passwd: this.cfg.credentials.storePassword!,
    }
  }

  async test() {
    const q = new URLSearchParams({ ...this.auth, tran_id: "CONNECTION-TEST", format: "json" })
    const { status, json } = await call(
      this.f,
      `${this.base}/validator/api/merchantTransIDvalidationAPI.php?${q.toString()}`,
      {},
    )
    const connect = str(json.APIConnect)
    if (status !== 200 || connect !== "DONE") {
      const why =
        connect === "INACTIVE"
          ? "SSLCommerz says this store is inactive"
          : connect === "INVALID_REQUEST" || connect === "FAILED"
            ? "SSLCommerz refused the store ID or password"
            : ""
      throw new GatewayError(why || str(json.failedreason) || "SSLCommerz refused the keys", status)
    }
    return `SSLCommerz ${this.cfg.mode === "live" ? "live" : "sandbox"} store works`
  }

  async start(i: StartInput): Promise<Started> {
    const back = (result: string) =>
      `${i.returnUrl}${i.returnUrl.includes("?") ? "&" : "?"}result=${result}`
    const form: Record<string, string> = {
      ...this.auth,
      total_amount: i.amount.toFixed(2),
      currency: "BDT",
      tran_id: i.code,
      success_url: back("success"),
      fail_url: back("fail"),
      cancel_url: back("cancel"),
      ipn_url: i.ipnUrl,
      cus_name: i.customer.name.slice(0, 50) || "Customer",
      cus_email: i.customer.email?.trim() ? i.customer.email.trim() : "customer@example.com",
      cus_phone: i.customer.phone,
      cus_add1: i.customer.address.slice(0, 50) || "Bangladesh",
      cus_city: i.customer.city.slice(0, 50) || "Dhaka",
      cus_country: "Bangladesh",
      shipping_method: "NO",
      num_of_item: String(Math.max(1, i.itemCount)),
      product_name: i.productName.slice(0, 250) || "Order",
      product_category: "General",
      product_profile: "general",
      value_a: i.code,
    }
    const { status, json } = await call(this.f, `${this.base}/gwprocess/v4/api.php`, {
      method: "POST",
      form,
    })
    const url = str(json.GatewayPageURL)
    if (status !== 200 || str(json.status) !== "SUCCESS" || !url)
      throw new GatewayError(str(json.failedreason) || "SSLCommerz didn't open the payment", status)
    return { reference: str(json.sessionkey) || i.code, payUrl: url }
  }

  /** The validation API's answer for a val_id, or the payment found by our tran_id. */
  private async lookup(i: {
    code: string
    valId?: string | null
  }): Promise<Record<string, unknown> | null> {
    if (i.valId) {
      const q = new URLSearchParams({ val_id: i.valId, ...this.auth, v: "1", format: "json" })
      const { status, json } = await call(
        this.f,
        `${this.base}/validator/api/validationserverAPI.php?${q.toString()}`,
        {},
      )
      if (status !== 200) throw new GatewayError("SSLCommerz couldn't check the payment", status)
      return json
    }
    const q = new URLSearchParams({ tran_id: i.code, ...this.auth, format: "json" })
    const { status, json } = await call(
      this.f,
      `${this.base}/validator/api/merchantTransIDvalidationAPI.php?${q.toString()}`,
      {},
    )
    if (status !== 200 || str(json.APIConnect) !== "DONE")
      throw new GatewayError("SSLCommerz couldn't check the payment", status)
    const found = Array.isArray(json.element) ? (json.element as Record<string, unknown>[]) : []
    return found.find((e) => ["VALID", "VALIDATED"].includes(str(e.status))) ?? found[0] ?? null
  }

  async confirm(i: {
    reference: string | null
    code: string
    valId?: string | null
  }): Promise<GatewayResult> {
    const json = await this.lookup(i)
    if (!json)
      return {
        state: "pending",
        code: i.code,
        amount: null,
        currency: null,
        txnId: null,
        message: "SSLCommerz has no payment for it yet",
        raw: {},
      }
    const st = str(json.status)
    const paid = st === "VALID" || st === "VALIDATED"
    // The amount in taka: currency_amount in currency_type when the shopper paid in another currency.
    const bdt = str(json.currency_type) === "BDT" || !str(json.currency_type)
    return {
      state: paid
        ? "paid"
        : st === "CANCELLED"
          ? "cancelled"
          : st === "PENDING"
            ? "pending"
            : "failed",
      code: str(json.tran_id) || null,
      amount: bdt ? (numOrNull(json.currency_amount) ?? numOrNull(json.amount)) : null,
      currency: bdt ? "BDT" : str(json.currency_type),
      txnId: str(json.bank_tran_id) || null,
      risky: str(json.risk_level) === "1",
      message: paid ? "Paid" : st || "Not paid",
      raw: json,
    }
  }
}

export function gatewayFor(cfg: GatewayConfig, f: Fetch = fetch): OnlineGateway {
  return cfg.gateway === "bkash" ? new BkashGateway(cfg, f) : new SslcommerzGateway(cfg, f)
}
