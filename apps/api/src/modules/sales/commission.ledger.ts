/**
 * COMMISSION LEDGER — credits an order to a salesperson and records their commission on it.
 *
 *   creditOrder       set (or clear) an order's salesperson and work out the commission then
 *   salespersonByCode the salesperson behind a share-link code (?sp=CODE)
 *   salesSettings     the store's commission settings (off until switched on)
 *
 * Whether a commission is earned is read from the order each time (commission.rules.ts).
 */
import type { Prisma } from "@prisma/client"
import { prisma } from "../../config"
import { BadRequestError, NotFoundError } from "../../core"
import { commissionLines, rateFor } from "./commission.rules"

type T = Prisma.TransactionClient | typeof prisma
const n = (v: Prisma.Decimal | number | null | undefined) => (v === null || v === undefined ? null : Number(v))

export async function salesSettings(t: T, storeId: bigint) {
  const row = await t.salesSettings.findUnique({ where: { storeId } })
  return { enabled: row?.enabled ?? false, defaultRate: n(row?.defaultRate) ?? 0 }
}

/** An active salesperson of the store by share-link code, or null. */
export async function salespersonByCode(t: T, storeId: bigint, code: string | null | undefined): Promise<bigint | null> {
  const c = (code ?? "").trim().toUpperCase()
  if (!c) return null
  const row = await t.adminUser.findFirst({
    where: { storeId, salesCode: c, isSalesperson: true, status: "active" },
    select: { id: true },
  })
  return row?.id ?? null
}

/**
 * Credits the order to `salespersonId` (null: to nobody) and records their commission with the
 * rates as they are now. Refused once the commission was paid out.
 */
export async function creditOrder(t: T, storeId: bigint, orderId: bigint, salespersonId: bigint | null) {
  const order = await t.order.findFirst({
    where: { id: orderId, storeId },
    select: {
      id: true,
      discountTotal: true,
      commission: { select: { paidOutAt: true } },
      items: {
        select: {
          productName: true,
          lineSubtotal: true,
          product: {
            select: {
              commissionRate: true,
              categories: { select: { primary: true, category: { select: { commissionRate: true } } } },
            },
          },
        },
      },
    },
  })
  if (!order) throw new NotFoundError("Order", String(orderId))
  if (order.commission?.paidOutAt) throw new BadRequestError("The commission on this order was already paid out", "VALIDATION_FAILED")

  if (salespersonId === null) {
    await t.salesCommission.deleteMany({ where: { orderId } })
    await t.order.update({ where: { id: orderId }, data: { salespersonId: null } })
    return null
  }
  const person = await t.adminUser.findFirst({
    where: { id: salespersonId, storeId, isSalesperson: true },
    select: { id: true, commissionExtraPct: true },
  })
  if (!person) throw new BadRequestError("Pick someone on the sales team", "VALIDATION_FAILED")
  await t.order.update({ where: { id: orderId }, data: { salespersonId } })

  const settings = await salesSettings(t, storeId)
  if (!settings.enabled) {
    await t.salesCommission.deleteMany({ where: { orderId } })
    return null
  }
  const extraPct = n(person.commissionExtraPct) ?? 0
  const lines = order.items.map((i) => {
    const cats = [...(i.product?.categories ?? [])].sort((a, b) => Number(b.primary) - Number(a.primary))
    const r = rateFor({
      productRate: n(i.product?.commissionRate),
      categoryRates: cats.map((c) => n(c.category.commissionRate)),
      defaultRate: settings.defaultRate,
      extraPct,
    })
    return { name: i.productName, subtotal: Number(i.lineSubtotal), rate: r.rate, source: r.source }
  })
  const c = commissionLines(lines, Number(order.discountTotal))
  const data = {
    salespersonId,
    base: c.base,
    amount: c.amount,
    lines: c.lines as unknown as Prisma.InputJsonValue,
  }
  return t.salesCommission.upsert({
    where: { orderId },
    create: { storeId, orderId, ...data },
    update: data,
  })
}
