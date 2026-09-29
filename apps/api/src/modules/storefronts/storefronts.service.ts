/**
 * STOREFRONTS — a store's shop fronts (admin). Each has its own web addresses, look, menus, home
 * page, product range and prices; stock, customers and orders are shared. Pricing and range rules
 * are in storefronts.rules.ts; which storefront a request is for is in storefronts.context.ts.
 */
import { Prisma } from "@prisma/client"
import { cacheDel, CACHE_KEYS, prisma, tx } from "../../config"
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError, type RequestContext } from "../../core"
import { assertStaffStorefront, defaultStorefrontId, forgetStorefronts, staffStorefronts } from "./storefronts.context"
import { cleanHostname, storefrontCode } from "./storefronts.rules"
import type { ProductStorefrontsInput, StorefrontInput } from "./storefronts.dto"

type T = Prisma.TransactionClient
const n = (v: unknown) => (v === null || v === undefined ? null : Number(v))

export class StorefrontsService {
  constructor(private readonly ctx: RequestContext) {}

  private get storeId(): bigint {
    if (this.ctx.storeId === undefined) throw new BadRequestError("No store for this request", "STORE_REQUIRED")
    return this.ctx.storeId
  }

  private async find(id: bigint, t: T | typeof prisma = prisma) {
    const sf = await t.storefront.findFirst({ where: { id, storeId: this.storeId } })
    if (!sf) throw new NotFoundError("Storefront")
    return sf
  }

  /** Adding, deleting or changing the default storefront: staff who work on every storefront only. */
  private assertAllStorefronts() {
    if (staffStorefronts(this.ctx)) throw new ForbiddenError("Only staff who work on every storefront can do this", "AUTH_FORBIDDEN")
  }

  private changed() {
    forgetStorefronts(this.storeId)
  }

  /** Storefronts with their web addresses and how many orders and own-priced products each has. */
  async list() {
    await defaultStorefrontId(this.storeId) // every store has one
    const [rows, domains, orders, priced, hidden, added, themes, homes, menus] = await Promise.all([
      prisma.storefront.findMany({
        where: { storeId: this.storeId },
        orderBy: [{ isDefault: "desc" }, { isActive: "desc" }, { sortOrder: "asc" }, { id: "asc" }],
      }),
      prisma.domain.findMany({
        where: { storeId: this.storeId, type: { not: "admin" } },
        orderBy: [{ primary: "desc" }, { hostname: "asc" }],
        select: { id: true, hostname: true, primary: true, storefrontId: true },
      }),
      prisma.order.groupBy({ by: ["storefrontId"], where: { storeId: this.storeId }, _count: { _all: true } }),
      prisma.productStorefront.groupBy({
        by: ["storefrontId"],
        where: { storeId: this.storeId, regularPrice: { not: null } },
        _count: { _all: true },
      }),
      prisma.productStorefront.groupBy({ by: ["storefrontId"], where: { storeId: this.storeId, listed: false }, _count: { _all: true } }),
      prisma.productStorefront.groupBy({ by: ["storefrontId"], where: { storeId: this.storeId, listed: true }, _count: { _all: true } }),
      prisma.themeConfig.findMany({ where: { storeId: this.storeId, slug: { startsWith: "storefront-" } }, select: { slug: true } }),
      prisma.homepageSection.groupBy({ by: ["storefrontId"], where: { storeId: this.storeId }, _count: { _all: true } }),
      prisma.menu.groupBy({ by: ["storefrontId"], where: { storeId: this.storeId }, _count: { _all: true } }),
    ])
    const count = (list: { storefrontId: bigint | null; _count: { _all: number } }[], id: bigint) =>
      list.find((c) => c.storefrontId === id)?._count._all ?? 0
    const def = rows.find((r) => r.isDefault)
    const allowed = staffStorefronts(this.ctx)
    return rows.filter((r) => !allowed || allowed.includes(r.id)).map((r) => ({
      id: String(r.id),
      name: r.name,
      code: r.code,
      isDefault: r.isDefault,
      isActive: r.isActive,
      priceAdjustPercent: Number(r.priceAdjustPercent),
      includeNewProducts: r.isDefault ? true : r.includeNewProducts,
      sortOrder: r.sortOrder,
      paymentGateways: r.paymentGateways,
      courierAccountId: r.courierAccountId === null ? null : String(r.courierAccountId),
      // Addresses not linked to a storefront open the default one.
      domains: domains
        .filter((d) => (d.storefrontId ?? def?.id) === r.id)
        .map((d) => ({ id: String(d.id), hostname: d.hostname, primary: d.primary, linked: d.storefrontId !== null })),
      orders: count(orders, r.id),
      ownPrices: count(priced, r.id),
      hiddenProducts: count(hidden, r.id),
      addedProducts: count(added, r.id),
      // Its own look / home page / menus (the default storefront's are the shared ones).
      ownTheme: !r.isDefault && themes.some((t) => t.slug === `storefront-${r.id}`),
      ownHomepage: !r.isDefault && count(homes, r.id) > 0,
      ownMenus: r.isDefault ? 0 : count(menus, r.id),
    }))
  }

