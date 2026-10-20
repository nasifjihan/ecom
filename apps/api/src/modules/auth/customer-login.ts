/**
 * Customer sign-in besides email and password: the store's switches (Settings → Customer sign-in),
 * signing in with a code sent by email, and Google / Facebook sign-in. Phone codes are in the
 * SMS module.
 *
 * Google / Facebook: the storefront asks for the provider's address (start), the provider sends
 * the customer back to `<storefront>/account/oauth/callback` with a code, and the storefront
 * hands that code to finish. The `state` is signed here, lasts 10 minutes and names the store,
 * provider and return address; the storefront also checks it is the one it started with.
 */
import jwt from "jsonwebtoken"
import { z } from "zod"
import type { StoreLoginSetting } from "@prisma/client"
import { decrypt, encrypt, env, logger, prisma } from "../../config"
import { BadRequestError, UnauthorizedError } from "../../core"
import { isBanned } from "../customers/customer.rules"
import { EmailService } from "../notifications"
import { SmsService } from "../sms/sms.service"
import type { Fetch } from "../sms/sms.providers"
import { storefrontInfo } from "../storefronts/storefronts.context"
import { issueLoginCode, LOGIN_CODE_TTL_MINUTES, useLoginCode } from "./login-codes"
import {
  authorizeUrl,
  fetchProfile,
  type OAuthApp,
  type OAuthProfile,
  type OAuthProvider,
} from "./oauth.providers"

const ProviderKeys = z.object({
  enabled: z.boolean().optional(),
  clientId: z.string().trim().max(200).nullish(),
  /** Blank keeps what's stored. */
  clientSecret: z.string().trim().max(500).optional(),
})
export const SaveLoginSettingsDto = z.object({
  emailCode: z.boolean().optional(),
  google: ProviderKeys.optional(),
  facebook: ProviderKeys.optional(),
  socialTestMode: z.boolean().optional(),
})
export type SaveLoginSettingsDto = z.infer<typeof SaveLoginSettingsDto>

export const EmailCodeRequestDto = z.object({ email: z.string().trim().toLowerCase().email() })
export const EmailCodeVerifyDto = z.object({
  email: z.string().trim().toLowerCase().email(),
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code"),
  firstName: z.string().trim().max(60).optional(),
  lastName: z.string().trim().max(60).optional(),
})
export type EmailCodeVerifyDto = z.infer<typeof EmailCodeVerifyDto>

export const OAuthStartDto = z.object({ next: z.string().max(500).optional() })
export const OAuthFinishDto = z.object({
  code: z.string().min(1).max(2000),
  state: z.string().min(1).max(4000),
})

/** Where providers send customers back to, on every storefront address. */
export const OAUTH_CALLBACK_PATH = "/account/oauth/callback"
const STATE_TTL = "10m"
const stateSecret = () => `${env.JWT_CUSTOMER_REFRESH_SECRET}:oauth-state`
const testModeAllowed = () => env.NODE_ENV !== "production"

/** Blank names become "Customer", as phone sign-in does. */
const firstNameOr = (v?: string) => (v?.trim() ? v.trim() : "Customer")
const hint = (v: string | null) => (v ? `••••${v.slice(-4)}` : null)
/** Only a path on the storefront itself, never another site. */
const safeNext = (n: string | undefined) =>
  n?.startsWith("/") && !n.startsWith("//") ? n : "/account"

const KEYS = {
  google: { enabled: "googleEnabled", id: "googleClientId", secret: "googleClientSecret" },
  facebook: { enabled: "facebookEnabled", id: "facebookAppId", secret: "facebookAppSecret" },
} as const

export class CustomerLoginService {
  constructor(
    private readonly storeId: bigint,
    private readonly doFetch: Fetch = fetch,
  ) {}

  private row() {
    return prisma.storeLoginSetting.findUnique({ where: { storeId: this.storeId } })
  }

  /** The keys to use for a provider, "test" in test mode, or null when it can't be used. */
  private app(row: StoreLoginSetting | null, provider: OAuthProvider): OAuthApp | "test" | null {
    const k = KEYS[provider]
    if (!row?.[k.enabled]) return null
    if (row.socialTestMode && testModeAllowed()) return "test"
    const clientId = row[k.id]
    const clientSecret = decrypt(row[k.secret])
    return clientId && clientSecret ? { clientId, clientSecret } : null
  }

