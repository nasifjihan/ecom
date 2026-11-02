/**
 * ORDER CHECKS — before a cash-on-delivery order goes out:
 * - fraud check: the phone number's delivery record across every shop on the platform (counts
 *   only; other shops' orders and names are never shown), saved on the order when it's placed;
 * - COD block list: numbers that must pay online;
 * - confirmation calls: the outcome of each call, with no-answer orders coming back to the list.
 */
import { prisma, logger } from "../../config"
import { BadRequestError, NotFoundError, type RequestContext } from "../../core"
import { bdMobile } from "../sms/sms.rules"
import { OrdersService } from "./orders.service"
import {
  DEFAULT_ORDER_CHECKS,
  afterCall,
  deliveryOutcome,
  deliveryRate,
  riskLevel,
  type CallOutcome,
  type OrderCheckSettings,
} from "./order-checks.rules"

export const COD_BLOCKED_MESSAGE = "Cash on delivery isn't available for this number. Please pay online."

export async function orderCheckSettings(storeId: bigint): Promise<OrderCheckSettings> {
  const row = await prisma.orderCheckSettings.findUnique({ where: { storeId } })
  if (!row) return DEFAULT_ORDER_CHECKS
  const { id: _id, storeId: _s, updatedAt: _u, exchangeFee, ...rest } = row
  return { ...rest, exchangeFee: Number(exchangeFee) }
}

/** Past orders to this number that went out, everywhere and at this shop (not counting `exceptOrderId`). */
export async function deliveryRecord(storeId: bigint, phone: string, exceptOrderId?: bigint) {
  const rows = await prisma.order.groupBy({
    by: ["storeId", "status", "fulfillmentStatus"],
    where: { phoneKey: phone, ...(exceptOrderId ? { id: { not: exceptOrderId } } : {}) },
    _count: { _all: true },
  })
  const all = { delivered: 0, returned: 0 }
  const here = { delivered: 0, returned: 0 }
  for (const r of rows) {
    const out = deliveryOutcome(r)
    if (!out) continue
    all[out] += r._count._all
    if (r.storeId === storeId) here[out] += r._count._all
  }
  return { all, here }
}

export async function isCodBlocked(storeId: bigint, phone: string | null | undefined) {
  const p = bdMobile(phone)
  return !!p && (await prisma.codBlock.count({ where: { storeId, phone: p } })) > 0
}

/**
 * Saves the phone's delivery record on a new order; a high-risk COD order goes on hold when the
 * shop asked for that. Never fails the order.
 */
export async function recordOrderRisk(storeId: bigint, orderId: bigint) {
  try {
    const o = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, select: { phoneKey: true, status: true, paymentGatewayCode: true } })
    if (!o.phoneKey) return
    const [s, rec] = await Promise.all([orderCheckSettings(storeId), deliveryRecord(storeId, o.phoneKey, orderId)])
    const level = riskLevel(rec.all, s)
    await prisma.order.update({ where: { id: orderId }, data: { riskLevel: level, riskDelivered: rec.all.delivered, riskReturned: rec.all.returned } })
    if (level === "high" && s.holdHighRisk && o.paymentGatewayCode === "cod" && o.status === "PENDING") {
      await new OrdersService({ storeId, requestId: "risk", locale: "en", currency: "BDT" } as RequestContext).transitionStatus(orderId, {
        newStatus: "ON_HOLD",
        note: `On hold: high risk (${rec.all.delivered} delivered, ${rec.all.returned} returned before)`,
        notifyCustomer: false,
        sendEmail: false,
      })
    }
  } catch (err) {
    logger.warn({ err, orderId: String(orderId) }, "Order risk not recorded")
  }
}

export class OrderChecks {
  constructor(private readonly ctx: RequestContext) {}

  private get storeId(): bigint {
    if (this.ctx.storeId === undefined) throw new BadRequestError("No store for this request", "STORE_REQUIRED")
    return BigInt(this.ctx.storeId)
  }
  private get adminId(): bigint | null {
    return this.ctx.admin?.id ? BigInt(this.ctx.admin.id) : null
  }

  private async order(id: bigint) {
    const o = await prisma.order.findFirst({ where: { id, storeId: this.storeId } })
    if (!o) throw new NotFoundError("Order", String(id))
    return o
  }

  /** The order page's panel: the record now, the one saved when it was placed, the calls and the block. */
  async forOrder(id: bigint) {
    const o = await this.order(id)
    const [s, rec, calls, block] = await Promise.all([
      orderCheckSettings(this.storeId),
      o.phoneKey ? deliveryRecord(this.storeId, o.phoneKey, o.id) : null,
      prisma.orderCall.findMany({ where: { orderId: o.id }, orderBy: { createdAt: "desc" }, take: 20 }),
      o.phoneKey ? prisma.codBlock.findUnique({ where: { storeId_phone: { storeId: this.storeId, phone: o.phoneKey } } }) : null,
    ])
    return {
      phone: o.phoneKey,
      now: rec ? { ...rec, level: riskLevel(rec.all, s), rate: deliveryRate(rec.all) } : null,
      atOrder: o.riskLevel ? { level: o.riskLevel, delivered: o.riskDelivered, returned: o.riskReturned } : null,
      call: { status: o.callStatus, attempts: o.callAttempts, nextCallAt: o.nextCallAt },
      calls: calls.map((c) => ({ id: String(c.id), outcome: c.outcome, note: c.note, createdAt: c.createdAt })),
      blocked: block ? { id: String(block.id), reason: block.reason, createdAt: block.createdAt } : null,
    }
  }

