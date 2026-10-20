/**
 * Google and Facebook sign-in (OAuth 2 authorization-code flow): the address to send the customer
 * to, and swapping the code the provider sends back for the person's profile. In test mode no
 * provider is called and the profile is made up.
 */
import type { Fetch } from "../sms/sms.providers"

export const OAUTH_PROVIDERS = ["google", "facebook"] as const
export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number]
export const isOAuthProvider = (p: string): p is OAuthProvider =>
  (OAUTH_PROVIDERS as readonly string[]).includes(p)

export interface OAuthApp {
  clientId: string
  clientSecret: string
}

export interface OAuthProfile {
  subject: string
  /** Only an address the provider says is confirmed. */
  email: string | null
  firstName: string
  lastName: string
}

/** The code test mode sends back instead of a provider's. */
export const TEST_CODE = "test-mode"
const FB = "https://graph.facebook.com/v19.0"

export function authorizeUrl(
  provider: OAuthProvider,
  app: OAuthApp | "test",
  redirectUri: string,
  state: string,
): string {
  if (app === "test") {
    const u = new URL(redirectUri)
    u.searchParams.set("code", TEST_CODE)
    u.searchParams.set("state", state)
    return u.toString()
  }
  const u =
    provider === "google"
      ? new URL("https://accounts.google.com/o/oauth2/v2/auth")
      : new URL("https://www.facebook.com/v19.0/dialog/oauth")
  u.searchParams.set("client_id", app.clientId)
  u.searchParams.set("redirect_uri", redirectUri)
  u.searchParams.set("response_type", "code")
  u.searchParams.set("state", state)
  u.searchParams.set(
    "scope",
    provider === "google" ? "openid email profile" : "email,public_profile",
  )
  if (provider === "google") u.searchParams.set("prompt", "select_account")
  return u.toString()
}

class OAuthError extends Error {}

async function json(res: Response, what: string): Promise<Record<string, unknown>> {
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) throw new OAuthError(`${what} failed (${res.status})`)
  return body
}

const str = (v: unknown) => (typeof v === "string" ? v : "")

/** Swaps the code for the person's profile. Throws when the provider refuses. */
export async function fetchProfile(
  provider: OAuthProvider,
  app: OAuthApp | "test",
  redirectUri: string,
  code: string,
  doFetch: Fetch = fetch,
): Promise<OAuthProfile> {
  if (app === "test") {
    if (code !== TEST_CODE) throw new OAuthError("Not a test-mode code")
    return {
      subject: `test-${provider}-1`,
      email: `${provider}.tester@example.com`,
      firstName: provider === "google" ? "Google" : "Facebook",
      lastName: "Tester",
    }
  }
  if (provider === "google") {
    const token = await json(
      await doFetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: app.clientId,
          client_secret: app.clientSecret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      }),
      "Google sign-in",
    )
    const me = await json(
      await doFetch("https://openidconnect.googleapis.com/v1/userinfo", {
        headers: { authorization: `Bearer ${str(token.access_token)}` },
      }),
      "Google profile",
    )
    if (!str(me.sub)) throw new OAuthError("Google gave no account id")
    return {
      subject: str(me.sub),
      email: me.email_verified === true && str(me.email) ? str(me.email).toLowerCase() : null,
      firstName: str(me.given_name),
      lastName: str(me.family_name),
    }
  }
  const t = new URL(`${FB}/oauth/access_token`)
  t.search = new URLSearchParams({
    client_id: app.clientId,
    client_secret: app.clientSecret,
    redirect_uri: redirectUri,
    code,
  }).toString()
  const token = await json(await doFetch(t), "Facebook sign-in")
  const m = new URL(`${FB}/me`)
  m.search = new URLSearchParams({
    fields: "id,first_name,last_name,email",
    access_token: str(token.access_token),
  }).toString()
  const me = await json(await doFetch(m), "Facebook profile")
  if (!str(me.id)) throw new OAuthError("Facebook gave no account id")
  return {
    subject: str(me.id),
    // Facebook only shares an email the person has confirmed.
    email: str(me.email) ? str(me.email).toLowerCase() : null,
    firstName: str(me.first_name),
    lastName: str(me.last_name),
  }
}