  /** The admin's view: each switch, key hints, and the return addresses to give the providers. */
  async settings() {
    const [row, sms, domains] = await Promise.all([
      this.row(),
      new SmsService(this.storeId).settings(),
      prisma.domain.findMany({
        where: { storeId: this.storeId, type: { not: "admin" } },
        select: { hostname: true },
        orderBy: [{ primary: "desc" }, { id: "asc" }],
      }),
    ])
    const provider = (p: OAuthProvider) => ({
      enabled: row?.[KEYS[p].enabled] ?? false,
      clientId: row?.[KEYS[p].id] ?? null,
      secretHint: hint(decrypt(row?.[KEYS[p].secret])),
      ready: this.app(row, p) !== null,
    })
    return {
      emailCode: row?.emailCode ?? false,
      phoneOtp: sms.phoneOtpLogin && sms.provider !== "log",
      smsProvider: sms.provider,
      google: provider("google"),
      facebook: provider("facebook"),
      socialTestMode: (row?.socialTestMode ?? false) && testModeAllowed(),
      testModeAllowed: testModeAllowed(),
      redirectUris: domains.map(
        (d) =>
          `${/^(localhost|127\.0\.0\.1)(:|$)/.test(d.hostname) ? "http" : "https"}://${d.hostname}${OAUTH_CALLBACK_PATH}`,
      ),
    }
  }

  async save(input: SaveLoginSettingsDto) {
    if (input.socialTestMode && !testModeAllowed())
      throw new BadRequestError("Test mode can't be used on the live site", "VALIDATION_FAILED")
    const row = await this.row()
    const data: Partial<Record<string, string | boolean | null>> = {}
    if (input.emailCode !== undefined) data.emailCode = input.emailCode
    if (input.socialTestMode !== undefined) data.socialTestMode = input.socialTestMode
    for (const p of ["google", "facebook"] as const) {
      const v = input[p]
      if (!v) continue
      const k = KEYS[p]
      if (v.enabled !== undefined) data[k.enabled] = v.enabled
      if (v.clientId !== undefined) data[k.id] = v.clientId === "" ? null : v.clientId // blank clears it
      if (v.clientSecret) data[k.secret] = encrypt(v.clientSecret)
      const testMode = (data.socialTestMode ?? row?.socialTestMode ?? false) && testModeAllowed()
      const enabled = data[k.enabled] ?? row?.[k.enabled] ?? false
      const id = data[k.id] === undefined ? row?.[k.id] : data[k.id]
      const secret = data[k.secret] ?? row?.[k.secret]
      if (enabled && !testMode && !(id && secret))
        throw new BadRequestError(
          `Add the ${p === "google" ? "Google client ID" : "Facebook app ID"} and secret first${testModeAllowed() ? ", or use test mode" : ""}`,
          "VALIDATION_FAILED",
        )
    }
    await prisma.storeLoginSetting.upsert({
      where: { storeId: this.storeId },
      create: { storeId: this.storeId, ...data },
      update: data,
    })
    return this.settings()
  }

  /** Which ways a customer can sign in, for the storefront's sign-in page. */
  async methods(storefrontId?: bigint) {
    const [row, phoneOtp, sf] = await Promise.all([
      this.row(),
      new SmsService(this.storeId).phoneLoginEnabled(),
      storefrontInfo(this.storeId, storefrontId),
    ])
    const social = (p: OAuthProvider) => sf.socialLogin && this.app(row, p) !== null
    return {
      email: true,
      phoneOtp,
      emailCode: row?.emailCode ?? false,
      google: social("google"),
      facebook: social("facebook"),
      socialTestMode: (row?.socialTestMode ?? false) && testModeAllowed(),
    }
  }

  // ------------------------------------------------------------------ email code

  async requestEmailCode(email: string, ip: string | null) {
    if (!(await this.row())?.emailCode)
      throw new BadRequestError(
        "Signing in with an email code isn't turned on for this shop",
        "VALIDATION_FAILED",
      )
    const code = await issueLoginCode(this.storeId, email, ip)
    const c = await prisma.customer.findUnique({
      where: { storeId_email: { storeId: this.storeId, email } },
      select: { firstName: true },
    })
    const sent = await new EmailService(this.storeId).customerLoginCode(
      email,
      c?.firstName.trim() ? c.firstName : "there",
      code,
      LOGIN_CODE_TTL_MINUTES,
    )
    if (!sent)
      throw new BadRequestError(
        "We couldn't send the code. Check the email address.",
        "VALIDATION_FAILED",
      )
    return { expiresInMinutes: LOGIN_CODE_TTL_MINUTES }
  }

  /** Checks the code and returns the customer to sign in, creating an account for a new email. */
  async verifyEmailCode(dto: EmailCodeVerifyDto) {
    await useLoginCode(this.storeId, dto.email, dto.code)
    return this.customerForEmail(dto.email, dto)
  }

  // ------------------------------------------------------------------ Google / Facebook

  /**
   * The storefront address a request comes from, if it is one of this store's domains (any
   * localhost address outside production). Providers send the customer back there.
   */
  private async callbackFor(origin: string | undefined) {
    let url: URL
    try {
      url = new URL(origin ?? "")
    } catch {
      throw new BadRequestError("Open the sign-in page on the shop's website", "VALIDATION_FAILED")
    }
    const host = url.host.toLowerCase().replace(/^www\./, "")
    const local = /^(localhost|127\.0\.0\.1)$/.test(url.hostname)
    const known = await prisma.domain.count({
      where: {
        storeId: this.storeId,
        type: { not: "admin" },
        hostname: { in: [host, host.split(":")[0]!] },
      },
    })
    if (!known && !(local && testModeAllowed()))
      throw new BadRequestError("This web address isn't one of the shop's", "VALIDATION_FAILED")
    return `${url.origin}${OAUTH_CALLBACK_PATH}`
  }

