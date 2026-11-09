/**
 * SMS CAMPAIGNS (Marketing → SMS campaigns) — a marketing SMS to a group of customers.
 * Staff write it, see how many people it reaches, send themselves a test, then send it now or at a
 * set time. A job every minute works through campaigns that are due: the list of numbers is fixed
 * when sending starts (opted-out numbers left out), then sent in batches, each number once. No SMS
 * goes out 10pm–8am Dhaka time; sending pauses and carries on in the morning.
 */
import { randomBytes } from "node:crypto"
import { Prisma } from "@prisma/client"
import { logger, prisma } from "../../config"
import { logSystem } from "../team/audit"
import { BadRequestError, ConflictError, NotFoundError, type RequestContext } from "../../core"
import { storeUrls } from "../content/store-details"
import { bdMobile, smsParts } from "../sms/sms.rules"
import { inQuietHours } from "./cart-reminders.rules"
import { audienceWhere, personalise, sampleText, type Audience } from "./sms-campaigns.rules"

const BATCH = 100
const token = () => randomBytes(6).toString("base64url")

export type CampaignInput = { name: string; body: string; audience: Audience; stopLink: boolean }

async function smsFor(storeId: bigint) {
  const { SmsService } = await import("../sms/sms.service")
  return new SmsService(storeId)
}

function view(c: Prisma.SmsCampaignGetPayload<object>) {
  return {
    id: String(c.id),
    name: c.name,
    body: c.body,
    audience: c.audience as Audience,
    stopLink: c.stopLink,
    status: c.status,
    scheduledAt: c.scheduledAt,
    startedAt: c.startedAt,
    finishedAt: c.finishedAt,
    recipients: c.recipients,
    sent: c.sent,
    failed: c.failed,
    createdAt: c.createdAt,
  }
}

export class SmsCampaigns {
  constructor(private readonly ctx: RequestContext) {}

  private get storeId(): bigint {
    if (this.ctx.storeId === undefined) throw new BadRequestError("No store for this request", "STORE_REQUIRED")
    return BigInt(this.ctx.storeId)
  }

  private async find(id: bigint) {
    const c = await prisma.smsCampaign.findFirst({ where: { id, storeId: this.storeId } })
    if (!c) throw new NotFoundError("Campaign", String(id))
    return c
  }

  /** How many it reaches now, the SMS parts each message takes, and a few names. */
  async preview(input: { body: string; audience: Audience; stopLink: boolean }) {
    const where = audienceWhere(this.storeId, input.audience, new Date())
    const [people, optedOut, sample] = await Promise.all([
      prisma.customer.count({ where }),
      prisma.customer.count({ where: { AND: [where, { phone: { in: await this.optedOutPhones() } }] } }),
      prisma.customer.findMany({ where, take: 5, orderBy: { createdAt: "desc" }, select: { firstName: true, phone: true } }),
    ])
    const parts = smsParts(sampleText(input.body, input.stopLink))
    const reach = people - optedOut
    return { people: reach, optedOut, ...parts, totalParts: reach * parts.parts, sample: sample.map((s) => ({ name: s.firstName, phone: s.phone })) }
  }

  private async optedOutPhones() {
    return (await prisma.smsOptOut.findMany({ where: { storeId: this.storeId }, select: { phone: true } })).map((o) => o.phone)
  }

