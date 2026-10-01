/**
 * BANNED CUSTOMERS — staff ban a customer (fake orders, refused deliveries, abuse) with a reason.
 * A banned customer can't sign in (auth and phone-code sign-in check the status) or order: checkout
 * and landing pages refuse an order from their account, phone number or email.
 */
import { prisma } from "../../config"
import { BadRequestError, NotFoundError } from "../../core"
import { bdMobile, phoneVariants } from "../sms/sms.rules"
import { BANNED_MESSAGE, isBanned } from "./customer.rules"

/** Refuses an order from a banned customer: the signed-in one, or a guest using their phone/email. */
export async function assertCanOrder(storeId: bigint, who: { customerId?: bigint | null; phone?: string | null; email?: string | null }) {
  const or: { id?: bigint; phone?: { in: string[] }; email?: { equals: string; mode: "insensitive" } }[] = []
  if (who.customerId) or.push({ id: who.customerId })
  const phone = bdMobile(who.phone)
  if (phone) or.push({ phone: { in: phoneVariants(phone) } })
  if (who.email?.trim()) or.push({ email: { equals: who.email.trim(), mode: "insensitive" } })
  if (!or.length) return
  const rows = await prisma.customer.findMany({ where: { storeId, OR: or }, select: { status: true } })
  if (rows.some((r) => isBanned(r.status))) throw new BadRequestError(BANNED_MESSAGE, "CUSTOMER_BANNED")
}

export async function banCustomer(storeId: bigint, id: bigint, reason: string) {
  const c = await prisma.customer.findFirst({ where: { id, storeId }, select: { id: true } })
  if (!c) throw new NotFoundError("Customer")
  if (reason.trim().length < 3) throw new BadRequestError("Say why (staff see it on the customer)", "VALIDATION_FAILED")
  return prisma.customer.update({ where: { id }, data: { status: "banned", banReason: reason.trim(), bannedAt: new Date() } })
}

export async function unbanCustomer(storeId: bigint, id: bigint) {
  const c = await prisma.customer.findFirst({ where: { id, storeId }, select: { id: true } })
  if (!c) throw new NotFoundError("Customer")
  return prisma.customer.update({ where: { id }, data: { status: "active", banReason: null, bannedAt: null } })
}
