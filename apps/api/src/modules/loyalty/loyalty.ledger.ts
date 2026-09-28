/**
 * LOYALTY LEDGER — the wallet and the order hooks other modules call inside their transactions:
 *   walletMove            the only code that changes a wallet balance (Customer.storeCredit)
 *   checkoutLoyalty       level discount, wallet balance and settings for pricing an order
 *   onOrderPlaced         takes the wallet part, links a referred customer's first order
 *   onOrderDelivered      cashback, referral rewards, spend and level
 *   onOrderRefunded       takes back the refunded share of the cashback
 *   onOrderClosed         cancelled / refunded / failed: wallet part back, cashback back, referral freed
 * Rules are in loyalty.rules.ts.
 */
import { Prisma } from "@prisma/client"
import { BadRequestError } from "../../core"
import {
  cashbackFor,
  cashbackToReverse,
  levelFor,
  orderSpend,
  type CashbackSettings,
} from "./loyalty.rules"

type T = Prisma.TransactionClient
const n = (v: unknown) => (v === null || v === undefined ? 0 : Number(v))
const r2 = (v: number) => Math.round(v * 100) / 100

export type WalletKind =
  | "cashback"
  | "cashback_reversed"
  | "order_payment"
  | "order_payment_returned"
  | "refund"
  | "referral"
  | "adjustment"

/**
 * Adds (+) or takes (−) money from a customer's wallet and records it. A debit that would take the
 * balance below zero is refused unless `upTo` is set, which takes what's there (for take-backs).
 * Returns the amount actually moved.
 */
export async function walletMove(
  t: T,
  m: {
    storeId: bigint
    customerId: bigint
    amount: number
    kind: WalletKind
    orderId?: bigint | null
    note?: string | null
    adminId?: bigint | null
    upTo?: boolean
  },
): Promise<number> {
  let amount = r2(m.amount)
  if (!amount) return 0
  if (amount < 0 && m.upTo) {
    const c = await t.customer.findFirst({
      where: { id: m.customerId, storeId: m.storeId },
      select: { storeCredit: true },
    })
    amount = -Math.min(-amount, Math.max(0, n(c?.storeCredit)))
    if (!amount) return 0
  }
  // Sent as an exact decimal: a float here makes "spend the whole balance" miss zero by a hair.
  const exact = amount.toFixed(2)
  const rows = await t.$queryRaw<{ storeCredit: Prisma.Decimal }[]>`
    UPDATE "Customer" SET "storeCredit" = "storeCredit" + ${exact}::numeric
    WHERE "id" = ${m.customerId} AND "storeId" = ${m.storeId} AND "storeCredit" + ${exact}::numeric >= 0
    RETURNING "storeCredit"`
  if (!rows.length)
    throw new BadRequestError("There isn't enough in the wallet for that", "VALIDATION_FAILED")
  await t.walletTransaction.create({
    data: {
      storeId: m.storeId,
      customerId: m.customerId,
      amount,
      kind: m.kind,
      orderId: m.orderId ?? null,
      note: m.note ?? null,
      balanceAfter: rows[0]!.storeCredit,
      createdByAdminId: m.adminId ?? null,
    },
  })
  return amount
}

export async function loyaltySettings(t: T, storeId: bigint) {
  const s = await t.loyaltySettings.findUnique({ where: { storeId } })
  return (
    s ?? (await t.loyaltySettings.upsert({ where: { storeId }, create: { storeId }, update: {} }))
  )
}

const cashbackSettings = (s: Awaited<ReturnType<typeof loyaltySettings>>): CashbackSettings => ({
  enabled: s.cashbackEnabled,
  percent: n(s.cashbackPercent),
  minOrder: n(s.cashbackMinOrder),
  maxPerOrder: s.cashbackMaxPerOrder === null ? null : n(s.cashbackMaxPerOrder),
})

