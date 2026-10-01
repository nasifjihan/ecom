/**
 * DELIVERY SLOTS — the store's delivery windows (Shipping → Delivery slots), the days customers can
 * book, and the check made when an order is placed. Methods with `useSlots` ask for one.
 */
import type { DeliverySlot, Prisma } from "@prisma/client"
import { prisma } from "../../config"
import { BadRequestError, ConflictError, NotFoundError } from "../../core"
import { addDays, isDay, localNow, pickSlot, slotDays, slotLabel, slotTimesProblem, type SlotDay, type SlotRow } from "./slots.rules"

export interface SlotInput {
  name: string
  startTime: string
  endTime: string
  cutoffMinutes: number
  fee: number
  capacity: number | null
  weekdays: number[]
  enabled: boolean
  sortOrder?: number
}

/** Orders that no longer need their slot. */
const RELEASED = ["CANCELLED", "FAILED"] as const

const row = (s: DeliverySlot): SlotRow => ({
  id: String(s.id),
  name: s.name,
  startTime: s.startTime,
  endTime: s.endTime,
  cutoffMinutes: s.cutoffMinutes,
  fee: Number(s.fee),
  capacity: s.capacity,
  weekdays: s.weekdays,
})

const dayDate = (day: string) => new Date(`${day}T00:00:00Z`)

export class DeliverySlotService {
  constructor(private readonly storeId: bigint) {}

  private async settings() {
    const g = await prisma.storeGeneralSetting.findUnique({
      where: { storeId: this.storeId },
      select: { timezone: true, slotDaysAhead: true, slotClosedDates: true },
    })
    return { timeZone: g?.timezone ?? "Asia/Dhaka", daysAhead: g?.slotDaysAhead ?? 3, closedDates: g?.slotClosedDates ?? [] }
  }

  // ------------------------------------------------------------ admin

  async list() {
    const [slots, s] = await Promise.all([
      prisma.deliverySlot.findMany({ where: { storeId: this.storeId }, orderBy: [{ sortOrder: "asc" }, { startTime: "asc" }] }),
      this.settings(),
    ])
    const { day: today } = localNow(new Date(), s.timeZone)
    // Booked from today on, per slot and day.
    const booked = await prisma.order.groupBy({
      by: ["deliverySlotId", "deliveryDate"],
      where: { storeId: this.storeId, deliverySlotId: { not: null }, deliveryDate: { gte: dayDate(today) }, status: { notIn: [...RELEASED] } },
      _count: { _all: true },
    })
    return {
      settings: { daysAhead: s.daysAhead, closedDates: s.closedDates, timeZone: s.timeZone },
      slots: slots.map((x) => ({
        ...row(x),
        enabled: x.enabled,
        sortOrder: x.sortOrder,
        upcoming: booked
          .filter((b) => b.deliverySlotId === x.id && b.deliveryDate)
          .map((b) => ({ date: b.deliveryDate!.toISOString().slice(0, 10), orders: b._count._all }))
          .sort((a, b) => a.date.localeCompare(b.date)),
      })),
    }
  }

  private check(d: SlotInput) {
    const problem = slotTimesProblem(d.startTime, d.endTime, d.cutoffMinutes)
    if (problem) throw new BadRequestError(problem, "VALIDATION_FAILED")
    if (!d.weekdays.length) throw new BadRequestError("Pick at least one day of the week", "VALIDATION_FAILED")
  }

  private data(d: SlotInput) {
    return {
      name: d.name.trim(),
      startTime: d.startTime,
      endTime: d.endTime,
      cutoffMinutes: d.cutoffMinutes,
      fee: d.fee,
      capacity: d.capacity,
      weekdays: [...new Set(d.weekdays)].sort(),
      enabled: d.enabled,
      sortOrder: d.sortOrder ?? 0,
    }
  }

