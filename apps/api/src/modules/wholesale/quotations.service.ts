/**
 * QUOTATIONS — price offers to one customer.
 *   Staff: draft a quote (lines priced at what the customer would pay, then changed as agreed),
 *   send it (the customer gets an email), cancel it, and turn it into an order from the New order
 *   page (ManualOrderService with `quotationId`, which uses the agreed prices).
 *   Customers: business accounts ask for a quote from their cart; anyone with a sent quote can
 *   accept or decline it in their account (staff get an email either way).
 * See quotation.rules.ts for the statuses.
 */
import type { Prisma } from "@prisma/client"
import { prisma } from "../../config"
import { BadRequestError, ForbiddenError, NotFoundError, type RequestContext } from "../../core"
import { StorefrontService } from "../storefront/storefront.service"
import { assertStaffStorefront, defaultStorefrontId, staffStorefronts } from "../storefronts/storefronts.context"
import { manualDiscountCap } from "../orders/manual-order"
import { EmailService, inBackground } from "../notifications"
import { isBusinessBuyer } from "./wholesale.context"
import {
  canCancel,
  canEdit,
  canRespond,
  canSend,
  endOfDay,
  nextQuoteNumber,
  orderBlocker,
  quoteTotals,
  viewStatus,
  type QuoteView,
} from "./quotation.rules"

export interface QuoteLineInput {
  productId: bigint
  variantId?: bigint | null
  qty: number
}

export interface SaveQuoteInput {
  customerId: bigint
  storefrontId?: bigint | null
  validUntil?: string | null
  terms?: string | null
  staffNote?: string | null
  discount: number
  deliveryFee: number
  items: (QuoteLineInput & { unitPrice: number })[]
}

const INCLUDE = {
  items: { orderBy: { sortOrder: "asc" } },
  customer: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      businessAccount: { select: { companyName: true, status: true } },
    },
  },
} as const satisfies Prisma.QuotationInclude
type Row = Prisma.QuotationGetPayload<{ include: typeof INCLUDE }>

const n = (v: Prisma.Decimal | number) => Number(v)
/** YYYY-MM-DD in Dhaka. */
const day = (d: Date | null) => (d ? new Date(d.getTime() + 6 * 3600_000).toISOString().slice(0, 10) : null)
const lineKey = (productId: bigint, variantId: bigint | null | undefined) => `${productId}:${variantId ?? ""}`
const optionOf = (values: unknown) =>
  Object.values((values as Record<string, unknown>) ?? {})
    .map(String)
    .join(" / ") || null

export class QuotationsService {
  constructor(private readonly ctx: RequestContext) {}

  private get storeId(): bigint {
    if (this.ctx.storeId === undefined) throw new BadRequestError("No store for this request", "STORE_REQUIRED")
    return this.ctx.storeId
  }

  // ================================================================ views

  private base(q: Row, orderNumber: string | null) {
    const status = viewStatus(q.status, q.validUntil)
    const items = q.items.map((i) => ({
      id: String(i.id),
      productId: i.productId ? String(i.productId) : null,
      variantId: i.variantId ? String(i.variantId) : null,
      name: i.name,
      option: i.option,
      sku: i.sku,
      qty: i.qty,
      unitPrice: n(i.unitPrice),
      listPrice: n(i.listPrice),
      lineTotal: n(i.lineTotal),
    }))
    const totals = quoteTotals(items, n(q.discount), n(q.deliveryFee))
    const base = {
      id: String(q.id),
      number: q.number,
      status,
      validUntil: day(q.validUntil),
      terms: q.terms,
      customerNote: q.customerNote,
      discount: totals.discount,
      deliveryFee: totals.deliveryFee,
      subtotal: totals.subtotal,
      total: totals.total,
      listTotal: totals.listTotal,
      items,
      order: q.orderId ? { id: String(q.orderId), number: orderNumber } : null,
      sentAt: q.sentAt?.toISOString() ?? null,
      respondedAt: q.respondedAt?.toISOString() ?? null,
      createdAt: q.createdAt.toISOString(),
    }
    return { base, totals }
  }