/** What pricing an order for this customer needs: their level (when levels are on) and wallet. */
export async function checkoutLoyalty(
  t: T,
  storeId: bigint,
  customerId: bigint | null | undefined,
) {
  const settings = await loyaltySettings(t, storeId)
  if (!customerId) return { settings, level: null, balance: 0 }
  const c = await t.customer.findFirst({
    where: { id: customerId, storeId },
    select: { storeCredit: true, loyaltyLevel: true },
  })
  const level = settings.levelsEnabled && c?.loyaltyLevel ? c.loyaltyLevel : null
  return {
    settings,
    level: level
      ? {
          name: level.name,
          discountPercent: n(level.discountPercent),
          cashbackPercent: n(level.cashbackPercent),
        }
      : null,
    balance: settings.walletEnabled ? n(c?.storeCredit) : 0,
  }
}

/** Re-derives a customer's spend on delivered orders and the level it reaches. */
export async function refreshCustomerLevel(t: T, storeId: bigint, customerId: bigint) {
  const orders = await t.order.findMany({
    where: { storeId, customerId, status: { in: ["DELIVERED", "COMPLETED"] } },
    select: { itemsSubtotal: true, discountTotal: true, refundedTotal: true },
  })
  const spend = r2(
    orders.reduce(
      (a, o) => a + orderSpend(n(o.itemsSubtotal), n(o.discountTotal), n(o.refundedTotal)),
      0,
    ),
  )
  const levels = await t.loyaltyLevel.findMany({
    where: { storeId },
    select: { id: true, minSpend: true },
  })
  const level = levelFor(
    spend,
    levels.map((l) => ({ id: l.id, minSpend: n(l.minSpend) })),
  )
  await t.customer.update({
    where: { id: customerId },
    data: { qualifyingSpend: spend, loyaltyLevelId: level?.id ?? null },
  })
  return { spend, levelId: level?.id ?? null }
}

/**
 * A new order: takes the wallet part out of the wallet (refused if the balance changed meanwhile),
 * and links a referred customer's first qualifying order to their referral.
 */
export async function onOrderPlaced(
  t: T,
  storeId: bigint,
  o: {
    id: bigint
    number: string
    customerId: bigint | null
    walletUsed: number
    itemsNet: number
  },
) {
  if (!o.customerId) return
  if (o.walletUsed > 0) {
    try {
      await walletMove(t, {
        storeId,
        customerId: o.customerId,
        amount: -o.walletUsed,
        kind: "order_payment",
        orderId: o.id,
        note: `Paid towards order ${o.number}`,
      })
    } catch {
      throw new BadRequestError(
        "Your wallet balance changed. Please review the order and try again",
        "CART_INVALID",
      )
    }
  }
  const settings = await loyaltySettings(t, storeId)
  if (!settings.referralEnabled || o.itemsNet < n(settings.referralMinOrder)) return
  await t.affiliateReferral.updateMany({
    where: {
      referredCustomerId: o.customerId,
      orderId: null,
      status: "signed_up",
      affiliate: { storeId },
    },
    data: { orderId: o.id, status: "ordered" },
  })
}

