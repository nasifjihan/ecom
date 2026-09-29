/**
 * SALES TEAM — commission settings, salespeople, monthly targets, commission lists and payouts,
 * and "my commission" for each salesperson. See commission.rules.ts for how commission works.
 */
import type { Prisma } from "@prisma/client"
import { randomBytes } from "node:crypto"
import { prisma } from "../../config"
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError, type RequestContext } from "../../core"
import { creditOrder, salesSettings } from "./commission.ledger"
import { SALES_CODE, commissionState, monthOf, monthRange, targetProgress, type CommissionState } from "./commission.rules"

const n = (v: Prisma.Decimal | number | null | undefined) => (v === null || v === undefined ? 0 : Number(v))
const round2 = (x: number) => Math.round(x * 100) / 100

const ROW_INCLUDE = {
  salesperson: { select: { id: true, name: true } },
  order: {
    select: {
      id: true,
      number: true,
      status: true,
      paymentStatus: true,
      completedAt: true,
      paidAt: true,
      createdAt: true,
      itemsSubtotal: true,
      discountTotal: true,
      refundedTotal: true,
      grandTotal: true,
      billingFirstName: true,
      billingLastName: true,
    },
  },
} as const satisfies Prisma.SalesCommissionInclude
type Row = Prisma.SalesCommissionGetPayload<{ include: typeof ROW_INCLUDE }>

function view(r: Row) {
  const s = commissionState(
    {
      status: r.order.status,
      paymentStatus: r.order.paymentStatus,
      deliveredAt: r.order.completedAt,
      paidAt: r.order.paidAt,
      itemsSubtotal: n(r.order.itemsSubtotal),
      discountTotal: n(r.order.discountTotal),
      refundedTotal: n(r.order.refundedTotal),
    },
    { base: n(r.base), amount: n(r.amount), paidOutAt: r.paidOutAt },
  )
  return {
    id: String(r.id),
    orderId: String(r.order.id),
    orderNumber: r.order.number,
    orderStatus: r.order.status,
    paymentStatus: r.order.paymentStatus,
    customer: `${r.order.billingFirstName} ${r.order.billingLastName}`.trim(),
    orderedAt: r.order.createdAt.toISOString(),
    salesperson: { id: String(r.salesperson.id), name: r.salesperson.name },
    state: s.state,
    base: s.base,
    amount: s.amount,
    earnedAt: s.earnedAt?.toISOString() ?? null,
    earnedMonth: s.earnedAt ? monthOf(s.earnedAt) : null,
    paidOutAt: r.paidOutAt?.toISOString() ?? null,
    lines: r.lines as unknown as { name: string; base: number; rate: number; source: string; amount: number }[],
  }
}
type View = ReturnType<typeof view>

/** One salesperson's month: sales (items after discounts, earned), commission by state, target. */
function summarise(rows: View[], month: string, target: number | null) {
  const inMonth = rows.filter((r) => (r.state === "EARNED" || r.state === "PAID") && r.earnedMonth === month)
  const sales = round2(inMonth.reduce((s, r) => s + r.base, 0))
  return {
    sales,
    earned: round2(inMonth.reduce((s, r) => s + r.amount, 0)),
    orders: inMonth.length,
    pending: round2(rows.filter((r) => r.state === "PENDING").reduce((s, r) => s + r.amount, 0)),
    pendingOrders: rows.filter((r) => r.state === "PENDING").length,
    /** Earned in any month and not paid out yet. */
    unpaid: round2(rows.filter((r) => r.state === "EARNED").reduce((s, r) => s + r.amount, 0)),
    target,
    progress: targetProgress(sales, target),
  }
}

export class SalesService {
  constructor(private readonly ctx: RequestContext) {}

  private get storeId(): bigint {
    if (this.ctx.storeId === undefined) throw new BadRequestError("No store for this request", "STORE_REQUIRED")
    return this.ctx.storeId
  }

  private get adminId(): bigint | null {
    return this.ctx.super || !this.ctx.admin ? null : BigInt(this.ctx.admin.id)
  }

  // ================================================================ settings

  async settings() {
    return salesSettings(prisma, this.storeId)
  }

