/**
 * STOREFRONT ROUTES (/api/admin/storefronts)
 *   GET|POST /, PATCH|DELETE /:id, POST /:id/default      storefronts (online_store.view / .edit)
 *   GET /options                                          names for filters and pickers (any staff)
 *   POST /:id/domains, PATCH /domains/:domainId           add a web address / move one to a storefront
 *   POST /:id/products                                    add products to / take them off a storefront
 *   GET|PUT /products/:productId                          where a product is sold and its prices there
 */
import { Router, type Request, type Response } from "express"
import type { z } from "zod"
import { ctrl, envelope, type RequestContext } from "../../core"
import { authMiddleware, rbacMiddleware, validate } from "../../middleware"
import { StorefrontsService } from "./storefronts.service"
import {
  AddDomainDto,
  DomainIdParam,
  IdParam,
  MoveDomainDto,
  ProductIdParam,
  ProductStorefrontsDto,
  StorefrontDto,
  StorefrontProductsDto,
  UpdateStorefrontDto,
} from "./storefronts.dto"

type Req = Request & { ctx: RequestContext }
const svc = (req: Req) => new StorefrontsService(req.ctx)
const param = (req: Req, k: string) => BigInt((req.params as Record<string, string>)[k] ?? "0")
const body = <S extends z.ZodTypeAny>(req: Req) => req.body as z.infer<S>

export const adminStorefrontsRouter = Router()
adminStorefrontsRouter.use(authMiddleware("adminOrSuper"))

adminStorefrontsRouter.get(
  "/",
  rbacMiddleware("online_store.view"),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).list() })
  }),
)
adminStorefrontsRouter.post(
  "/",
  rbacMiddleware("online_store.edit"),
  validate({ body: StorefrontDto }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { status: 201, data: await svc(req).create(body<typeof StorefrontDto>(req)), message: "Storefront added" })
  }),
)

adminStorefrontsRouter.get(
  "/options",
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).options() })
  }),
)

// ---- products (before /:id)
adminStorefrontsRouter.get(
  "/products/:productId",
  rbacMiddleware("products.view"),
  validate({ params: ProductIdParam }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).productStorefronts(param(req, "productId")) })
  }),
)
adminStorefrontsRouter.put(
  "/products/:productId",
  rbacMiddleware("products.edit"),
  validate({ params: ProductIdParam, body: ProductStorefrontsDto }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, {
      data: await svc(req).saveProductStorefronts(param(req, "productId"), body<typeof ProductStorefrontsDto>(req)),
      message: "Storefronts saved",
    })
  }),
)
adminStorefrontsRouter.patch(
  "/domains/:domainId",
  rbacMiddleware("online_store.edit"),
  validate({ params: DomainIdParam, body: MoveDomainDto }),
  ctrl(async (req: Req, res: Response) => {
    const { storefrontId } = body<typeof MoveDomainDto>(req)
    envelope(res, { data: await svc(req).moveDomain(param(req, "domainId"), storefrontId), message: "Web address moved" })
  }),
)

adminStorefrontsRouter.patch(
  "/:id",
  rbacMiddleware("online_store.edit"),
  validate({ params: IdParam, body: UpdateStorefrontDto }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).update(param(req, "id"), body<typeof UpdateStorefrontDto>(req)), message: "Storefront saved" })
  }),
)
adminStorefrontsRouter.delete(
  "/:id",
  rbacMiddleware("online_store.edit"),
  validate({ params: IdParam }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).remove(param(req, "id")), message: "Storefront deleted" })
  }),
)
adminStorefrontsRouter.post(
  "/:id/default",
  rbacMiddleware("online_store.edit"),
  validate({ params: IdParam }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).makeDefault(param(req, "id")), message: "Default storefront changed" })
  }),
)
adminStorefrontsRouter.post(
  "/:id/domains",
  rbacMiddleware("online_store.edit"),
  validate({ params: IdParam, body: AddDomainDto }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { status: 201, data: await svc(req).addDomain(param(req, "id"), body<typeof AddDomainDto>(req).hostname), message: "Web address added" })
  }),
)
adminStorefrontsRouter.post(
  "/:id/products",
  rbacMiddleware("products.edit"),
  validate({ params: IdParam, body: StorefrontProductsDto }),
  ctrl(async (req: Req, res: Response) => {
    const d = body<typeof StorefrontProductsDto>(req)
    envelope(res, { data: await svc(req).setProducts(param(req, "id"), d.productIds, d.listed) })
  }),
)
