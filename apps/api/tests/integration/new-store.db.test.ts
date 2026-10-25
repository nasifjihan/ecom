/**
 * A store created in the super admin starts usable: its payment methods are listed (cash on
 * delivery on, the rest off) so Settings → Payments can turn them on. Found by the production
 * rehearsal (Batch 46): before, only the demo seed made these rows. Runs only when RUN_DB_TESTS=1.
 */
import { describe, it, expect, afterAll } from "vitest"
import type { RequestContext } from "../../src/core"

const runDb = process.env.RUN_DB_TESTS === "1"

describe.skipIf(!runDb)("a new store (Postgres)", () => {
  let prisma: typeof import("../../src/config/prisma").prisma | undefined
  let storeId: bigint | undefined
  const suffix = Date.now().toString(36)

  afterAll(async () => {
    if (!prisma || !storeId) return // setup failed: an undefined id would match every row
    await prisma.adminUser.deleteMany({ where: { storeId } })
    await prisma.role.deleteMany({ where: { storeId } })
    await prisma.store.delete({ where: { id: storeId } })
    await prisma.$disconnect()
  })

  it("comes with its payment methods, cash on delivery on", async () => {
    ;({ prisma } = await import("../../src/config/prisma"))
    const { StoresService } = await import("../../src/modules/stores/stores.service")
    const { CreateStoreDto } = await import("../../src/modules/stores/stores.dto")
    const ctx = { requestId: "t", locale: "en", currency: "BDT", super: { id: 1n } } as RequestContext
    const store = (await new StoresService(ctx).createStore(
      CreateStoreDto.parse({ name: "New Shop", slug: `new-shop-${suffix}`, status: "active", owner: { name: "Owner", email: `o-${suffix}@x.test`, password: "Owner-pass-1234" } }),
    )) as { id: bigint | string }
    storeId = BigInt(store.id)
    const rows = await prisma.paymentGatewayConfig.findMany({ where: { storeId }, orderBy: { sortOrder: "asc" } })
    expect(rows.map((r) => `${r.code}:${r.enabled ? "on" : "off"}:${r.mode}`)).toEqual([
      "cod:on:online",
      "bkash:off:manual",
      "nagad:off:manual",
      "rocket:off:manual",
      "sslcommerz:off:online",
      "aamarpay:off:online",
      "stripe:off:online",
      "bank_transfer:off:manual",
    ])
  }, 60_000) // loads the store module the first time (34 s once on a cold machine)

  it("comes with the terms and privacy pages that checkout links to", async () => {
    const pages = await prisma!.cmsPage.findMany({ where: { storeId, isPublished: true }, orderBy: { sortOrder: "asc" } })
    expect(pages.map((p) => p.slug)).toEqual(["privacy-policy", "terms-of-service"])
  })
})
