/**
 * TEAM ALERTS: tells staff about new orders, payments to check, return requests, quote
 * requests, low stock and leads given to them, by the bell in the admin, email and/or SMS,
 * as set in Settings > Notifications. Never throws to the caller: a failed alert is logged.
 */
import type { Prisma } from "@prisma/client"
import { logger, prisma } from "../../config"
import { BadRequestError, NotFoundError } from "../../core"
import { EmailService } from "../notifications/notifications.service"
import { SmsService } from "../sms/sms.service"
import { bdMobile, eventSettings } from "../sms/sms.rules"
import { storeUrls } from "../content/store-details"
import { isTemplateKey, type TemplateKey } from "../notifications/email.templates"
import {
  CUSTOMER_EVENTS,
  STAFF_EVENTS,
  STAFF_EVENT_INFO,
  alertRecipients,
  isStaffEvent,
  staffSetting,
  staffSmsText,
  type StaffEvent,
} from "./staff-alerts.rules"

export interface Alert {
  title: string
  body?: string
  /** Admin path, e.g. "/orders/12". */
  link?: string
  /** What it's about, e.g. "product:4", to skip repeats within `onceWithinHours`. */
  refKey?: string
  onceWithinHours?: number
  /** For "given to you" events. */
  assigneeId?: bigint | null
  /** Who did it (not told about their own action). */
  byId?: bigint | null
}

async function settingFor(storeId: bigint, event: StaffEvent) {
  const row = await prisma.staffAlertSetting.findUnique({ where: { storeId_event: { storeId, event } } })
  return staffSetting(event, row)
}

/** Sends one alert on the channels set for its event. Resolves once it's queued; never rejects. */
export async function alertStaff(storeId: bigint, event: StaffEvent, a: Alert): Promise<number> {
  try {
    if (a.refKey && a.onceWithinHours) {
      const since = new Date(Date.now() - a.onceWithinHours * 3_600_000)
      const seen = await prisma.staffNotice.count({ where: { storeId, event, refKey: a.refKey, createdAt: { gte: since } } })
      if (seen) return 0
    }
    const setting = await settingFor(storeId, event)
    const info = STAFF_EVENT_INFO[event]
    const ownEmail = info.emailTemplate !== undefined // sent by its own template elsewhere
    if (!setting.inApp && !(setting.email && !ownEmail) && !setting.sms) return 0
    const staff = await prisma.adminUser.findMany({
      where: { storeId },
      select: { id: true, status: true, email: true, phone: true, role: { select: { slug: true } } },
    })
    const ids = alertRecipients(
      event,
      setting,
      staff.map((s) => ({ id: s.id, active: s.status === "active", owner: s.role.slug === "owner" })),
      { assigneeId: a.assigneeId, byId: a.byId },
    )
    if (!ids.length) return 0
    const people = staff.filter((s) => ids.includes(s.id))

    // The bell. Always written when it's on; also the record that stops repeats.
    if (setting.inApp || a.refKey) {
      await prisma.staffNotice.createMany({
        data: people.map((p) => ({
          storeId,
          adminId: p.id,
          event,
          title: a.title,
          body: a.body ?? null,
          link: a.link ?? null,
          refKey: a.refKey ?? null,
          // Kept only to stop repeats when the bell is off for this alert.
          hidden: !setting.inApp,
        })),
      })
    }
    if (setting.email && !ownEmail) {
      const urls = await storeUrls(storeId)
      await new EmailService(storeId).teamAlert(
        people.map((p) => p.email),
        { title: a.title, body: a.body ?? "", url: `${urls.admin}${a.link ?? ""}` },
      )
    }
    if (setting.sms) {
      const store = await prisma.store.findUnique({ where: { id: storeId }, select: { name: true } })
      const sms = new SmsService(storeId)
      for (const p of people) {
        if (bdMobile(p.phone)) await sms.send({ to: p.phone!, text: staffSmsText(store?.name ?? "Shop", a.title), kind: `staff_${event}` })
      }
    }
    return people.length
  } catch (err) {
    logger.error({ err, storeId: String(storeId), event }, "Team alert failed")
    return 0
  }
}

/** Fire and forget, for request handlers. */
export function alertStaffLater(storeId: bigint, event: StaffEvent, a: Alert) {
  void alertStaff(storeId, event, a)
}

// ------------------------------------------------------------------ the bell

export class StaffInbox {
  constructor(
    private readonly storeId: bigint,
    private readonly adminId: bigint,
  ) {}

  async list(q: { unread?: boolean; take: number }) {
    const mine: Prisma.StaffNoticeWhereInput = { storeId: this.storeId, adminId: this.adminId, hidden: false }
    const [rows, unread] = await Promise.all([
      prisma.staffNotice.findMany({ where: { ...mine, ...(q.unread ? { readAt: null } : {}) }, orderBy: { createdAt: "desc" }, take: q.take }),
      prisma.staffNotice.count({ where: { ...mine, readAt: null } }),
    ])
    return {
      unread,
      items: rows.map((r) => ({
        id: String(r.id),
        event: r.event,
        title: r.title,
        body: r.body,
        link: r.link,
        read: r.readAt !== null,
        createdAt: r.createdAt.toISOString(),
      })),
    }
  }