/** Delivered: cashback, the referral rewards on a friend's first order, and the customer's level. */
export async function onOrderDelivered(t: T, storeId: bigint, orderId: bigint) {
  const o = await t.order.findFirst({
    where: { id: orderId, storeId },
    select: {
      id: true,
      number: true,
      customerId: true,
      itemsSubtotal: true,
      discountTotal: true,
      refundedTotal: true,
      cashbackAt: true,
      customer: {
        select: { firstName: true, loyaltyLevel: { select: { cashbackPercent: true } } },
      },
    },
  })
  if (!o?.customerId) return
  const settings = await loyaltySettings(t, storeId)
  const itemsNet = orderSpend(n(o.itemsSubtotal), n(o.discountTotal), n(o.refundedTotal))

  if (!o.cashbackAt) {
    const levelPct = settings.levelsEnabled ? n(o.customer?.loyaltyLevel?.cashbackPercent) : 0
    const cashback = cashbackFor(itemsNet, cashbackSettings(settings), levelPct)
    if (cashback > 0) {
      await walletMove(t, {
        storeId,
        customerId: o.customerId,
        amount: cashback,
        kind: "cashback",
        orderId: o.id,
        note: `Cashback on order ${o.number}`,
      })
    }
    await t.order.update({
      where: { id: o.id },
      data: { cashbackAmount: cashback, cashbackAt: new Date() },
    })
  }

  // Refer a friend: both get their reward when the friend's first order is delivered.
  const ref = await t.affiliateReferral.findFirst({
    where: { orderId: o.id, status: "ordered", affiliate: { storeId } },
    include: {
      affiliate: {
        select: { id: true, customerId: true, customer: { select: { firstName: true } } },
      },
    },
  })
  if (ref && settings.referralEnabled) {
    const toReferrer = n(settings.referrerReward)
    const toFriend = n(settings.refereeReward)
    if (toReferrer > 0)
      await walletMove(t, {
        storeId,
        customerId: ref.affiliate.customerId,
        amount: toReferrer,
        kind: "referral",
        orderId: o.id,
        note: `${o.customer?.firstName ?? "A friend"} you referred got their first order`,
      })
    if (toFriend > 0)
      await walletMove(t, {
        storeId,
        customerId: o.customerId,
        amount: toFriend,
        kind: "referral",
        orderId: o.id,
        note: `Welcome reward from ${ref.affiliate.customer.firstName}'s invite`,
      })
    await t.affiliateReferral.update({
      where: { id: ref.id },
      data: { status: "rewarded", commission: toReferrer, convertedAt: new Date() },
    })
    await t.affiliate.update({
      where: { id: ref.affiliate.id },
      data: { totalEarned: { increment: toReferrer }, totalPaid: { increment: toReferrer } },
    })
  }

  await refreshCustomerLevel(t, storeId, o.customerId)
}

/** A refund on a delivered order takes back the same share of its cashback. */
export async function onOrderRefunded(
  t: T,
  storeId: bigint,
  orderId: bigint,
  refunded: number,
  itemsNetBefore: number,
) {
  const o = await t.order.findFirst({
    where: { id: orderId, storeId },
    select: {
      id: true,
      number: true,
      customerId: true,
      cashbackAmount: true,
      cashbackAt: true,
      status: true,
    },
  })
  if (!o?.customerId) return
  if (o.cashbackAt && n(o.cashbackAmount) > 0) {
    const back = cashbackToReverse(n(o.cashbackAmount), itemsNetBefore, refunded)
    if (back > 0) {
      // Take back what's still in the wallet; cashback already spent stays with the customer.
      await walletMove(t, {
        storeId,
        customerId: o.customerId,
        amount: -back,
        kind: "cashback_reversed",
        orderId: o.id,
        note: `Refund on order ${o.number}`,
        upTo: true,
      })
      await t.order.update({ where: { id: o.id }, data: { cashbackAmount: { decrement: back } } })
    }
  }
  if (["DELIVERED", "COMPLETED", "REFUNDED"].includes(o.status))
    await refreshCustomerLevel(t, storeId, o.customerId)
}

/**
 * An order closing: the wallet part goes back (once), any cashback left is taken back, and a
 * referral waiting on this order can count on the customer's next one.
 */
export async function onOrderClosed(t: T, storeId: bigint, orderId: bigint) {
  const o = await t.order.findFirst({
    where: { id: orderId, storeId },
    select: { id: true, number: true, customerId: true, walletUsed: true, cashbackAmount: true },
  })
  if (!o?.customerId) return
  if (n(o.walletUsed) > 0) {
    const already = await t.walletTransaction.count({
      where: { orderId: o.id, kind: "order_payment_returned" },
    })
    if (!already)
      await walletMove(t, {
        storeId,
        customerId: o.customerId,
        amount: n(o.walletUsed),
        kind: "order_payment_returned",
        orderId: o.id,
        note: `Order ${o.number} closed`,
      })
  }
  if (n(o.cashbackAmount) > 0) {
    await walletMove(t, {
      storeId,
      customerId: o.customerId,
      amount: -n(o.cashbackAmount),
      kind: "cashback_reversed",
      orderId: o.id,
      note: `Order ${o.number} closed`,
      upTo: true,
    })
    await t.order.update({ where: { id: o.id }, data: { cashbackAmount: 0 } })
  }
  await t.affiliateReferral.updateMany({
    where: { orderId: o.id, status: "ordered" },
    data: { orderId: null, status: "signed_up" },
  })
  await refreshCustomerLevel(t, storeId, o.customerId)
}
