/**
 * WAREHOUSES AND TRANSFERS — where stock is kept, what each warehouse holds, moving stock between
 * warehouses, and changing the warehouse an order ships from. Every stock change goes through the
 * ledger (stock.ledger.ts); rules are in stock.rules.ts.
 */
import { Prisma } from "@prisma/client"
import { prisma, tx } from "../../config"
import { BadRequestError, ConflictError, NotFoundError, type RequestContext } from "../../core"
import { defaultWarehouseId, moveStock } from "./stock.ledger"
import { checkTransfer, receiptFor, skuKey, transferCode, warehouseCode } from "./stock.rules"

type T = Prisma.TransactionClient
const n = (v: unknown) => (v === null || v === undefined ? 0 : Number(v))
const round2 = (v: number) => Math.round(v * 100) / 100
const blankToNull = (v: string | null | undefined) => (v?.trim() ? v.trim() : null)
const optionLabel = (values: Prisma.JsonValue | null | undefined) =>
  Object.values((values as Record<string, string> | null) ?? {}).join(" / ")

export interface WarehouseInput {
  name: string
  code?: string | null
  address?: string | null
  phone?: string | null
  isActive?: boolean
  isDefault?: boolean
  sortOrder?: number
}

export class WarehousesService {
  constructor(private readonly ctx: RequestContext) {}

  private get storeId(): bigint {
    if (this.ctx.storeId === undefined)
      throw new BadRequestError("No store for this request", "STORE_REQUIRED")
    return this.ctx.storeId
  }

  private get adminId(): bigint | null {
    return this.ctx.super || !this.ctx.admin ? null : BigInt(this.ctx.admin.id)
  }

  private async find(id: bigint, t: T | typeof prisma = prisma) {
    const w = await t.warehouse.findFirst({ where: { id, storeId: this.storeId } })
    if (!w) throw new NotFoundError("Warehouse")
    return w
  }

  // ================================================================ warehouses

  /** Warehouses with what they hold: options / products stocked, units, held for orders, value at cost. */
  async list() {
    await tx((t: T) => defaultWarehouseId(t, this.storeId)) // every store has one
    const [rows, totals, value, transit] = await Promise.all([
      prisma.warehouse.findMany({
        where: { storeId: this.storeId },
        orderBy: [{ isDefault: "desc" }, { isActive: "desc" }, { sortOrder: "asc" }, { id: "asc" }],
      }),
      prisma.warehouseStock.groupBy({
        by: ["warehouseId"],
        where: { storeId: this.storeId },
        _sum: { onHand: true, reserved: true },
        _count: { _all: true },
      }),
      prisma.$queryRaw<{ warehouseId: bigint; value: number; skus: number }[]>`
        SELECT ws."warehouseId", COUNT(*) FILTER (WHERE ws."onHand" > 0)::int AS skus,
               COALESCE(SUM(ws."onHand" * COALESCE(v."costPrice", p."costPrice", p."supplierCost", 0)), 0)::float8 AS value
        FROM "WarehouseStock" ws
        JOIN "Product" p ON p."id" = ws."productId"
        LEFT JOIN "ProductVariant" v ON v."id" = ws."variantId"
        WHERE ws."storeId" = ${this.storeId} AND ws."onHand" > 0
        GROUP BY ws."warehouseId"`,
      prisma.stockTransfer.groupBy({
        by: ["toWarehouseId"],
        where: { storeId: this.storeId, status: "in_transit" },
        _count: { _all: true },
      }),
    ])
    return rows.map((w) => {
      const t = totals.find((x) => x.warehouseId === w.id)
      const v = value.find((x) => x.warehouseId === w.id)
      return {
        id: String(w.id),
        name: w.name,
        code: w.code,
        address: w.address,
        phone: w.phone,
        isDefault: w.isDefault,
        isActive: w.isActive,
        sortOrder: w.sortOrder,
        skus: v?.skus ?? 0,
        onHand: n(t?._sum.onHand),
        reserved: n(t?._sum.reserved),
        available: n(t?._sum.onHand) - n(t?._sum.reserved),
        valueAtCost: round2(n(v?.value)),
        incomingTransfers: transit.find((x) => x.toWarehouseId === w.id)?._count._all ?? 0,
      }
    })
  }

