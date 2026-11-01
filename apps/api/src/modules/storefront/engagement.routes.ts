/**
 * STOREFRONT EXTRAS ROUTES (store from the request Origin)
 *   GET  /api/storefront/search/suggest?q=         products, categories and popular terms as you type
 *   GET  /api/storefront/search/popular
 *   GET  /api/storefront/track?number=&phone=      public order tracking (strict rate limit)
 *   GET  /api/storefront/flash-sales                running sales with their products
 *   POST /api/storefront/products/:id/questions     { name?, question }  (anyone)
 *   POST /api/storefront/products/:id/reviews       { rating, title?, body? }  (signed-in customer)
 *   GET  /api/storefront/products/:id/my-review
 *   GET|POST /api/storefront/account/wishlist, GET /wishlist/ids, DELETE /wishlist/:productId
 */
import { Router, type NextFunction, type Request, type Response } from "express"
import multer from "multer"
import { z } from "zod"
import { BadRequestError, TooLargeError, ctrl, envelope, type RequestContext } from "../../core"
import { authMiddleware, validate } from "../../middleware"
import { StorefrontEngagement } from "./engagement"
import { MAX_REVIEW_PHOTOS, MAX_REVIEW_PHOTO_BYTES, uploadReviewPhoto } from "./review-photos"
import { requestStockAlert } from "../stock/back-in-stock"

type Req = Request & { ctx: RequestContext }
const svc = (req: Req) => new StorefrontEngagement(req.ctx)
const id = (req: Req) => BigInt((req.params as { id: string }).id)

const noXss = (v: string) => !/<\s*script|<\s*iframe|on(error|load|click|mouseover)\s*=/i.test(v)
const IdParam = z.object({ id: z.coerce.bigint().positive() })
const SuggestQuery = z.object({ q: z.string().trim().max(80).default("") })
const TrackQuery = z.object({
  number: z.string().trim().min(4).max(40),
  phone: z.string().trim().min(10).max(20),
})
const QuestionDto = z.object({
  name: z.string().trim().max(60).refine(noXss, "No HTML please").optional(),
  question: z
    .string()
    .trim()
    .min(5, "Please write your question")
    .max(500)
    .refine(noXss, "No HTML please"),
})
const ReviewDto = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().trim().max(120).refine(noXss, "No HTML please").optional(),
  body: z.string().trim().max(2000).refine(noXss, "No HTML please").optional(),
  /** Keys from POST /reviews/photos. */
  photos: z.array(z.string().max(200)).max(MAX_REVIEW_PHOTOS).default([]),
})
const WishlistDto = z.object({ productIds: z.array(z.coerce.bigint().positive()).min(1).max(100) })
const ProductParam = z.object({ productId: z.coerce.bigint().positive() })

export const storefrontEngagementRouter = Router()

storefrontEngagementRouter.get(
  "/search/suggest",
  validate({ query: SuggestQuery }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).suggest((req.query as { q: string }).q) })
  }),
)
storefrontEngagementRouter.get(
  "/search/popular",
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).popularSearches() })
  }),
)
storefrontEngagementRouter.get(
  "/track",
  validate({ query: TrackQuery }),
  ctrl(async (req: Req, res: Response) => {
    const q = req.query as unknown as z.infer<typeof TrackQuery>
    envelope(res, { data: await svc(req).track(q.number, q.phone) })
  }),
)
storefrontEngagementRouter.get(
  "/flash-sales",
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).flashSales() })
  }),
)
storefrontEngagementRouter.post(
  "/products/:id/questions",
  authMiddleware("optional"),
  validate({ params: IdParam, body: QuestionDto }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, {
      status: 201,
      data: await svc(req).askQuestion(id(req), req.body as z.infer<typeof QuestionDto>),
      message: "Thanks! We'll answer soon.",
    })
  }),
)
// One photo for a review (multipart "file"); the review then sends the returned key.
const uploadPhoto = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_REVIEW_PHOTO_BYTES, files: 1 } }).single("file")
storefrontEngagementRouter.post(
  "/reviews/photos",
  authMiddleware("customer"),
  (req: Request, res: Response, next: NextFunction) =>
    uploadPhoto(req as never, res as never, (err: unknown) =>
      next(err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE" ? new TooLargeError("Photos must be 5 MB or smaller") : err),
    ),
  ctrl(async (req: Req, res: Response) => {
    const file = (req as Req & { file?: { buffer: Buffer; mimetype: string } }).file
    if (!file) throw new BadRequestError("Choose a photo", "VALIDATION_FAILED")
    envelope(res, { status: 201, data: await uploadReviewPhoto(BigInt(req.ctx.storeId!), req.ctx.customer!.id, { buffer: file.buffer, mimeType: file.mimetype }) })
  }),
)
storefrontEngagementRouter.post(
  "/products/:id/reviews",
  authMiddleware("customer"),
  validate({ params: IdParam, body: ReviewDto }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, {
      status: 201,
      data: await svc(req).submitReview(id(req), req.body as z.infer<typeof ReviewDto>),
    })
  }),
)
storefrontEngagementRouter.get(
  "/products/:id/my-review",
  authMiddleware("customer"),
  validate({ params: IdParam }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).myReview(id(req)) })
  }),
)

export const storefrontWishlistRouter = Router()
storefrontWishlistRouter.use(authMiddleware("customer"))
storefrontWishlistRouter.get(
  "/wishlist",
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).wishlist() })
  }),
)
storefrontWishlistRouter.get(
  "/wishlist/ids",
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).wishlistIds() })
  }),
)
storefrontWishlistRouter.post(
  "/wishlist",
  validate({ body: WishlistDto }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, {
      data: await svc(req).addToWishlist((req.body as z.infer<typeof WishlistDto>).productIds),
    })
  }),
)
storefrontWishlistRouter.delete(
  "/wishlist/:productId",
  validate({ params: ProductParam }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, {
      data: await svc(req).removeFromWishlist(
        BigInt((req.params as { productId: string }).productId),
      ),
    })
  }),
)

// "Notify me when it's back" on a sold-out product or option (signed in or not).
storefrontEngagementRouter.post(
  "/products/:id/stock-alerts",
  authMiddleware("optional"),
  validate({
    params: IdParam,
    body: z.object({ variantId: z.coerce.bigint().positive().optional().nullable(), contact: z.string().trim().min(5).max(254) }),
  }),
  ctrl(async (req: Req, res: Response) => {
    const body = req.body as { variantId?: bigint | null; contact: string }
    const data = await requestStockAlert(BigInt(req.ctx.storeId!), {
      productId: id(req),
      variantId: body.variantId ?? null,
      contact: body.contact,
      customerId: req.ctx.customer?.id ?? null,
    })
    envelope(res, { status: 201, data, message: "We'll tell you when it's back" })
  }),
)
