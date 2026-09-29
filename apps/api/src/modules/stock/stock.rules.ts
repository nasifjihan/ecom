/**
 * STOCK RULES — no I/O (table-tested in tests/unit/stock.test.ts).
 *
 * Stock lives per warehouse as "on hand" (on the shelf) and "reserved" (held for orders not yet
 * packed); available = on hand − reserved. A product's / option's stockQty and reservedStock are
 * the totals over its warehouses.
 *
 * - Placing an order reserves its units in the warehouse it ships from.
 * - Packing a parcel takes the units off the shelf and ends their reservation.
 * - A cancelled or returned parcel puts them back (held again if the order is still open).
 * - Cancelling an order releases what is still reserved.
 * - Transfers take stock out of the source when sent; what arrives is added at the destination,
 *   and anything missing is a shortfall (written off).
 */

export const skuKey = (
  productId: bigint | string,
  variantId: bigint | string | null | undefined,
) => (variantId ? `v${variantId}` : `p${productId}`)

export interface WarehouseOption {
  id: bigint
  isDefault: boolean
  /** Available (on hand − reserved) per skuKey. */
  available: Map<string, number>
}

/**
 * Where an order ships from: the default warehouse when it has everything, otherwise the first
 * warehouse (in the order given) that has everything, otherwise the default (staff transfer stock
 * in before packing).
 */
export function pickWarehouse(
  options: WarehouseOption[],
  needs: { key: string; qty: number }[],
): bigint | null {
  if (!options.length) return null
  const covers = (w: WarehouseOption) => needs.every((n) => (w.available.get(n.key) ?? 0) >= n.qty)
  const def = options.find((w) => w.isDefault) ?? options[0]!
  if (covers(def)) return def.id
  return (options.find(covers) ?? def).id
}

/**
 * Units of a line coming back (a refund with restock): the part still reserved is simply released
 * (it never left the shelf); the rest goes back on the shelf.
 */
export function splitBack(
  qty: number,
  stillReserved: number,
): { release: number; receive: number } {
  const q = Math.max(0, Math.floor(qty))
  const release = Math.min(q, Math.max(0, stillReserved))
  return { release, receive: q - release }
}

export interface TransferLine {
  id: string
  name: string
  qtySent: number
}

/**
 * Checks what arrived against what was sent. Lines not mentioned arrived in full.
 * Returns each line's received and short quantity, or the first problem.
 */
export function receiptFor(
  lines: TransferLine[],
  received: { id: string; qty: number }[],
):
  | { lines: { id: string; received: number; short: number }[]; totalShort: number }
  | { error: string } {
  const got = new Map<string, number>()
  for (const r of received) {
    if (!lines.some((l) => l.id === r.id)) return { error: "That item isn't part of this transfer" }
    if (!Number.isInteger(r.qty) || r.qty < 0)
      return { error: "Received quantities must be whole numbers of 0 or more" }
    got.set(r.id, r.qty)
  }
  const out = lines.map((l) => {
    const rec = got.get(l.id) ?? l.qtySent
    return { id: l.id, received: rec, short: l.qtySent - rec, name: l.name, sent: l.qtySent }
  })
  const over = out.find((l) => l.received > l.sent)
  if (over) return { error: `Only ${over.sent} of "${over.name}" were sent` }
  return {
    lines: out.map(({ id, received: r, short }) => ({ id, received: r, short })),
    totalShort: out.reduce((a, l) => a + l.short, 0),
  }
}

/** A transfer's lines: whole numbers above 0, one line per item, different warehouses. */
export function checkTransfer(
  from: string,
  to: string,
  items: { key: string; qty: number }[],
): string | null {
  if (from === to) return "Choose two different warehouses"
  if (!items.length) return "Add at least one item"
  const seen = new Set<string>()
  for (const i of items) {
    if (!Number.isInteger(i.qty) || i.qty < 1)
      return "Quantities must be whole numbers of 1 or more"
    if (seen.has(i.key)) return "Each item can only be on the transfer once"
    seen.add(i.key)
  }
  return null
}

/** "TR-0001" */
export const transferCode = (n: number) => `TR-${String(n).padStart(4, "0")}`

/** A warehouse code: upper-case letters, digits and dashes, 2–12 long. */
export function warehouseCode(input: string): string | null {
  const c = input
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "-")
    .replace(/[^A-Z0-9-]/g, "")
  return c.length >= 2 && c.length <= 12 ? c : null
}
