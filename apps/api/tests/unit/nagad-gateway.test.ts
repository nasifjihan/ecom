/**
 * The Nagad adapter against a fake Nagad that does the real crypto: it decrypts what we send with
 * its private key, checks our signature with the merchant's public key, and answers encrypted with
 * the merchant's public key, as Nagad does.
 */
import { describe, expect, it } from "vitest"
import { constants, generateKeyPairSync, privateDecrypt, publicEncrypt, verify } from "node:crypto"
import {
  NagadGateway,
  nagadDateTime,
  nagadOrderId,
  pemOf,
  type Fetch,
} from "../../src/modules/payments/gateways/gateway.adapters"
import { judge } from "../../src/modules/payments/gateways/gateway.rules"

const pair = () =>
  generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  })
const merchant = pair()
const nagad = pair()
/** As an admin box would keep them: no PEM lines, no line breaks. */
const bare = (pem: string) => pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "")

const keys = {
  merchantId: "683002007104225",
  merchantPrivateKey: bare(merchant.privateKey),
  nagadPublicKey: bare(nagad.publicKey),
}
const CODE = "20261021000004-K7Q2XM"

interface Seen {
  url: string
  headers: Record<string, string>
  data?: Record<string, string>
  body: Record<string, unknown>
}

function fakeNagad(verifyAnswer: Record<string, unknown> = {}, initStatus = 200) {
  const seen: Seen[] = []
  const answerSealed = (data: object) => ({
    sensitiveData: publicEncrypt(
      { key: merchant.publicKey, padding: constants.RSA_PKCS1_PADDING },
      Buffer.from(JSON.stringify(data)),
    ).toString("base64"),
    signature: "nagad-signature",
  })
  const f: Fetch = (input, init) => {
    const url =
      typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url
    const body = (typeof init?.body === "string" ? JSON.parse(init.body) : {}) as Record<
      string,
      string
    >
    const s: Seen = { url, headers: (init?.headers ?? {}) as Record<string, string>, body }
    seen.push(s)
    const reply = (b: unknown, status = 200) =>
      Promise.resolve(new Response(JSON.stringify(b), { status }))
    if (body.sensitiveData) {
      const plain = privateDecrypt(
        { key: nagad.privateKey, padding: constants.RSA_PKCS1_PADDING },
        Buffer.from(body.sensitiveData, "base64"),
      )
      s.data = JSON.parse(plain.toString()) as Record<string, string>
      if (!verify("sha256", plain, merchant.publicKey, Buffer.from(body.signature!, "base64")))
        return reply({ reason: "Invalid signature", message: "Signature mismatch" }, 400)
    }
    if (url.includes("/check-out/initialize/")) {
      if (initStatus !== 200)
        return reply({ reason: "MERCHANT_NOT_FOUND", message: "Invalid merchant" }, initStatus)
      return reply(
        answerSealed({
          paymentReferenceId: "MDEwMjEw-REF1",
          challenge: "nagad-challenge",
          acceptDateTime: "20261021120000",
        }),
      )
    }
    if (url.includes("/check-out/complete/"))
      return reply({
        status: "Success",
        callBackUrl: "https://sandbox-ssl.mynagad.com/check-out/MDEwMjEw-REF1",
      })
    if (url.includes("/verify/payment/")) return reply(verifyAnswer)
    return reply({ message: "not found" }, 404)
  }
  return { f, seen }
}

const gw = (f: Fetch) =>
  new NagadGateway({ gateway: "nagad", mode: "sandbox", credentials: keys }, f)
const start = {
  code: CODE,
  amount: 1499.5,
  returnUrl: `https://api.example.com/api/payments/return/nagad?attempt=${CODE}`,
  ipnUrl: "",
  customer: { name: "Rahim", phone: "01711000000", email: null, address: "House 1", city: "Dhaka" },
  productName: "Shirt",
  itemCount: 1,
  clientIp: "103.10.20.30",
}

