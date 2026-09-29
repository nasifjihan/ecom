/**
 * LANDING PAGE ROUTES
 * Admin (/api/admin/landing-pages; pages.view / .create / .edit / .delete):
 *   GET /, GET /:id, POST /, PATCH /:id, DELETE /:id
 * Storefront (/api/storefront/landing/:slug; ?preview= opens a draft):
 *   GET /                 the page, with the product at the page's price
 *   POST /view            count a visit
 *   POST /quote           price, delivery options and total for the order form
 *   POST /order           place the order (cash on delivery)
 */
import { Router, type Request, type Response } from "express"
import { z } from "zod"
import { ctrl, envelope, type RequestContext } from "../../core"
import { authMiddleware, rbacMiddleware, validate } from "../../middleware"
import { LandingService, type LandingInput, type LandingOrderInput } from "./landing.service"

type Req = Request & { ctx: RequestContext }
const svc = (req: Req) => new LandingService(req.ctx)
const IdParam = z.object({ id: z.coerce.bigint().positive() })
const SlugParam = z.object({ slug: z.string().trim().min(1).max(120) })
const PreviewQuery = z.object({ preview: z.string().max(64).optional() })

const LandingDto = z.object({
  slug: z.string().trim().min(1).max(120),
  title: z.string().trim().min(1).max(200),
  status: z.enum(["draft", "published"]),
  productId: z.coerce.bigint().positive(),
  headline: z.string().trim().min(1).max(200),
  subheadline: z.string().trim().max(500).nullable().optional(),
  heroImageUrl: z.string().trim().max(1000).nullable().optional(),
  offerPrice: z.number().positive().max(10_000_000).nullable().optional(),
  offerEndsAt: z.string().datetime({ offset: true }).nullable().optional(),
  sections: z.array(z.unknown()).max(20).optional(),
  showReviews: z.boolean().optional(),
  ctaText: z.string().trim().max(60).optional(),
  formTitle: z.string().trim().max(120).nullable().optional(),
  maxQty: z.number().int().min(1).max(100).optional(),
  seoTitle: z.string().trim().max(200).nullable().optional(),
  metaDesc: z.string().trim().max(500).nullable().optional(),
})

const AddressDto = z.object({
  locationId: z.coerce.bigint().positive().nullable().optional(),
  division: z.string().trim().max(100).optional(),
  district: z.string().trim().min(1).max(100),
  upazila: z.string().trim().max(100).optional(),
  addressLine1: z.string().trim().max(300),
})
const QuoteDto = z.object({
  variantId: z.coerce.bigint().positive().nullable().optional(),
  qty: z.number().int().min(1).max(100),
  address: AddressDto,
  shippingMethodId: z.coerce.bigint().positive().optional(),
})
const OrderDto = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(1).max(30),
  email: z.string().trim().email().max(200).nullable().optional(),
  address: AddressDto.extend({ addressLine1: z.string().trim().min(3).max(300) }),
  variantId: z.coerce.bigint().positive().nullable().optional(),
  qty: z.number().int().min(1).max(100),
  shippingMethodId: z.coerce.bigint().positive(),
  note: z.string().trim().max(500).nullable().optional(),
  salesCode: z.string().trim().max(40).nullable().optional(),
})

export const adminLandingRouter = Router()
adminLandingRouter.use(authMiddleware("adminOrSuper"))

adminLandingRouter.get(
  "/",
  rbacMiddleware("pages.view"),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).list() })
  }),
)
adminLandingRouter.get(
  "/:id",
  rbacMiddleware("pages.view"),
  validate({ params: IdParam }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).get(BigInt((req.params as { id: string }).id)) })
  }),
)
adminLandingRouter.post(
  "/",
  rbacMiddleware("pages.create"),
  validate({ body: LandingDto }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { status: 201, data: await svc(req).create(req.body as LandingInput), message: "Landing page created" })
  }),
)
adminLandingRouter.patch(
  "/:id",
  rbacMiddleware("pages.edit"),
  validate({ params: IdParam, body: LandingDto }),
  ctrl(async (req: Req, res: Response) => {
    const id = BigInt((req.params as { id: string }).id)
    envelope(res, { data: await svc(req).update(id, req.body as LandingInput), message: "Landing page saved" })
  }),
)
adminLandingRouter.delete(
  "/:id",
  rbacMiddleware("pages.delete"),
  validate({ params: IdParam }),
  ctrl(async (req: Req, res: Response) => {
    await svc(req).remove(BigInt((req.params as { id: string }).id))
    envelope(res, { data: null, message: "Landing page deleted" })
  }),
)

export const storefrontLandingRouter = Router()
storefrontLandingRouter.use(authMiddleware("optional"))

const slugOf = (req: Req) => (req.params as { slug: string }).slug
const previewOf = (req: Req) => (req.query as { preview?: string }).preview ?? null

storefrontLandingRouter.get(
  "/:slug",
  validate({ params: SlugParam, query: PreviewQuery }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).page(slugOf(req), previewOf(req)) })
  }),
)
storefrontLandingRouter.post(
  "/:slug/view",
  validate({ params: SlugParam }),
  ctrl(async (req: Req, res: Response) => {
    await svc(req).view(slugOf(req))
    envelope(res, { data: null })
  }),
)
storefrontLandingRouter.post(
  "/:slug/quote",
  validate({ params: SlugParam, query: PreviewQuery, body: QuoteDto }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).quote(slugOf(req), req.body as z.infer<typeof QuoteDto>, previewOf(req)) })
  }),
)
storefrontLandingRouter.post(
  "/:slug/order",
  validate({ params: SlugParam, query: PreviewQuery, body: OrderDto }),
  ctrl(async (req: Req, res: Response) => {
    const r = await svc(req).order(slugOf(req), req.body as LandingOrderInput, previewOf(req))
    envelope(res, { status: 201, data: r, message: "Order placed" })
  }),
)
