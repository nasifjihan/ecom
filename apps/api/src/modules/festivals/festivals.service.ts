/**
 * FESTIVAL CALENDAR — Marketing > Festival calendar. Bangladesh's shopping festivals (added from
 * presets or by hand), each with a sale window, a prep checklist, the promotions, flash sales,
 * coupons and landing pages set up for it, and last year's sales in the same window. A reminder
 * email goes to the team before each sale starts (festivals.scheduler.ts).
 */
import type { Prisma } from "@prisma/client"
import { hasPermission } from "@ecom/shared-types"
import { logger, prisma } from "../../config"
import { BadRequestError, ForbiddenError, NotFoundError, type RequestContext } from "../../core"
import { EmailService } from "../notifications"
import { storeUrls } from "../content/store-details"
import {
  DEFAULT_TASKS,
  addDays,
  coverage,
  datesProblem,
  daysBetween,
  dhakaEnd,
  dhakaStart,
  dhakaToday,
  fromDay,
  lastYearWindow,
  phase,
  presetsFor,
  progress,
  reminderDue,
  tasksFrom,
  toDay,
  type Day,
  type Task,
} from "./festival.rules"

export type LinkKind = "promotion" | "flash_sale" | "coupon" | "landing_page"

const LINK_FIELD = {
  promotion: "promotionIds",
  flash_sale: "flashSaleIds",
  coupon: "couponIds",
  landing_page: "landingPageIds",
} as const

/** What staff need to change a campaign's dates. */
const EDIT_PERMISSION: Record<LinkKind, string> = {
  promotion: "promotions.edit",
  flash_sale: "flash_sales.edit",
  coupon: "coupons.edit",
  landing_page: "pages.edit",
}

export interface FestivalInput {
  name: string
  startsOn: Day
  endsOn: Day
  saleFrom: Day
  saleTo: Day
  dateIsEstimate?: boolean
  remindDays?: number
  note?: string | null
  checklist?: Task[]
  links?: Partial<Record<LinkKind, string[]>>
}

type Row = Prisma.FestivalGetPayload<object>

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
/** "21–23 Mar 2026", "24 Feb – 23 Mar 2026", "14 Apr 2026". */
export function dayRange(a: Day, b: Day): string {
  const [ya, ma, da] = a.split("-").map(Number) as [number, number, number]
  const [yb, mb, db] = b.split("-").map(Number) as [number, number, number]
  const one = (y: number, m: number, d: number, year = true) => `${d} ${MONTHS[m - 1]}${year ? ` ${y}` : ""}`
  if (a === b) return one(ya, ma, da)
  if (ya === yb && ma === mb) return `${da}–${db} ${MONTHS[mb - 1]} ${yb}`
  return `${one(ya, ma, da, ya !== yb)} – ${one(yb, mb, db)}`
}

const taka = (n: number) => `৳${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`

export class FestivalsService {
  constructor(private readonly ctx: RequestContext) {}

  private get storeId(): bigint {
    if (this.ctx.storeId === undefined) throw new BadRequestError("No store for this request", "STORE_REQUIRED")
    return this.ctx.storeId
  }

  private can(code: string) {
    return !!this.ctx.super || hasPermission(this.ctx.admin?.permissions ?? [], code)
  }

  // ---------------------------------------------------------------- sales in a window

  /** Orders and sales placed between two Dhaka days (cancelled and failed left out). */
  static async salesBetween(storeId: bigint, from: Day, to: Day) {
    const r = await prisma.order.aggregate({
      where: { storeId, createdAt: { gte: dhakaStart(from), lte: dhakaEnd(to) }, status: { notIn: ["CANCELLED", "FAILED"] } },
      _count: { _all: true },
      _sum: { grandTotal: true },
    })
    return { orders: r._count._all, sales: Number(r._sum.grandTotal ?? 0) }
  }

  // ---------------------------------------------------------------- views

  private summary(r: Row, today: Day) {
    const f = { startsOn: toDay(r.startsOn), endsOn: toDay(r.endsOn), saleFrom: toDay(r.saleFrom), saleTo: toDay(r.saleTo), remindDays: r.remindDays }
    const tasks = r.checklist as unknown as Task[]
    return {
      id: String(r.id),
      key: r.key,
      name: r.name,
      ...f,
      dateIsEstimate: r.dateIsEstimate,
      note: r.note,
      phase: phase(f, today),
      /** Days until the sale starts (negative once it has). */
      daysToSale: daysBetween(today, f.saleFrom),
      daysToFestival: daysBetween(today, f.startsOn),
      tasks: progress(tasks),
      links: r.promotionIds.length + r.flashSaleIds.length + r.couponIds.length + r.landingPageIds.length,
      remindedAt: r.remindedAt?.toISOString() ?? null,
    }
  }