  /** What the customer sees (no staff notes). */
  private customerView(q: Row, orderNumber: string | null) {
    return { ...this.base(q, orderNumber).base, canRespond: canRespond(q.status, q.validUntil) }
  }

  private staffView(q: Row, orderNumber: string | null) {
    const { base, totals } = this.base(q, orderNumber)
    const c = q.customer
    const blocker = orderBlocker(q.status, q.validUntil)
    return {
      ...base,
      storefrontId: q.storefrontId ? String(q.storefrontId) : null,
      staffNote: q.staffNote,
      offPercent: totals.offPercent,
      customer: {
        id: String(c.id),
        name: `${c.firstName} ${c.lastName}`.trim(),
        email: c.email,
        phone: c.phone,
        business: c.businessAccount?.status === "APPROVED" ? c.businessAccount.companyName : null,
      },
      can: { edit: canEdit(q.status), send: canSend(q.status), cancel: canCancel(q.status), order: blocker === null },
      orderBlocker: blocker,
    }
  }

  private async orderNumbers(rows: Row[]) {
    const ids = rows.map((r) => r.orderId).filter((x): x is bigint => x !== null)
    if (!ids.length) return new Map<bigint, string>()
    const orders = await prisma.order.findMany({ where: { id: { in: ids } }, select: { id: true, number: true } })
    return new Map(orders.map((o) => [o.id, o.number]))
  }

  private async one(where: Prisma.QuotationWhereInput) {
    const row = await prisma.quotation.findFirst({ where: { ...where, storeId: this.storeId }, include: INCLUDE })
    if (!row) throw new NotFoundError("Quotation")
    const numbers = await this.orderNumbers([row])
    return { row, orderNumber: row.orderId ? numbers.get(row.orderId) ?? null : null }
  }

  // ================================================================ pricing lines

  /** The storefront a quote is for (staff limited to storefronts: one of theirs). */
  private async storefrontFor(id: bigint | null | undefined): Promise<bigint> {
    const allowed = staffStorefronts(this.ctx)
    const sf = id ?? allowed?.[0] ?? (await defaultStorefrontId(this.storeId))
    assertStaffStorefront(this.ctx, sf)
    if (!(await prisma.storefront.findFirst({ where: { id: sf, storeId: this.storeId }, select: { id: true } }))) {
      throw new NotFoundError("Storefront")
    }
    return sf
  }

  /**
   * Lines with names and what this customer would normally pay (their business and bulk prices
   * included). Products that are gone are refused; low stock only gets a note, since the goods
   * may arrive before the order.
   */
  async priceLines(customerId: bigint, storefrontId: bigint, items: QuoteLineInput[]) {
    const shop = new StorefrontService({ ...this.ctx, storefrontId })
    const quoted = await shop.quoteLines(
      items.map((i) => ({ productId: i.productId, variantId: i.variantId ?? undefined, qty: i.qty })),
      customerId,
    )
    return quoted.map((q) => {
      if (!q.priced) throw new BadRequestError(q.problem?.message ?? "A product is no longer available", "CART_INVALID")
      const p = q.priced
      return {
        productId: p.product.id,
        variantId: p.variant?.id ?? null,
        name: p.product.name,
        option: p.variant ? optionOf(p.variant.attributeValues) : null,
        sku: p.variant?.sku ?? p.product.sku,
        qty: q.line.qty,
        listPrice: p.unitPrice,
        note: q.problem?.message ?? null,
      }
    })
  }

  /** For the editor: names and normal prices of the lines being added. */
  async previewLines(customerId: bigint, storefrontId: bigint | null | undefined, items: QuoteLineInput[]) {
    await this.customer(customerId)
    const sf = await this.storefrontFor(storefrontId)
    const lines = await this.priceLines(customerId, sf, items)
    return lines.map((l) => ({ ...l, productId: String(l.productId), variantId: l.variantId ? String(l.variantId) : null }))
  }

