/**
 * WHATSAPP — the store's WhatsApp settings (record only, or Meta's Cloud API), sending order updates
 * as approved templates to customers who opted in, the message log, and Meta's delivery statuses.
 */
import { randomBytes } from "node:crypto"
import type { Prisma, StoreWhatsappSetting, WhatsappMessage } from "@prisma/client"
import { decrypt, encrypt, env, logger, prisma } from "../../config"
import { BadRequestError, NotFoundError } from "../../core"
import { storeBrand } from "../content/store-details"
import { STATUS_EVENTS } from "../sms/sms.rules"
import { sendTemplate, WhatsappError, type Fetch } from "./whatsapp.provider"
import {
  nextStatus,
  signatureOk,
  statusUpdates,
  TEMPLATE_NAME,
  WA_EVENTS,
  WA_LANGUAGES,
  waEventSettings,
  waNumber,
  waParams,
  type WaEvent,
  type WaLanguage,
  type WaVar,
} from "./whatsapp.rules"

export const WA_PROVIDERS = ["log", "cloud"] as const
export type WaProvider = (typeof WA_PROVIDERS)[number]

export interface WaSettingsInput {
  provider?: WaProvider
  phoneNumberId?: string | null
  /** Blank keeps what's stored. */
  accessToken?: string
  appSecret?: string
  events?: Partial<Record<WaEvent, { enabled?: boolean; template?: string; language?: WaLanguage }>>
}

const hint = (v: string | undefined) => (v ? `••••${v.slice(-4)}` : null)

function readKeys(row: StoreWhatsappSetting | null): { accessToken?: string; appSecret?: string } {
  if (!row?.credentials) return {}
  try {
    const plain = decrypt(row.credentials)
    return plain ? (JSON.parse(plain) as { accessToken?: string; appSecret?: string }) : {}
  } catch {
    logger.warn({ storeId: String(row.storeId) }, "WhatsApp keys couldn't be decrypted")
    return {}
  }
}

export class WhatsappService {
  constructor(
    private readonly storeId: bigint,
    private readonly f: Fetch = fetch,
  ) {}

  private row() {
    return prisma.storeWhatsappSetting.findUnique({ where: { storeId: this.storeId } })
  }

  /** The row, made on first use (so the webhook verify token exists before anything is saved). */
  private async ensureRow() {
    return (
      (await this.row()) ??
      prisma.storeWhatsappSetting.create({
        data: { storeId: this.storeId, verifyToken: randomBytes(18).toString("base64url") },
      })
    )
  }

  // ================================================================ settings

  async settings() {
    const row = await this.ensureRow()
    const keys = readKeys(row)
    return {
      provider: row.provider as WaProvider,
      phoneNumberId: row.phoneNumberId,
      accessTokenHint: hint(keys.accessToken),
      appSecretHint: hint(keys.appSecret),
      verifyToken: row.verifyToken,
      /** The callback URL to enter in Meta's app (WhatsApp → Configuration). */
      webhookUrl: `${env.API_BASE_URL.replace(/\/$/, "")}/api/webhooks/whatsapp`,
      events: waEventSettings(row.events),
      lastTestAt: row.lastTestAt?.toISOString() ?? null,
      lastError: row.lastError,
    }
  }

  async save(input: WaSettingsInput) {
    const row = await this.ensureRow()
    const provider = input.provider ?? (row.provider as WaProvider)
    const keys = readKeys(row)
    if (input.accessToken?.trim()) keys.accessToken = input.accessToken.trim()
    if (input.appSecret?.trim()) keys.appSecret = input.appSecret.trim()
    const phoneNumberId =
      input.phoneNumberId === undefined
        ? row.phoneNumberId
        : input.phoneNumberId?.trim()
          ? input.phoneNumberId.trim()
          : null
    if (phoneNumberId && !/^\d{5,25}$/.test(phoneNumberId))
      throw new BadRequestError(
        "The phone number ID is the long number Meta shows, digits only",
        "VALIDATION_FAILED",
      )
    if (provider === "cloud" && (!phoneNumberId || !keys.accessToken))
      throw new BadRequestError(
        "Add the phone number ID and access token to send through WhatsApp",
        "VALIDATION_FAILED",
      )
    const events = waEventSettings(row.events)
    for (const [k, v] of Object.entries(input.events ?? {})) {
      if (!(WA_EVENTS as readonly string[]).includes(k) || !v) continue
      const e = events[k as WaEvent]
      if (typeof v.enabled === "boolean") e.enabled = v.enabled
      if (v.template !== undefined) {
        const t = v.template.trim()
        if (!TEMPLATE_NAME.test(t))
          throw new BadRequestError(
            "Template names are lower-case letters, digits and _ (as in WhatsApp Manager)",
            "VALIDATION_FAILED",
          )
        e.template = t
      }
      if (v.language && (WA_LANGUAGES as readonly string[]).includes(v.language))
        e.language = v.language
    }
    await prisma.storeWhatsappSetting.update({
      where: { id: row.id },
      data: {
        provider,
        phoneNumberId,
        credentials: keys.accessToken || keys.appSecret ? encrypt(JSON.stringify(keys)) : null,
        events: events as unknown as Prisma.InputJsonValue,
      },
    })
    return this.settings()
  }

