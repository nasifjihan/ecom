/**
 * Newsletter list, staff-made customers and bans against a REAL Postgres.
 * Runs only when RUN_DB_TESTS=1.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import type { RequestContext } from "../../src/core"

const runDb = process.env.RUN_DB_TESTS === "1"

describe.skipIf(!runDb)("newsletter, staff-made customers and bans (Postgres)", () => {
  let prisma: typeof import("../../src/config/prisma").prisma
  let Storefront: typeof import("../../src/modules/storefront/storefront.service").StorefrontService
  let Newsletter: typeof import("../../src/modules/customers/newsletter.service").NewsletterService
  let Customers: typeof import("../../src/modules/customers/customers.service").CustomersService
  let ban: typeof import("../../src/modules/customers/customer-ban")
  let PlaceOrderDto: typeof import("../../src/modules/storefront/storefront.dto").PlaceOrderDto
  let CreateCustomerDto: typeof import("../../src/modules/customers/customers.dto").CreateCustomerDto
  let storeId: bigint
  let productId: bigint
  let methodId: bigint
  let ctx: RequestContext
  let admin: RequestContext
  const suffix = Date.now().toString(36)
  const address = (phone: string) => ({ firstName: "Karim", lastName: "Mia", country: "BD", district: "Dhaka", addressLine1: "House 2, Road 5, Mirpur", phone })
  const order = (over: Record<string, unknown> = {}, as: RequestContext = ctx) =>
    new Storefront(as).placeOrder(
      PlaceOrderDto.parse({
        phone: "01911111111",
        shippingAddress: address("01911111111"),
        shippingMethodId: String(methodId),
        paymentGateway: "cod",
        items: [{ productId: String(productId), qty: 1 }],
        termsAgreed: true,
        ...over,
      }),
    )

  beforeAll(async () => {
    ;({ prisma } = await import("../../src/config/prisma"))
    ;({ StorefrontService: Storefront } = await import("../../src/modules/storefront/storefront.service"))
    ;({ NewsletterService: Newsletter } = await import("../../src/modules/customers/newsletter.service"))
    ;({ CustomersService: Customers } = await import("../../src/modules/customers/customers.service"))
    ban = await import("../../src/modules/customers/customer-ban")
    ;({ PlaceOrderDto } = await import("../../src/modules/storefront/storefront.dto"))
    ;({ CreateCustomerDto } = await import("../../src/modules/customers/customers.dto"))
    storeId = (await prisma.store.create({ data: { name: "CRM Test", slug: `crm-${suffix}` } })).id
    ctx = { storeId, requestId: "test", locale: "en", currency: "BDT" }
    admin = { ...ctx, admin: { id: 1n, role: "OWNER", permissions: ["*"] } }
    await prisma.paymentGatewayConfig.create({ data: { storeId, code: "cod", name: "Cash on delivery", enabled: true } })
    productId = (await prisma.product.create({ data: { storeId, name: "Tee", slug: `tee-${suffix}`, status: "published", regularPrice: 500, manageStock: false } })).id
    const zone = await prisma.shippingZone.create({
      data: { storeId, name: "Everywhere", countries: ["BD"], methods: { create: [{ code: "std", name: "Standard", baseCost: 60 }] } },
      include: { methods: true },
    })
    methodId = zone.methods[0]!.id
  })

  afterAll(async () => {
    if (!prisma) return
    await new Promise((r) => setTimeout(r, 500)) // background emails
    await prisma.order.deleteMany({ where: { storeId } })
    await prisma.customer.deleteMany({ where: { storeId } })
    await prisma.product.deleteMany({ where: { storeId } })
    await prisma.store.delete({ where: { id: storeId } })
    await prisma.$disconnect()
  })

  it("lets staff add a customer with just a phone and where they came from", async () => {
    const c = (await new Customers(admin).createCustomer(CreateCustomerDto.parse({ firstName: "Karim", lastName: "Mia", phone: "01911111111", email: "", source: "facebook" }))) as { id: bigint; email: string | null; source: string }
    expect(c).toMatchObject({ email: null, source: "facebook" })
    await expect(
      new Customers(admin).createCustomer(CreateCustomerDto.parse({ firstName: "Karim", lastName: "Again", phone: "+8801911111111", source: "phone" })),
    ).rejects.toThrow(/already has the phone/)
    expect(() => CreateCustomerDto.parse({ firstName: "No", lastName: "Contact" })).toThrow(/phone number or an email/)
  })

  it("keeps one row per address, syncs the customer and only lets the person come back", async () => {
    const n = new Newsletter(storeId)
    await prisma.customer.create({ data: { storeId, firstName: "Ayesha", lastName: "R", email: "ayesha@example.com" } })
    const s = await n.subscribe({ email: " Ayesha@Example.com ", source: "footer" })
    expect(s).toMatchObject({ email: "ayesha@example.com", status: "subscribed", source: "footer" })
    await n.subscribe({ email: "ayesha@example.com", source: "checkout" })
    expect(await prisma.newsletterSubscriber.count({ where: { storeId } })).toBe(1)
    expect((await prisma.customer.findFirstOrThrow({ where: { storeId, email: "ayesha@example.com" } })).acceptMarketing).toBe(true)
    await expect(n.subscribe({ email: "nope", source: "footer" })).rejects.toThrow(/valid email/)

    const token = (await prisma.newsletterSubscriber.findFirstOrThrow({ where: { storeId } })).token
    expect(await n.unsubscribeByToken(token)).toEqual({ email: "ay***@example.com" })
    expect((await prisma.customer.findFirstOrThrow({ where: { storeId, email: "ayesha@example.com" } })).acceptMarketing).toBe(false)
    await expect(n.subscribe({ email: "ayesha@example.com", source: "admin" })).rejects.toThrow(/Only they can sign up again/)
    await expect(n.unsubscribeByToken("not-a-real-token-123")).rejects.toThrow(/not found/i)
    expect((await n.subscribe({ email: "ayesha@example.com", source: "footer" })).status).toBe("subscribed")

    const list = await n.list({ page: 1, perPage: 25 })
    expect(list.meta).toMatchObject({ total: 1, subscribed: 1, unsubscribed: 0 })
    expect(await n.csv({})).toMatch(/^email,name,status,source,language,signed_up\nayesha@example.com,,subscribed,footer,en,\d{4}-\d{2}-\d{2}\n$/)
  })

  it("subscribes from checkout when ticked", async () => {
    await order({ email: "buyer@example.com", subscribeNewsletter: true })
    expect((await prisma.newsletterSubscriber.findFirstOrThrow({ where: { storeId, email: "buyer@example.com" } })).source).toBe("checkout")
  })

  it("refuses orders from a banned customer, signed in or as a guest with their phone or email", async () => {
    const karim = await prisma.customer.findFirstOrThrow({ where: { storeId, phone: "01911111111" } })
    await expect(ban.banCustomer(storeId, karim.id, "x")).rejects.toThrow(/Say why/)
    await ban.banCustomer(storeId, karim.id, "Refused 3 COD parcels")
    const banned = await prisma.customer.findUniqueOrThrow({ where: { id: karim.id } })
    expect(banned).toMatchObject({ status: "banned", banReason: "Refused 3 COD parcels" })
    // A guest using his number (in another format), signed in as him, or a different phone on the billing.
    await expect(order({ phone: "+8801911111111" })).rejects.toThrow(/can't take orders/)
    await expect(order({ phone: "01722222222", shippingAddress: address("01722222222") }, { ...ctx, customer: { id: karim.id } })).rejects.toThrow(/can't take orders/)
    await prisma.customer.update({ where: { id: karim.id }, data: { email: "karim@example.com" } })
    await expect(order({ phone: "01733333333", shippingAddress: address("01733333333"), email: "KARIM@example.com" })).rejects.toThrow(/can't take orders/)
    // Other customers are fine.
    await expect(order({ phone: "01744444444", shippingAddress: address("01744444444") })).resolves.toHaveProperty("orderKey")
    await ban.unbanCustomer(storeId, karim.id)
    await expect(order()).resolves.toHaveProperty("orderKey")
  })
})
