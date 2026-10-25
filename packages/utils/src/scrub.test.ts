import { describe, expect, it } from "vitest"
import { scrub, scrubEvent, scrubText, sentryOptions } from "./scrub"

describe("scrub", () => {
  it("removes private fields wherever they are", () => {
    const event = {
      message: "Login failed",
      request: {
        url: "https://api.shop.com/api/auth/admin/login",
        headers: { Authorization: "Bearer abc", Cookie: "admin_refresh=xyz", "User-Agent": "Chrome" },
        data: { email: "owner@shop.com", password: "hunter2", code: "123456", nested: [{ apiKey: "k", ok: 1 }] },
        query_string: "token=secret-reset-token",
      },
      user: { id: "42", email: "owner@shop.com", ip_address: "1.2.3.4" },
      extra: { gateway: { storePassword: "x", merchantId: "m-1" }, statusCode: 500, errorCode: "AUTH_2FA_INVALID", backupCodes: ["a"] },
    }
    const out = scrubEvent(event)
    expect(out.request.headers).toEqual({ Authorization: "[filtered]", Cookie: "[filtered]", "User-Agent": "Chrome" })
    expect(out.request.data).toEqual({ email: "[filtered]", password: "[filtered]", code: "[filtered]", nested: [{ apiKey: "[filtered]", ok: 1 }] })
    expect(out.request.query_string).toBe("[filtered]")
    expect(out.user).toEqual({ id: "42" })
    expect(out.extra).toEqual({ gateway: { storePassword: "[filtered]", merchantId: "m-1" }, statusCode: 500, errorCode: "AUTH_2FA_INVALID", backupCodes: "[filtered]" })
    expect(out.request.url).toBe("https://api.shop.com/api/auth/admin/login")
    // A query string anywhere (the request URL, a breadcrumb, a message) is dropped.
    expect(scrubEvent({ request: { url: "https://api.shop.com/api/x/abc?token=reset-1&id=5" } }).request.url).toBe(
      "https://api.shop.com/api/x/abc?[filtered]",
    )
    expect(scrubText('fetch "https://shop.com/reset?token=abc" failed')).toBe('fetch "https://shop.com/reset?[filtered]" failed')
    // The original isn't changed.
    expect(event.request.data.password).toBe("hunter2")
  })

  it("masks emails and Bangladeshi mobiles in text", () => {
    expect(scrubText("SMS to 01712345678 and +8801812345678 for buyer@x.com failed")).toBe(
      "SMS to [phone] and [phone] for [email] failed",
    )
    expect(scrub({ message: "Order 20261025000001 by 01712345678" })).toEqual({ message: "Order 20261025000001 by [phone]" })
  })
})

describe("sentryOptions", () => {
  // Sentry 11 collects these unless told not to.
  it("lets Sentry collect no personal data by itself", () => {
    const d = sentryOptions("https://k@sentry.example/1", "shop").dataCollection
    expect([d.userInfo, d.cookies, d.urlQueryParams, d.stackFrameVariables, d.databaseQueryData]).toEqual([false, false, false, false, false])
    expect(d.httpBodies).toEqual([])
    expect(d.httpHeaders.request).toEqual({ allow: ["user-agent", "host", "referer", "content-type"] })
    expect("tracesSampleRate" in sentryOptions("x", "shop")).toBe(false)
  })
})
