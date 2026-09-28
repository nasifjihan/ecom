/**
 * LOYALTY ROUTES
 * Admin (/api/admin/loyalty, loyalty.view / loyalty.edit):
 *   GET /                                   settings, levels, totals
 *   PATCH /settings                         wallet, cashback, levels on/off, referral rewards
 *   POST /levels, PATCH|DELETE /levels/:id  loyalty levels (customers' levels follow)
 *   GET /referrals                          who referred whom, and the rewards
 *   GET /customers/:id, POST /customers/:id/wallet   a customer's wallet and level; add / take money
 * Storefront (/api/storefront/account, signed-in customer):
 *   GET /loyalty                            wallet, cashback, level, referral summary
 *   GET /referral                           my referral code (made on first ask) and friends
 *   POST /referral/claim                    use a friend's code
 */
import { Router, type Request, type Response } from "express"
import type { z } from "zod"
import { UnauthorizedError, ctrl, envelope, type RequestContext } from "../../core"
import { authMiddleware, rbacMiddleware, validate } from "../../middleware"
import { LoyaltyService } from "./loyalty.service"
import {
  ClaimDto,
  IdParam,
  LevelDto,
  ReferralsQuery,
  SettingsDto,
  WalletAdjustDto,
} from "./loyalty.dto"

type Req = Request & { ctx: RequestContext }
const svc = (req: Req) => new LoyaltyService(req.ctx)
const id = (req: Req) => BigInt((req.params as { id: string }).id)
const body = <S extends z.ZodTypeAny>(req: Req) => req.body as z.infer<S>
const query = <S extends z.ZodTypeAny>(req: Req) => req.query as unknown as z.infer<S>
const me = (req: Req) => {
  if (!req.ctx.customer) throw new UnauthorizedError("Please sign in")
  return req.ctx.customer.id
}

export const adminLoyaltyRouter = Router()
adminLoyaltyRouter.use(authMiddleware("adminOrSuper"))

adminLoyaltyRouter.get(
  "/",
  rbacMiddleware("loyalty.view"),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).overview() })
  }),
)
adminLoyaltyRouter.patch(
  "/settings",
  rbacMiddleware("loyalty.edit"),
  validate({ body: SettingsDto }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, {
      data: await svc(req).updateSettings(body<typeof SettingsDto>(req)),
      message: "Saved",
    })
  }),
)
adminLoyaltyRouter.post(
  "/levels",
  rbacMiddleware("loyalty.edit"),
  validate({ body: LevelDto }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, {
      status: 201,
      data: await svc(req).saveLevel(null, body<typeof LevelDto>(req)),
      message: "Level added",
    })
  }),
)
adminLoyaltyRouter.patch(
  "/levels/:id",
  rbacMiddleware("loyalty.edit"),
  validate({ params: IdParam, body: LevelDto }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, {
      data: await svc(req).saveLevel(id(req), body<typeof LevelDto>(req)),
      message: "Level saved",
    })
  }),
)
adminLoyaltyRouter.delete(
  "/levels/:id",
  rbacMiddleware("loyalty.edit"),
  validate({ params: IdParam }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).deleteLevel(id(req)), message: "Level deleted" })
  }),
)
adminLoyaltyRouter.get(
  "/referrals",
  rbacMiddleware("loyalty.view"),
  validate({ query: ReferralsQuery }),
  ctrl(async (req: Req, res: Response) => {
    const r = await svc(req).referrals(query<typeof ReferralsQuery>(req))
    envelope(res, { data: r.items, meta: r.meta })
  }),
)
adminLoyaltyRouter.get(
  "/customers/:id",
  rbacMiddleware("customers.view"),
  validate({ params: IdParam }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).customerLoyalty(id(req)) })
  }),
)
adminLoyaltyRouter.post(
  "/customers/:id/wallet",
  rbacMiddleware("loyalty.edit"),
  validate({ params: IdParam, body: WalletAdjustDto }),
  ctrl(async (req: Req, res: Response) => {
    const b = body<typeof WalletAdjustDto>(req)
    envelope(res, {
      data: await svc(req).adjustWallet(id(req), b.amount, b.note),
      message: "Wallet updated",
    })
  }),
)

export const storefrontLoyaltyRouter = Router()
storefrontLoyaltyRouter.use("/loyalty", authMiddleware("customer"))
storefrontLoyaltyRouter.use("/referral", authMiddleware("customer"))

storefrontLoyaltyRouter.get(
  "/loyalty",
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).forCustomer(me(req)) })
  }),
)
storefrontLoyaltyRouter.get(
  "/referral",
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).myReferral(me(req)) })
  }),
)
storefrontLoyaltyRouter.post(
  "/referral/claim",
  validate({ body: ClaimDto }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, {
      data: await svc(req).claimReferral(me(req), body<typeof ClaimDto>(req).code),
      message: "Referral added",
    })
  }),
)
