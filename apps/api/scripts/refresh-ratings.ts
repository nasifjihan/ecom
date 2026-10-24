/**
 * Recounts every product's star rating and review count from its approved reviews. Moderation
 * keeps them right from then on; this fixes products whose numbers were never counted (data from
 * before Batch 44, or added straight to the database).
 *   pnpm --filter @ecom/api ratings:refresh
 */
import { prisma } from "../src/config/prisma"
import { refreshProductRating } from "../src/modules/storefront/engagement"

async function main() {
  const products = await prisma.product.findMany({ select: { id: true } })
  for (const p of products) await refreshProductRating(p.id)
  const rated = await prisma.product.count({ where: { reviewCount: { gt: 0 } } })
  console.log(`Recounted ${products.length} products; ${rated} have approved reviews.`)
}

main()
  .catch((err: Error) => {
    console.error(err.message)
    process.exitCode = 1
  })
  .finally(() => void prisma.$disconnect().then(() => process.exit()))
