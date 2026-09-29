/**
 * WHOLESALE — selling to businesses.
 *   Settings: on/off, approve applications automatically, the text above the application form.
 *   Business accounts: customers apply on the storefront; staff approve, reject or suspend
 *   (or make a customer a business account themselves). Approved accounts get business prices.
 *   Bulk prices: per product or option, "N or more at ৳X each", for businesses or everyone.
 *   Pricing by margin: cost, price and margin side by side; new prices saved in bulk.
 */
import type { Prisma } from "@prisma/client"
import { prisma, tx, cacheDel, CACHE_KEYS } from "../../config"
import { BadRequestError, ConflictError, NotFoundError, type RequestContext } from "../../core"
import { wholesaleSettings } from "./wholesale.context"
import { marginOf, reviewTo, tierProblems, tiersFor, type ReviewAction } from "./wholesale.rules"
import type { z } from "zod"
import type {
  AccountsQuery,
  ApplyPricesDto,
  BusinessDetailsDto,
  CreateAccountDto,
  MarginsQuery,
  SettingsDto,
  TiersDto,
  UpdateAccountDto,
} from "./wholesale.dto"

type Num = Prisma.Decimal | number | string | null | undefined
const n = (v: Num): number | null => (v === null || v === undefined ? null : Number(v))

const ACCOUNT_INCLUDE = {
  customer: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, orderCount: true, totalSpent: true } },
} as const
type AccountRow = Prisma.BusinessAccountGetPayload<{ include: typeof ACCOUNT_INCLUDE }>

const accountView = (a: AccountRow) => ({
  id: String(a.id),
  status: a.status,
  companyName: a.companyName,
  businessType: a.businessType,
  contactPhone: a.contactPhone,
  address: a.address,
  tradeLicenseNo: a.tradeLicenseNo,
  vatRegNo: a.vatRegNo,
  note: a.note,
  reviewNote: a.reviewNote,
  reviewedAt: a.reviewedAt?.toISOString() ?? null,
  appliedAt: a.createdAt.toISOString(),
  customer: {
    id: String(a.customer.id),
    name: `${a.customer.firstName} ${a.customer.lastName}`.trim(),
    email: a.customer.email,
    phone: a.customer.phone,
    orderCount: a.customer.orderCount,
    totalSpent: Number(a.customer.totalSpent),
  },
})

/** What the customer sees of their own account (no staff-only fields). */
const myAccountView = (a: {
  status: string
  companyName: string
  businessType: string
  contactPhone: string | null
  address: string | null
  tradeLicenseNo: string | null
  vatRegNo: string | null
  note: string | null
  reviewNote: string | null
  createdAt: Date
}) => ({
  status: a.status,
  companyName: a.companyName,
  businessType: a.businessType,
  contactPhone: a.contactPhone,
  address: a.address,
  tradeLicenseNo: a.tradeLicenseNo,
  vatRegNo: a.vatRegNo,
  note: a.note,
  // Staff's reason is for the customer only when the answer was no.
  reviewNote: a.status === "REJECTED" || a.status === "SUSPENDED" ? a.reviewNote : null,
  appliedAt: a.createdAt.toISOString(),
})

function variantName(values: unknown, sku: string | null, id: bigint): string {
  const label = Object.values((values as Record<string, unknown>) ?? {})
    .map(String)
    .join(" / ")
  if (label !== "") return label
  return sku !== null && sku !== "" ? sku : `#${id}`
}

interface MarginRow {
  productId: string
  name: string
  status: string
  imageUrl: string | null
  tierCount: number
  variantId: string | null
  option: string | null
  sku: string | null
  cost: number | null
  price: number | null
  salePrice: number | null
}

export class WholesaleService {
  constructor(private readonly ctx: RequestContext) {}

  private get storeId(): bigint {
    if (this.ctx.storeId === undefined) throw new BadRequestError("No store for this request", "STORE_REQUIRED")
    return this.ctx.storeId
  }

  private get adminId(): bigint | null {
    return this.ctx.super || !this.ctx.admin ? null : BigInt(this.ctx.admin.id)
  }

  // ================================================================ settings

