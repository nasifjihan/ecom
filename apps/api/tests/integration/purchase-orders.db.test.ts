/**
 * Purchase orders and returns to suppliers against a REAL Postgres: an order adds no stock until
 * deliveries arrive, each delivery adds stock at landed cost and grows what's owed, an order can be
 * closed short, goods sent back leave stock and reduce the balance (never more than arrived), and
 * cancelling puts things back. Runs only when RUN_DB_TESTS=1.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import type { RequestContext } from "../../src/core"

const runDb = process.env.RUN_DB_TESTS === "1"

describe.skipIf(!runDb)("purchase orders and supplier returns (Postgres)", () => {
  let prisma: typeof import("../../src/config/prisma").prisma
  let Purchasing: typeof import("../../src/modules/purchasing/purchasing.service").PurchasingService
  let storeId: bigint
  let productId: bigint
  let supplierId: bigint
  let ctx: RequestContext
  let poId: bigint
  const suffix = Date.now().toString(36)
  const svc = () => new Purchasing(ctx)
  const stock = async () => (await prisma.product.findUniqueOrThrow({ where: { id: productId }, select: { stockQty: true } })).stockQty
  const balance = async () => (await svc().supplier(supplierId)).balance
  const order = (over: Record<string, unknown> = {}) =>
    svc().createPurchase({
      supplierId,
      sourcingType: "local",
      purchasedOn: new Date("2026-10-01"),
      shippingCost: 100,
      items: [{ productId, qty: 10, unitCost: 100 }],
      paymentTerm: "credit",
      receiveNow: false,
      expectedOn: new Date("2026-10-08"),
      ...over,
    })

  beforeAll(async () => {
    ;({ prisma } = await import("../../src/config/prisma"))
    ;({ PurchasingService: Purchasing } = await import("../../src/modules/purchasing/purchasing.service"))
    storeId = (await prisma.store.create({ data: { name: "PO Test", slug: `po-${suffix}` } })).id
    ctx = { storeId, requestId: "test", locale: "en", currency: "BDT", admin: { id: 1n, role: "OWNER", permissions: ["*"] } }
    productId = (await prisma.product.create({ data: { storeId, name: "Lungi", slug: `lungi-${suffix}`, manageStock: true, stockQty: 0, regularPrice: 300 } })).id
    supplierId = BigInt((await svc().createSupplier({ name: "Tangail Weavers" })).id)
  })

  afterAll(async () => {
    if (!prisma) return
    await prisma.supplierReturn.deleteMany({ where: { storeId } })
    await prisma.supplierPayment.deleteMany({ where: { storeId } })
    await prisma.moneyTransaction.deleteMany({ where: { storeId } })
    await prisma.purchase.deleteMany({ where: { storeId } })
    await prisma.supplier.deleteMany({ where: { storeId } })
    await prisma.moneyAccount.deleteMany({ where: { storeId } })
    await prisma.inventoryLog.deleteMany({ where: { productId } })
    await prisma.product.deleteMany({ where: { storeId } })
    await prisma.store.delete({ where: { id: storeId } })
    await prisma.$disconnect()
  })

  it("adds no stock and owes nothing while the order is on its way", async () => {
    const po = await order()
    poId = BigInt(po.id)
    expect(po).toMatchObject({ status: "ordered", total: 1100, receivedTotal: 0, expectedOn: "2026-10-08" })
    expect(po.items[0]).toMatchObject({ qty: 10, qtyReceived: 0, landedUnitCost: 110 })
    expect(await stock()).toBe(0)
    expect(await balance()).toBe(0)
  })

  it("adds stock at landed cost as deliveries arrive", async () => {
    const itemId = BigInt((await svc().purchase(poId)).items[0]!.id)
    const p = await svc().receivePurchase(poId, { items: [{ itemId, qty: 4 }] })
    expect(p).toMatchObject({ status: "partial", receivedTotal: 440 })
    expect(await stock()).toBe(4)
    expect(Number((await prisma.product.findUniqueOrThrow({ where: { id: productId } })).costPrice)).toBe(110)
    expect(await balance()).toBe(440)
    await expect(svc().receivePurchase(poId, { items: [{ itemId, qty: 7 }] })).rejects.toThrow(/Only 6 more/)
    await expect(svc().closePurchase(BigInt((await order()).id))).rejects.toThrow(/cancel the order instead/)
  })

  it("closes an order short: owes only for what arrived", async () => {
    const p = await svc().closePurchase(poId)
    expect(p).toMatchObject({ status: "received", closedShort: true, receivedTotal: 440 })
    expect(p.notes).toMatch(/6 units not delivered/)
    expect(await balance()).toBe(440)
    const itemId = BigInt(p.items[0]!.id)
    await expect(svc().receivePurchase(poId, { items: [{ itemId, qty: 1 }] })).rejects.toThrow(/already arrived/)
  })

  it("sends goods back: stock leaves, the balance drops, never more than arrived", async () => {
    const r = await svc().createReturn({ supplierId, purchaseId: poId, returnedOn: new Date("2026-10-02"), reason: "Torn", items: [{ productId, qty: 2 }] })
    expect(r).toMatchObject({ number: "RTS-000001", total: 220, status: "returned" })
    expect(r.purchase?.number).toMatch(/^PUR-/)
    expect(await stock()).toBe(2)
    expect(await balance()).toBe(220)
    await expect(svc().createReturn({ supplierId, purchaseId: poId, returnedOn: new Date(), reason: "More", items: [{ productId, qty: 3 }] })).rejects.toThrow(/only 2 of "Lungi" can still go back/)
    await expect(svc().cancelPurchase(poId)).rejects.toThrow(/cancel those returns first/)
    // Cancelling the return puts the stock and the balance back.
    await svc().cancelReturn(BigInt(r.id))
    expect(await stock()).toBe(4)
    expect(await balance()).toBe(440)
  })

  it("won't send back stock that's held for customer orders", async () => {
    await prisma.product.update({ where: { id: productId }, data: { reservedStock: 3 } })
    await prisma.warehouseStock.updateMany({ where: { productId }, data: { reserved: 3 } })
    await expect(svc().createReturn({ supplierId, returnedOn: new Date(), reason: "Faulty", items: [{ productId, qty: 2, unitCost: 110 }] })).rejects.toThrow(/Can't send back .*only 1 free/)
    await prisma.product.update({ where: { id: productId }, data: { reservedStock: 0 } })
    await prisma.warehouseStock.updateMany({ where: { productId }, data: { reserved: 0 } })
  })

  it("cancels an order nothing has arrived for, and takes an advance on an order", async () => {
    const other = await order()
    const cancelled = await svc().cancelPurchase(BigInt(other.id))
    expect(cancelled.status).toBe("cancelled")
    expect(await stock()).toBe(4)
    await svc().createAccount({ name: "Cash box", type: "cash", openingBalance: 5000 })
    const account = await prisma.moneyAccount.findFirstOrThrow({ where: { storeId } })
    await order({ paymentTerm: "advance", payNow: 500, accountId: account.id })
    // 440 owed for goods, 500 paid ahead on the new order.
    expect(await balance()).toBe(-60)
  })
})
