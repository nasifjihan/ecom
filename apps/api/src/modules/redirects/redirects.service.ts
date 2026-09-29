/**
 * REDIRECTS — old addresses sent to new ones, and the broken links visitors hit.
 *   Staff add, change, delete and paste redirects (Online Store → Redirects).
 *   Changing a product's, category's, page's or blog post's web address adds a 301 on its own
 *   (recordMove), and points older redirects at the new address.
 *   The storefront fetches the resolved list (its middleware answers with the redirect), counts
 *   hits, and reports addresses that weren't found.
 */
import type { Prisma } from "@prisma/client"
import { logger, prisma } from "../../config"
import { BadRequestError, ConflictError, NotFoundError, type RequestContext } from "../../core"
import { isReserved, makesLoop, normalizePath, normalizeTarget, parseImport, resolveChains } from "./redirect.rules"

type T = Prisma.TransactionClient | typeof prisma

/** Broken links kept per store (the oldest are dropped). */
const NOT_FOUND_CAP = 2000
const ASSET = /\.(png|jpe?g|gif|webp|svg|ico|css|js|map|txt|xml|json|woff2?|ttf)$/i

/**
 * Something moved from `oldPath` to `newPath` (a slug changed): 301 from the old address, older
 * redirects to the old address now go straight to the new one, and nothing redirects the new
 * address away. Never throws: a failure is logged and the save goes ahead.
 */
export async function recordMove(t: T, storeId: bigint, oldPath: string, newPath: string) {
  const from = normalizePath(oldPath)
  const to = normalizeTarget(newPath)
  const toKey = normalizePath(newPath)
  if (!from || !to || !toKey || from === toKey) return
  try {
    await t.redirect.deleteMany({ where: { storeId, fromPath: toKey } })
    await t.redirect.updateMany({ where: { storeId, toUrl: from }, data: { toUrl: to } })
    await t.redirect.upsert({
      where: { storeId_fromPath: { storeId, fromPath: from } },
      create: { storeId, fromPath: from, toUrl: to, statusCode: 301, auto: true, note: "Web address changed" },
      update: { toUrl: to, statusCode: 301, isActive: true },
    })
    await t.notFoundHit.deleteMany({ where: { storeId, path: from } })
  } catch (err) {
    logger.warn({ err, from, to }, "Could not add a redirect for a changed address")
  }
}

export interface RedirectInput {
  fromPath: string
  toUrl: string
  statusCode?: 301 | 302
  isActive?: boolean
  note?: string | null
}

const view = (r: Prisma.RedirectGetPayload<object>) => ({
  id: String(r.id),
  fromPath: r.fromPath,
  toUrl: r.toUrl,
  statusCode: r.statusCode,
  isActive: r.isActive,
  auto: r.auto,
  note: r.note,
  hits: r.hits,
  lastHitAt: r.lastHitAt?.toISOString() ?? null,
  createdAt: r.createdAt.toISOString(),
})

export class RedirectsService {
  constructor(private readonly ctx: RequestContext) {}

  private get storeId(): bigint {
    if (this.ctx.storeId === undefined) throw new BadRequestError("No store for this request", "STORE_REQUIRED")
    return this.ctx.storeId
  }

  // ================================================================ staff