  async read(id: bigint) {
    const n = await prisma.staffNotice.updateMany({ where: { id, storeId: this.storeId, adminId: this.adminId, readAt: null }, data: { readAt: new Date() } })
    if (!n.count && !(await prisma.staffNotice.count({ where: { id, adminId: this.adminId } }))) throw new NotFoundError("Notification", String(id))
  }

  async readAll() {
    const n = await prisma.staffNotice.updateMany({ where: { storeId: this.storeId, adminId: this.adminId, hidden: false, readAt: null }, data: { readAt: new Date() } })
    return { marked: n.count }
  }
}

// ------------------------------------------------------------------ Settings > Notifications

export interface MatrixInput {
  customers?: { key: string; email?: boolean; sms?: boolean }[]
  staff?: { event: string; inApp?: boolean; email?: boolean; sms?: boolean; staffIds?: bigint[] }[]
}

export class NotificationMatrix {
  constructor(
    private readonly storeId: bigint,
    private readonly adminId?: bigint,
  ) {}

  async get() {
    const emails = new EmailService(this.storeId)
    const sms = await prisma.storeSmsSetting.findUnique({ where: { storeId: this.storeId } })
    const smsEvents = eventSettings(sms?.events)
    const smsReady = !!sms && sms.provider !== "log"
    const customers = await Promise.all(
      CUSTOMER_EVENTS.map(async (c) => ({
        key: c.key,
        label: c.label,
        email: (await emails.templateConfig(c.email as TemplateKey)).enabled,
        emailTemplate: c.email,
        sms: c.sms ? smsEvents[c.sms].enabled : null,
      })),
    )
    const rows = await prisma.staffAlertSetting.findMany({ where: { storeId: this.storeId } })
    const staff = await Promise.all(
      STAFF_EVENTS.map(async (e) => {
        const info = STAFF_EVENT_INFO[e]
        const s = staffSetting(e, rows.find((r) => r.event === e))
        // Events with their own email template are switched on and off there.
        const email = info.emailTemplate ? (await emails.templateConfig(info.emailTemplate)).enabled : s.email
        return {
          event: e,
          label: info.label,
          description: info.description,
          inApp: s.inApp,
          email,
          emailTemplate: info.emailTemplate ?? "staff_alert",
          sms: s.sms,
          toAssignee: info.toAssignee ?? false,
          staffIds: s.staffIds.map(String),
        }
      }),
    )
    const people = await prisma.adminUser.findMany({
      where: { storeId: this.storeId, status: "active" },
      select: { id: true, name: true, email: true, phone: true, role: { select: { name: true, slug: true } } },
      orderBy: { name: "asc" },
    })
    return {
      smsReady,
      customers,
      staff,
      people: people.map((p) => ({ id: String(p.id), name: p.name, email: p.email, hasMobile: !!bdMobile(p.phone), role: p.role.name, owner: p.role.slug === "owner" })),
    }
  }

  async save(input: MatrixInput) {
    const emails = new EmailService(this.storeId)
    const smsChanges: Record<string, { enabled: boolean }> = {}
    for (const c of input.customers ?? []) {
      const def = CUSTOMER_EVENTS.find((x) => x.key === c.key)
      if (!def) throw new BadRequestError(`Unknown message "${c.key}"`, "VALIDATION_FAILED")
      if (typeof c.email === "boolean" && isTemplateKey(def.email)) await emails.saveTemplate(def.email, { enabled: c.email }, this.adminId)
      if (typeof c.sms === "boolean" && def.sms) smsChanges[def.sms] = { enabled: c.sms }
    }
    if (Object.keys(smsChanges).length) await new SmsService(this.storeId).save({ events: smsChanges })

    for (const s of input.staff ?? []) {
      if (!isStaffEvent(s.event)) throw new BadRequestError(`Unknown alert "${s.event}"`, "VALIDATION_FAILED")
      const info = STAFF_EVENT_INFO[s.event]
      if (s.staffIds?.length) {
        const ok = await prisma.adminUser.count({ where: { storeId: this.storeId, id: { in: s.staffIds } } })
        if (ok !== new Set(s.staffIds.map(String)).size) throw new BadRequestError("Pick people from your team", "VALIDATION_FAILED")
      }
      const current = staffSetting(s.event, await prisma.staffAlertSetting.findUnique({ where: { storeId_event: { storeId: this.storeId, event: s.event } } }))
      if (info.emailTemplate && typeof s.email === "boolean") await emails.saveTemplate(info.emailTemplate, { enabled: s.email }, this.adminId)
      const data = {
        inApp: s.inApp ?? current.inApp,
        email: info.emailTemplate ? current.email : (s.email ?? current.email),
        sms: s.sms ?? current.sms,
        staffIds: info.toAssignee ? [] : (s.staffIds ?? current.staffIds),
      }
      await prisma.staffAlertSetting.upsert({
        where: { storeId_event: { storeId: this.storeId, event: s.event } },
        create: { storeId: this.storeId, event: s.event, ...data },
        update: data,
      })
    }
    return this.get()
  }
}