  private async customer(id: bigint) {
    const c = await prisma.customer.findFirst({ where: { id, storeId: this.storeId }, select: { id: true } })
    if (!c) throw new NotFoundError("Customer", String(id))
    return c
  }

  // ================================================================ staff

  async list(q: { status?: QuoteView; search?: string; customerId?: bigint; page: number; perPage: number }) {
    const now = new Date()
    const allowed = staffStorefronts(this.ctx)
    const s = q.search?.trim()
    const statusWhere: Prisma.QuotationWhereInput =
      q.status === "EXPIRED"
        ? { status: "SENT", validUntil: { lt: now } }
        : q.status === "SENT"
          ? { status: "SENT", OR: [{ validUntil: null }, { validUntil: { gte: now } }] }
          : q.status
            ? { status: q.status }
            : {}
    const where: Prisma.QuotationWhereInput = {
      storeId: this.storeId,
      AND: [
        statusWhere,
        allowed ? { storefrontId: { in: allowed } } : {},
        q.customerId ? { customerId: q.customerId } : {},
        s
          ? {
              OR: [
                { number: { contains: s, mode: "insensitive" } },
                { customer: { firstName: { contains: s, mode: "insensitive" } } },
                { customer: { lastName: { contains: s, mode: "insensitive" } } },
                { customer: { email: { contains: s, mode: "insensitive" } } },
                { customer: { phone: { contains: s } } },
                { customer: { businessAccount: { companyName: { contains: s, mode: "insensitive" } } } },
              ],
            }
          : {},
      ],
    }
    const [rows, total, groups, expired] = await Promise.all([
      prisma.quotation.findMany({
        where,
        include: INCLUDE,
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        skip: (q.page - 1) * q.perPage,
        take: q.perPage,
      }),
      prisma.quotation.count({ where }),
      prisma.quotation.groupBy({
        by: ["status"],
        where: { storeId: this.storeId, ...(allowed ? { storefrontId: { in: allowed } } : {}) },
        _count: { _all: true },
      }),
      prisma.quotation.count({
        where: { storeId: this.storeId, status: "SENT", validUntil: { lt: now }, ...(allowed ? { storefrontId: { in: allowed } } : {}) },
      }),
    ])
    const numbers = await this.orderNumbers(rows)
    const counts: Record<string, number> = Object.fromEntries(groups.map((g) => [g.status, g._count._all]))
    if (expired) {
      counts.EXPIRED = expired
      counts.SENT = (counts.SENT ?? 0) - expired
    }
    return {
      rows: rows.map((r) => this.staffView(r, r.orderId ? numbers.get(r.orderId) ?? null : null)),
      total,
      page: q.page,
      perPage: q.perPage,
      counts,
    }
  }

  async get(id: bigint) {
    const { row, orderNumber } = await this.one({ id })
    if (row.storefrontId) assertStaffStorefront(this.ctx, row.storefrontId)
    // For the printed quote's heading.
    const store = await prisma.store.findUnique({ where: { id: this.storeId }, select: { name: true } })
    return { ...this.staffView(row, orderNumber), storeName: store?.name ?? "" }
  }