  async settings() {
    const [settings, counts] = await Promise.all([
      wholesaleSettings(this.storeId),
      prisma.businessAccount.groupBy({ by: ["status"], where: { storeId: this.storeId }, _count: { _all: true } }),
    ])
    return { ...settings, counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])) }
  }

  async updateSettings(dto: z.infer<typeof SettingsDto>) {
    const data = {
      ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
      ...(dto.autoApprove !== undefined ? { autoApprove: dto.autoApprove } : {}),
      ...(dto.intro !== undefined ? { intro: dto.intro } : {}),
    }
    await prisma.wholesaleSettings.upsert({ where: { storeId: this.storeId }, create: { storeId: this.storeId, ...data }, update: data })
    return this.settings()
  }

  // ================================================================ business accounts (staff)

  async listAccounts(q: z.infer<typeof AccountsQuery>) {
    const s = q.search?.trim()
    const where: Prisma.BusinessAccountWhereInput = {
      storeId: this.storeId,
      ...(q.status ? { status: q.status } : {}),
      ...(s
        ? {
            OR: [
              { companyName: { contains: s, mode: "insensitive" } },
              { tradeLicenseNo: { contains: s, mode: "insensitive" } },
              { contactPhone: { contains: s } },
              { customer: { email: { contains: s, mode: "insensitive" } } },
              { customer: { phone: { contains: s } } },
              { customer: { firstName: { contains: s, mode: "insensitive" } } },
            ],
          }
        : {}),
    }
    const [rows, total] = await Promise.all([
      prisma.businessAccount.findMany({
        where,
        include: ACCOUNT_INCLUDE,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (q.page - 1) * q.perPage,
        take: q.perPage,
      }),
      prisma.businessAccount.count({ where }),
    ])
    return { rows: rows.map(accountView), total, page: q.page, perPage: q.perPage }
  }

  private async findAccount(id: bigint) {
    const row = await prisma.businessAccount.findFirst({ where: { id, storeId: this.storeId }, include: ACCOUNT_INCLUDE })
    if (!row) throw new NotFoundError("Business account", String(id))
    return row
  }

  async getAccount(id: bigint) {
    return accountView(await this.findAccount(id))
  }

  /** The business account of one customer (for the customer page), or null. */
  async accountOfCustomer(customerId: bigint) {
    const row = await prisma.businessAccount.findFirst({ where: { storeId: this.storeId, customerId }, include: ACCOUNT_INCLUDE })
    return row ? accountView(row) : null
  }

  async createAccount(dto: z.infer<typeof CreateAccountDto>) {
    const customer = await prisma.customer.findFirst({ where: { id: dto.customerId, storeId: this.storeId }, select: { id: true } })
    if (!customer) throw new NotFoundError("Customer", String(dto.customerId))
    if (await prisma.businessAccount.findUnique({ where: { customerId: customer.id } })) {
      throw new ConflictError("This customer already has a business account")
    }
    const { customerId, ...details } = dto
    const row = await prisma.businessAccount.create({
      data: {
        storeId: this.storeId,
        customerId,
        ...this.details(details),
        status: "APPROVED",
        reviewedAt: new Date(),
        reviewedById: this.adminId,
      },
      include: ACCOUNT_INCLUDE,
    })
    return accountView(row)
  }

  async updateAccount(id: bigint, dto: z.infer<typeof UpdateAccountDto>) {
    await this.findAccount(id)
    const data: Prisma.BusinessAccountUpdateInput = {}
    for (const [k, v] of Object.entries(dto)) if (v !== undefined) (data as Record<string, unknown>)[k] = v
    const row = await prisma.businessAccount.update({ where: { id }, data, include: ACCOUNT_INCLUDE })
    return accountView(row)
  }

  async review(id: bigint, action: ReviewAction, note: string | null | undefined) {
    const current = await this.findAccount(id)
    const to = reviewTo(action, current.status)
    if (!to) throw new BadRequestError(`Can't ${action} an account that is ${current.status.toLowerCase()}`, "BUSINESS_ACCOUNT_STATUS")
    if ((action === "reject" || action === "suspend") && !note) {
      throw new BadRequestError("Tell the customer why", "VALIDATION_FAILED")
    }
    const row = await prisma.businessAccount.update({
      where: { id },
      data: { status: to, reviewNote: note ?? null, reviewedAt: new Date(), reviewedById: this.adminId },
      include: ACCOUNT_INCLUDE,
    })
    return accountView(row)
  }

  async removeAccount(id: bigint) {
    await this.findAccount(id)
    await prisma.businessAccount.delete({ where: { id } })
  }

  private details(d: Partial<BusinessDetailsDto>) {
    return {
      companyName: d.companyName ?? "",
      businessType: d.businessType ?? "retailer",
      contactPhone: d.contactPhone ?? null,
      address: d.address ?? null,
      tradeLicenseNo: d.tradeLicenseNo ?? null,
      vatRegNo: d.vatRegNo ?? null,
      note: d.note ?? null,
    }
  }

  // ================================================================ business account (customer)

  /** The storefront's view: whether the shop sells to businesses, and my account if I have one. */
  async myStatus(customerId: bigint | undefined) {
    const settings = await wholesaleSettings(this.storeId)
    const row = customerId ? await prisma.businessAccount.findFirst({ where: { storeId: this.storeId, customerId } }) : null
    return { enabled: settings.enabled, intro: settings.intro, account: row ? myAccountView(row) : null }
  }

  /** Apply (or apply again after a rejection). Suspended accounts must talk to the shop. */
  async apply(customerId: bigint, dto: BusinessDetailsDto) {
    const settings = await wholesaleSettings(this.storeId)
    if (!settings.enabled) throw new BadRequestError("This shop doesn't take business accounts", "WHOLESALE_OFF")
    const existing = await prisma.businessAccount.findFirst({ where: { storeId: this.storeId, customerId } })
    if (existing && existing.status !== "REJECTED") {
      throw new ConflictError(
        existing.status === "SUSPENDED"
          ? "Your business account is suspended. Please contact the shop."
          : "You already have a business account",
      )
    }
    const status = settings.autoApprove ? "APPROVED" : "PENDING"
    const data = { ...this.details(dto), status, reviewNote: null, reviewedAt: settings.autoApprove ? new Date() : null, reviewedById: null }
    const row = existing
      ? await prisma.businessAccount.update({ where: { id: existing.id }, data })
      : await prisma.businessAccount.create({ data: { storeId: this.storeId, customerId, ...data } })
    return myAccountView(row)
  }

  // ================================================================ bulk prices

  async productTiers(productId: bigint) {
    const product = await prisma.product.findFirst({
      where: { id: productId, storeId: this.storeId },
      select: {
        id: true,
        regularPrice: true,
        salePrice: true,
        costPrice: true,
        variants: { where: { status: "active" }, orderBy: { id: "asc" }, select: { id: true, attributeValues: true, sku: true, regularPrice: true, costPrice: true } },
        priceTiers: { orderBy: [{ variantId: "asc" }, { forEveryone: "desc" }, { minQty: "asc" }] },
      },
    })
    if (!product) throw new NotFoundError("Product", String(productId))
    return {
      price: n(product.regularPrice),
      cost: n(product.costPrice),
      variants: product.variants.map((v) => ({
        id: String(v.id),
        label: variantName(v.attributeValues, v.sku, v.id),
        price: n(v.regularPrice) ?? n(product.regularPrice),
        cost: n(v.costPrice) ?? n(product.costPrice),
      })),
      tiers: product.priceTiers.map((t) => ({
        id: String(t.id),
        variantId: t.variantId ? String(t.variantId) : null,
        minQty: t.minQty,
        price: Number(t.price),
        forEveryone: t.forEveryone,
      })),
    }
  }

  /** Replaces all of a product's bulk prices. */
  async saveProductTiers(productId: bigint, dto: z.infer<typeof TiersDto>) {
    const product = await prisma.product.findFirst({
      where: { id: productId, storeId: this.storeId },
      select: { id: true, variants: { select: { id: true, attributeValues: true, sku: true } } },
    })
    if (!product) throw new NotFoundError("Product", String(productId))
    const names = new Map(product.variants.map((v) => [v.id, variantName(v.attributeValues, v.sku, v.id)]))
    const rows = dto.tiers.map((t) => ({ variantId: t.variantId ?? null, minQty: t.minQty, price: t.price, forEveryone: t.forEveryone }))
    for (const r of rows) {
      if (r.variantId !== null && !names.has(r.variantId)) throw new BadRequestError("That option isn't part of this product", "VALIDATION_FAILED")
    }
    const problems = tierProblems(rows, (v) => (v === null ? "All options" : names.get(v) ?? "Option"))
    if (problems.length) throw new BadRequestError(problems.join(". "), "VALIDATION_FAILED")
    await tx(async (t: Prisma.TransactionClient) => {
      await t.priceTier.deleteMany({ where: { productId } })
      if (rows.length) await t.priceTier.createMany({ data: rows.map((r) => ({ ...r, storeId: this.storeId, productId })) })
    })
    return this.productTiers(productId)
  }

  /** Bulk prices a shopper sees on a product page: theirs, and whether business prices exist. */
  async storefrontTiers(productId: bigint, business: boolean) {
    const [settings, rows] = await Promise.all([
      wholesaleSettings(this.storeId),
      prisma.priceTier.findMany({
        where: { storeId: this.storeId, productId, product: { status: "published" } },
        select: { variantId: true, minQty: true, price: true, forEveryone: true },
      }),
    ])
    const variantIds = [...new Set(rows.map((r) => r.variantId))]
    return {
      business,
      // Only worth telling non-business shoppers about when they could apply.
      hasBusinessPrices: settings.enabled && rows.some((r) => !r.forEveryone),
      wholesaleEnabled: settings.enabled,
      tiers: variantIds.map((v) => ({
        variantId: v ? String(v) : null,
        tiers: tiersFor(rows, v, business).map((t) => ({ minQty: t.minQty, price: t.price, business: !t.forEveryone })),
      })),
    }
  }

  // ================================================================ pricing by margin

  async margins(q: z.infer<typeof MarginsQuery>) {
    const s = q.search?.trim()
    const where: Prisma.ProductWhereInput = {
      storeId: this.storeId,
      status: { not: "archived" },
      ...(s ? { OR: [{ name: { contains: s, mode: "insensitive" } }, { sku: { contains: s, mode: "insensitive" } }] } : {}),
      ...(q.categoryId ? { categories: { some: { categoryId: q.categoryId } } } : {}),
    }
    const products = await prisma.product.findMany({
      where,
      orderBy: [{ name: "asc" }, { id: "asc" }],
      select: {
        id: true,
        name: true,
        sku: true,
        status: true,
        costPrice: true,
        regularPrice: true,
        salePrice: true,
        images: { orderBy: { sortOrder: "asc" }, take: 1, select: { imageUrl: true } },
        variants: {
          where: { status: "active" },
          orderBy: { id: "asc" },
          select: { id: true, attributeValues: true, sku: true, costPrice: true, regularPrice: true, salePrice: true },
        },
        _count: { select: { priceTiers: true } },
      },
    })
    // One row per product without options, or per option.
    const all = products.flatMap((p): MarginRow[] => {
      const base = { productId: String(p.id), name: p.name, status: p.status, imageUrl: p.images[0]?.imageUrl ?? null, tierCount: p._count.priceTiers }
      if (!p.variants.length) {
        return [{ ...base, variantId: null, option: null, sku: p.sku, cost: n(p.costPrice), price: n(p.regularPrice), salePrice: n(p.salePrice) }]
      }
      return p.variants.map((v) => ({
        ...base,
        variantId: String(v.id),
        option: variantName(v.attributeValues, v.sku, v.id),
        sku: v.sku ?? p.sku,
        cost: n(v.costPrice) ?? n(p.costPrice),
        price: n(v.regularPrice) ?? n(p.regularPrice),
        salePrice: n(v.salePrice) ?? (v.regularPrice ? null : n(p.salePrice)),
      }))
    })
    const filtered = all.filter((r) => (q.cost === "withCost" ? r.cost !== null : q.cost === "noCost" ? r.cost === null : true))
    const withCost = all.filter((r) => r.cost !== null && r.price)
    const avg = withCost.length ? withCost.reduce((a, r) => a + (marginOf(r.cost, r.price) ?? 0), 0) / withCost.length : null
    const rows = filtered.slice((q.page - 1) * q.perPage, q.page * q.perPage).map((r) => ({
      ...r,
      margin: marginOf(r.cost, r.price),
      saleMargin: r.salePrice !== null ? marginOf(r.cost, r.salePrice) : null,
    }))
    return {
      rows,
      total: filtered.length,
      page: q.page,
      perPage: q.perPage,
      summary: {
        rows: all.length,
        missingCost: all.length - all.filter((r) => r.cost !== null).length,
        belowCost: withCost.filter((r) => (r.price ?? 0) < (r.cost ?? 0)).length,
        averageMargin: avg === null ? null : Math.round(avg * 10) / 10,
      },
    }
  }

  /** Saves new regular prices (products without options, or single options). */
  async applyPrices(dto: z.infer<typeof ApplyPricesDto>) {
    const productIds = [...new Set(dto.rows.map((r) => r.productId))]
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, storeId: this.storeId },
      select: { id: true, variants: { select: { id: true } } },
    })
    const byId = new Map(products.map((p) => [p.id, new Set(p.variants.map((v) => v.id))]))
    for (const r of dto.rows) {
      const variants = byId.get(r.productId)
      if (!variants) throw new NotFoundError("Product", String(r.productId))
      if (r.variantId ? !variants.has(r.variantId) : variants.size > 0) {
        throw new BadRequestError("Pick an option of that product", "VALIDATION_FAILED")
      }
    }
    await tx(async (t: Prisma.TransactionClient) => {
      for (const r of dto.rows) {
        if (r.variantId) await t.productVariant.update({ where: { id: r.variantId }, data: { regularPrice: r.regularPrice } })
        else await t.product.update({ where: { id: r.productId }, data: { regularPrice: r.regularPrice } })
      }
    })
    await cacheDel(CACHE_KEYS.products(String(this.storeId)))
    return { updated: dto.rows.length }
  }
}
