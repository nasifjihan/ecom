/**
 * Checks the gift boxes in an order's lines against the store's boxes (called by checkout,
 * StorefrontService.quoteOrder). Kept apart from the service so checkout can use it without an
 * import cycle.
 */
import { prisma } from "../../config"
import { checkBoxes, withParents, type BoxDef, type BoxLine, type CheckedBox } from "./giftbox.rules"

/** Checks the gift boxes among an order's lines (nothing to do when there are none). */
export async function checkOrderBoxes(storeId: bigint, lines: BoxLine[]) {
  const boxed = lines.filter((l) => l.box)
  if (!boxed.length) return { problems: [] as string[], boxes: new Map<string, CheckedBox>() }
  const defIds = [...new Set(boxed.map((l) => l.box!.giftBoxId))]
  const productIds = [...new Set(boxed.map((l) => l.productId))]
  const [defs, links, categories] = await Promise.all([
    prisma.giftBox.findMany({ where: { storeId, id: { in: defIds } } }),
    prisma.productCategory.findMany({ where: { productId: { in: productIds } }, select: { productId: true, categoryId: true } }),
    prisma.category.findMany({ where: { storeId }, select: { id: true, parentId: true } }),
  ])
  const parentOf = new Map(categories.map((c) => [c.id, c.parentId]))
  const direct = new Map<bigint, bigint[]>()
  for (const l of links) direct.set(l.productId, [...(direct.get(l.productId) ?? []), l.categoryId])
  const byId = new Map<bigint, BoxDef>(defs.map((d) => [d.id, d]))
  return checkBoxes(boxed, byId, (p) => withParents(direct.get(p) ?? [], parentOf))
}
