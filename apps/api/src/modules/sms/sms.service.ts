/**
 * SMS — the store's provider settings, sending (every message is logged), order SMS for the
 * events the shop turned on, invoice links by SMS, and one-time sign-in codes for phone login.
 */
import type { Prisma, StoreSmsSetting } from "@prisma/client"
import { decrypt, encrypt, env, logger, prisma } from "../../config"
import { BadRequestError, NotFoundError, RateLimitError, UnauthorizedError } from "../../core"
import { storeBrand } from "../content/store-details"
import {
  bdMobile,
  eventSettings,
  hashOtp,
  maskOtp,
  newOtp,
  OTP_MAX_ATTEMPTS,
  OTP_TTL_MINUTES,
  otpMatches,
  otpMessage,
  otpWait,
  phoneVariants,
  renderSms,
  smsMoney,
  smsParts,
  STATUS_EVENTS,
  type EventSetting,
  type SmsEvent,
} from "./sms.rules"
import {
  isSmsProvider,
  SMS_PROVIDER_INFO,
  SmsError,
  smsProvider,
  type Fetch,
} from "./sms.providers"

export interface SmsSettingsInput {
  provider?: string
  senderId?: string | null
  /** Blank values keep what's stored. */
  credentials?: Record<string, string>
  events?: Partial<Record<SmsEvent, Partial<EventSetting>>>
  phoneOtpLogin?: boolean
}

export interface SmsLogQuery {
  page: number
  perPage: number
  kind?: string
  status?: string
  search?: string
  orderId?: bigint
}

/** The trimmed text, or `fallback` when it is missing or blank. */
const orElse = <T>(v: string | null | undefined, fallback: T): string | T =>
  v?.trim() ? v.trim() : fallback

const hint = (v: string | undefined) => (v ? `••••${v.slice(-4)}` : null)

function readCreds(row: StoreSmsSetting | null): Record<string, string> {
  if (!row?.credentials) return {}
  try {
    const plain = decrypt(row.credentials)
    const j: unknown = plain ? JSON.parse(plain) : {}
    return j && typeof j === "object" ? (j as Record<string, string>) : {}
  } catch {
    logger.warn({ storeId: String(row.storeId) }, "SMS credentials couldn't be decrypted")
    return {}
  }
}

export class SmsService {
  constructor(
    private readonly storeId: bigint,
    /** For tests: the provider's HTTP client. */
    private readonly f: Fetch = fetch,
  ) {}

  private row() {
    return prisma.storeSmsSetting.findUnique({ where: { storeId: this.storeId } })
  }

  // ================================================================ settings

  async settings() {
    const row = await this.row()
    const provider = row?.provider ?? "log"
    const creds = readCreds(row)
    return {
      provider,
      providers: Object.entries(SMS_PROVIDER_INFO).map(([code, p]) => ({ code, ...p })),
      senderId: row?.senderId ?? null,
      credentialHints: Object.fromEntries(
        (SMS_PROVIDER_INFO[isSmsProvider(provider) ? provider : "log"].fields ?? []).map((fl) => [
          fl.key,
          fl.secret ? hint(creds[fl.key]) : (creds[fl.key] ?? null),
        ]),
      ),
      events: eventSettings(row?.events),
      phoneOtpLogin: row?.phoneOtpLogin ?? false,
      lastTestAt: row?.lastTestAt?.toISOString() ?? null,
      lastError: row?.lastError ?? null,
    }
  }

  async save(input: SmsSettingsInput) {
    const row = await this.row()
    const provider = input.provider ?? row?.provider ?? "log"
    if (!isSmsProvider(provider))
      throw new BadRequestError("Unknown SMS provider", "VALIDATION_FAILED")
    const info = SMS_PROVIDER_INFO[provider]
    // Switching provider starts its keys afresh; blank fields keep the stored value.
    const creds = provider === (row?.provider ?? "log") ? readCreds(row) : {}
    for (const f of info.fields) {
      const v = input.credentials?.[f.key]?.trim()
      if (v) creds[f.key] = v
    }
    const senderId =
      input.senderId !== undefined ? orElse(input.senderId, null) : (row?.senderId ?? null)
    const events = eventSettings(row?.events)
    for (const [k, v] of Object.entries(input.events ?? {})) {
      if (!(k in events) || !v) continue
      const e = events[k as SmsEvent]
      if (typeof v.enabled === "boolean") e.enabled = v.enabled
      if (typeof v.template === "string") {
        const t = v.template.trim()
        if (t.length > 480)
          throw new BadRequestError(
            "An SMS template can be at most 480 characters",
            "VALIDATION_FAILED",
          )
        if (t) e.template = t
      }
    }
    const phoneOtpLogin = input.phoneOtpLogin ?? row?.phoneOtpLogin ?? false
    if (phoneOtpLogin && provider === "log") {
      throw new BadRequestError(
        "Phone sign-in needs a provider that actually sends SMS",
        "VALIDATION_FAILED",
      )
    }
    const data = {
      provider,
      senderId,
      credentials: Object.keys(creds).length ? encrypt(JSON.stringify(creds)) : null,
      events: events as unknown as Prisma.InputJsonValue,
      phoneOtpLogin,
    }
    await prisma.storeSmsSetting.upsert({
      where: { storeId: this.storeId },
      create: { storeId: this.storeId, ...data },
      update: data,
    })
    return this.settings()
  }

