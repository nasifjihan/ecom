/**
 * Team alerts and "who gets which messages" against a REAL Postgres: the bell, recipients,
 * repeats, SMS to staff, the settings matrix over email templates and SMS events.
 * Runs only when RUN_DB_TESTS=1.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import type { RequestContext } from "../../src/core"

const runDb = process.env.RUN_DB_TESTS === "1"

describe.skipIf(!runDb)("team alerts (Postgres)", () => {
  let prisma: typeof import("../../src/config/prisma").prisma
  let alerts: typeof import("../../src/modules/staff-alerts/staff-alerts.service")
  let events: typeof import("../../src/modules/staff-alerts/staff-alerts.events")
  let Leads: typeof import("../../src/modules/leads/leads.service").LeadsService
  let storeId: bigint
  let owner: bigint
  let packer: bigint
  let seller: bigint
  const suffix = Date.now().toString(36)
  const bell = (id: bigint) => new alerts.StaffInbox(storeId, id).list({ take: 50 })

  beforeAll(async () => {
    ;({ prisma } = await import("../../src/config/prisma"))
    alerts = await import("../../src/modules/staff-alerts/staff-alerts.service")
    events = await import("../../src/modules/staff-alerts/staff-alerts.events")
    ;({ LeadsService: Leads } = await import("../../src/modules/leads/leads.service"))
    storeId = (await prisma.store.create({ data: { name: "Alert Shop", slug: `alerts-${suffix}` } })).id
    const ownerRole = await prisma.role.create({ data: { storeId, name: "Owner", slug: "owner", isSystem: true } })
    const staffRole = await prisma.role.create({ data: { storeId, name: "Staff", slug: `staff-${suffix}` } })
    const mk = (name: string, roleId: bigint, phone: string | null) =>
      prisma.adminUser.create({ data: { storeId, email: `${name}-${suffix}@x.test`, name, passwordHash: "x", roleId, phone } })
    owner = (await mk("Owner", ownerRole.id, "01711111111")).id
    packer = (await mk("Packer", staffRole.id, "01722222222")).id
    seller = (await mk("Seller", staffRole.id, null)).id
  })

  afterAll(async () => {
    if (!prisma) return
    await new Promise((r) => setTimeout(r, 500))
    await prisma.order.deleteMany({ where: { storeId } })
    await prisma.lead.deleteMany({ where: { storeId } })
    await prisma.adminUser.deleteMany({ where: { storeId } })
    await prisma.product.deleteMany({ where: { storeId } })
    await prisma.store.delete({ where: { id: storeId } })
    await prisma.$disconnect()
  })

  it("puts a new-order alert in the owners' bell by default, and lets them read it", async () => {
    const n = await alerts.alertStaff(storeId, "payment_to_verify", { title: "Payment to check on order 1001", link: "/orders/payments" })
    expect(n).toBe(1)
    const mine = await bell(owner)
    expect(mine.unread).toBe(1)
    expect(mine.items[0]).toMatchObject({ title: "Payment to check on order 1001", link: "/orders/payments", read: false })
    expect((await bell(packer)).items).toHaveLength(0)
    await new alerts.StaffInbox(storeId, owner).read(BigInt(mine.items[0]!.id))
    expect((await bell(owner)).unread).toBe(0)
    // Someone else can't mark it.
    await expect(new alerts.StaffInbox(storeId, packer).read(BigInt(mine.items[0]!.id))).rejects.toThrow()
  })

  it("follows the people and channels chosen in the matrix, with SMS to those with a mobile", async () => {
    const m = new alerts.NotificationMatrix(storeId, owner)
    await m.save({ staff: [{ event: "payment_to_verify", inApp: true, sms: true, staffIds: [packer, seller] }] })
    const n = await alerts.alertStaff(storeId, "payment_to_verify", { title: "Payment to check on order 1002 · ৳2,450" })
    expect(n).toBe(2)
    expect((await bell(packer)).unread).toBe(1)
    expect((await bell(seller)).unread).toBe(1)
    expect((await bell(owner)).unread).toBe(0)
    const sms = await prisma.smsMessage.findMany({ where: { storeId, kind: "staff_payment_to_verify" } })
    expect(sms.map((s) => [s.to, s.body])).toEqual([["01722222222", "Alert Shop: Payment to check on order 1002 - Tk 2,450"]])
    await new alerts.StaffInbox(storeId, packer).readAll()
    expect((await bell(packer)).unread).toBe(0)
  })

  it("says low stock once a day per product, even with the bell off", async () => {
    const p = await prisma.product.create({ data: { storeId, name: "Katan Saree", slug: `saree-${suffix}`, regularPrice: 9000, manageStock: true, stockQty: 3, lowStockThreshold: 5 } })
    const order = await prisma.order.create({
      data: {
        storeId, number: `A-${suffix}`, orderKey: `k-${suffix}`, itemsSubtotal: 9000, grandTotal: 9000, currencyCode: "BDT",
        paymentGatewayCode: "cod", shippingMethodCode: "pickup", shippingMethodName: "Pickup",
        billingFirstName: "Rahima", billingLastName: "K", billingCountryCode: "BD", billingAddress1: "x", billingCity: "Dhaka",
        items: { create: [{ productId: p.id, productName: "Katan Saree", quantity: 1, unitPrice: 9000, lineSubtotal: 9000, lineTotal: 9000 }] },
      },
    })
    await events.lowStockAlerts(storeId, order.id)
    await events.lowStockAlerts(storeId, order.id)
    const own = await bell(owner)
    expect(own.items.filter((i) => i.title.startsWith("Low stock")).map((i) => i.title)).toEqual(["Low stock: Katan Saree, 3 left"])

    await new alerts.NotificationMatrix(storeId).save({ staff: [{ event: "low_stock", inApp: false, email: true }] })
    await prisma.staffNotice.deleteMany({ where: { storeId, event: "low_stock" } })
    await events.lowStockAlerts(storeId, order.id)
    expect((await bell(owner)).items.filter((i) => i.title.startsWith("Low stock"))).toHaveLength(0)
    expect(await prisma.staffNotice.count({ where: { storeId, event: "low_stock", hidden: true } })).toBe(1)
    const mails = await prisma.notification.findMany({ where: { storeId, eventKey: "staff_alert" }, select: { title: true } })
    expect(mails.map((m) => m.title)).toEqual(["Low stock: Katan Saree, 3 left"])
    expect(await alerts.alertStaff(storeId, "low_stock", { title: "again", refKey: `stock:${p.id}:`, onceWithinHours: 24 })).toBe(0)

    await events.newOrderAlert(storeId, order.id)
    expect((await bell(owner)).items[0]!.title).toBe(`New order A-${suffix} · ৳9,000`)
  })

  it("tells a staff member when a lead is given to them, not when they take it themselves", async () => {
    const asOwner: RequestContext = { storeId, requestId: "t", locale: "en", currency: "BDT", admin: { id: owner, role: "ADMIN", permissions: ["*"] } }
    const asSeller: RequestContext = { ...asOwner, admin: { id: seller, role: "ADMIN", permissions: ["*"] } }
    const before = (await bell(seller)).unread
    const l = await new Leads(asOwner).create({ name: "Nusrat", phone: "01733333333", channel: "instagram", ownerId: seller })
    await new Promise((r) => setTimeout(r, 300))
    const after = await bell(seller)
    expect(after.unread).toBe(before + 1)
    expect(after.items[0]).toMatchObject({ title: "Owner gave you a lead: Nusrat", link: `/customers/leads/${l.id}` })
    await new Leads(asSeller).create({ name: "Mitu", phone: "01744444444", channel: "facebook" })
    await new Promise((r) => setTimeout(r, 300))
    expect((await bell(seller)).unread).toBe(before + 1)
  })

  it("shows and saves customer messages through the email templates and SMS settings", async () => {
    const m = new alerts.NotificationMatrix(storeId, owner)
    const first = await m.get()
    expect(first.customers.find((c) => c.key === "order_shipped")).toMatchObject({ email: true, sms: true })
    expect(first.customers.find((c) => c.key === "order_refunded")).toMatchObject({ sms: null })
    expect(first.staff.find((s) => s.event === "new_order")).toMatchObject({ inApp: true, email: true, emailTemplate: "order_new_admin" })
    const saved = await m.save({
      customers: [{ key: "order_shipped", email: false, sms: false }, { key: "order_delivered", sms: true }],
      staff: [{ event: "new_order", email: false }],
    })
    expect(saved.customers.find((c) => c.key === "order_shipped")).toMatchObject({ email: false, sms: false })
    expect(saved.customers.find((c) => c.key === "order_delivered")).toMatchObject({ sms: true })
    expect(saved.staff.find((s) => s.event === "new_order")!.email).toBe(false)
    const tpl = await prisma.emailTemplate.findUnique({ where: { storeId_systemKey: { storeId, systemKey: "order_shipped_customer" } } })
    expect(tpl?.enabled).toBe(false)
    await expect(m.save({ staff: [{ event: "nope" }] })).rejects.toThrow(/Unknown alert/)
  })
})
