/**
 * PROMOTION ROUTES
 *   GET|POST /api/admin/marketing/promotions           ?state=live|scheduled|ended|paused&type=&search=
 *   GET|PATCH|DELETE /api/admin/marketing/promotions/:id
 *   POST /api/admin/marketing/promotions/:id/end       stop it now
 *   GET  /api/admin/marketing/promotions/pick/products?search=|ids=   and /pick/products/:id/variants
 *   GET  /api/admin/marketing/promotions/pick/categories     (the form's own pickers)
 *   GET  /api/storefront/promotions                     ?slot=&productId=&categoryId= (live only)
 */
import { Router, type Request, type Response } from "express"
import { ctrl, envelope, type RequestContext } from "../../core"
import { authMiddleware, rbacMiddleware, validate } from "../../middleware"
import { PromotionsService } from "./promotions.service"
import { ManualOrderService } from "../orders/manual-order"
import {
  CreatePromotionDto,
  PickProductsQuery,
  PromotionIdParam,
  PromotionListQuery,
  SlotQuery,
  UpdatePromotionDto,
} from "./promotions.dto"

type Req = Request & { ctx: RequestContext }
const svc = (req: Req) => new PromotionsService(req.ctx)
const id = (req: Req) => BigInt((req.params as { id: string }).id)

export const adminPromotionsRouter = Router()
adminPromotionsRouter.use(authMiddleware("adminOrSuper"))

adminPromotionsRouter.get(
  "/",
  rbacMiddleware("promotions.view"),
  validate({ query: PromotionListQuery }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).list(req.query as unknown as PromotionListQuery) })
  }),
)
adminPromotionsRouter.post(
  "/",
  rbacMiddleware("promotions.create"),
  validate({ body: CreatePromotionDto }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, {
      status: 201,
      data: await svc(req).create(req.body as CreatePromotionDto),
      message: "Promotion created",
    })
  }),
)
// Pickers for the form: marketing staff don't need catalog or order permissions to use them.
adminPromotionsRouter.get(
  "/pick/products",
  rbacMiddleware("promotions.view"),
  validate({ query: PickProductsQuery }),
  ctrl(async (req: Req, res: Response) => {
    const q = req.query as unknown as PickProductsQuery
    envelope(res, {
      data: q.ids
        ? await svc(req).productsByIds(q.ids)
        : await new ManualOrderService(req.ctx).pickProducts(q.search ?? ""),
    })
  }),
)
adminPromotionsRouter.get(
  "/pick/products/:id/variants",
  rbacMiddleware("promotions.view"),
  validate({ params: PromotionIdParam }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await new ManualOrderService(req.ctx).pickVariants(id(req)) })
  }),
)
adminPromotionsRouter.get(
  "/pick/categories",
  rbacMiddleware("promotions.view"),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).categories() })
  }),
)
adminPromotionsRouter.get(
  "/:id",
  rbacMiddleware("promotions.view"),
  validate({ params: PromotionIdParam }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).get(id(req)) })
  }),
)
adminPromotionsRouter.patch(
  "/:id",
  rbacMiddleware("promotions.edit"),
  validate({ params: PromotionIdParam, body: UpdatePromotionDto }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, {
      data: await svc(req).update(id(req), req.body as UpdatePromotionDto),
      message: "Promotion saved",
    })
  }),
)
adminPromotionsRouter.post(
  "/:id/end",
  rbacMiddleware("promotions.edit"),
  validate({ params: PromotionIdParam }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).end(id(req)), message: "Promotion ended" })
  }),
)
adminPromotionsRouter.delete(
  "/:id",
  rbacMiddleware("promotions.delete"),
  validate({ params: PromotionIdParam }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).remove(id(req)), message: "Promotion deleted" })
  }),
)

export const storefrontPromotionsRouter = Router()
storefrontPromotionsRouter.get(
  "/",
  validate({ query: SlotQuery }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).forSlot(req.query as unknown as SlotQuery) })
  }),
)
