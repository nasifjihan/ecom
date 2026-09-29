/**
 * REDIRECT ROUTES
 * Admin (/api/admin/redirects; online_store.view / .edit):
 *   GET /, POST /, PATCH /:id, POST /delete        redirects
 *   POST /import                                   paste "old, new[, 302]" lines
 *   GET /broken, POST /broken/dismiss              addresses visitors hit that don't exist
 * Storefront (/api/storefront/redirects):
 *   GET /                                          active redirects, followed to the end (the middleware caches them)
 *   POST /hit, POST /not-found                     count a redirect used / a page not found
 */
import { Router, type Request, type Response } from "express"
import { z } from "zod"
import { ctrl, envelope, type RequestContext } from "../../core"
import { authMiddleware, rbacMiddleware, validate } from "../../middleware"
import { RedirectsService } from "./redirects.service"

type Req = Request & { ctx: RequestContext }
const svc = (req: Req) => new RedirectsService(req.ctx)
const IdParam = z.object({ id: z.coerce.bigint().positive() })
const Page = z.object({
  search: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(200).default(50),
})
const RedirectDto = z.object({
  fromPath: z.string().trim().min(1).max(600),
  toUrl: z.string().trim().min(1).max(1000),
  statusCode: z.union([z.literal(301), z.literal(302)]).optional(),
  isActive: z.boolean().optional(),
  note: z.string().trim().max(300).nullable().optional(),
})
const IdsDto = z.object({ ids: z.array(z.coerce.bigint().positive()).min(1).max(500) })
const DismissDto = z.object({ ids: z.union([z.literal("all"), z.array(z.coerce.bigint().positive()).min(1).max(500)]) })
const ImportDto = z.object({ text: z.string().max(400_000) })
const PathDto = z.object({ path: z.string().max(2000), referrer: z.string().max(2000).nullable().optional() })

export const adminRedirectsRouter = Router()
adminRedirectsRouter.use(authMiddleware("adminOrSuper"))

adminRedirectsRouter.get(
  "/",
  rbacMiddleware("online_store.view"),
  validate({ query: Page }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).list(req.query as unknown as z.infer<typeof Page>) })
  }),
)
adminRedirectsRouter.post(
  "/",
  rbacMiddleware("online_store.edit"),
  validate({ body: RedirectDto }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { status: 201, data: await svc(req).create(req.body as z.infer<typeof RedirectDto>), message: "Redirect added" })
  }),
)
adminRedirectsRouter.post(
  "/import",
  rbacMiddleware("online_store.edit"),
  validate({ body: ImportDto }),
  ctrl(async (req: Req, res: Response) => {
    const r = await svc(req).import((req.body as z.infer<typeof ImportDto>).text)
    envelope(res, { data: r, message: `${r.added} added, ${r.updated} updated` })
  }),
)
adminRedirectsRouter.post(
  "/delete",
  rbacMiddleware("online_store.edit"),
  validate({ body: IdsDto }),
  ctrl(async (req: Req, res: Response) => {
    const r = await svc(req).remove((req.body as z.infer<typeof IdsDto>).ids)
    envelope(res, { data: r, message: `${r.deleted} deleted` })
  }),
)
adminRedirectsRouter.get(
  "/broken",
  rbacMiddleware("online_store.view"),
  validate({ query: Page }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).brokenLinks(req.query as unknown as z.infer<typeof Page>) })
  }),
)
adminRedirectsRouter.post(
  "/broken/dismiss",
  rbacMiddleware("online_store.edit"),
  validate({ body: DismissDto }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).dismissBroken((req.body as z.infer<typeof DismissDto>).ids), message: "Cleared" })
  }),
)
adminRedirectsRouter.patch(
  "/:id",
  rbacMiddleware("online_store.edit"),
  validate({ params: IdParam, body: RedirectDto }),
  ctrl(async (req: Req, res: Response) => {
    const id = BigInt((req.params as { id: string }).id)
    envelope(res, { data: await svc(req).update(id, req.body as z.infer<typeof RedirectDto>), message: "Redirect saved" })
  }),
)

export const storefrontRedirectsRouter = Router()

storefrontRedirectsRouter.get(
  "/",
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).resolved() })
  }),
)
storefrontRedirectsRouter.post(
  "/hit",
  validate({ body: PathDto }),
  ctrl(async (req: Req, res: Response) => {
    await svc(req).hit((req.body as z.infer<typeof PathDto>).path)
    envelope(res, { data: null })
  }),
)
storefrontRedirectsRouter.post(
  "/not-found",
  validate({ body: PathDto }),
  ctrl(async (req: Req, res: Response) => {
    const b = req.body as z.infer<typeof PathDto>
    await svc(req).notFound(b.path, b.referrer)
    envelope(res, { data: null })
  }),
)
