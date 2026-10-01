/**
 * PURCHASING — suppliers and what the shop owes them, purchases that receive stock and update
 * cost prices, supplier payments, and the bank / cash / mobile accounts money moves through.
 * Rules (totals, landed cost, average cost, payment terms) live in purchasing.rules.ts.
 */
import { Prisma } from "@prisma/client"
import { prisma, tx } from "../../config"
import { BadRequestError, ConflictError, NotFoundError, type RequestContext } from "../../core"
import { defaultWarehouseId, moveStock } from "../stock"
import {
  averageCost,
  payNowFor,
  purchaseNumber,
  purchaseTotals,
  supplierBalance,
  type PaymentTerm,
  orderStatus,
  receiveDelivery,
  receivedValue,
  returnNumber,
} from "./purchasing.rules"

type T = Prisma.TransactionClient
const num = (v: Prisma.Decimal | number | null | undefined) =>
  v === null || v === undefined ? 0 : Number(v)
const round2 = (n: number) => Math.round(n * 100) / 100
const day = (d: Date) => d.toISOString().slice(0, 10)
/** Trimmed text, or null when empty. */
const blankToNull = (v: string | null | undefined) => (v?.trim() ? v.trim() : null)
const tk = (n: number) => `৳${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`

export interface SupplierInput {
  name: string
  contactPerson?: string | null
  contactPhone?: string | null
  contactEmail?: string | null
  countryCode?: string | null
  address?: string | null
  openingBalance?: number
  notes?: string | null
  isActive?: boolean
}

export interface PurchaseInput {
  supplierId: bigint
  sourcingType: "local" | "import"
  originCountry?: string | null
  sourceFrom?: string | null
  reference?: string | null
  purchasedOn: Date
  warehouseId?: bigint | null
  shippingCost?: number
  customsDuty?: number
  otherCharges?: number
  discount?: number
  items: {
    productId: bigint
    variantId?: bigint | null
    qualityGrade?: string | null
    qty: number
    unitCost: number
    discountPct?: number
    discountAmount?: number
  }[]
  paymentTerm: PaymentTerm
  payNow?: number
  accountId?: bigint | null
  paymentMethod?: string
  notes?: string | null
  /** False: a purchase order. Nothing is received yet; deliveries are recorded as they arrive. */
  receiveNow?: boolean
  /** When the supplier said it would arrive (purchase orders). */
  expectedOn?: Date | null
}

export interface PaymentInput {
  supplierId: bigint
  purchaseId?: bigint | null
  accountId: bigint
  amount: number
  method: string
  paidOn: Date
  reference?: string | null
  notes?: string | null
}

export interface AccountInput {
  name: string
  type: "bank" | "cash" | "mobile"
  details?: string | null
  openingBalance?: number
  isActive?: boolean
}

export class PurchasingService {
  constructor(private readonly ctx: RequestContext) {}

  private get storeId(): bigint {
    if (this.ctx.storeId === undefined)
      throw new BadRequestError("No store for this request", "STORE_REQUIRED")
    return this.ctx.storeId
  }

  private get adminId(): bigint | null {
    return this.ctx.admin?.id ? BigInt(this.ctx.admin.id) : null
  }

  // ================================================================ suppliers

  /** Purchases received and payments made per supplier, for balances. */
  private async supplierTotals(ids?: bigint[]) {
    const where = { storeId: this.storeId, ...(ids ? { supplierId: { in: ids } } : {}) }
    const [bought, paid, back] = await Promise.all([
      prisma.purchase.groupBy({
        by: ["supplierId"],
        where: { ...where, status: { in: ["received", "partial"] } },
        _sum: { receivedTotal: true },
        _count: true,
      }),
      prisma.supplierPayment.groupBy({ by: ["supplierId"], where, _sum: { amount: true } }),
      prisma.supplierReturn.groupBy({ by: ["supplierId"], where: { ...where, status: "returned" }, _sum: { total: true } }),
    ])
    return (id: bigint) => {
      const b = bought.find((x) => x.supplierId === id)
      const p = paid.find((x) => x.supplierId === id)
      const r = back.find((x) => x.supplierId === id)
      return { purchased: num(b?._sum.receivedTotal), purchases: b?._count ?? 0, paid: num(p?._sum.amount), returned: num(r?._sum.total) }
    }
  }

  private supplierView(
    s: Prisma.SupplierGetPayload<object>,
    t: { purchased: number; purchases: number; paid: number; returned: number },
  ) {
    return {
      id: String(s.id),
      name: s.name,
      contactPerson: s.contactPerson,
      contactPhone: s.contactPhone,
      contactEmail: s.contactEmail,
      countryCode: s.countryCode,
      address: s.address,
      notes: s.notes,
      isActive: s.status === "active",
      openingBalance: num(s.openingBalance),
      purchased: t.purchased,
      paid: t.paid,
      purchases: t.purchases,
      /** Goods sent back (credit). */
      returned: t.returned,
      /** What the shop owes them now (negative = paid ahead). */
      balance: supplierBalance(num(s.openingBalance), t.purchased, t.paid, t.returned),
    }
  }

