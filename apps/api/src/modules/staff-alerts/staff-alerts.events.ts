/**
 * Team alerts that follow order events: "new order" for orders customers place, and
 * "low stock" when an order takes a product down to its low-stock level.
 */
import { EventName } from "@ecom/shared-types"
import { eventBus } from "../../core"
import { prisma } from "../../config"
import type { OrderPlacedEvent } from "../notifications/notifications.events"
import { alertStaff } from "./staff-alerts.service"

const taka = (v: unknown) => {
  const n = Number(v ?? 0)
  const digits = Number.isInteger(n) ? 0 : 2
  return `৳${n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`
}

/** The "new order" alert for an order a customer placed. */
export async function newOrderAlert(storeId: bigint, orderId: bigint) {
  const o = await prisma.order.findFirst({
    where: { id: orderId, storeId },
    select: { number: true, grandTotal: true, paymentGatewayCode: true, billingFirstName: true, billingLastName: true, _count: { select: { items: true } } },
  })
  if (!o) return
  const who = `${o.billingFirstName ?? ""} ${o.billingLastName ?? ""}`.trim() || "A customer"
  await alertStaff(storeId, "new_order", {
    title: `New order ${o.number} · ${taka(o.grandTotal)}`,
    body: `${who}, ${o._count.items} item${o._count.items === 1 ? "" : "s"}, paying by ${o.paymentGatewayCode.replace(/_/g, " ")}.`,
    link: `/orders/${orderId}`,
    refKey: `order:${orderId}`,
  })
}

/** "Low stock" for each product in the order now at or below its low-stock level (once a day each). */
export async function lowStockAlerts(storeId: bigint, orderId: bigint) {
  const items = await prisma.orderItem.findMany({
    where: { orderId, productId: { not: null } },
    select: {
      product: { select: { id: true, name: true, manageStock: true, stockQty: true, reservedStock: true, lowStockThreshold: true } },
      variant: { select: { id: true, stockQty: true, reservedStock: true, lowStockThreshold: true, attributeValues: true } },
    },
  })
  for (const it of items) {
    const p = it.product
    if (!p?.manageStock) continue
    const v = it.variant
    const left = Math.max(0, Number((v ? v.stockQty : p.stockQty) ?? 0) - Number((v ? v.reservedStock : p.reservedStock) ?? 0))
    const level = (v ? v.lowStockThreshold : null) ?? p.lowStockThreshold ?? 5
    if (left > level) continue
    const option = v ? Object.values((v.attributeValues ?? {}) as Record<string, string>).join(" / ") : ""
    const name = option ? `${p.name} (${option})` : p.name
    await alertStaff(storeId, "low_stock", {
      title: left === 0 ? `Out of stock: ${name}` : `Low stock: ${name}, ${left} left`,
      body: `Low-stock level is ${level}. Order more or hide it from the shop.`,
      link: `/catalog/products/${p.id}`,
      refKey: `stock:${p.id}:${v?.id ?? ""}`,
      onceWithinHours: 24,
    })
  }
}

let registered = false

export function registerStaffAlertListeners() {
  if (registered) return
  registered = true
  eventBus.on(EventName.ORDER_PLACED, async (p) => {
    const e = p as OrderPlacedEvent
    const storeId = BigInt(e.storeId)
    const orderId = BigInt(e.orderId)
    if (e.notifyStaff !== false) await newOrderAlert(storeId, orderId)
    await lowStockAlerts(storeId, orderId)
  })
}