  async list(q: { search?: string; page: number; perPage: number }) {
    const s = q.search?.trim().toLowerCase()
    const where: Prisma.RedirectWhereInput = {
      storeId: this.storeId,
      ...(s ? { OR: [{ fromPath: { contains: s } }, { toUrl: { contains: s, mode: "insensitive" } }, { note: { contains: s, mode: "insensitive" } }] } : {}),
    }
    const [rows, total, broken] = await Promise.all([
      prisma.redirect.findMany({ where, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], skip: (q.page - 1) * q.perPage, take: q.perPage }),
      prisma.redirect.count({ where }),
      prisma.notFoundHit.count({ where: { storeId: this.storeId } }),
    ])
    return { rows: rows.map(view), total, page: q.page, perPage: q.perPage, brokenLinks: broken }
  }

  private async clean(d: RedirectInput, id?: bigint) {
    const fromPath = normalizePath(d.fromPath)
    const toUrl = normalizeTarget(d.toUrl)
    if (!fromPath) throw new BadRequestError("Enter the old address, like /old-page", "VALIDATION_FAILED")
    if (isReserved(fromPath)) throw new BadRequestError(`${fromPath} can't be redirected`, "VALIDATION_FAILED")
    if (!toUrl) throw new BadRequestError("Enter the new address, like /new-page or https://…", "VALIDATION_FAILED")
    const active = await prisma.redirect.findMany({
      where: { storeId: this.storeId, isActive: true, ...(id ? { NOT: { id } } : {}) },
      select: { fromPath: true, toUrl: true, statusCode: true },
    })
    if ((d.isActive ?? true) && makesLoop(active, { fromPath, toUrl, statusCode: d.statusCode ?? 301 })) {
      throw new BadRequestError("That would send visitors round in a circle", "VALIDATION_FAILED")
    }
    return { fromPath, toUrl }
  }

  async create(d: RedirectInput) {
    const { fromPath, toUrl } = await this.clean(d)
    try {
      const row = await prisma.redirect.create({
        data: { storeId: this.storeId, fromPath, toUrl, statusCode: d.statusCode ?? 301, isActive: d.isActive ?? true, note: d.note ?? null },
      })
      await prisma.notFoundHit.deleteMany({ where: { storeId: this.storeId, path: fromPath } })
      return view(row)
    } catch (e) {
      if ((e as { code?: string }).code === "P2002") throw new ConflictError(`${fromPath} already has a redirect`)
      throw e
    }
  }

  async update(id: bigint, d: RedirectInput) {
    const current = await prisma.redirect.findFirst({ where: { id, storeId: this.storeId } })
    if (!current) throw new NotFoundError("Redirect", String(id))
    const { fromPath, toUrl } = await this.clean({ ...d, isActive: d.isActive ?? current.isActive }, id)
    try {
      const row = await prisma.redirect.update({
        where: { id },
        data: { fromPath, toUrl, statusCode: d.statusCode ?? current.statusCode, isActive: d.isActive ?? current.isActive, note: d.note === undefined ? current.note : d.note },
      })
      return view(row)
    } catch (e) {
      if ((e as { code?: string }).code === "P2002") throw new ConflictError(`${fromPath} already has a redirect`)
      throw e
    }
  }

  async remove(ids: bigint[]) {
    const r = await prisma.redirect.deleteMany({ where: { storeId: this.storeId, id: { in: ids } } })
    return { deleted: r.count }
  }

  /** Adds pasted redirects; an existing old address is updated. Loops are skipped with a reason. */
  async import(text: string) {
    const { rows, errors } = parseImport(text)
    if (rows.length > 2000) throw new BadRequestError("Paste at most 2,000 lines at a time", "VALIDATION_FAILED")
    const existing = await prisma.redirect.findMany({
      where: { storeId: this.storeId, isActive: true },
      select: { fromPath: true, toUrl: true, statusCode: true },
    })
    const list = new Map(existing.map((r) => [r.fromPath, r]))
    let added = 0
    let updated = 0
    for (const r of rows) {
      const rule = { fromPath: r.fromPath, toUrl: r.toUrl, statusCode: r.statusCode }
      if (makesLoop([...list.values()], rule)) {
        errors.push({ line: r.line, message: "Would send visitors round in a circle" })
        continue
      }
      const had = list.has(r.fromPath)
      await prisma.redirect.upsert({
        where: { storeId_fromPath: { storeId: this.storeId, fromPath: r.fromPath } },
        create: { storeId: this.storeId, ...rule, note: "Imported" },
        update: { toUrl: r.toUrl, statusCode: r.statusCode, isActive: true },
      })
      list.set(r.fromPath, rule)
      if (had) updated += 1
      else added += 1
    }
    if (rows.length) await prisma.notFoundHit.deleteMany({ where: { storeId: this.storeId, path: { in: rows.map((r) => r.fromPath) } } })
    return { added, updated, errors: errors.sort((a, b) => a.line - b.line) }
  }

  /** Addresses visitors asked for that don't exist, most hit first. */
  async brokenLinks(q: { page: number; perPage: number }) {
    const where = { storeId: this.storeId }
    const [rows, total] = await Promise.all([
      prisma.notFoundHit.findMany({ where, orderBy: [{ hits: "desc" }, { lastSeen: "desc" }], skip: (q.page - 1) * q.perPage, take: q.perPage }),
      prisma.notFoundHit.count({ where }),
    ])
    return {
      rows: rows.map((r) => ({ id: String(r.id), path: r.path, hits: r.hits, referrer: r.referrer, firstSeen: r.firstSeen.toISOString(), lastSeen: r.lastSeen.toISOString() })),
      total,
      page: q.page,
      perPage: q.perPage,
    }
  }

  async dismissBroken(ids: bigint[] | "all") {
    const r = await prisma.notFoundHit.deleteMany({ where: { storeId: this.storeId, ...(ids === "all" ? {} : { id: { in: ids } }) } })
    return { deleted: r.count }
  }

  // ================================================================ storefront

  /** Active redirects, each followed to its final address. */
  async resolved() {
    const rows = await prisma.redirect.findMany({
      where: { storeId: this.storeId, isActive: true },
      select: { fromPath: true, toUrl: true, statusCode: true },
    })
    return resolveChains(rows).map((r) => ({ from: r.fromPath, to: r.toUrl, code: r.statusCode }))
  }

  async hit(path: string) {
    const p = normalizePath(path)
    if (!p) return
    await prisma.redirect.updateMany({ where: { storeId: this.storeId, fromPath: p }, data: { hits: { increment: 1 }, lastHitAt: new Date() } })
  }

  /** A visitor got "not found" at `path`: count it (not for files, redirected paths, or once the log is full). */
  async notFound(path: string, referrer: string | null | undefined) {
    const p = normalizePath(path)
    if (!p || isReserved(p) || ASSET.test(p) || p.length > 300) return
    if (await prisma.redirect.findFirst({ where: { storeId: this.storeId, fromPath: p, isActive: true }, select: { id: true } })) return
    const ref = referrer && /^https?:\/\//.test(referrer) ? referrer.slice(0, 300) : null
    const done = await prisma.notFoundHit.updateMany({
      where: { storeId: this.storeId, path: p },
      data: { hits: { increment: 1 }, lastSeen: new Date(), ...(ref ? { referrer: ref } : {}) },
    })
    if (done.count) return
    if ((await prisma.notFoundHit.count({ where: { storeId: this.storeId } })) >= NOT_FOUND_CAP) {
      const oldest = await prisma.notFoundHit.findFirst({ where: { storeId: this.storeId }, orderBy: { lastSeen: "asc" }, select: { id: true } })
      if (oldest) await prisma.notFoundHit.delete({ where: { id: oldest.id } }).catch(() => undefined)
    }
    await prisma.notFoundHit.create({ data: { storeId: this.storeId, path: p, referrer: ref } }).catch(() => undefined)
  }
}

