/**
 * SMS ROUTES
 *   GET|PUT /api/admin/sms/settings         provider, sender ID, keys (never returned), order SMS, phone sign-in
 *   POST    /api/admin/sms/test             { to, text? } send a test message
 *   GET     /api/admin/sms/log              ?kind=&status=&search=&page=
 *   POST    /api/admin/sms/log/:id/resend
 *   GET     /api/admin/orders/:id/sms       messages sent for an order
 *   POST    /api/admin/orders/:id/sms-invoice  { to? } the order and invoice link by SMS
 * Phone sign-in lives with the other customer auth routes (auth.routes.ts).
 */
import { Router, type Request, type Response } from "express"
import { BadRequestError, ctrl, envelope, type RequestContext } from "../../core"
import { authMiddleware, rbacMiddleware, validate } from "../../middleware"
import { SmsService } from "./sms.service"
import { IdParam, InvoiceSmsDto, SaveSmsSettingsDto, SmsLogQuery, TestSmsDto } from "./sms.dto"

type Req = Request & { ctx: RequestContext }
export const smsFor = (ctx: RequestContext) => {
  if (ctx.storeId === undefined)
    throw new BadRequestError("No store for this request", "STORE_REQUIRED")
  return new SmsService(BigInt(ctx.storeId))
}
const id = (req: Req) => BigInt((req.params as { id: string }).id)

export const adminSmsRouter = Router()
adminSmsRouter.use(authMiddleware("adminOrSuper"))

adminSmsRouter.get(
  "/settings",
  rbacMiddleware("settings.view"),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await smsFor(req.ctx).settings() })
  }),
)
adminSmsRouter.put(
  "/settings",
  rbacMiddleware("settings.edit"),
  validate({ body: SaveSmsSettingsDto }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, {
      data: await smsFor(req.ctx).save(req.body as SaveSmsSettingsDto),
      message: "SMS settings saved",
    })
  }),
)
adminSmsRouter.post(
  "/test",
  rbacMiddleware("settings.edit"),
  validate({ body: TestSmsDto }),
  ctrl(async (req: Req, res: Response) => {
    const b = req.body as { to: string; text?: string }
    envelope(res, { data: await smsFor(req.ctx).test(b.to, b.text) })
  }),
)
adminSmsRouter.get(
  "/log",
  rbacMiddleware("settings.view"),
  validate({ query: SmsLogQuery }),
  ctrl(async (req: Req, res: Response) => {
    const r = await smsFor(req.ctx).log(req.query as unknown as SmsLogQuery)
    envelope(res, { data: r.data, meta: { ...r.meta, partsLast30Days: r.partsLast30Days } })
  }),
)
adminSmsRouter.post(
  "/log/:id/resend",
  rbacMiddleware("settings.edit"),
  validate({ params: IdParam }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await smsFor(req.ctx).resend(id(req)) })
  }),
)

export const adminOrderSmsRouter = Router()
adminOrderSmsRouter.get(
  "/:id/sms",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("orders.view"),
  validate({ params: IdParam }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, {
      data: (await smsFor(req.ctx).log({ page: 1, perPage: 50, orderId: id(req) })).data,
    })
  }),
)
adminOrderSmsRouter.post(
  "/:id/sms-invoice",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("orders.edit"),
  validate({ params: IdParam, body: InvoiceSmsDto }),
  ctrl(async (req: Req, res: Response) => {
    const to = (req.body as { to?: string }).to
    envelope(res, { data: await smsFor(req.ctx).invoice(id(req), to?.trim() ? to : undefined) })
  }),
)
