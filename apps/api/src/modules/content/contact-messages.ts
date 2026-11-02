/**
 * CONTACT FORM AND INBOX — shoppers send a question, ask to be called back, or report a problem
 * with an order (its number and phone must match). Staff see them in Customers > Messages, mark
 * them open or done, give them to someone, and reply by SMS or email (kept with the message).
 */
import { z } from "zod"
import { prisma } from "../../config"
import { BadRequestError, NotFoundError, type RequestContext } from "../../core"
import { bdMobile } from "../sms/sms.rules"
import { alertStaffLater } from "../staff-alerts/staff-alerts.service"

export const CONTACT_KINDS = ["question", "callback", "order_problem"] as const
export const CONTACT_STATUSES = ["new", "open", "done"] as const
const HOUR = 3_600_000
/** At most this many messages an hour from one IP address or one phone. */
export const CONTACT_PER_HOUR = 5

const text = (max: number) => z.string().trim().max(max)

export const ContactDto = z.object({
  kind: z.enum(CONTACT_KINDS),
  name: text(80).min(2, "Enter your name"),
  phone: text(20).optional(),
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(254).optional().or(z.literal("")),
  message: text(2000).min(5, "Write your message"),
  callbackTime: text(80).optional(),
  orderNumber: text(40).optional(),
  /** Left empty by people; bots fill it in. */
  website: z.string().max(200).optional(),
})
export type ContactDto = z.infer<typeof ContactDto>

/** What each kind needs, as the message shoppers see (no database). */
export function contactProblem(d: Pick<ContactDto, "kind" | "phone" | "email" | "orderNumber">): string | null {
  const phone = bdMobile(d.phone)
  if (d.phone && !phone) return "Enter a mobile number like 01712345678"
  if (d.kind === "question" && !phone && !d.email) return "Enter your phone or email so we can reply"
  if (d.kind === "callback" && !phone) return "Enter the phone number to call"
  if (d.kind === "order_problem" && (!phone || !d.orderNumber)) return "Enter your order number and the phone number on the order"
  return null
}

