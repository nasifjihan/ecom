/**
 * Review moderation against a real Postgres: every action, the trash, delete only from the trash,
 * the shop's reply, and the product's stars following what's approved. Runs only when RUN_DB_TESTS=1.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import type { RequestContext } from "../../src/core"

const runDb = process.env.RUN_DB_TESTS === "1"

describe.skipIf(!runDb)("review moderation (Postgres)", () => {
  let prisma: typeof import("../../src/config/prisma").prisma
  let Marketing: typeof import("../../src/modules/marketing/marketing.service").MarketingService
  let dto: typeof import("../../src/modules/marketing/marketing.dto")
  let storeId: bigint | undefined
  let owner: bigint
  let productId: bigint
  const ids: bigint[] = []
  const suffix = Date.now().toString(36)

  beforeAll(async () => {
    ;({ prisma } = await import("../../src/config/prisma"))
    ;({ MarketingService: Marketing } = await import("../../src/modules/marketing/marketing.service"))
    dto = await import("../../src/modules/marketing/marketing.dto")
    storeId = (await prisma.store.create({ data: { name: "Reviews", slug: `reviews-${suffix}` } })).id
    const role = await prisma.role.create({ data: { storeId, name: "Owner", slug: "owner", isSystem: true } })
    owner = (
      await prisma.adminUser.create({
        data: { storeId, email: `o-${suffix}@x.test`, name: "Owner", passwordHash: "x", roleId: role.id },
      })
    ).id
    productId = (
      await prisma.product.create({
        data: { storeId, name: "Silk Saree", slug: `saree-${suffix}`, status: "published", regularPrice: 9000 },
      })
    ).id
    // Two approved (5 and 3 stars) and one waiting (1 star).
    for (const [i, rating, status] of [[1, 5, "approved"], [2, 3, "approved"], [3, 1, "pending"]] as const) {
      const customerId = (
        await prisma.customer.create({ data: { storeId, email: `c${i}-${suffix}@x.test`, firstName: "C", lastName: `${i}` } })
      ).id
      ids.push((await prisma.review.create({ data: { storeId, productId, customerId, rating, status } })).id)
    }
  })

  afterAll(async () => {
    if (!prisma || !storeId) return // setup failed: an undefined id would match every row
    await prisma.review.deleteMany({ where: { storeId } })
    await prisma.customer.deleteMany({ where: { storeId } })
    await prisma.adminUser.deleteMany({ where: { storeId } })
    await prisma.product.deleteMany({ where: { storeId } })
    await prisma.store.delete({ where: { id: storeId } })
    await prisma.$disconnect()
  })

  const svc = () =>
    new Marketing({
      storeId,
      requestId: "t",
      locale: "en",
      currency: "BDT",
      admin: { id: owner, role: "owner", permissions: [] },
    } as RequestContext)
  // Through the DTO, as the route does.
  const moderate = (body: Record<string, unknown>) => svc().moderateReviews(dto.ReviewModerateDto.parse(body))
  const stars = async () => {
    const p = await prisma.product.findUniqueOrThrow({ where: { id: productId } })
    return { count: p.reviewCount, avg: Number(p.averageRating) }
  }
  const status = async (id: bigint) => (await prisma.review.findUnique({ where: { id } }))?.status

  it("approving and unapproving move the product's stars", async () => {
    await moderate({ ids: [String(ids[2])], action: "approve" })
    expect(await stars()).toEqual({ count: 3, avg: 3 })
    await moderate({ ids: [String(ids[2])], action: "unapprove" })
    expect(await status(ids[2]!)).toBe("pending")
    expect(await stars()).toEqual({ count: 2, avg: 4 })
  })

  it("spam and unspam", async () => {
    await moderate({ ids: [String(ids[1])], action: "spam" })
    expect(await stars()).toEqual({ count: 1, avg: 5 })
    await moderate({ ids: [String(ids[1])], action: "unspam" })
    expect(await status(ids[1]!)).toBe("pending")
    await moderate({ ids: [String(ids[1])], action: "approve" })
    expect(await stars()).toEqual({ count: 2, avg: 4 })
  })

  it("trash hides a review, delete works only from the trash, restore brings it back", async () => {
    // Not in the trash yet: nothing is deleted.
    expect((await moderate({ ids: [String(ids[0])], action: "delete" })).count).toBe(0)
    await moderate({ ids: [String(ids[0])], action: "trash" })
    expect(await stars()).toEqual({ count: 1, avg: 3 })
    // Lists leave the trash out unless asked for.
    const list = (await svc().listReviews(dto.ListReviewsQueryDto.parse({}))) as { data: { id: bigint }[] }
    expect(list.data.map((r) => r.id).sort()).toEqual([ids[1], ids[2]].sort())
    const trash = (await svc().listReviews(dto.ListReviewsQueryDto.parse({ status: "trashed" }))) as { data: { id: bigint }[] }
    expect(trash.data.map((r) => r.id)).toEqual([ids[0]])

    await moderate({ ids: [String(ids[0])], action: "restore" })
    expect(await status(ids[0]!)).toBe("pending")
    await moderate({ ids: [String(ids[0])], action: "trash" })
    expect((await moderate({ ids: [String(ids[0])], action: "delete" })).count).toBe(1)
    expect(await prisma.review.findUnique({ where: { id: ids[0]! } })).toBeNull()
    expect(await stars()).toEqual({ count: 1, avg: 3 })
  })

  it("saves the shop's reply with who wrote it, and an empty reply removes it", async () => {
    expect(() => dto.ReviewModerateDto.parse({ ids: ["1"], action: "reply" })).toThrow()
    await moderate({ ids: [String(ids[1])], action: "reply", reply: "  Thank you, Mina!  " })
    let r = await prisma.review.findUniqueOrThrow({ where: { id: ids[1]! } })
    expect(r.replyBody).toBe("Thank you, Mina!")
    expect(r.replyAdminId).toBe(owner)
    expect(r.replyAt).toBeInstanceOf(Date)
    await moderate({ ids: [String(ids[1])], action: "reply", reply: "" })
    r = await prisma.review.findUniqueOrThrow({ where: { id: ids[1]! } })
    expect(r.replyBody).toBeNull()
    expect(r.replyAt).toBeNull()
  })

  it("doesn't touch another store's reviews", async () => {
    const other = await prisma.store.create({ data: { name: "Other", slug: `other-${suffix}` } })
    try {
      const c = await prisma.customer.create({ data: { storeId: other.id, email: `x-${suffix}@x.test`, firstName: "X", lastName: "Y" } })
      const p = await prisma.product.create({ data: { storeId: other.id, name: "P", slug: `p-${suffix}`, status: "published", regularPrice: 1 } })
      const theirs = await prisma.review.create({ data: { storeId: other.id, productId: p.id, customerId: c.id, rating: 5, status: "trashed" } })
      expect((await moderate({ ids: [String(theirs.id)], action: "delete" })).count).toBe(0)
      expect(await status(theirs.id)).toBe("trashed")
    } finally {
      await prisma.review.deleteMany({ where: { storeId: other.id } })
      await prisma.customer.deleteMany({ where: { storeId: other.id } })
      await prisma.product.deleteMany({ where: { storeId: other.id } })
      await prisma.store.delete({ where: { id: other.id } })
    }
  })
})