describe("Nagad helpers", () => {
  it("rebuilds PEM keys pasted without their lines or line breaks", () => {
    expect(pemOf(bare(merchant.privateKey), "PRIVATE KEY").replace(/\s+/g, "")).toBe(
      merchant.privateKey.replace(/\s+/g, ""),
    )
    expect(pemOf(nagad.publicKey, "PUBLIC KEY").replace(/\s+/g, "")).toBe(
      nagad.publicKey.replace(/\s+/g, ""),
    )
  })
  it("order ids are letters and digits, at most 20; times are Bangladesh time", () => {
    expect(nagadOrderId(CODE)).toBe("20261021000004K7Q2XM")
    expect(nagadOrderId(CODE)).toHaveLength(20)
    expect(nagadDateTime(new Date("2026-10-21T18:30:05Z"))).toBe("20261022003005")
  })
  it("refuses keys that aren't RSA keys", () => {
    expect(
      () =>
        new NagadGateway({
          gateway: "nagad",
          mode: "sandbox",
          credentials: { ...keys, nagadPublicKey: "not a key" },
        }),
    ).toThrow(/aren't valid RSA keys/)
  })
})

describe("Nagad payments", () => {
  it("initializes and completes with our data sealed for Nagad and signed by the merchant", async () => {
    const { f, seen } = fakeNagad()
    const r = await gw(f).start(start)
    expect(r).toEqual({
      reference: "MDEwMjEw-REF1",
      payUrl: "https://sandbox-ssl.mynagad.com/check-out/MDEwMjEw-REF1",
    })
    const [init, complete] = seen
    expect(init!.url).toBe(
      "https://sandbox-ssl.mynagad.com:10061/remote-payment-gateway-1.0/api/dfs/check-out/initialize/683002007104225/20261021000004K7Q2XM?locale=EN",
    )
    expect(init!.headers).toMatchObject({
      "X-KM-Api-Version": "v-0.2.0",
      "X-KM-IP-V4": "103.10.20.30",
      "X-KM-Client-Type": "PC_WEB",
    })
    expect(init!.data).toMatchObject({
      merchantId: "683002007104225",
      orderId: "20261021000004K7Q2XM",
    })
    expect(complete!.url).toContain("/api/dfs/check-out/complete/MDEwMjEw-REF1")
    expect(complete!.data).toEqual({
      merchantId: "683002007104225",
      orderId: "20261021000004K7Q2XM",
      currencyCode: "050",
      amount: "1499.50",
      challenge: "nagad-challenge",
    })
    expect(complete!.body.merchantCallbackURL).toBe(start.returnUrl)
  })

  it("test connection says whether Nagad accepts the merchant", async () => {
    expect(await gw(fakeNagad().f).test()).toBe("Nagad sandbox keys work")
    await expect(gw(fakeNagad({}, 400).f).test()).rejects.toThrow(/Invalid merchant/)
  })

  it("a merchant private key that doesn't match can't read Nagad's answer", async () => {
    const other = pair()
    const wrong = new NagadGateway(
      {
        gateway: "nagad",
        mode: "sandbox",
        credentials: { ...keys, merchantPrivateKey: other.privateKey },
      },
      fakeNagad().f,
    )
    // Nagad would refuse the signature first; with any answer we still can't decrypt it.
    await expect(wrong.start(start)).rejects.toThrow()
  })

  it.each([
    ["Success", "paid"],
    ["Aborted", "cancelled"],
    ["Failed", "failed"],
    ["Ready", "pending"],
  ])("verify status %s means %s, with our code back and the amount", async (status, state) => {
    const { f } = fakeNagad({
      merchantId: "683002007104225",
      orderId: "20261021000004K7Q2XM",
      paymentRefId: "MDEwMjEw-REF1",
      amount: "1499.50",
      issuerPaymentRefNo: "NG1234XYZ",
      status,
      statusCode: status === "Success" ? "000" : "001",
    })
    const r = await gw(f).confirm({ reference: "MDEwMjEw-REF1", code: CODE })
    expect(r).toMatchObject({
      state,
      code: CODE,
      amount: 1499.5,
      currency: "BDT",
      txnId: "NG1234XYZ",
    })
    if (state === "paid") expect(judge({ code: CODE, amount: 1499.5 }, r).status).toBe("paid")
  })

  it("a payment for another order or amount goes to review, not paid", async () => {
    const { f } = fakeNagad({
      orderId: "SOMETHINGELSE",
      amount: "10.00",
      status: "Success",
      issuerPaymentRefNo: "NG1",
    })
    const r = await gw(f).confirm({ reference: "MDEwMjEw-REF1", code: CODE })
    expect(judge({ code: CODE, amount: 1499.5 }, r).status).toBe("review")
  })

  it("has no refund API: those are paid back by hand", async () => {
    const { f, seen } = fakeNagad()
    await expect(gw(f).refund()).rejects.toThrow(/by hand/)
    expect(seen).toHaveLength(0)
  })
})
