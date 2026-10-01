/**
 * TEAM ALERTS
 *   the bell (any signed-in staff member, their own):
 *     GET /api/admin/inbox (?unread=1)   POST /api/admin/inbox/:id/read   POST /api/admin/inbox/read-all
 *   who gets which messages (Settings > Notifications, "emails" permission):
 *     GET /api/admin/notifications/matrix   PUT /api/admin/notifications/matrix
 */
import { Router, type Request, type Response } from "express"
import { z } from "zod"
import { BadRequestError, ctrl, envelope, type RequestContext } from "../../core"
import { authMiddleware, rbacMiddleware, validate } from "../../middleware"
import { NotificationMatrix, StaffInbox } from "./staff-alerts.service"

type Req = Request & { ctx: RequestContext }
const storeOf = (req: Req) => {
  if (req.ctx.storeId === undefined) throw new BadRequestError("Store not resolved", "TENANT_NOT_RESOLVED")
  return BigInt(req.ctx.storeId)
}
const inbox = (req: Req) => {
  const a = req.ctx.admin
  if (!a || a.role === "SUPER") throw new BadRequestError("Only a store's staff have notifications", "VALIDATION_FAILED")
  return new StaffInbox(storeOf(req), a.id)
}

const ListQuery = z.object({ unread: z.enum(["0", "1"]).optional(), take: z.coerce.number().int().min(1).max(100).default(20) })
const IdParam = z.object({ id: z.coerce.bigint().positive() })
const MatrixBody = z.object({
  customers: z.array(z.object({ key: z.string().max(40), email: z.boolean().optional(), sms: z.boolean().optional() })).max(30).optional(),
  staff: z
    .array(
      z.object({
        event: z.string().max(40),
        inApp: z.boolean().optional(),
        email: z.boolean().optional(),
        sms: z.boolean().optional(),
        staffIds: z.array(z.coerce.bigint().positive()).max(100).optional(),
      }),
    )
    .max(30)
    .optional(),
})

export const adminInboxRouter = Router()
adminInboxRouter.use(authMiddleware("adminOrSuper"))
adminInboxRouter.get(
  "/",
  validate({ query: ListQuery }),
  ctrl(async (req: Req, res: Response) => {
    const q = req.query as unknown as z.infer<typeof ListQuery>
    if (!req.ctx.admin || req.ctx.admin.role === "SUPER") {
      envelope(res, { status: 200, data: { unread: 0, items: [] } })
      return
    }
    envelope(res, { status: 200, data: await inbox(req).list({ unread: q.unread === "1", take: q.take }) })
  }),
)
adminInboxRouter.post(
  "/read-all",
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { status: 200, data: await inbox(req).readAll() })
  }),
)
adminInboxRouter.post(
  "/:id/read",
  validate({ params: IdParam }),
  ctrl(async (req: Req, res: Response) => {
    await inbox(req).read(BigInt((req.params as { id: string }).id))
    envelope(res, { status: 200, data: null })
  }),
)

export const adminMatrixRouter = Router()
adminMatrixRouter.use(authMiddleware("adminOrSuper"))
adminMatrixRouter.get(
  "/",
  rbacMiddleware("emails.view"),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { status: 200, data: await new NotificationMatrix(storeOf(req)).get() })
  }),
)
adminMatrixRouter.put(
  "/",
  rbacMiddleware("emails.edit"),
  validate({ body: MatrixBody }),
  ctrl(async (req: Req, res: Response) => {
    const by = req.ctx.admin && req.ctx.admin.role !== "SUPER" ? req.ctx.admin.id : undefined
    envelope(res, { status: 200, data: await new NotificationMatrix(storeOf(req), by).save(req.body as z.infer<typeof MatrixBody>), message: "Saved" })
  }),
)
