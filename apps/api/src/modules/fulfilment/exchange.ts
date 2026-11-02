/**
 * EXCHANGES — a return where the customer gets another size or colour instead of money.
 * When staff approve it, a replacement order is made for the new variants. It goes through the
 * usual packing, courier and stock steps. The returned items' value comes off it: the customer
 * pays only what the new items cost on top (plus the shop's exchange delivery fee), and if they
 * cost less, the rest is left on the return to refund.
 */
import { prisma } from "../../config"
import { BadRequestError, type RequestContext } from "../../core"
import { StorefrontService } from "../storefront/storefront.service"
import { orderCheckSettings } from "../orders/order-checks"
import { emitOrderPlaced } from "../notifications"

const r2 = (n: number) => Math.round(n * 100) / 100

/** What an exchange leaves: the credit used on the replacement and what is still to refund. */
export function exchangeSplit(credit: number, replacementItems: number) {
  const used = r2(Math.min(credit, replacementItems))
  return { used, toRefund: r2(credit - used) }
}

/** Checks each item's new variant: another option of the same product. */
export async function checkExchangeVariants(storeId: bigint, items: { productId: bigint | null; variantId: bigint | null; productName: string; exchangeVariantId?: bigint | null }[]) {
  for (const i of items) {
    if (!i.exchangeVariantId) throw new BadRequestError(`Choose the size or colour to send instead of "${i.productName}"`, "VALIDATION_FAILED")
    if (i.exchangeVariantId === i.variantId) throw new BadRequestError(`Choose a different option for "${i.productName}"`, "VALIDATION_FAILED")
    const v = i.productId ? await prisma.productVariant.findFirst({ where: { id: i.exchangeVariantId, productId: i.productId, product: { storeId } }, select: { id: true } }) : null
    if (!v) throw new BadRequestError(`"${i.productName}" doesn't come in that option`, "VALIDATION_FAILED")
  }
}

/** Makes the replacement order for an exchange return; returns it and what's left to refund. */
export async function makeReplacementOrder(ctx: RequestContext, returnId: bigint) {
  const r = await prisma.returnRequest.findUniqueOrThrow({
    where: { id: returnId },
    include: { items: { include: { orderItem: true } }, order: true },
  })
  const o = r.order
  const storeId = o.storeId
  const s = await orderCheckSettings(storeId)
  const credit = r2(r.items.reduce((a, i) => a + Number(i.resolutionAmount ?? 0), 0))
  const gateway = (await prisma.paymentGatewayConfig.count({ where: { storeId, code: "cod" } })) ? "cod" : o.paymentGatewayCode
  const shop = new StorefrontService({ ...ctx, storefrontId: o.storefrontId ?? undefined })
  const items = r.items.map((i) => ({ productId: i.orderItem.productId!, variantId: i.exchangeVariantId, qty: i.quantity }))
  // First without the credit, to know what the new items cost.
  const draft = {
    strict: true,
    items,
    email: o.billingEmail,
    shippingAddress: {
      firstName: o.shippingFirstName ?? o.billingFirstName,
      lastName: o.shippingLastName ?? o.billingLastName,
      country: o.shippingCountryCode ?? o.billingCountryCode,
      locationId: o.shippingLocationId,
      division: o.shippingState ?? o.billingState ?? "",
      district: o.shippingCity ?? o.billingCity,
      upazila: o.shippingUpazila ?? o.billingUpazila ?? "",
      postcode: o.shippingPostcode ?? o.billingPostcode ?? "",
      addressLine1: o.shippingAddress1 ?? o.billingAddress1,
      addressLine2: o.shippingAddress2 ?? o.billingAddress2 ?? "",
      phone: o.shippingPhone ?? o.billingPhone ?? "",
      email: o.billingEmail ?? undefined,
    },
    billingSameAsShipping: true,
    delivery: { customFee: s.exchangeFee, name: "Exchange delivery" },
    applyPromotions: false,
    paymentGateway: gateway,
    requireEnabledGateway: false,
    applyGatewayFee: false,
    customerId: o.customerId,
  }
  const first = await shop.quoteOrder(draft)
  if (first.problems.length) throw new BadRequestError(`Can't send the replacement: ${first.problems[0]}`, "CART_INVALID")
  // The credit is what the returned items were worth with tax in; compare it with the new items
  // the same way, or a straight size swap would look like it left something to refund.
  const replacementValue = r2(first.totals.itemsSubtotal + (first.totals.taxIncluded ? 0 : first.totals.taxTotal))
  const split = exchangeSplit(credit, replacementValue)
  const quote = split.used > 0 ? await shop.quoteOrder({ ...draft, manualDiscount: { type: "fixed", value: split.used } }) : first
  const order = await shop.createOrder(quote, {
    customerId: o.customerId,
    source: o.source,
    createdByAdminId: ctx.admin?.id ? BigInt(ctx.admin.id) : null,
    // Confirmed already: it's the shop's own exchange.
    status: "PROCESSING",
    historyNote: `Exchange for ${r.code ?? `return ${r.id}`} (order ${o.number}): ৳${split.used} of returned items taken off`,
    notifyCustomer: true,
  })
  emitOrderPlaced({ storeId: String(storeId), orderId: String(order.id) })
  return { order, toRefund: split.toRefund }
}