  async suppliers(q: { search?: string; active?: boolean }) {
    const rows = await prisma.supplier.findMany({
      where: {
        storeId: this.storeId,
        ...(q.active !== undefined ? { status: q.active ? "active" : "inactive" } : {}),
        ...(q.search
          ? {
              OR: [
                { name: { contains: q.search, mode: "insensitive" } },
                { contactPhone: { contains: q.search } },
                { contactPerson: { contains: q.search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { name: "asc" },
    })
    const totals = await this.supplierTotals(rows.map((r) => r.id))
    return rows.map((s) => this.supplierView(s, totals(s.id)))
  }

  private async findSupplier(id: bigint) {
    const s = await prisma.supplier.findFirst({ where: { id, storeId: this.storeId } })
    if (!s) throw new NotFoundError("Supplier")
    return s
  }

  /** A supplier with their purchases and payments, newest first, and a running statement. */
  async supplier(id: bigint) {
    const s = await this.findSupplier(id)
    const [totals, purchases, payments, returns] = await Promise.all([
      this.supplierTotals([id]),
      prisma.purchase.findMany({
        where: { storeId: this.storeId, supplierId: id },
        orderBy: [{ purchasedOn: "desc" }, { id: "desc" }],
        take: 100,
      }),
      prisma.supplierPayment.findMany({
        where: { storeId: this.storeId, supplierId: id },
        include: { account: { select: { name: true } }, purchase: { select: { number: true } } },
        orderBy: [{ paidOn: "desc" }, { id: "desc" }],
        take: 100,
      }),
      prisma.supplierReturn.findMany({
        where: { storeId: this.storeId, supplierId: id },
        orderBy: [{ returnedOn: "desc" }, { id: "desc" }],
        take: 100,
      }),
    ])
    return {
      ...this.supplierView(s, totals(id)),
      purchaseList: purchases.map((p) => ({
        id: String(p.id),
        number: p.number,
        purchasedOn: day(p.purchasedOn),
        reference: p.reference,
        total: num(p.total),
        receivedTotal: num(p.receivedTotal),
        status: p.status,
        paymentTerm: p.paymentTerm,
      })),
      paymentList: payments.map((p) => this.paymentView(p)),
      returnList: returns.map((r) => ({ id: String(r.id), number: r.number, returnedOn: day(r.returnedOn), reason: r.reason, total: num(r.total), status: r.status })),
    }
  }

  private supplierData(d: Partial<SupplierInput>) {
    return {
      ...(d.name !== undefined ? { name: d.name.trim() } : {}),
      ...(d.contactPerson !== undefined ? { contactPerson: blankToNull(d.contactPerson) } : {}),
      ...(d.contactPhone !== undefined ? { contactPhone: blankToNull(d.contactPhone) } : {}),
      ...(d.contactEmail !== undefined ? { contactEmail: blankToNull(d.contactEmail) } : {}),
      ...(d.countryCode !== undefined ? { countryCode: blankToNull(d.countryCode) } : {}),
      ...(d.address !== undefined ? { address: blankToNull(d.address) } : {}),
      ...(d.notes !== undefined ? { notes: blankToNull(d.notes) } : {}),
      ...(d.openingBalance !== undefined ? { openingBalance: d.openingBalance } : {}),
      ...(d.isActive !== undefined ? { status: d.isActive ? "active" : "inactive" } : {}),
    }
  }

  async createSupplier(d: SupplierInput) {
    const base =
      d.name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "supplier"
    let slug = base
    for (
      let i = 2;
      await prisma.supplier.findFirst({
        where: { storeId: this.storeId, slug },
        select: { id: true },
      });
      i++
    )
      slug = `${base}-${i}`
    const s = await prisma.supplier.create({
      data: { storeId: this.storeId, slug, name: d.name.trim(), ...this.supplierData(d) },
    })
    return this.supplier(s.id)
  }

  async updateSupplier(id: bigint, d: Partial<SupplierInput>) {
    await this.findSupplier(id)
    await prisma.supplier.update({ where: { id }, data: this.supplierData(d) })
    return this.supplier(id)
  }

  /** Only a supplier with no purchases or payments can be deleted; others are turned off. */
  async deleteSupplier(id: bigint) {
    await this.findSupplier(id)
    const [p, pay, back] = await Promise.all([
      prisma.purchase.count({ where: { supplierId: id } }),
      prisma.supplierPayment.count({ where: { supplierId: id } }),
      prisma.supplierReturn.count({ where: { supplierId: id } }),
    ])
    if (p || pay || back)
      throw new ConflictError(
        "This supplier has purchases, payments or returns. Turn them off instead of deleting.",
        "CONFLICT",
      )
    await prisma.supplier.delete({ where: { id } })
    return { deleted: true }
  }

  // ================================================================ product picker

  /** Products to buy (drafts too: stock is often bought before a product goes live), with stock and cost. */
  async pickProducts(search: string) {
    const q = search.trim()
    const rows = await prisma.product.findMany({
      where: {
        storeId: this.storeId,
        status: { not: "archived" },
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { sku: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        sku: true,
        status: true,
        stockQty: true,
        costPrice: true,
        images: { orderBy: { sortOrder: "asc" }, take: 1, select: { imageUrl: true } },
        variants: {
          where: { status: "active" },
          orderBy: { id: "asc" },
          select: { id: true, sku: true, attributeValues: true, stockQty: true, costPrice: true },
        },
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 10,
    })
    return rows.map((p) => ({
      id: String(p.id),
      name: p.name,
      sku: p.sku,
      status: p.status,
      imageUrl: p.images[0]?.imageUrl ?? null,
      stockQty: p.stockQty,
      costPrice: p.costPrice === null ? null : num(p.costPrice),
      variants: p.variants.map((v) => ({
        id: String(v.id),
        label:
          Object.values((v.attributeValues as Record<string, string> | null) ?? {}).join(" / ") ||
          (v.sku ?? `#${v.id}`),
        sku: v.sku,
        stockQty: v.stockQty,
        costPrice: v.costPrice === null ? null : num(v.costPrice),
      })),
    }))
  }

  // ================================================================ quality grades

  async grades() {
    const rows = await prisma.qualityGrade.findMany({
      where: { storeId: this.storeId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    })
    return rows.map((g) => ({ id: String(g.id), name: g.name }))
  }

  async addGrade(name: string) {
    const n = name.trim()
    const max = await prisma.qualityGrade.aggregate({
      where: { storeId: this.storeId },
      _max: { sortOrder: true },
    })
    try {
      await prisma.qualityGrade.create({
        data: { storeId: this.storeId, name: n, sortOrder: (max._max.sortOrder ?? 0) + 1 },
      })
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
        throw new ConflictError(`"${n}" is already a grade`, "CONFLICT")
      throw e
    }
    return this.grades()
  }

  async deleteGrade(id: bigint) {
    await prisma.qualityGrade.deleteMany({ where: { id, storeId: this.storeId } })
    return this.grades()
  }

  // ================================================================ money accounts

  private async balances(ids: bigint[]) {
    const sums = await prisma.moneyTransaction.groupBy({
      by: ["accountId"],
      where: { storeId: this.storeId, accountId: { in: ids } },
      _sum: { amount: true },
    })
    return (id: bigint) => num(sums.find((s) => s.accountId === id)?._sum.amount)
  }

  async accounts() {
    const rows = await prisma.moneyAccount.findMany({
      where: { storeId: this.storeId },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    })
    const moved = await this.balances(rows.map((r) => r.id))
    return rows.map((a) => ({
      id: String(a.id),
      name: a.name,
      type: a.type,
      details: a.details,
      isActive: a.isActive,
      openingBalance: num(a.openingBalance),
      /** Opening balance + every transaction; never edited directly. */
      balance: round2(num(a.openingBalance) + moved(a.id)),
    }))
  }

  private async findAccount(id: bigint, t: T | typeof prisma = prisma) {
    const a = await t.moneyAccount.findFirst({ where: { id, storeId: this.storeId } })
    if (!a) throw new NotFoundError("Account")
    return a
  }

  private async accountBalance(id: bigint, t: T | typeof prisma = prisma) {
    const a = await this.findAccount(id, t)
    const s = await t.moneyTransaction.aggregate({
      where: { accountId: id },
      _sum: { amount: true },
    })
    return { account: a, balance: round2(num(a.openingBalance) + num(s._sum.amount)) }
  }

  async createAccount(d: AccountInput) {
    await prisma.moneyAccount.create({
      data: {
        storeId: this.storeId,
        name: d.name.trim(),
        type: d.type,
        details: blankToNull(d.details),
        openingBalance: d.openingBalance ?? 0,
        isActive: d.isActive ?? true,
      },
    })
    return this.accounts()
  }

  async updateAccount(id: bigint, d: Partial<AccountInput>) {
    await this.findAccount(id)
    await prisma.moneyAccount.update({
      where: { id },
      data: {
        ...(d.name !== undefined ? { name: d.name.trim() } : {}),
        ...(d.type !== undefined ? { type: d.type } : {}),
        ...(d.details !== undefined ? { details: blankToNull(d.details) } : {}),
        ...(d.openingBalance !== undefined ? { openingBalance: d.openingBalance } : {}),
        ...(d.isActive !== undefined ? { isActive: d.isActive } : {}),
      },
    })
    return this.accounts()
  }

  /** An account's transactions, newest first, each with the balance after it. */
  async ledger(id: bigint, q: { page: number; perPage: number }) {
    const { account, balance } = await this.accountBalance(id)
    const [total, rows] = await Promise.all([
      prisma.moneyTransaction.count({ where: { accountId: id } }),
      prisma.moneyTransaction.findMany({
        where: { accountId: id },
        orderBy: [{ occurredOn: "desc" }, { id: "desc" }],
        skip: (q.page - 1) * q.perPage,
        take: q.perPage,
      }),
    ])
    // Balance after each row: start from today's balance and walk back through newer rows.
    const newer = await prisma.moneyTransaction.aggregate({
      where: {
        accountId: id,
        OR: rows.length
          ? [
              { occurredOn: { gt: rows[0]!.occurredOn } },
              { occurredOn: rows[0]!.occurredOn, id: { gt: rows[0]!.id } },
            ]
          : [{ id: { lt: 0 } }],
      },
      _sum: { amount: true },
    })
    let running = round2(balance - num(newer._sum.amount))
    const items = rows.map((r) => {
      const after = running
      running = round2(running - num(r.amount))
      return {
        id: String(r.id),
        occurredOn: day(r.occurredOn),
        kind: r.kind,
        amount: num(r.amount),
        balanceAfter: after,
        note: r.note,
        refType: r.refType,
        refId: r.refId,
      }
    })
    return {
      account: {
        id: String(account.id),
        name: account.name,
        type: account.type,
        openingBalance: num(account.openingBalance),
        balance,
      },
      items,
      meta: {
        page: q.page,
        perPage: q.perPage,
        total,
        totalPages: Math.max(1, Math.ceil(total / q.perPage)),
      },
    }
  }

  /** Takes money out of an account inside a transaction; refuses to go below zero. */
  private async debit(
    t: T,
    accountId: bigint,
    amount: number,
    entry: { kind: string; note?: string | null; refType?: string; refId?: string; on: Date },
  ) {
    const { account, balance } = await this.accountBalance(accountId, t)
    if (!account.isActive)
      throw new BadRequestError(`"${account.name}" is turned off`, "VALIDATION_FAILED")
    if (balance + 0.001 < amount)
      throw new BadRequestError(
        `Not enough in "${account.name}" (${tk(balance)}). Record the money coming in first.`,
        "VALIDATION_FAILED",
      )
    await t.moneyTransaction.create({
      data: {
        storeId: this.storeId,
        accountId,
        amount: -amount,
        kind: entry.kind,
        note: entry.note ?? null,
        refType: entry.refType,
        refId: entry.refId,
        occurredOn: entry.on,
        createdByAdminId: this.adminId,
      },
    })
  }

  /** A deposit, withdrawal or correction typed by staff, or a transfer between two accounts. */
  async moveMoney(d: {
    kind: "deposit" | "withdrawal" | "adjustment" | "transfer"
    accountId: bigint
    toAccountId?: bigint | null
    amount: number
    occurredOn: Date
    note?: string | null
  }) {
    const note = blankToNull(d.note)
    await tx(async (t: T) => {
      if (d.kind === "deposit" || (d.kind === "adjustment" && d.amount > 0)) {
        const a = await this.findAccount(d.accountId, t)
        if (!a.isActive) throw new BadRequestError(`"${a.name}" is turned off`, "VALIDATION_FAILED")
        await t.moneyTransaction.create({
          data: {
            storeId: this.storeId,
            accountId: d.accountId,
            amount: Math.abs(d.amount),
            kind: d.kind,
            note,
            occurredOn: d.occurredOn,
            createdByAdminId: this.adminId,
          },
        })
      } else if (d.kind === "withdrawal" || d.kind === "adjustment") {
        await this.debit(t, d.accountId, Math.abs(d.amount), {
          kind: d.kind,
          note,
          on: d.occurredOn,
        })
      } else {
        if (!d.toAccountId || d.toAccountId === d.accountId)
          throw new BadRequestError(
            "Choose a different account to move the money to",
            "VALIDATION_FAILED",
          )
        const to = await this.findAccount(d.toAccountId, t)
        const from = await this.findAccount(d.accountId, t)
        await this.debit(t, d.accountId, d.amount, {
          kind: "transfer_out",
          note: note ?? `To ${to.name}`,
          refType: "account",
          refId: String(to.id),
          on: d.occurredOn,
        })
        await t.moneyTransaction.create({
          data: {
            storeId: this.storeId,
            accountId: to.id,
            amount: d.amount,
            kind: "transfer_in",
            note: note ?? `From ${from.name}`,
            refType: "account",
            refId: String(from.id),
            occurredOn: d.occurredOn,
            createdByAdminId: this.adminId,
          },
        })
      }
    })
    return this.accounts()
  }

  // ================================================================ payments

  private paymentView(
    p: Prisma.SupplierPaymentGetPayload<{
      include: { account: { select: { name: true } }; purchase: { select: { number: true } } }
    }> & { supplier?: { name: string } },
  ) {
    return {
      id: String(p.id),
      supplierId: String(p.supplierId),
      supplier: p.supplier?.name ?? null,
      purchaseId: p.purchaseId ? String(p.purchaseId) : null,
      purchaseNumber: p.purchase?.number ?? null,
      account: p.account.name,
      accountId: String(p.accountId),
      amount: num(p.amount),
      method: p.method,
      paidOn: day(p.paidOn),
      reference: p.reference,
      notes: p.notes,
    }
  }

  async payments(q: { supplierId?: bigint; page: number; perPage: number }) {
    const where = { storeId: this.storeId, ...(q.supplierId ? { supplierId: q.supplierId } : {}) }
    const [total, rows] = await Promise.all([
      prisma.supplierPayment.count({ where }),
      prisma.supplierPayment.findMany({
        where,
        include: {
          account: { select: { name: true } },
          purchase: { select: { number: true } },
          supplier: { select: { name: true } },
        },
        orderBy: [{ paidOn: "desc" }, { id: "desc" }],
        skip: (q.page - 1) * q.perPage,
        take: q.perPage,
      }),
    ])
    return {
      items: rows.map((r) => this.paymentView(r)),
      meta: {
        page: q.page,
        perPage: q.perPage,
        total,
        totalPages: Math.max(1, Math.ceil(total / q.perPage)),
      },
    }
  }

  /** Pays a supplier: lowers what's owed and takes the money out of the account, together. */
  private async recordPayment(t: T, d: PaymentInput) {
    const supplier = await t.supplier.findFirst({
      where: { id: d.supplierId, storeId: this.storeId },
    })
    if (!supplier) throw new NotFoundError("Supplier")
    if (d.purchaseId) {
      const p = await t.purchase.findFirst({
        where: { id: d.purchaseId, storeId: this.storeId, supplierId: d.supplierId },
      })
      if (!p)
        throw new BadRequestError("That purchase isn't from this supplier", "VALIDATION_FAILED")
    }
    const pay = await t.supplierPayment.create({
      data: {
        storeId: this.storeId,
        supplierId: d.supplierId,
        purchaseId: d.purchaseId ?? null,
        accountId: d.accountId,
        amount: round2(d.amount),
        method: d.method,
        paidOn: d.paidOn,
        reference: blankToNull(d.reference),
        notes: blankToNull(d.notes),
        createdByAdminId: this.adminId,
      },
    })
    await this.debit(t, d.accountId, round2(d.amount), {
      kind: "supplier_payment",
      note: `Paid ${supplier.name}`,
      refType: "supplier_payment",
      refId: String(pay.id),
      on: d.paidOn,
    })
    return pay
  }

  async pay(d: PaymentInput) {
    if (d.amount <= 0) throw new BadRequestError("Enter an amount above 0", "VALIDATION_FAILED")
    const p = await tx((t: T) => this.recordPayment(t, d))
    const row = await prisma.supplierPayment.findUniqueOrThrow({
      where: { id: p.id },
      include: {
        account: { select: { name: true } },
        purchase: { select: { number: true } },
        supplier: { select: { name: true } },
      },
    })
    return this.paymentView(row)
  }

  /** Undoes a payment recorded by mistake: the money goes back into its account. */
  async voidPayment(id: bigint) {
    await tx(async (t: T) => {
      const p = await t.supplierPayment.findFirst({
        where: { id, storeId: this.storeId },
        include: { supplier: { select: { name: true } } },
      })
      if (!p) throw new NotFoundError("Payment")
      await t.moneyTransaction.create({
        data: {
          storeId: this.storeId,
          accountId: p.accountId,
          amount: p.amount,
          kind: "reversal",
          note: `Payment to ${p.supplier.name} undone`,
          refType: "supplier_payment",
          refId: String(p.id),
          occurredOn: new Date(),
          createdByAdminId: this.adminId,
        },
      })
      await t.supplierPayment.delete({ where: { id } })
    })
    return { deleted: true }
  }

  // ================================================================ purchases

  async purchases(q: {
    supplierId?: bigint
    status?: string
    search?: string
    from?: Date
    to?: Date
    page: number
    perPage: number
  }) {
    const where: Prisma.PurchaseWhereInput = {
      storeId: this.storeId,
      ...(q.supplierId ? { supplierId: q.supplierId } : {}),
      ...(q.status ? { status: q.status } : {}),
      ...(q.from || q.to
        ? { purchasedOn: { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lte: q.to } : {}) } }
        : {}),
      ...(q.search
        ? {
            OR: [
              { number: { contains: q.search, mode: "insensitive" } },
              { reference: { contains: q.search, mode: "insensitive" } },
              { supplier: { name: { contains: q.search, mode: "insensitive" } } },
            ],
          }
        : {}),
    }
    const [total, rows, sum] = await Promise.all([
      prisma.purchase.count({ where }),
      prisma.purchase.findMany({
        where,
        include: {
          supplier: { select: { name: true } },
          payments: { select: { amount: true } },
          _count: { select: { items: true } },
        },
        orderBy: [{ purchasedOn: "desc" }, { id: "desc" }],
        skip: (q.page - 1) * q.perPage,
        take: q.perPage,
      }),
      prisma.purchase.aggregate({ where: { ...where, status: { in: ["received", "partial"] } }, _sum: { receivedTotal: true } }),
    ])
    return {
      items: rows.map((p) => ({
        id: String(p.id),
        number: p.number,
        purchasedOn: day(p.purchasedOn),
        supplier: p.supplier.name,
        supplierId: String(p.supplierId),
        sourcingType: p.sourcingType,
        originCountry: p.originCountry,
        sourceFrom: p.sourceFrom,
        reference: p.reference,
        items: p._count.items,
        total: num(p.total),
        receivedTotal: num(p.receivedTotal),
        expectedOn: p.expectedOn ? day(p.expectedOn) : null,
        paid: round2(p.payments.reduce((s, x) => s + num(x.amount), 0)),
        paymentTerm: p.paymentTerm,
        status: p.status,
      })),
      meta: {
        page: q.page,
        perPage: q.perPage,
        total,
        totalPages: Math.max(1, Math.ceil(total / q.perPage)),
        totalValue: num(sum._sum.receivedTotal),
      },
    }
  }

  async purchase(id: bigint) {
    const p = await prisma.purchase.findFirst({
      where: { id, storeId: this.storeId },
      include: {
        supplier: { select: { id: true, name: true } },
        warehouse: { select: { name: true, code: true } },
        items: { orderBy: { id: "asc" } },
        payments: {
          include: { account: { select: { name: true } }, purchase: { select: { number: true } } },
          orderBy: { id: "asc" },
        },
        returns: { orderBy: { id: "asc" }, select: { id: true, number: true, total: true, status: true, returnedOn: true } },
      },
    })
    if (!p) throw new NotFoundError("Purchase")
    return {
      id: String(p.id),
      number: p.number,
      supplier: { id: String(p.supplier.id), name: p.supplier.name },
      warehouse: p.warehouse,
      sourcingType: p.sourcingType,
      originCountry: p.originCountry,
      sourceFrom: p.sourceFrom,
      reference: p.reference,
      purchasedOn: day(p.purchasedOn),
      itemsSubtotal: num(p.itemsSubtotal),
      shippingCost: num(p.shippingCost),
      customsDuty: num(p.customsDuty),
      otherCharges: num(p.otherCharges),
      discount: num(p.discount),
      total: num(p.total),
      paymentTerm: p.paymentTerm,
      status: p.status,
      receivedTotal: num(p.receivedTotal),
      expectedOn: p.expectedOn ? day(p.expectedOn) : null,
      receivedOn: p.receivedOn ? day(p.receivedOn) : null,
      closedShort: p.closedShort,
      notes: p.notes,
      cancelledAt: p.cancelledAt?.toISOString() ?? null,
      createdAt: p.createdAt.toISOString(),
      paid: round2(p.payments.reduce((s, x) => s + num(x.amount), 0)),
      items: p.items.map((i) => ({
        id: String(i.id),
        productId: String(i.productId),
        variantId: i.variantId ? String(i.variantId) : null,
        name: i.name,
        qualityGrade: i.qualityGrade,
        qty: i.qty,
        qtyReceived: i.qtyReceived,
        unitCost: num(i.unitCost),
        discountPct: num(i.discountPct),
        discountAmount: num(i.discountAmount),
        lineTotal: num(i.lineTotal),
        landedUnitCost: num(i.landedUnitCost),
      })),
      payments: p.payments.map((x) => this.paymentView(x)),
      returns: p.returns.map((r) => ({ id: String(r.id), number: r.number, total: num(r.total), status: r.status, returnedOn: day(r.returnedOn) })),
    }
  }

  private async nextNumber(t: T) {
    const last = await t.purchase.findFirst({
      where: { storeId: this.storeId },
      orderBy: { id: "desc" },
      select: { number: true },
    })
    const n = last ? Number(/(\d+)$/.exec(last.number)?.[1] ?? 0) + 1 : 1
    return purchaseNumber(n)
  }

  /**
   * Records a purchase: stock goes up at once, each item's cost price becomes the average with its
   * landed cost, and any payment made now leaves the chosen account. All or nothing.
   */
  async createPurchase(d: PurchaseInput) {
    const totals = purchaseTotals(d.items, {
      shipping: d.shippingCost,
      customs: d.customsDuty,
      other: d.otherCharges,
      discount: d.discount,
    })
    if ("error" in totals) throw new BadRequestError(totals.error, "VALIDATION_FAILED")
    const receiveNow = d.receiveNow !== false
    // An order paid in advance can pay part or all of it now.
    const pay =
      !receiveNow && d.paymentTerm === "advance"
        ? (d.payNow ?? 0) <= totals.total + 0.001
          ? { amount: Math.max(0, d.payNow ?? 0) }
          : { error: "The advance is more than the order" }
        : payNowFor(d.paymentTerm, totals.total, d.payNow)
    if ("error" in pay) throw new BadRequestError(pay.error, "VALIDATION_FAILED")
    if (pay.amount > 0 && !d.accountId)
      throw new BadRequestError("Choose the account the payment comes from", "VALIDATION_FAILED")

    const supplier = await this.findSupplier(d.supplierId)
    if (supplier.status !== "active")
      throw new BadRequestError(`${supplier.name} is turned off`, "VALIDATION_FAILED")

    const products = await prisma.product.findMany({
      where: { storeId: this.storeId, id: { in: [...new Set(d.items.map((i) => i.productId))] } },
      include: { variants: { select: { id: true, attributeValues: true, status: true } } },
    })
    const lines = d.items.map((it, i) => {
      const p = products.find((x) => x.id === it.productId)
      if (!p)
        throw new BadRequestError(`Line ${i + 1}: that product doesn't exist`, "VALIDATION_FAILED")
      const v = it.variantId ? p.variants.find((x) => x.id === it.variantId) : null
      if (it.variantId && !v)
        throw new BadRequestError(
          `Line ${i + 1}: that option isn't one of ${p.name}'s`,
          "VALIDATION_FAILED",
        )
      if (!v && p.variants.some((x) => x.status === "active"))
        throw new BadRequestError(
          `Line ${i + 1}: choose which option of ${p.name} (size, colour…)`,
          "VALIDATION_FAILED",
        )
      const opt =
        v?.attributeValues && typeof v.attributeValues === "object"
          ? Object.values(v.attributeValues as Record<string, string>).join(" / ")
          : ""
      return {
        ...it,
        product: p,
        variant: v ?? null,
        name: opt ? `${p.name} (${opt})` : p.name,
        lineTotal: totals.lineTotals[i]!,
        landed: totals.landedUnitCosts[i]!,
      }
    })

    const id = await tx(async (t: T) => {
      const number = await this.nextNumber(t)
      let warehouseId = await defaultWarehouseId(t, this.storeId)
      if (d.warehouseId) {
        const w = await t.warehouse.findFirst({
          where: { id: d.warehouseId, storeId: this.storeId, isActive: true },
          select: { id: true },
        })
        if (!w) throw new BadRequestError("Choose a warehouse that's in use", "VALIDATION_FAILED")
        warehouseId = w.id
      }
      const purchase = await t.purchase.create({
        data: {
          storeId: this.storeId,
          warehouseId,
          number,
          supplierId: d.supplierId,
          sourcingType: d.sourcingType,
          originCountry: blankToNull(d.originCountry),
          sourceFrom: blankToNull(d.sourceFrom),
          reference: blankToNull(d.reference),
          purchasedOn: d.purchasedOn,
          itemsSubtotal: totals.itemsSubtotal,
          shippingCost: d.shippingCost ?? 0,
          customsDuty: d.customsDuty ?? 0,
          otherCharges: d.otherCharges ?? 0,
          discount: d.discount ?? 0,
          total: totals.total,
          paymentTerm: d.paymentTerm,
          status: receiveNow ? "received" : "ordered",
          receivedTotal: receiveNow ? totals.total : 0,
          receivedOn: receiveNow ? d.purchasedOn : null,
          expectedOn: receiveNow ? null : (d.expectedOn ?? null),
          notes: blankToNull(d.notes),
          createdByAdminId: this.adminId,
          items: {
            create: lines.map((l) => ({
              productId: l.productId,
              variantId: l.variantId ?? null,
              name: l.name,
              qualityGrade: blankToNull(l.qualityGrade),
              qty: l.qty,
              qtyReceived: receiveNow ? l.qty : 0,
              unitCost: l.unitCost,
              discountPct: l.discountPct ?? 0,
              discountAmount: l.discountAmount ?? 0,
              lineTotal: l.lineTotal,
              landedUnitCost: l.landed,
            })),
          },
        },
      })

      if (receiveNow) {
        await this.addStock(t, {
          warehouseId,
          ref: number,
          note: `${supplier.name}${d.reference ? ` · ${d.reference}` : ""}`,
          lines: lines.map((l) => ({ productId: l.productId, variantId: l.variant?.id ?? null, qty: l.qty, landed: l.landed, name: l.name })),
        })
      }

      if (pay.amount > 0) {
        await this.recordPayment(t, {
          supplierId: d.supplierId,
          purchaseId: purchase.id,
          accountId: d.accountId!,
          amount: pay.amount,
          method: d.paymentMethod ?? "cash",
          paidOn: d.purchasedOn,
          reference: d.reference ?? null,
          notes: receiveNow ? `With purchase ${number}` : `Advance on order ${number}`,
        })
      }
      return purchase.id
    })
    return this.purchase(id)
  }

  /**
   * Receives stock and moves each item's cost price to the new average with its landed cost, line
   * by line (a product can appear twice, so each line reads the stock the previous one left).
   */
  private async addStock(
    t: T,
    m: {
      warehouseId: bigint
      ref: string
      note: string
      lines: { productId: bigint; variantId: bigint | null; qty: number; landed: number; name: string }[]
    },
  ) {
    for (const l of m.lines) {
      if (l.qty <= 0) continue
      const row = l.variantId
        ? await t.productVariant.findUniqueOrThrow({ where: { id: l.variantId }, select: { stockQty: true, costPrice: true } })
        : await t.product.findUniqueOrThrow({ where: { id: l.productId }, select: { stockQty: true, costPrice: true } })
      const cost = averageCost(row.stockQty ?? 0, row.costPrice === null ? null : num(row.costPrice), l.qty, l.landed)
      if (l.variantId) await t.productVariant.update({ where: { id: l.variantId }, data: { costPrice: cost } })
      else await t.product.update({ where: { id: l.productId }, data: { costPrice: cost } })
      await moveStock(t, {
        storeId: this.storeId,
        warehouseId: m.warehouseId,
        sku: { productId: l.productId, variantId: l.variantId },
        onHand: l.qty,
        reason: "PURCHASE",
        ref: m.ref,
        note: m.note,
      })
    }
  }

  /** The purchase row, locked for this transaction (deliveries and returns take turns). */
  private async lockPurchase(t: T, id: bigint) {
    await t.$queryRaw`SELECT 1 FROM "Purchase" WHERE "id" = ${id} AND "storeId" = ${this.storeId} FOR UPDATE`
    const p = await t.purchase.findFirst({
      where: { id, storeId: this.storeId },
      include: { items: { orderBy: { id: "asc" } }, supplier: { select: { name: true } } },
    })
    if (!p) throw new NotFoundError("Purchase")
    return p
  }

  /**
   * A delivery against a purchase order: the units that arrived go into stock (cost prices move to
   * the new average) and the order becomes partly or fully received. What the shop owes the
   * supplier grows by the value of what arrived.
   */
  async receivePurchase(id: bigint, d: { items: { itemId: bigint; qty: number }[]; receivedOn?: Date; note?: string | null }) {
    await tx(async (t: T) => {
      const p = await this.lockPurchase(t, id)
      if (p.status !== "ordered" && p.status !== "partial")
        throw new BadRequestError(
          p.status === "cancelled" ? "This purchase is cancelled" : "Everything on this purchase has already arrived",
          "VALIDATION_FAILED",
        )
      const ordered = p.items.map((i) => ({ id: String(i.id), qty: i.qty, qtyReceived: i.qtyReceived, landedUnitCost: num(i.landedUnitCost) }))
      const r = receiveDelivery(ordered, d.items.map((x) => ({ id: String(x.itemId), qty: x.qty })))
      if ("error" in r) throw new BadRequestError(r.error, "VALIDATION_FAILED")
      const warehouseId = p.warehouseId ?? (await defaultWarehouseId(t, this.storeId))
      await this.addStock(t, {
        warehouseId,
        ref: p.number,
        note: [p.supplier.name, p.reference, d.note?.trim()].filter(Boolean).join(" · "),
        lines: p.items.map((i) => ({
          productId: i.productId,
          variantId: i.variantId,
          qty: (r.received.get(String(i.id)) ?? i.qtyReceived) - i.qtyReceived,
          landed: num(i.landedUnitCost),
          name: i.name,
        })),
      })
      for (const i of p.items) {
        const got = r.received.get(String(i.id)) ?? i.qtyReceived
        if (got !== i.qtyReceived) await t.purchaseItem.update({ where: { id: i.id }, data: { qtyReceived: got } })
      }
      const after = ordered.map((l) => ({ ...l, qtyReceived: r.received.get(l.id) ?? l.qtyReceived }))
      await t.purchase.update({
        where: { id },
        data: {
          status: orderStatus(after),
          receivedTotal: receivedValue(after, num(p.total)),
          receivedOn: d.receivedOn ?? new Date(),
        },
      })
    })
    return this.purchase(id)
  }

  /**
   * Closes a part-received order: the rest won't come. The shop owes only for what arrived.
   */
  async closePurchase(id: bigint) {
    await tx(async (t: T) => {
      const p = await this.lockPurchase(t, id)
      if (p.status !== "partial")
        throw new BadRequestError(
          p.status === "ordered" ? "Nothing has arrived yet: cancel the order instead" : "Only a part-received order can be closed",
          "VALIDATION_FAILED",
        )
      const short = p.items.reduce((s, i) => s + i.qty - i.qtyReceived, 0)
      await t.purchase.update({
        where: { id },
        data: {
          status: "received",
          closedShort: true,
          notes: [p.notes, `Closed with ${short} unit${short === 1 ? "" : "s"} not delivered.`].filter(Boolean).join("\n"),
        },
      })
    })
    return this.purchase(id)
  }

  /**
   * Cancels a purchase recorded by mistake: its stock comes off again (refused when some of it has
   * already been sold). Payments stay with the supplier as credit; cost prices aren't rewound.
   */
  async cancelPurchase(id: bigint) {
    await tx(async (t: T) => {
      const p = await t.purchase.findFirst({
        where: { id, storeId: this.storeId },
        include: { items: true },
      })
      if (!p) throw new NotFoundError("Purchase")
      if (p.status === "cancelled")
        throw new BadRequestError("This purchase is already cancelled", "VALIDATION_FAILED")
      const warehouseId = p.warehouseId ?? (await defaultWarehouseId(t, this.storeId))
      const returned = await t.supplierReturn.count({ where: { purchaseId: p.id, status: "returned" } })
      if (returned) throw new BadRequestError("Goods from this purchase were sent back: cancel those returns first", "VALIDATION_FAILED")
      for (const i of p.items) {
        if (i.qtyReceived <= 0) continue
        try {
          await moveStock(t, {
            storeId: this.storeId,
            warehouseId,
            sku: { productId: i.productId, variantId: i.variantId },
            onHand: -i.qtyReceived,
            guard: "onHand",
            reason: "PURCHASE_CANCELLED",
            ref: p.number,
            label: i.name,
          })
        } catch (e) {
          if (e instanceof BadRequestError)
            throw new BadRequestError(
              `Can't cancel: some of "${i.name}" from this purchase has already been sold or moved (${e.message.replace(/^"[^"]*": /, "")})`,
              "VALIDATION_FAILED",
            )
          throw e
        }
      }
      await t.purchase.update({
        where: { id },
        data: { status: "cancelled", cancelledAt: new Date(), receivedTotal: 0 },
      })
    })
    return this.purchase(id)
  }

  // ================================================================ returns to suppliers

  private returnView(r: Prisma.SupplierReturnGetPayload<{ include: { items: true; supplier: { select: { name: true } }; purchase: { select: { number: true } } } }>) {
    return {
      id: String(r.id),
      number: r.number,
      supplier: { id: String(r.supplierId), name: r.supplier.name },
      purchase: r.purchaseId ? { id: String(r.purchaseId), number: r.purchase?.number ?? "" } : null,
      returnedOn: day(r.returnedOn),
      reason: r.reason,
      total: num(r.total),
      status: r.status,
      notes: r.notes,
      cancelledAt: r.cancelledAt?.toISOString() ?? null,
      items: r.items.map((i) => ({
        id: String(i.id),
        productId: String(i.productId),
        variantId: i.variantId ? String(i.variantId) : null,
        name: i.name,
        qty: i.qty,
        unitCost: num(i.unitCost),
        lineTotal: num(i.lineTotal),
      })),
    }
  }

  async returns(q: { supplierId?: bigint; page: number; perPage: number }) {
    const where: Prisma.SupplierReturnWhereInput = { storeId: this.storeId, ...(q.supplierId ? { supplierId: q.supplierId } : {}) }
    const [total, rows] = await Promise.all([
      prisma.supplierReturn.count({ where }),
      prisma.supplierReturn.findMany({
        where,
        include: { items: true, supplier: { select: { name: true } }, purchase: { select: { number: true } } },
        orderBy: [{ returnedOn: "desc" }, { id: "desc" }],
        skip: (q.page - 1) * q.perPage,
        take: q.perPage,
      }),
    ])
    return { items: rows.map((r) => this.returnView(r)), meta: { page: q.page, perPage: q.perPage, total, totalPages: Math.max(1, Math.ceil(total / q.perPage)) } }
  }

  async supplierReturn(id: bigint) {
    const r = await prisma.supplierReturn.findFirst({
      where: { id, storeId: this.storeId },
      include: { items: true, supplier: { select: { name: true } }, purchase: { select: { number: true } } },
    })
    if (!r) throw new NotFoundError("Return")
    return this.returnView(r)
  }

  /**
   * Sends goods back to a supplier: the units leave the warehouse (only units not held for
   * orders), and the supplier's balance goes down by their cost. From a purchase, each line can
   * send back at most what arrived less what was already returned, at its landed cost.
   */
  async createReturn(d: {
    supplierId: bigint
    purchaseId?: bigint | null
    warehouseId?: bigint | null
    returnedOn: Date
    reason: string
    notes?: string | null
    items: { productId: bigint; variantId?: bigint | null; qty: number; unitCost?: number }[]
  }) {
    const supplier = await this.findSupplier(d.supplierId)
    const id = await tx(async (t: T) => {
      const purchase = d.purchaseId ? await this.lockPurchase(t, d.purchaseId) : null
      if (purchase && purchase.supplierId !== d.supplierId)
        throw new BadRequestError("That purchase is from another supplier", "VALIDATION_FAILED")
      if (purchase && !["received", "partial"].includes(purchase.status))
        throw new BadRequestError("Only goods that arrived can be sent back", "VALIDATION_FAILED")
      // Already sent back from this purchase, per product option.
      const before = purchase
        ? await t.supplierReturnItem.groupBy({
            by: ["productId", "variantId"],
            where: { return: { purchaseId: purchase.id, status: "returned" } },
            _sum: { qty: true },
          })
        : []
      const sentBack = new Map(before.map((b) => [`${b.productId}:${b.variantId ?? ""}`, b._sum.qty ?? 0]))

      const lines: { productId: bigint; variantId: bigint | null; qty: number; unitCost: number; name: string }[] = []
      for (const [n, it] of d.items.entries()) {
        const key = `${it.productId}:${it.variantId ?? ""}`
        if (purchase) {
          const onPurchase = purchase.items.filter((x) => x.productId === it.productId && (x.variantId ?? null) === (it.variantId ?? null))
          if (!onPurchase.length) throw new BadRequestError(`Line ${n + 1}: that item isn't on ${purchase.number}`, "VALIDATION_FAILED")
          const arrived = onPurchase.reduce((s, x) => s + x.qtyReceived, 0)
          const already = (sentBack.get(key) ?? 0) + lines.filter((l) => `${l.productId}:${l.variantId ?? ""}` === key).reduce((s, l) => s + l.qty, 0)
          if (it.qty > arrived - already)
            throw new BadRequestError(`Line ${n + 1}: only ${Math.max(0, arrived - already)} of "${onPurchase[0]!.name}" can still go back`, "VALIDATION_FAILED")
          lines.push({ productId: it.productId, variantId: it.variantId ?? null, qty: it.qty, unitCost: it.unitCost ?? num(onPurchase[0]!.landedUnitCost), name: onPurchase[0]!.name })
        } else {
          const p = await t.product.findFirst({
            where: { id: it.productId, storeId: this.storeId },
            include: { variants: { where: it.variantId ? { id: it.variantId } : { id: -1n }, select: { id: true, costPrice: true, attributeValues: true } } },
          })
          if (!p) throw new BadRequestError(`Line ${n + 1}: that product doesn't exist`, "VALIDATION_FAILED")
          const v = it.variantId ? p.variants[0] : null
          if (it.variantId && !v) throw new BadRequestError(`Line ${n + 1}: that option isn't one of ${p.name}'s`, "VALIDATION_FAILED")
          const cost = it.unitCost ?? num(v ? v.costPrice : p.costPrice)
          const opt = v?.attributeValues && typeof v.attributeValues === "object" ? Object.values(v.attributeValues as Record<string, string>).join(" / ") : ""
          lines.push({ productId: it.productId, variantId: v?.id ?? null, qty: it.qty, unitCost: cost, name: opt ? `${p.name} (${opt})` : p.name })
        }
      }

      let warehouseId = purchase?.warehouseId ?? (await defaultWarehouseId(t, this.storeId))
      if (d.warehouseId) {
        const w = await t.warehouse.findFirst({ where: { id: d.warehouseId, storeId: this.storeId }, select: { id: true } })
        if (!w) throw new BadRequestError("Choose one of your warehouses", "VALIDATION_FAILED")
        warehouseId = w.id
      }
      const last = await t.supplierReturn.findFirst({ where: { storeId: this.storeId }, orderBy: { id: "desc" }, select: { number: true } })
      const number = returnNumber(last ? Number(/(\d+)$/.exec(last.number)?.[1] ?? 0) + 1 : 1)
      const total = round2(lines.reduce((s, l) => s + l.qty * l.unitCost, 0))
      const r = await t.supplierReturn.create({
        data: {
          storeId: this.storeId,
          number,
          supplierId: d.supplierId,
          purchaseId: purchase?.id ?? null,
          warehouseId,
          returnedOn: d.returnedOn,
          reason: d.reason.trim(),
          notes: blankToNull(d.notes),
          total,
          createdByAdminId: this.adminId,
          items: { create: lines.map((l) => ({ productId: l.productId, variantId: l.variantId, name: l.name, qty: l.qty, unitCost: l.unitCost, lineTotal: round2(l.qty * l.unitCost) })) },
        },
      })
      for (const l of lines) {
        try {
          await moveStock(t, {
            storeId: this.storeId,
            warehouseId,
            sku: { productId: l.productId, variantId: l.variantId },
            onHand: -l.qty,
            guard: "free",
            reason: "SUPPLIER_RETURN",
            ref: number,
            note: `${supplier.name} · ${d.reason.trim()}`,
            label: l.name,
          })
        } catch (e) {
          if (e instanceof BadRequestError) throw new BadRequestError(`Can't send back ${e.message}`, "VALIDATION_FAILED")
          throw e
        }
      }
      return r.id
    })
    return this.supplierReturn(id)
  }

  /** Cancels a return recorded by mistake: the units come back into stock and the credit goes. */
  async cancelReturn(id: bigint) {
    await tx(async (t: T) => {
      await t.$queryRaw`SELECT 1 FROM "SupplierReturn" WHERE "id" = ${id} AND "storeId" = ${this.storeId} FOR UPDATE`
      const r = await t.supplierReturn.findFirst({ where: { id, storeId: this.storeId }, include: { items: true } })
      if (!r) throw new NotFoundError("Return")
      if (r.status === "cancelled") throw new BadRequestError("This return is already cancelled", "VALIDATION_FAILED")
      for (const i of r.items) {
        await moveStock(t, {
          storeId: this.storeId,
          warehouseId: r.warehouseId,
          sku: { productId: i.productId, variantId: i.variantId },
          onHand: i.qty,
          reason: "SUPPLIER_RETURN_CANCELLED",
          ref: r.number,
        })
      }
      await t.supplierReturn.update({ where: { id }, data: { status: "cancelled", cancelledAt: new Date() } })
    })
    return this.supplierReturn(id)
  }
}
