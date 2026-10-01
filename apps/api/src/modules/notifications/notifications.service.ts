/**
 * EMAIL SERVICE — builds, logs and queues the store's transactional emails, and backs
 * Settings > Emails in the store admin (templates, preview, test send, sent-email log).
 */
import type { Prisma } from "@prisma/client"
import { env, logger, prisma } from "../../config"
import { BadRequestError, NotFoundError, type RequestContext } from "../../core"
import { storeBrand, storeUrls, type StoreUrls } from "../content/store-details"
import { dispatchEmail, type EmailLogData } from "./email.queue"
import { vatLabel } from "../shipping/tax.rules";
import {
  renderEmail,
  type EmailBrand,
  type OrderSummary,
  type RenderedEmail,
  type TrackingInfo,
} from "./email.render"
import {
  EMAIL_TEMPLATES,
  STATUS_TEMPLATES,
  TEMPLATE_KEYS,
  isTemplateKey,
  templateDef,
  type TemplateKey,
} from "./email.templates"

interface SendOptions {
  /** Blank entries (customers without an email) are skipped. */
  to: (string | null | undefined)[]
  vars?: Record<string, string>
  order?: OrderSummary | null
  tracking?: TrackingInfo | null
  recipientType: "customer" | "staff" | "test"
  recipientId?: bigint | null
  orderId?: bigint | null
  /** Send even when the store has switched this email off (manual resends and tests). */
  force?: boolean
  /** Unsaved wording from the editor, for previews and test sends. */
  draft?: { subject: string; message: string }
}

/** What the editor saves. Anything left out keeps its current value, so the list can just flip the switch. */
export interface TemplateInput {
  enabled?: boolean
  subject?: string
  message?: string
  recipients?: string[]
}

export interface EmailLogQuery {
  page: number
  perPage: number
  search?: string
  status?: EmailLogData["status"]
}

