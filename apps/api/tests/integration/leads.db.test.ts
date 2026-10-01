/**
 * CRM leads against a REAL Postgres: adding, duplicates, timeline, follow-ups, making a
 * customer and winning a lead with a staff order. Runs only when RUN_DB_TESTS=1.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import type { RequestContext } from "../../src/core"

const runDb = process.env.RUN_DB_TESTS === "1"

describe.skipIf(!runDb)("CRM leads (Postgres)", () => {
  let prisma: typeof import("../../src/config/prisma").prisma
  let Leads: typeof import("../../src/modules/leads/leads.service").LeadsService
  let Manual: typeof import("../../src/modules/orders/manual-order").ManualOrderService
  let ManualDto: typeof import("../../src/modules/orders/manual-order").ManualOrderDto
  let storeId: bigint
  let productId: bigint
  let rina: bigint
  let karim: bigint
  let asRina: RequestContext
  const suffix = Date.now().toString(36)

  beforeAll(async () => {
    ;({ prisma } = await import("../../src/config/prisma"))
    ;({ LeadsService: Leads } = await import("../../src/modules/leads/leads.service"))
    ;({ ManualOrderService: Manual, ManualOrderDto: ManualDto } = await import("../../src/modules/orders/manual-order"))
    storeId = (await prisma.store.create({ data: { name: "Leads Test", slug: `leads-${suffix}` } })).id
    await prisma.paymentGatewayConfig.create({ data: { storeId, code: "cod", name: "Cash on delivery", enabled: true } })
    productId = (await prisma.product.create({ data: { storeId, name: "Panjabi", slug: `panjabi-${suffix}`, status: "published", regularPrice: 2500, manageStock: false } })).id
    const role = await prisma.role.create({ data: { storeId, name: "Sales", slug: `sales-${suffix}` } })
    const mk = (name: string, isSalesperson: boolean) =>
      prisma.adminUser.create({ data: { storeId, email: `${name}-${suffix}@x.test`, name, passwordHash: "x", roleId: role.id, isSalesperson } })
    rina = (await mk("Rina", true)).id
    karim = (await mk("Karim", false)).id
    asRina = { storeId, requestId: "test", locale: "en", currency: "BDT", admin: { id: rina, role: "ADMIN", permissions: ["leads.view", "leads.create", "leads.edit", "orders.create"] } }
  })

  afterAll(async () => {
    if (!prisma) return
    await new Promise((r) => setTimeout(r, 300))
    await prisma.lead.deleteMany({ where: { storeId } })
    await prisma.order.deleteMany({ where: { storeId } })
    await prisma.salesCommission.deleteMany({ where: { storeId } })
    await prisma.adminUser.deleteMany({ where: { storeId } })
    await prisma.product.deleteMany({ where: { storeId } })
    await prisma.customer.deleteMany({ where: { storeId } })
    await prisma.store.delete({ where: { id: storeId } })
    await prisma.$disconnect()
  })

  it("adds a lead for whoever adds it, refuses a second open lead for the same phone and links a known customer", async () => {
    const known = await prisma.customer.create({ data: { storeId, firstName: "Old", lastName: "Buyer", phone: "+8801922222222" } })
    const svc = new Leads(asRina)
    const a = await svc.create({ name: "Rahima Khatun", phone: "01711 000111", channel: "facebook", handle: "https://facebook.com/rahima.k/", tags: ["Eid", "eid"], interest: "Eid panjabi set, size 42", value: 5000, note: "Commented on the Eid post" })
    expect(a).toMatchObject({ phone: "01711000111", handle: "rahima.k", tags: ["eid"], status: "new", value: 5000, customer: null })
    expect(a.owner?.name).toBe("Rina")
    expect(a.notes.map((n) => n.body)).toEqual(["Commented on the Eid post", "Lead added"])
    await expect(svc.create({ name: "Rahima again", phone: "+8801711000111", channel: "instagram" })).rejects.toThrow(/already has an open lead/)
    await expect(svc.create({ name: "Nobody", channel: "facebook" })).rejects.toThrow(/phone number, an email/)
    const b = await svc.create({ name: "Old Buyer", phone: "01922222222", channel: "phone", ownerId: null })
    expect(b.customer?.id).toBe(String(known.id))
    expect(b.owner).toBeNull()
  })

  it("logs calls as contact, sets follow-ups and filters what's due", async () => {
    const svc = new Leads(asRina)
    const l = await svc.create({ name: "Sumon", phone: "01811000222", channel: "whatsapp" })
    const yesterday = new Date(Date.now() - 2 * 86_400_000)
    const after = await svc.addNote(BigInt(l.id), { kind: "call", body: "Wants 3 pieces, will confirm Friday", nextFollowUpAt: yesterday })
    expect(after.status).toBe("contacted")
    expect(after.lastContactAt).not.toBeNull()
    expect(after.followUp).toBe("overdue")
    const list = await svc.list({ due: "overdue", page: 1, perPage: 25 })
    expect(list.items.map((i) => i.name)).toEqual(["Sumon"])
    expect(list.meta.overdue).toBe(1)
    const mine = await svc.list({ owner: "me", status: "open", page: 1, perPage: 25 })
    expect(mine.items.map((i) => i.name).sort()).toEqual(["Rahima Khatun", "Sumon"])
    expect(mine.meta.counts).toMatchObject({ new: 1, contacted: 1 })
    expect((await svc.list({ tag: "EID", page: 1, perPage: 25 })).items.map((i) => i.name)).toEqual(["Rahima Khatun"])
    expect((await svc.list({ search: "@rahima.k", page: 1, perPage: 25 })).items).toHaveLength(1)
    expect(await svc.tags()).toEqual(["eid"])
  })

  it("loses a lead with a reason, reopens it, and hands it to someone else", async () => {
    const svc = new Leads(asRina)
    const l = (await svc.list({ search: "Sumon", page: 1, perPage: 5 })).items[0]!
    await expect(svc.setStatus(BigInt(l.id), "lost", "")).rejects.toThrow(/why/)
    await expect(svc.setStatus(BigInt(l.id), "won", null)).rejects.toThrow(/order/)
    const lost = await svc.setStatus(BigInt(l.id), "lost", "Bought elsewhere")
    expect(lost).toMatchObject({ status: "lost", lostReason: "Bought elsewhere", nextFollowUpAt: null })
    expect(lost.closedAt).not.toBeNull()
    const back = await svc.setStatus(BigInt(l.id), "interested", null)
    expect(back).toMatchObject({ status: "interested", lostReason: null, closedAt: null })
    const moved = await svc.update(BigInt(l.id), { ownerId: karim })
    expect(moved.owner?.name).toBe("Karim")
    expect(moved.notes[0]!.body).toBe("Given to Karim")
  })

  it("makes a customer from the lead, and an order from it wins the lead and credits whoever follows it", async () => {
    const svc = new Leads(asRina)
    const l = (await svc.list({ search: "Rahima", page: 1, perPage: 5 })).items[0]!
    const made = await svc.makeCustomer(BigInt(l.id))
    expect(made.created).toBe(true)
    const c = await prisma.customer.findUniqueOrThrow({ where: { id: BigInt(made.customerId) } })
    expect(c).toMatchObject({ firstName: "Rahima", lastName: "Khatun", phone: "01711000111", source: "facebook" })
    expect((await svc.makeCustomer(BigInt(l.id))).created).toBe(false)

    // Karim (not on the sales team) enters the order; Rina follows the lead, so she is credited.
    const asKarim: RequestContext = { ...asRina, admin: { id: karim, role: "ADMIN", permissions: ["orders.create"] } }
    const o = await new Manual(asKarim).create(
      ManualDto.parse({ customer: { id: made.customerId }, items: [{ productId, qty: 2 }], delivery: { type: "pickup" }, applyPromotions: false, leadId: l.id }),
    )
    const won = await svc.get(BigInt(l.id))
    expect(won).toMatchObject({ status: "won", orderId: o.id, orderNumber: o.number, customer: { id: made.customerId } })
    expect(won.notes[0]!.body).toBe(`New → Won: order ${o.number}`)
    const order = await prisma.order.findUniqueOrThrow({ where: { id: BigInt(o.id) }, select: { salespersonId: true } })
    expect(order.salespersonId).toBe(rina)
    // A won lead can't make a second order.
    await expect(
      new Manual(asKarim).create(ManualDto.parse({ customer: { id: made.customerId }, items: [{ productId, qty: 1 }], delivery: { type: "pickup" }, leadId: l.id })),
    ).rejects.toThrow(/already has its order/)
  })
})