  // ================================================================ sending

  /**
   * Sends one SMS and logs it. Never throws for a provider problem: the log row says what
   * happened. `logText` is what the log keeps (one-time codes are masked).
   */
  async send(p: {
    to: string
    text: string
    kind: string
    orderId?: bigint | null
    logText?: string
  }) {
    const to = bdMobile(p.to)
    if (!to)
      throw new BadRequestError(
        "That isn't a Bangladeshi mobile number (01XXXXXXXXX)",
        "VALIDATION_FAILED",
      )
    const row = await this.row()
    const provider = row?.provider ?? "log"
    const { parts } = smsParts(p.text)
    const log = await prisma.smsMessage.create({
      data: {
        storeId: this.storeId,
        to,
        body: p.logText ?? p.text,
        kind: p.kind,
        orderId: p.orderId ?? null,
        provider,
        status: "sending",
        segments: parts,
      },
    })
    try {
      const r = await smsProvider(provider, readCreds(row), row?.senderId ?? null, this.f).send(
        to,
        p.text,
        `S${log.id}`,
      )
      return prisma.smsMessage.update({
        where: { id: log.id },
        data: { status: r.logged ? "logged" : "sent", providerRef: r.ref },
      })
    } catch (e) {
      const error = e instanceof SmsError ? e.message : "The SMS couldn't be sent"
      if (!(e instanceof SmsError)) logger.error({ err: e }, "SMS send failed")
      return prisma.smsMessage.update({ where: { id: log.id }, data: { status: "failed", error } })
    }
  }

  /** Sends a test message and remembers the outcome on the settings. */
  async test(to: string, text?: string) {
    const { brand } = await storeBrand(this.storeId)
    const msg = await this.send({
      to,
      kind: "test",
      text: orElse(text, `Test SMS from ${brand.storeName}. SMS is set up.`),
    })
    await prisma.storeSmsSetting.upsert({
      where: { storeId: this.storeId },
      create: { storeId: this.storeId, lastTestAt: new Date(), lastError: msg.error },
      update: { lastTestAt: new Date(), lastError: msg.error },
    })
    return this.view(msg)
  }

  private view(m: Prisma.SmsMessageGetPayload<object>) {
    return {
      id: String(m.id),
      to: m.to,
      body: m.body,
      kind: m.kind,
      orderId: m.orderId ? String(m.orderId) : null,
      provider: m.provider,
      status: m.status,
      providerRef: m.providerRef,
      error: m.error,
      segments: m.segments,
      createdAt: m.createdAt.toISOString(),
    }
  }

  async log(q: SmsLogQuery) {
    const where: Prisma.SmsMessageWhereInput = {
      storeId: this.storeId,
      ...(q.kind ? { kind: q.kind } : {}),
      ...(q.status ? { status: q.status } : {}),
      ...(q.orderId ? { orderId: q.orderId } : {}),
      ...(q.search
        ? {
            OR: [
              { to: { contains: q.search.replace(/[^\d]/g, "") || q.search } },
              { body: { contains: q.search, mode: "insensitive" } },
            ],
          }
        : {}),
    }
    const [total, rows, parts] = await Promise.all([
      prisma.smsMessage.count({ where }),
      prisma.smsMessage.findMany({
        where,
        orderBy: { id: "desc" },
        skip: (q.page - 1) * q.perPage,
        take: q.perPage,
      }),
      prisma.smsMessage.aggregate({
        where: {
          storeId: this.storeId,
          status: "sent",
          createdAt: { gte: new Date(Date.now() - 30 * 86400_000) },
        },
        _sum: { segments: true },
      }),
    ])
    return {
      data: rows.map((r) => this.view(r)),
      meta: { page: q.page, perPage: q.perPage, total, totalPages: Math.ceil(total / q.perPage) },
      partsLast30Days: parts._sum.segments ?? 0,
    }
  }

