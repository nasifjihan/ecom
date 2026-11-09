/**
 * Abandoned-cart reminders (Marketing > Abandoned carts). Every few minutes, for each store that
 * turned them on: a saved cart with items and a phone or email, not ordered and untouched for the
 * shop's wait, gets one reminder (SMS and/or email) with a link back to it; optionally a second one
 * later, with a coupon. Reminders are claimed before sending, so none goes out twice.
 */
import { randomBytes } from "node:crypto"
import { prisma, logger } from "../../config"
import { logSystem } from "../team/audit"
import { bdMobile } from "../sms/sms.rules"
import {
  DEFAULT_REMINDER_SETTINGS,
  KEEP_CARTS_DAYS,
  REMIND_WITHIN_DAYS,
  canSendNow,
  cartSummary,
  type ReminderSettings,
} from "./cart-reminders.rules"

const BATCH = 200
const money = (n: number) => `৳${Math.round(n).toLocaleString("en-IN")}`

export async function reminderSettings(storeId: bigint): Promise<ReminderSettings> {
  const row = await prisma.cartReminderSettings.findUnique({ where: { storeId } })
  return row
    ? { enabled: row.enabled, firstDelayMinutes: row.firstDelayMinutes, secondEnabled: row.secondEnabled, secondDelayHours: row.secondDelayHours, couponCode: row.couponCode, sms: row.sms, email: row.email }
    : DEFAULT_REMINDER_SETTINGS
}

async function services(storeId: bigint) {
  const [{ EmailService }, { SmsService }] = await Promise.all([import("../notifications/notifications.service"), import("../sms/sms.service")])
  const email = new EmailService(storeId)
  return { email, sms: new SmsService(storeId), storefront: (await email.urls()).storefront }
}

/** Sends one reminder for a cart; returns false when there was nobody to send to. */
async function send(
  storeId: bigint,
  stage: 1 | 2,
  s: ReminderSettings,
  a: { recoveryToken: string; phone: string | null; customerEmail: string | null; firstName: string | null; totalAmount: number; names: string[] },
  how: { sms: boolean; email: boolean },
) {
  const svc = await services(storeId)
  const url = `${svc.storefront}/cart/recover/${a.recoveryToken}`
  const items = cartSummary(a.names)
  const coupon = stage === 2 && s.couponCode ? s.couponCode : ""
  if (how.sms && a.phone)
    await svc.sms.cartReminder(a.phone, stage, { name: a.firstName || "there", product: items, link: url, coupon: coupon ? ` Use code ${coupon} for a discount.` : "" })
  if (how.email && a.customerEmail)
    await svc.email.cartReminder(a.customerEmail, stage, {
      firstName: a.firstName ?? "",
      items,
      total: money(a.totalAmount),
      url,
      unsubscribeUrl: `${svc.storefront}/cart/unsubscribe/${a.recoveryToken}`,
      coupon: coupon ? `Use code **${coupon}** at checkout for a discount.` : "",
    })
}

async function optedOut(storeId: bigint, contacts: (string | null)[]) {
  const list = contacts.filter((c): c is string => !!c)
  return list.length > 0 && (await prisma.reminderOptOut.count({ where: { storeId, contact: { in: list } } })) > 0
}

