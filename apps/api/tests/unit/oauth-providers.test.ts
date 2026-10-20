import { describe, expect, it } from "vitest"
import { authorizeUrl, fetchProfile, TEST_CODE } from "../../src/modules/auth/oauth.providers"

const app = { clientId: "cid", clientSecret: "shh" }
const back = "https://shop.example.com/account/oauth/callback"

/** A fetch that answers each URL prefix with a JSON body, and records what was asked. */
function fakeFetch(answers: Record<string, unknown>, status = 200) {
  const calls: string[] = []
  const f = ((input: string | URL, init?: RequestInit) => {
    const url = String(input)
    calls.push(`${init?.method ?? "GET"} ${url} ${init?.body instanceof URLSearchParams ? init.body.toString() : ""}`)
    const key = Object.keys(answers).find((k) => url.startsWith(k))
    return Promise.resolve(
      new Response(JSON.stringify(key ? answers[key] : {}), { status: key ? status : 404 }),
    )
  }) as typeof fetch
  return { f, calls }
}

describe("authorizeUrl", () => {
  it("sends Google customers to Google with the app, return address, state and scopes", () => {
    const u = new URL(authorizeUrl("google", app, back, "st"))
    expect(u.origin).toBe("https://accounts.google.com")
    expect(Object.fromEntries(u.searchParams)).toMatchObject({
      client_id: "cid",
      redirect_uri: back,
      state: "st",
      response_type: "code",
      scope: "openid email profile",
    })
  })
  it("asks Facebook for the email", () => {
    const u = new URL(authorizeUrl("facebook", app, back, "st"))
    expect(u.hostname).toBe("www.facebook.com")
    expect(u.searchParams.get("scope")).toBe("email,public_profile")
  })
  it("in test mode goes straight back to the storefront with the test code", () => {
    const u = new URL(authorizeUrl("google", "test", back, "st"))
    expect(`${u.origin}${u.pathname}`).toBe(back)
    expect(u.searchParams.get("code")).toBe(TEST_CODE)
  })
})

describe("fetchProfile", () => {
  it("swaps a Google code and keeps only a confirmed email", async () => {
    const { f, calls } = fakeFetch({
      "https://oauth2.googleapis.com/token": { access_token: "at" },
      "https://openidconnect.googleapis.com/v1/userinfo": {
        sub: "g1",
        email: "A@Example.com",
        email_verified: true,
        given_name: "Ayesha",
        family_name: "Rahman",
      },
    })
    expect(await fetchProfile("google", app, back, "c0de", f)).toEqual({
      subject: "g1",
      email: "a@example.com",
      firstName: "Ayesha",
      lastName: "Rahman",
    })
    expect(calls[0]).toContain("client_secret=shh")
    expect(calls[0]).toContain("code=c0de")
  })
  it("drops a Google email that isn't confirmed", async () => {
    const { f } = fakeFetch({
      "https://oauth2.googleapis.com/token": { access_token: "at" },
      "https://openidconnect.googleapis.com/v1/userinfo": {
        sub: "g2",
        email: "x@y.com",
        email_verified: false,
      },
    })
    expect((await fetchProfile("google", app, back, "c", f)).email).toBeNull()
  })
  it("reads a Facebook profile, with or without an email", async () => {
    const { f } = fakeFetch({
      "https://graph.facebook.com/v19.0/oauth/access_token": { access_token: "at" },
      "https://graph.facebook.com/v19.0/me": { id: "f1", first_name: "Karim", last_name: "Mia" },
    })
    expect(await fetchProfile("facebook", app, back, "c", f)).toEqual({
      subject: "f1",
      email: null,
      firstName: "Karim",
      lastName: "Mia",
    })
  })
  it("throws when the provider refuses the code", async () => {
    const { f } = fakeFetch(
      { "https://oauth2.googleapis.com/token": { error: "invalid_grant" } },
      400,
    )
    await expect(fetchProfile("google", app, back, "bad", f)).rejects.toThrow(/failed/)
  })
  it("test mode only takes the test code", async () => {
    expect((await fetchProfile("facebook", "test", back, TEST_CODE)).email).toBe(
      "facebook.tester@example.com",
    )
    await expect(fetchProfile("facebook", "test", back, "real-code")).rejects.toThrow()
  })
})
