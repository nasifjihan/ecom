/**
 * Orders > Confirm calls (mounted at /api/admin/order-checks): fraud check and COD call settings,
 * the list of orders to call, call outcomes, the COD block list and "check a number".
 */
import { Router, type Request, type Response } from "express"
import { z } from "zod"
import { prisma } from "../../config"
import { BadRequestError, ctrl, envelope, type RequestContext } from "../../core"
import { authMiddleware, rbacMiddleware, validate } from "../../middleware"
import { OrderChecks, orderCheckSettings, phoneCheck } from "./order-checks"
import { CALL_OUTCOMES } from "./order-checks.rules"

type Req = Request & { ctx: RequestContext }
const storeOf = (r: Req) => {
  if (r.ctx.storeId === undefined) throw new BadRequestError("No store for this request", "STORE_REQUIRED")
  return BigInt(r.ctx.storeId)
}
const idOf = (r: Req) => BigInt((r.params as { id: string }).id)
const Id = z.object({ id: z.coerce.bigint().positive() })
const Paging = { page: z.coerce.number().int().min(1).default(1), perPage: z.coerce.number().int().min(1).max(100).default(25) }

export const SettingsDto = z
  .object({
    riskWatchBelow: z.coerce.number().int().min(1).max(100),
    riskHighBelow: z.coerce.number().int().min(1).max(100),
    riskMinParcels: z.coerce.number().int().min(1).max(50),
    holdHighRisk: z.boolean(),
    callRetryHours: z.coerce.number().int().min(1).max(48),
    callMaxTries: z.coerce.number().int().min(1).max(10),
    customerExchanges: z.boolean(),
    exchangeFee: z.coerce.number().min(0).max(10000),
  })
  .refine((v) => v.riskHighBelow <= v.riskWatchBelow, { message: "High risk must be at or below the watch level", path: ["riskHighBelow"] })

const CallDto = z.object({
  outcome: z.enum(CALL_OUTCOMES),
  note: z.string().trim().max(500).optional(),
  /** On "fake": also put the number on the COD block list. */
  block: z.boolean().optional(),
})
const BlockDto = z.object({ phone: z.string().trim().min(10).max(20), reason: z.string().trim().max(200).default("") })

export const adminOrderChecksRouter = Router()
adminOrderChecksRouter.use(authMiddleware("adminOrSuper"))

adminOrderChecksRouter.get(
  "/settings",
  rbacMiddleware("orders.view"),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await orderCheckSettings(storeOf(req)) })
  }),
)
adminOrderChecksRouter.put(
  "/settings",
  rbacMiddleware("orders.edit"),
  validate({ body: SettingsDto }),
  ctrl(async (req: Req, res: Response) => {
    const storeId = storeOf(req)
    const dto = req.body as z.infer<typeof SettingsDto>
    await prisma.orderCheckSettings.upsert({ where: { storeId }, create: { storeId, ...dto }, update: dto })
    envelope(res, { data: await orderCheckSettings(storeId), message: "Order checks saved" })
  }),
)

adminOrderChecksRouter.get(
  "/calls",
  rbacMiddleware("orders.view"),
  validate({ query: z.object({ tab: z.enum(["due", "later", "stuck"]).default("due"), ...Paging }) }),
  ctrl(async (req: Req, res: Response) => {
    const q = req.query as unknown as { tab: "due" | "later" | "stuck"; page: number; perPage: number }
    envelope(res, { data: await new OrderChecks(req.ctx).callList(q.tab, q.page, q.perPage) })
  }),
)

adminOrderChecksRouter.get(
  "/orders/:id",
  rbacMiddleware("orders.view"),
  validate({ params: Id }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await new OrderChecks(req.ctx).forOrder(idOf(req)) })
  }),
)
adminOrderChecksRouter.post(
  "/orders/:id/calls",
  rbacMiddleware("orders.edit"),
  validate({ params: Id, body: CallDto }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await new OrderChecks(req.ctx).logCall(idOf(req), req.body as z.infer<typeof CallDto>), message: "Call saved" })
  }),
)

adminOrderChecksRouter.get(
  "/phone",
  rbacMiddleware("orders.view"),
  validate({ query: z.object({ phone: z.string().trim().min(10).max(20) }) }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await phoneCheck(storeOf(req), (req.query as { phone: string }).phone) })
  }),
)

adminOrderChecksRouter.get(
  "/blocks",
  rbacMiddleware("orders.view"),
  validate({ query: z.object({ search: z.string().max(20).optional(), ...Paging }) }),
  ctrl(async (req: Req, res: Response) => {
    const q = req.query as unknown as { search?: string; page: number; perPage: number }
    envelope(res, { data: await new OrderChecks(req.ctx).blocks(q.search, q.page, q.perPage) })
  }),
)
adminOrderChecksRouter.post(
  "/blocks",
  rbacMiddleware("orders.edit"),
  validate({ body: BlockDto }),
  ctrl(async (req: Req, res: Response) => {
    const dto = req.body as z.infer<typeof BlockDto>
    envelope(res, { status: 201, data: await new OrderChecks(req.ctx).block(dto.phone, dto.reason), message: "Number blocked for cash on delivery" })
  }),
)
adminOrderChecksRouter.delete(
  "/blocks/:id",
  rbacMiddleware("orders.edit"),
  validate({ params: Id }),
  ctrl(async (req: Req, res: Response) => {
    await new OrderChecks(req.ctx).unblock(idOf(req))
    envelope(res, { data: { success: true }, message: "Number unblocked" })
  }),
)