  private async build(dto: SaveQuoteInput) {
    await this.customer(dto.customerId)
    const storefrontId = await this.storefrontFor(dto.storefrontId)
    const seen = new Set<string>()
    for (const i of dto.items) {
      const k = lineKey(i.productId, i.variantId)
      if (seen.has(k)) throw new BadRequestError("The same product is on the quote twice; change the quantity instead", "VALIDATION_FAILED")
      seen.add(k)
    }
    const priced = await this.priceLines(dto.customerId, storefrontId, dto.items)
    const lines = priced.map((p, idx) => {
      const unitPrice = dto.items[idx]!.unitPrice
      return { ...p, unitPrice, lineTotal: Math.round(unitPrice * p.qty * 100) / 100, sortOrder: idx }
    })
    const totals = quoteTotals(lines, dto.discount, dto.deliveryFee)
    // Lower prices and the discount together may not go past what the staff member's role allows.
    const cap = await manualDiscountCap(this.ctx)
    if (totals.offPercent > cap + 1e-9) {
      throw new ForbiddenError(
        `This quote is ${totals.offPercent}% below the customer's normal prices; your role can give at most ${cap}% off`,
        "DISCOUNT_OVER_LIMIT",
      )
    }
    return {
      storefrontId,
      totals,
      data: {
        customerId: dto.customerId,
        storefrontId,
        validUntil: dto.validUntil ? endOfDay(dto.validUntil) : null,
        terms: dto.terms ?? null,
        staffNote: dto.staffNote ?? null,
        discount: totals.discount,
        deliveryFee: totals.deliveryFee,
        subtotal: totals.subtotal,
        total: totals.total,
      },
      items: lines.map((l) => ({
        productId: l.productId,
        variantId: l.variantId,
        name: l.name,
        option: l.option,
        sku: l.sku,
        qty: l.qty,
        unitPrice: l.unitPrice,
        listPrice: l.listPrice,
        lineTotal: l.lineTotal,
        sortOrder: l.sortOrder,
      })),
    }
  }

  private get adminId(): bigint | null {
    return this.ctx.super || !this.ctx.admin ? null : BigInt(this.ctx.admin.id)
  }

  /** Creates with the next Q- number (retrying if two quotes grab the same one). */
  private async insert(data: Omit<Prisma.QuotationUncheckedCreateInput, "number" | "storeId">) {
    for (let attempt = 0; ; attempt++) {
      const last = await prisma.quotation.findFirst({ where: { storeId: this.storeId }, orderBy: { id: "desc" }, select: { number: true } })
      try {
        return await prisma.quotation.create({ data: { ...data, storeId: this.storeId, number: nextQuoteNumber(last?.number ?? null) } })
      } catch (e) {
        if (attempt < 4 && (e as { code?: string }).code === "P2002") continue
        throw e
      }
    }
  }

  async create(dto: SaveQuoteInput) {
    const b = await this.build(dto)
    const q = await this.insert({ ...b.data, status: "DRAFT", createdById: this.adminId, items: { create: b.items } })
    return this.get(q.id)
  }

  async update(id: bigint, dto: SaveQuoteInput) {
    const { row } = await this.one({ id })
    if (row.storefrontId) assertStaffStorefront(this.ctx, row.storefrontId)
    if (!canEdit(row.status)) throw new BadRequestError(`A quote that is ${row.status.toLowerCase()} can't be changed`, "ORDER_STATUS_INVALID_TRANSITION")
    const b = await this.build(dto)
    await prisma.$transaction([
      prisma.quotationItem.deleteMany({ where: { quotationId: id } }),
      prisma.quotation.update({
        where: { id },
        // A changed quote goes back to draft and must be sent again (a request stays a request).
        data: { ...b.data, status: row.status === "REQUESTED" ? "REQUESTED" : "DRAFT", items: { create: b.items } },
      }),
    ])
    return this.get(id)
  }

  /** Sends it to the customer (valid for 14 days unless a date was set). */
  async send(id: bigint) {
    const { row } = await this.one({ id })
    if (row.storefrontId) assertStaffStorefront(this.ctx, row.storefrontId)
    if (!canSend(row.status)) throw new BadRequestError(`A quote that is ${row.status.toLowerCase()} can't be sent`, "ORDER_STATUS_INVALID_TRANSITION")
    if (!row.items.length) throw new BadRequestError("Add at least one product first", "VALIDATION_FAILED")
    const validUntil =
      row.validUntil && row.validUntil.getTime() > Date.now() ? row.validUntil : endOfDay(day(new Date(Date.now() + 14 * 86_400_000))!)
    await prisma.quotation.update({ where: { id }, data: { status: "SENT", sentAt: new Date(), validUntil, respondedAt: null } })
    const email = new EmailService(this.storeId)
    inBackground("quote email", () => email.quoteSent(id))
    return this.get(id)
  }

