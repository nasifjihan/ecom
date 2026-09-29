import { beforeAll, describe, expect, it } from "vitest"
import { env } from "../../src/config"
import {
  bdMobile,
  eventSettings,
  hashOtp,
  maskOtp,
  newOtp,
  otpMatches,
  otpWait,
  phoneVariants,
  renderSms,
  smsMoney,
  smsParts,
  SMS_EVENT_INFO,
} from "../../src/modules/sms/sms.rules"
import { intl, smsProvider, SmsError, type Fetch } from "../../src/modules/sms/sms.providers"

beforeAll(() => {
  // A developer's .env may point these at the local mock.
  env.BULKSMSBD_API_URL = undefined
  env.ALPHASMS_API_URL = undefined
  env.SSLWIRELESS_API_URL = undefined
})

describe("bdMobile", () => {
  it.each([
    ["01712345678", "01712345678"],
    ["+880 1712-345678", "01712345678"],
    ["8801712345678", "01712345678"],
    ["008801912345678", "01912345678"],
    ["1712345678", "01712345678"],
    ["01212345678", null],
    ["0171234567", null],
    ["", null],
    [null, null],
  ])("%s -> %s", (v, want) => {
    expect(bdMobile(v)).toBe(want)
  })

  it("lists the forms a stored number may take", () => {
    expect(phoneVariants("01712345678")).toEqual([
      "01712345678",
      "8801712345678",
      "+8801712345678",
      "+880 1712345678",
      "880 1712345678",
    ])
    expect(intl("01712345678")).toBe("8801712345678")
  })
})

describe("smsParts", () => {
  it.each([
    ["", false, 0],
    ["a".repeat(160), false, 1],
    ["a".repeat(161), false, 2],
    ["a".repeat(306), false, 2],
    ["a".repeat(307), false, 3],
    ["€".repeat(80), false, 1], // extension characters count double
    ["€".repeat(81), false, 2],
    ["আপনার অর্ডার", true, 1],
    ["অ".repeat(70), true, 1],
    ["অ".repeat(71), true, 2],
    ["Order ✅", true, 1],
  ])("%j -> unicode %s, %i parts", (text, unicode, parts) => {
    const r = smsParts(text)
    expect(r.unicode).toBe(unicode)
    expect(r.parts).toBe(parts)
  })
})

describe("templates", () => {
  it("writes amounts as Tk so the SMS stays plain text", () => {
    expect(smsMoney(4588.5)).toBe("Tk 4,588.50")
    expect(smsMoney(1200)).toBe("Tk 1,200")
    expect(smsParts(`Total ${smsMoney(1200)}`).unicode).toBe(false)
    for (const e of Object.values(SMS_EVENT_INFO)) expect(smsParts(e.template).unicode).toBe(false)
  })

  it("fills placeholders and tidies the gaps left by empty ones", () => {
    const t = SMS_EVENT_INFO.order_shipped.template
    expect(
      renderSms(t, {
        order: "#1001",
        courier: " with Pathao",
        tracking: "Track: https://t/1",
        store: "Fashion BD",
      }),
    ).toBe("Your order #1001 is on the way with Pathao. Track: https://t/1 - Fashion BD")
    expect(renderSms(t, { order: "#1001", courier: "", tracking: "", store: "Fashion BD" })).toBe(
      "Your order #1001 is on the way. - Fashion BD",
    )
  })

  it("leaves unknown placeholders as typed", () => {
    expect(renderSms("Hi {name}, {unknown}", { name: "Rina" })).toBe("Hi Rina, {unknown}")
  })

  it("merges stored settings over the defaults", () => {
    const s = eventSettings({
      order_placed: { enabled: false },
      order_delivered: { template: "  " },
      bogus: { enabled: true },
    })
    expect(s.order_placed.enabled).toBe(false)
    expect(s.order_placed.template).toBe(SMS_EVENT_INFO.order_placed.template)
    expect(s.order_delivered.template).toBe(SMS_EVENT_INFO.order_delivered.template)
    expect(s.order_shipped.enabled).toBe(true)
    expect(Object.keys(s)).not.toContain("bogus")
    expect(eventSettings(null).order_confirmed.enabled).toBe(false)
  })
})

describe("one-time codes", () => {
  it("makes 6-digit codes", () => {
    for (let i = 0; i < 50; i++) expect(newOtp()).toMatch(/^\d{6}$/)
  })

  it("matches only the same code, store and number", () => {
    const h = hashOtp("secret", 1n, "01712345678", "123456")
    expect(h).not.toContain("123456")
    expect(otpMatches("secret", 1n, "01712345678", "123456", h)).toBe(true)
    expect(otpMatches("secret", 1n, "01712345678", "123457", h)).toBe(false)
    expect(otpMatches("secret", 2n, "01712345678", "123456", h)).toBe(false)
    expect(otpMatches("secret", 1n, "01812345678", "123456", h)).toBe(false)
    expect(otpMatches("other", 1n, "01712345678", "123456", h)).toBe(false)
  })

  it("masks the code in the log", () => {
    expect(maskOtp("123456 is your code. 123456", "123456")).toBe("•••••• is your code. ••••••")
  })

  const now = new Date("2026-09-27T12:00:00Z")
  const ago = (s: number) => new Date(now.getTime() - s * 1000)
  it.each([
    [[], 0],
    [[ago(30)], 30],
    [[ago(61)], 0],
    [[ago(3000), ago(2500), ago(2000), ago(1500), ago(100)], 600],
    [[ago(3700), ago(2500), ago(2000), ago(1500), ago(100)], 0],
  ])("wait with sends %j -> %i s", (recent, want) => {
    expect(otpWait(recent, now)).toBe(want)
  })
})