  /** Orders to call. due: never called, or no answer and it's time; later: waiting to try again; stuck: tries ran out or a wrong number. */
  async callList(tab: "due" | "later" | "stuck", page: number, perPage: number, now = new Date()) {
    const base = { storeId: this.storeId, paymentGatewayCode: "cod", status: { in: ["PENDING" as const, "ON_HOLD" as const] } }
    const tabs = {
      due: { OR: [{ callStatus: null }, { callStatus: "no_answer", nextCallAt: { lte: now } }] },
      later: { callStatus: "no_answer", nextCallAt: { gt: now } },
      stuck: { OR: [{ callStatus: "no_answer", nextCallAt: null }, { callStatus: "wrong_number" }] },
    }
    const where = { ...base, ...tabs[tab] }
    const [rows, total, ...counts] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: [{ nextCallAt: "asc" }, { createdAt: "asc" }],
        skip: (page - 1) * perPage,
        take: perPage,
        select: {
          id: true, number: true, createdAt: true, status: true, grandTotal: true, billingFirstName: true, billingLastName: true,
          shippingPhone: true, billingPhone: true, shippingCity: true, billingCity: true, riskLevel: true, riskDelivered: true,
          riskReturned: true, callStatus: true, callAttempts: true, nextCallAt: true, _count: { select: { items: true } },
        },
      }),
      prisma.order.count({ where }),
      ...(["due", "later", "stuck"] as const).map((k) => prisma.order.count({ where: { ...base, ...tabs[k] } })),
    ])
    return {
      items: rows.map((o) => ({
        id: String(o.id), number: o.number, createdAt: o.createdAt, status: o.status, total: Number(o.grandTotal),
        name: `${o.billingFirstName} ${o.billingLastName}`.trim(), phone: o.shippingPhone || o.billingPhone, city: o.shippingCity || o.billingCity,
        risk: o.riskLevel ? { level: o.riskLevel, delivered: o.riskDelivered, returned: o.riskReturned } : null,
        callStatus: o.callStatus, callAttempts: o.callAttempts, nextCallAt: o.nextCallAt, items: o._count.items,
      })),
      counts: { due: counts[0], later: counts[1], stuck: counts[2] },
      meta: { page, perPage, total, totalPages: Math.max(1, Math.ceil(total / perPage)) },
    }
  }

  /** Records a call. Confirmed moves the order on, fake or cancelled cancels it (fake can also block the number). */
  async logCall(id: bigint, dto: { outcome: CallOutcome; note?: string; block?: boolean }, now = new Date()) {
    const o = await this.order(id)
    if (!["PENDING", "ON_HOLD"].includes(o.status)) throw new BadRequestError("This order is already confirmed or closed", "ORDER_STATUS_INVALID_TRANSITION")
    const s = await orderCheckSettings(this.storeId)
    const next = afterCall(dto.outcome, o.callAttempts, s, now)
    await prisma.$transaction([
      prisma.orderCall.create({ data: { storeId: this.storeId, orderId: o.id, outcome: dto.outcome, note: dto.note || null, adminId: this.adminId } }),
      prisma.order.update({ where: { id: o.id }, data: { callStatus: dto.outcome, callAttempts: next.tries, nextCallAt: next.nextCallAt } }),
    ])
    const label = { confirmed: "confirmed", no_answer: "no answer", wrong_number: "wrong number", fake: "fake order", cancelled: "the customer cancelled" }[dto.outcome]
    if (next.status) {
      await new OrdersService(this.ctx).transitionStatus(o.id, {
        newStatus: next.status,
        note: `Call: ${label}${dto.note ? `. ${dto.note}` : ""}`,
        notifyCustomer: next.status === "PROCESSING",
        sendEmail: next.status === "PROCESSING",
      })
    }
    if (dto.outcome === "fake" && dto.block && o.phoneKey) await this.block(o.phoneKey, `Fake order ${o.number}`)
    return this.forOrder(o.id)
  }

  async blocks(search: string | undefined, page: number, perPage: number) {
    const where = { storeId: this.storeId, ...(search?.trim() ? { phone: { contains: search.replace(/\D/g, "") } } : {}) }
    const [rows, total] = await Promise.all([
      prisma.codBlock.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * perPage, take: perPage }),
      prisma.codBlock.count({ where }),
    ])
    return {
      items: rows.map((b) => ({ id: String(b.id), phone: b.phone, reason: b.reason, createdAt: b.createdAt })),
      meta: { page, perPage, total, totalPages: Math.max(1, Math.ceil(total / perPage)) },
    }
  }

  async block(raw: string, reason: string) {
    const phone = bdMobile(raw)
    if (!phone) throw new BadRequestError("Enter a mobile number like 01712345678", "VALIDATION_FAILED")
    const data = { reason: reason.trim() || "Blocked by staff", adminId: this.adminId }
    const b = await prisma.codBlock.upsert({ where: { storeId_phone: { storeId: this.storeId, phone } }, create: { storeId: this.storeId, phone, ...data }, update: data })
    return { id: String(b.id), phone: b.phone, reason: b.reason, createdAt: b.createdAt }
  }

  async unblock(id: bigint) {
    const { count } = await prisma.codBlock.deleteMany({ where: { id, storeId: this.storeId } })
    if (!count) throw new NotFoundError("Blocked number", String(id))
  }
}

/** "Check a number" (before taking a phone order): its record and whether it's blocked. */
export async function phoneCheck(storeId: bigint, raw: string) {
  const phone = bdMobile(raw)
  if (!phone) throw new BadRequestError("Enter a mobile number like 01712345678", "VALIDATION_FAILED")
  const [s, rec, blocked] = await Promise.all([orderCheckSettings(storeId), deliveryRecord(storeId, phone), isCodBlocked(storeId, phone)])
  return { phone, ...rec, level: riskLevel(rec.all, s), rate: deliveryRate(rec.all), blocked }
}