  /** The festivals of a year (by the festival's first day), in date order. */
  async list(year: number) {
    const rows = await prisma.festival.findMany({
      where: { storeId: this.storeId, startsOn: { gte: fromDay(`${year}-01-01`), lte: fromDay(`${year}-12-31`) } },
      orderBy: [{ startsOn: "asc" }, { id: "asc" }],
    })
    const today = dhakaToday()
    const { unknown } = presetsFor(year)
    const added = new Set(rows.map((r) => r.key).filter(Boolean))
    return {
      year,
      today,
      festivals: rows.map((r) => this.summary(r, today)),
      /** Built-in festivals not on this year's calendar yet. */
      presetsToAdd: presetsFor(year).festivals.filter((p) => !added.has(p.key)).length,
      /** Built-in festivals with no known dates this year (moon-sighted ones far ahead). */
      unknownDates: unknown,
    }
  }

  /** The next festivals whose sale hasn't ended, for the dashboard. */
  async upcoming(limit = 3) {
    const today = dhakaToday()
    const rows = await prisma.festival.findMany({
      where: { storeId: this.storeId, saleTo: { gte: fromDay(today) } },
      orderBy: [{ saleFrom: "asc" }],
      take: limit,
    })
    return rows.map((r) => this.summary(r, today))
  }

  private async row(id: bigint) {
    const r = await prisma.festival.findFirst({ where: { id, storeId: this.storeId } })
    if (!r) throw new NotFoundError("Festival", String(id))
    return r
  }

  /** The campaigns linked to a festival, with their dates against the sale window. */
  private async linked(r: Row) {
    const saleFrom = toDay(r.saleFrom)
    const saleTo = toDay(r.saleTo)
    const storeId = this.storeId
    const [promotions, flash, coupons, pages] = await Promise.all([
      prisma.promotion.findMany({ where: { storeId, id: { in: r.promotionIds } }, select: { id: true, name: true, startsAt: true, endsAt: true, isActive: true } }),
      prisma.flashSale.findMany({ where: { storeId, id: { in: r.flashSaleIds } }, select: { id: true, name: true, startsAt: true, endsAt: true, isActive: true } }),
      prisma.coupon.findMany({ where: { storeId, id: { in: r.couponIds } }, select: { id: true, code: true, startsAt: true, expiresAt: true, isActive: true } }),
      prisma.landingPage.findMany({
        where: { storeId, id: { in: r.landingPageIds } },
        select: { id: true, title: true, slug: true, status: true, offerPrice: true, offerEndsAt: true },
      }),
    ])
    const item = (kind: LinkKind, id: bigint, name: string, startsAt: Date | null, endsAt: Date | null, active: boolean) => ({
      kind,
      id: String(id),
      name,
      startsAt: startsAt?.toISOString() ?? null,
      endsAt: endsAt?.toISOString() ?? null,
      active,
      coverage: coverage({ startsAt, endsAt }, saleFrom, saleTo),
      canMatch: this.can(EDIT_PERMISSION[kind]),
    })
    return [
      ...promotions.map((p) => item("promotion", p.id, p.name, p.startsAt, p.endsAt, p.isActive)),
      ...flash.map((p) => item("flash_sale", p.id, p.name, p.startsAt, p.endsAt, p.isActive)),
      ...coupons.map((c) => item("coupon", c.id, c.code, c.startsAt, c.expiresAt, c.isActive)),
      // A landing page's offer has no start: it runs from publishing to its end.
      ...pages.map((p) => ({ ...item("landing_page", p.id, p.title, null, p.offerEndsAt, p.status === "published"), slug: p.slug })),
    ]
  }

  async get(id: bigint) {
    const r = await this.row(id)
    const today = dhakaToday()
    const base = this.summary(r, today)
    const last = lastYearWindow({ key: r.key, startsOn: base.startsOn, saleFrom: base.saleFrom, saleTo: base.saleTo })
    const started = today >= base.saleFrom
    const [lastYear, thisYear, links] = await Promise.all([
      FestivalsService.salesBetween(this.storeId, last.from, last.to),
      started ? FestivalsService.salesBetween(this.storeId, base.saleFrom, today < base.saleTo ? today : base.saleTo) : null,
      this.linked(r),
    ])
    return {
      ...base,
      remindDays: r.remindDays,
      checklist: r.checklist as unknown as Task[],
      links,
      lastYear: { ...last, ...lastYear },
      thisYear,
    }
  }

  // ---------------------------------------------------------------- changes