  /** The provider's sign-in address to send the customer to, with a signed state. */
  async startOAuth(
    provider: OAuthProvider,
    origin: string | undefined,
    next?: string,
    storefrontId?: bigint,
  ) {
    const methods = await this.methods(storefrontId)
    const app = this.app(await this.row(), provider)
    if (!methods[provider] || !app)
      throw new BadRequestError(
        `Signing in with ${provider === "google" ? "Google" : "Facebook"} isn't turned on here`,
        "VALIDATION_FAILED",
      )
    const redirectUri = await this.callbackFor(origin)
    const state = jwt.sign(
      { sid: String(this.storeId), p: provider, r: redirectUri, n: safeNext(next) },
      stateSecret(),
      {
        algorithm: "HS256",
        expiresIn: STATE_TTL,
        audience: "customer-oauth",
        issuer: "ecom-platform",
      },
    )
    return { url: authorizeUrl(provider, app, redirectUri, state), state }
  }

  /** Checks the state, gets the profile from the provider, and returns the customer to sign in. */
  async finishOAuth(code: string, state: string, origin: string | undefined) {
    const invalid = () =>
      new UnauthorizedError(
        "That sign-in link has expired. Please try again.",
        "AUTH_INVALID_TOKEN",
      )
    let s: { sid: string; p: OAuthProvider; r: string; n: string }
    try {
      s = jwt.verify(state, stateSecret(), {
        algorithms: ["HS256"],
        audience: "customer-oauth",
        issuer: "ecom-platform",
      }) as typeof s
    } catch {
      throw invalid()
    }
    if (s.sid !== String(this.storeId) || s.r !== (await this.callbackFor(origin))) throw invalid()
    const app = this.app(await this.row(), s.p)
    if (!app) throw invalid()
    let profile: OAuthProfile
    try {
      profile = await fetchProfile(s.p, app, s.r, code, this.doFetch)
    } catch (err) {
      logger.warn({ provider: s.p, err: (err as Error).message }, "Social sign-in failed")
      throw new UnauthorizedError(
        `${s.p === "google" ? "Google" : "Facebook"} didn't confirm the sign-in. Please try again.`,
        "AUTH_CREDENTIALS_INVALID",
      )
    }
    return { ...(await this.customerForProfile(s.p, profile)), next: s.n }
  }

  /**
   * The account for a provider's profile: the one already linked to it; else the account with
   * its confirmed email (then linked); else a new account.
   */
  async customerForProfile(provider: OAuthProvider, p: OAuthProfile) {
    const where = {
      storeId_provider_subject: { storeId: this.storeId, provider, subject: p.subject },
    }
    const linked = await prisma.customerIdentity.findUnique({ where, include: { customer: true } })
    if (linked) {
      if (isBanned(linked.customer.status))
        throw new UnauthorizedError("This account is suspended", "AUTH_ACCOUNT_SUSPENDED")
      await prisma.customerIdentity.update({
        where: { id: linked.id },
        data: { lastUsedAt: new Date() },
      })
      const customer = await prisma.customer.update({
        where: { id: linked.customerId },
        data: { lastLoginAt: new Date() },
      })
      return { customer, created: false }
    }
    const name = { firstName: p.firstName, lastName: p.lastName }
    const r = p.email
      ? await this.customerForEmail(p.email, name)
      : {
          customer: await prisma.customer.create({
            data: {
              storeId: this.storeId,
              firstName: firstNameOr(p.firstName),
              lastName: p.lastName.trim(),
              lastLoginAt: new Date(),
            },
          }),
          created: true,
        }
    await prisma.customerIdentity.create({
      data: {
        storeId: this.storeId,
        customerId: r.customer.id,
        provider,
        subject: p.subject,
        email: p.email,
      },
    })
    return r
  }

  /**
   * The account for an email the customer just proved is theirs: found (a guest record becomes a
   * full account) or created.
   */
  async customerForEmail(email: string, name?: { firstName?: string; lastName?: string }) {
    const found = await prisma.customer.findUnique({
      where: { storeId_email: { storeId: this.storeId, email } },
    })
    if (found) {
      if (isBanned(found.status))
        throw new UnauthorizedError("This account is suspended", "AUTH_ACCOUNT_SUSPENDED")
      const customer = await prisma.customer.update({
        where: { id: found.id },
        data: {
          lastLoginAt: new Date(),
          isGuest: false,
          ...(found.firstName ? {} : { firstName: firstNameOr(name?.firstName) }),
        },
      })
      return { customer, created: false }
    }
    const customer = await prisma.customer.create({
      data: {
        storeId: this.storeId,
        email,
        firstName: firstNameOr(name?.firstName),
        lastName: name?.lastName?.trim() ?? "",
        lastLoginAt: new Date(),
      },
    })
    return { customer, created: true }
  }
}