export const money = (v: unknown) => {
  // Prisma Decimals convert through valueOf.
  const n = Number(v) || 0
  return `৳ ${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

const statusLabel = (s: string) => s.toLowerCase().replace(/_/g, " ")

/** Text for a plain JSON value; objects and arrays give "". */
const plain = (x: unknown) =>
  typeof x === "string" || typeof x === "number" || typeof x === "boolean" ? String(x) : ""

/** "Size: M, Colour: Red" from a variant's attribute values ({ size: "M" } or [{ name, value }]). */
function variantText(v: Prisma.JsonValue | null): string {
  if (!v) return ""
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
  if (Array.isArray(v)) {
    return v
      .map((x) =>
        x && typeof x === "object" && !Array.isArray(x)
          ? `${cap(plain(x.name ?? x.attribute))}: ${plain(x.value)}`
          : plain(x),
      )
      .join(", ")
  }
  if (typeof v === "object")
    return Object.entries(v)
      .map(([k, val]) => `${cap(k)}: ${plain(val)}`)
      .join(", ")
  return String(v)
}

const SAMPLE_ORDER: OrderSummary = {
  items: [
    { name: "Cotton Panjabi", detail: "Size: L", qty: 1, total: money(2450), imageUrl: null },
    { name: "Printed Kurti", detail: "Size: M", qty: 2, total: money(3200), imageUrl: null },
  ],
  totals: [
    { label: "Subtotal", value: money(5650) },
    { label: "Delivery", value: money(60) },
    { label: "Total", value: money(5710), strong: true },
  ],
  shipTo: ["Ayesha Rahman", "House 12, Road 5, Dhanmondi", "Dhaka 1205", "01711-000000"],
}

export class EmailService {
  private cache: { brand: EmailBrand; urls: StoreUrls; replyTo: string | null } | null = null

  constructor(private readonly storeId: bigint) {}

  static forContext(ctx: RequestContext) {
    if (ctx.storeId === undefined)
      throw new BadRequestError(
        "Could not resolve which store this request belongs to",
        "TENANT_NOT_RESOLVED",
      )
    return new EmailService(BigInt(ctx.storeId))
  }

  // ------------------------------------------------------------------ store details

  async urls(): Promise<StoreUrls> {
    return storeUrls(this.storeId)
  }

  /** Store name, logo, colour and contact details from the theme (Online Store > Theme). */
  private async context() {
    if (this.cache) return this.cache
    const { brand, urls } = await storeBrand(this.storeId)
    this.cache = { brand, urls, replyTo: brand.email.trim() || null }
    return this.cache
  }

  private async storeVars(): Promise<Record<string, string>> {
    const { brand } = await this.context()
    return {
      "store.name": brand.storeName,
      "store.url": brand.storeUrl,
      "store.email": brand.email,
      "store.phone": brand.phone,
    }
  }

  // ------------------------------------------------------------------ templates

  private async templateRow(key: TemplateKey) {
    return prisma.emailTemplate.findUnique({
      where: { storeId_systemKey: { storeId: this.storeId, systemKey: key } },
    })
  }

  /** The wording in use: the store's own if it saved some, otherwise the built-in default. */
  async templateConfig(key: TemplateKey) {
    const def = templateDef(key)
    const row = await this.templateRow(key)
    const custom = !!row && !row.useDefault
    return {
      enabled: row?.enabled ?? true,
      subject: custom ? row.subject : def.subject,
      message: custom && row.bodyText ? row.bodyText : def.message,
      recipients: Array.isArray(row?.cc) ? (row.cc as unknown[]).map(String) : [],
      customised: custom,
    }
  }

  /** Where staff emails go: the addresses set on the template, else the store owners. */
  private async staffRecipients(key: TemplateKey): Promise<string[]> {
    const { recipients } = await this.templateConfig(key)
    if (recipients.length) return recipients
    const owners = await prisma.adminUser.findMany({
      where: { storeId: this.storeId, status: "active", role: { slug: "owner" } },
      select: { email: true },
    })
    return owners.map((o) => o.email)
  }

  async render(
    key: TemplateKey,
    opts: Pick<SendOptions, "vars" | "order" | "tracking" | "draft">,
  ): Promise<RenderedEmail> {
    const def = templateDef(key)
    const { brand } = await this.context()
    const config = opts.draft ?? (await this.templateConfig(key))
    const vars = { ...(await this.storeVars()), ...(opts.vars ?? {}) }
    return renderEmail({
      brand,
      subject: config.subject,
      message: config.message,
      vars,
      blocks: def.blocks,
      button: def.button,
      order: opts.order,
      tracking: opts.tracking,
    })
  }

  /** Renders, logs and queues an email. Returns the log id, or null when it wasn't sent. */
  async send(key: TemplateKey, opts: SendOptions): Promise<bigint | null> {
    const to = [
      ...new Set(
        opts.to
          .map((e) => (e ?? "").trim())
          .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)),
      ),
    ]
    if (!to.length) return null
    if (!opts.force && !(await this.templateConfig(key)).enabled) return null
    const email = await this.render(key, opts)
    const { brand, replyTo } = await this.context()
    const data: EmailLogData = {
      to,
      text: email.text,
      replyTo,
      fromName: brand.storeName || env.MAIL_FROM_NAME,
      template: key,
      status: "queued",
      attempts: 0,
      ...(opts.orderId ? { orderId: String(opts.orderId) } : {}),
      ...(opts.orderId && templateDef(key).attachInvoice ? { attachInvoice: true } : {}),
    }
    const row = await prisma.notification.create({
      data: {
        storeId: this.storeId,
        recipientType: opts.recipientType,
        recipientId: opts.recipientId ?? null,
        eventKey: key,
        title: email.subject,
        body: email.html,
        data: data as unknown as Prisma.InputJsonValue,
        channel: "email",
      },
    })
    await dispatchEmail(row.id)
    return row.id
  }

  // ------------------------------------------------------------------ orders

  private async orderDetails(orderId: bigint) {
    const order = await prisma.order.findFirst({
      where: { id: orderId, storeId: this.storeId },
      include: { items: true, shipments: { orderBy: { createdAt: "desc" }, take: 1 } },
    })
    if (!order) return null
    const [{ urls }, gateway] = await Promise.all([
      this.context(),
      prisma.paymentGatewayConfig.findFirst({
        where: { storeId: this.storeId, code: order.paymentGatewayCode },
        select: { name: true },
      }),
    ])
    const first = order.billingFirstName
    const vars: Record<string, string> = {
      "customer.name": `${order.billingFirstName} ${order.billingLastName}`.trim(),
      "customer.first_name": first,
      "customer.email": order.billingEmail ?? "",
      "order.number": order.number,
      "order.date": order.createdAt.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
      "order.total": money(order.grandTotal),
      "order.status": statusLabel(order.status),
      "order.payment_method": gateway?.name ?? order.paymentGatewayCode,
      "order.shipping_method": order.shippingMethodName,
      "order.delivery_time": order.deliverySlotLabel ?? "",
      "order.url": `${urls.storefront}/checkout/thank-you?key=${encodeURIComponent(order.orderKey)}`,
      "order.admin_url": `${urls.admin}/orders/${String(order.id)}`,
    }
    const n = (v: unknown) => Number(String(v)) || 0
    const summary: OrderSummary = {
      items: order.items.map((i) => ({
        name: i.productName,
        detail: variantText(i.variantValues),
        qty: i.quantity,
        total: money(i.lineSubtotal),
        imageUrl: i.imageUrl,
      })),
      totals: [
        { label: "Subtotal", value: money(order.itemsSubtotal) },
        ...(n(order.discountTotal) > 0
          ? [
              {
                label: order.couponUsed ? `Discount (${order.couponUsed})` : "Discount",
                value: `-${money(order.discountTotal)}`,
              },
            ]
          : []),
        {
          label: "Delivery",
          value: n(order.shippingTotal) > 0 ? money(order.shippingTotal) : "Free",
        },
        ...(n(order.taxTotal) > 0 && !order.pricesIncludeTax ? [{ label: vatLabel(order.taxRate), value: money(order.taxTotal) }] : []),
        ...(n(order.feeTotal) > 0 ? [{ label: "Payment fee", value: money(order.feeTotal) }] : []),
        { label: "Total", value: money(order.grandTotal), strong: true },
        // VAT-inclusive prices: the VAT is part of the total above.
        ...(n(order.taxTotal) > 0 && order.pricesIncludeTax ? [{ label: `Includes ${vatLabel(order.taxRate)}`, value: money(order.taxTotal) }] : []),
      ],
      shipTo: [
        `${order.shippingFirstName ?? order.billingFirstName} ${order.shippingLastName ?? order.billingLastName}`.trim(),
        order.shippingAddress1 ?? order.billingAddress1,
        order.shippingAddress2 ?? "",
        [
          [order.shippingCity ? order.shippingUpazila : order.billingUpazila, order.shippingCity ?? order.billingCity]
            .filter(Boolean)
            .join(", "),
          order.shippingPostcode ?? order.billingPostcode,
        ]
          .filter(Boolean)
          .join(" "),
        order.shippingPhone ?? order.billingPhone ?? "",
        order.deliverySlotLabel ? `Delivery time: ${order.deliverySlotLabel}` : "",
        order.isGift ? `Gift${order.giftMessage ? `, card: “${order.giftMessage.replace(/\n+/g, " ")}”` : ""}` : "",
      ].filter((l): l is string => !!l?.trim()),
    }
    const s = order.shipments[0]
    const tracking: TrackingInfo = {
      carrier: s?.providerName ?? "",
      number: s?.trackingNumber ?? order.trackingNumber ?? "",
      url: s?.trackingUrl ?? order.trackingUrl ?? "",
    }
    vars["shipment.carrier"] = tracking.carrier
    vars["shipment.tracking_number"] = tracking.number
    vars["shipment.tracking_url"] = tracking.url
    return { order, vars, summary, tracking }
  }

  /** Order confirmation to the customer and a new-order alert to the team. */
  async orderPlaced(
    orderId: bigint,
    only?: "customer",
    who: { customer: boolean; staff: boolean } = { customer: true, staff: true },
  ): Promise<boolean> {
    const d = await this.orderDetails(orderId)
    if (!d) return false
    const common = { vars: d.vars, order: d.summary, orderId }
    if (who.customer) {
      await this.send("order_new_customer", {
        ...common,
        to: [d.order.billingEmail],
        recipientType: "customer",
        recipientId: d.order.customerId,
        force: only === "customer",
      })
    }
    if (only || !who.staff) return true
    await this.send("order_new_admin", {
      ...common,
      to: await this.staffRecipients("order_new_admin"),
      recipientType: "staff",
    })
    return true
  }

  async orderStatusChanged(orderId: bigint, status: string, note: string | null) {
    const key = STATUS_TEMPLATES[status]
    if (!key) return
    const d = await this.orderDetails(orderId)
    if (!d) return
    await this.send(key, {
      to: [d.order.billingEmail],
      vars: { ...d.vars, "update.note": note ?? "" },
      order: d.summary,
      tracking: d.tracking,
      recipientType: "customer",
      recipientId: d.order.customerId,
      orderId,
    })
  }

  // ------------------------------------------------------------------ accounts

  async customerWelcome(customerId: bigint) {
    const c = await prisma.customer.findFirst({ where: { id: customerId, storeId: this.storeId } })
    if (!c) return
    await this.send("customer_welcome", {
      to: [c.email],
      vars: {
        "customer.name": `${c.firstName} ${c.lastName}`.trim(),
        "customer.first_name": c.firstName,
        "customer.email": c.email ?? "",
      },
      recipientType: "customer",
      recipientId: c.id,
    })
  }

  async customerPasswordReset(
    c: { id: bigint; email: string; firstName: string; lastName: string },
    token: string,
    minutes: number,
  ) {
    const { urls } = await this.context()
    await this.send("customer_password_reset", {
      to: [c.email],
      vars: {
        "customer.name": `${c.firstName} ${c.lastName}`.trim(),
        "customer.first_name": c.firstName,
        "customer.email": c.email ?? "",
        "reset.url": `${urls.storefront}/account/reset-password?token=${encodeURIComponent(token)}`,
        "reset.expires_minutes": String(minutes),
      },
      recipientType: "customer",
      recipientId: c.id,
      force: true,
    })
  }

  async staffPasswordReset(
    a: { id: bigint; email: string; name: string },
    token: string,
    minutes: number,
  ) {
    const { urls } = await this.context()
    await this.send("staff_password_reset", {
      to: [a.email],
      vars: {
        "staff.name": a.name,
        "staff.email": a.email,
        "reset.url": `${urls.admin}/reset-password?token=${encodeURIComponent(token)}`,
        "reset.expires_minutes": String(minutes),
      },
      recipientType: "staff",
      recipientId: a.id,
      force: true,
    })
  }

  // ------------------------------------------------------------------ quotations

  /** The quote as an order-summary block (lines, totals). */
  private async quoteDetails(id: bigint) {
    const q = await prisma.quotation.findFirst({
      where: { id, storeId: this.storeId },
      include: { items: { orderBy: { sortOrder: "asc" } }, customer: true },
    })
    if (!q) return null
    const totals = [
      { label: "Items", value: money(q.subtotal) },
      ...(Number(q.discount) > 0 ? [{ label: "Discount", value: `−${money(q.discount)}` }] : []),
      ...(Number(q.deliveryFee) > 0 ? [{ label: "Delivery", value: money(q.deliveryFee) }] : []),
      { label: "Total", value: money(q.total), strong: true },
    ]
    const order: OrderSummary = {
      items: q.items.map((i) => ({
        name: i.name,
        detail: [i.option, `${money(i.unitPrice)} each`].filter(Boolean).join(" · "),
        qty: i.qty,
        total: money(i.lineTotal),
        imageUrl: null,
      })),
      totals,
      shipTo: [],
    }
    const c = q.customer
    const vars = {
      "customer.name": `${c.firstName} ${c.lastName}`.trim(),
      "customer.first_name": c.firstName,
      "customer.email": c.email ?? "",
      "quote.number": q.number,
      "quote.total": money(q.total),
      "quote.valid_until": q.validUntil
        ? q.validUntil.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Dhaka" })
        : "further notice",
      "quote.terms": q.terms ?? "",
    }
    return { q, order, vars }
  }

  async quoteSent(id: bigint) {
    const d = await this.quoteDetails(id)
    if (!d) return
    const { urls } = await this.context()
    await this.send("quote_sent_customer", {
      to: [d.q.customer.email],
      vars: { ...d.vars, "quote.url": `${urls.storefront}/account/quotes/${d.q.number}` },
      order: d.order,
      recipientType: "customer",
      recipientId: d.q.customerId,
    })
  }

  async quoteUpdate(id: bigint, event: "requested" | "accepted" | "declined") {
    const d = await this.quoteDetails(id)
    if (!d) return
    const { urls } = await this.context()
    await this.send("quote_update_admin", {
      to: await this.staffRecipients("quote_update_admin"),
      vars: {
        ...d.vars,
        "quote.event": { requested: "new request", accepted: "accepted", declined: "declined" }[event],
        "quote.note": d.q.customerNote ?? "",
        "quote.admin_url": `${urls.admin}/orders/quotations/${d.q.id}`,
      },
      order: d.order,
      recipientType: "staff",
    })
  }

  /** A festival's sale is coming up (the festival calendar's reminder). Returns the log id. */
  async festivalReminder(vars: Record<string, string>) {
    return this.send("festival_reminder_admin", {
      to: await this.staffRecipients("festival_reminder_admin"),
      vars,
      recipientType: "staff",
    })
  }

  // ------------------------------------------------------------------ admin: templates

  async listTemplates() {
    const rows = await prisma.emailTemplate.findMany({ where: { storeId: this.storeId } })
    return TEMPLATE_KEYS.map((key) => {
      const def = EMAIL_TEMPLATES[key]
      const row = rows.find((r) => r.systemKey === key)
      return {
        key,
        label: def.label,
        audience: def.audience,
        description: def.description,
        enabled: row?.enabled ?? true,
        customised: !!row && !row.useDefault,
        subject: row && !row.useDefault ? row.subject : def.subject,
      }
    })
  }

  private key(k: string): TemplateKey {
    if (!isTemplateKey(k)) throw new NotFoundError("email template")
    return k
  }

  async getTemplate(k: string) {
    const key = this.key(k)
    const def = templateDef(key)
    const config = await this.templateConfig(key)
    return {
      key,
      label: def.label,
      audience: def.audience,
      description: def.description,
      variables: def.variables,
      blocks: def.blocks,
      buttonLabel: def.button?.label ?? null,
      attachesInvoice: !!def.attachInvoice,
      defaultSubject: def.subject,
      defaultMessage: def.message,
      ...config,
    }
  }

  async saveTemplate(k: string, input: TemplateInput, adminId?: bigint) {
    const key = this.key(k)
    const def = templateDef(key)
    const current = await this.templateConfig(key)
    const subject = (input.subject ?? current.subject).trim()
    const message = (input.message ?? current.message).trim()
    const useDefault = subject === def.subject && message === def.message
    const recipients = def.audience === "staff" ? (input.recipients ?? current.recipients) : []
    const data = {
      enabled: input.enabled ?? current.enabled,
      useDefault,
      subject: useDefault ? def.subject : subject,
      bodyText: useDefault ? null : message,
      cc: recipients.length ? (recipients as Prisma.InputJsonValue) : undefined,
      updatedByAdminId: adminId ?? null,
    }
    await prisma.emailTemplate.upsert({
      where: { storeId_systemKey: { storeId: this.storeId, systemKey: key } },
      update: {
        ...data,
        cc: recipients.length
          ? (recipients as Prisma.InputJsonValue)
          : ([] as Prisma.InputJsonValue),
      },
      create: { storeId: this.storeId, systemKey: key, ...data },
    })
    return this.getTemplate(key)
  }

  /** Back to the built-in wording; the on/off switch and staff recipients are kept. */
  async resetTemplate(k: string) {
    const key = this.key(k)
    await prisma.emailTemplate.updateMany({
      where: { storeId: this.storeId, systemKey: key },
      data: { useDefault: true, subject: templateDef(key).subject, bodyText: null },
    })
    return this.getTemplate(key)
  }

  /** Example values so the editor can show a realistic preview. */
  private async sampleVars(key: TemplateKey): Promise<Omit<SendOptions, "to" | "recipientType">> {
    const { urls } = await this.context()
    return {
      vars: {
        "customer.name": "Ayesha Rahman",
        "customer.first_name": "Ayesha",
        "customer.email": "ayesha@example.com",
        "order.number": "20260926000123",
        "order.date": new Date().toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        }),
        "order.total": money(5710),
        "order.status": key === "order_status_changed" ? "processing" : "shipped",
        "order.payment_method": "Cash on Delivery",
        "order.shipping_method": "Inside Dhaka",
        "order.delivery_time": "Fri 2 Oct, Evening 17:00–21:00",
        "order.url": `${urls.storefront}/checkout/thank-you?key=sample`,
        "order.admin_url": `${urls.admin}/orders`,
        "shipment.carrier": "Pathao",
        "shipment.tracking_number": "PTH-58213",
        "shipment.tracking_url": "",
        "update.note": "",
        "reset.url": `${urls.storefront}/account/reset-password?token=sample`,
        "reset.expires_minutes": "60",
        "staff.name": "Rahim",
        "staff.email": "rahim@example.com",
        "quote.number": "Q-000012",
        "quote.total": money(30900),
        "quote.valid_until": "15 Oct 2026",
        "quote.terms": "Half in advance, the rest on delivery.",
        "quote.url": `${urls.storefront}/account/quotes/Q-000012`,
        "quote.event": "accepted",
        "quote.note": "",
        "quote.admin_url": `${urls.admin}/orders/quotations`,
        "festival.name": "Eid-ul-Fitr",
        "festival.dates": "21–23 Mar 2026",
        "festival.sale_dates": "24 Feb – 23 Mar 2026",
        "festival.days_left": "30",
        "festival.last_year": "Last year's sale brought 142 orders, ৳6,84,500.",
        "festival.todo": "- Order enough stock of the best sellers\n- Make the banner and homepage section",
        "festival.admin_url": `${urls.admin}/marketing/festivals`,
      },
      order: SAMPLE_ORDER,
      tracking: { carrier: "Pathao", number: "PTH-58213", url: "" },
    }
  }

  async preview(k: string, draft?: { subject: string; message: string }) {
    const key = this.key(k)
    const email = await this.render(key, { ...(await this.sampleVars(key)), draft })
    return { subject: email.subject, html: email.html }
  }

  async sendTest(k: string, to: string, draft?: { subject: string; message: string }) {
    const key = this.key(k)
    const sample = await this.sampleVars(key)
    const d = draft ?? (await this.templateConfig(key))
    const id = await this.send(key, {
      ...sample,
      to: [to],
      recipientType: "test",
      force: true,
      draft: { subject: `[Test] ${d.subject}`, message: d.message },
    })
    if (!id) throw new BadRequestError("That email address doesn't look right")
    return this.getLog(id)
  }

  // ------------------------------------------------------------------ admin: sent-email log

  private logRow(r: {
    id: bigint
    eventKey: string
    title: string
    recipientType: string
    data: Prisma.JsonValue
    createdAt: Date
    sentAt: Date | null
  }) {
    const d = (r.data ?? {}) as unknown as EmailLogData
    return {
      id: String(r.id),
      template: r.eventKey,
      templateLabel: isTemplateKey(r.eventKey) ? EMAIL_TEMPLATES[r.eventKey].label : r.eventKey,
      subject: r.title,
      to: d.to ?? [],
      recipientType: r.recipientType,
      status: d.status ?? "queued",
      error: d.error ?? null,
      attempts: d.attempts ?? 0,
      logOnly: !!d.logOnly,
      invoiceAttached: !!d.attachInvoice,
      orderId: d.orderId ?? null,
      createdAt: r.createdAt,
      sentAt: r.sentAt,
    }
  }

  async listLog(q: EmailLogQuery) {
    const where: Prisma.NotificationWhereInput = {
      storeId: this.storeId,
      channel: "email",
      ...(q.status ? { data: { path: ["status"], equals: q.status } } : {}),
      ...(q.search ? { title: { contains: q.search, mode: "insensitive" } } : {}),
    }
    const [total, rows] = await Promise.all([
      prisma.notification.count({ where }),
      prisma.notification.findMany({
        where,
        orderBy: { id: "desc" },
        skip: (q.page - 1) * q.perPage,
        take: q.perPage,
        select: {
          id: true,
          eventKey: true,
          title: true,
          recipientType: true,
          data: true,
          createdAt: true,
          sentAt: true,
        },
      }),
    ])
    return {
      items: rows.map((r) => this.logRow(r)),
      meta: {
        page: q.page,
        perPage: q.perPage,
        total,
        totalPages: Math.max(1, Math.ceil(total / q.perPage)),
      },
    }
  }

  async getLog(id: bigint) {
    const r = await prisma.notification.findFirst({
      where: { id, storeId: this.storeId, channel: "email" },
    })
    if (!r) throw new NotFoundError("email")
    const d = (r.data ?? {}) as unknown as EmailLogData
    return { ...this.logRow(r), html: r.body ?? "", text: d.text ?? "" }
  }

  /** Sends a failed or already-sent email again, as a new log entry. */
  async resend(id: bigint) {
    const r = await prisma.notification.findFirst({
      where: { id, storeId: this.storeId, channel: "email" },
    })
    if (!r) throw new NotFoundError("email")
    const d = (r.data ?? {}) as unknown as EmailLogData
    const copy = await prisma.notification.create({
      data: {
        storeId: this.storeId,
        recipientType: r.recipientType,
        recipientId: r.recipientId,
        eventKey: r.eventKey,
        title: r.title,
        body: r.body,
        channel: "email",
        data: {
          ...d,
          status: "queued",
          attempts: 0,
          error: undefined,
          messageId: undefined,
          logOnly: undefined,
        },
      },
    })
    await dispatchEmail(copy.id)
    return this.getLog(copy.id)
  }
}

/** Runs an email job in the background; a failure is logged and never reaches the caller. */
export function inBackground(what: string, run: () => Promise<unknown>) {
  void run().catch((err: unknown) => logger.error({ err, what }, "Email notification failed"))
}
