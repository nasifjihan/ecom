/**
 * CRM LEADS: people who asked and haven't ordered. Staff note every call and message, set
 * the next follow-up, make the lead a customer and, with an order, win it.
 */
import { alertStaffLater } from "../staff-alerts/staff-alerts.service"
import type { Prisma } from "@prisma/client"
import { prisma } from "../../config"
import { BadRequestError, ConflictError, NotFoundError, type RequestContext } from "../../core"
import { bdMobile, phoneVariants } from "../sms/sms.rules"
import { splitName } from "../landing/landing.rules"
import { cleanHandle, cleanTags, customerSource, followUpState, isOpen, LEAD_STATUSES, OPEN_STATUSES, statusChangeProblem, statusWord, todayRange } from "./leads.rules"

export interface LeadInput {
  name: string
  phone?: string | null
  email?: string | null
  channel: string
  handle?: string | null
  interest?: string | null
  value?: number | null
  tags?: string[]
  ownerId?: bigint | null
  nextFollowUpAt?: Date | null
  note?: string | null
}

export interface LeadQuery {
  status?: string
  owner?: string
  due?: "overdue" | "today"
  tag?: string
  search?: string
  page: number
  perPage: number
}

const include = {
  owner: { select: { id: true, name: true } },
  customer: { select: { id: true, firstName: true, lastName: true, orderCount: true, status: true } },
} satisfies Prisma.LeadInclude

type Row = Prisma.LeadGetPayload<{ include: typeof include }>

const phoneOf = (raw: string | null | undefined): string | null => {
  const t = (raw ?? "").trim()
  if (!t) return null
  return bdMobile(t) ?? t.slice(0, 30)
}
const emailOf = (raw: string | null | undefined): string | null => {
  const t = (raw ?? "").trim().toLowerCase()
  return t ? t : null
}
const phoneMatch = (phone: string) => {
  const m = bdMobile(phone)
  return { in: m ? phoneVariants(m) : [phone] }
}

export class LeadsService {
  private readonly storeId: bigint

  constructor(private readonly ctx: RequestContext) {
    if (ctx.storeId === undefined) throw new BadRequestError("Store not resolved", "TENANT_NOT_RESOLVED")
    this.storeId = BigInt(ctx.storeId)
  }

  // ------------------------------------------------------------ helpers

  private async me(): Promise<{ id: bigint | null; name: string }> {
    const a = this.ctx.admin
    if (!a || a.role === "SUPER") return { id: null, name: "Platform team" }
    const row = await prisma.adminUser.findFirst({ where: { id: a.id, storeId: this.storeId }, select: { id: true, name: true } })
    return row ? { id: row.id, name: row.name } : { id: null, name: "Staff" }
  }

  private async checkOwner(ownerId: bigint | null | undefined) {
    if (ownerId === undefined || ownerId === null) return
    const ok = await prisma.adminUser.count({ where: { id: ownerId, storeId: this.storeId, status: "active" } })
    if (!ok) throw new BadRequestError("Pick someone on your team", "VALIDATION_FAILED")
  }

  private async lead(id: bigint): Promise<Row> {
    const row = await prisma.lead.findFirst({ where: { id, storeId: this.storeId }, include })
    if (!row) throw new NotFoundError("Lead", String(id))
    return row
  }

  /** An open lead with this phone (other than `exceptId`), so the same person isn't followed twice. */
  private async openDuplicate(phone: string | null, exceptId?: bigint) {
    if (!phone) return null
    return prisma.lead.findFirst({
      where: { storeId: this.storeId, status: { in: [...OPEN_STATUSES] }, phone: phoneMatch(phone), ...(exceptId ? { NOT: { id: exceptId } } : {}) },
      select: { id: true, name: true },
    })
  }

  /** The store's customer with this phone or email, if any. */
  private async customerFor(phone: string | null, email: string | null) {
    const or: Prisma.CustomerWhereInput[] = []
    if (phone) or.push({ phone: phoneMatch(phone) })
    if (email) or.push({ email: { equals: email, mode: "insensitive" } })
    if (!or.length) return null
    return prisma.customer.findFirst({ where: { storeId: this.storeId, OR: or }, select: { id: true }, orderBy: { id: "asc" } })
  }

  private async log(leadId: bigint, kind: string, body: string, who?: { id: bigint | null; name: string }) {
    const w = who ?? (await this.me())
    await prisma.leadNote.create({ data: { leadId, kind, body, authorId: w.id, authorName: w.name } })
  }