  async cancel(id: bigint) {
    const { row } = await this.one({ id })
    if (row.storefrontId) assertStaffStorefront(this.ctx, row.storefrontId)
    if (!canCancel(row.status)) throw new BadRequestError(`A quote that is ${row.status.toLowerCase()} can't be cancelled`, "ORDER_STATUS_INVALID_TRANSITION")
    await prisma.quotation.update({ where: { id }, data: { status: "CANCELLED" } })
    return this.get(id)
  }

  async remove(id: bigint) {
    const { row } = await this.one({ id })
    if (row.storefrontId) assertStaffStorefront(this.ctx, row.storefrontId)
    if (row.status !== "DRAFT" || row.sentAt) throw new BadRequestError("Only drafts that were never sent can be deleted; cancel it instead", "ORDER_STATUS_INVALID_TRANSITION")
    await prisma.quotation.delete({ where: { id } })
  }

  // ================================================================ customer

  /** My quotes: everything except drafts, and cancelled ones I never saw. */
  async mine(customerId: bigint) {
    const rows = await prisma.quotation.findMany({
      where: {
        storeId: this.storeId,
        customerId,
        NOT: [{ status: "DRAFT" }, { status: "CANCELLED", sentAt: null }],
      },
      include: INCLUDE,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: 100,
    })
    const numbers = await this.orderNumbers(rows)
    return rows.map((r) => this.customerView(r, r.orderId ? numbers.get(r.orderId) ?? null : null))
  }

  private async myRow(customerId: bigint, number: string) {
    const found = await this.one({ customerId, number })
    if (found.row.status === "DRAFT" || (found.row.status === "CANCELLED" && !found.row.sentAt)) throw new NotFoundError("Quotation")
    return found
  }

  async myOne(customerId: bigint, number: string) {
    const { row, orderNumber } = await this.myRow(customerId, number)
    return this.customerView(row, orderNumber)
  }

  /** A business account asks for a quote on what's in their cart. */
  async request(customerId: bigint, dto: { items: QuoteLineInput[]; note?: string | null }) {
    if (!(await isBusinessBuyer(this.storeId, customerId))) {
      throw new ForbiddenError("Quotes are for approved business accounts", "INSUFFICIENT_PERMISSION")
    }
    const storefrontId = this.ctx.storefrontId ?? (await defaultStorefrontId(this.storeId))
    const lines = await this.priceLines(customerId, storefrontId, dto.items)
    const items = lines.map((l, idx) => ({
      productId: l.productId,
      variantId: l.variantId,
      name: l.name,
      option: l.option,
      sku: l.sku,
      qty: l.qty,
      unitPrice: l.listPrice,
      listPrice: l.listPrice,
      lineTotal: Math.round(l.listPrice * l.qty * 100) / 100,
      sortOrder: idx,
    }))
    const t = quoteTotals(items, 0, 0)
    const q = await this.insert({
      customerId,
      storefrontId,
      status: "REQUESTED",
      customerNote: dto.note ?? null,
      subtotal: t.subtotal,
      total: t.total,
      items: { create: items },
    })
    const email = new EmailService(this.storeId)
    inBackground("quote request email", () => email.quoteUpdate(q.id, "requested"))
    return this.myOne(customerId, q.number)
  }

  async respond(customerId: bigint, number: string, action: "accept" | "decline", note: string | null | undefined) {
    const { row } = await this.myRow(customerId, number)
    if (!canRespond(row.status, row.validUntil)) {
      throw new BadRequestError(
        row.status === "SENT" ? "This quote has expired. Ask the shop for a new one." : "This quote can't be answered any more",
        "ORDER_STATUS_INVALID_TRANSITION",
      )
    }
    await prisma.quotation.update({
      where: { id: row.id },
      data: { status: action === "accept" ? "ACCEPTED" : "DECLINED", respondedAt: new Date(), ...(note ? { customerNote: note } : {}) },
    })
    const email = new EmailService(this.storeId)
    inBackground("quote answer email", () => email.quoteUpdate(row.id, action === "accept" ? "accepted" : "declined"))
    return this.myOne(customerId, number)
  }
}