  /** Only the store's own campaigns can be linked. */
  private async checkLinks(links: FestivalInput["links"]) {
    const ids = (k: LinkKind) => [...new Set(links?.[k] ?? [])].map((x) => BigInt(x))
    const out = {
      promotionIds: ids("promotion"),
      flashSaleIds: ids("flash_sale"),
      couponIds: ids("coupon"),
      landingPageIds: ids("landing_page"),
    }
    const storeId = this.storeId
    const counts = await Promise.all([
      prisma.promotion.count({ where: { storeId, id: { in: out.promotionIds } } }),
      prisma.flashSale.count({ where: { storeId, id: { in: out.flashSaleIds } } }),
      prisma.coupon.count({ where: { storeId, id: { in: out.couponIds } } }),
      prisma.landingPage.count({ where: { storeId, id: { in: out.landingPageIds } } }),
    ])
    const wanted = [out.promotionIds, out.flashSaleIds, out.couponIds, out.landingPageIds].map((a) => a.length)
    if (counts.some((c, i) => c !== wanted[i])) throw new BadRequestError("One of the linked campaigns wasn't found", "VALIDATION_FAILED")
    return out
  }

  private async data(d: FestivalInput, current?: Row) {
    const problem = datesProblem(d)
    if (problem) throw new BadRequestError(problem, "VALIDATION_FAILED")
    const checklist = (d.checklist ?? []).map((t, i) => ({ id: t.id || `t${i + 1}`, text: t.text.trim(), done: t.done })).filter((t) => t.text)
    const saleFrom = fromDay(d.saleFrom)
    // A new sale start or reminder lead means a new reminder.
    const remindAgain = current?.saleFrom.getTime() !== saleFrom.getTime() || current.remindDays !== (d.remindDays ?? 14)
    return {
      name: d.name.trim(),
      startsOn: fromDay(d.startsOn),
      endsOn: fromDay(d.endsOn),
      saleFrom,
      saleTo: fromDay(d.saleTo),
      dateIsEstimate: d.dateIsEstimate ?? false,
      remindDays: d.remindDays ?? 14,
      note: d.note?.trim() ? d.note.trim() : null,
      checklist: checklist as unknown as Prisma.InputJsonValue,
      ...(d.links ? await this.checkLinks(d.links) : {}),
      ...(remindAgain ? { remindedAt: null } : {}),
    }
  }

  async create(d: FestivalInput) {
    const r = await prisma.festival.create({
      // A new festival starts with the usual checklist unless one was given.
      data: { storeId: this.storeId, key: null, ...(await this.data({ ...d, checklist: d.checklist?.length ? d.checklist : tasksFrom(DEFAULT_TASKS) })) },
    })
    return this.get(r.id)
  }

  async update(id: bigint, d: FestivalInput) {
    const current = await this.row(id)
    await prisma.festival.update({ where: { id }, data: await this.data(d, current) })
    return this.get(id)
  }

  /** Ticks a checklist item on or off. */
  async setTask(id: bigint, taskId: string, done: boolean) {
    const r = await this.row(id)
    const tasks = r.checklist as unknown as Task[]
    if (!tasks.some((t) => t.id === taskId)) throw new NotFoundError("Task", taskId)
    const next = tasks.map((t) => (t.id === taskId ? { ...t, done } : t))
    await prisma.festival.update({ where: { id }, data: { checklist: next as unknown as Prisma.InputJsonValue } })
    return progress(next)
  }

  async remove(id: bigint) {
    await this.row(id)
    await prisma.festival.delete({ where: { id } })
  }

  /** Adds the built-in festivals of a year that aren't on the calendar yet. */
  async addPresets(year: number) {
    const { festivals, unknown } = presetsFor(year)
    const have = await prisma.festival.findMany({
      where: { storeId: this.storeId, key: { not: null }, startsOn: { gte: fromDay(`${year}-01-01`), lte: fromDay(`${year}-12-31`) } },
      select: { key: true },
    })
    const skip = new Set(have.map((h) => h.key))
    const fresh = festivals.filter((f) => !skip.has(f.key))
    if (fresh.length)
      await prisma.festival.createMany({
        data: fresh.map((f) => ({
          storeId: this.storeId,
          key: f.key,
          name: f.name,
          startsOn: fromDay(f.startsOn),
          endsOn: fromDay(f.endsOn),
          saleFrom: fromDay(f.saleFrom),
          saleTo: fromDay(f.saleTo),
          dateIsEstimate: f.dateIsEstimate,
          remindDays: f.remindDays,
          checklist: tasksFrom(f.tasks) as unknown as Prisma.InputJsonValue,
        })),
      })
    return { added: fresh.length, unknownDates: unknown }
  }

