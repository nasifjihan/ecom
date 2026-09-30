/**
 * Online payments without a network: the rules (when a gateway's answer marks an order paid) and
 * the bKash / SSLCommerz adapters against recorded-style gateway answers.
 */
import { describe, it, expect } from "vitest"
import {
  BkashGateway,
  SslcommerzGateway,
  type Fetch,
  type GatewayResult,
} from "../../src/modules/payments/gateways/gateway.adapters"
import {
  attemptCode,
  judge,
  maskKey,
  methodUsable,
  scrub,
  storefrontOrigin,
} from "../../src/modules/payments/gateways/gateway.rules"

const paid = (over: Partial<GatewayResult> = {}): GatewayResult => ({
  state: "paid",
  code: "FBD-1001-ABC123",
  amount: 1500,
  currency: "BDT",
  txnId: "TRX1",
  message: "Paid",
  raw: {},
  ...over,
})

describe("judge: when a gateway's answer marks an order paid", () => {
  const attempt = { code: "FBD-1001-ABC123", amount: 1500 }

  it("pays only this try, in taka, for the amount asked", () => {
    expect(judge(attempt, paid())).toEqual({ status: "paid", note: null })
    expect(judge(attempt, paid({ amount: 1500.004 })).status).toBe("paid")
  })

  it("sends money that doesn't match to staff instead", () => {
    expect(judge(attempt, paid({ amount: 15 })).note).toMatch(/৳15.00 was paid, ৳1500.00 was due/)
    expect(judge(attempt, paid({ code: "FBD-9999-XYZ" })).note).toMatch(/has it as FBD-9999-XYZ/)
    expect(judge(attempt, paid({ currency: "USD" })).note).toMatch(/paid in USD/)
    expect(judge(attempt, paid({ amount: null })).status).toBe("review")
    expect(judge(attempt, paid({ risky: true })).note).toMatch(/flagged/)
  })

  it("passes other endings through", () => {
    expect(judge(attempt, paid({ state: "failed", message: "Insufficient balance" }))).toEqual({
      status: "failed",
      note: "Insufficient balance",
    })
    expect(judge(attempt, paid({ state: "pending" }))).toEqual({ status: "pending", note: null })
  })
})

describe("helpers", () => {
  it("makes a readable, unique try code from the order number", () => {
    const a = attemptCode("FBD-1042")
    expect(a).toMatch(/^FBD-1042-[A-Z0-9]{6}$/)
    expect(attemptCode("FBD-1042")).not.toBe(a)
  })

  it("sends customers back only to the store's own addresses", () => {
    const hosts = ["shop.example.com", "localhost:3000"]
    expect(storefrontOrigin("https://www.shop.example.com", hosts, "https://fallback.test")).toBe(
      "https://www.shop.example.com",
    )
    expect(storefrontOrigin("http://localhost:3000/checkout", hosts, "https://fallback.test")).toBe(
      "http://localhost:3000",
    )
    expect(storefrontOrigin("https://evil.example.net", hosts, "https://fallback.test/")).toBe(
      "https://fallback.test",
    )
    expect(storefrontOrigin("javascript:alert(1)", hosts, "https://fallback.test")).toBe(
      "https://fallback.test",
    )
    expect(storefrontOrigin(null, hosts, "https://fallback.test")).toBe("https://fallback.test")
  })

  it("offers online methods only when connected", () => {
    expect(methodUsable({ code: "cod", mode: "online", secrets: null }, false)).toBe(true)
    expect(methodUsable({ code: "bkash", mode: "manual", secrets: null }, true)).toBe(true)
    expect(methodUsable({ code: "bkash", mode: "online", secrets: null }, true)).toBe(false)
    expect(methodUsable({ code: "bkash", mode: "online", secrets: "enc" }, true)).toBe(true)
    expect(methodUsable({ code: "nagad", mode: "online", secrets: "enc" }, true)).toBe(false)
    expect(methodUsable({ code: "stripe", mode: "online", secrets: "enc" }, false)).toBe(false)
  })

  it("masks keys and keeps them out of stored answers", () => {
    expect(maskKey("abcd1234wxyz")).toBe("abcd••••wxyz")
    expect(maskKey("short")).toBe("••••")
    expect(
      scrub({ trxID: "T1", store_passwd: "p", id_token: "t", verify_sign: "s", amount: "10" }),
    ).toEqual({ trxID: "T1", amount: "10" })
  })
})

// ------------------------------------------------------------------ adapters

interface Call {
  url: string
  method: string
  headers: Record<string, string>
  body: string
}

