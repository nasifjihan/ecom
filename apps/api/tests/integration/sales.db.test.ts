/**
 * Sales team commission against a REAL Postgres: crediting staff orders, rates (product >
 * category > store + extra), earned only when delivered and paid, refunds, cancellations,
 * targets, payouts, share-link codes and "my commission". Runs only when RUN_DB_TESTS=1.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import type { RequestContext } from "../../src/core"

const runDb = process.env.RUN_DB_TESTS === "1"

describe.skipIf(!runDb)("sales commission (Postgres)", () => {
  let prisma: typeof import("../../src/config/prisma").prisma
  let Sales: typeof import("../../src/modules/sales/sales.service").SalesService
  let ledger: typeof import("../../src/modules/sales/commission.ledger")
  let rules: typeof import("../../src/modules/sales/commission.rules")
  let Manual: typeof import("../../src/modules/orders/manual-order").ManualOrderService
  let ManualDto: typeof import("../../src/modules/orders/manual-order").ManualOrderDto
  let storeId: bigint
  let shirt: bigint
  let saree: bigint
  let cap: bigint
  let rina: bigint
  let karim: bigint
  let clerk: bigint
  let owner: RequestContext
  const suffix = Date.now().toString(36)
  const month = () => rules.monthOf(new Date())
  let phone = 1711000000

  const staff = (id: bigint): RequestContext => ({ ...owner, admin: { id, role: "ADMIN", permissions: ["orders.view", "orders.create"] } })
  const order = async (by: bigint, extra: Record<string, unknown> = {}) => {
    phone += 1
    const dto = ManualDto.parse({
      customer: { firstName: "Buyer", phone: `0${phone}` },
      items: [
        { productId: shirt, qty: 1 },
        { productId: saree, qty: 1 },
        { productId: cap, qty: 2 },
      ],
      delivery: { type: "pickup" },
      discount: { type: "fixed", value: 500 },
      applyPromotions: false,
      ...extra,
    })
    return new Manual(staff(by)).create(dto)
  }
  const deliverAndPay = (id: string) =>
    prisma.order.update({ where: { id: BigInt(id) }, data: { status: "DELIVERED", completedAt: new Date(), paymentStatus: "paid", paidAt: new Date() } })

  beforeAll(async () => {
    ;({ prisma } = await import("../../src/config/prisma"))
    ;({ SalesService: Sales } = await import("../../src/modules/sales/sales.service"))
    ledger = await import("../../src/modules/sales/commission.ledger")
    rules = await import("../../src/modules/sales/commission.rules")
    ;({ ManualOrderService: Manual, ManualOrderDto: ManualDto } = await import("../../src/modules/orders/manual-order"))
    storeId = (await prisma.store.create({ data: { name: "Sales Test", slug: `sales-${suffix}` } })).id
    owner = { storeId, requestId: "test", locale: "en", currency: "BDT", admin: { id: 1n, role: "OWNER", permissions: ["*"] } }
    await prisma.paymentGatewayConfig.create({ data: { storeId, code: "cod", name: "Cash on delivery", enabled: true } })
    const sarees = await prisma.category.create({ data: { storeId, name: "Sarees", slug: `sarees-${suffix}`, commissionRate: 8 } })
    const p = (name: string, price: number, extra: Record<string, unknown> = {}) =>
      prisma.product.create({ data: { storeId, name, slug: `${name.toLowerCase()}-${suffix}`, status: "published", regularPrice: price, manageStock: false, ...extra } })
    shirt = (await p("Shirt", 3000, { commissionRate: 10 })).id
    saree = (await p("Saree", 5000, { categories: { create: [{ categoryId: sarees.id, primary: true }] } })).id
    cap = (await p("Cap", 1000)).id
    const role = await prisma.role.create({ data: { storeId, name: "Sales", slug: `sales-${suffix}`, maxManualDiscountPct: 10 } })
    const mk = (name: string, isSalesperson: boolean, extra = 0) =>
      prisma.adminUser.create({
        data: { storeId, email: `${name}-${suffix}@x.test`, name, passwordHash: "x", roleId: role.id, isSalesperson, commissionExtraPct: extra },
      })
    rina = (await mk("Rina", true, 1)).id
    karim = (await mk("Karim", true)).id
    clerk = (await mk("Clerk", false)).id
    await new Sales(owner).updateSettings({ enabled: true, defaultRate: 5 })
  })

  afterAll(async () => {
    if (!prisma) return
    await new Promise((r) => setTimeout(r, 300))
    await prisma.order.deleteMany({ where: { storeId } })
    await prisma.adminUser.deleteMany({ where: { storeId } })
    await prisma.product.deleteMany({ where: { storeId } })
    await prisma.customer.deleteMany({ where: { storeId } })
    await prisma.store.delete({ where: { id: storeId } })
    await prisma.$disconnect()
  })

  it("credits an order to the salesperson who enters it, with product > category > store rates plus their extra", async () => {
    const o = await order(rina)
    const c = await new Sales(owner).orderCommission(BigInt(o.id))
    expect(c.salesperson?.name).toBe("Rina")
    // Items 3000 + 5000 + 2000 = 10000, 500 off shared by value: 2850 / 4750 / 1900.
    expect(c.commission!.lines.map((l) => [l.name, l.base, l.rate, l.source])).toEqual([
      ["Shirt", 2850, 11, "product"],
      ["Saree", 4750, 9, "category"],
      ["Cap", 1900, 6, "store"],
    ])
    expect(c.commission).toMatchObject({ state: "PENDING", base: 9500, amount: 855 })
  })

  it("uses the salesperson staff pick, or nobody; clerks off the team get nothing", async () => {
    const picked = await order(clerk, { salespersonId: karim })
    expect((await new Sales(owner).orderCommission(BigInt(picked.id))).commission).toMatchObject({ amount: 760 })
    const nobody = await order(rina, { salespersonId: null })
    expect((await new Sales(owner).orderCommission(BigInt(nobody.id))).salesperson).toBeNull()
    const byClerk = await order(clerk)
    expect((await new Sales(owner).orderCommission(BigInt(byClerk.id))).salesperson).toBeNull()
    await expect(new Sales(owner).reassign(BigInt(byClerk.id), clerk)).rejects.toThrow(/sales team/)
    expect((await new Sales(owner).reassign(BigInt(byClerk.id), karim)).salesperson?.name).toBe("Karim")
  })

  it("earns commission only once the order is delivered and paid, less refunds", async () => {
    const o = await order(rina)
    expect((await new Sales(owner).orderCommission(BigInt(o.id))).commission?.state).toBe("PENDING")
    await prisma.order.update({ where: { id: BigInt(o.id) }, data: { status: "DELIVERED", completedAt: new Date() } })
    expect((await new Sales(owner).orderCommission(BigInt(o.id))).commission?.state).toBe("PENDING")
    await deliverAndPay(o.id)
    expect((await new Sales(owner).orderCommission(BigInt(o.id))).commission).toMatchObject({ state: "EARNED", amount: 855 })
    await prisma.order.update({ where: { id: BigInt(o.id) }, data: { paymentStatus: "partially_refunded", refundedTotal: 1900 } })
    expect((await new Sales(owner).orderCommission(BigInt(o.id))).commission).toMatchObject({ state: "EARNED", amount: 684, base: 7600 })

    const lost = await order(rina)
    await prisma.order.update({ where: { id: BigInt(lost.id) }, data: { status: "CANCELLED" } })
    expect((await new Sales(owner).orderCommission(BigInt(lost.id))).commission).toMatchObject({ state: "CANCELLED", amount: 0 })
  })

  it("shows the team's month with targets", async () => {
    await new Sales(owner).setTarget(rina, month(), 10000)
    await expect(new Sales(owner).setTarget(clerk, month(), 5000)).rejects.toThrow(/sales team first/)
    const t = await new Sales(owner).team(month())
    const r = t.team.find((p) => p.name === "Rina")!
    expect(r).toMatchObject({ sales: 7600, earned: 684, orders: 1, pendingOrders: 1, pending: 855, unpaid: 684, target: 10000, progress: 76 })
    expect(t.otherStaff.map((s) => s.name)).toEqual(["Clerk"])
    const cancelled = await new Sales(owner).commissions({ month: month(), salespersonId: rina, state: "CANCELLED" })
    expect(cancelled).toHaveLength(1)
  })

  it("pays out what's earned, and then the order can't be moved", async () => {
    const r = await new Sales(owner).payout(rina, month())
    expect(r).toEqual({ orders: 1, amount: 684 })
    await expect(new Sales(owner).payout(rina, month())).rejects.toThrow(/Nothing earned/)
    const paid = (await new Sales(owner).commissions({ month: month(), salespersonId: rina, state: "PAID" }))[0]!
    await expect(new Sales(owner).reassign(BigInt(paid.orderId), karim)).rejects.toThrow(/already paid out/)
    const mine = await new Sales(staff(rina)).mine(month())
    expect(mine).toMatchObject({ isSalesperson: true, earned: 684, unpaid: 0, pending: 855, target: 10000 })
    expect(await new Sales(staff(clerk)).mine(month())).toEqual({ isSalesperson: false })
  })

  it("gives salespeople a share-link code and finds them by it", async () => {
    await new Sales(owner).updateSalesperson(clerk, { isSalesperson: true })
    const code = (await prisma.adminUser.findUnique({ where: { id: clerk } }))!.salesCode!
    expect(code).toMatch(/^S[0-9A-F]{6}$/)
    expect(await ledger.salespersonByCode(prisma, storeId, code.toLowerCase())).toBe(clerk)
    await new Sales(owner).updateSalesperson(karim, { salesCode: "KARIM1" })
    await expect(new Sales(owner).updateSalesperson(rina, { salesCode: "karim1" })).rejects.toThrow(/Another salesperson/)
    await expect(new Sales(owner).updateSalesperson(rina, { salesCode: "no!" })).rejects.toThrow(/letters and numbers/)
    await new Sales(owner).updateSalesperson(clerk, { isSalesperson: false })
    expect(await ledger.salespersonByCode(prisma, storeId, code)).toBeNull()
  })

  it("records no commission while commission is off", async () => {
    await new Sales(owner).updateSettings({ enabled: false })
    const o = await order(rina)
    const c = await new Sales(owner).orderCommission(BigInt(o.id))
    expect(c.salesperson?.name).toBe("Rina")
    expect(c.commission).toBeNull()
    await new Sales(owner).updateSettings({ enabled: true })
  })
})