  async create(d: WarehouseInput) {
    const code = warehouseCode(d.code ?? d.name)
    if (!code)
      throw new BadRequestError(
        "Give a short code of 2–12 letters or digits, e.g. CTG",
        "VALIDATION_FAILED",
      )
    const exists = await prisma.warehouse.findFirst({
      where: { storeId: this.storeId, code },
      select: { id: true },
    })
    if (exists)
      throw new ConflictError(`Another warehouse already uses the code ${code}`, "CONFLICT")
    await tx(async (t: T) => {
      await defaultWarehouseId(t, this.storeId)
      if (d.isDefault)
        await t.warehouse.updateMany({
          where: { storeId: this.storeId },
          data: { isDefault: false },
        })
      await t.warehouse.create({
        data: {
          storeId: this.storeId,
          name: d.name.trim(),
          code,
          address: blankToNull(d.address),
          phone: blankToNull(d.phone),
          isDefault: d.isDefault ?? false,
          isActive: true,
          sortOrder: d.sortOrder ?? 0,
        },
      })
    })
    return this.list()
  }

  async update(id: bigint, d: Partial<WarehouseInput>) {
    const w = await this.find(id)
    let code: string | undefined
    if (d.code !== undefined && d.code !== null) {
      const c = warehouseCode(d.code)
      if (!c)
        throw new BadRequestError(
          "Give a short code of 2–12 letters or digits, e.g. CTG",
          "VALIDATION_FAILED",
        )
      const clash = await prisma.warehouse.findFirst({
        where: { storeId: this.storeId, code: c, NOT: { id } },
        select: { id: true },
      })
      if (clash) throw new ConflictError(`Another warehouse already uses the code ${c}`, "CONFLICT")
      code = c
    }
    if (d.isActive === false) {
      if (w.isDefault || d.isDefault)
        throw new BadRequestError(
          "Make another warehouse the default before turning this one off",
          "VALIDATION_FAILED",
        )
      const held = await prisma.warehouseStock.aggregate({
        where: { warehouseId: id },
        _sum: { onHand: true, reserved: true },
      })
      if (n(held._sum.onHand) || n(held._sum.reserved))
        throw new BadRequestError(
          "This warehouse still has stock or holds for orders. Transfer it out first",
          "VALIDATION_FAILED",
        )
    }
    if (d.isDefault === false && w.isDefault)
      throw new BadRequestError("Make another warehouse the default instead", "VALIDATION_FAILED")
    if (d.isDefault && !(d.isActive ?? w.isActive))
      throw new BadRequestError("Only a warehouse in use can be the default", "VALIDATION_FAILED")
    await tx(async (t: T) => {
      if (d.isDefault)
        await t.warehouse.updateMany({
          where: { storeId: this.storeId },
          data: { isDefault: false },
        })
      await t.warehouse.update({
        where: { id },
        data: {
          ...(d.name !== undefined ? { name: d.name.trim() } : {}),
          ...(code ? { code } : {}),
          ...(d.address !== undefined ? { address: blankToNull(d.address) } : {}),
          ...(d.phone !== undefined ? { phone: blankToNull(d.phone) } : {}),
          ...(d.isActive !== undefined ? { isActive: d.isActive } : {}),
          ...(d.isDefault ? { isDefault: true } : {}),
          ...(d.sortOrder !== undefined ? { sortOrder: d.sortOrder } : {}),
        },
      })
    })
    return this.list()
  }

  /** Only a warehouse that never held stock or orders can be deleted; others are turned off. */
  async remove(id: bigint) {
    const w = await this.find(id)
    if (w.isDefault)
      throw new BadRequestError("The default warehouse can't be deleted", "VALIDATION_FAILED")
    const [stock, orders, transfers, purchases] = await Promise.all([
      prisma.warehouseStock.count({
        where: { warehouseId: id, OR: [{ onHand: { not: 0 } }, { reserved: { not: 0 } }] },
      }),
      prisma.order.count({ where: { warehouseId: id } }),
      prisma.stockTransfer.count({
        where: { OR: [{ fromWarehouseId: id }, { toWarehouseId: id }] },
      }),
      prisma.purchase.count({ where: { warehouseId: id } }),
    ])
    if (stock || orders || transfers || purchases)
      throw new ConflictError(
        "This warehouse has stock or history. Turn it off instead of deleting it",
        "CONFLICT",
      )
    await prisma.warehouse.delete({ where: { id } })
    return this.list()
  }

