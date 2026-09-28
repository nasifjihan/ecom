/**
 * STOCK LEDGER — the only code that changes stock. Every call runs inside the caller's transaction
 * and keeps three things in step:
 *   - the warehouse row (WarehouseStock.onHand / reserved),
 *   - the product's or option's totals (stockQty = on hand, reservedStock = reserved),
 *   - for an option, its product's totals too.
 * Changes to on-hand stock are written to the stock log (InventoryLog) with the warehouse.
 * Guards are single conditional UPDATEs, so two orders can't both take the last unit.
 * Products that don't track stock (manageStock off) are left alone.
 */
import { Prisma } from "@prisma/client"
import { BadRequestError } from "../../core"
import { pickWarehouse, skuKey } from "./stock.rules"

type T = Prisma.TransactionClient

export interface Sku {
  productId: bigint
  variantId: bigint | null
}

export interface Move {
  storeId: bigint
  warehouseId: bigint
  sku: Sku
  /** Change to units on the shelf. */
  onHand?: number
  /** Change to units held for orders. */
  reserved?: number
  /**
   * available — the total over all warehouses must have the units free (placing an order);
   *   products that allow backorders skip it.
   * onHand — this warehouse must have the units on the shelf (packing, stock going out).
   * free — this warehouse must have them on the shelf and not held for orders (transfers out).
   */
  guard?: "available" | "onHand" | "free"
  /** Stock log reason, e.g. ORDER_PACKED, PURCHASE, TRANSFER_OUT. */
  reason: string
  ref?: string | null
  note?: string | null
  /** Product name for error messages. */
  label?: string
}

export interface MoveResult {
  /** False when the product doesn't track stock and nothing changed. */
  applied: boolean
}

const short = (label: string | undefined, what: string) =>
  new BadRequestError(`${label ? `"${label}"` : "This item"}: ${what}`, "INSUFFICIENT_STOCK")

