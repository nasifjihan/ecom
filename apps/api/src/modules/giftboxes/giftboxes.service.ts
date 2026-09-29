/**
 * GIFT BOXES — boxes shoppers fill themselves (Catalog > Gift boxes, /gift-boxes/{slug}).
 * The box is a product (the packaging); its contents are ordinary cart lines tagged with the box.
 * Checkout checks every box with `checkOrderBoxes` (giftbox.check.ts).
 */
import { prisma } from "../../config"
import { BadRequestError, ConflictError, NotFoundError, type RequestContext } from "../../core"
import { StorefrontService } from "../storefront/storefront.service"

export interface GiftBoxInput {
  slug: string
  name: string
  description?: string | null
  imageUrl?: string | null
  boxProductId: bigint
  minItems: number
  maxItems: number
  productIds?: bigint[]
  categoryIds?: bigint[]
  allowMessage?: boolean
  messageMax?: number
  isActive?: boolean
  sortOrder?: number
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const text = (v?: string | null) => {
  const t = v?.trim() ?? ""
  return t === "" ? null : t
}

export class GiftBoxesService {
  constructor(private readonly ctx: RequestContext) {}

  private get storeId(): bigint {
    if (this.ctx.storeId === undefined) throw new BadRequestError("No store for this request", "STORE_REQUIRED")
    return this.ctx.storeId
  }

  // ---------------------------------------------------------------- staff

  private view(r: Awaited<ReturnType<GiftBoxesService["rows"]>>[number], sold: number) {
    return {
      id: String(r.id),
      slug: r.slug,
      name: r.name,
      description: r.description,
      imageUrl: r.imageUrl,
      boxProduct: {
        id: String(r.boxProduct.id),
        name: r.boxProduct.name,
        published: r.boxProduct.status === "published",
        price: r.boxProduct.regularPrice === null ? null : Number(r.boxProduct.regularPrice),
      },
      minItems: r.minItems,
      maxItems: r.maxItems,
      productIds: r.productIds.map(String),
      categoryIds: r.categoryIds.map(String),
      allowMessage: r.allowMessage,
      messageMax: r.messageMax,
      isActive: r.isActive,
      sortOrder: r.sortOrder,
      /** Boxes sold (orders with this box, cancelled ones left out). */
      sold,
      updatedAt: r.updatedAt.toISOString(),
    }
  }

  private rows(id?: bigint) {
    return prisma.giftBox.findMany({
      where: { storeId: this.storeId, ...(id ? { id } : {}) },
      include: { boxProduct: { select: { id: true, name: true, status: true, regularPrice: true } } },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    })
  }

  /** How many of each box were sold: box lines on orders that weren't cancelled or failed. */
  private async sold(ids: bigint[]) {
    if (!ids.length) return new Map<string, number>()
    const rows = await prisma.$queryRaw<{ id: string; n: bigint }[]>`
      SELECT oi.meta->'giftBox'->>'giftBoxId' AS id, SUM(oi.quantity)::bigint AS n
      FROM "OrderItem" oi JOIN "Order" o ON o.id = oi."orderId"
      WHERE o."storeId" = ${this.storeId} AND o.status NOT IN ('CANCELLED', 'FAILED')
        AND oi.meta->'giftBox'->>'role' = 'box'
        AND oi.meta->'giftBox'->>'giftBoxId' = ANY(${ids.map(String)})
      GROUP BY 1`
    return new Map(rows.map((r) => [r.id, Number(r.n)]))
  }

  async list() {
    const rows = await this.rows()
    const sold = await this.sold(rows.map((r) => r.id))
    return rows.map((r) => this.view(r, sold.get(String(r.id)) ?? 0))
  }

  async get(id: bigint) {
    const [r] = await this.rows(id)
    if (!r) throw new NotFoundError("Gift box", String(id))
    const products = await prisma.product.findMany({ where: { storeId: this.storeId, id: { in: r.productIds } }, select: { id: true, name: true } })
    return {
      ...this.view(r, (await this.sold([id])).get(String(id)) ?? 0),
      /** The hand-picked products, with their names. */
      products: products.map((p) => ({ id: String(p.id), name: p.name })),
    }
  }

