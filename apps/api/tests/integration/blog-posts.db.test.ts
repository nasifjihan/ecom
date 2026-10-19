/**
 * Blog scheduling, featured posts and "shop this" products against a REAL Postgres.
 * Runs only when RUN_DB_TESTS=1.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import type { RequestContext } from "../../src/core"

const runDb = process.env.RUN_DB_TESTS === "1"

describe.skipIf(!runDb)("blog posts (Postgres)", () => {
  let prisma: typeof import("../../src/config/prisma").prisma
  let Content: typeof import("../../src/modules/content/content.service").ContentService
  let storeId: bigint
  let otherStoreId: bigint
  let ctx: RequestContext
  const suffix = Date.now().toString(36)
  const base = { categoryId: null, excerpt: null, content: "Hello", featuredImageUrl: null, tags: [], seoTitle: null, metaDesc: null }

  beforeAll(async () => {
    ;({ prisma } = await import("../../src/config/prisma"))
    ;({ ContentService: Content } = await import("../../src/modules/content/content.service"))
    storeId = (await prisma.store.create({ data: { name: "Blog Shop", slug: `blog-${suffix}` } })).id
    otherStoreId = (await prisma.store.create({ data: { name: "Other", slug: `blog-other-${suffix}` } })).id
    ctx = { storeId, requestId: "t", locale: "en", currency: "BDT" }
  })

  afterAll(async () => {
    if (!prisma || !storeId || !otherStoreId) return // setup failed: an undefined id would match every row
    await prisma.product.deleteMany({ where: { storeId: { in: [storeId, otherStoreId] } } })
    await prisma.store.deleteMany({ where: { id: { in: [storeId, otherStoreId] } } })
    await prisma.$disconnect()
  })

  it("shows a scheduled post once its time passes, pins featured posts, and checks products", async () => {
    const svc = new Content(ctx)
    const mine = await prisma.product.create({ data: { storeId, name: "Panjabi", slug: `p-${suffix}`, regularPrice: 3000 } })
    const theirs = await prisma.product.create({ data: { storeId: otherStoreId, name: "Other", slug: `o-${suffix}`, regularPrice: 10 } })

    const old = await svc.createPost({ ...base, title: "Old news", status: "published" })
    const later = await svc.createPost({ ...base, title: "Eid lookbook", status: "scheduled", scheduledAt: new Date(Date.now() + 86_400_000), productIds: [mine.id] })
    await svc.createPost({ ...base, title: "Pinned guide", status: "published", featured: true })
    await expect(svc.createPost({ ...base, title: "Bad", status: "scheduled", scheduledAt: new Date(Date.now() - 1000) })).rejects.toThrow(/future/)
    await expect(svc.createPost({ ...base, title: "Bad", status: "published", productIds: [theirs.id] })).rejects.toThrow(/isn't in this store/)

    const titles = async () => (await svc.publicPosts({ page: 1, perPage: 10 })).items.map((p) => p.title)
    expect(await titles()).toEqual(["Pinned guide", "Old news"])
    await expect(svc.publicPost(later.slug)).rejects.toThrow()

    // Its time comes: it shows, dated at the scheduled time, with its products.
    const due = new Date(Date.now() - 60_000)
    await prisma.blogPost.update({ where: { id: later.id }, data: { scheduledAt: due, publishedAt: due } })
    expect(await titles()).toEqual(["Pinned guide", "Old news", "Eid lookbook"]) // dated a minute ago, so older than "Old news"
    const shown = await svc.publicPost(later.slug)
    expect(shown.productIds).toEqual([mine.id])

    // Unpublishing and republishing keeps the original date.
    const firstDate = (await prisma.blogPost.findUniqueOrThrow({ where: { id: old.id } })).publishedAt
    await svc.updatePost(old.id, { status: "draft" })
    await svc.updatePost(old.id, { status: "published" })
    expect((await prisma.blogPost.findUniqueOrThrow({ where: { id: old.id } })).publishedAt).toEqual(firstDate)
  })
})