  /** Names for filters and pickers (any staff member; limited staff get their storefronts). */
  async options() {
    await defaultStorefrontId(this.storeId)
    const allowed = staffStorefronts(this.ctx)
    const rows = await prisma.storefront.findMany({
      where: { storeId: this.storeId, ...(allowed ? { id: { in: allowed } } : {}) },
      orderBy: [{ isDefault: "desc" }, { sortOrder: "asc" }, { id: "asc" }],
      select: { id: true, name: true, code: true, isDefault: true, isActive: true },
    })
    return rows.map((r) => ({ ...r, id: String(r.id) }))
  }

  private async uniqueCode(t: T, raw: string, exceptId?: bigint) {
    const code = storefrontCode(raw)
    if (code.length < 2) throw new BadRequestError("The code needs at least 2 letters or digits", "BAD_REQUEST", { code: ["Too short"] })
    const taken = await t.storefront.findFirst({ where: { storeId: this.storeId, code, ...(exceptId ? { id: { not: exceptId } } : {}) } })
    if (taken) throw new ConflictError(`Another storefront already uses the code ${code}`, "CONFLICT", { code: ["Already used"] })
    return code
  }

  /** Gateway codes the store has, and a courier account of its own. */
  private async checkSettings(d: Partial<StorefrontInput>) {
    if (d.paymentGateways?.length) {
      const known = await prisma.paymentGatewayConfig.findMany({ where: { storeId: this.storeId, code: { in: d.paymentGateways } }, select: { code: true } })
      const missing = d.paymentGateways.filter((c) => !known.some((k) => k.code === c))
      if (missing.length) throw new BadRequestError(`Unknown payment method: ${missing.join(", ")}`, "BAD_REQUEST", { paymentGateways: ["Unknown"] })
    }
    if (d.courierAccountId) {
      const a = await prisma.courierAccount.findFirst({ where: { id: d.courierAccountId, storeId: this.storeId }, select: { id: true } })
      if (!a) throw new NotFoundError("Courier account")
    }
  }

  async create(d: StorefrontInput) {
    this.assertAllStorefronts()
    await this.checkSettings(d)
    const row = await tx(async (t: T) =>
      t.storefront.create({
        data: {
          storeId: this.storeId,
          name: d.name,
          code: await this.uniqueCode(t, d.code?.trim() ? d.code : d.name),
          isActive: d.isActive ?? true,
          priceAdjustPercent: d.priceAdjustPercent ?? 0,
          includeNewProducts: d.includeNewProducts ?? true,
          sortOrder: d.sortOrder ?? 0,
          paymentGateways: [...new Set(d.paymentGateways ?? [])],
          courierAccountId: d.courierAccountId ?? null,
        },
      }),
    )
    this.changed()
    return { id: String(row.id) }
  }

  async update(id: bigint, d: Partial<StorefrontInput>) {
    assertStaffStorefront(this.ctx, id)
    await this.checkSettings(d)
    await tx(async (t: T) => {
      const sf = await this.find(id, t)
      if (sf.isDefault && d.isActive === false) throw new BadRequestError("The default storefront can't be closed. Make another one the default first.")
      await t.storefront.update({
        where: { id },
        data: {
          ...(d.name !== undefined ? { name: d.name } : {}),
          ...(d.code?.trim() ? { code: await this.uniqueCode(t, d.code, id) } : {}),
          ...(d.isActive !== undefined ? { isActive: d.isActive } : {}),
          ...(d.priceAdjustPercent !== undefined ? { priceAdjustPercent: d.priceAdjustPercent } : {}),
          ...(d.includeNewProducts !== undefined ? { includeNewProducts: d.includeNewProducts } : {}),
          ...(d.sortOrder !== undefined ? { sortOrder: d.sortOrder } : {}),
          ...(d.paymentGateways !== undefined ? { paymentGateways: [...new Set(d.paymentGateways)] } : {}),
          ...(d.courierAccountId !== undefined ? { courierAccountId: d.courierAccountId } : {}),
        },
      })
    })
    this.changed()
    return { id: String(id) }
  }