  // ================================================================ stock by warehouse

  /**
   * Each product / option with its stock in every warehouse (for the Stock page and transfer picker).
   * `warehouseId` limits the rows to what that warehouse has or holds.
   */
  async stock(q: { search?: string; warehouseId?: bigint; inStockOnly?: boolean }) {
    const warehouses = await prisma.warehouse.findMany({
      where: { storeId: this.storeId },
      orderBy: [{ isDefault: "desc" }, { sortOrder: "asc" }, { id: "asc" }],
      select: { id: true, code: true, name: true, isActive: true },
    })
    const search = q.search?.trim()
    const products = await prisma.product.findMany({
      where: {
        storeId: this.storeId,
        manageStock: true,
        status: { not: "archived" },
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { sku: { contains: search, mode: "insensitive" } },
                { variants: { some: { sku: { contains: search, mode: "insensitive" } } } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        sku: true,
        images: { orderBy: { sortOrder: "asc" }, take: 1, select: { imageUrl: true } },
        variants: {
          where: { status: "active" },
          orderBy: { id: "asc" },
          select: { id: true, sku: true, attributeValues: true },
        },
        warehouseStock: {
          select: { warehouseId: true, skuKey: true, onHand: true, reserved: true, bin: true },
        },
      },
      orderBy: { name: "asc" },
      take: 200,
    })
    const rows = products.flatMap((p) => {
      const make = (v: (typeof p.variants)[number] | null) => {
        const key = skuKey(p.id, v?.id ?? null)
        const at = p.warehouseStock.filter((s) => s.skuKey === key)
        const label = v ? optionLabel(v.attributeValues) : ""
        const by = warehouses.map((w) => {
          const s = at.find((x) => x.warehouseId === w.id)
          return {
            warehouseId: String(w.id),
            code: w.code,
            onHand: s?.onHand ?? 0,
            reserved: s?.reserved ?? 0,
            bin: s?.bin ?? null,
          }
        })
        return {
          key,
          productId: String(p.id),
          variantId: v ? String(v.id) : null,
          name: label ? `${p.name} (${label})` : p.name,
          sku: (v ? v.sku : p.sku) ?? null,
          imageUrl: p.images[0]?.imageUrl ?? null,
          onHand: by.reduce((a, b) => a + b.onHand, 0),
          reserved: by.reduce((a, b) => a + b.reserved, 0),
          byWarehouse: by,
        }
      }
      return p.variants.length ? p.variants.map(make) : [make(null)]
    })
    const wid = q.warehouseId ? String(q.warehouseId) : null
    const filtered = rows.filter((r) => {
      if (wid) {
        const at = r.byWarehouse.find((b) => b.warehouseId === wid)
        return !!at && (at.onHand !== 0 || at.reserved !== 0)
      }
      return !q.inStockOnly || r.onHand > 0
    })
    return {
      warehouses: warehouses.map((w) => ({
        id: String(w.id),
        code: w.code,
        name: w.name,
        isActive: w.isActive,
      })),
      items: filtered,
    }
  }

  // ================================================================ transfers

  private transferView(
    t: Prisma.StockTransferGetPayload<{
      include: { fromWarehouse: true; toWarehouse: true; items: true }
    }>,
  ) {
    const sent = t.items.reduce((a, i) => a + i.qtySent, 0)
    const received = t.items.reduce((a, i) => a + (i.qtyReceived ?? 0), 0)
    return {
      id: String(t.id),
      code: t.code,
      status: t.status,
      from: {
        id: String(t.fromWarehouse.id),
        name: t.fromWarehouse.name,
        code: t.fromWarehouse.code,
      },
      to: { id: String(t.toWarehouse.id), name: t.toWarehouse.name, code: t.toWarehouse.code },
      note: t.note,
      receivedNote: t.receivedNote,
      sentAt: t.sentAt.toISOString(),
      receivedAt: t.receivedAt?.toISOString() ?? null,
      cancelledAt: t.cancelledAt?.toISOString() ?? null,
      units: sent,
      unitsReceived: t.status === "received" ? received : null,
      shortfall: t.status === "received" ? sent - received : null,
      items: t.items.map((i) => ({
        id: String(i.id),
        productId: String(i.productId),
        variantId: i.variantId ? String(i.variantId) : null,
        name: i.name,
        sku: i.sku,
        qtySent: i.qtySent,
        qtyReceived: i.qtyReceived,
      })),
    }
  }

  async transfers(q: { status?: string; page: number; perPage: number }) {
    const where = { storeId: this.storeId, ...(q.status ? { status: q.status } : {}) }
    const [total, rows] = await Promise.all([
      prisma.stockTransfer.count({ where }),
      prisma.stockTransfer.findMany({
        where,
        include: { fromWarehouse: true, toWarehouse: true, items: true },
        orderBy: { id: "desc" },
        skip: (q.page - 1) * q.perPage,
        take: q.perPage,
      }),
    ])
    return {
      items: rows.map((r) => this.transferView(r)),
      meta: {
        page: q.page,
        perPage: q.perPage,
        total,
        totalPages: Math.max(1, Math.ceil(total / q.perPage)),
      },
    }
  }

  async transfer(id: bigint) {
    const t = await prisma.stockTransfer.findFirst({
      where: { id, storeId: this.storeId },
      include: { fromWarehouse: true, toWarehouse: true, items: true },
    })
    if (!t) throw new NotFoundError("Transfer")
    return this.transferView(t)
  }

  /** Sends stock: it leaves the source at once (only units not held for orders can go). */
  async send(d: {
    fromWarehouseId: bigint
    toWarehouseId: bigint
    items: { productId: bigint; variantId?: bigint | null; qty: number }[]
    note?: string | null
  }) {
    const problem = checkTransfer(
      String(d.fromWarehouseId),
      String(d.toWarehouseId),
      d.items.map((i) => ({ key: skuKey(i.productId, i.variantId), qty: i.qty })),
    )
    if (problem) throw new BadRequestError(problem, "VALIDATION_FAILED")
    const [from, to] = await Promise.all([this.find(d.fromWarehouseId), this.find(d.toWarehouseId)])
    if (!from.isActive || !to.isActive)
      throw new BadRequestError("Both warehouses must be in use", "VALIDATION_FAILED")

    const id = await tx(async (t: T) => {
      const lines: Prisma.StockTransferItemCreateWithoutTransferInput[] = []
      const last = await t.stockTransfer.findFirst({
        where: { storeId: this.storeId },
        orderBy: { id: "desc" },
        select: { code: true },
      })
      const code = transferCode(last ? Number(/(\d+)$/.exec(last.code)?.[1] ?? 0) + 1 : 1)
      for (const i of d.items) {
        const product = await t.product.findFirst({
          where: { id: i.productId, storeId: this.storeId },
          select: {
            name: true,
            sku: true,
            manageStock: true,
            _count: { select: { variants: true } },
          },
        })
        if (!product) throw new NotFoundError("Product")
        let name = product.name
        let sku = product.sku
        if (i.variantId) {
          const v = await t.productVariant.findFirst({
            where: { id: i.variantId, productId: i.productId },
            select: { sku: true, attributeValues: true },
          })
          if (!v) throw new NotFoundError("Option")
          const label = optionLabel(v.attributeValues)
          name = label ? `${product.name} (${label})` : product.name
          sku = v.sku ?? sku
        } else if (product._count.variants) {
          throw new BadRequestError(`Choose an option of "${product.name}"`, "VALIDATION_FAILED")
        }
        const moved = await moveStock(t, {
          storeId: this.storeId,
          warehouseId: from.id,
          sku: { productId: i.productId, variantId: i.variantId ?? null },
          onHand: -i.qty,
          guard: "free",
          reason: "TRANSFER_OUT",
          ref: code,
          note: `To ${to.name}`,
          label: name,
        })
        if (!moved.applied)
          throw new BadRequestError(`"${name}" doesn't track stock`, "VALIDATION_FAILED")
        lines.push({
          product: { connect: { id: i.productId } },
          ...(i.variantId ? { variant: { connect: { id: i.variantId } } } : {}),
          name,
          sku,
          qtySent: i.qty,
        })
      }
      const made = await t.stockTransfer.create({
        data: {
          storeId: this.storeId,
          code,
          fromWarehouseId: from.id,
          toWarehouseId: to.id,
          status: "in_transit",
          note: blankToNull(d.note),
          sentByAdminId: this.adminId,
          items: { create: lines },
        },
      })
      return made.id
    })
    return this.transfer(id)
  }

  /** Receives a transfer: what arrived goes on the destination's shelf; the rest is a shortfall. */
  async receive(id: bigint, d: { items?: { id: bigint; qty: number }[]; note?: string | null }) {
    await tx(async (t: T) => {
      const tr = await t.stockTransfer.findFirst({
        where: { id, storeId: this.storeId },
        include: { items: true, fromWarehouse: true },
      })
      if (!tr) throw new NotFoundError("Transfer")
      if (tr.status !== "in_transit")
        throw new BadRequestError(`This transfer is already ${tr.status}`, "VALIDATION_FAILED")
      const got = receiptFor(
        tr.items.map((i) => ({ id: String(i.id), name: i.name, qtySent: i.qtySent })),
        (d.items ?? []).map((i) => ({ id: String(i.id), qty: i.qty })),
      )
      if ("error" in got) throw new BadRequestError(got.error, "VALIDATION_FAILED")
      if (got.totalShort > 0 && !d.note?.trim())
        throw new BadRequestError("Some items are missing: say what happened", "VALIDATION_FAILED")
      for (const line of got.lines) {
        const item = tr.items.find((i) => String(i.id) === line.id)!
        await moveStock(t, {
          storeId: this.storeId,
          warehouseId: tr.toWarehouseId,
          sku: { productId: item.productId, variantId: item.variantId },
          onHand: line.received,
          reason: "TRANSFER_IN",
          ref: tr.code,
          note: `From ${tr.fromWarehouse.name}${line.short ? ` (${line.short} short)` : ""}`,
          label: item.name,
        })
        await t.stockTransferItem.update({
          where: { id: item.id },
          data: { qtyReceived: line.received },
        })
      }
      await t.stockTransfer.update({
        where: { id },
        data: {
          status: "received",
          receivedAt: new Date(),
          receivedByAdminId: this.adminId,
          receivedNote: blankToNull(d.note),
        },
      })
    })
    return this.transfer(id)
  }

  /** Cancels a transfer still on its way: everything goes back to the source's shelf. */
  async cancel(id: bigint) {
    await tx(async (t: T) => {
      const tr = await t.stockTransfer.findFirst({
        where: { id, storeId: this.storeId },
        include: { items: true },
      })
      if (!tr) throw new NotFoundError("Transfer")
      if (tr.status !== "in_transit")
        throw new BadRequestError(`This transfer is already ${tr.status}`, "VALIDATION_FAILED")
      for (const item of tr.items) {
        await moveStock(t, {
          storeId: this.storeId,
          warehouseId: tr.fromWarehouseId,
          sku: { productId: item.productId, variantId: item.variantId },
          onHand: item.qtySent,
          reason: "TRANSFER_CANCELLED",
          ref: tr.code,
          label: item.name,
        })
      }
      await t.stockTransfer.update({
        where: { id },
        data: { status: "cancelled", cancelledAt: new Date() },
      })
    })
    return this.transfer(id)
  }

  // ================================================================ orders

  /** Where an order's stock is, per line, in the warehouse it ships from (and elsewhere). */
  async orderStock(orderId: bigint) {
    const o = await prisma.order.findFirst({
      where: { id: orderId, storeId: this.storeId },
      select: {
        id: true,
        status: true,
        warehouseId: true,
        warehouse: { select: { id: true, name: true, code: true } },
        items: {
          select: {
            id: true,
            productId: true,
            variantId: true,
            productName: true,
            quantity: true,
            qtyReserved: true,
          },
        },
        shipments: {
          where: { status: { notIn: ["cancelled", "returned"] } },
          select: { id: true },
        },
      },
    })
    if (!o) throw new NotFoundError("Order")
    const keys = o.items.flatMap((i) => (i.productId ? [skuKey(i.productId, i.variantId)] : []))
    const [rows, warehouses] = await Promise.all([
      prisma.warehouseStock.findMany({ where: { storeId: this.storeId, skuKey: { in: keys } } }),
      prisma.warehouse.findMany({
        where: { storeId: this.storeId, isActive: true },
        orderBy: [{ isDefault: "desc" }, { sortOrder: "asc" }],
        select: { id: true, name: true, code: true },
      }),
    ])
    const wid = o.warehouseId
    const lines = o.items.map((i) => {
      const key = i.productId ? skuKey(i.productId, i.variantId) : null
      const here = rows.find((r) => r.skuKey === key && r.warehouseId === wid)
      return {
        orderItemId: String(i.id),
        name: i.productName,
        quantity: i.quantity,
        held: i.qtyReserved,
        onShelf: here?.onHand ?? 0,
        /** Held units this warehouse can't cover yet (needs a transfer in). */
        short: Math.max(0, i.qtyReserved - (here?.onHand ?? 0)),
        elsewhere: warehouses
          .filter((w) => w.id !== wid)
          .map((w) => {
            const r = rows.find((x) => x.skuKey === key && x.warehouseId === w.id)
            return {
              warehouseId: String(w.id),
              code: w.code,
              free: (r?.onHand ?? 0) - (r?.reserved ?? 0),
            }
          })
          .filter((x) => x.free > 0),
      }
    })
    return {
      warehouse: o.warehouse
        ? { id: String(o.warehouse.id), name: o.warehouse.name, code: o.warehouse.code }
        : null,
      canMove:
        !["CANCELLED", "REFUNDED", "FAILED", "DELIVERED", "COMPLETED"].includes(o.status) &&
        lines.some((l) => l.held > 0),
      warehouses: warehouses.map((w) => ({ id: String(w.id), name: w.name, code: w.code })),
      lines,
    }
  }

  /** Ships an order from another warehouse: what it holds moves there. */
  async moveOrder(orderId: bigint, warehouseId: bigint) {
    const target = await this.find(warehouseId)
    if (!target.isActive)
      throw new BadRequestError("Choose a warehouse that's in use", "VALIDATION_FAILED")
    await tx(async (t: T) => {
      const o = await t.order.findFirst({
        where: { id: orderId, storeId: this.storeId },
        include: { items: true },
      })
      if (!o) throw new NotFoundError("Order")
      if (["CANCELLED", "REFUNDED", "FAILED", "DELIVERED", "COMPLETED"].includes(o.status))
        throw new BadRequestError(`This order is ${o.status.toLowerCase()}`, "VALIDATION_FAILED")
      const from = o.warehouseId ?? (await defaultWarehouseId(t, this.storeId))
      if (from === target.id) return
      for (const i of o.items) {
        if (!i.productId || i.qtyReserved <= 0) continue
        const sku = { productId: i.productId, variantId: i.variantId }
        await moveStock(t, {
          storeId: this.storeId,
          warehouseId: from,
          sku,
          reserved: -i.qtyReserved,
          reason: "ORDER_MOVED",
          ref: o.number,
        })
        await moveStock(t, {
          storeId: this.storeId,
          warehouseId: target.id,
          sku,
          reserved: i.qtyReserved,
          reason: "ORDER_MOVED",
          ref: o.number,
        })
      }
      await t.order.update({ where: { id: o.id }, data: { warehouseId: target.id } })
      await t.orderStatusLog.create({
        data: {
          orderId: o.id,
          status: o.status,
          note: `Ships from ${target.name}`,
          notifyCustomer: false,
          adminId: this.adminId,
        },
      })
    })
    return this.orderStock(orderId)
  }
}