  /** Campaigns that can be linked: promotions, flash sales, coupons and landing pages. */
  async linkOptions() {
    const storeId = this.storeId
    const [promotions, flash, coupons, pages] = await Promise.all([
      prisma.promotion.findMany({ where: { storeId }, select: { id: true, name: true }, orderBy: { id: "desc" }, take: 200 }),
      prisma.flashSale.findMany({ where: { storeId }, select: { id: true, name: true }, orderBy: { id: "desc" }, take: 200 }),
      prisma.coupon.findMany({ where: { storeId }, select: { id: true, code: true }, orderBy: { id: "desc" }, take: 200 }),
      prisma.landingPage.findMany({ where: { storeId }, select: { id: true, title: true }, orderBy: { id: "desc" }, take: 200 }),
    ])
    return [
      ...promotions.map((p) => ({ kind: "promotion" as const, id: String(p.id), name: p.name })),
      ...flash.map((p) => ({ kind: "flash_sale" as const, id: String(p.id), name: p.name })),
      ...coupons.map((c) => ({ kind: "coupon" as const, id: String(c.id), name: c.code })),
      ...pages.map((p) => ({ kind: "landing_page" as const, id: String(p.id), name: p.title })),
    ]
  }

  /** Sets a linked campaign to run for the festival's sale (a landing page's offer ends with it). */
  async matchDates(id: bigint, kind: LinkKind, itemId: bigint) {
    const r = await this.row(id)
    if (!r[LINK_FIELD[kind]].some((x) => x === itemId)) throw new NotFoundError("Linked campaign", String(itemId))
    if (!this.can(EDIT_PERMISSION[kind])) throw new ForbiddenError("You can't change the dates of this campaign")
    const from = dhakaStart(toDay(r.saleFrom))
    const to = dhakaEnd(toDay(r.saleTo))
    const where = { id: itemId, storeId: this.storeId }
    if (kind === "promotion") await prisma.promotion.updateMany({ where, data: { startsAt: from, endsAt: to } })
    else if (kind === "flash_sale") await prisma.flashSale.updateMany({ where, data: { startsAt: from, endsAt: to } })
    else if (kind === "coupon") await prisma.coupon.updateMany({ where, data: { startsAt: from, expiresAt: to } })
    else await prisma.landingPage.updateMany({ where, data: { offerEndsAt: to } })
    return this.get(id)
  }

  // ---------------------------------------------------------------- reminders

  /**
   * Emails every store's team about festivals whose reminder day has come (once each). Marks
   * the festival reminded even if no one could be emailed, so it doesn't retry every hour.
   */
  static async sendDueReminders(now = new Date()) {
    const today = dhakaToday(now)
    const rows = await prisma.festival.findMany({
      where: { remindedAt: null, saleTo: { gte: fromDay(today) }, saleFrom: { lte: fromDay(addDays(today, 120)) } },
    })
    let sent = 0
    for (const r of rows) {
      const f = { saleFrom: toDay(r.saleFrom), saleTo: toDay(r.saleTo), remindDays: r.remindDays, remindedAt: r.remindedAt }
      if (!reminderDue(f, today)) continue
      // Claim it first, so two workers never send the same reminder.
      const claimed = await prisma.festival.updateMany({ where: { id: r.id, remindedAt: null }, data: { remindedAt: now } })
      if (!claimed.count) continue
      try {
        const startsOn = toDay(r.startsOn)
        const last = lastYearWindow({ key: r.key, startsOn, saleFrom: f.saleFrom, saleTo: f.saleTo })
        const ly = await FestivalsService.salesBetween(r.storeId, last.from, last.to)
        const todo = (r.checklist as unknown as Task[]).filter((t) => !t.done).map((t) => `- ${t.text}`)
        const urls = await storeUrls(r.storeId)
        const id = await new EmailService(r.storeId).festivalReminder({
          "festival.name": r.name,
          "festival.dates": dayRange(startsOn, toDay(r.endsOn)) + (r.dateIsEstimate ? " (expected; check when announced)" : ""),
          "festival.sale_dates": dayRange(f.saleFrom, f.saleTo),
          "festival.days_left": String(Math.max(0, daysBetween(today, f.saleFrom))),
          "festival.last_year": ly.orders
            ? `The same weeks last year brought ${ly.orders} orders, ${taka(ly.sales)}.`
            : "There were no orders in the same weeks last year.",
          "festival.todo": todo.length ? todo.join("\n") : "Everything on the checklist is done.",
          "festival.admin_url": `${urls.admin}/marketing/festivals/${r.id}`,
        })
        if (id) sent++
      } catch (err) {
        logger.warn({ err: (err as Error).message, festivalId: String(r.id) }, "Festival reminder failed")
      }
    }
    return { checked: rows.length, sent }
  }
}
