/**
 * NEWSLETTER — the store's list of people who want its emails. Sign-ups come from the footer box,
 * checkout ("subscribe"), account sign-up or staff; each address appears once per store. The
 * customer with the same email gets `acceptMarketing` to match. Sending is done elsewhere.
 */
import type { Prisma } from "@prisma/client"
import { prisma } from "../../config"
import { BadRequestError, ConflictError, NotFoundError } from "../../core"
import { csvCell, maskEmail, maySubscribe, newsletterEmail, newsletterToken, type NewsletterSource } from "./customer.rules"

const view = (s: Prisma.NewsletterSubscriberGetPayload<object>) => ({
  id: String(s.id),
  email: s.email,
  name: s.name,
  status: s.status,
  source: s.source,
  locale: s.locale,
  createdAt: s.createdAt.toISOString(),
  unsubscribedAt: s.unsubscribedAt?.toISOString() ?? null,
})

export class NewsletterService {
  constructor(private readonly storeId: bigint) {}

  /** Puts an address on the list (or back on it). Refuses staff re-adding someone who left. */
  async subscribe(d: { email: string; name?: string | null; source: NewsletterSource; locale?: string }) {
    const email = newsletterEmail(d.email)
    if (!email) throw new BadRequestError("Enter a valid email address", "VALIDATION_FAILED")
    const current = await prisma.newsletterSubscriber.findUnique({ where: { storeId_email: { storeId: this.storeId, email } } })
    const may = maySubscribe(current, d.source)
    if (!may.ok) throw new ConflictError(may.reason, "CONFLICT")
    const name = d.name?.trim() ? d.name.trim() : null
    const row = current
      ? await prisma.newsletterSubscriber.update({
          where: { id: current.id },
          data: { status: "subscribed", unsubscribedAt: null, ...(name && !current.name ? { name } : {}) },
        })
      : await prisma.newsletterSubscriber.create({
          data: { storeId: this.storeId, email, name, source: d.source, locale: d.locale === "bn" ? "bn" : "en", token: newsletterToken() },
        })
    await prisma.customer.updateMany({ where: { storeId: this.storeId, email: { equals: email, mode: "insensitive" } }, data: { acceptMarketing: true } })
    return view(row)
  }

  /** The unsubscribe link: takes the address off and tells which one (partly hidden). */
  async unsubscribeByToken(token: string) {
    const row = await prisma.newsletterSubscriber.findFirst({ where: { storeId: this.storeId, token } })
    if (!row) throw new NotFoundError("Subscription")
    await this.off(row.id, row.email)
    return { email: maskEmail(row.email) }
  }

  private async off(id: bigint, email: string) {
    await prisma.newsletterSubscriber.update({ where: { id }, data: { status: "unsubscribed", unsubscribedAt: new Date() } })
    await prisma.customer.updateMany({ where: { storeId: this.storeId, email: { equals: email, mode: "insensitive" } }, data: { acceptMarketing: false } })
  }

  // ------------------------------------------------------------ admin

  private where(q: { status?: string; search?: string }): Prisma.NewsletterSubscriberWhereInput {
    return {
      storeId: this.storeId,
      ...(q.status ? { status: q.status } : {}),
      ...(q.search ? { OR: [{ email: { contains: q.search, mode: "insensitive" } }, { name: { contains: q.search, mode: "insensitive" } }] } : {}),
    }
  }

  async list(q: { status?: string; search?: string; page: number; perPage: number }) {
    const where = this.where(q)
    const [total, rows, counts] = await Promise.all([
      prisma.newsletterSubscriber.count({ where }),
      prisma.newsletterSubscriber.findMany({ where, orderBy: { id: "desc" }, skip: (q.page - 1) * q.perPage, take: q.perPage }),
      prisma.newsletterSubscriber.groupBy({ by: ["status"], where: { storeId: this.storeId }, _count: { _all: true } }),
    ])
    const n = (s: string) => counts.find((c) => c.status === s)?._count._all ?? 0
    return {
      items: rows.map(view),
      meta: { page: q.page, perPage: q.perPage, total, totalPages: Math.max(1, Math.ceil(total / q.perPage)), subscribed: n("subscribed"), unsubscribed: n("unsubscribed") },
    }
  }

  async remove(id: bigint) {
    const row = await prisma.newsletterSubscriber.findFirst({ where: { id, storeId: this.storeId } })
    if (!row) throw new NotFoundError("Subscriber")
    await this.off(row.id, row.email)
    return view({ ...row, status: "unsubscribed", unsubscribedAt: new Date() })
  }

  /** Subscribed addresses (or all) as CSV: email, name, status, source, language, signed up. */
  async csv(q: { status?: string; search?: string }) {
    const rows = await prisma.newsletterSubscriber.findMany({ where: this.where(q), orderBy: { id: "asc" }, take: 50_000 })
    const lines = ["email,name,status,source,language,signed_up"]
    for (const r of rows) lines.push([r.email, r.name, r.status, r.source, r.locale, r.createdAt.toISOString().slice(0, 10)].map(csvCell).join(","))
    return `${lines.join("\n")}\n`
  }
}