  /** Makes this the storefront addresses without their own open (it must be open). */
  async makeDefault(id: bigint) {
    this.assertAllStorefronts()
    await tx(async (t: T) => {
      const sf = await this.find(id, t)
      if (!sf.isActive) throw new BadRequestError("Open the storefront before making it the default")
      await t.storefront.updateMany({ where: { storeId: this.storeId, isDefault: true }, data: { isDefault: false } })
      await t.storefront.update({ where: { id }, data: { isDefault: true } })
    })
    await this.dropDomainCache()
    this.changed()
    return { id: String(id) }
  }

  /** Only a storefront nothing was ordered on; otherwise close it. Its addresses go to the default. */
  async remove(id: bigint) {
    this.assertAllStorefronts()
    const sf = await this.find(id)
    if (sf.isDefault) throw new BadRequestError("The default storefront can't be deleted")
    const orders = await prisma.order.count({ where: { storeId: this.storeId, storefrontId: id } })
    if (orders) throw new ConflictError(`${orders} order(s) were placed on this storefront. Close it instead.`)
    // A list holding only this storefront would become empty, which means "every storefront".
    const only = [id]
    const [zones, promos, coupons, staff] = await Promise.all([
      prisma.shippingZone.count({ where: { storeId: this.storeId, storefrontIds: { equals: only } } }),
      prisma.promotion.count({ where: { storeId: this.storeId, storefrontIds: { equals: only } } }),
      prisma.coupon.count({ where: { storeId: this.storeId, storefrontIds: { equals: only } } }),
      prisma.adminUser.count({ where: { storeId: this.storeId, storefrontIds: { equals: only } } }),
    ])
    const used = [
      zones && `${zones} delivery zone(s)`,
      promos && `${promos} promotion(s)`,
      coupons && `${coupons} coupon(s)`,
      staff && `${staff} staff member(s)`,
    ].filter(Boolean)
    if (used.length) throw new ConflictError(`Only for this storefront: ${used.join(", ")}. Change or remove them first.`)
    await tx(async (t: T) => {
      // Take it out of every "only on these storefronts" list.
      await t.$executeRaw`UPDATE "ShippingZone" SET "storefrontIds" = array_remove("storefrontIds", ${id}) WHERE "storeId" = ${this.storeId}`
      await t.$executeRaw`UPDATE "Promotion" SET "storefrontIds" = array_remove("storefrontIds", ${id}) WHERE "storeId" = ${this.storeId}`
      await t.$executeRaw`UPDATE "Coupon" SET "storefrontIds" = array_remove("storefrontIds", ${id}) WHERE "storeId" = ${this.storeId}`
      await t.$executeRaw`UPDATE "AdminUser" SET "storefrontIds" = array_remove("storefrontIds", ${id}) WHERE "storeId" = ${this.storeId}`
      await t.storefront.delete({ where: { id } })
    })
    await this.dropDomainCache()
    this.changed()
    return { id: String(id), deleted: true }
  }

  // ------------------------------------------------------------------ web addresses

  private async dropDomainCache() {
    const domains = await prisma.domain.findMany({ where: { storeId: this.storeId }, select: { hostname: true } })
    for (const d of domains) await cacheDel(CACHE_KEYS.storeByDomain(d.hostname))
  }

  /** Adds a web address for this storefront. The shop points it at us in its DNS. */
  async addDomain(id: bigint, raw: string) {
    assertStaffStorefront(this.ctx, id)
    const sf = await this.find(id)
    const hostname = cleanHostname(raw)
    if (!hostname) throw new BadRequestError("That doesn't look like a web address (e.g. kids.myshop.com)", "BAD_REQUEST", { hostname: ["Not a web address"] })
    const taken = await prisma.domain.findUnique({ where: { hostname } })
    if (taken) {
      throw new ConflictError(
        taken.storeId === this.storeId ? "This address is already yours: move it here instead" : "This address is used by another shop",
        "CONFLICT",
        { hostname: ["Already used"] },
      )
    }
    const row = await prisma.domain.create({
      data: { storeId: this.storeId, hostname, type: "storefront", storefrontId: sf.isDefault ? null : sf.id },
    })
    await cacheDel(CACHE_KEYS.storeByDomain(hostname))
    return { id: String(row.id), hostname }
  }