  // ================================================================ sending

  /** Sends one template message and logs it. Never throws for a WhatsApp problem: the log row says what happened. */
  async send(p: {
    to: string
    kind: string
    orderId?: bigint | null
    template: string
    language: string
    params: string[]
  }) {
    const to = waNumber(p.to)
    if (!to)
      throw new BadRequestError(
        "That isn't a Bangladeshi mobile number (01XXXXXXXXX)",
        "VALIDATION_FAILED",
      )
    const row = await this.ensureRow()
    const log = await prisma.whatsappMessage.create({
      data: {
        storeId: this.storeId,
        to,
        kind: p.kind,
        orderId: p.orderId ?? null,
        template: p.template,
        language: p.language,
        params: p.params,
        provider: row.provider,
        status: row.provider === "cloud" ? "sending" : "logged",
      },
    })
    if (row.provider !== "cloud") return log
    const keys = readKeys(row)
    try {
      if (!row.phoneNumberId || !keys.accessToken)
        throw new WhatsappError("WhatsApp keys aren't saved")
      const ref = await sendTemplate(
        { phoneNumberId: row.phoneNumberId, accessToken: keys.accessToken },
        to,
        { name: p.template, language: p.language, params: p.params },
        this.f,
      )
      return prisma.whatsappMessage.update({
        where: { id: log.id },
        data: { status: "sent", providerRef: ref },
      })
    } catch (e) {
      const error = e instanceof WhatsappError ? e.message : "The WhatsApp message couldn't be sent"
      if (!(e instanceof WhatsappError)) logger.error({ err: e }, "WhatsApp send failed")
      return prisma.whatsappMessage.update({
        where: { id: log.id },
        data: { status: "failed", error },
      })
    }
  }

  /** Meta's ready-made "hello_world" template (every new WhatsApp app has it, in en_US). */
  async test(to: string) {
    const msg = await this.send({
      to,
      kind: "test",
      template: "hello_world",
      language: "en_US",
      params: [],
    })
    await prisma.storeWhatsappSetting.update({
      where: { storeId: this.storeId },
      data: { lastTestAt: new Date(), lastError: msg.error },
    })
    return this.view(msg)
  }

  view(m: WhatsappMessage) {
    return {
      id: String(m.id),
      to: m.to,
      kind: m.kind,
      orderId: m.orderId ? String(m.orderId) : null,
      template: m.template,
      language: m.language,
      params: Array.isArray(m.params) ? (m.params as string[]) : [],
      provider: m.provider,
      status: m.status,
      providerRef: m.providerRef,
      error: m.error,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
    }
  }

  async log(q: {
    page: number
    perPage: number
    status?: string
    kind?: string
    search?: string
    orderId?: bigint
  }) {
    const digits = q.search?.replace(/[^\d]/g, "")
    const where: Prisma.WhatsappMessageWhereInput = {
      storeId: this.storeId,
      ...(q.status ? { status: q.status } : {}),
      ...(q.kind ? { kind: q.kind } : {}),
      ...(q.orderId ? { orderId: q.orderId } : {}),
      ...(digits ? { to: { contains: digits.replace(/^0/, "") } } : {}),
    }
    const [total, rows] = await Promise.all([
      prisma.whatsappMessage.count({ where }),
      prisma.whatsappMessage.findMany({
        where,
        orderBy: { id: "desc" },
        skip: (q.page - 1) * q.perPage,
        take: q.perPage,
      }),
    ])
    return {
      data: rows.map((r) => this.view(r)),
      meta: { page: q.page, perPage: q.perPage, total, totalPages: Math.ceil(total / q.perPage) },
    }
  }

