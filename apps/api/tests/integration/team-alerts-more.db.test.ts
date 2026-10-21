/**
 * The newer team alerts against a real Postgres: a review waiting for approval, a product
 * question, a parcel with no courier update for days, and team alerts on WhatsApp for staff who
 * turned them on. Runs only when RUN_DB_TESTS=1.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import type { RequestContext } from "../../src/core"

const runDb = process.env.RUN_DB_TESTS === "1"

describe.skipIf(!runDb)("more team alerts (Postgres)", () => {
  let prisma: typeof import("../../src/config/prisma").prisma
  let alerts: typeof import("../../src/modules/staff-alerts/staff-alerts.service")
  let Engagement: typeof import("../../src/modules/storefront/engagement").StorefrontEngagement
  let Couriers: typeof import("../../src/modules/couriers/couriers.service").CouriersService
  let storeId: bigint | undefined
  let owner: bigint
  let productId: bigint
  let customerId: bigint
  const suffix = Date.now().toString(36)
  /** Alerts are sent in the background: wait until the bell has them. */
  const notices = async (event: string, want = 1) => {
    for (let i = 0; i < 40; i++) {
      const rows = await prisma.staffNotice.findMany({ where: { storeId, event } })
      if (rows.length >= want) return rows
      await new Promise((r) => setTimeout(r, 100))
    }
    return prisma.staffNotice.findMany({ where: { storeId, event } })
  }

  beforeAll(async () => {
    ;({ prisma } = await import("../../src/config/prisma"))
    alerts = await import("../../src/modules/staff-alerts/staff-alerts.service")
    ;({ StorefrontEngagement: Engagement } =
      await import("../../src/modules/storefront/engagement"))
    ;({ CouriersService: Couriers } = await import("../../src/modules/couriers/couriers.service"))
    storeId = (
      await prisma.store.create({ data: { name: "Alerts Two", slug: `alerts2-${suffix}` } })
    ).id
    const role = await prisma.role.create({
      data: { storeId, name: "Owner", slug: "owner", isSystem: true },
    })
    owner = (
      await prisma.adminUser.create({
        data: {
          storeId,
          email: `o-${suffix}@x.test`,
          name: "Owner",
          passwordHash: "x",
          roleId: role.id,
          phone: "01711111111",
        },
      })
    ).id
    productId = (
      await prisma.product.create({
        data: {
          storeId,
          name: "Silk Saree",
          slug: `saree-${suffix}`,
          status: "published",
          regularPrice: 9000,
        },
      })
    ).id
    customerId = (
      await prisma.customer.create({
        data: { storeId, email: `c-${suffix}@x.test`, firstName: "Mina", lastName: "Akter" },
      })
    ).id
  })

  afterAll(async () => {
    if (!prisma || !storeId) return // setup failed: an undefined id would match every row
    await new Promise((r) => setTimeout(r, 300))
    await prisma.order.deleteMany({ where: { storeId } })
    await prisma.review.deleteMany({ where: { storeId } })
    await prisma.customer.deleteMany({ where: { storeId } })
    await prisma.adminUser.deleteMany({ where: { storeId } })
    await prisma.product.deleteMany({ where: { storeId } })
    await prisma.store.delete({ where: { id: storeId } })
    await prisma.$disconnect()
  })

  const ctx = (customer?: bigint): RequestContext => ({
    storeId,
    requestId: "t",
    locale: "en",
    currency: "BDT",
    ...(customer ? { customer: { id: customer } } : {}),
  })

  it("a review from someone who didn't buy it waits, and the owners hear about it", async () => {
    const r = await new Engagement(ctx(customerId)).submitReview(productId, {
      rating: 4,
      title: "Lovely colour",
    })
    expect(r.status).toBe("pending")
    const [n] = await notices("review_waiting")
    expect(n).toMatchObject({
      adminId: owner,
      title: "Review to approve: ★★★★ on Silk Saree",
      link: "/marketing/reviews",
    })
    expect(n!.body).toContain("Lovely colour")
  })

  it("a product question is an alert too", async () => {
    await new Engagement(ctx()).askQuestion(productId, {
      name: "Karim",
      question: "Is it pure silk?",
    })
    const [n] = await notices("question_waiting")
    expect(n).toMatchObject({
      title: "Question on Silk Saree",
      body: "Karim: Is it pure silk?",
      link: "/marketing/questions",
    })
  })

  it("a booked parcel with no courier update for 3 days is a courier problem, once", async () => {
    const order = await prisma.order.create({
      data: {
        storeId: storeId!,
        number: `AL${suffix}`,
        orderKey: `ok_al_${suffix}_secretkey`,
        status: "SHIPPED",
        billingFirstName: "Mina",
        billingLastName: "Akter",
        billingPhone: "01712345678",
        billingAddress1: "House 1",
        billingCity: "Dhaka",
        billingCountryCode: "BD",
        itemsSubtotal: 9000,
        grandTotal: 9000,
        currencyCode: "BDT",
        paymentGatewayCode: "cod",
        shippingMethodCode: "std",
        shippingMethodName: "Standard",
      },
    })
    const old = new Date(Date.now() - 5 * 86_400_000)
    await prisma.shipment.create({
      data: {
        storeId: storeId!,
        orderId: order.id,
        code: `P-${suffix}`,
        status: "in_transit",
        providerCode: "pathao",
        providerName: "Pathao",
        consignmentId: `CN${suffix}`,
        createdAt: old,
        events: { create: [{ status: "in_transit", createdAt: old }] },
      },
    })
    // A parcel updated yesterday isn't stuck.
    const fresh = new Date(Date.now() - 86_400_000)
    await prisma.shipment.create({
      data: {
        storeId: storeId!,
        orderId: order.id,
        code: `Q-${suffix}`,
        status: "in_transit",
        providerCode: "pathao",
        providerName: "Pathao",
        consignmentId: `CQ${suffix}`,
        createdAt: old,
        events: { create: [{ status: "in_transit", createdAt: fresh }] },
      },
    })
    await Couriers.stuckParcelAlerts()
    const rows = await notices("courier_problem")
    expect(rows).toHaveLength(1)
    expect(rows[0]!.title).toBe(`No courier update for 3 days: P-${suffix} (order AL${suffix})`)
    await Couriers.stuckParcelAlerts() // the next run doesn't repeat it
    await new Promise((r) => setTimeout(r, 400))
    expect(await prisma.staffNotice.count({ where: { storeId, event: "courier_problem" } })).toBe(1)
  })

  it("team alerts go by WhatsApp only with the alert's switch on and the person's own yes", async () => {
    await prisma.staffAlertSetting.create({
      data: { storeId: storeId!, event: "payment_review", inApp: true, whatsapp: true },
    })
    await alerts.alertStaff(storeId!, "payment_review", {
      title: "Online payment to check on order 1001",
    })
    expect(await prisma.whatsappMessage.count({ where: { storeId } })).toBe(0) // not turned on by the owner
    await prisma.adminUser.update({ where: { id: owner }, data: { whatsappAlerts: true } })
    await alerts.alertStaff(storeId!, "payment_review", {
      title: "Online payment to check on order 1002",
    })
    const m = await prisma.whatsappMessage.findFirstOrThrow({ where: { storeId } })
    expect(m).toMatchObject({
      to: "8801711111111",
      kind: "staff_payment_review",
      template: "staff_alert",
      status: "logged",
    })
    expect(m.params).toEqual(["Alerts Two", "Online payment to check on order 1002"])
  })
})