  /** Sends a failed message again. */
  async resend(id: bigint) {
    const m = await prisma.smsMessage.findFirst({ where: { id, storeId: this.storeId } })
    if (!m) throw new NotFoundError("SMS")
    if (m.kind === "otp")
      throw new BadRequestError(
        "Sign-in codes can't be sent again; the customer asks for a new one",
        "VALIDATION_FAILED",
      )
    return this.view(await this.send({ to: m.to, text: m.body, kind: m.kind, orderId: m.orderId }))
  }

  // ================================================================ orders

  private async orderVars(orderId: bigint) {
    const o = await prisma.order.findFirst({
      where: { id: orderId, storeId: this.storeId },
      include: { shipments: { orderBy: { createdAt: "desc" }, take: 1 } },
    })
    if (!o) return null
    const { brand, urls } = await storeBrand(this.storeId)
    const s = o.shipments[0]
    const courier = s?.providerName ?? ""
    const tracking = s?.trackingUrl ?? o.trackingUrl ?? ""
    const number = s?.trackingNumber ?? o.trackingNumber ?? ""
    return {
      order: o,
      phone: o.shippingPhone ?? o.billingPhone,
      vars: {
        name: o.shippingFirstName ?? o.billingFirstName,
        order: o.number,
        total: smsMoney(Number(o.grandTotal)),
        store: brand.storeName,
        // "Questions? Call us." when the shop has no phone in its theme settings.
        phone: brand.phone.trim() || "us",
        courier: courier ? ` with ${courier}` : "",
        tracking: tracking ? `Track: ${tracking}` : number ? `Tracking no: ${number}` : "",
        link: `${urls.storefront}/checkout/thank-you?key=${encodeURIComponent(o.orderKey)}`,
      },
    }
  }

  /** The SMS for an order event, if the shop turned it on and the order has a mobile number. */
  async orderEvent(orderId: bigint, event: SmsEvent) {
    const row = await this.row()
    const setting = eventSettings(row?.events)[event]
    if (!setting.enabled) return null
    const d = await this.orderVars(orderId)
    if (!d || !bdMobile(d.phone)) return null
    // Once per event per order (a status can be set twice, e.g. after an undo).
    const sent = await prisma.smsMessage.findFirst({
      where: { storeId: this.storeId, orderId, kind: event, status: { in: ["sent", "logged"] } },
    })
    if (sent) return null
    return this.send({
      to: d.phone!,
      text: renderSms(setting.template, d.vars),
      kind: event,
      orderId,
    })
  }

  async orderStatus(orderId: bigint, status: string) {
    const event = STATUS_EVENTS[status]
    return event ? this.orderEvent(orderId, event) : null
  }

  /** A link to the order and its invoice, sent by staff from the order page. */
  async invoice(orderId: bigint, to?: string) {
    const d = await this.orderVars(orderId)
    if (!d) throw new NotFoundError("Order")
    const phone = to ?? d.phone
    if (!bdMobile(phone))
      throw new BadRequestError(
        "The order has no Bangladeshi mobile number to send to",
        "VALIDATION_FAILED",
      )
    const text = `${d.vars.store}: your order ${d.vars.order}, total ${d.vars.total}. See the order and invoice: ${d.vars.link}`
    return this.view(await this.send({ to: phone!, text, kind: "invoice", orderId }))
  }

  // ================================================================ phone sign-in

  async phoneLoginEnabled() {
    const row = await this.row()
    return !!row?.phoneOtpLogin && row.provider !== "log"
  }