/** The storefront's form. Returns nothing about the shop's inbox. */
export async function sendContactMessage(ctx: RequestContext, d: ContactDto, ip: string | null) {
  if (ctx.storeId === undefined) throw new BadRequestError("No store for this request", "STORE_REQUIRED")
  const storeId = BigInt(ctx.storeId)
  // A bot filled the hidden field: say thanks, keep nothing.
  if (d.website) return { ok: true }
  const problem = contactProblem(d)
  if (problem) throw new BadRequestError(problem, "VALIDATION_FAILED")
  const phone = bdMobile(d.phone)
  const since = new Date(Date.now() - HOUR)
  const recent = await prisma.contactMessage.count({
    where: { storeId, createdAt: { gte: since }, OR: [...(ip ? [{ ip }] : []), ...(phone ? [{ phone }] : [])] },
  })
  if (recent >= CONTACT_PER_HOUR) throw new BadRequestError("You've sent a few messages already. Please wait a while, or call us.", "RATE_LIMITED")

  let orderId: bigint | null = null
  if (d.kind === "order_problem") {
    const o = await prisma.order.findFirst({ where: { storeId, number: d.orderNumber!.replace(/^#/, ""), phoneKey: phone }, select: { id: true } })
    if (!o) throw new BadRequestError("We couldn't find that order with this phone number. Check both and try again.", "VALIDATION_FAILED")
    orderId = o.id
  }
  const m = await prisma.contactMessage.create({
    data: {
      storeId,
      storefrontId: ctx.storefrontId ?? null,
      kind: d.kind,
      name: d.name,
      phone,
      email: d.email || null,
      message: d.message,
      callbackTime: d.kind === "callback" ? d.callbackTime || null : null,
      orderId,
      customerId: ctx.customer?.id ?? null,
      ip,
    },
  })
  const what = { question: "A question", callback: "Call me back", order_problem: `Problem with order ${d.orderNumber}` }[d.kind]
  alertStaffLater(storeId, "contact_message", { title: `${what} from ${d.name}`, body: d.message.slice(0, 160), link: `/customers/messages?open=${m.id}` })
  return { ok: true }
}

export class ContactInbox {
  constructor(private readonly ctx: RequestContext) {}

  private get storeId(): bigint {
    if (this.ctx.storeId === undefined) throw new BadRequestError("No store for this request", "STORE_REQUIRED")
    return BigInt(this.ctx.storeId)
  }

  private async find(id: bigint) {
    const m = await prisma.contactMessage.findFirst({
      where: { id, storeId: this.storeId },
      include: { replies: { orderBy: { createdAt: "asc" } }, order: { select: { id: true, number: true, status: true } } },
    })
    if (!m) throw new NotFoundError("Message", String(id))
    return m
  }

  private async staffNames(ids: (bigint | null)[]) {
    const list = [...new Set(ids.filter((i): i is bigint => !!i))]
    const rows = list.length ? await prisma.adminUser.findMany({ where: { id: { in: list }, storeId: this.storeId }, select: { id: true, name: true } }) : []
    return new Map(rows.map((r) => [String(r.id), r.name]))
  }

  async list(q: { status?: string; kind?: string; search?: string; page: number; perPage: number }) {
    const s = q.search?.trim()
    const where = {
      storeId: this.storeId,
      ...(q.status ? { status: q.status } : {}),
      ...(q.kind ? { kind: q.kind } : {}),
      ...(s ? { OR: [{ name: { contains: s, mode: "insensitive" as const } }, { phone: { contains: s } }, { email: { contains: s, mode: "insensitive" as const } }, { message: { contains: s, mode: "insensitive" as const } }] } : {}),
    }
    const [rows, total, counts] = await Promise.all([
      prisma.contactMessage.findMany({ where, orderBy: { createdAt: "desc" }, skip: (q.page - 1) * q.perPage, take: q.perPage, include: { order: { select: { id: true, number: true } }, _count: { select: { replies: true } } } }),
      prisma.contactMessage.count({ where }),
      prisma.contactMessage.groupBy({ by: ["status"], where: { storeId: this.storeId }, _count: { _all: true } }),
    ])
    const names = await this.staffNames(rows.map((r) => r.assignedToId))
    return {
      items: rows.map((m) => ({
        id: String(m.id), kind: m.kind, name: m.name, phone: m.phone, email: m.email, message: m.message, callbackTime: m.callbackTime,
        status: m.status, createdAt: m.createdAt, order: m.order ? { id: String(m.order.id), number: m.order.number } : null,
        assignedTo: m.assignedToId ? { id: String(m.assignedToId), name: names.get(String(m.assignedToId)) ?? "Staff" } : null, replies: m._count.replies,
      })),
      counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])) as Record<string, number>,
      meta: { page: q.page, perPage: q.perPage, total, totalPages: Math.max(1, Math.ceil(total / q.perPage)) },
    }
  }

  async get(id: bigint) {
    const m = await this.find(id)
    const names = await this.staffNames([m.assignedToId, ...m.replies.map((r) => r.adminId)])
    return {
      id: String(m.id), kind: m.kind, name: m.name, phone: m.phone, email: m.email, message: m.message, callbackTime: m.callbackTime,
      status: m.status, createdAt: m.createdAt, customerId: m.customerId ? String(m.customerId) : null,
      order: m.order ? { id: String(m.order.id), number: m.order.number, status: m.order.status } : null,
      assignedTo: m.assignedToId ? { id: String(m.assignedToId), name: names.get(String(m.assignedToId)) ?? "Staff" } : null,
      replies: m.replies.map((r) => ({ id: String(r.id), channel: r.channel, body: r.body, by: r.adminId ? names.get(String(r.adminId)) ?? "Staff" : "Staff", createdAt: r.createdAt })),
    }
  }

  async update(id: bigint, d: { status?: (typeof CONTACT_STATUSES)[number]; assignedToId?: bigint | null }) {
    await this.find(id)
    if (d.assignedToId && !(await prisma.adminUser.count({ where: { id: d.assignedToId, storeId: this.storeId } }))) throw new NotFoundError("Staff member")
    await prisma.contactMessage.update({ where: { id }, data: { ...(d.status ? { status: d.status } : {}), ...(d.assignedToId !== undefined ? { assignedToId: d.assignedToId } : {}) } })
    return this.get(id)
  }

  /** A reply by SMS or email (sent now), or a note only staff see. A new message becomes open. */
  async reply(id: bigint, d: { channel: "sms" | "email" | "note"; body: string }) {
    const m = await this.find(id)
    if (d.channel === "sms") {
      if (!m.phone) throw new BadRequestError("This message has no phone number", "VALIDATION_FAILED")
      const { SmsService } = await import("../sms/sms.service")
      const sent = await new SmsService(this.storeId).send({ to: m.phone, text: d.body, kind: "contact_reply", orderId: m.orderId })
      if (sent.status === "failed") throw new BadRequestError(sent.error ?? "The SMS couldn't be sent", "VALIDATION_FAILED")
    } else if (d.channel === "email") {
      if (!m.email) throw new BadRequestError("This message has no email address", "VALIDATION_FAILED")
      const { EmailService } = await import("../notifications/notifications.service")
      const sent = await new EmailService(this.storeId).contactReply(m.email, { firstName: m.name.split(/\s+/)[0] ?? "", reply: d.body, message: m.message })
      if (!sent) throw new BadRequestError("The email couldn't be sent. Check Settings > Emails (the \"Reply to a message\" email may be off).", "VALIDATION_FAILED")
    }
    await prisma.$transaction([
      prisma.contactReply.create({ data: { messageId: m.id, channel: d.channel, body: d.body, adminId: this.ctx.admin?.id ? BigInt(this.ctx.admin.id) : null } }),
      ...(m.status === "new" ? [prisma.contactMessage.update({ where: { id: m.id }, data: { status: "open" } })] : []),
    ])
    return this.get(id)
  }
}