  async updateSettings(dto: { enabled?: boolean; defaultRate?: number }) {
    const data = {
      ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
      ...(dto.defaultRate !== undefined ? { defaultRate: dto.defaultRate } : {}),
    }
    await prisma.salesSettings.upsert({ where: { storeId: this.storeId }, create: { storeId: this.storeId, ...data }, update: data })
    return this.settings()
  }

  // ================================================================ rows

  /**
   * Commission rows that can matter for `month`: not paid out yet, or delivered / paid / paid out
   * from the month's start on (their earned date is the later of delivery and payment).
   */
  private async rows(where: Prisma.SalesCommissionWhereInput, month: string) {
    const { start } = monthRange(month)
    const rows = await prisma.salesCommission.findMany({
      where: {
        storeId: this.storeId,
        ...where,
        OR: [{ paidOutAt: null }, { paidOutAt: { gte: start } }, { order: { completedAt: { gte: start } } }, { order: { paidAt: { gte: start } } }],
      },
      include: ROW_INCLUDE,
      orderBy: { id: "desc" },
    })
    return rows.map(view)
  }

  // ================================================================ team

  async team(month: string) {
    const [people, staff, rows, targets, settings] = await Promise.all([
      prisma.adminUser.findMany({
        where: { storeId: this.storeId, isSalesperson: true },
        select: { id: true, name: true, email: true, status: true, commissionExtraPct: true, salesCode: true },
        orderBy: { name: "asc" },
      }),
      prisma.adminUser.findMany({
        where: { storeId: this.storeId, isSalesperson: false, status: "active" },
        select: { id: true, name: true, email: true },
        orderBy: { name: "asc" },
      }),
      this.rows({}, month),
      prisma.salesTarget.findMany({ where: { storeId: this.storeId, month } }),
      this.settings(),
    ])
    const targetOf = new Map(targets.map((t) => [t.salespersonId, n(t.amount)]))
    const team = people.map((p) => ({
      id: String(p.id),
      name: p.name,
      email: p.email,
      active: p.status === "active",
      extraPct: n(p.commissionExtraPct),
      salesCode: p.salesCode,
      ...summarise(
        rows.filter((r) => r.salesperson.id === String(p.id)),
        month,
        targetOf.get(p.id) ?? null,
      ),
    }))
    const all = summarise(rows, month, null)
    return {
      month,
      settings,
      team,
      totals: { sales: all.sales, earned: all.earned, pending: all.pending, unpaid: all.unpaid },
      otherStaff: staff.map((s) => ({ id: String(s.id), name: s.name, email: s.email })),
    }
  }

  async commissions(q: { month: string; salespersonId?: bigint; state?: CommissionState }) {
    const rows = await this.rows(q.salespersonId ? { salespersonId: q.salespersonId } : {}, q.month)
    // Pending: all of them; earned and paid out: those earned in the month; cancelled: ordered in the month, when asked for.
    return rows.filter((r) => {
      if (q.state && r.state !== q.state) return false
      if (r.state === "PENDING") return true
      if (r.state === "CANCELLED") return q.state === "CANCELLED" && monthOf(new Date(r.orderedAt)) === q.month
      return r.earnedMonth === q.month
    })
  }

  private async staffMember(id: bigint) {
    const row = await prisma.adminUser.findFirst({ where: { id, storeId: this.storeId }, select: { id: true, name: true, isSalesperson: true } })
    if (!row) throw new NotFoundError("Staff member", String(id))
    return row
  }

  /** Put someone on (or take them off) the sales team; their extra % and share-link code. */
  async updateSalesperson(id: bigint, dto: { isSalesperson?: boolean; extraPct?: number; salesCode?: string | null }) {
    const person = await this.staffMember(id)
    const joining = dto.isSalesperson === true && !person.isSalesperson
    let code = dto.salesCode === undefined ? undefined : dto.salesCode ? dto.salesCode.trim().toUpperCase() : null
    if (code && !SALES_CODE.test(code)) throw new BadRequestError("Use 3–20 letters and numbers for the code", "VALIDATION_FAILED")
    if (joining && code === undefined) {
      const existing = await prisma.adminUser.findUnique({ where: { id }, select: { salesCode: true } })
      if (!existing?.salesCode) code = `S${randomBytes(3).toString("hex").toUpperCase()}`
    }
    try {
      await prisma.adminUser.update({
        where: { id },
        data: {
          ...(dto.isSalesperson !== undefined ? { isSalesperson: dto.isSalesperson } : {}),
          ...(dto.extraPct !== undefined ? { commissionExtraPct: dto.extraPct } : {}),
          ...(code !== undefined ? { salesCode: code } : {}),
        },
      })
    } catch (e) {
      if ((e as { code?: string }).code === "P2002") throw new ConflictError("Another salesperson uses that code")
      throw e
    }
    return { id: String(id) }
  }

