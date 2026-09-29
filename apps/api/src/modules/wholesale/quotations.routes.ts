/**
 * QUOTATION ROUTES
 * Admin (/api/admin/quotations; orders.view to look, orders.create to change):
 *   GET /                         list with status counts (?status incl. EXPIRED, ?search, ?customerId)
 *   POST /preview                 names and normal prices of lines for a customer (the editor)
 *   POST /, GET|PUT|DELETE /:id   create, read, change (goes back to draft), delete a never-sent draft
 *   POST /:id/send, /:id/cancel   send to the customer (email), withdraw
 *   Turning a quote into an order: POST /api/admin/orders/manual with `quotationId`.
 * Storefront (/api/storefront/account/quotes, signed-in customer):
 *   GET /, GET /:number           my quotes
 *   POST /request                 ask for a quote on my cart (approved business accounts)
 *   POST /:number/respond         accept or decline a sent quote
 */
import { Router, type Request, type Response } from "express"
import type { z } from "zod"
import { UnauthorizedError, ctrl, envelope, type RequestContext } from "../../core"
import { authMiddleware, rbacMiddleware, validate } from "../../middleware"
import { QuotationsService } from "./quotations.service"
import { IdParam, QuoteNumberParam, QuotePreviewDto, QuotesQuery, RequestQuoteDto, RespondQuoteDto, SaveQuoteDto } from "./wholesale.dto"

type Req = Request & { ctx: RequestContext }
const svc = (req: Req) => new QuotationsService(req.ctx)
const id = (req: Req) => BigInt((req.params as { id: string }).id)
const num = (req: Req) => (req.params as { number: string }).number
const body = <S extends z.ZodTypeAny>(req: Req) => req.body as z.infer<S>
const query = <S extends z.ZodTypeAny>(req: Req) => req.query as unknown as z.infer<S>
const me = (req: Req) => {
  if (!req.ctx.customer) throw new UnauthorizedError("Please sign in")
  return req.ctx.customer.id
}

export const adminQuotationsRouter = Router()
adminQuotationsRouter.use(authMiddleware("adminOrSuper"))

adminQuotationsRouter.get(
  "/",
  rbacMiddleware("orders.view"),
  validate({ query: QuotesQuery }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).list(query<typeof QuotesQuery>(req)) })
  }),
)
adminQuotationsRouter.post(
  "/preview",
  rbacMiddleware("orders.create"),
  validate({ body: QuotePreviewDto }),
  ctrl(async (req: Req, res: Response) => {
    const b = body<typeof QuotePreviewDto>(req)
    envelope(res, { data: await svc(req).previewLines(b.customerId, b.storefrontId, b.items) })
  }),
)
adminQuotationsRouter.post(
  "/",
  rbacMiddleware("orders.create"),
  validate({ body: SaveQuoteDto }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { status: 201, data: await svc(req).create(body<typeof SaveQuoteDto>(req)), message: "Quote saved" })
  }),
)
adminQuotationsRouter.get(
  "/:id",
  rbacMiddleware("orders.view"),
  validate({ params: IdParam }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).get(id(req)) })
  }),
)
adminQuotationsRouter.put(
  "/:id",
  rbacMiddleware("orders.create"),
  validate({ params: IdParam, body: SaveQuoteDto }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).update(id(req), body<typeof SaveQuoteDto>(req)), message: "Quote saved" })
  }),
)
adminQuotationsRouter.delete(
  "/:id",
  rbacMiddleware("orders.create"),
  validate({ params: IdParam }),
  ctrl(async (req: Req, res: Response) => {
    await svc(req).remove(id(req))
    envelope(res, { data: null, message: "Draft deleted" })
  }),
)
adminQuotationsRouter.post(
  "/:id/send",
  rbacMiddleware("orders.create"),
  validate({ params: IdParam }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).send(id(req)), message: "Quote sent to the customer" })
  }),
)
adminQuotationsRouter.post(
  "/:id/cancel",
  rbacMiddleware("orders.create"),
  validate({ params: IdParam }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).cancel(id(req)), message: "Quote cancelled" })
  }),
)

// ---------------------------------------------------------------- storefront

export const storefrontQuotesRouter = Router()
storefrontQuotesRouter.use("/quotes", authMiddleware("customer"))

storefrontQuotesRouter.get(
  "/quotes",
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).mine(me(req)) })
  }),
)
storefrontQuotesRouter.post(
  "/quotes/request",
  validate({ body: RequestQuoteDto }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, {
      status: 201,
      data: await svc(req).request(me(req), body<typeof RequestQuoteDto>(req)),
      message: "Quote requested",
    })
  }),
)
storefrontQuotesRouter.get(
  "/quotes/:number",
  validate({ params: QuoteNumberParam }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).myOne(me(req), num(req)) })
  }),
)
storefrontQuotesRouter.post(
  "/quotes/:number/respond",
  validate({ params: QuoteNumberParam, body: RespondQuoteDto }),
  ctrl(async (req: Req, res: Response) => {
    const dto = body<typeof RespondQuoteDto>(req)
    envelope(res, {
      data: await svc(req).respond(me(req), num(req), dto.action, dto.note),
      message: dto.action === "accept" ? "Quote accepted" : "Quote declined",
    })
  }),
)
