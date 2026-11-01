/**
 * Batch 54 against a REAL Postgres: pre-orders sold with no stock and dated, "Notify me" requests
 * sent once when stock comes back, and orders collected from a pickup point (its address, no
 * delivery charge, packed from its warehouse). Runs only when RUN_DB_TESTS=1.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import type { RequestContext } from "../../src/core"

const runDb = process.env.RUN_DB_TESTS === "1"

describe.skipIf(!runDb)("Batch 54 pre-order, notify me and pickup (Postgres)", () => {
  let prisma: typeof import("../../src/config/prisma").prisma
  let Shop: typeof import("../../src/modules/storefront/storefront.service").StorefrontService
  let PlaceOrderDto: typeof import("../../src/modules/storefront/storefront.dto").PlaceOrderDto
  let alerts: typeof import("../../src/modules/stock/back-in-stock")
  let stock: typeof import("../../src/modules/stock")
  let storeId: bigint
  let methodId: bigint
  let ctx: RequestContext
  const suffix = Date.now().toString(36)
  const address = { firstName: "Salma", lastName: "Begum", country: "BD", district: "Dhaka", addressLine1: "House 7, Road 2", phone: "01712345678" }
  const order = (productId: bigint, extra: Record<string, unknown>) =>
    new Shop(ctx).placeOrder(
      PlaceOrderDto.parse({ phone: "01712345678", shippingAddress: address, paymentGateway: "cod", items: [{ productId: String(productId), qty: 1 }], termsAgreed: true, ...extra }),
    )

  beforeAll(async () => {
    ;({ prisma } = await import("../../src/config/prisma"))
    ;({ StorefrontService: Shop } = await import("../../src/modules/storefront/storefront.service"))
    ;({ PlaceOrderDto } = await import("../../src/modules/storefront/storefront.dto"))
    alerts = await import("../../src/modules/stock/back-in-stock")
    stock = await import("../../src/modules/stock")
    storeId = (await prisma.store.create({ data: { name: "B54 Shop", slug: `b54-${suffix}` } })).id
    ctx = { storeId, requestId: "test", locale: "en", currency: "BDT" }
    await prisma.paymentGatewayConfig.create({ data: { storeId, code: "cod", name: "Cash on delivery", enabled: true } })
    const zone = await prisma.shippingZone.create({
      data: { storeId, name: "Everywhere", countries: ["BD"], methods: { create: [{ code: "std", name: "Standard", baseCost: 60 }] } },
      include: { methods: true },
    })
    methodId = zone.methods[0]!.id
  })

  afterAll(async () => {
    if (!prisma || !storeId) return // setup failed: an undefined id would match every row
    await new Promise((r) => setTimeout(r, 500)) // background emails
    await prisma.order.deleteMany({ where: { storeId } })
    await prisma.product.deleteMany({ where: { storeId } })
    await prisma.store.delete({ where: { id: storeId } })
    await prisma.$disconnect()
  })

  it("sells a pre-order product with no stock and dates the order", async () => {
    const p = await prisma.product.create({
      data: { storeId, name: "Eid Panjabi", slug: `eid-${suffix}`, status: "published", regularPrice: 2500, manageStock: true, stockQty: 0, preOrder: true, preOrderDays: 10 },
    })
    const summary = (await new Shop(ctx).getProductBySlug(`eid-${suffix}`)) as unknown as { isOutOfStock: boolean; preOrder: { shipsOn: string } | null }
    expect(summary.isOutOfStock).toBe(false)
    expect(summary.preOrder?.shipsOn).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    const r = await order(p.id, { shippingMethodId: String(methodId) })
    const saved = await prisma.order.findUniqueOrThrow({ where: { id: BigInt(r.orderId) }, include: { items: true } })
    expect(saved.expectedShipOn?.toISOString().slice(0, 10)).toBe(summary.preOrder!.shipsOn)
    expect((saved.items[0]!.meta as { preOrder?: { shipsOn: string } }).preOrder?.shipsOn).toBe(summary.preOrder!.shipsOn)
    // The same product off pre-order can't be sold with no stock.
    await prisma.product.update({ where: { id: p.id }, data: { preOrder: false } })
    await expect(order(p.id, { shippingMethodId: String(methodId) })).rejects.toThrow()
  })

  it("tells each waiting shopper once when stock comes back", async () => {
    const p = await prisma.product.create({
      data: { storeId, name: "Cotton Saree", slug: `saree-${suffix}`, status: "published", regularPrice: 3000, manageStock: true, stockQty: 0 },
    })
    await alerts.requestStockAlert(storeId, { productId: p.id, contact: "rina@example.com" })
    await alerts.requestStockAlert(storeId, { productId: p.id, contact: "01711-000101" })
    await expect(alerts.requestStockAlert(storeId, { productId: p.id, contact: "nope" })).rejects.toThrow()
    expect(await alerts.waitingFor(storeId, p.id)).toHaveLength(2)
    expect(await alerts.notifyBackInStock(storeId, p.id, null)).toBe(0) // still sold out
    await prisma.$transaction(async (t) => {
      const warehouseId = await stock.defaultWarehouseId(t, storeId)
      await stock.moveStock(t, { storeId, warehouseId, sku: { productId: p.id, variantId: null }, onHand: 5, reason: "PURCHASE" })
    })
    expect(await alerts.notifyBackInStock(storeId, p.id, null)).toBe(2)
    expect(await alerts.notifyBackInStock(storeId, p.id, null)).toBe(0) // never twice
    expect(await alerts.waitingFor(storeId, p.id)).toEqual([])
    expect((await alerts.mostWanted(storeId)).some((w) => w.productId === String(p.id))).toBe(false)
  })

  it("takes a pickup order: the point's address, no delivery charge, packed from its warehouse", async () => {
    const p = await prisma.product.create({ data: { storeId, name: "Scarf", slug: `scarf-${suffix}`, status: "published", regularPrice: 500, manageStock: false } })
    const warehouse = await prisma.warehouse.create({ data: { storeId, name: "Office", code: `OFF-${suffix}` } })
    const point = await prisma.pickupPoint.create({
      data: { storeId, name: "Dhanmondi office", address: "House 12, Road 5, Dhanmondi", district: "Dhaka", warehouseId: warehouse.id },
    })
    expect(() => PlaceOrderDto.parse({ phone: "01712345678", shippingAddress: address, paymentGateway: "cod", items: [{ productId: "1", qty: 1 }], termsAgreed: true })).toThrow()
    const r = await order(p.id, { pickupPointId: String(point.id) })
    const saved = await prisma.order.findUniqueOrThrow({ where: { id: BigInt(r.orderId) } })
    expect(saved).toMatchObject({ pickupPointId: point.id, shippingMethodCode: "pickup", shippingMethodName: "Pickup: Dhanmondi office", shippingAddress1: "House 12, Road 5, Dhanmondi", warehouseId: warehouse.id })
    expect(Number(saved.shippingTotal)).toBe(0)
    // A point that's switched off can't be chosen.
    await prisma.pickupPoint.update({ where: { id: point.id }, data: { isActive: false } })
    await expect(order(p.id, { pickupPointId: String(point.id) })).rejects.toThrow()
  })
})
