/**
 * EDIT AN ORDER — after the confirmation call the customer often wants another size, one more,
 * or a different address. Staff can change the delivery address and phone, the items (quantity,
 * remove, add; another size = remove and add) and the delivery charge, until a parcel is packed.
 * Stock held for the order follows the change; the timeline says what changed.
 *
 *   PUT /api/admin/orders/:id/edit
 */
import { z } from "zod"
import type { Prisma } from "@prisma/client"
import { prisma, tx } from "../../config"
import { BadRequestError, NotFoundError, type RequestContext } from "../../core"
import { defaultWarehouseId, moveStock } from "../stock"
import { StorefrontService, variantLabel } from "../storefront/storefront.service"
import { assertStaffStorefront, defaultStorefrontId } from "../storefronts/storefronts.context"
import { recordOrderRisk } from "./order-checks"
import { phoneKeyOf } from "./order-checks.rules"
import { editBlocker, editedTotals, newLineMoney, planEdit, scaleLine } from "./order-edit.rules"

const text = (max: number) => z.string().trim().max(max)

export const EditOrderDto = z
  .object({
    address: z
      .object({
        firstName: text(80).min(1),
        lastName: text(80).default(""),
        phone: text(20).min(10, "Enter the phone number"),
        addressLine1: text(255).min(3, "Enter the address"),
        addressLine2: text(255).optional(),
        division: text(80).optional(),
        district: text(80).min(1, "Choose the district"),
        upazila: text(80).optional(),
        postcode: text(20).optional(),
        locationId: z.coerce.bigint().positive().optional().nullable(),
      })
      .optional(),
    items: z
      .array(
        z.object({
          orderItemId: z.coerce.bigint().positive().optional().nullable(),
          productId: z.coerce.bigint().positive(),
          variantId: z.coerce.bigint().positive().optional().nullable(),
          quantity: z.coerce.number().int().min(1).max(100),
        }),
      )
      .max(100)
      .optional(),
    shippingTotal: z.coerce.number().min(0).max(100000).optional(),
    note: text(500).optional(),
  })
  .refine((v) => v.address || v.items || v.shippingTotal !== undefined, { message: "Nothing to change" })
export type EditOrderDto = z.infer<typeof EditOrderDto>

type T = Prisma.TransactionClient
const num = (d: Prisma.Decimal | number | null | undefined) => Number(d ?? 0)
const money = (n: number) => `৳${n.toLocaleString("en-IN")}`
const isGift = (meta: Prisma.JsonValue) => !!(meta && typeof meta === "object" && "gift" in (meta as object))

export class OrderEditService {
  constructor(private readonly ctx: RequestContext) {}

  private get storeId(): bigint {
    if (this.ctx.storeId === undefined) throw new BadRequestError("No store for this request", "STORE_REQUIRED")
    return BigInt(this.ctx.storeId)
  }

