/**
 * GIFT BOX RULES — checking the boxes in an order, pure and tested.
 *
 * A gift box is sold as ordinary cart lines tagged with the same box key: one line for the box
 * itself (a product for the packaging, whose options are box styles) and the lines packed in it.
 * The server checks every box before an order is placed: the right box product, the number of
 * items allowed, only products the box takes, and the card message.
 */

export interface BoxTag {
  /** Ties the lines of one box together (made in the browser). */
  key: string
  giftBoxId: bigint
  role: "box" | "item"
  message?: string | null
}

export interface BoxLine {
  productId: bigint
  variantId?: bigint | null
  qty: number
  box?: BoxTag | null
}

export interface BoxDef {
  id: bigint
  name: string
  isActive: boolean
  boxProductId: bigint
  minItems: number
  maxItems: number
  /** Products the box takes; with categoryIds both empty, any product except the box. */
  productIds: bigint[]
  /** Categories whose products it takes (their sub-categories included by the caller). */
  categoryIds: bigint[]
  allowMessage: boolean
  messageMax: number
}

export interface CheckedBox {
  key: string
  giftBoxId: bigint
  name: string
  message: string | null
  items: number
}

export const MAX_BOXES = 10

/** Can this product go in the box? `categories`: the product's categories and their parents. */
export function takes(def: BoxDef, productId: bigint, categories: bigint[]): boolean {
  if (productId === def.boxProductId) return false
  if (!def.productIds.length && !def.categoryIds.length) return true
  return def.productIds.includes(productId) || categories.some((c) => def.categoryIds.includes(c))
}

/**
 * Every box in the lines, checked. Problems are worded for the shopper; `boxes` has each good
 * box's name and message, for the order.
 */
export function checkBoxes(
  lines: BoxLine[],
  defs: Map<bigint, BoxDef>,
  categoriesOf: (productId: bigint) => bigint[],
): { problems: string[]; boxes: Map<string, CheckedBox> } {
  const problems: string[] = []
  const boxes = new Map<string, CheckedBox>()
  const groups = new Map<string, BoxLine[]>()
  for (const l of lines) {
    if (!l.box) continue
    const g = groups.get(l.box.key) ?? []
    g.push(l)
    groups.set(l.box.key, g)
  }
  if (groups.size > MAX_BOXES) problems.push(`An order can have at most ${MAX_BOXES} gift boxes`)

  for (const [key, group] of groups) {
    const def = defs.get(group[0]!.box!.giftBoxId)
    if (!def?.isActive || group.some((l) => l.box!.giftBoxId !== def.id)) {
      problems.push("A gift box in your cart is no longer available")
      continue
    }
    const shells = group.filter((l) => l.box!.role === "box")
    const items = group.filter((l) => l.box!.role === "item")
    const shell = shells[0]
    if (shells.length !== 1 || shell?.qty !== 1 || shell.productId !== def.boxProductId) {
      problems.push(`The "${def.name}" gift box isn't put together correctly. Please remove it and build it again.`)
      continue
    }
    const count = items.reduce((s, l) => s + l.qty, 0)
    if (count < def.minItems) {
      problems.push(`The "${def.name}" gift box needs at least ${def.minItems} items`)
      continue
    }
    if (count > def.maxItems) {
      problems.push(`The "${def.name}" gift box holds at most ${def.maxItems} items`)
      continue
    }
    if (items.some((l) => !takes(def, l.productId, categoriesOf(l.productId)))) {
      problems.push(`Something in the "${def.name}" gift box can't go in it`)
      continue
    }
    const message = shell.box!.message?.trim() ? shell.box!.message.trim() : null
    if (message && !def.allowMessage) {
      problems.push(`The "${def.name}" gift box doesn't come with a message card`)
      continue
    }
    if (message && message.length > def.messageMax) {
      problems.push(`The message for the "${def.name}" gift box is too long (at most ${def.messageMax} characters)`)
      continue
    }
    boxes.set(key, { key, giftBoxId: def.id, name: def.name, message, items: count })
  }
  return { problems, boxes }
}

/** A category and all the categories above it. */
export function withParents(categoryIds: bigint[], parentOf: Map<bigint, bigint | null>): bigint[] {
  const out = new Set<bigint>()
  for (const id of categoryIds) {
    let c: bigint | null | undefined = id
    for (let hops = 0; c != null && hops < 20 && !out.has(c); hops++) {
      out.add(c)
      c = parentOf.get(c)
    }
  }
  return [...out]
}
