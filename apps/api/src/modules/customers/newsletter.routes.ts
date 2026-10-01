/**
 * NEWSLETTER ROUTES
 *   storefront: POST /api/storefront/newsletter {email, name?}, POST /api/storefront/newsletter/unsubscribe {token}
 *   admin (customers.*): GET /api/admin/newsletter, POST {email, name?}, POST /:id/unsubscribe, GET /export (CSV)
 */
import { Router, type Request, type Response } from "express"
import { z } from "zod"
import { ctrl, envelope, BadRequestError, type RequestContext } from "../../core"
import { authMiddleware, rbacMiddleware, validate } from "../../middleware"
import { NewsletterService } from "./newsletter.service"

type Req = Request & { ctx: RequestContext }
const svc = (req: Req) => {
  if (req.ctx.storeId === undefined) throw new BadRequestError("Store not resolved", "TENANT_NOT_RESOLVED")
  return new NewsletterService(BigInt(req.ctx.storeId))
}
const send = (res: Response, body: Parameters<typeof envelope>[1]): void => {
  envelope(res, body)
}

const SignUp = z.object({ email: z.string().trim().max(254), name: z.string().trim().max(120).optional() })
const Token = z.object({ token: z.string().trim().min(10).max(100) })
const ListQuery = z.object({
  status: z.enum(["subscribed", "unsubscribed"]).optional(),
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
})
const IdParam = z.object({ id: z.coerce.bigint().positive() })

export const storefrontNewsletterRouter = Router()
storefrontNewsletterRouter.post(
  "/",
  validate({ body: SignUp }),
  ctrl(async (req: Req, res: Response) => {
    const b = req.body as z.infer<typeof SignUp>
    await svc(req).subscribe({ email: b.email, name: b.name, source: "footer", locale: req.ctx.locale })
    send(res, { status: 200, data: { subscribed: true }, message: "Subscribed" })
  }),
)
storefrontNewsletterRouter.post(
  "/unsubscribe",
  validate({ body: Token }),
  ctrl(async (req: Req, res: Response) => {
    send(res, { status: 200, data: await svc(req).unsubscribeByToken((req.body as z.infer<typeof Token>).token), message: "Unsubscribed" })
  }),
)

export const adminNewsletterRouter = Router()
adminNewsletterRouter.use(authMiddleware("adminOrSuper"))
adminNewsletterRouter.get(
  "/",
  rbacMiddleware("customers.view"),
  validate({ query: ListQuery }),
  ctrl(async (req: Req, res: Response) => {
    const r = await svc(req).list(req.query as unknown as z.infer<typeof ListQuery>)
    send(res, { status: 200, data: r.items, meta: r.meta })
  }),
)
adminNewsletterRouter.get(
  "/export",
  rbacMiddleware("customers.view"),
  validate({ query: ListQuery }),
  ctrl(async (req: Req, res: Response) => {
    const csv = await svc(req).csv(req.query)
    res.setHeader("Content-Type", "text/csv; charset=utf-8")
    res.setHeader("Content-Disposition", `attachment; filename="newsletter-${new Date().toISOString().slice(0, 10)}.csv"`)
    res.status(200).send(`\uFEFF${csv}`)
  }),
)
adminNewsletterRouter.post(
  "/",
  rbacMiddleware("customers.create"),
  validate({ body: SignUp }),
  ctrl(async (req: Req, res: Response) => {
    const b = req.body as z.infer<typeof SignUp>
    send(res, { status: 201, data: await svc(req).subscribe({ email: b.email, name: b.name, source: "admin" }), message: "Added to the list" })
  }),
)
adminNewsletterRouter.post(
  "/:id/unsubscribe",
  rbacMiddleware("customers.edit"),
  validate({ params: IdParam }),
  ctrl(async (req: Req, res: Response) => {
    send(res, { status: 200, data: await svc(req).remove(BigInt(String(req.params.id))), message: "Unsubscribed" })
  }),
)