// ------------------------------------------------------------------ providers

interface Call {
  url: string
  init?: RequestInit
}
function fakeFetch(reply: unknown, status = 200) {
  const calls: Call[] = []
  const f = ((url: string, init?: RequestInit) => {
    calls.push({ url, init })
    return Promise.resolve(
      new Response(typeof reply === "string" ? reply : JSON.stringify(reply), { status }),
    )
  }) as unknown as Fetch
  return { f, calls }
}

describe("providers", () => {
  it("log sends nothing", async () => {
    const { f, calls } = fakeFetch({})
    expect(await smsProvider("log", {}, null, f).send("01712345678", "hi", "S1")).toEqual({
      ref: null,
      logged: true,
    })
    expect(calls).toHaveLength(0)
  })

  it("BulkSMSBD: GET with key, sender ID and the international number", async () => {
    const { f, calls } = fakeFetch({
      response_code: 202,
      success_message: "SMS Submitted Successfully",
      error_message: "",
    })
    await smsProvider("bulksmsbd", { apiKey: "K" }, "FASHIONBD", f).send(
      "01712345678",
      "Hi & bye",
      "S1",
    )
    const u = new URL(calls[0]!.url)
    expect(u.origin + u.pathname).toBe("https://bulksmsbd.net/api/smsapi")
    expect(Object.fromEntries(u.searchParams)).toEqual({
      api_key: "K",
      type: "text",
      number: "8801712345678",
      senderid: "FASHIONBD",
      message: "Hi & bye",
    })
  })

  it("BulkSMSBD: reports the provider's error", async () => {
    const { f } = fakeFetch({ response_code: 1007, success_message: "", error_message: "" })
    await expect(
      smsProvider("bulksmsbd", { apiKey: "K" }, "X", f).send("01712345678", "hi", "S1"),
    ).rejects.toThrow("Not enough SMS balance")
    const { f: f2 } = fakeFetch({
      response_code: 1032,
      error_message: "IP not whitelisted: 1.2.3.4",
    })
    await expect(
      smsProvider("bulksmsbd", { apiKey: "K" }, "X", f2).send("01712345678", "hi", "S1"),
    ).rejects.toThrow("IP not whitelisted: 1.2.3.4")
  })

  it("BulkSMSBD needs a sender ID and key", () => {
    expect(() => smsProvider("bulksmsbd", { apiKey: "K" }, null)).toThrow(SmsError)
    expect(() => smsProvider("bulksmsbd", {}, "X")).toThrow("Add the BulkSMSBD API key")
  })

  it("Alpha SMS: form POST, request id as ref", async () => {
    const { f, calls } = fakeFetch({
      error: 0,
      msg: "Request successfully submitted",
      data: { request_id: 99 },
    })
    const r = await smsProvider("alphasms", { apiKey: "K" }, null, f).send(
      "01712345678",
      "hi",
      "S1",
    )
    expect(r.ref).toBe("99")
    expect(calls[0]!.url).toBe("https://api.sms.net.bd/sendsms")
    expect(Object.fromEntries(new URLSearchParams(String(calls[0]!.init!.body as string)))).toEqual(
      {
        api_key: "K",
        msg: "hi",
        to: "8801712345678",
      },
    )
    const { f: f2 } = fakeFetch({ error: 405, msg: "Insufficient balance" })
    await expect(
      smsProvider("alphasms", { apiKey: "K" }, "SHOP", f2).send("01712345678", "hi", "S1"),
    ).rejects.toThrow("Insufficient balance")
  })

  it("SSL Wireless: JSON POST with our message id, reference id back", async () => {
    const { f, calls } = fakeFetch({
      status: "SUCCESS",
      status_code: 200,
      error_message: "",
      smsinfo: [{ reference_id: "R1" }],
    })
    const r = await smsProvider("sslwireless", { apiToken: "T", sid: "SHOP" }, null, f).send(
      "01712345678",
      "hi",
      "S42",
    )
    expect(r.ref).toBe("R1")
    expect(calls[0]!.url).toBe("https://smsplus.sslwireless.com/api/v3/send-sms")
    expect(JSON.parse(String(calls[0]!.init!.body as string))).toEqual({
      api_token: "T",
      sid: "SHOP",
      msisdn: "8801712345678",
      sms: "hi",
      csms_id: "S42",
    })
    const { f: f2 } = fakeFetch({
      status: "FAILED",
      status_code: 4001,
      error_message: "Unauthorized",
    })
    await expect(
      smsProvider("sslwireless", { apiToken: "T", sid: "S" }, null, f2).send(
        "01712345678",
        "hi",
        "S1",
      ),
    ).rejects.toThrow("Unauthorized")
  })

  it("turns a network failure or non-JSON reply into a readable error", async () => {
    const down = (() => Promise.reject(new Error("ECONNREFUSED"))) as unknown as Fetch
    await expect(
      smsProvider("alphasms", { apiKey: "K" }, null, down).send("01712345678", "hi", "S1"),
    ).rejects.toThrow("Couldn't reach the SMS provider")
    const { f } = fakeFetch("<html>502</html>", 502)
    await expect(
      smsProvider("alphasms", { apiKey: "K" }, null, f).send("01712345678", "hi", "S1"),
    ).rejects.toThrow("isn't JSON")
  })
})
