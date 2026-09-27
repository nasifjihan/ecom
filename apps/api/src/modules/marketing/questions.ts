/**
 * PRODUCT QUESTIONS AND SEARCH TERMS (admin)
 *   GET    /api/admin/marketing/questions            ?status=pending|published|hidden&search=&page=
 *   PATCH  /api/admin/marketing/questions/:id        { answer?, status? }   answering publishes it
 *   DELETE /api/admin/marketing/questions/:id
 *   GET    /api/admin/marketing/search-terms         ?search=&noResults=1&page=
 * Questions use the reviews permissions; search terms need products.view.
 */
import { Router, type Request, type Response } from "express"
import { z } from "zod"
import type { Prisma } from "@prisma/client"
import { prisma } from "../../config"
import { BadRequestError, NotFoundError, ctrl, envelope, type RequestContext } from "../../core"
import { authMiddleware, rbacMiddleware, validate } from "../../middleware"

type Req = Request & { ctx: RequestContext }
const storeOf = (req: Req) => {
  if (req.ctx.storeId === undefined)
    throw new BadRequestError("No store for this request", "STORE_REQUIRED")
  return req.ctx.storeId
}
const noXss = (v: string) => !/<\s*script|<\s*iframe|on(error|load|click|mouseover)\s*=/i.test(v)

const ListQuery = z.object({
  status: z.enum(["pending", "published", "hidden"]).optional(),
  search: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
})
const UpdateDto = z.object({
  answer: z.string().trim().max(2000).refine(noXss, "No HTML please").optional(),
  status: z.enum(["pending", "published", "hidden"]).optional(),
})
const IdParam = z.object({ id: z.coerce.bigint().positive() })
const TermsQuery = z.object({
  search: z.string().trim().max(60).optional(),
  noResults: z.enum(["1", "0"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(50),
})

const view = (
  q: Prisma.ProductQuestionGetPayload<{
    include: { product: { select: { id: true; name: true; slug: true } } }
  }>,
) => ({
  id: String(q.id),
  product: { id: String(q.product.id), name: q.product.name, slug: q.product.slug },
  name: q.name,
  question: q.question,
  answer: q.answer,
  status: q.status,
  fromCustomer: q.customerId !== null,
  askedAt: q.createdAt.toISOString(),
  answeredAt: q.answeredAt?.toISOString() ?? null,
})

export const adminQuestionsRouter = Router()
adminQuestionsRouter.use(authMiddleware("adminOrSuper"))

adminQuestionsRouter.get(
  "/",
  rbacMiddleware("reviews.view"),
  validate({ query: ListQuery }),
  ctrl(async (req: Req, res: Response) => {
    const q = req.query as unknown as z.infer<typeof ListQuery>
    const where: Prisma.ProductQuestionWhereInput = {
      storeId: storeOf(req),
      ...(q.status ? { status: q.status } : {}),
      ...(q.search
        ? {
            OR: [
              { question: { contains: q.search, mode: "insensitive" } },
              { name: { contains: q.search, mode: "insensitive" } },
              { product: { name: { contains: q.search, mode: "insensitive" } } },
            ],
          }
        : {}),
    }
    const [total, rows, pending] = await Promise.all([
      prisma.productQuestion.count({ where }),
      prisma.productQuestion.findMany({
        where,
        include: { product: { select: { id: true, name: true, slug: true } } },
        orderBy: { createdAt: "desc" },
        skip: (q.page - 1) * q.perPage,
        take: q.perPage,
      }),
      prisma.productQuestion.count({ where: { storeId: storeOf(req), status: "pending" } }),
    ])
    envelope(res, {
      data: rows.map(view),
      meta: {
        page: q.page,
        perPage: q.perPage,
        total,
        totalPages: Math.ceil(total / q.perPage),
        pending,
      },
    })
  }),
)

adminQuestionsRouter.patch(
  "/:id",
  rbacMiddleware("reviews.edit"),
  validate({ params: IdParam, body: UpdateDto }),
  ctrl(async (req: Req, res: Response) => {
    const id = BigInt((req.params as { id: string }).id)
    const b = req.body as z.infer<typeof UpdateDto>
    const cur = await prisma.productQuestion.findFirst({ where: { id, storeId: storeOf(req) } })
    if (!cur) throw new NotFoundError("Question")
    const answer = b.answer !== undefined ? b.answer || null : cur.answer
    // Answering publishes it unless a status was given; a question without an answer can't be shown.
    const status = b.status ?? (b.answer ? "published" : cur.status)
    if (status === "published" && !answer)
      throw new BadRequestError(
        "Write an answer before publishing the question",
        "VALIDATION_FAILED",
      )
    const answered = b.answer !== undefined && b.answer !== cur.answer && !!b.answer
    const row = await prisma.productQuestion.update({
      where: { id },
      data: {
        answer,
        status,
        ...(answered
          ? {
              answeredAt: new Date(),
              answeredByAdminId: req.ctx.admin?.id ? BigInt(req.ctx.admin.id) : null,
            }
          : {}),
      },
      include: { product: { select: { id: true, name: true, slug: true } } },
    })
    envelope(res, {
      data: view(row),
      message: status === "published" ? "Answer published" : "Question saved",
    })
  }),
)

adminQuestionsRouter.delete(
  "/:id",
  rbacMiddleware("reviews.delete"),
  validate({ params: IdParam }),
  ctrl(async (req: Req, res: Response) => {
    const id = BigInt((req.params as { id: string }).id)
    const r = await prisma.productQuestion.deleteMany({ where: { id, storeId: storeOf(req) } })
    if (!r.count) throw new NotFoundError("Question")
    envelope(res, { data: { deleted: true }, message: "Question deleted" })
  }),
)

export const adminSearchTermsRouter = Router()
adminSearchTermsRouter.get(
  "/",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("products.view"),
  validate({ query: TermsQuery }),
  ctrl(async (req: Req, res: Response) => {
    const q = req.query as unknown as z.infer<typeof TermsQuery>
    const where: Prisma.SearchTermWhereInput = {
      storeId: storeOf(req),
      ...(q.search ? { term: { contains: q.search.toLowerCase() } } : {}),
      ...(q.noResults === "1" ? { results: 0 } : {}),
    }
    const [total, rows] = await Promise.all([
      prisma.searchTerm.count({ where }),
      prisma.searchTerm.findMany({
        where,
        orderBy: [{ searches: "desc" }, { lastSearchedAt: "desc" }],
        skip: (q.page - 1) * q.perPage,
        take: q.perPage,
      }),
    ])
    envelope(res, {
      data: rows.map((r) => ({
        id: String(r.id),
        term: r.term,
        searches: r.searches,
        results: r.results,
        lastSearchedAt: r.lastSearchedAt.toISOString(),
      })),
      meta: { page: q.page, perPage: q.perPage, total, totalPages: Math.ceil(total / q.perPage) },
    })
  }),
)
