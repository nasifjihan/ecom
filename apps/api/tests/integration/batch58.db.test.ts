/**
 * Batch 58 against a REAL Postgres: a split payment taken on New order (cash + bKash) with the rest
 * left for the courier, other names remembered for a phone, the delivery choice saved, and system
 * entries in the activity log. Runs only when RUN_DB_TESTS=1.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import type { RequestContext } from "../../src/core"

const runDb = process.env.RUN_DB_TESTS === "1"

describe.skipIf(!runDb)("Batch 58 split payment, customer names, activity log (Postgres)", () => {
  let prisma: typeof import("../../src/config/prisma").prisma
  let Manual: typeof import("../../src/modules/orders/manual-order").ManualOrderService
  let ManualDto: typeof import("../../src/modules/orders/manual-order").ManualOrderDto
  let Fulfilment: typeof import("../../src/modules/fulfilment/fulfilment.service").FulfilmentService
  let logSystem: typeof import("../../src/modules/team/audit").logSystem
  let storeId: bigint
  let productId: bigint
  let owner: RequestContext
  const suffix = Date.now().toString(36)
  const phone = "01722000601"

  beforeAll(async () => {
    ;({ prisma } = await import("../../src/config/prisma"))
    ;({ ManualOrderService: Manual, ManualOrderDto: ManualDto } = await import("../../src/modules/orders/manual-order"))
    ;({ FulfilmentService: Fulfilment } = await import("../../src/modules/fulfilment/fulfilment.service"))
    ;({ logSystem } = await import("../../src/modules/team/audit"))
    storeId = (await prisma.store.create({ data: { name: "B58 Shop", slug: `b58-${suffix}` } })).id
    const role = await prisma.role.create({ data: { storeId, name: "Owner", slug: "owner", isSystem: true } })
    const adminId = (await prisma.adminUser.create({ data: { storeId, email: `o-${suffix}@x.test`, name: "Owner", passwordHash: "x", roleId: role.id } })).id
    owner = { storeId, requestId: "test", locale: "en", currency: "BDT", admin: { id: adminId, role: "OWNER", permissions: ["*"] } }
    await prisma.paymentGatewayConfig.create({ data: { storeId, code: "cod", name: "Cash on delivery", enabled: true } })
    productId = (await prisma.product.create({ data: { storeId, name: "Cotton Panjabi", slug: `pj-${suffix}`, status: "published", regularPrice: 2500, manageStock: false } })).id
  })

  afterAll(async () => {
    if (!prisma || !storeId) return // setup failed: an undefined id would match every row
    await new Promise((r) => setTimeout(r, 300))
    await prisma.auditLog.deleteMany({ where: { storeId } })
    await prisma.order.deleteMany({ where: { storeId } })
    await prisma.customer.deleteMany({ where: { storeId } })
    await prisma.product.deleteMany({ where: { storeId } })
    await prisma.adminUser.deleteMany({ where: { storeId } })
    await prisma.role.deleteMany({ where: { storeId } })
    await prisma.store.delete({ where: { id: storeId } })
    await prisma.$disconnect()
  })

  const order = (extra: Record<string, unknown>) =>
    new Manual(owner).create(
      ManualDto.parse({
        customer: { firstName: "Rina", lastName: "Akter", phone },
        items: [{ productId, qty: 1 }],
        address: { country: "BD", district: "Dhaka", addressLine1: "House 2, Road 3, Mirpur" },
        delivery: { type: "custom", fee: 60, name: "Delivery" },
        applyPromotions: false,
        ...extra,
      }),
    )

  it("takes part of the money now in two ways and leaves the rest for the courier", async () => {
    const r = await order({ payments: [{ method: "cash", amount: 500 }, { method: "bkash", amount: 1000, transactionId: `B58${suffix.toUpperCase()}X1` }], deliveryBy: "own" })
    const o = await prisma.order.findUniqueOrThrow({ where: { id: BigInt(r.id) }, include: { items: true, paymentRecords: true } })
    expect(o.paymentStatus).toBe("partially_paid")
    expect(o.deliveryBy).toBe("own")
    expect(o.paymentRecords.map((p) => [p.kind, p.method, Number(p.amount)]).sort()).toEqual([["cash", "cash", 500], ["transfer", "bkash", 1000]])
    const parcel = await new Fulfilment(owner).createParcel(o.id, { courierCode: "own", courierName: "Own delivery" } as never)
    expect(Number(parcel.codAmount)).toBe(Number(o.grandTotal) - 1500) // the total includes the default 15% VAT
  })

  it("refuses payments that add up to more than the order", async () => {
    await expect(order({ payments: [{ method: "cash", amount: 9000 }] })).rejects.toThrow(/more than the order total/)
  })

  it("remembers another name ordered with the same phone", async () => {
    await order({ customer: { firstName: "Karim", lastName: "Uddin", phone } })
    const c = await prisma.customer.findFirstOrThrow({ where: { storeId, phone } })
    expect(c.otherNames).toContain("Karim Uddin")
    expect(await prisma.customer.count({ where: { storeId, phone } })).toBe(1)
    // A first name alone stays alone: the account's last name isn't added to it.
    await order({ customer: { firstName: "Rafi", phone } })
    const again = await prisma.customer.findFirstOrThrow({ where: { storeId, phone } })
    expect(again.otherNames).toContain("Rafi")
    expect(again.otherNames).not.toContain("Rafi Akter")
  })

  it("writes system entries to the activity log", async () => {
    logSystem(storeId, { by: "Steadfast", action: "parcel.status", objectType: "shipments", objectId: 1n, details: { status: "delivered" } })
    await new Promise((r) => setTimeout(r, 300))
    expect(await prisma.auditLog.findFirst({ where: { storeId, actorType: "system", actorName: "Steadfast" } })).not.toBeNull()
  })
})
