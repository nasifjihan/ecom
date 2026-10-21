/**
 * ONLINE GATEWAYS — bKash Tokenized Checkout, SSLCommerz and aamarPay behind one interface.
 *
 * Request shapes follow each gateway's merchant documentation:
 *  - bKash Tokenized Checkout v1.2.0-beta: https://tokenized.pay.bka.sh/v1.2.0-beta (sandbox
 *    tokenized.sandbox.bka.sh). Grant a token with username/password headers and the app key and
 *    secret, then create a payment (the customer pays on bkashURL), and after the customer comes
 *    back, execute it; "payment/status" says how it ended when execute can't.
 *  - SSLCommerz v4: https://securepay.sslcommerz.com (sandbox sandbox.sslcommerz.com). Open a
 *    session (the customer pays on GatewayPageURL); a payment counts only once the validation API
 *    says VALID / VALIDATED for its val_id.
 *  - aamarPay (JSON integration): https://secure.aamarpay.com (sandbox sandbox.aamarpay.com). Open a
 *    payment with jsonpost.php (the customer pays on payment_url); a payment counts only once the
 *    transaction check (api/v1/trxcheck/request.php) says Successful for our tran_id. aamarPay has no
 *    refund API, so refunds are paid back by hand (API_REFUNDS in gateway.rules.ts).
 *  - Nagad Online Payment API v-0.2.0 (sandbox sandbox-ssl.mynagad.com:10061, live api.mynagad.com):
 *    initialize (our data RSA-encrypted with Nagad's public key and signed with the merchant's
 *    private key), complete (gives the payment page), and after the callback, verify/payment says
 *    how it ended. No refund API: refunds are paid back by hand.
 * Nothing the browser sends is trusted: every "paid" comes from the gateway's own API.
 * Base URLs can be pointed elsewhere with BKASH_API_URL / SSLCOMMERZ_API_URL / AAMARPAY_API_URL
 * (a local mock).
 * `fetch` is injectable for unit tests.
 */
import { constants, createPrivateKey, createPublicKey, privateDecrypt, publicEncrypt, randomBytes, sign as rsaSign } from "node:crypto"
import { env } from "../../../config"

export type Fetch = typeof fetch
export type OnlineGatewayCode = "bkash" | "sslcommerz" | "aamarpay" | "nagad"

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
  /** The customer's IP (Nagad asks for it). */
  clientIp?: string | null
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

/** What the gateway said about a refund. */
export interface RefundResult {
  /** done: the money is on its way back; processing: the gateway is still working on it (check later). */
  state: "done" | "processing"
  /** bKash refundTrxID, SSLCommerz refund_ref_id. */
  ref: string | null
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
  /** Sends money back for a paid payment; throws GatewayError when the gateway refuses. */
  refund(input: { reference: string | null; txnId: string; amount: number; reason: string }): Promise<RefundResult>
  /** How a refund that was still processing ended (SSLCommerz; bKash refunds finish at once). */
  refundStatus(ref: string): Promise<RefundResult | { state: "failed"; ref: string; raw: Record<string, unknown> }>
}