  async edit(id: bigint, dto: EditOrderDto) {
    const storeId = this.storeId
    const o = await prisma.order.findFirst({
      where: { id, storeId },
      include: { items: true, _count: { select: { refunds: true, returns: true } }, shipments: { where: { status: { not: "cancelled" } }, select: { id: true } } },
    })
    if (!o) throw new NotFoundError("Order", String(id))
    assertStaffStorefront(this.ctx, o.storefrontId ?? (await defaultStorefrontId(storeId)))
    const blocker = editBlocker({ status: o.status, parcels: o.shipments.length, refunds: o._count.refunds, returns: o._count.returns })
    if (blocker) throw new BadRequestError(blocker, "ORDER_STATUS_INVALID_TRANSITION")

    const changes: string[] = []
    const lines = o.items.filter((i) => !isGift(i.meta))
    const label = (i: { productName: string; variantValues: Prisma.JsonValue }) => `${i.productName}${variantLabel(i.variantValues) ? ` (${variantLabel(i.variantValues)})` : ""}`

    // Items: what stays, goes and is new, priced before the transaction.
    let plan: ReturnType<typeof planEdit> | null = null
    let added: Awaited<ReturnType<StorefrontService["quoteLines"]>> = []
    if (dto.items) {
      try {
        plan = planEdit(
          lines.map((i) => ({ id: String(i.id), productId: i.productId ? String(i.productId) : null, variantId: i.variantId ? String(i.variantId) : null, productName: i.productName, quantity: i.quantity })),
          dto.items.map((i) => ({ orderItemId: i.orderItemId ? String(i.orderItemId) : null, productId: String(i.productId), variantId: i.variantId ? String(i.variantId) : null, quantity: i.quantity })),
        )
      } catch (e) {
        throw new BadRequestError((e as Error).message, "VALIDATION_FAILED")
      }
      if (plan.add.length) {
        const shop = new StorefrontService({ ...this.ctx, storefrontId: o.storefrontId ?? undefined })
        added = await shop.quoteLines(
          plan.add.map((a) => ({ productId: BigInt(a.productId), variantId: a.variantId ? BigInt(a.variantId) : null, qty: a.quantity })),
          o.customerId,
        )
        const bad = added.find((q) => q.problem || !q.priced)
        if (bad) throw new BadRequestError(bad.problem?.message ?? "That item can't be added", bad.problem?.code ?? "CART_INVALID")
      }
    }

    const shippingTotal = dto.shippingTotal ?? num(o.shippingTotal)
    if (shippingTotal !== num(o.shippingTotal)) changes.push(`Delivery ${money(num(o.shippingTotal))} → ${money(shippingTotal)}`)
    const taxRate = num(o.taxRate)

    await tx(async (t: T) => {
      const warehouseId = o.warehouseId ?? (await defaultWarehouseId(t, storeId))
      const ref = o.number
      const hold = async (i: { productId: bigint | null; variantId: bigint | null; productName: string }, qty: number) =>
        i.productId
          ? (await moveStock(t, { storeId, warehouseId, sku: { productId: i.productId, variantId: i.variantId }, reserved: qty, guard: "available", reason: "ORDER_EDIT", ref, label: i.productName })).applied
          : false
      const release = async (i: { productId: bigint | null; variantId: bigint | null; productName: string }, qty: number) => {
        if (i.productId && qty > 0) await moveStock(t, { storeId, warehouseId, sku: { productId: i.productId, variantId: i.variantId }, reserved: -qty, reason: "ORDER_EDIT", ref, label: i.productName })
      }

      const before = lines.map((i) => ({ lineSubtotal: num(i.lineSubtotal), lineDiscount: num(i.lineDiscount), lineTax: num(i.lineTax), lineTotal: num(i.lineTotal) }))
      let after = before
      if (plan) {
        after = []
        for (const { line, quantity } of plan.keep) {
          const i = lines.find((x) => String(x.id) === line.id)!
          const m = scaleLine({ quantity: i.quantity, lineSubtotal: num(i.lineSubtotal), lineDiscount: num(i.lineDiscount), lineTax: num(i.lineTax), lineTotal: num(i.lineTotal) }, quantity)
          after.push(m)
          if (quantity === i.quantity) continue
          let reserved = i.qtyReserved
          if (quantity > i.quantity) {
            if (await hold(i, quantity - i.quantity)) reserved += quantity - i.quantity
          } else {
            const back = Math.min(i.quantity - quantity, i.qtyReserved)
            await release(i, back)
            reserved -= back
          }
          await t.orderItem.update({ where: { id: i.id }, data: { quantity, qtyReserved: reserved, ...m } })
          changes.push(`${label(i)}: ${i.quantity} → ${quantity}`)
        }
        for (const r of plan.remove) {
          const i = lines.find((x) => String(x.id) === r.id)!
          await release(i, i.qtyReserved)
          await t.orderItem.delete({ where: { id: i.id } })
          changes.push(`Removed ${label(i)} × ${i.quantity}`)
        }
        for (const q of added) {
          const p = q.priced!
          const m = newLineMoney(p.lineSubtotal, taxRate, o.pricesIncludeTax)
          after.push(m)
          const held = await hold({ productId: p.product.id, variantId: p.variant?.id ?? null, productName: p.product.name }, p.qty)
          await t.orderItem.create({
            data: {
              orderId: o.id,
              productId: p.product.id,
              variantId: p.variant?.id ?? null,
              productName: p.product.name,
              productSku: p.variant?.sku ?? p.product.sku,
              variantValues: (p.variant?.attributeValues as Prisma.InputJsonValue) ?? undefined,
              imageUrl: p.variant?.imageUrl ?? p.product.images[0]?.imageUrl ?? null,
              quantity: p.qty,
              qtyReserved: held ? p.qty : 0,
              unitPrice: p.unitPrice,
              unitCost: p.variant?.costPrice ?? p.product.costPrice ?? null,
              ...m,
            },
          })
          changes.push(`Added ${p.product.name}${p.variant ? ` (${variantLabel(p.variant.attributeValues)})` : ""} × ${p.qty}`)
        }
      }

      let totals: ReturnType<typeof editedTotals>
      try {
        totals = editedTotals(
          { itemsSubtotal: num(o.itemsSubtotal), discountTotal: num(o.discountTotal), taxTotal: num(o.taxTotal), shippingTotal: num(o.shippingTotal), grandTotal: num(o.grandTotal) },
          before,
          after,
          shippingTotal,
        )
      } catch (e) {
        throw new BadRequestError((e as Error).message, "VALIDATION_FAILED")
      }
      const oldTotal = num(o.grandTotal)
      if (totals.grandTotal !== oldTotal) changes.push(`Total ${money(oldTotal)} → ${money(totals.grandTotal)}`)
      // Paid online and it went up: the rest is still to pay; it went down: the difference is to refund.
      const paid = o.paymentStatus === "paid"
      if (paid && totals.grandTotal < oldTotal) changes.push(`${money(Math.round((oldTotal - totals.grandTotal) * 100) / 100)} to refund`)

      const a = dto.address
      if (a) {
        const was = `${o.shippingFirstName ?? o.billingFirstName}, ${o.shippingAddress1 ?? o.billingAddress1}, ${o.shippingCity ?? o.billingCity}, ${o.shippingPhone ?? o.billingPhone}`
        const now = `${a.firstName}, ${a.addressLine1}, ${a.district}, ${a.phone}`
        if (was !== now) changes.push(`Address: ${was} → ${now}`)
      }
      if (!changes.length) throw new BadRequestError("Nothing changed", "VALIDATION_FAILED")

      const ship = a
        ? {
            shippingFirstName: a.firstName,
            shippingLastName: a.lastName,
            shippingAddress1: a.addressLine1,
            shippingAddress2: a.addressLine2 || null,
            shippingCity: a.district,
            shippingState: a.division || null,
            shippingUpazila: a.upazila || null,
            shippingPostcode: a.postcode || null,
            // The picked area stays unless a new one is given or the district/upazila text changed.
            ...(a.locationId !== undefined
              ? { shippingLocationId: a.locationId }
              : a.district !== (o.shippingCity ?? o.billingCity) || (a.upazila || null) !== (o.shippingUpazila ?? o.billingUpazila)
                ? { shippingLocationId: null }
                : {}),
            shippingPhone: a.phone,
            // The same person and place for the bill too, when they were the same.
            ...(o.shippingSameAsBilling
              ? { billingFirstName: a.firstName, billingLastName: a.lastName, billingAddress1: a.addressLine1, billingAddress2: a.addressLine2 || null, billingCity: a.district, billingState: a.division || null, billingUpazila: a.upazila || null, billingPostcode: a.postcode || null, billingPhone: a.phone }
              : {}),
            phoneKey: phoneKeyOf({ shippingPhone: a.phone, billingPhone: o.billingPhone }),
          }
        : {}
      await t.order.update({
        where: { id: o.id },
        data: { ...totals, ...ship, ...(paid && totals.grandTotal > oldTotal + 0.009 ? { paymentStatus: "partially_paid" } : {}) },
      })
      await t.orderStatusLog.create({
        data: { orderId: o.id, status: o.status, note: `Edited: ${changes.join("; ")}${dto.note ? `. ${dto.note}` : ""}`.slice(0, 2000), adminId: this.ctx.admin?.id ? BigInt(this.ctx.admin.id) : null },
      })
    })
    // A new phone number has its own delivery record.
    if (dto.address && phoneKeyOf({ shippingPhone: dto.address.phone, billingPhone: o.billingPhone }) !== o.phoneKey) await recordOrderRisk(storeId, o.id)
    return { changes }
  }
}