/** The store's default warehouse; creates "Main warehouse" when a store has none yet. */
export async function defaultWarehouseId(t: T, storeId: bigint): Promise<bigint> {
  const w = await t.warehouse.findFirst({
    where: { storeId, isDefault: true },
    select: { id: true },
  })
  if (w) return w.id
  const any = await t.warehouse.findFirst({
    where: { storeId, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: { id: true },
  })
  if (any) return any.id
  const made = await t.warehouse.upsert({
    where: { storeId_code: { storeId, code: "MAIN" } },
    create: { storeId, name: "Main warehouse", code: "MAIN", isDefault: true },
    update: {},
    select: { id: true },
  })
  return made.id
}

/** Applies one change. Throws INSUFFICIENT_STOCK when a guard fails. */
export async function moveStock(t: T, m: Move): Promise<MoveResult> {
  const d = Math.trunc(m.onHand ?? 0)
  const r = Math.trunc(m.reserved ?? 0)
  if (!d && !r) return { applied: true }
  const { productId, variantId } = m.sku

  const sku = variantId
    ? await t.productVariant.findFirst({
        where: { id: variantId, productId, product: { storeId: m.storeId } },
        select: { manageStock: true, allowBackorder: true, stockQty: true, reservedStock: true },
      })
    : await t.product.findFirst({
        where: { id: productId, storeId: m.storeId },
        select: { manageStock: true, allowBackorder: true, stockQty: true, reservedStock: true },
      })
  if (!sku) return { applied: false } // deleted since: nothing to move
  if (!sku.manageStock) return { applied: false }

  const key = skuKey(productId, variantId)
  if (!(await t.warehouseStock.count({ where: { productId, skuKey: key } }))) {
    // Stock recorded before warehouses existed (seed data, imports) is in the default warehouse.
    const def = await defaultWarehouseId(t, m.storeId)
    await t.$executeRaw`
      INSERT INTO "WarehouseStock" ("storeId", "warehouseId", "productId", "variantId", "skuKey", "onHand", "reserved", "updatedAt")
      VALUES (${m.storeId}, ${def}, ${productId}, ${variantId}, ${key}, ${sku.stockQty ?? 0}, ${sku.reservedStock}, NOW())
      ON CONFLICT ("warehouseId", "skuKey") DO NOTHING`
  }
  await t.$executeRaw`
    INSERT INTO "WarehouseStock" ("storeId", "warehouseId", "productId", "variantId", "skuKey", "onHand", "reserved", "updatedAt")
    VALUES (${m.storeId}, ${m.warehouseId}, ${productId}, ${variantId}, ${key}, 0, 0, NOW())
    ON CONFLICT ("warehouseId", "skuKey") DO NOTHING`

  // The guarded update runs first, so a refused move changes nothing (callers may carry on).
  const updateWarehouse = async () => {
    const whGuard =
      m.guard === "onHand"
        ? Prisma.sql`AND "onHand" + ${d} >= 0`
        : m.guard === "free"
          ? Prisma.sql`AND "onHand" - "reserved" + ${d} >= 0`
          : Prisma.empty
    const wh = await t.$queryRaw<{ onHand: number }[]>`
      UPDATE "WarehouseStock"
      SET "onHand" = "onHand" + ${d}, "reserved" = GREATEST("reserved" + ${r}, 0), "updatedAt" = NOW()
      WHERE "warehouseId" = ${m.warehouseId} AND "skuKey" = ${key} ${whGuard}
      RETURNING "onHand"`
    if (wh.length) return
    const cur = await t.warehouseStock.findUnique({
      where: { warehouseId_skuKey: { warehouseId: m.warehouseId, skuKey: key } },
      select: { onHand: true, reserved: true, warehouse: { select: { name: true } } },
    })
    const free = m.guard === "free" ? (cur?.onHand ?? 0) - (cur?.reserved ?? 0) : (cur?.onHand ?? 0)
    throw short(
      m.label,
      `only ${Math.max(0, free)} ${m.guard === "free" ? "free (not held for orders)" : "on the shelf"} in ${cur?.warehouse.name ?? "this warehouse"}, need ${-d}`,
    )
  }
  const updateTotals = async () => {
    const totalGuard =
      m.guard === "available" && !sku.allowBackorder
        ? Prisma.sql`AND COALESCE("stockQty", 0) - "reservedStock" - ${r} + ${d} >= 0`
        : Prisma.empty
    const rows = variantId
      ? await t.$queryRaw<{ stockQty: number }[]>`
          UPDATE "ProductVariant"
          SET "stockQty" = COALESCE("stockQty", 0) + ${d}, "reservedStock" = GREATEST("reservedStock" + ${r}, 0)
          WHERE "id" = ${variantId} ${totalGuard}
          RETURNING "stockQty"`
      : await t.$queryRaw<{ stockQty: number }[]>`
          UPDATE "Product"
          SET "stockQty" = COALESCE("stockQty", 0) + ${d}, "reservedStock" = GREATEST("reservedStock" + ${r}, 0)
          WHERE "id" = ${productId} ${totalGuard}
          RETURNING "stockQty"`
    if (!rows.length) throw short(m.label, "just sold out, please update the order")
    if (variantId) {
      await t.$executeRaw`
        UPDATE "Product"
        SET "stockQty" = COALESCE("stockQty", 0) + ${d}, "reservedStock" = GREATEST("reservedStock" + ${r}, 0)
        WHERE "id" = ${productId}`
    }
    return Number(rows[0]!.stockQty)
  }
  let after: number
  if (m.guard === "available") {
    after = await updateTotals()
    await updateWarehouse()
  } else {
    await updateWarehouse()
    after = await updateTotals()
  }

  if (d) {
    const code = await t.warehouse.findUnique({
      where: { id: m.warehouseId },
      select: { code: true },
    })
    await t.inventoryLog.create({
      data: {
        productId,
        variantId,
        warehouseId: m.warehouseId,
        warehouse: code?.code ?? null,
        changeQty: d,
        reason: m.reason,
        referenceId: m.ref ?? null,
        note: m.note ?? null,
        qtyBefore: after - d,
        qtyAfter: after,
      },
    })
  }
  return { applied: true }
}

/** Units on the shelf in one warehouse, and how many of them are held for orders. */
export async function warehouseLevels(t: T, warehouseId: bigint, sku: Sku) {
  const row = await t.warehouseStock.findUnique({
    where: { warehouseId_skuKey: { warehouseId, skuKey: skuKey(sku.productId, sku.variantId) } },
    select: { onHand: true, reserved: true },
  })
  return { onHand: row?.onHand ?? 0, reserved: row?.reserved ?? 0 }
}

/**
 * The warehouse a new order ships from (see pickWarehouse): the default one when it has
 * everything free, otherwise the first active warehouse that does, otherwise the default.
 */
export async function chooseWarehouse(
  t: T,
  storeId: bigint,
  needs: { sku: Sku; qty: number }[],
): Promise<bigint> {
  const warehouses = await t.warehouse.findMany({
    where: { storeId, isActive: true },
    orderBy: [{ isDefault: "desc" }, { sortOrder: "asc" }, { id: "asc" }],
    select: { id: true, isDefault: true },
  })
  if (warehouses.length <= 1) return warehouses[0]?.id ?? defaultWarehouseId(t, storeId)
  const keys = needs.map((n) => skuKey(n.sku.productId, n.sku.variantId))
  const rows = await t.warehouseStock.findMany({
    where: { storeId, skuKey: { in: keys } },
    select: { warehouseId: true, skuKey: true, onHand: true, reserved: true },
  })
  const choice = pickWarehouse(
    warehouses.map((w) => ({
      id: w.id,
      isDefault: w.isDefault,
      available: new Map(
        rows.filter((x) => x.warehouseId === w.id).map((x) => [x.skuKey, x.onHand - x.reserved]),
      ),
    })),
    needs.map((n, i) => ({ key: keys[i]!, qty: n.qty })),
  )
  return choice ?? defaultWarehouseId(t, storeId)
}

/**
 * An order closing (cancelled, refunded, failed): whatever is still held for it is released, and
 * parcels packed but not yet handed to a courier are unpacked (cancelled, goods back on the shelf).
 * Parcels already on their way come back through "returned".
 */
export async function releaseOrderStock(
  t: T,
  storeId: bigint,
  orderId: bigint,
  reason: string,
  unpack: boolean,
) {
  const order = await t.order.findFirst({
    where: { id: orderId, storeId },
    select: {
      number: true,
      warehouseId: true,
      items: true,
      shipments: { where: { status: "ready" }, include: { items: true } },
    },
  })
  if (!order) return
  const warehouseId = order.warehouseId ?? (await defaultWarehouseId(t, storeId))
  for (const oi of order.items) {
    if (!oi.productId || oi.qtyReserved <= 0) continue
    await moveStock(t, {
      storeId,
      warehouseId,
      sku: { productId: oi.productId, variantId: oi.variantId },
      reserved: -oi.qtyReserved,
      reason,
      ref: order.number,
    })
    await t.orderItem.update({ where: { id: oi.id }, data: { qtyReserved: 0 } })
  }
  if (!unpack) return
  for (const s of order.shipments) {
    for (const si of s.items) {
      const oi = order.items.find((i) => i.id === si.orderItemId)
      if (!oi?.productId) continue
      await moveStock(t, {
        storeId,
        warehouseId: s.warehouseId ?? warehouseId,
        sku: { productId: oi.productId, variantId: oi.variantId },
        onHand: si.quantity,
        reason: "PARCEL_CANCELLED",
        ref: s.code,
        label: oi.productName,
      })
    }
    await t.shipment.update({ where: { id: s.id }, data: { status: "cancelled" } })
    await t.shipmentEvent.create({
      data: { shipmentId: s.id, status: "cancelled", note: "Order cancelled: unpacked" },
    })
  }
  if (order.shipments.length) {
    const active = await t.shipment.count({
      where: { orderId, status: { notIn: ["cancelled", "returned"] } },
    })
    if (!active)
      await t.order.update({ where: { id: orderId }, data: { fulfillmentStatus: "unfulfilled" } })
  }
}

/**
 * The product editor's stock box: brings a product's or option's total on hand to `target` by
 * adding or taking the difference in the default warehouse (other warehouses are changed on the
 * Stock page). A null target, or a product that doesn't track stock, changes nothing.
 */
export async function setStockTotal(
  t: T,
  storeId: bigint,
  sku: Sku,
  target: number | null | undefined,
  label?: string,
) {
  if (target === null || target === undefined) return
  const row = sku.variantId
    ? await t.productVariant.findUnique({
        where: { id: sku.variantId },
        select: { stockQty: true },
      })
    : await t.product.findUnique({ where: { id: sku.productId }, select: { stockQty: true } })
  const delta = Math.trunc(target) - (row?.stockQty ?? 0)
  if (!delta) return
  await moveStock(t, {
    storeId,
    warehouseId: await defaultWarehouseId(t, storeId),
    sku,
    onHand: delta,
    guard: delta < 0 ? "onHand" : undefined,
    reason: delta > 0 ? "EDITOR_ADD" : "EDITOR_REMOVE",
    note: "Changed in the product editor",
    label,
  })
}

/**
 * Re-derives a product's totals after its options changed (added or deleted): the sum of its
 * options, or of its own warehouse rows when it has none.
 */
export async function resyncProductTotals(t: T, productId: bigint) {
  const variants = await t.productVariant.aggregate({
    where: { productId },
    _sum: { stockQty: true, reservedStock: true },
    _count: true,
  })
  if (variants._count > 0) {
    await t.product.update({
      where: { id: productId },
      data: {
        stockQty: variants._sum.stockQty ?? 0,
        reservedStock: variants._sum.reservedStock ?? 0,
      },
    })
    return
  }
  const own = await t.warehouseStock.aggregate({
    where: { productId, skuKey: `p${productId}` },
    _sum: { onHand: true, reserved: true },
  })
  await t.product.update({
    where: { id: productId },
    data: { stockQty: own._sum.onHand ?? 0, reservedStock: own._sum.reserved ?? 0 },
  })
}
