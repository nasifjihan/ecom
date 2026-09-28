/**
 * Stock across warehouses against a REAL Postgres: holding stock for an order, packing, unpacking,
 * cancelling, transfers with a shortfall, and moving an order to another warehouse. After every step
 * the warehouse rows must add up to the product's totals.
 *
 * Runs only when RUN_DB_TESTS=1.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import type { RequestContext } from "../../src/core"

const runDb = process.env.RUN_DB_TESTS === "1"

describe.skipIf(!runDb)("stock ledger and warehouses (Postgres)", () => {
  let prisma: typeof import("../../src/config/prisma").prisma
  let stock: typeof import("../../src/modules/stock")
  let Fulfilment: typeof import("../../src/modules/fulfilment/fulfilment.service").FulfilmentService
  let Orders: typeof import("../../src/modules/orders/orders.service").OrdersService
  let storeId: bigint
  let productId: bigint
  let mainId: bigint
  let ctx: RequestContext
  const suffix = Date.now().toString(36)
  let orderSeq = 0

  const levels = async () => {
    const p = await prisma.product.findUniqueOrThrow({ where: { id: productId }, select: { stockQty: true, reservedStock: true } })
    const rows = await prisma.warehouseStock.findMany({ where: { productId }, orderBy: { warehouseId: "asc" } })
    // The invariant: warehouse rows add up to the product's totals.
    expect(rows.reduce((a, r) => a + r.onHand, 0)).toBe(p.stockQty)
    expect(rows.reduce((a, r) => a + r.reserved, 0)).toBe(p.reservedStock)
    const at = (w: bigint) => rows.find((r) => r.warehouseId === w) ?? { onHand: 0, reserved: 0 }
    return { onHand: p.stockQty ?? 0, reserved: p.reservedStock, at }
  }

  /** An order holding `qty` units, as checkout leaves it. */
  const placeOrder = async (qty: number, warehouseId: bigint) => {
    orderSeq += 1
    return prisma.$transaction(async (t) => {
      await stock.moveStock(t, { storeId, warehouseId, sku: { productId, variantId: null }, reserved: qty, guard: "available", reason: "ORDER_RESERVE" })
      return t.order.create({
        data: {
          storeId,
          number: `T${suffix}${orderSeq}`,
          orderKey: `ok_${suffix}_${orderSeq}`,
          warehouseId,
          billingFirstName: "Rahim",
          billingLastName: "Uddin",
          billingAddress1: "House 1",
          billingCity: "Dhaka",
          billingCountryCode: "BD",
          grandTotal: 1000,
          currencyCode: "BDT",
          paymentGatewayCode: "cod",
          shippingMethodCode: "std",
          shippingMethodName: "Standard",
          items: {
            create: {
              productId,
              productName: "Test Panjabi",
              quantity: qty,
              qtyReserved: qty,
              unitPrice: 100,
              lineSubtotal: 100 * qty,
              lineTotal: 100 * qty,
            },
          },
        },
        include: { items: true },
      })
    })
  }

  beforeAll(async () => {
    ;({ prisma } = await import("../../src/config/prisma"))
    stock = await import("../../src/modules/stock")
    ;({ FulfilmentService: Fulfilment } = await import("../../src/modules/fulfilment/fulfilment.service"))
    ;({ OrdersService: Orders } = await import("../../src/modules/orders/orders.service"))
    const store = await prisma.store.create({ data: { name: "Stock Test", slug: `stock-${suffix}` } })
    storeId = store.id
    ctx = { storeId, requestId: "test", locale: "en", currency: "BDT" }
    // A product whose stock was written directly (like seed data): the ledger adopts it.
    const p = await prisma.product.create({
      data: { storeId, name: "Test Panjabi", slug: `panjabi-${suffix}`, manageStock: true, stockQty: 10, regularPrice: 100 },
    })
    productId = p.id
    mainId = await prisma.$transaction((t) => stock.defaultWarehouseId(t, storeId))
  })

  afterAll(async () => {
    if (!prisma) return
    await prisma.stockTransfer.deleteMany({ where: { storeId } })
    await prisma.order.deleteMany({ where: { storeId } })
    await prisma.inventoryLog.deleteMany({ where: { productId } })
    await prisma.product.deleteMany({ where: { storeId } })
    await prisma.store.delete({ where: { id: storeId } })
    await prisma.$disconnect()
  })

  it("holds stock for an order and refuses to oversell", async () => {
    const o = await placeOrder(3, mainId)
    expect(o.items[0]!.qtyReserved).toBe(3)
    let l = await levels()
    expect([l.onHand, l.reserved]).toEqual([10, 3]) // still on the shelf, 7 free

    await expect(placeOrder(8, mainId)).rejects.toThrow(/sold out/)
    l = await levels()
    expect([l.onHand, l.reserved]).toEqual([10, 3]) // the refused order changed nothing
  })

  it("packing takes units off the shelf; a cancelled parcel puts them back and holds them again", async () => {
    const o = await placeOrder(2, mainId)
    const f = new Fulfilment(ctx)
    const parcel = await f.createParcel(o.id, { courierCode: "manual", courierName: "Own rider" })
    let l = await levels()
    expect([l.onHand, l.reserved]).toEqual([8, 3]) // 2 left the shelf; the first order's 3 still held
    expect((await prisma.orderItem.findFirstOrThrow({ where: { orderId: o.id } })).qtyReserved).toBe(0)

    await f.moveParcel(parcel.id, { status: "cancelled", note: "Packed by mistake" })
    l = await levels()
    expect([l.onHand, l.reserved]).toEqual([10, 5])
    expect((await prisma.orderItem.findFirstOrThrow({ where: { orderId: o.id } })).qtyReserved).toBe(2)

    // Cancelling the order releases its hold.
    await new Orders(ctx).transitionStatus(o.id, { newStatus: "CANCELLED", note: "Customer changed mind", notifyCustomer: false } as never)
    l = await levels()
    expect([l.onHand, l.reserved]).toEqual([10, 3])
  })

  it("cancelling an order with a packed parcel unpacks it", async () => {
    const o = await placeOrder(1, mainId)
    await new Fulfilment(ctx).createParcel(o.id, { courierCode: "manual", courierName: "Own rider" })
    let l = await levels()
    expect([l.onHand, l.reserved]).toEqual([9, 3])
    await new Orders(ctx).transitionStatus(o.id, { newStatus: "CANCELLED", note: null, notifyCustomer: false } as never)
    l = await levels()
    expect([l.onHand, l.reserved]).toEqual([10, 3])
    const parcels = await prisma.shipment.findMany({ where: { orderId: o.id } })
    expect(parcels.map((p) => p.status)).toEqual(["cancelled"])
  })

  it("transfers only free stock, receives with a shortfall, and cancels back to the source", async () => {
    const w = new stock.WarehousesService(ctx)
    await w.create({ name: "Chattogram hub", code: "CTG" })
    const ctgId = (await prisma.warehouse.findFirstOrThrow({ where: { storeId, code: "CTG" } })).id

    // 10 on the shelf, 3 held: only 7 can leave.
    await expect(w.send({ fromWarehouseId: mainId, toWarehouseId: ctgId, items: [{ productId, qty: 8 }] })).rejects.toThrow(/only 7 free/)

    const sent = await w.send({ fromWarehouseId: mainId, toWarehouseId: ctgId, items: [{ productId, qty: 5 }], note: "Eid stock" })
    let l = await levels()
    expect([l.onHand, l.at(mainId).onHand, l.at(ctgId).onHand]).toEqual([5, 5, 0]) // on the road

    await expect(w.receive(BigInt(sent.id), { items: [{ id: BigInt(sent.items[0]!.id), qty: 4 }] })).rejects.toThrow(/say what happened/)
    const got = await w.receive(BigInt(sent.id), { items: [{ id: BigInt(sent.items[0]!.id), qty: 4 }], note: "One torn in transit" })
    expect([got.status, got.unitsReceived, got.shortfall]).toEqual(["received", 4, 1])
    l = await levels()
    expect([l.onHand, l.at(mainId).onHand, l.at(ctgId).onHand]).toEqual([9, 5, 4])

    const back = await w.send({ fromWarehouseId: ctgId, toWarehouseId: mainId, items: [{ productId, qty: 2 }] })
    await w.cancel(BigInt(back.id))
    l = await levels()
    expect([l.at(mainId).onHand, l.at(ctgId).onHand]).toEqual([5, 4])
    await expect(w.cancel(BigInt(back.id))).rejects.toThrow(/already cancelled/)
  })

  it("an order can't be packed where the stock isn't, until it ships from a warehouse that has it", async () => {
    const w = new stock.WarehousesService(ctx)
    await w.create({ name: "Sylhet shop", code: "SYL" })
    const sylId = (await prisma.warehouse.findFirstOrThrow({ where: { storeId, code: "SYL" } })).id
    const o = await placeOrder(2, sylId) // held at Sylhet, which has nothing on the shelf
    const view = await w.orderStock(o.id)
    expect(view.lines[0]).toMatchObject({ held: 2, onShelf: 0, short: 2 })

    const f = new Fulfilment(ctx)
    await expect(f.createParcel(o.id, { courierCode: "manual", courierName: "Own rider" })).rejects.toThrow(/on the shelf in Sylhet shop/)

    await w.moveOrder(o.id, mainId)
    let l = await levels()
    expect([l.at(sylId).reserved, l.at(mainId).reserved]).toEqual([0, 5])
    await f.createParcel(o.id, { courierCode: "manual", courierName: "Own rider" })
    l = await levels()
    expect([l.onHand, l.reserved, l.at(mainId).onHand]).toEqual([7, 3, 3])
  })

  it("the product editor's stock box changes the default warehouse by the difference", async () => {
    await prisma.$transaction((t) => stock.setStockTotal(t, storeId, { productId, variantId: null }, 12))
    let l = await levels()
    expect([l.onHand, l.at(mainId).onHand]).toEqual([12, 8])
    // Taking more than the default warehouse's shelf has is refused (the rest is elsewhere).
    await expect(prisma.$transaction((t) => stock.setStockTotal(t, storeId, { productId, variantId: null }, 2))).rejects.toThrow(/only 8 on the shelf/)
    l = await levels()
    expect(l.onHand).toBe(12)
  })
})