  async create(d: SlotInput) {
    this.check(d)
    const s = await prisma.deliverySlot.create({ data: { storeId: this.storeId, ...this.data(d) } })
    return row(s)
  }

  private async own(id: bigint) {
    const s = await prisma.deliverySlot.findFirst({ where: { id, storeId: this.storeId } })
    if (!s) throw new NotFoundError("Delivery slot")
    return s
  }

  async update(id: bigint, d: SlotInput) {
    await this.own(id)
    this.check(d)
    return row(await prisma.deliverySlot.update({ where: { id }, data: this.data(d) }))
  }

  /** Orders keep their slot's text; the link is cleared. */
  async remove(id: bigint) {
    await this.own(id)
    await prisma.deliverySlot.delete({ where: { id } })
    return { id: String(id) }
  }

  async saveSettings(d: { daysAhead: number; closedDates: string[] }) {
    const bad = d.closedDates.find((x) => !isDay(x))
    if (bad) throw new BadRequestError(`"${bad}" isn't a date (YYYY-MM-DD)`, "VALIDATION_FAILED")
    const { timeZone } = await this.settings()
    const { day: today } = localNow(new Date(), timeZone)
    // Past closed days are dropped.
    const closedDates = [...new Set(d.closedDates)].filter((x) => x >= today).sort()
    const store = await prisma.store.findUniqueOrThrow({ where: { id: this.storeId } })
    await prisma.storeGeneralSetting.upsert({
      where: { storeId: this.storeId },
      update: { slotDaysAhead: d.daysAhead, slotClosedDates: closedDates },
      create: { storeId: this.storeId, emailFrom: `no-reply@${store.slug}.local`, emailFromName: store.name, slotDaysAhead: d.daysAhead, slotClosedDates: closedDates },
    })
    return (await this.list()).settings
  }

  // ------------------------------------------------------------ checkout

  /** The days and slots customers can pick from now. */
  async days(now = new Date(), db: Prisma.TransactionClient = prisma): Promise<SlotDay[]> {
    const [slots, s] = await Promise.all([
      db.deliverySlot.findMany({ where: { storeId: this.storeId, enabled: true } }),
      this.settings(),
    ])
    if (!slots.length) return []
    const { day: today } = localNow(now, s.timeZone)
    const booked = await db.order.groupBy({
      by: ["deliverySlotId", "deliveryDate"],
      where: {
        storeId: this.storeId,
        deliverySlotId: { in: slots.map((x) => x.id) },
        deliveryDate: { gte: dayDate(today), lte: dayDate(addDays(today, 31)) },
        status: { notIn: [...RELEASED] },
      },
      _count: { _all: true },
    })
    const taken = new Map(booked.map((b) => [`${String(b.deliverySlotId)}|${b.deliveryDate!.toISOString().slice(0, 10)}`, b._count._all]))
    return slotDays({ slots: slots.map(row), now, timeZone: s.timeZone, daysAhead: s.daysAhead, closedDates: s.closedDates, taken })
  }

  /** The picked slot with its fee and label, or a 400 saying why it can't be booked. */
  async pick(slotId: string, date: string, db: Prisma.TransactionClient = prisma) {
    if (!isDay(date)) throw new BadRequestError("Pick a delivery day", "VALIDATION_FAILED")
    const r = pickSlot(await this.days(new Date(), db), slotId, date)
    if ("problem" in r) throw new ConflictError(r.problem, "SLOT_UNAVAILABLE")
    return { id: BigInt(r.slot.id), date, fee: r.slot.fee, label: slotLabel(date, r.slot) }
  }

  /**
   * Inside the order's transaction: takes turns with other orders for the same slot and day, then
   * checks it again, so two customers can't take its last place.
   */
  async hold(t: Prisma.TransactionClient, slotId: bigint, date: string) {
    await t.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`slot:${String(slotId)}:${date}`}))`
    return this.pick(String(slotId), date, t)
  }
}

export { dayDate as slotDayDate }