/** A fake gateway: answers by URL path, records every call. */
function fakeFetch(routes: Record<string, (c: Call) => { status?: number; body: unknown }>) {
  const calls: Call[] = []
  const f: Fetch = (input, init) => {
    const url =
      typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url
    const c: Call = {
      url,
      method: init?.method ?? "GET",
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: typeof init?.body === "string" ? init.body : "",
    }
    calls.push(c)
    const path = new URL(url).pathname
    const key = Object.keys(routes).find((k) => path.endsWith(k))
    if (!key) return Promise.resolve(new Response("not found", { status: 404 }))
    const r = routes[key]!(c)
    return Promise.resolve(new Response(JSON.stringify(r.body), { status: r.status ?? 200 }))
  }
  return { f, calls }
}

const bkashKeys = {
  username: "sandboxTokenizedUser02",
  password: "pw",
  appKey: "key-" + Math.random(),
  appSecret: "sec",
}

describe("bKash Checkout", () => {
  it("grants a token once, opens a payment and executes it", async () => {
    const { f, calls } = fakeFetch({
      "/token/grant": () => ({
        body: { statusCode: "0000", id_token: "TOKEN1", expires_in: 3600 },
      }),
      "/checkout/create": (c) => {
        const b = JSON.parse(c.body) as Record<string, string>
        return {
          body: {
            statusCode: "0000",
            paymentID: "PAY1",
            bkashURL: "https://sandbox.bka.sh/pay/PAY1",
            amount: b.amount,
            merchantInvoiceNumber: b.merchantInvoiceNumber,
          },
        }
      },
      "/checkout/execute": () => ({
        body: {
          statusCode: "0000",
          paymentID: "PAY1",
          trxID: "BKTRX9",
          transactionStatus: "Completed",
          amount: "1500.00",
          currency: "BDT",
          merchantInvoiceNumber: "FBD-1-AAAAAA",
        },
      }),
    })
    const g = new BkashGateway({ gateway: "bkash", mode: "sandbox", credentials: bkashKeys }, f)
    const started = await g.start({
      code: "FBD-1-AAAAAA",
      amount: 1500,
      returnUrl: "https://api.test/api/payments/return/bkash?attempt=FBD-1-AAAAAA",
      ipnUrl: "",
      customer: { name: "Rahim", phone: "01712345678", address: "Road 1", city: "Dhaka" },
      productName: "Panjabi",
      itemCount: 1,
    })
    expect(started).toEqual({ reference: "PAY1", payUrl: "https://sandbox.bka.sh/pay/PAY1" })
    const create = calls.find((c) => c.url.endsWith("/checkout/create"))!
    expect(create.headers.Authorization).toBe("TOKEN1")
    expect(create.headers["X-App-Key"]).toBe(bkashKeys.appKey)
    const sent = JSON.parse(create.body) as Record<string, string>
    expect(sent).toMatchObject({ mode: "0011", amount: "1500.00", currency: "BDT", intent: "sale" })
    expect(sent.callbackURL).toContain("attempt=FBD-1-AAAAAA")
    const r = await g.confirm({ reference: "PAY1", code: "FBD-1-AAAAAA" })
    expect(r).toMatchObject({
      state: "paid",
      amount: 1500,
      currency: "BDT",
      txnId: "BKTRX9",
      code: "FBD-1-AAAAAA",
    })
    // One grant for all three calls.
    expect(calls.filter((c) => c.url.endsWith("/token/grant"))).toHaveLength(1)
    expect(calls[0]!.headers.username).toBe("sandboxTokenizedUser02")
    expect(calls[0]!.url).toContain("tokenized.sandbox.bka.sh")
  })

  it("asks how the payment ended when execute refuses (already executed, cancelled …)", async () => {
    const { f } = fakeFetch({
      "/token/grant": () => ({ body: { id_token: "T", expires_in: 3600 } }),
      "/checkout/execute": () => ({
        body: { statusCode: "2117", statusMessage: "Payment execution already been called before" },
      }),
      "/payment/status": () => ({
        body: {
          statusCode: "0000",
          transactionStatus: "Completed",
          trxID: "BKTRX7",
          amount: "99.00",
          merchantInvoiceNumber: "X-1",
        },
      }),
    })
    const g = new BkashGateway(
      { gateway: "bkash", mode: "sandbox", credentials: { ...bkashKeys, appKey: "k2" } },
      f,
    )
    expect(await g.confirm({ reference: "PAY2", code: "X-1" })).toMatchObject({
      state: "paid",
      txnId: "BKTRX7",
      amount: 99,
    })

    const cancelled = fakeFetch({
      "/token/grant": () => ({ body: { id_token: "T", expires_in: 3600 } }),
      "/checkout/execute": () => ({
        body: { statusCode: "2056", statusMessage: "Invalid Payment State" },
      }),
      "/payment/status": () => ({ body: { statusCode: "0000", transactionStatus: "Cancelled" } }),
    })
    const g2 = new BkashGateway(
      { gateway: "bkash", mode: "sandbox", credentials: { ...bkashKeys, appKey: "k3" } },
      cancelled.f,
    )
    expect(await g2.confirm({ reference: "PAY3", code: "X-2" })).toMatchObject({
      state: "cancelled",
      message: "Cancelled on bKash",
    })
  })

  it("grants a new token when the old one is refused, and reports bad keys", async () => {
    let grants = 0
    const { f } = fakeFetch({
      "/token/grant": () => ({ body: { id_token: `T${++grants}`, expires_in: 3600 } }),
      "/checkout/create": (c) =>
        c.headers.Authorization === "T1"
          ? { status: 401, body: { message: "Unauthorized" } }
          : { body: { statusCode: "0000", paymentID: "P", bkashURL: "https://x" } },
    })
    const g = new BkashGateway(
      { gateway: "bkash", mode: "live", credentials: { ...bkashKeys, appKey: "k4" } },
      f,
    )
    const input = {
      code: "C",
      amount: 10,
      returnUrl: "https://r",
      ipnUrl: "",
      customer: { name: "A", phone: "017", address: "", city: "" },
      productName: "P",
      itemCount: 1,
    }
    await expect(g.start(input)).resolves.toMatchObject({ reference: "P" })
    expect(grants).toBe(2)

    const bad = fakeFetch({
      "/token/grant": () => ({
        status: 200,
        body: { statusCode: "2001", statusMessage: "Invalid App Key" },
      }),
    })
    await expect(
      new BkashGateway(
        { gateway: "bkash", mode: "sandbox", credentials: { ...bkashKeys, appKey: "k5" } },
        bad.f,
      ).test(),
    ).rejects.toThrow("Invalid App Key")
    expect(
      () => new BkashGateway({ gateway: "bkash", mode: "sandbox", credentials: { username: "u" } }),
    ).toThrow(/missing: password, appKey, appSecret/)
  })
})