/** The keys each gateway needs, with labels for the admin form. */
export const GATEWAY_FIELDS: Record<
  OnlineGatewayCode,
  { key: string; label: string; secret?: boolean; multiline?: boolean }[]
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
  aamarpay: [
    { key: "storeId", label: "Store ID" },
    { key: "signatureKey", label: "Signature key", secret: true },
  ],
  nagad: [
    { key: "merchantId", label: "Merchant ID" },
    { key: "merchantPrivateKey", label: "Merchant private key", secret: true, multiline: true },
    { key: "nagadPublicKey", label: "Nagad public key", multiline: true },
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

  async refund(i: { reference: string | null; txnId: string; amount: number; reason: string }): Promise<RefundResult> {
    if (!i.reference) throw new GatewayError("No bKash payment to refund")
    const { status, json } = await this.post("/tokenized/checkout/payment/refund", {
      paymentID: i.reference,
      trxID: i.txnId,
      amount: i.amount.toFixed(2),
      sku: "order",
      reason: i.reason.slice(0, 255) || "Refund",
    })
    if (status !== 200 || str(json.transactionStatus) !== "Completed" || !str(json.refundTrxID))
      throw new GatewayError(this.message(json, "bKash didn't accept the refund"), status)
    return { state: "done", ref: str(json.refundTrxID), raw: json }
  }

  refundStatus(ref: string): Promise<RefundResult> {
    // bKash answers a refund at once: there's nothing still processing to ask about.
    return Promise.resolve({ state: "done", ref, raw: {} })
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

  async refund(i: { reference: string | null; txnId: string; amount: number; reason: string }): Promise<RefundResult> {
    const q = new URLSearchParams({
      bank_tran_id: i.txnId,
      refund_amount: i.amount.toFixed(2),
      refund_remarks: i.reason.slice(0, 255) || "Refund",
      ...this.auth,
      v: "1",
      format: "json",
    })
    const { status, json } = await call(this.f, `${this.base}/validator/api/merchantTransIDvalidationAPI.php?${q.toString()}`, {})
    const st = str(json.status)
    if (status !== 200 || str(json.APIConnect) !== "DONE" || (st !== "success" && st !== "processing"))
      throw new GatewayError(str(json.errorReason) || "SSLCommerz didn't accept the refund", status)
    return { state: st === "success" ? "done" : "processing", ref: str(json.refund_ref_id) || null, raw: json }
  }

  async refundStatus(ref: string) {
    const q = new URLSearchParams({ refund_ref_id: ref, ...this.auth, format: "json" })
    const { status, json } = await call(this.f, `${this.base}/validator/api/merchantTransIDvalidationAPI.php?${q.toString()}`, {})
    if (status !== 200 || str(json.APIConnect) !== "DONE") throw new GatewayError(str(json.errorReason) || "SSLCommerz couldn't say how the refund went", status)
    const st = str(json.status)
    if (st === "refunded") return { state: "done" as const, ref, raw: json }
    if (st === "processing") return { state: "processing" as const, ref, raw: json }
    return { state: "failed" as const, ref, raw: json }
  }
}

export function gatewayFor(cfg: GatewayConfig, f: Fetch = fetch): OnlineGateway {
  if (cfg.gateway === "bkash") return new BkashGateway(cfg, f)
  if (cfg.gateway === "aamarpay") return new AamarpayGateway(cfg, f)
  if (cfg.gateway === "nagad") return new NagadGateway(cfg, f)
  return new SslcommerzGateway(cfg, f)
}

// ================================================================ aamarPay

/** aamarPay's pay_status values, as its transaction check reports them. */
const AAMARPAY_STATES: Record<string, GatewayResult["state"]> = {
  successful: "paid",
  failed: "failed",
  cancelled: "cancelled",
  canceled: "cancelled",
  pending: "pending",
  unattempted: "pending",
  initiated: "pending",
}

export class AamarpayGateway implements OnlineGateway {
  private readonly base: string
  constructor(
    private readonly cfg: GatewayConfig,
    private readonly f: Fetch = fetch,
  ) {
    need(cfg.credentials, ["storeId", "signatureKey"], "aamarPay")
    this.base = baseUrl(
      env.AAMARPAY_API_URL,
      cfg.mode === "live" ? "https://secure.aamarpay.com" : "https://sandbox.aamarpay.com",
    )
  }

  private check(tranId: string) {
    const q = new URLSearchParams({
      request_id: tranId,
      store_id: this.cfg.credentials.storeId!,
      signature_key: this.cfg.credentials.signatureKey!,
      type: "json",
    })
    return call(this.f, `${this.base}/api/v1/trxcheck/request.php?${q.toString()}`, {})
  }

  /** aamarPay answers bad keys with an error message instead of a transaction. */
  private static refused(json: Record<string, unknown>) {
    const msg = `${str(json.errors)} ${str(json.error)} ${str(json.message)} ${str(json.msg)}`.toLowerCase()
    return /store|signature|authenticat|unauthori[sz]ed|invalid credential/.test(msg)
  }

  async test() {
    const { status, json } = await this.check("CONNECTION-TEST")
    if (status >= 500) throw new GatewayError("aamarPay didn't answer the check", status)
    if (status === 401 || status === 403 || AamarpayGateway.refused(json))
      throw new GatewayError("aamarPay refused the store ID or signature key", status)
    return `aamarPay ${this.cfg.mode === "live" ? "live" : "sandbox"} store works`
  }

  async start(i: StartInput): Promise<Started> {
    const back = (result: string) =>
      `${i.returnUrl}${i.returnUrl.includes("?") ? "&" : "?"}result=${result}`
    const { status, json } = await call(this.f, `${this.base}/jsonpost.php`, {
      method: "POST",
      json: {
        store_id: this.cfg.credentials.storeId,
        signature_key: this.cfg.credentials.signatureKey,
        tran_id: i.code,
        amount: i.amount.toFixed(2),
        currency: "BDT",
        desc: i.productName.slice(0, 250) || "Order",
        cus_name: i.customer.name.slice(0, 50) || "Customer",
        cus_email: i.customer.email?.trim() ? i.customer.email.trim() : "customer@example.com",
        cus_phone: i.customer.phone,
        cus_add1: i.customer.address.slice(0, 50) || "Bangladesh",
        cus_city: i.customer.city.slice(0, 50) || "Dhaka",
        cus_country: "Bangladesh",
        success_url: back("success"),
        fail_url: back("fail"),
        cancel_url: back("cancel"),
        opt_a: i.code,
        type: "json",
      },
    })
    const url = str(json.payment_url)
    if (status !== 200 || !url || str(json.result) === "false")
      throw new GatewayError(
        str(json.errors) || str(json.message) || "aamarPay didn't open the payment",
        status,
      )
    return { reference: i.code, payUrl: url }
  }

  async confirm(i: { reference: string | null; code: string }): Promise<GatewayResult> {
    const { status, json } = await this.check(i.code)
    if (status !== 200 || AamarpayGateway.refused(json))
      throw new GatewayError("aamarPay couldn't check the payment", status)
    const payStatus = str(json.pay_status)
    if (!payStatus)
      return {
        state: "pending",
        code: i.code,
        amount: null,
        currency: null,
        txnId: null,
        message: "aamarPay has no payment for it yet",
        raw: json,
      }
    const state = AAMARPAY_STATES[payStatus.toLowerCase()] ?? "failed"
    // amount is what the customer was asked in currency_merchant; amount_original in the shopper's currency.
    const currency = str(json.currency_merchant) || str(json.currency) || null
    return {
      state,
      code: str(json.mer_txnid) || null,
      amount: numOrNull(json.amount),
      currency,
      txnId: str(json.pg_txnid) || str(json.bank_trxid) || null,
      risky: str(json.risk_level) === "1",
      message: state === "paid" ? "Paid" : payStatus,
      raw: json,
    }
  }

  /** aamarPay has no refund API: refunds are paid back by hand (never called; see API_REFUNDS). */
  refund(): Promise<RefundResult> {
    return Promise.reject(new GatewayError("aamarPay refunds are paid back by hand"))
  }

  refundStatus(): Promise<RefundResult> {
    return Promise.reject(new GatewayError("aamarPay refunds are paid back by hand"))
  }
}

// ================================================================ Nagad

/** A key pasted with or without its PEM lines (inputs often lose the line breaks): as PEM. */
export function pemOf(raw: string, kind: "PRIVATE KEY" | "PUBLIC KEY"): string {
  const body = raw
    .replace(/-----(BEGIN|END)[^-]*-----/g, "")
    .replace(/\s+/g, "")
  return `-----BEGIN ${kind}-----\n${body.match(/.{1,64}/g)?.join("\n") ?? ""}\n-----END ${kind}-----\n`
}

/** Nagad's order id: letters and digits only, at most 20 (our try code without its dash). */
export const nagadOrderId = (code: string) => code.replace(/[^A-Za-z0-9]/g, "").slice(0, 20)

/** Nagad's dateTime: yyyyMMddHHmmss in Bangladesh time. */
export function nagadDateTime(d = new Date()): string {
  const t = new Date(d.getTime() + 6 * 3600_000).toISOString() // UTC+6, no daylight saving
  return t.slice(0, 19).replace(/[-T:]/g, "")
}

/** Nagad's payment statuses (verify/payment). */
const NAGAD_STATES: Record<string, GatewayResult["state"]> = {
  success: "paid",
  aborted: "cancelled",
  cancelled: "cancelled",
  canceled: "cancelled",
  failed: "failed",
  rejected: "failed",
  expired: "failed",
  ready: "pending",
  initiated: "pending",
  pending: "pending",
}

export class NagadGateway implements OnlineGateway {
  private readonly base: string
  private readonly merchantKey: ReturnType<typeof createPrivateKey>
  private readonly nagadKey: ReturnType<typeof createPublicKey>
  constructor(
    private readonly cfg: GatewayConfig,
    private readonly f: Fetch = fetch,
  ) {
    need(cfg.credentials, ["merchantId", "merchantPrivateKey", "nagadPublicKey"], "Nagad")
    this.base = baseUrl(
      env.NAGAD_API_URL,
      cfg.mode === "live"
        ? "https://api.mynagad.com"
        : "https://sandbox-ssl.mynagad.com:10061/remote-payment-gateway-1.0",
    )
    try {
      this.merchantKey = createPrivateKey(pemOf(cfg.credentials.merchantPrivateKey!, "PRIVATE KEY"))
      this.nagadKey = createPublicKey(pemOf(cfg.credentials.nagadPublicKey!, "PUBLIC KEY"))
    } catch {
      throw new GatewayError("The Nagad keys aren't valid RSA keys; paste them again as Nagad gave them")
    }
  }

  private headers(ip?: string | null) {
    return {
      "X-KM-Api-Version": "v-0.2.0",
      "X-KM-IP-V4": ip && /^\d{1,3}(\.\d{1,3}){3}$/.test(ip) ? ip : "127.0.0.1",
      "X-KM-Client-Type": "PC_WEB",
    }
  }

  /** Our data for Nagad: encrypted with Nagad's public key, signed with the merchant's private key. */
  private seal(data: Record<string, string>) {
    const json = Buffer.from(JSON.stringify(data))
    return {
      sensitiveData: publicEncrypt({ key: this.nagadKey, padding: constants.RSA_PKCS1_PADDING }, json).toString("base64"),
      signature: rsaSign("sha256", json, this.merchantKey).toString("base64"),
    }
  }

  /** Nagad's answer, encrypted with the merchant's public key. */
  private open(sensitiveData: string): Record<string, unknown> {
    try {
      const plain = privateDecrypt(
        { key: this.merchantKey, padding: constants.RSA_PKCS1_PADDING },
        Buffer.from(sensitiveData, "base64"),
      )
      return JSON.parse(plain.toString("utf8")) as Record<string, unknown>
    } catch {
      throw new GatewayError("Couldn't read Nagad's answer: the merchant private key doesn't match this account")
    }
  }

  private async initialize(orderId: string, ip?: string | null) {
    const merchantId = this.cfg.credentials.merchantId!
    const dateTime = nagadDateTime()
    const challenge = randomBytes(20).toString("hex")
    const { status, json } = await call(
      this.f,
      `${this.base}/api/dfs/check-out/initialize/${encodeURIComponent(merchantId)}/${encodeURIComponent(orderId)}?locale=EN`,
      {
        method: "POST",
        headers: this.headers(ip),
        json: { dateTime, ...this.seal({ merchantId, datetime: dateTime, orderId, challenge }) },
      },
    )
    if (status !== 200 || !str(json.sensitiveData))
      throw new GatewayError(str(json.message) || str(json.reason) || "Nagad refused the merchant ID or keys", status)
    const data = this.open(str(json.sensitiveData))
    const ref = str(data.paymentReferenceId)
    if (!ref) throw new GatewayError("Nagad gave no payment reference", status)
    return { ref, challenge: str(data.challenge) }
  }

  async test() {
    await this.initialize(`TEST${Date.now()}`.slice(0, 20))
    return `Nagad ${this.cfg.mode === "live" ? "live" : "sandbox"} keys work`
  }

  async start(i: StartInput): Promise<Started> {
    const orderId = nagadOrderId(i.code)
    const { ref, challenge } = await this.initialize(orderId, i.clientIp)
    const { status, json } = await call(this.f, `${this.base}/api/dfs/check-out/complete/${encodeURIComponent(ref)}`, {
      method: "POST",
      headers: this.headers(i.clientIp),
      json: {
        ...this.seal({
          merchantId: this.cfg.credentials.merchantId!,
          orderId,
          currencyCode: "050", // taka
          amount: i.amount.toFixed(2),
          challenge,
        }),
        merchantCallbackURL: i.returnUrl,
        additionalMerchantInfo: { order: i.code },
      },
    })
    const url = str(json.callBackUrl)
    if (status !== 200 || str(json.status).toLowerCase() !== "success" || !url)
      throw new GatewayError(str(json.message) || "Nagad didn't open the payment", status)
    return { reference: ref, payUrl: url }
  }

  async confirm(i: { reference: string | null; code: string }): Promise<GatewayResult> {
    if (!i.reference)
      return { state: "pending", code: i.code, amount: null, currency: null, txnId: null, message: "Nagad has no payment for it yet", raw: {} }
    const { status, json } = await call(this.f, `${this.base}/api/dfs/verify/payment/${encodeURIComponent(i.reference)}`, {
      headers: this.headers(),
    })
    if (status !== 200) throw new GatewayError(str(json.message) || "Nagad couldn't check the payment", status)
    const st = str(json.status)
    const state = NAGAD_STATES[st.toLowerCase()] ?? (st ? "failed" : "pending")
    const theirs = str(json.orderId)
    return {
      state,
      // Nagad has our code without its dash; give it back as ours when it is this try's.
      code: theirs ? (theirs === nagadOrderId(i.code) ? i.code : theirs) : null,
      amount: numOrNull(json.amount),
      currency: "BDT", // Nagad takes taka only
      txnId: str(json.issuerPaymentRefNo) || str(json.paymentRefId) || null,
      message: state === "paid" ? "Paid" : st ? `${st} on Nagad` : "Not paid yet",
      raw: json,
    }
  }

  /** Nagad's merchant API has no refunds: they are paid back by hand (see API_REFUNDS). */
  refund(): Promise<RefundResult> {
    return Promise.reject(new GatewayError("Nagad refunds are paid back by hand"))
  }

  refundStatus(): Promise<RefundResult> {
    return Promise.reject(new GatewayError("Nagad refunds are paid back by hand"))
  }
}
