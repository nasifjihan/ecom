/**
 * Batch 57 against a REAL Postgres: an SMS campaign sent once to its audience (opted-out numbers
 * left out, quiet at night), the stop link, the contact form (order check, rate limit, bots) with
 * replies in the inbox, and the product feed. Runs only when RUN_DB_TESTS=1 (SMS go to the log).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import type { RequestContext } from "../../src/core"

const runDb = process.env.RUN_DB_TESTS === "1"

describe.skipIf(!runDb)("Batch 57 campaigns, contact form and feeds (Postgres)", () => {
  let prisma: typeof import("../../src/config/prisma").prisma
  let campaigns: typeof import("../../src/modules/marketing/sms-campaigns")
  let contact: typeof import("../../src/modules/content/contact-messages")
  let Storefront: typeof import("../../src/modules/storefront/storefront.service").StorefrontService
  let storeId: bigint
  const suffix = Date.now().toString(36)
  const ctx = (): RequestContext => ({ storeId, requestId: "t", locale: "en", currency: "BDT" })
  // 11am in Dhaka.
  const day = new Date(Date.UTC(2030, 0, 15, 5))

  beforeAll(async () => {
    ;({ prisma } = await import("../../src/config/prisma"))
    campaigns = await import("../../src/modules/marketing/sms-campaigns")
    contact = await import("../../src/modules/content/contact-messages")
    ;({ StorefrontService: Storefront } = await import("../../src/modules/storefront/storefront.service"))
    storeId = (await prisma.store.create({ data: { name: "B57 Shop", slug: `b57-${suffix}` } })).id
    await prisma.customer.createMany({
      data: [
        { storeId, firstName: "Rina", lastName: "A", phone: "01711000501", email: `rina-${suffix}@x.test`, totalSpent: 9000, orderCount: 2 },
        { storeId, firstName: "Karim", lastName: "U", phone: "+8801711000502", email: `karim-${suffix}@x.test`, totalSpent: 500, orderCount: 1 },
        { storeId, firstName: "Out", lastName: "O", phone: "01711000503", email: `out-${suffix}@x.test`, totalSpent: 9000, orderCount: 3 },
      ],
    })
    await prisma.smsOptOut.create({ data: { storeId, phone: "01711000503" } })
    await prisma.product.create({ data: { storeId, name: "Cotton Panjabi", slug: `pj-${suffix}`, status: "published", regularPrice: 1500, salePrice: 1200, manageStock: false, images: { create: [{ imageUrl: "https://img.test/p.jpg", sortOrder: 0 }] } } })
    await prisma.product.create({ data: { storeId, name: "No Picture", slug: `np-${suffix}`, status: "published", regularPrice: 900, manageStock: false } })
  })

  afterAll(async () => {
    if (!prisma || !storeId) return // setup failed: an undefined id would match every row
    await prisma.order.deleteMany({ where: { storeId } })
    await prisma.product.deleteMany({ where: { storeId } })
    await prisma.customer.deleteMany({ where: { storeId } })
    await prisma.store.delete({ where: { id: storeId } })
    await prisma.$disconnect()
  })

  it("sends a campaign once to the people who match, leaving out opted-out numbers", async () => {
    const svc = new campaigns.SmsCampaigns(ctx())
    const c = await svc.create({ name: "Big spenders", body: "Hi {name}, Eid sale!", audience: { minSpent: 5000 }, stopLink: true })
    expect((await svc.preview({ body: c.body, audience: c.audience, stopLink: true })).people).toBe(1)
    await svc.send(BigInt(c.id))
    // 11pm Dhaka: waits.
    expect((await campaigns.runSmsCampaigns(new Date(Date.UTC(2030, 0, 15, 17)))).paused).toBe(true)
    await campaigns.runSmsCampaigns(day)
    await campaigns.runSmsCampaigns(day)
    const done = await svc.get(BigInt(c.id))
    expect(done).toMatchObject({ status: "sent", recipients: 1, sent: 1 })
    const logged = await prisma.smsMessage.findMany({ where: { storeId, campaignId: BigInt(c.id) } })
    expect(logged).toHaveLength(1)
    expect(logged[0]!.body).toMatch(/^Hi Rina, Eid sale!\nStop: .*\/s\//)
  })

  it("the stop link opts the number out of later campaigns", async () => {
    const r = await prisma.smsCampaignRecipient.findFirstOrThrow({ where: { campaign: { storeId }, phone: "01711000501" } })
    await campaigns.stopByToken(r.stopToken)
    expect(await prisma.smsOptOut.count({ where: { storeId, phone: "01711000501" } })).toBe(1)
  })

  it("takes contact messages, checks the order's phone, ignores bots and limits floods", async () => {
    await expect(contact.sendContactMessage(ctx(), { kind: "order_problem", name: "Karim", phone: "01711000502", message: "Wrong size came", orderNumber: "NOPE-1" }, "10.0.0.1")).rejects.toThrow(/couldn't find that order/)
    expect(await contact.sendContactMessage(ctx(), { kind: "question", name: "Bot", email: "b@x.test", message: "Buy now", website: "spam.test" }, "10.0.0.2")).toEqual({ ok: true })
    expect(await prisma.contactMessage.count({ where: { storeId } })).toBe(0)
    for (let i = 0; i < 5; i++) await contact.sendContactMessage(ctx(), { kind: "callback", name: "Rina", phone: "01711000501", message: "Call me", callbackTime: "after 5pm" }, "10.0.0.3")
    await expect(contact.sendContactMessage(ctx(), { kind: "callback", name: "Rina", phone: "01711000501", message: "Call me" }, "10.0.0.3")).rejects.toThrow(/few messages/)
    const inbox = new contact.ContactInbox(ctx())
    const first = (await inbox.list({ page: 1, perPage: 10 })).items[0]!
    const replied = await inbox.reply(BigInt(first.id), { channel: "note", body: "Called, no answer" })
    expect(replied).toMatchObject({ status: "open", replies: [expect.objectContaining({ channel: "note" })] })
  })

  it("feeds products with a picture at their sale price, and lists the rest as left out", async () => {
    const feed = await new Storefront(ctx()).productFeed()
    expect(feed.items).toEqual([expect.objectContaining({ title: "Cotton Panjabi", price: 1500, salePrice: 1200, availability: "in stock" })])
    expect(feed.excluded).toEqual([expect.objectContaining({ name: "No Picture", reason: "No picture" })])
  })
})