describe("SSLCommerz", () => {
  const keys = { storeId: "teststore01", storePassword: "teststore01@ssl" }

  it("opens a session with our tran_id and return links", async () => {
    const { f, calls } = fakeFetch({
      "/gwprocess/v4/api.php": () => ({
        body: {
          status: "SUCCESS",
          sessionkey: "SESS1",
          GatewayPageURL: "https://sandbox.sslcommerz.com/EasyCheckOut/SESS1",
        },
      }),
    })
    const g = new SslcommerzGateway(
      { gateway: "sslcommerz", mode: "sandbox", credentials: keys },
      f,
    )
    const s = await g.start({
      code: "FBD-2-BBBBBB",
      amount: 2500.5,
      returnUrl: "https://api.test/api/payments/return/sslcommerz?attempt=FBD-2-BBBBBB",
      ipnUrl: "https://api.test/api/payments/ipn/sslcommerz",
      customer: {
        name: "Karim",
        phone: "01812345678",
        email: null,
        address: "House 2",
        city: "Chattogram",
      },
      productName: "Saree, Shawl",
      itemCount: 2,
    })
    expect(s).toEqual({
      reference: "SESS1",
      payUrl: "https://sandbox.sslcommerz.com/EasyCheckOut/SESS1",
    })
    const form = new URLSearchParams(calls[0]!.body)
    expect(calls[0]!.headers["Content-Type"]).toBe("application/x-www-form-urlencoded")
    expect(Object.fromEntries(form)).toMatchObject({
      store_id: "teststore01",
      total_amount: "2500.50",
      currency: "BDT",
      tran_id: "FBD-2-BBBBBB",
      success_url:
        "https://api.test/api/payments/return/sslcommerz?attempt=FBD-2-BBBBBB&result=success",
      cancel_url:
        "https://api.test/api/payments/return/sslcommerz?attempt=FBD-2-BBBBBB&result=cancel",
      ipn_url: "https://api.test/api/payments/ipn/sslcommerz",
      num_of_item: "2",
    })
  })

  it("counts a payment only when the validation API says VALID", async () => {
    const { f, calls } = fakeFetch({
      "/validationserverAPI.php": () => ({
        body: {
          status: "VALID",
          tran_id: "FBD-2-BBBBBB",
          amount: "2500.50",
          currency_type: "BDT",
          currency_amount: "2500.50",
          bank_tran_id: "BANK1",
          risk_level: "0",
        },
      }),
      "/merchantTransIDvalidationAPI.php": () => ({
        body: {
          APIConnect: "DONE",
          no_of_trans_found: 1,
          element: [
            { status: "FAILED", tran_id: "FBD-2-BBBBBB" },
            {
              status: "VALIDATED",
              tran_id: "FBD-2-BBBBBB",
              amount: "2500.50",
              bank_tran_id: "BANK2",
              currency_type: "BDT",
              currency_amount: "2500.50",
            },
          ],
        },
      }),
    })
    const g = new SslcommerzGateway(
      { gateway: "sslcommerz", mode: "sandbox", credentials: keys },
      f,
    )
    expect(
      await g.confirm({ reference: "SESS1", code: "FBD-2-BBBBBB", valId: "VAL1" }),
    ).toMatchObject({ state: "paid", amount: 2500.5, txnId: "BANK1", risky: false })
    expect(calls[0]!.url).toContain("val_id=VAL1")
    // Without a val_id (a lost return), the payment is found by our tran_id.
    expect(await g.confirm({ reference: null, code: "FBD-2-BBBBBB" })).toMatchObject({
      state: "paid",
      txnId: "BANK2",
    })
  })

  it("tells good keys from bad", async () => {
    const good = fakeFetch({
      "/merchantTransIDvalidationAPI.php": () => ({
        body: { APIConnect: "DONE", no_of_trans_found: 0 },
      }),
    })
    await expect(
      new SslcommerzGateway(
        { gateway: "sslcommerz", mode: "sandbox", credentials: keys },
        good.f,
      ).test(),
    ).resolves.toMatch(/sandbox store works/)
    const bad = fakeFetch({
      "/merchantTransIDvalidationAPI.php": () => ({ body: { APIConnect: "INVALID_REQUEST" } }),
    })
    await expect(
      new SslcommerzGateway(
        { gateway: "sslcommerz", mode: "live", credentials: keys },
        bad.f,
      ).test(),
    ).rejects.toThrow(/refused the store ID or password/)
    expect(bad.calls[0]!.url).toContain("securepay.sslcommerz.com")
  })
})