/** One pass for one store. Returns how many reminders went out. */
export async function remindStore(storeId: bigint, now = new Date()) {
  const s = await reminderSettings(storeId)
  if (!s.enabled) return { first: 0, second: 0 }
  let first = 0
  let second = 0

  // First reminders: carts quiet for the shop's wait (but not older than a week), not yet reminded.
  const carts = await prisma.cart.findMany({
    where: {
      storeId,
      orderedAt: null,
      lastActivityAt: { lte: new Date(now.getTime() - s.firstDelayMinutes * 60_000), gte: new Date(now.getTime() - REMIND_WITHIN_DAYS * 86_400_000) },
      items: { some: {} },
      OR: [{ abandoned: null }, { abandoned: { reminderSentAt: null } }],
    },
    take: BATCH,
    include: {
      customer: { select: { firstName: true, email: true, phone: true } },
      items: { select: { quantity: true, lineTotal: true, product: { select: { name: true } } } },
    },
  })
  for (const c of carts) {
    const phone = bdMobile(c.phone ?? c.customer?.phone ?? "") ?? null
    const email = c.email ?? c.customer?.email ?? null
    const how = canSendNow(s, { phone, email }, now)
    if (!how.send || (await optedOut(storeId, [phone, email]))) continue
    const total = c.items.reduce((n, i) => n + Number(i.lineTotal), 0)
    const a = await prisma.abandonedCart.upsert({
      where: { cartId: c.id },
      create: {
        storeId,
        cartId: c.id,
        recoveryToken: randomBytes(18).toString("base64url"),
        recoveryUrl: "",
        customerEmail: email,
        phone,
        firstName: c.firstName ?? c.customer?.firstName ?? null,
        totalAmount: total,
      },
      update: { customerEmail: email, phone, totalAmount: total },
    })
    // Claim it: only the process that sets reminderSentAt sends.
    const claimed = await prisma.abandonedCart.updateMany({ where: { id: a.id, reminderSentAt: null }, data: { reminderSentAt: now, reminderSentCount: 1, recoveryUrl: `/cart/recover/${a.recoveryToken}` } })
    if (!claimed.count) continue
    try {
      await send(storeId, 1, s, { ...a, phone, customerEmail: email, totalAmount: total, names: c.items.map((i) => i.product.name) }, how)
      first++
    } catch (err) {
      logger.error({ err, cartId: String(c.id) }, "Cart reminder failed")
    }
  }

  // Second reminders, with the coupon: reminded long enough ago, still not ordered or back.
  if (s.secondEnabled) {
    const due = await prisma.abandonedCart.findMany({
      where: {
        storeId,
        reminderSentAt: { lte: new Date(now.getTime() - s.secondDelayHours * 3600_000) },
        reminder2SentAt: null,
        recoveredAt: null,
        cart: { orderedAt: null, items: { some: {} } },
      },
      take: BATCH,
      include: { cart: { select: { lastActivityAt: true, items: { select: { product: { select: { name: true } } } } } } },
    })
    for (const a of due) {
      // The shopper came back after the first reminder: they've seen it, no second one.
      if (a.reminderSentAt && a.cart.lastActivityAt > a.reminderSentAt) continue
      const how = canSendNow(s, { phone: a.phone, email: a.customerEmail }, now)
      if (!how.send || (await optedOut(storeId, [a.phone, a.customerEmail]))) continue
      const claimed = await prisma.abandonedCart.updateMany({ where: { id: a.id, reminder2SentAt: null }, data: { reminder2SentAt: now, reminderSentCount: 2 } })
      if (!claimed.count) continue
      try {
        await send(storeId, 2, s, { ...a, totalAmount: Number(a.totalAmount), names: a.cart.items.map((i) => i.product.name) }, how)
        second++
      } catch (err) {
        logger.error({ err, abandonedId: String(a.id) }, "Second cart reminder failed")
      }
    }
  }
  if (first || second) logSystem(storeId, { by: "Cart reminders", action: "cart_reminders.sent", objectType: "abandoned_carts", objectId: "", details: { first, second } })
  return { first, second }
}

/** The scheduled pass over every store, plus clearing out carts nobody touched for two months. */
export async function runCartReminders(now = new Date()) {
  const stores = await prisma.cartReminderSettings.findMany({ where: { enabled: true }, select: { storeId: true } })
  let sent = 0
  for (const { storeId } of stores) {
    const r = await remindStore(storeId, now)
    sent += r.first + r.second
  }
  const old = new Date(now.getTime() - KEEP_CARTS_DAYS * 86_400_000)
  const { count: removed } = await prisma.cart.deleteMany({ where: { lastActivityAt: { lt: old }, OR: [{ orderedAt: null }, { orderedAt: { lt: old } }] } })
  return { sent, removed }
}