  /** "Lead given to you" for the follower (not when they gave it to themselves). */
  private tellFollower(ownerId: bigint | null, leadId: bigint, name: string, by: { id: bigint | null; name: string }) {
    if (!ownerId) return
    alertStaffLater(this.storeId, "lead_assigned", {
      title: `${by.name} gave you a lead: ${name}`,
      link: `/customers/leads/${leadId}`,
      assigneeId: ownerId,
      byId: by.id,
    })
  }

  private dto(r: Row, orderNumber?: string | null) {
    return {
      id: String(r.id),
      name: r.name,
      phone: r.phone,
      email: r.email,
      channel: r.channel,
      handle: r.handle,
      interest: r.interest,
      value: r.value === null ? null : Number(r.value),
      tags: r.tags,
      status: r.status,
      lostReason: r.lostReason,
      owner: r.owner ? { id: String(r.owner.id), name: r.owner.name } : null,
      nextFollowUpAt: r.nextFollowUpAt?.toISOString() ?? null,
      followUp: isOpen(r.status) ? followUpState(r.nextFollowUpAt, new Date()) : "none",
      lastContactAt: r.lastContactAt?.toISOString() ?? null,
      customer: r.customer
        ? { id: String(r.customer.id), name: `${r.customer.firstName} ${r.customer.lastName}`.trim(), orderCount: r.customer.orderCount, banned: ["banned", "suspended"].includes(r.customer.status.toLowerCase()) }
        : null,
      orderId: r.orderId === null ? null : String(r.orderId),
      orderNumber: orderNumber ?? null,
      closedAt: r.closedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    }
  }

  // ------------------------------------------------------------ list

  private where(q: Omit<LeadQuery, "page" | "perPage" | "status">, meId: bigint | null): Prisma.LeadWhereInput {
    const w: Prisma.LeadWhereInput = { storeId: this.storeId }
    if (q.owner === "me") w.ownerId = meId ?? BigInt(-1)
    else if (q.owner === "none") w.ownerId = null
    else if (q.owner && /^\d+$/.test(q.owner)) w.ownerId = BigInt(q.owner)
    if (q.tag) w.tags = { has: q.tag.trim().toLowerCase() }
    const s = q.search?.trim()
    if (s) {
      const m = bdMobile(s)
      w.OR = [
        { name: { contains: s, mode: "insensitive" } },
        { handle: { contains: s.replace(/^@/, ""), mode: "insensitive" } },
        { email: { contains: s, mode: "insensitive" } },
        { interest: { contains: s, mode: "insensitive" } },
        { phone: m ? { in: phoneVariants(m) } : { contains: s } },
      ]
    }
    if (q.due) {
      const { start, end } = todayRange(new Date())
      w.status = { in: [...OPEN_STATUSES] }
      w.nextFollowUpAt = q.due === "overdue" ? { lt: start } : { gte: start, lt: end }
    }
    return w
  }