describe("refunds", () => {
  it("bKash: sends paymentID, trxID and the amount; a refusal is an error", async () => {
    const { f, calls } = fakeFetch({
      "/token/grant": () => ({ body: { id_token: "T", expires_in: 3600 } }),
      "/payment/refund": () => ({ body: { transactionStatus: "Completed", refundTrxID: "RF123", originalTrxID: "BK1", amount: "250.00" } }),
    })
    const g = new BkashGateway({ gateway: "bkash", mode: "sandbox", credentials: { ...bkashKeys, appKey: "k-rf" } }, f)
    expect(await g.refund({ reference: "PAY1", txnId: "BK1", amount: 250, reason: "Size too small" })).toMatchObject({ state: "done", ref: "RF123" })
    const sent = JSON.parse(calls.find((c) => c.url.endsWith("/payment/refund"))!.body) as Record<string, string>
    expect(sent).toMatchObject({ paymentID: "PAY1", trxID: "BK1", amount: "250.00", reason: "Size too small" })

    const no = fakeFetch({
      "/token/grant": () => ({ body: { id_token: "T", expires_in: 3600 } }),
      "/payment/refund": () => ({ body: { statusCode: "2071", statusMessage: "Refund amount exceeds" } }),
    })
    await expect(new BkashGateway({ gateway: "bkash", mode: "sandbox", credentials: { ...bkashKeys, appKey: "k-rf2" } }, no.f).refund({ reference: "P", txnId: "T", amount: 1, reason: "" })).rejects.toThrow("Refund amount exceeds")
  })

  it("SSLCommerz: success, still processing, refused, and asking later", async () => {
    const keys = { storeId: "s", storePassword: "p" }
    const answer = (status: string, extra: object = {}) =>
      fakeFetch({ "/merchantTransIDvalidationAPI.php": () => ({ body: { APIConnect: "DONE", status, refund_ref_id: "R1", ...extra } }) })
    const g = (f: Fetch) => new SslcommerzGateway({ gateway: "sslcommerz", mode: "sandbox", credentials: keys }, f)
    const ok = answer("success")
    expect(await g(ok.f).refund({ reference: null, txnId: "BANK1", amount: 99.5, reason: "Damaged" })).toMatchObject({ state: "done", ref: "R1" })
    expect(Object.fromEntries(new URL(ok.calls[0]!.url).searchParams)).toMatchObject({ bank_tran_id: "BANK1", refund_amount: "99.50", refund_remarks: "Damaged" })
    expect((await g(answer("processing").f).refund({ reference: null, txnId: "B", amount: 1, reason: "x" })).state).toBe("processing")
    await expect(g(answer("failed", { errorReason: "Already refunded" }).f).refund({ reference: null, txnId: "B", amount: 1, reason: "x" })).rejects.toThrow("Already refunded")
    expect((await g(answer("refunded").f).refundStatus("R1")).state).toBe("done")
    expect((await g(answer("processing").f).refundStatus("R1")).state).toBe("processing")
    expect((await g(answer("cancelled").f).refundStatus("R1")).state).toBe("failed")
  })
})
