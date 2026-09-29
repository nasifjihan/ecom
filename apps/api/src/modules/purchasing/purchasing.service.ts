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
    const [bought, paid] = await Promise.all([
      prisma.purchase.groupBy({
        by: ["supplierId"],
        where: { ...where, status: "received" },
        _sum: { total: true },
        _count: true,
      }),
      prisma.supplierPayment.groupBy({ by: ["supplierId"], where, _sum: { amount: true } }),
    ])
    return (id: bigint) => {
      const b = bought.find((x) => x.supplierId === id)
      const p = paid.find((x) => x.supplierId === id)
      return { purchased: num(b?._sum.total), purchases: b?._count ?? 0, paid: num(p?._sum.amount) }
    }
  }

  private supplierView(
    s: Prisma.SupplierGetPayload<object>,
    t: { purchased: number; purchases: number; paid: number },
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
      /** What the shop owes them now (negative = paid ahead). */
      balance: supplierBalance(num(s.openingBalance), t.purchased, t.paid),
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
    const [totals, purchases, payments] = await Promise.all([
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
    ])
    return {
      ...this.supplierView(s, totals(id)),
      purchaseList: purchases.map((p) => ({
        id: String(p.id),
        number: p.number,
        purchasedOn: day(p.purchasedOn),
        reference: p.reference,
        total: num(p.total),
        status: p.status,
        paymentTerm: p.paymentTerm,
      })),
      paymentList: payments.map((p) => this.paymentView(p)),
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
    const [p, pay] = await Promise.all([
      prisma.purchase.count({ where: { supplierId: id } }),
      prisma.supplierPayment.count({ where: { supplierId: id } }),
    ])
    if (p || pay)
      throw new ConflictError(
        "This supplier has purchases or payments. Turn them off instead of deleting.",
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
      prisma.purchase.aggregate({ where: { ...where, status: "received" }, _sum: { total: true } }),
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
        paid: round2(p.payments.reduce((s, x) => s + num(x.amount), 0)),
        paymentTerm: p.paymentTerm,
        status: p.status,
      })),
      meta: {
        page: q.page,
        perPage: q.perPage,
        total,
        totalPages: Math.max(1, Math.ceil(total / q.perPage)),
        totalValue: num(sum._sum.total),
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
        unitCost: num(i.unitCost),
        discountPct: num(i.discountPct),
        discountAmount: num(i.discountAmount),
        lineTotal: num(i.lineTotal),
        landedUnitCost: num(i.landedUnitCost),
      })),
      payments: p.payments.map((x) => this.paymentView(x)),
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
    const pay = payNowFor(d.paymentTerm, totals.total, d.payNow)
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
          notes: blankToNull(d.notes),
          createdByAdminId: this.adminId,
          items: {
            create: lines.map((l) => ({
              productId: l.productId,
              variantId: l.variantId ?? null,
              name: l.name,
              qualityGrade: blankToNull(l.qualityGrade),
              qty: l.qty,
              unitCost: l.unitCost,
              discountPct: l.discountPct ?? 0,
              discountAmount: l.discountAmount ?? 0,
              lineTotal: l.lineTotal,
              landedUnitCost: l.landed,
            })),
          },
        },
      })

      // Receive the stock and move the cost price to the new average, line by line (a product can
      // appear twice, so each line reads the stock the previous one left).
      for (const l of lines) {
        const row = l.variant
          ? await t.productVariant.findUniqueOrThrow({
              where: { id: l.variant.id },
              select: { stockQty: true, costPrice: true },
            })
          : await t.product.findUniqueOrThrow({
              where: { id: l.productId },
              select: { stockQty: true, costPrice: true },
            })
        const before = row.stockQty ?? 0
        const cost = averageCost(
          before,
          row.costPrice === null ? null : num(row.costPrice),
          l.qty,
          l.landed,
        )
        const data = { costPrice: cost }
        if (l.variant) await t.productVariant.update({ where: { id: l.variant.id }, data })
        else await t.product.update({ where: { id: l.productId }, data })
        await moveStock(t, {
          storeId: this.storeId,
          warehouseId,
          sku: { productId: l.productId, variantId: l.variant?.id ?? null },
          onHand: l.qty,
          reason: "PURCHASE",
          ref: number,
          note: `${supplier.name}${d.reference ? ` · ${d.reference}` : ""}`,
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
          notes: `With purchase ${number}`,
        })
      }
      return purchase.id
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
      for (const i of p.items) {
        try {
          await moveStock(t, {
            storeId: this.storeId,
            warehouseId,
            sku: { productId: i.productId, variantId: i.variantId },
            onHand: -i.qty,
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
        data: { status: "cancelled", cancelledAt: new Date() },
      })
    })
    return this.purchase(id)
  }
}
