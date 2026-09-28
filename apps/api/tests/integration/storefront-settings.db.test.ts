/**
 * Per-storefront settings against a REAL Postgres: payment methods, delivery zones, promotions,
 * coupons, staff limited to some storefronts, reports by storefront and manual orders.
 * Runs only when RUN_DB_TESTS=1.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import type { RequestContext } from "../../src/core"

const runDb = process.env.RUN_DB_TESTS === "1"

describe.skipIf(!runDb)("storefront settings (Postgres)", () => {
  let prisma: typeof import("../../src/config/prisma").prisma
  let sfCtx: typeof import("../../src/modules/storefronts/storefronts.context")
  let Shop: typeof import("../../src/modules/storefront/storefront.service").StorefrontService
  let Shipping: typeof import("../../src/modules/shipping").ShippingService
  let Admin: typeof import("../../src/modules/storefronts/storefronts.service").StorefrontsService
  let Orders: typeof import("../../src/modules/orders/orders.repository").OrderRepository
  let Reports: typeof import("../../src/modules/reports/reports.service").ReportsService
  let Manual: typeof import("../../src/modules/orders/manual-order").ManualOrderService
  let ManualDto: typeof import("../../src/modules/orders/manual-order").ManualOrderQuoteDto
  let Team: typeof import("../../src/modules/team/team.service").TeamService
  let storeId: bigint
  let mainId: bigint
  let kidsId: bigint
  let productId: bigint
  let admin: RequestContext
  const suffix = Date.now().toString(36)
  let seq = 0

  const at = (storefrontId: bigint): RequestContext => ({ storeId, storefrontId, requestId: "test", locale: "en", currency: "BDT" })
  /** A staff member working on `storefrontIds` only. */
  const staff = (storefrontIds: bigint[]): RequestContext => ({
    ...admin,
    admin: { id: 999999n, role: "ADMIN", permissions: ["*"], storefrontIds },
  })
  const order = (storefrontId: bigint, total: number) => {
    seq += 1
    return prisma.order.create({
      data: {
        storeId,
        storefrontId,
        number: `SS${suffix}${seq}`,
        orderKey: `ok_ss_${suffix}_${seq}`,
        status: "PROCESSING",
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
      },
    })
  }

  beforeAll(async () => {
    ;({ prisma } = await import("../../src/config/prisma"))
    sfCtx = await import("../../src/modules/storefronts/storefronts.context")
    ;({ StorefrontService: Shop } = await import("../../src/modules/storefront/storefront.service"))
    ;({ ShippingService: Shipping } = await import("../../src/modules/shipping"))
    ;({ StorefrontsService: Admin } = await import("../../src/modules/storefronts/storefronts.service"))
    ;({ OrderRepository: Orders } = await import("../../src/modules/orders/orders.repository"))
    ;({ ReportsService: Reports } = await import("../../src/modules/reports/reports.service"))
    ;({ ManualOrderService: Manual, ManualOrderQuoteDto: ManualDto } = await import("../../src/modules/orders/manual-order"))
    ;({ TeamService: Team } = await import("../../src/modules/team/team.service"))
    storeId = (await prisma.store.create({ data: { name: "Settings Test", slug: `sfset-${suffix}` } })).id
    admin = { storeId, requestId: "test", locale: "en", currency: "BDT" }
    mainId = await sfCtx.defaultStorefrontId(storeId)
    kidsId = BigInt((await new Admin(admin).create({ name: "Kids", paymentGateways: [] })).id)
    for (const [code, name] of [
      ["cod", "Cash on delivery"],
      ["bkash", "bKash"],
    ] as const) {
      await prisma.paymentGatewayConfig.create({ data: { storeId, code, name, enabled: true } })
    }
    productId = (
      await prisma.product.create({
        data: { storeId, name: "Ball", slug: `ball-${suffix}`, status: "published", regularPrice: 1000, manageStock: false },
      })
    ).id
    const zone = async (name: string, storefrontIds: bigint[], cost: number) =>
      prisma.shippingZone.create({
        data: {
          storeId,
          name,
          countries: ["BD"],
          storefrontIds,
          methods: { create: [{ code: `std-${name}`, name: `${name} delivery`, baseCost: cost }] },
        },
      })
    await zone("Everywhere", [], 120)
    await zone("Kids", [kidsId], 60)
  })

  afterAll(async () => {
    if (!prisma) return
    await prisma.order.deleteMany({ where: { storeId } })
    await prisma.adminUser.deleteMany({ where: { storeId } })
    await prisma.product.deleteMany({ where: { storeId } })
    await prisma.store.delete({ where: { id: storeId } })
    await prisma.$disconnect()
  })

  it("offers only the payment methods a storefront picked", async () => {
    await new Admin(admin).update(kidsId, { paymentGateways: ["cod"] })
    sfCtx.forgetStorefronts(storeId)
    expect((await new Shop(at(kidsId)).paymentMethods()).map((m) => m.code)).toEqual(["cod"])
    expect((await new Shop(at(mainId)).paymentMethods()).map((m) => m.code).sort()).toEqual(["bkash", "cod"])
    await expect(new Admin(admin).update(kidsId, { paymentGateways: ["nagad"] })).rejects.toThrow(/Unknown payment method: nagad/)
  })

  it("uses a storefront's own delivery zone, and the shared one elsewhere", async () => {
    const rates = async (sf: bigint) =>
      (await new Shipping().computeShippingOptions(at(sf), { countryCode: "BD", subtotal: 1000, weightKG: 0, qty: 1 })).options.map(
        (o: { name: string; finalRateBDT: number }) => [o.name, o.finalRateBDT],
      )
    expect(await rates(kidsId)).toEqual([["Kids delivery", 60]])
    expect(await rates(mainId)).toEqual([["Everywhere delivery", 120]])
  })

  it("runs promotions and coupons only on their storefronts", async () => {
    await prisma.promotion.create({
      data: { storeId, name: "Kids 10%", type: "discount", discountType: "percent", discountValue: 10, storefrontIds: [kidsId] },
    })
    await prisma.coupon.create({
      data: { storeId, code: `KIDS${suffix}`.toUpperCase(), type: "FIXED_CART", amount: 50, audience: "public", storefrontIds: [kidsId] },
    })
    const lines = [{ productId, qty: 1 }]
    expect((await new Shop(at(kidsId)).cartPrices(lines)).promotions.total).toBe(100)
    expect((await new Shop(at(mainId)).cartPrices(lines)).promotions.total).toBe(0)
    const code = `KIDS${suffix}`.toUpperCase()
    expect((await new Shop(at(kidsId)).applyCoupon({ code, items: lines })).valid).toBe(true)
    expect(await new Shop(at(mainId)).applyCoupon({ code, items: lines })).toMatchObject({ valid: false, errorMessage: "This coupon code is not valid" })
    expect((await new Shop(at(kidsId)).availableCoupons()).map((c) => c.code)).toContain(code)
    expect((await new Shop(at(mainId)).availableCoupons()).map((c) => c.code)).not.toContain(code)
  })

  it("keeps staff to their storefronts' orders", async () => {
    const kidsOrder = await order(kidsId, 500)
    const mainOrder = await order(mainId, 700)
    const list = async (ctx: RequestContext, storefrontId?: bigint) =>
      ((await new Orders().listWithJoins(ctx, { page: 1, perPage: 50, sortBy: "createdAt", sortOrder: "desc", storefrontId } as never)).data as { id: bigint }[]).map(
        (o) => o.id,
      )
    expect((await list(admin)).length).toBe(2)
    expect(await list(staff([kidsId]))).toEqual([kidsOrder.id])
    expect(await list(staff([kidsId]), mainId)).toEqual([])
    await expect(new Orders().findById(staff([kidsId]), mainOrder.id)).rejects.toThrow(/not found/i)
    const found = (await new Orders().findById(staff([kidsId]), kidsOrder.id)) as { id: bigint }
    expect(found.id).toBe(kidsOrder.id)
  })

  it("splits reports by storefront and keeps limited staff to theirs", async () => {
    const all = await new Reports(admin).sales({})
    expect(all.total.orders).toBe(2)
    expect(all.byStorefront.map((r) => [r.key, r.orders]).sort()).toEqual([
      ["Kids", 1],
      ["Settings Test", 1],
    ])
    expect((await new Reports(admin).sales({ storefrontId: kidsId })).total.orders).toBe(1)
    expect((await new Reports(staff([kidsId])).sales({})).total.orders).toBe(1)
    await expect(new Reports(staff([kidsId])).sales({ storefrontId: mainId })).rejects.toThrow(/don't work on this storefront/)
  })

  it("lets limited staff edit only their storefronts", async () => {
    const svc = new Admin(staff([kidsId]))
    expect((await svc.list()).map((s) => s.id)).toEqual([String(kidsId)])
    await svc.update(kidsId, { priceAdjustPercent: 5 })
    await expect(svc.update(mainId, { priceAdjustPercent: 5 })).rejects.toThrow(/don't work on this storefront/)
    await expect(svc.create({ name: "Another" })).rejects.toThrow(/every storefront/)
    await new Admin(admin).update(kidsId, { priceAdjustPercent: 0 })
    sfCtx.forgetStorefronts(storeId)
  })

  it("takes manual orders for a chosen storefront, at its prices and promotions", async () => {
    await new Admin(admin).update(kidsId, { priceAdjustPercent: 20 })
    sfCtx.forgetStorefronts(storeId)
    const dto = ManualDto.parse({ items: [{ productId, qty: 1 }], delivery: { type: "pickup" }, storefrontId: kidsId })
    const q = await new Manual({ ...admin, admin: { id: 1n, role: "OWNER", permissions: ["*"] } }).quote(dto)
    expect(q.lines[0]!.unitPrice).toBe(1200)
    expect(q.promotions.total).toBe(120)
    await expect(new Manual(staff([mainId])).quote(dto)).rejects.toThrow(/don't work on this storefront/)
    await new Admin(admin).update(kidsId, { priceAdjustPercent: 0 })
    sfCtx.forgetStorefronts(storeId)
  })

  it("lets a limited editor give only their own storefronts", async () => {
    const role = await prisma.role.create({ data: { storeId, name: "Packer", slug: `packer-${suffix}` } })
    const editor = await prisma.adminUser.create({
      data: { storeId, email: `ed-${suffix}@x.test`, name: "Ed", passwordHash: "x", roleId: role.id, storefrontIds: [kidsId] },
    })
    const ctx: RequestContext = { ...admin, admin: { id: editor.id, role: "ADMIN", permissions: ["*"], storefrontIds: [kidsId] } }
    const made = await new Team(ctx).createStaff({ name: "New", email: `new-${suffix}@x.test`, password: "Secret123!", roleId: role.id })
    expect(made.storefrontIds).toEqual([String(kidsId)])
    await expect(
      new Team(ctx).createStaff({ name: "Wide", email: `wide-${suffix}@x.test`, password: "Secret123!", roleId: role.id, storefrontIds: [mainId] }),
    ).rejects.toThrow(/storefronts you work on/)
    await expect(new Team(ctx).updateStaff(BigInt(made.id), { storefrontIds: [] })).rejects.toThrow(/storefronts you work on/)
  })

  it("won't delete a storefront something is limited to only", async () => {
    const toys = BigInt((await new Admin(admin).create({ name: "Toys" })).id)
    await prisma.shippingZone.create({ data: { storeId, name: "Toys", countries: ["BD"], storefrontIds: [toys] } })
    const shared = await prisma.promotion.create({
      data: { storeId, name: "Both", type: "discount", discountType: "percent", discountValue: 5, storefrontIds: [kidsId, toys] },
    })
    await expect(new Admin(admin).remove(toys)).rejects.toThrow(/Only for this storefront: 1 delivery zone\(s\)\. Change/)
    await prisma.shippingZone.deleteMany({ where: { storeId, name: "Toys" } })
    await new Admin(admin).remove(toys)
    // Taken out of lists it shared with other storefronts.
    expect((await prisma.promotion.findUniqueOrThrow({ where: { id: shared.id } })).storefrontIds).toEqual([kidsId])
  })
})
