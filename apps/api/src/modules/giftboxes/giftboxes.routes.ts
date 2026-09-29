/**
 * GIFT BOX ROUTES
 * Admin (/api/admin/gift-boxes; Products permissions: view / create / edit / delete):
 *   GET /, GET /:id, POST /, PATCH /:id, DELETE /:id
 * Storefront (/api/storefront/gift-boxes):
 *   GET /          the boxes on sale
 *   GET /:slug     one box for the builder
 * Boxes are bought through checkout: cart lines carry `box` (storefront.dto CartLineDto).
 */
import { Router, type Request, type Response } from "express"
import { z } from "zod"
import { ctrl, envelope, type RequestContext } from "../../core"
import { authMiddleware, rbacMiddleware, validate } from "../../middleware"
import { GiftBoxesService, type GiftBoxInput } from "./giftboxes.service"

type Req = Request & { ctx: RequestContext }
const svc = (req: Req) => new GiftBoxesService(req.ctx)
const IdParam = z.object({ id: z.coerce.bigint().positive() })
const SlugParam = z.object({ slug: z.string().trim().min(1).max(120) })
const Ids = z.array(z.coerce.bigint().positive()).max(500)

const GiftBoxDto = z.object({
  slug: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).nullable().optional(),
  imageUrl: z.string().trim().max(1000).nullable().optional(),
  boxProductId: z.coerce.bigint().positive(),
  minItems: z.number().int().min(1).max(50),
  maxItems: z.number().int().min(1).max(50),
  productIds: Ids.optional(),
  categoryIds: Ids.optional(),
  allowMessage: z.boolean().optional(),
  messageMax: z.number().int().min(10).max(1000).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
})

export const adminGiftBoxesRouter = Router()
adminGiftBoxesRouter.use(authMiddleware("adminOrSuper"))

adminGiftBoxesRouter.get(
  "/",
  rbacMiddleware("products.view"),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).list() })
  }),
)
adminGiftBoxesRouter.get(
  "/:id",
  rbacMiddleware("products.view"),
  validate({ params: IdParam }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).get(BigInt((req.params as { id: string }).id)) })
  }),
)
adminGiftBoxesRouter.post(
  "/",
  rbacMiddleware("products.create"),
  validate({ body: GiftBoxDto }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { status: 201, data: await svc(req).create(req.body as GiftBoxInput), message: "Gift box created" })
  }),
)
adminGiftBoxesRouter.patch(
  "/:id",
  rbacMiddleware("products.edit"),
  validate({ params: IdParam, body: GiftBoxDto }),
  ctrl(async (req: Req, res: Response) => {
    const id = BigInt((req.params as { id: string }).id)
    envelope(res, { data: await svc(req).update(id, req.body as GiftBoxInput), message: "Gift box saved" })
  }),
)
adminGiftBoxesRouter.delete(
  "/:id",
  rbacMiddleware("products.delete"),
  validate({ params: IdParam }),
  ctrl(async (req: Req, res: Response) => {
    await svc(req).remove(BigInt((req.params as { id: string }).id))
    envelope(res, { data: null, message: "Gift box deleted" })
  }),
)

export const storefrontGiftBoxesRouter = Router()

storefrontGiftBoxesRouter.get(
  "/",
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).shopList() })
  }),
)
storefrontGiftBoxesRouter.get(
  "/:slug",
  validate({ params: SlugParam }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).shopOne((req.params as { slug: string }).slug) })
  }),
)
