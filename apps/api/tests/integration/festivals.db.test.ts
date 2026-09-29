/**
 * The festival calendar against a REAL Postgres: built-in festivals added once per year, dates
 * checked, linked campaigns and their dates, the checklist, last year's sales, and the reminder
 * email sent once. Runs only when RUN_DB_TESTS=1.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import type { RequestContext } from "../../src/core"

const runDb = process.env.RUN_DB_TESTS === "1"

describe.skipIf(!runDb)("festival calendar (Postgres)", () => {
  let prisma: typeof import("../../src/config/prisma").prisma
  let Festivals: typeof import("../../src/modules/festivals/festivals.service").FestivalsService
  let rules: typeof import("../../src/modules/festivals/festival.rules")
  let storeId: bigint
  let owner: RequestContext
  let viewer: RequestContext
  let promoId: bigint
  let couponId: bigint
  let otherPromo: bigint
  let seq = 0
  const suffix = Date.now().toString(36)

  const order = (at: string, total: number, status: "PROCESSING" | "CANCELLED" = "PROCESSING") =>
    prisma.order.create({
      data: {
        storeId,
        number: `FS${suffix}${++seq}`,
        orderKey: `ok_fs_${suffix}_${seq}`,
        status,
        billingFirstName: "A",
        billingLastName: "B",
        billingAddress1: "House 1",
        billingCity: "Dhaka",
        billingCountryCode: "BD",
        itemsSubtotal: total,
        grandTotal: total,
        currencyCode: "BDT",
        paymentGatewayCode: "cod",
        shippingMethodCode: "std",
        shippingMethodName: "Standard",
        createdAt: new Date(at),
      },
    })

  beforeAll(async () => {
    ;({ prisma } = await import("../../src/config/prisma"))
    ;({ FestivalsService: Festivals } = await import("../../src/modules/festivals/festivals.service"))
    rules = await import("../../src/modules/festivals/festival.rules")
    storeId = (await prisma.store.create({ data: { name: "Festival Test", slug: `fs-${suffix}` } })).id
    const other = (await prisma.store.create({ data: { name: "Other", slug: `fso-${suffix}` } })).id
    owner = { storeId, requestId: "test", locale: "en", currency: "BDT", admin: { id: 1n, role: "OWNER", permissions: ["*"] } }
    viewer = { ...owner, admin: { id: 2n, role: "ADMIN", permissions: ["promotions.view"] } }
    promoId = (await prisma.promotion.create({ data: { storeId, name: "Eid 10% off", type: "discount", discountType: "percentage", discountValue: 10 } })).id
    couponId = (await prisma.coupon.create({ data: { storeId, code: `EID${suffix}`.toUpperCase(), type: "PERCENTAGE", amount: 5 } })).id
    otherPromo = (await prisma.promotion.create({ data: { storeId: other, name: "Not ours", type: "discount" } })).id
    const role = await prisma.role.create({ data: { storeId, name: "Owner", slug: "owner" } })
    await prisma.adminUser.create({ data: { storeId, email: `owner-${suffix}@x.test`, name: "Owner", passwordHash: "x", roleId: role.id } })
    // Eid-ul-Fitr 2025 was on 31 March: sales in the weeks before it.
    await order("2025-03-20T10:00:00+06:00", 2000)
    await order("2025-03-30T22:00:00+06:00", 3000)
    await order("2025-03-25T10:00:00+06:00", 9999, "CANCELLED")
    await order("2025-04-10T10:00:00+06:00", 5000)
  })

  afterAll(async () => {
    if (!prisma) return
    await new Promise((r) => setTimeout(r, 500)) // background emails
    await prisma.notification.deleteMany({ where: { storeId } })
    await prisma.order.deleteMany({ where: { storeId } })
    await prisma.adminUser.deleteMany({ where: { storeId } })
    await prisma.store.deleteMany({ where: { slug: { in: [`fs-${suffix}`, `fso-${suffix}`] } } })
    await prisma.$disconnect()
  })

  it("adds the built-in festivals of a year once", async () => {
    const first = await new Festivals(owner).addPresets(2026)
    expect(first).toEqual({ added: 14, unknownDates: [] })
    expect((await new Festivals(owner).addPresets(2026)).added).toBe(0)
    const { festivals, presetsToAdd } = await new Festivals(owner).list(2026)
    expect(presetsToAdd).toBe(0)
    expect(festivals.map((f) => f.key).slice(0, 4)).toEqual(["pohela_falgun", "ramadan", "ekushey", "eid_ul_fitr"])
    const eid = festivals.find((f) => f.key === "eid_ul_fitr")!
    expect(eid).toMatchObject({ startsOn: "2026-03-21", saleFrom: "2026-02-24", dateIsEstimate: true, tasks: { done: 0, total: 7 } })
  })

  it("shows the same weeks last year, moved with the moon", async () => {
    const { festivals } = await new Festivals(owner).list(2026)
    const eid = await new Festivals(owner).get(BigInt(festivals.find((f) => f.key === "eid_ul_fitr")!.id))
    expect(eid.lastYear).toEqual({ from: "2025-03-06", to: "2025-04-02", orders: 2, sales: 5000 })
  })

  it("checks dates and only links the store's own campaigns", async () => {
    const base = { name: "Winter sale", startsOn: "2026-12-20", endsOn: "2026-12-31", saleFrom: "2026-12-15", saleTo: "2026-12-31" }
    await expect(new Festivals(owner).create({ ...base, saleTo: "2026-12-10" })).rejects.toThrow(/sale ends before it starts/)
    await expect(new Festivals(owner).create({ ...base, links: { promotion: [String(otherPromo)] } })).rejects.toThrow(/wasn't found/)
    const f = await new Festivals(owner).create({
      ...base,
      checklist: [{ id: "", text: "Warm clothes on the homepage", done: false }, { id: "", text: "  ", done: false }],
      links: { promotion: [String(promoId)], coupon: [String(couponId)] },
    })
    expect(f.checklist).toEqual([{ id: "t1", text: "Warm clothes on the homepage", done: false }])
    expect(f.links.map((l) => [l.kind, l.coverage, l.canMatch])).toEqual([
      ["promotion", "always", true],
      ["coupon", "always", true],
    ])
    expect(await new Festivals(owner).setTask(BigInt(f.id), "t1", true)).toEqual({ done: 1, total: 1 })
  })

  it("sets a linked campaign to run for the sale, if staff may change it", async () => {
    const { festivals } = await new Festivals(owner).list(2026)
    const winter = festivals.find((f) => f.name === "Winter sale")!
    const seen = await new Festivals(viewer).get(BigInt(winter.id))
    expect(seen.links.every((l) => !l.canMatch)).toBe(true)
    await expect(new Festivals(viewer).matchDates(BigInt(winter.id), "promotion", promoId)).rejects.toThrow(/can't change/)

    const after = await new Festivals(owner).matchDates(BigInt(winter.id), "promotion", promoId)
    expect(after.links.find((l) => l.kind === "promotion")!.coverage).toBe("covers")
    const p = await prisma.promotion.findUnique({ where: { id: promoId } })
    expect([p!.startsAt!.toISOString(), p!.endsAt!.toISOString()]).toEqual(["2026-12-14T18:00:00.000Z", "2026-12-31T17:59:59.000Z"])
    await expect(new Festivals(owner).matchDates(BigInt(winter.id), "flash_sale", 1n)).rejects.toThrow(/not found/i)
  })

  it("emails the team once when the reminder day comes, and again after the sale moves", async () => {
    const today = rules.dhakaToday()
    const soon = await new Festivals(owner).create({
      name: "Shop anniversary",
      startsOn: rules.addDays(today, 10),
      endsOn: rules.addDays(today, 10),
      saleFrom: rules.addDays(today, 5),
      saleTo: rules.addDays(today, 10),
      remindDays: 7,
      checklist: [{ id: "t1", text: "Order gift bags", done: false }],
    })
    const run = await Festivals.sendDueReminders()
    expect(run.sent).toBeGreaterThanOrEqual(1)
    // Durga Puja's reminder may be due too, depending on today's date: look for this one.
    const mine = { storeId, eventKey: "festival_reminder_admin", title: { startsWith: "Shop anniversary" } }
    const mail = await prisma.notification.findFirst({ where: mine })
    expect(mail?.title).toBe("Shop anniversary: the sale starts in 5 days")
    expect(mail?.body).toContain("Order gift bags")
    expect((await prisma.festival.findUnique({ where: { id: BigInt(soon.id) } }))!.remindedAt).not.toBeNull()

    await Festivals.sendDueReminders()
    expect(await prisma.notification.count({ where: mine })).toBe(1)

    // Moving the sale means a new reminder.
    const moved = await new Festivals(owner).update(BigInt(soon.id), {
      name: "Shop anniversary",
      startsOn: soon.startsOn,
      endsOn: soon.endsOn,
      saleFrom: rules.addDays(today, 3),
      saleTo: soon.saleTo,
      remindDays: 7,
      checklist: soon.checklist,
    })
    expect(moved.remindedAt).toBeNull()
    expect((await new Festivals(owner).upcoming()).some((f) => f.name === "Shop anniversary")).toBe(true)
  })
})
