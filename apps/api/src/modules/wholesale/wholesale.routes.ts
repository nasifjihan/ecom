/**
 * WHOLESALE ROUTES
 * Admin (/api/admin/wholesale):
 *   GET|PATCH /settings                       on/off, auto-approve, intro text (customers.view / .edit)
 *   GET|POST /accounts, GET|PATCH|DELETE /accounts/:id   business accounts (customers.view / .edit)
 *   POST /accounts/:id/review                 approve / reject / suspend
 *   GET /customers/:id                        a customer's business account, if any
 *   GET|PUT /products/:productId/tiers        a product's bulk prices (products.view / .edit)
 *   GET /margins, POST /margins/apply         pricing by margin (products.view / .edit)
 * Storefront (/api/storefront/wholesale):
 *   GET /                                     does the shop sell to businesses; my account
 *   POST /apply                               apply for a business account (signed in)
 *   GET /tiers/:productId                     the bulk prices this shopper gets on a product
 */
import { Router, type Request, type Response } from "express"
import type { z } from "zod"
import { UnauthorizedError, ctrl, envelope, type RequestContext } from "../../core"
import { authMiddleware, rbacMiddleware, validate } from "../../middleware"
import { WholesaleService } from "./wholesale.service"
import { isBusinessBuyer } from "./wholesale.context"
import {
  AccountsQuery,
  ApplyDto,
  ApplyPricesDto,
  CreateAccountDto,
  IdParam,
  MarginsQuery,
  ProductIdParam,
  ReviewDto,
  SettingsDto,
  TiersDto,
  UpdateAccountDto,
} from "./wholesale.dto"

type Req = Request & { ctx: RequestContext }
const svc = (req: Req) => new WholesaleService(req.ctx)
const id = (req: Req) => BigInt((req.params as { id: string }).id)
const productId = (req: Req) => BigInt((req.params as { productId: string }).productId)
const body = <S extends z.ZodTypeAny>(req: Req) => req.body as z.infer<S>
const query = <S extends z.ZodTypeAny>(req: Req) => req.query as unknown as z.infer<S>

export const adminWholesaleRouter = Router()
adminWholesaleRouter.use(authMiddleware("adminOrSuper"))

adminWholesaleRouter.get(
  "/settings",
  rbacMiddleware("customers.view"),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).settings() })
  }),
)
adminWholesaleRouter.patch(
  "/settings",
  rbacMiddleware("customers.edit"),
  validate({ body: SettingsDto }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).updateSettings(body<typeof SettingsDto>(req)), message: "Saved" })
  }),
)

adminWholesaleRouter.get(
  "/accounts",
  rbacMiddleware("customers.view"),
  validate({ query: AccountsQuery }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).listAccounts(query<typeof AccountsQuery>(req)) })
  }),
)
adminWholesaleRouter.post(
  "/accounts",
  rbacMiddleware("customers.edit"),
  validate({ body: CreateAccountDto }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, {
      status: 201,
      data: await svc(req).createAccount(body<typeof CreateAccountDto>(req)),
      message: "Business account added",
    })
  }),
)
adminWholesaleRouter.get(
  "/accounts/:id",
  rbacMiddleware("customers.view"),
  validate({ params: IdParam }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).getAccount(id(req)) })
  }),
)
adminWholesaleRouter.patch(
  "/accounts/:id",
  rbacMiddleware("customers.edit"),
  validate({ params: IdParam, body: UpdateAccountDto }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).updateAccount(id(req), body<typeof UpdateAccountDto>(req)), message: "Saved" })
  }),
)
adminWholesaleRouter.post(
  "/accounts/:id/review",
  rbacMiddleware("customers.edit"),
  validate({ params: IdParam, body: ReviewDto }),
  ctrl(async (req: Req, res: Response) => {
    const dto = body<typeof ReviewDto>(req)
    const done = { approve: "Approved", reject: "Rejected", suspend: "Suspended" }[dto.action]
    envelope(res, { data: await svc(req).review(id(req), dto.action, dto.note), message: done })
  }),
)
adminWholesaleRouter.delete(
  "/accounts/:id",
  rbacMiddleware("customers.edit"),
  validate({ params: IdParam }),
  ctrl(async (req: Req, res: Response) => {
    await svc(req).removeAccount(id(req))
    envelope(res, { data: null, message: "Business account removed" })
  }),
)
adminWholesaleRouter.get(
  "/customers/:id",
  rbacMiddleware("customers.view"),
  validate({ params: IdParam }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).accountOfCustomer(id(req)) })
  }),
)

adminWholesaleRouter.get(
  "/products/:productId/tiers",
  rbacMiddleware("products.view"),
  validate({ params: ProductIdParam }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).productTiers(productId(req)) })
  }),
)
adminWholesaleRouter.put(
  "/products/:productId/tiers",
  rbacMiddleware("products.edit"),
  validate({ params: ProductIdParam, body: TiersDto }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).saveProductTiers(productId(req), body<typeof TiersDto>(req)), message: "Bulk prices saved" })
  }),
)

adminWholesaleRouter.get(
  "/margins",
  rbacMiddleware("products.view"),
  validate({ query: MarginsQuery }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).margins(query<typeof MarginsQuery>(req)) })
  }),
)
adminWholesaleRouter.post(
  "/margins/apply",
  rbacMiddleware("products.edit"),
  validate({ body: ApplyPricesDto }),
  ctrl(async (req: Req, res: Response) => {
    const r = await svc(req).applyPrices(body<typeof ApplyPricesDto>(req))
    envelope(res, { data: r, message: `${r.updated} price${r.updated === 1 ? "" : "s"} updated` })
  }),
)

// ---------------------------------------------------------------- storefront

export const storefrontWholesaleRouter = Router()

storefrontWholesaleRouter.get(
  "/",
  authMiddleware("optional"),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).myStatus(req.ctx.customer?.id) })
  }),
)
storefrontWholesaleRouter.post(
  "/apply",
  authMiddleware("customer"),
  validate({ body: ApplyDto }),
  ctrl(async (req: Req, res: Response) => {
    if (!req.ctx.customer) throw new UnauthorizedError("Please sign in")
    const account = await svc(req).apply(req.ctx.customer.id, body<typeof ApplyDto>(req))
    envelope(res, {
      status: 201,
      data: account,
      message: account.status === "APPROVED" ? "Your business account is ready" : "Application sent",
    })
  }),
)
storefrontWholesaleRouter.get(
  "/tiers/:productId",
  authMiddleware("optional"),
  validate({ params: ProductIdParam }),
  ctrl(async (req: Req, res: Response) => {
    const business = await isBusinessBuyer(req.ctx.storeId ?? 0n, req.ctx.customer?.id)
    envelope(res, { data: await svc(req).storefrontTiers(productId(req), business) })
  }),
)