  async list(page: number, perPage: number) {
    const where = { storeId: this.storeId }
    const [rows, total] = await Promise.all([
      prisma.smsCampaign.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * perPage, take: perPage }),
      prisma.smsCampaign.count({ where }),
    ])
    return { items: rows.map(view), meta: { page, perPage, total, totalPages: Math.max(1, Math.ceil(total / perPage)) } }
  }

  /** One campaign, with the orders its people placed within 3 days of getting it. */
  async get(id: bigint) {
    const c = await this.find(id)
    const [r] = await prisma.$queryRaw<{ orders: bigint; sales: Prisma.Decimal | null }[]>`
      SELECT count(DISTINCT o.id) AS orders, sum(o."grandTotal") AS sales
      FROM "SmsCampaignRecipient" r
      JOIN "Order" o ON o."phoneKey" = r.phone AND o."storeId" = ${this.storeId}
        AND o."createdAt" BETWEEN r."sentAt" AND r."sentAt" + interval '3 days'
      WHERE r."campaignId" = ${c.id} AND r.status = 'sent' AND o.status NOT IN ('CANCELLED', 'FAILED')`
    return { ...view(c), ordersAfter: Number(r?.orders ?? 0), salesAfter: Number(r?.sales ?? 0) }
  }

  async create(d: CampaignInput) {
    const c = await prisma.smsCampaign.create({
      data: { storeId: this.storeId, name: d.name, body: d.body, audience: d.audience as Prisma.InputJsonValue, stopLink: d.stopLink, adminId: this.ctx.admin?.id ? BigInt(this.ctx.admin.id) : null },
    })
    return view(c)
  }

  async update(id: bigint, d: CampaignInput) {
    const c = await this.find(id)
    if (!["draft", "scheduled"].includes(c.status)) throw new ConflictError("This campaign has started; it can't be changed", "VALIDATION_FAILED")
    return view(await prisma.smsCampaign.update({ where: { id }, data: { name: d.name, body: d.body, audience: d.audience as Prisma.InputJsonValue, stopLink: d.stopLink } }))
  }

  async remove(id: bigint) {
    const c = await this.find(id)
    if (c.status !== "draft") throw new ConflictError("Only drafts can be deleted. Cancel a scheduled campaign instead.", "VALIDATION_FAILED")
    await prisma.smsCampaign.delete({ where: { id } })
  }

  /** Sends the message to one number (staff's own), as a customer called "Mohammad" would get it. */
  async test(id: bigint, phone: string) {
    const c = await this.find(id)
    const urls = await storeUrls(this.storeId)
    const sms = await smsFor(this.storeId)
    const text = personalise(c.body, "Mohammad", c.stopLink ? `${urls.storefront}/s/test` : undefined)
    const m = await sms.send({ to: phone, text, kind: "campaign_test", campaignId: c.id })
    if (m.status === "failed") throw new BadRequestError(m.error ?? "The test SMS couldn't be sent", "VALIDATION_FAILED")
    return { status: m.status }
  }

  /** Now, or at a time; it goes out with the next job run once due. */
  async send(id: bigint, at?: Date | null) {
    const c = await this.find(id)
    if (!["draft", "scheduled"].includes(c.status)) throw new ConflictError("This campaign has already started", "VALIDATION_FAILED")
    if (at && +at < Date.now() - 60_000) throw new BadRequestError("Pick a time in the future", "VALIDATION_FAILED")
    const { people } = await this.preview({ body: c.body, audience: c.audience as Audience, stopLink: c.stopLink })
    if (!people) throw new BadRequestError("Nobody matches this audience", "VALIDATION_FAILED")
    return view(await prisma.smsCampaign.update({ where: { id }, data: { status: "scheduled", scheduledAt: at ?? new Date() } }))
  }

  /** Stops it: nothing more goes out (what was sent stays sent). */
  async cancel(id: bigint) {
    const c = await this.find(id)
    if (!["scheduled", "sending"].includes(c.status)) throw new ConflictError("Only a scheduled or sending campaign can be cancelled", "VALIDATION_FAILED")
    await prisma.$transaction([
      prisma.smsCampaign.update({ where: { id }, data: { status: "cancelled", finishedAt: new Date() } }),
      prisma.smsCampaignRecipient.updateMany({ where: { campaignId: id, status: "pending" }, data: { status: "skipped" } }),
    ])
    return view(await this.find(id))
  }
}