  private async data(d: GiftBoxInput) {
    const slug = d.slug.trim().toLowerCase()
    if (!SLUG.test(slug)) throw new BadRequestError("Use lowercase letters, numbers and dashes for the address", "VALIDATION_FAILED")
    if (d.maxItems < d.minItems) throw new BadRequestError("The most items can't be fewer than the fewest", "VALIDATION_FAILED")
    const productIds = [...new Set(d.productIds ?? [])]
    const categoryIds = [...new Set(d.categoryIds ?? [])]
    const storeId = this.storeId
    const [box, products, categories] = await Promise.all([
      prisma.product.findFirst({ where: { id: d.boxProductId, storeId }, select: { id: true } }),
      prisma.product.count({ where: { storeId, id: { in: productIds } } }),
      prisma.category.count({ where: { storeId, id: { in: categoryIds } } }),
    ])
    if (!box) throw new NotFoundError("Box product", String(d.boxProductId))
    if (products !== productIds.length || categories !== categoryIds.length)
      throw new BadRequestError("One of the chosen products or categories wasn't found", "VALIDATION_FAILED")
    if (productIds.includes(d.boxProductId)) throw new BadRequestError("The box can't hold itself: remove the box product from what it takes", "VALIDATION_FAILED")
    return {
      slug,
      name: d.name.trim(),
      description: text(d.description),
      imageUrl: text(d.imageUrl),
      boxProductId: d.boxProductId,
      minItems: d.minItems,
      maxItems: d.maxItems,
      productIds,
      categoryIds,
      allowMessage: d.allowMessage ?? true,
      messageMax: d.messageMax ?? 200,
      isActive: d.isActive ?? true,
      sortOrder: d.sortOrder ?? 0,
    }
  }

  private async saving<T>(run: () => Promise<T>) {
    try {
      return await run()
    } catch (e) {
      if ((e as { code?: string }).code === "P2002") throw new ConflictError("Another gift box uses that address")
      throw e
    }
  }

  async create(d: GiftBoxInput) {
    const data = await this.data(d)
    const r = await this.saving(() => prisma.giftBox.create({ data: { storeId: this.storeId, ...data } }))
    return this.get(r.id)
  }

  async update(id: bigint, d: GiftBoxInput) {
    await this.get(id)
    const data = await this.data(d)
    await this.saving(() => prisma.giftBox.update({ where: { id }, data }))
    return this.get(id)
  }

  async remove(id: bigint) {
    await this.get(id)
    await prisma.giftBox.delete({ where: { id } })
  }

  // ---------------------------------------------------------------- storefront

  /** The boxes on sale: switched on, with a published box product. */
  async shopList() {
    const rows = await prisma.giftBox.findMany({
      where: { storeId: this.storeId, isActive: true, boxProduct: { status: "published" } },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    })
    const shop = new StorefrontService(this.ctx)
    const out = []
    for (const r of rows) {
      const box = await this.boxProduct(shop, r.boxProductId)
      if (!box) continue
      out.push({
        slug: r.slug,
        name: r.name,
        description: r.description,
        imageUrl: r.imageUrl ?? box.images[0] ?? null,
        minItems: r.minItems,
        maxItems: r.maxItems,
        boxPrice: box.price,
      })
    }
    return out
  }

  private async boxProduct(shop: StorefrontService, id: bigint) {
    const p = await prisma.product.findFirst({ where: { id, storeId: this.storeId }, select: { slug: true } })
    return p ? shop.getProductBySlug(p.slug).catch(() => null) : null
  }

  /** One box for the builder: the box product (its options are box styles) and what it takes. */
  async shopOne(slug: string) {
    const r = await prisma.giftBox.findFirst({ where: { storeId: this.storeId, slug: slug.toLowerCase(), isActive: true } })
    if (!r) throw new NotFoundError("Gift box")
    const box = await this.boxProduct(new StorefrontService(this.ctx), r.boxProductId)
    if (!box) throw new NotFoundError("Gift box")
    return {
      id: String(r.id),
      slug: r.slug,
      name: r.name,
      description: r.description,
      imageUrl: r.imageUrl ?? box.images[0] ?? null,
      minItems: r.minItems,
      maxItems: r.maxItems,
      allowMessage: r.allowMessage,
      messageMax: r.messageMax,
      /** Browse these with /storefront/products (?ids= and ?categoryId=); both empty: any product. */
      productIds: r.productIds.map(String),
      categoryIds: r.categoryIds.map(String),
      box: {
        id: String(box.id),
        slug: String(box.slug),
        name: String(box.title),
        image: box.images[0] ?? null,
        price: Number(box.price),
        inStock: !box.isOutOfStock,
        styles: box.variants.map((v) => ({ id: String(v.id), label: String(v.label), price: Number(v.price), inStock: !!v.inStock, image: v.image ?? null })),
      },
    }
  }
}