  async setTarget(salespersonId: bigint, month: string, amount: number | null) {
    const person = await this.staffMember(salespersonId)
    if (!person.isSalesperson) throw new BadRequestError("Add them to the sales team first", "VALIDATION_FAILED")
    if (amount === null || amount <= 0) {
      await prisma.salesTarget.deleteMany({ where: { salespersonId, month } })
      return null
    }
    await prisma.salesTarget.upsert({
      where: { salespersonId_month: { salespersonId, month } },
      create: { storeId: this.storeId, salespersonId, month, amount },
      update: { amount },
    })
    return { month, amount }
  }

  /** Marks everything a salesperson earned up to the end of `month` (and not paid yet) as paid out. */
  async payout(salespersonId: bigint, month: string) {
    await this.staffMember(salespersonId)
    const { end } = monthRange(month)
    const rows = await prisma.salesCommission.findMany({
      where: { storeId: this.storeId, salespersonId, paidOutAt: null },
      include: ROW_INCLUDE,
    })
    const due = rows.map((r) => ({ r, v: view(r) })).filter(({ v }) => v.state === "EARNED" && v.earnedAt && new Date(v.earnedAt) < end)
    if (!due.length) throw new BadRequestError("Nothing earned to pay out", "VALIDATION_FAILED")
    await prisma.salesCommission.updateMany({
      where: { id: { in: due.map(({ r }) => r.id) }, paidOutAt: null },
      data: { paidOutAt: new Date(), paidOutById: this.adminId },
    })
    return { orders: due.length, amount: round2(due.reduce((s, { v }) => s + v.amount, 0)) }
  }

  // ================================================================ orders

  /** Who an order is credited to, and the commission on it. */
  async orderCommission(orderId: bigint) {
    const order = await prisma.order.findFirst({
      where: { id: orderId, storeId: this.storeId },
      select: { salesperson: { select: { id: true, name: true } } },
    })
    if (!order) throw new NotFoundError("Order", String(orderId))
    const row = await prisma.salesCommission.findUnique({ where: { orderId }, include: ROW_INCLUDE })
    return {
      salesperson: order.salesperson ? { id: String(order.salesperson.id), name: order.salesperson.name } : null,
      commission: row ? view(row) : null,
    }
  }

  async reassign(orderId: bigint, salespersonId: bigint | null) {
    await creditOrder(prisma, this.storeId, orderId, salespersonId)
    return this.orderCommission(orderId)
  }

  /** Staff who can be picked as an order's salesperson. */
  async salespeople() {
    const rows = await prisma.adminUser.findMany({
      where: { storeId: this.storeId, isSalesperson: true, status: "active" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    })
    return rows.map((r) => ({ id: String(r.id), name: r.name }))
  }

  // ================================================================ me

  async mine(month: string) {
    const id = this.adminId
    if (!id) throw new ForbiddenError("Only staff accounts have commission", "INSUFFICIENT_PERMISSION")
    const me = await prisma.adminUser.findFirst({
      where: { id, storeId: this.storeId },
      select: { isSalesperson: true, salesCode: true, commissionExtraPct: true },
    })
    if (!me?.isSalesperson) return { isSalesperson: false as const }
    const [rows, target, settings] = await Promise.all([
      this.rows({ salespersonId: id }, month),
      prisma.salesTarget.findUnique({ where: { salespersonId_month: { salespersonId: id, month } } }),
      this.settings(),
    ])
    return {
      isSalesperson: true as const,
      month,
      enabled: settings.enabled,
      salesCode: me.salesCode,
      extraPct: n(me.commissionExtraPct),
      ...summarise(rows, month, target ? n(target.amount) : null),
      rows: rows.filter((r) => r.state === "PENDING" || r.earnedMonth === month),
    }
  }
}