  /** Sends a sign-in code. Throttled per number (a minute apart, 5 an hour). */
  async requestOtp(rawPhone: string, ip: string | null) {
    if (!(await this.phoneLoginEnabled()))
      throw new BadRequestError(
        "Signing in by phone isn't turned on for this shop",
        "VALIDATION_FAILED",
      )
    const phone = bdMobile(rawPhone)
    if (!phone)
      throw new BadRequestError(
        "Enter a Bangladeshi mobile number, e.g. 01712345678",
        "VALIDATION_FAILED",
      )
    const recent = await prisma.phoneOtp.findMany({
      where: { storeId: this.storeId, phone, createdAt: { gt: new Date(Date.now() - 3600_000) } },
      select: { createdAt: true },
    })
    const wait = otpWait(recent.map((r) => r.createdAt))
    if (wait > 0)
      throw new RateLimitError(
        `Please wait ${wait < 120 ? `${wait} seconds` : `${Math.ceil(wait / 60)} minutes`} before asking for another code`,
      )
    // One code at a time: older ones stop working.
    await prisma.phoneOtp.updateMany({
      where: { storeId: this.storeId, phone, consumedAt: null },
      data: { consumedAt: new Date() },
    })
    const code = newOtp()
    await prisma.phoneOtp.create({
      data: {
        storeId: this.storeId,
        phone,
        codeHash: hashOtp(env.APP_ENCRYPTION_KEY, this.storeId, phone, code),
        expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60_000),
        ip,
      },
    })
    const { brand } = await storeBrand(this.storeId)
    const text = otpMessage(code, brand.storeName)
    const msg = await this.send({ to: phone, text, kind: "otp", logText: maskOtp(text, code) })
    if (msg.status === "failed")
      throw new BadRequestError(
        "We couldn't send the code right now. Please try again in a minute, or sign in with email.",
        "VALIDATION_FAILED",
      )
    return { phone, expiresInMinutes: OTP_TTL_MINUTES }
  }

  /**
   * Checks a code and returns the customer to sign in, creating one for a new number. At most
   * 5 tries per code; a used or expired code never works again.
   */
  async verifyOtp(
    rawPhone: string,
    code: string,
    name?: { firstName?: string; lastName?: string },
  ) {
    const phone = bdMobile(rawPhone)
    const bad = () =>
      new UnauthorizedError(
        "That code is wrong or has expired. Ask for a new one.",
        "AUTH_CREDENTIALS_INVALID",
      )
    if (!phone || !/^\d{6}$/.test(code)) throw bad()
    const otp = await prisma.phoneOtp.findFirst({
      where: { storeId: this.storeId, phone, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { id: "desc" },
    })
    if (!otp || otp.attempts >= OTP_MAX_ATTEMPTS) throw bad()
    if (!otpMatches(env.APP_ENCRYPTION_KEY, this.storeId, phone, code, otp.codeHash)) {
      const attempts = otp.attempts + 1
      await prisma.phoneOtp.update({
        where: { id: otp.id },
        data: { attempts, ...(attempts >= OTP_MAX_ATTEMPTS ? { consumedAt: new Date() } : {}) },
      })
      throw attempts >= OTP_MAX_ATTEMPTS
        ? new UnauthorizedError(
            "Too many wrong codes. Ask for a new one.",
            "AUTH_CREDENTIALS_INVALID",
          )
        : bad()
    }
    // Used once, even if two requests race: only the one that flips it goes on.
    const used = await prisma.phoneOtp.updateMany({
      where: { id: otp.id, consumedAt: null },
      data: { consumedAt: new Date() },
    })
    if (used.count === 0) throw bad()
    return this.customerForPhone(phone, name)
  }

  /**
   * The customer this number belongs to: an active account first (one with a password or
   * email), then the most recent record, e.g. one the shop made for a phone order.
   */
  private async customerForPhone(phone: string, name?: { firstName?: string; lastName?: string }) {
    const matches = await prisma.customer.findMany({
      where: { storeId: this.storeId, phone: { in: phoneVariants(phone) } },
      orderBy: [{ lastLoginAt: { sort: "desc", nulls: "last" } }, { id: "desc" }],
    })
    const usable = matches.filter((c) => c.status.toLowerCase() === "active")
    if (matches.length && !usable.length)
      throw new UnauthorizedError("This account is suspended", "AUTH_ACCOUNT_SUSPENDED")
    const found = usable.find((c) => !!c.passwordHash || !!c.email) ?? usable[0]
    if (found) {
      return {
        customer: await prisma.customer.update({
          where: { id: found.id },
          data: {
            lastLoginAt: new Date(),
            phone,
            isGuest: false,
            ...(found.firstName ? {} : { firstName: orElse(name?.firstName, "Customer") }),
          },
        }),
        created: false,
      }
    }
    const customer = await prisma.customer.create({
      data: {
        storeId: this.storeId,
        phone,
        firstName: orElse(name?.firstName, "Customer"),
        lastName: name?.lastName?.trim() ?? "",
        lastLoginAt: new Date(),
      },
    })
    return { customer, created: true }
  }
}