  async resend(id: bigint) {
    const m = await prisma.whatsappMessage.findFirst({ where: { id, storeId: this.storeId } })
    if (!m) throw new NotFoundError("WhatsApp message")
    const params = Array.isArray(m.params) ? (m.params as string[]) : []
    return this.view(
      await this.send({
        to: `0${m.to.slice(3)}`,
        kind: m.kind,
        orderId: m.orderId,
        template: m.template,
        language: m.language,
        params,
      }),
    )
  }

  // ================================================================ orders

  /** The template values for an order (plain text: WhatsApp shows ৳ and Bangla fine). */
  private async orderVars(orderId: bigint) {
    const o = await prisma.order.findFirst({
      where: { id: orderId, storeId: this.storeId },
      include: { shipments: { orderBy: { createdAt: "desc" }, take: 1 } },
    })
    if (!o) return null
    const { brand, urls } = await storeBrand(this.storeId)
    const s = o.shipments[0]
    const total = Number(o.grandTotal)
    const vars: Record<WaVar, string> = {
      name: o.shippingFirstName ?? o.billingFirstName ?? "",
      order: o.number,
      total: `৳${total.toLocaleString("en-US", { maximumFractionDigits: 2 })}`,
      store: brand.storeName,
      phone: brand.phone,
      courier: s?.providerName ?? "",
      tracking: s?.trackingUrl ?? o.trackingUrl ?? s?.trackingNumber ?? o.trackingNumber ?? "",
      link: `${urls.storefront}/checkout/thank-you?key=${encodeURIComponent(o.orderKey)}`,
    }
    return { order: o, phone: o.shippingPhone ?? o.billingPhone, vars }
  }

  /** An order update, if the shop turned it on and the customer opted in. Once per event per order. */
  async orderEvent(orderId: bigint, event: WaEvent) {
    const row = await this.row()
    if (!row) return null
    const setting = waEventSettings(row.events)[event]
    if (!setting.enabled) return null
    const d = await this.orderVars(orderId)
    if (!d?.order.whatsappOptIn || !waNumber(d.phone)) return null
    const sent = await prisma.whatsappMessage.findFirst({
      where: { storeId: this.storeId, orderId, kind: event, status: { not: "failed" } },
    })
    if (sent) return null
    return this.send({
      to: d.phone!,
      kind: event,
      orderId,
      template: setting.template,
      language: setting.language,
      params: waParams(event, d.vars),
    })
  }

  async orderStatus(orderId: bigint, status: string) {
    const event: WaEvent | undefined = STATUS_EVENTS[status]
    return event ? this.orderEvent(orderId, event) : null
  }

  // ================================================================ webhook (static: Meta calls one URL for all stores)

  /** Meta's webhook check: the verify token must be one a store was given. */
  static async verifyChallenge(
    mode: string | undefined,
    token: string | undefined,
    challenge: string | undefined,
  ) {
    if (mode !== "subscribe" || !token || !challenge) return null
    const row = await prisma.storeWhatsappSetting.findFirst({
      where: { verifyToken: token },
      select: { id: true },
    })
    return row ? challenge : null
  }

  /**
   * Message statuses from Meta. Each store's part is checked with that store's app secret
   * (found by the business phone number id); a bad signature changes nothing.
   */
  static async receive(raw: Buffer, signature: string | undefined) {
    let payload: unknown
    try {
      payload = JSON.parse(raw.toString("utf8"))
    } catch {
      return { updated: 0, refused: true }
    }
    const updates = statusUpdates(payload)
    const ids = [...new Set(updates.map((u) => u.phoneNumberId).filter(Boolean))]
    if (!ids.length) return { updated: 0, refused: false }
    const rows = await prisma.storeWhatsappSetting.findMany({
      where: { phoneNumberId: { in: ids } },
    })
    // One payload, one signature: it must match the secret of a store this payload is for.
    const store = rows.find((r) => {
      const secret = readKeys(r).appSecret
      return !!secret && signatureOk(secret, raw, signature)
    })
    if (!store) return { updated: 0, refused: true }
    let updated = 0
    for (const u of updates.filter((x) => x.phoneNumberId === store.phoneNumberId)) {
      const m = await prisma.whatsappMessage.findFirst({
        where: { storeId: store.storeId, providerRef: u.ref },
      })
      if (!m) continue
      const status = nextStatus(m.status, u.status)
      if (status === m.status) continue
      await prisma.whatsappMessage.update({
        where: { id: m.id },
        data: {
          status,
          ...(status === "failed" ? { error: u.error ?? "WhatsApp couldn't deliver it" } : {}),
        },
      })
      updated++
    }
    return { updated, refused: false }
  }
}