  async list(q: LeadQuery) {
    const me = await this.me()
    const base = this.where(q, me.id)
    const where: Prisma.LeadWhereInput =
      q.status === "open" ? { ...base, status: { in: [...OPEN_STATUSES] } } : q.status ? { ...base, status: q.status } : base
    const [rows, total, byStatus, overdue, today] = await Promise.all([
      prisma.lead.findMany({
        where,
        include,
        orderBy: [{ nextFollowUpAt: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
        skip: (q.page - 1) * q.perPage,
        take: q.perPage,
      }),
      prisma.lead.count({ where }),
      prisma.lead.groupBy({ by: ["status"], where: this.where({ ...q, due: undefined }, me.id), _count: { _all: true } }),
      prisma.lead.count({ where: this.where({ owner: q.owner, due: "overdue" }, me.id) }),
      prisma.lead.count({ where: this.where({ owner: q.owner, due: "today" }, me.id) }),
    ])
    const counts = Object.fromEntries(LEAD_STATUSES.map((s) => [s, byStatus.find((b) => b.status === s)?._count._all ?? 0]))
    return {
      items: rows.map((r) => this.dto(r)),
      meta: { total, page: q.page, perPage: q.perPage, totalPages: Math.max(1, Math.ceil(total / q.perPage)), counts, overdue, today },
    }
  }

  async get(id: bigint) {
    const r = await this.lead(id)
    const [notes, order] = await Promise.all([
      prisma.leadNote.findMany({ where: { leadId: id }, orderBy: { createdAt: "desc" }, take: 200 }),
      r.orderId ? prisma.order.findFirst({ where: { id: r.orderId, storeId: this.storeId }, select: { number: true } }) : null,
    ])
    return {
      ...this.dto(r, order?.number),
      notes: notes.map((n) => ({ id: String(n.id), kind: n.kind, body: n.body, author: n.authorName, createdAt: n.createdAt.toISOString() })),
    }
  }

  async tags(): Promise<string[]> {
    const rows = await prisma.$queryRaw<{ tag: string }[]>`SELECT DISTINCT unnest("tags") AS tag FROM "Lead" WHERE "storeId" = ${this.storeId} ORDER BY 1 LIMIT 200`
    return rows.map((r) => r.tag)
  }

  /** Staff a lead can be given to. */
  async owners() {
    const rows = await prisma.adminUser.findMany({ where: { storeId: this.storeId, status: "active" }, select: { id: true, name: true, isSalesperson: true }, orderBy: { name: "asc" } })
    return rows.map((r) => ({ id: String(r.id), name: r.name, isSalesperson: r.isSalesperson }))
  }

  // ------------------------------------------------------------ changes

  async create(d: LeadInput) {
    const phone = phoneOf(d.phone)
    const email = emailOf(d.email)
    if (!phone && !email && !cleanHandle(d.handle)) throw new BadRequestError("Add a phone number, an email or their name on the channel", "VALIDATION_FAILED")
    const dup = await this.openDuplicate(phone)
    if (dup) throw new ConflictError(`${dup.name} already has an open lead with this phone (lead #${dup.id})`, "CONFLICT")
    await this.checkOwner(d.ownerId)
    const me = await this.me()
    const customer = await this.customerFor(phone, email)
    const row = await prisma.lead.create({
      data: {
        storeId: this.storeId,
        name: d.name.trim(),
        phone,
        email,
        channel: d.channel,
        handle: cleanHandle(d.handle),
        interest: d.interest?.trim() ? d.interest.trim() : null,
        value: d.value ?? null,
        tags: cleanTags(d.tags),
        ownerId: d.ownerId === undefined ? me.id : d.ownerId,
        nextFollowUpAt: d.nextFollowUpAt ?? null,
        customerId: customer?.id ?? null,
        createdById: me.id,
      },
    })
    await this.log(row.id, "status", "Lead added", me)
    this.tellFollower(row.ownerId, row.id, row.name, me)
    if (d.note?.trim()) await this.log(row.id, "note", d.note.trim(), me)
    return this.get(row.id)
  }

  async update(id: bigint, d: Partial<LeadInput>) {
    const r = await this.lead(id)
    const data: Prisma.LeadUncheckedUpdateInput = {}
    if (d.name !== undefined) data.name = d.name.trim()
    if (d.phone !== undefined) {
      const phone = phoneOf(d.phone)
      if (isOpen(r.status)) {
        const dup = await this.openDuplicate(phone, id)
        if (dup) throw new ConflictError(`${dup.name} already has an open lead with this phone (lead #${dup.id})`, "CONFLICT")
      }
      data.phone = phone
    }
    if (d.email !== undefined) data.email = emailOf(d.email)
    if (d.channel !== undefined) data.channel = d.channel
    if (d.handle !== undefined) data.handle = cleanHandle(d.handle)
    if (d.interest !== undefined) data.interest = d.interest?.trim() ? d.interest.trim() : null
    if (d.value !== undefined) data.value = d.value
    if (d.tags !== undefined) data.tags = cleanTags(d.tags)
    if (d.nextFollowUpAt !== undefined) data.nextFollowUpAt = d.nextFollowUpAt
    if (d.ownerId !== undefined && d.ownerId !== r.ownerId) {
      await this.checkOwner(d.ownerId)
      data.ownerId = d.ownerId
      const to = d.ownerId ? await prisma.adminUser.findUnique({ where: { id: d.ownerId }, select: { name: true } }) : null
      const me = await this.me()
      await this.log(id, "status", to ? `Given to ${to.name}` : "No one is following this lead now", me)
      this.tellFollower(d.ownerId, id, r.name, me)
    }
    await prisma.lead.update({ where: { id }, data })
    return this.get(id)
  }

  async setStatus(id: bigint, status: string, reason?: string | null) {
    const r = await this.lead(id)
    const problem = statusChangeProblem(r.status, status, reason)
    if (problem) throw new BadRequestError(problem, "VALIDATION_FAILED")
    if (!isOpen(r.status) && isOpen(status) && r.phone) {
      const dup = await this.openDuplicate(r.phone, id)
      if (dup) throw new ConflictError(`${dup.name} already has an open lead with this phone (lead #${dup.id})`, "CONFLICT")
    }
    const lost = status === "lost"
    await prisma.lead.update({
      where: { id },
      data: {
        status,
        lostReason: lost ? reason!.trim() : null,
        closedAt: lost ? new Date() : null,
        ...(lost ? { nextFollowUpAt: null } : {}),
        ...(status === "contacted" && r.status === "new" ? { lastContactAt: new Date() } : {}),
      },
    })
    await this.log(id, "status", `${statusWord(r.status)} → ${statusWord(status)}${lost ? `: ${reason!.trim()}` : ""}`)
    return this.get(id)
  }

  /** A note, call or message; calls and messages count as contact (a new lead becomes "contacted"). */
  async addNote(id: bigint, d: { kind: string; body: string; nextFollowUpAt?: Date | null }) {
    const r = await this.lead(id)
    const me = await this.me()
    await this.log(id, d.kind, d.body.trim(), me)
    const contact = d.kind === "call" || d.kind === "message"
    const data: Prisma.LeadUncheckedUpdateInput = {}
    if (contact) data.lastContactAt = new Date()
    if (contact && r.status === "new") {
      data.status = "contacted"
      await this.log(id, "status", "New → Contacted", me)
    }
    if (d.nextFollowUpAt !== undefined) data.nextFollowUpAt = d.nextFollowUpAt
    if (Object.keys(data).length) await prisma.lead.update({ where: { id }, data })
    return this.get(id)
  }

  /** Links the lead to the store's customer with the same phone or email, or makes one. */
  async makeCustomer(id: bigint): Promise<{ customerId: string; created: boolean }> {
    const r = await this.lead(id)
    if (r.customerId) return { customerId: String(r.customerId), created: false }
    const found = await this.customerFor(r.phone, r.email)
    let customerId = found?.id
    if (!customerId) {
      if (!r.phone && !r.email) throw new BadRequestError("Add their phone number or email first", "VALIDATION_FAILED")
      const { firstName, lastName } = splitName(r.name)
      const c = await prisma.customer.create({
        data: { storeId: this.storeId, firstName: firstName || r.name, lastName, phone: r.phone, email: r.email, source: customerSource(r.channel) },
        select: { id: true },
      })
      customerId = c.id
    }
    await prisma.lead.update({ where: { id }, data: { customerId } })
    await this.log(id, "status", found ? "Linked to their customer record" : "Made into a customer")
    return { customerId: String(customerId), created: !found }
  }

  async remove(id: bigint) {
    await this.lead(id)
    await prisma.lead.delete({ where: { id } })
  }
}

// ------------------------------------------------------------ orders

/** Before a staff order is made from a lead: the lead must be this store's and still open. */
export async function leadForOrder(storeId: bigint, leadId: bigint) {
  const lead = await prisma.lead.findFirst({ where: { id: leadId, storeId }, select: { id: true, status: true, ownerId: true, customerId: true } })
  if (!lead) throw new NotFoundError("Lead", String(leadId))
  if (!isOpen(lead.status)) throw new BadRequestError(lead.status === "won" ? "This lead already has its order" : "This lead was marked lost. Reopen it first.", "VALIDATION_FAILED")
  return lead
}

/** After the order is made: the lead is won, linked to the customer and the order. */
export async function winLead(storeId: bigint, leadId: bigint, order: { id: bigint; number: string; customerId: bigint }, by: { id: bigint | null; name: string }) {
  const lead = await prisma.lead.findFirst({ where: { id: leadId, storeId }, select: { status: true } })
  if (!lead) return
  await prisma.lead.update({
    where: { id: leadId },
    data: { status: "won", orderId: order.id, customerId: order.customerId, closedAt: new Date(), nextFollowUpAt: null, lostReason: null },
  })
  await prisma.leadNote.create({ data: { leadId, kind: "status", body: `${statusWord(lead.status)} → Won: order ${order.number}`, authorId: by.id, authorName: by.name } })
}