/** Fixes who a campaign goes to when it starts: its audience then, minus opted-out and bad numbers. */
async function startCampaign(c: { id: bigint; storeId: bigint; audience: Prisma.JsonValue }, now: Date) {
  const claimed = await prisma.smsCampaign.updateMany({ where: { id: c.id, status: "scheduled" }, data: { status: "sending", startedAt: now } })
  if (!claimed.count) return
  const out = new Set((await prisma.smsOptOut.findMany({ where: { storeId: c.storeId }, select: { phone: true } })).map((o) => o.phone))
  const customers = await prisma.customer.findMany({ where: audienceWhere(c.storeId, c.audience as Audience, now), select: { id: true, phone: true, firstName: true } })
  const seen = new Set<string>()
  const rows: Prisma.SmsCampaignRecipientCreateManyInput[] = []
  for (const cu of customers) {
    const phone = bdMobile(cu.phone)
    if (!phone || out.has(phone) || seen.has(phone)) continue
    seen.add(phone)
    rows.push({ campaignId: c.id, customerId: cu.id, phone, firstName: cu.firstName, stopToken: token() })
  }
  for (let i = 0; i < rows.length; i += 1000) await prisma.smsCampaignRecipient.createMany({ data: rows.slice(i, i + 1000), skipDuplicates: true })
  await prisma.smsCampaign.update({ where: { id: c.id }, data: { recipients: rows.length } })
  logSystem(c.storeId, { by: "SMS campaigns", action: "sms_campaigns.started", objectType: "sms_campaigns", objectId: c.id, details: { recipients: rows.length } })
}

/** Sends the next batch of one campaign; closes it when nobody is left. */
async function sendBatch(c: { id: bigint; storeId: bigint; body: string; stopLink: boolean }) {
  const batch = await prisma.smsCampaignRecipient.findMany({ where: { campaignId: c.id, status: "pending" }, take: BATCH, orderBy: { id: "asc" } })
  if (!batch.length) {
    const closed = await prisma.smsCampaign.updateMany({ where: { id: c.id, status: "sending" }, data: { status: "sent", finishedAt: new Date() } })
    if (closed.count) logSystem(c.storeId, { by: "SMS campaigns", action: "sms_campaigns.sent", objectType: "sms_campaigns", objectId: c.id })
    return 0
  }
  const sms = await smsFor(c.storeId)
  const base = (await storeUrls(c.storeId)).storefront
  let sent = 0
  let failed = 0
  for (const r of batch) {
    // Claimed first, so a second run can't send it again.
    const mine = await prisma.smsCampaignRecipient.updateMany({ where: { id: r.id, status: "pending" }, data: { status: "sending" } })
    if (!mine.count) continue
    const m = await sms
      .send({ to: r.phone, text: personalise(c.body, r.firstName, c.stopLink ? `${base}/s/${r.stopToken}` : undefined), kind: "campaign", campaignId: c.id })
      .catch(() => null)
    const ok = !!m && m.status !== "failed"
    await prisma.smsCampaignRecipient.update({ where: { id: r.id }, data: { status: ok ? "sent" : "failed", sentAt: new Date() } })
    if (ok) sent++
    else failed++
  }
  await prisma.smsCampaign.update({ where: { id: c.id }, data: { sent: { increment: sent }, failed: { increment: failed } } })
  return sent
}

/** The job: start what's due and send a batch of each campaign that's sending. */
export async function runSmsCampaigns(now = new Date()) {
  if (inQuietHours(now)) return { sent: 0, paused: true }
  const due = await prisma.smsCampaign.findMany({ where: { status: "scheduled", scheduledAt: { lte: now } }, select: { id: true, storeId: true, audience: true } })
  for (const c of due) await startCampaign(c, now).catch((err: unknown) => logger.error({ err, campaignId: String(c.id) }, "SMS campaign didn't start"))
  const sending = await prisma.smsCampaign.findMany({ where: { status: "sending" }, select: { id: true, storeId: true, body: true, stopLink: true } })
  let sent = 0
  for (const c of sending) sent += await sendBatch(c).catch((err: unknown) => (logger.error({ err, campaignId: String(c.id) }, "SMS campaign batch failed"), 0))
  return { sent, paused: false }
}

/** The stop link: no more campaigns to this number from this shop. */
export async function stopByToken(stopToken: string) {
  const r = await prisma.smsCampaignRecipient.findUnique({ where: { stopToken }, include: { campaign: { select: { storeId: true } } } })
  if (!r) throw new NotFoundError("Link")
  await prisma.smsOptOut.upsert({ where: { storeId_phone: { storeId: r.campaign.storeId, phone: r.phone } }, create: { storeId: r.campaign.storeId, phone: r.phone }, update: {} })
  return { ok: true }
}