  /** Points one of the store's addresses at a storefront (null: the default one). */
  async moveDomain(domainId: bigint, storefrontId: bigint | null) {
    this.assertAllStorefronts()
    const d = await prisma.domain.findFirst({ where: { id: domainId, storeId: this.storeId } })
    if (!d) throw new NotFoundError("Web address")
    if (d.type === "admin") throw new BadRequestError("The admin address can't open a storefront")
    let target: bigint | null = null
    if (storefrontId !== null) {
      const sf = await this.find(storefrontId)
      target = sf.isDefault ? null : sf.id
    }
    await prisma.domain.update({ where: { id: domainId }, data: { storefrontId: target } })
    await cacheDel(CACHE_KEYS.storeByDomain(d.hostname))
    return { id: String(domainId) }
  }

  // ------------------------------------------------------------------ products

  /** Where a product is sold and at what price, one row per storefront. */
  async productStorefronts(productId: bigint) {
    const product = await prisma.product.findFirst({
      where: { id: productId, storeId: this.storeId },
      select: { id: true, regularPrice: true, salePrice: true, variants: { select: { id: true }, take: 1 } },
    })
    if (!product) throw new NotFoundError("Product")
    await defaultStorefrontId(this.storeId)
    const [sfs, own] = await Promise.all([
      prisma.storefront.findMany({ where: { storeId: this.storeId }, orderBy: [{ isDefault: "desc" }, { sortOrder: "asc" }, { id: "asc" }] }),
      prisma.productStorefront.findMany({ where: { productId } }),
    ])
    const allowed = staffStorefronts(this.ctx)
    return sfs.filter((sf) => !allowed || allowed.includes(sf.id)).map((sf) => {
      const row = own.find((o) => o.storefrontId === sf.id)
      const includeNew = sf.isDefault ? true : sf.includeNewProducts
      return {
        storefrontId: String(sf.id),
        name: sf.name,
        code: sf.code,
        isDefault: sf.isDefault,
        isActive: sf.isActive,
        priceAdjustPercent: Number(sf.priceAdjustPercent),
        includeNewProducts: includeNew,
        listed: row ? row.listed : includeNew,
        regularPrice: n(row?.regularPrice),
        salePrice: n(row?.salePrice),
      }
    })
  }

  /** Saves where a product is sold and its own prices; a row that says nothing new is removed. */
  async saveProductStorefronts(productId: bigint, d: ProductStorefrontsInput) {
    const product = await prisma.product.findFirst({ where: { id: productId, storeId: this.storeId }, select: { id: true } })
    if (!product) throw new NotFoundError("Product")
    const sfs = await prisma.storefront.findMany({ where: { storeId: this.storeId } })
    for (const r of d.storefronts) {
      if (r.salePrice != null && (r.regularPrice == null || r.salePrice >= r.regularPrice)) {
        throw new BadRequestError("A sale price needs a regular price above it", "BAD_REQUEST", { salePrice: ["Must be below the regular price"] })
      }
    }
    await tx(async (t: T) => {
      for (const r of d.storefronts) {
        const sf = sfs.find((s) => s.id === r.storefrontId)
        if (!sf) throw new NotFoundError("Storefront", r.storefrontId)
        assertStaffStorefront(this.ctx, sf.id)
        const includeNew = sf.isDefault ? true : sf.includeNewProducts
        const plain = r.listed === includeNew && r.regularPrice == null
        const key = { productId_storefrontId: { productId, storefrontId: sf.id } }
        if (plain) {
          await t.productStorefront.deleteMany({ where: { productId, storefrontId: sf.id } })
          continue
        }
        const data = { listed: r.listed, regularPrice: r.regularPrice ?? null, salePrice: r.regularPrice == null ? null : (r.salePrice ?? null) }
        await t.productStorefront.upsert({
          where: key,
          update: data,
          create: { storeId: this.storeId, productId, storefrontId: sf.id, ...data },
        })
      }
    })
    return this.productStorefronts(productId)
  }

  /** Adds products to a storefront, or takes them off it (keeping any own price). */
  async setProducts(id: bigint, productIds: bigint[], listed: boolean) {
    assertStaffStorefront(this.ctx, id)
    await this.find(id)
    const found = await prisma.product.findMany({ where: { storeId: this.storeId, id: { in: productIds } }, select: { id: true } })
    await tx(async (t: T) => {
      for (const p of found) {
        await t.productStorefront.upsert({
          where: { productId_storefrontId: { productId: p.id, storefrontId: id } },
          update: { listed },
          create: { storeId: this.storeId, productId: p.id, storefrontId: id, listed },
        })
      }
    })
    return { updated: found.length }
  }
}
