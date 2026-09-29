/**
 * Quotations against a REAL Postgres: staff draft and send, the customer's view and answer,
 * editing after an answer, the discount limit, expiry, requests from the cart, and turning a
 * quote into an order at the agreed prices. Runs only when RUN_DB_TESTS=1.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import type { RequestContext } from "../../src/core"

const runDb = process.env.RUN_DB_TESTS === "1"

describe.skipIf(!runDb)("quotations (Postgres)", () => {
  let prisma: typeof import("../../src/config/prisma").prisma
  let Quotes: typeof import("../../src/modules/wholesale/quotations.service").QuotationsService
  let Wholesale: typeof import("../../src/modules/wholesale/wholesale.service").WholesaleService
  let Manual: typeof import("../../src/modules/orders/manual-order").ManualOrderService
  let ManualDto: typeof import("../../src/modules/orders/manual-order").ManualOrderDto
  let storeId: bigint
  let shirt: bigint
  let cap: bigint
  let buyer: bigint
  let walkIn: bigint
  let owner: RequestContext
  let limited: RequestContext
  const suffix = Date.now().toString(36)

  const as = (customerId: bigint): RequestContext => ({ storeId, requestId: "test", locale: "en", currency: "BDT", customer: { id: customerId } })
  const lines = (unitPrice: number, qty = 10) => [{ productId: shirt, qty, unitPrice }]

  beforeAll(async () => {
    ;({ prisma } = await import("../../src/config/prisma"))
    ;({ QuotationsService: Quotes } = await import("../../src/modules/wholesale/quotations.service"))
    ;({ WholesaleService: Wholesale } = await import("../../src/modules/wholesale/wholesale.service"))
    ;({ ManualOrderService: Manual, ManualOrderDto: ManualDto } = await import("../../src/modules/orders/manual-order"))
    storeId = (await prisma.store.create({ data: { name: "Quotes Test", slug: `qt-${suffix}` } })).id
    owner = { storeId, requestId: "test", locale: "en", currency: "BDT", admin: { id: 1n, role: "OWNER", permissions: ["*"] } }
    await prisma.paymentGatewayConfig.create({ data: { storeId, code: "cod", name: "Cash on delivery", enabled: true } })
    shirt = (
      await prisma.product.create({
        data: { storeId, name: "Shirt", slug: `shirt-${suffix}`, status: "published", regularPrice: 1000, manageStock: false },
      })
    ).id
    cap = (
      await prisma.product.create({
        data: { storeId, name: "Cap", slug: `cap-${suffix}`, status: "published", regularPrice: 300, manageStock: true, stockQty: 2 },
      })
    ).id
    buyer = (await prisma.customer.create({ data: { storeId, email: `qb-${suffix}@x.test`, firstName: "Rahim", lastName: "Traders" } })).id
    walkIn = (await prisma.customer.create({ data: { storeId, email: `qw-${suffix}@x.test`, firstName: "Sadia", lastName: "K" } })).id
    await new Wholesale(owner).updateSettings({ enabled: true })
    await new Wholesale(owner).createAccount({ customerId: buyer, companyName: "Rahim Traders", businessType: "retailer" })
    await new Wholesale(owner).saveProductTiers(shirt, { tiers: [{ variantId: null, minQty: 10, price: 900, forEveryone: false }] })
    const role = await prisma.role.create({ data: { storeId, name: "Sales", slug: `sales-${suffix}`, maxManualDiscountPct: 5 } })
    const staff = await prisma.adminUser.create({
      data: { storeId, email: `sales-${suffix}@x.test`, name: "Sales", passwordHash: "x", roleId: role.id },
    })
    limited = { ...owner, admin: { id: staff.id, role: "ADMIN", permissions: ["orders.view", "orders.create"] } }
  })

  afterAll(async () => {
    if (!prisma) return
    await new Promise((r) => setTimeout(r, 500)) // background emails
    await prisma.quotation.deleteMany({ where: { storeId } })
    await prisma.order.deleteMany({ where: { storeId } })
    await prisma.adminUser.deleteMany({ where: { storeId } })
    await prisma.product.deleteMany({ where: { storeId } })
    await prisma.customer.deleteMany({ where: { storeId } })
    await prisma.store.delete({ where: { id: storeId } })
    await prisma.$disconnect()
  })

  it("prices lines at what the customer normally pays, business prices included", async () => {
    const b = await new Quotes(owner).previewLines(buyer, null, [{ productId: shirt, qty: 10 }])
    const w = await new Quotes(owner).previewLines(walkIn, null, [{ productId: shirt, qty: 10 }])
    expect([b[0]!.listPrice, w[0]!.listPrice]).toEqual([900, 1000])
    // Low stock is a note, not a refusal: the goods may come in before the order.
    const c = await new Quotes(owner).previewLines(buyer, null, [{ productId: cap, qty: 5 }])
    expect(c[0]!.note).toMatch(/Only 2 left/)
  })

  it("drafts a quote the customer can't see until it's sent", async () => {
    const q = await new Quotes(owner).create({ customerId: buyer, discount: 100, deliveryFee: 150, items: lines(850), terms: "Half in advance" })
    expect(q.number).toMatch(/^Q-\d{6}$/)
    expect(q).toMatchObject({ status: "DRAFT", subtotal: 8500, discount: 100, total: 8550, listTotal: 9000 })
    expect((q as { offPercent: number }).offPercent).toBe(6.7)
    expect(await new Quotes(as(buyer)).mine(buyer)).toEqual([])

    const sent = await new Quotes(owner).send(BigInt(q.id))
    expect(sent.status).toBe("SENT")
    expect(sent.validUntil).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    const mine = await new Quotes(as(buyer)).mine(buyer)
    expect(mine.map((m) => [m.number, m.status, m.total])).toEqual([[q.number, "SENT", 8550]])
    expect(mine[0]).not.toHaveProperty("staffNote")
  })

  it("holds staff to their role's discount limit", async () => {
    await expect(new Quotes(limited).create({ customerId: buyer, discount: 0, deliveryFee: 0, items: lines(850) })).rejects.toThrow(
      /5.6% below .* at most 5% off/,
    )
    const ok = await new Quotes(limited).create({ customerId: buyer, discount: 0, deliveryFee: 0, items: lines(860) })
    expect(ok.subtotal).toBe(8600)
    await new Quotes(owner).remove(BigInt(ok.id))
    await expect(new Quotes(owner).get(BigInt(ok.id))).rejects.toThrow(/not found/i)
  })

  it("takes the customer's answer, and a change sends it back to draft", async () => {
    const [q] = await new Quotes(as(buyer)).mine(buyer)
    const accepted = await new Quotes(as(buyer)).respond(buyer, q!.number, "accept", "Please deliver on Sunday")
    expect(accepted).toMatchObject({ status: "ACCEPTED", customerNote: "Please deliver on Sunday", canRespond: false })
    await expect(new Quotes(as(buyer)).respond(buyer, q!.number, "decline", null)).rejects.toThrow(/can't be answered/)
    await expect(new Quotes(as(walkIn)).myOne(walkIn, q!.number)).rejects.toThrow(/not found/i)

    const changed = await new Quotes(owner).update(BigInt(q!.id), { customerId: buyer, discount: 100, deliveryFee: 150, items: lines(840) })
    expect(changed.status).toBe("DRAFT")
    await expect(new Quotes(as(buyer)).myOne(buyer, q!.number)).rejects.toThrow(/not found/i)
    await new Quotes(owner).send(BigInt(q!.id))
    await new Quotes(as(buyer)).respond(buyer, q!.number, "accept", null)
  })

  it("turns an accepted quote into an order at the agreed prices, once", async () => {
    const [q] = await new Quotes(as(buyer)).mine(buyer)
    const dto = ManualDto.parse({ quotationId: q!.id, delivery: { type: "custom", fee: 150 }, address: { addressLine1: "Shop 12, Gulistan", district: "Dhaka" } })
    const preview = await new Manual(owner).quote(dto)
    expect(preview.lines.map((l) => [l.qty, l.unitPrice])).toEqual([[10, 840]])
    expect(preview.totals).toMatchObject({ itemsSubtotal: 8400, manualDiscount: 100, shippingTotal: 150 })
    // The quote's discount was agreed already, so a staff member's own limit doesn't apply to it.
    expect((await new Manual(limited).quote(dto)).problems).toEqual([])

    const order = await new Manual(owner).create(dto)
    expect(order.customerId).toBe(String(buyer))
    const saved = await prisma.order.findUnique({ where: { id: BigInt(order.id) }, include: { items: true } })
    expect(saved!.items.map((i) => Number(i.unitPrice))).toEqual([840])
    const after = await new Quotes(owner).get(BigInt(q!.id))
    expect(after).toMatchObject({ status: "ORDERED", order: { id: order.id, number: order.number } })
    await expect(new Manual(owner).create(dto)).rejects.toThrow(/already an order/)
  })

  it("stops answers and orders once a quote has expired", async () => {
    const q = await new Quotes(owner).create({ customerId: buyer, discount: 0, deliveryFee: 0, items: lines(900, 12) })
    await new Quotes(owner).send(BigInt(q.id))
    await prisma.quotation.update({ where: { id: BigInt(q.id) }, data: { validUntil: new Date(Date.now() - 60_000) } })
    expect((await new Quotes(owner).get(BigInt(q.id))).status).toBe("EXPIRED")
    await expect(new Quotes(as(buyer)).respond(buyer, q.number, "accept", null)).rejects.toThrow(/expired/)
    const dto = ManualDto.parse({ quotationId: q.id, delivery: { type: "pickup" } })
    expect((await new Manual(owner).quote(dto)).problems).toEqual([expect.stringMatching(/expired/)])
    await expect(new Manual(owner).create(ManualDto.parse({ ...dto, quotationId: q.id }))).rejects.toThrow(/expired/)
    const list = await new Quotes(owner).list({ status: "EXPIRED", page: 1, perPage: 25 })
    expect(list.rows.map((r) => r.number)).toEqual([q.number])
    expect(list.counts).toMatchObject({ EXPIRED: 1, ORDERED: 1 })
    // Sending again gives it a fresh date.
    expect((await new Quotes(owner).send(BigInt(q.id))).status).toBe("SENT")
    await new Quotes(owner).cancel(BigInt(q.id))
  })

  it("lets approved business accounts ask for a quote on their cart", async () => {
    await expect(new Quotes(as(walkIn)).request(walkIn, { items: [{ productId: shirt, qty: 20 }] })).rejects.toThrow(/business accounts/)
    const r = await new Quotes(as(buyer)).request(buyer, { items: [{ productId: shirt, qty: 20 }], note: "Best price for 20?" })
    expect(r).toMatchObject({ status: "REQUESTED", customerNote: "Best price for 20?", total: 18000, canRespond: false })
    const staffView = (await new Quotes(owner).list({ status: "REQUESTED", page: 1, perPage: 25 })).rows[0]!
    expect(staffView.customer.business).toBe("Rahim Traders")
    // Staff price it; it stays a request until sent.
    const priced = await new Quotes(owner).update(BigInt(staffView.id), { customerId: buyer, discount: 0, deliveryFee: 0, items: lines(870, 20) })
    expect(priced.status).toBe("REQUESTED")
    expect((await new Quotes(owner).send(BigInt(staffView.id))).status).toBe("SENT")
  })
})
