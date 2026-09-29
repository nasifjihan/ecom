/**
 * SALES TEAM ROUTES (/api/admin/sales)
 *   GET /team?month=YYYY-MM              salespeople with their month (commissions.view)
 *   PATCH /settings                      commission on/off, the store's default rate (commissions.edit)
 *   GET /commissions?month&salespersonId&state   commission by order (commissions.view)
 *   PATCH /salespeople/:id               on the sales team, extra %, share-link code (commissions.edit)
 *   PUT /salespeople/:id/target          a month's sales target (commissions.edit)
 *   POST /salespeople/:id/payout         mark what they earned up to a month's end as paid (commissions.edit)
 *   GET /salespeople                     names for the order form (any staff)
 *   GET|PUT /orders/:id                  an order's salesperson and commission (orders.view / commissions.edit)
 *   GET /me?month                        my commission (any staff on the sales team)
 */
import { Router, type Request, type Response } from "express"
import { z } from "zod"
import { ctrl, envelope, type RequestContext } from "../../core"
import { authMiddleware, rbacMiddleware, validate } from "../../middleware"
import { SalesService } from "./sales.service"
import { monthOf } from "./commission.rules"

type Req = Request & { ctx: RequestContext }
const svc = (req: Req) => new SalesService(req.ctx)
const id = (req: Req) => BigInt((req.params as { id: string }).id)
const IdParam = z.object({ id: z.coerce.bigint().positive() })
const Month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Pick a month")
const MonthQuery = z.object({ month: Month.optional() })
const month = (req: Req) => ((req.query as { month?: string }).month ?? monthOf(new Date()))

const SettingsDto = z.object({ enabled: z.boolean().optional(), defaultRate: z.coerce.number().min(0).max(100).optional() })
const CommissionsQuery = z.object({
  month: Month.optional(),
  salespersonId: z.coerce.bigint().positive().optional(),
  state: z.enum(["PENDING", "EARNED", "PAID", "CANCELLED"]).optional(),
})
const SalespersonDto = z.object({
  isSalesperson: z.boolean().optional(),
  extraPct: z.coerce.number().min(0).max(50).optional(),
  salesCode: z.string().trim().max(20).nullable().optional(),
})
const TargetDto = z.object({ month: Month, amount: z.coerce.number().min(0).max(1_000_000_000).nullable() })
const PayoutDto = z.object({ month: Month })
const CreditDto = z.object({ salespersonId: z.coerce.bigint().positive().nullable() })

export const adminSalesRouter = Router()
adminSalesRouter.use(authMiddleware("adminOrSuper"))

adminSalesRouter.get(
  "/team",
  rbacMiddleware("commissions.view"),
  validate({ query: MonthQuery }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).team(month(req)) })
  }),
)
adminSalesRouter.patch(
  "/settings",
  rbacMiddleware("commissions.edit"),
  validate({ body: SettingsDto }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).updateSettings(req.body as z.infer<typeof SettingsDto>), message: "Saved" })
  }),
)
adminSalesRouter.get(
  "/commissions",
  rbacMiddleware("commissions.view"),
  validate({ query: CommissionsQuery }),
  ctrl(async (req: Req, res: Response) => {
    const q = req.query as unknown as z.infer<typeof CommissionsQuery>
    envelope(res, { data: await svc(req).commissions({ month: q.month ?? monthOf(new Date()), salespersonId: q.salespersonId, state: q.state }) })
  }),
)
adminSalesRouter.get(
  "/salespeople",
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).salespeople() })
  }),
)
adminSalesRouter.patch(
  "/salespeople/:id",
  rbacMiddleware("commissions.edit"),
  validate({ params: IdParam, body: SalespersonDto }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).updateSalesperson(id(req), req.body as z.infer<typeof SalespersonDto>), message: "Saved" })
  }),
)
adminSalesRouter.put(
  "/salespeople/:id/target",
  rbacMiddleware("commissions.edit"),
  validate({ params: IdParam, body: TargetDto }),
  ctrl(async (req: Req, res: Response) => {
    const b = req.body as z.infer<typeof TargetDto>
    envelope(res, { data: await svc(req).setTarget(id(req), b.month, b.amount), message: b.amount ? "Target saved" : "Target removed" })
  }),
)
adminSalesRouter.post(
  "/salespeople/:id/payout",
  rbacMiddleware("commissions.edit"),
  validate({ params: IdParam, body: PayoutDto }),
  ctrl(async (req: Req, res: Response) => {
    const r = await svc(req).payout(id(req), (req.body as z.infer<typeof PayoutDto>).month)
    envelope(res, { data: r, message: `Paid out ${r.orders} order${r.orders === 1 ? "" : "s"}` })
  }),
)
adminSalesRouter.get(
  "/orders/:id",
  rbacMiddleware("orders.view"),
  validate({ params: IdParam }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).orderCommission(id(req)) })
  }),
)
adminSalesRouter.put(
  "/orders/:id",
  rbacMiddleware("commissions.edit"),
  validate({ params: IdParam, body: CreditDto }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).reassign(id(req), (req.body as z.infer<typeof CreditDto>).salespersonId), message: "Salesperson saved" })
  }),
)
adminSalesRouter.get(
  "/me",
  validate({ query: MonthQuery }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).mine(month(req)) })
  }),
)
