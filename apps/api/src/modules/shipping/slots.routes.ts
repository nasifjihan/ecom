/** Admin: delivery slots and their settings, under /api/admin/shipping/slots. */
import { Router, type Request, type Response } from "express"
import { z } from "zod"
import { ctrl, envelope, BadRequestError, type RequestContext } from "../../core"
import { authMiddleware, rbacMiddleware, validate } from "../../middleware"
import { DeliverySlotService } from "./slots.service"

type Req = Request & { ctx: RequestContext }

const SlotDto = z.object({
  name: z.string().trim().min(1).max(60),
  startTime: z.string().max(5),
  endTime: z.string().max(5),
  cutoffMinutes: z.coerce.number().int().min(0).max(7 * 24 * 60).default(120),
  fee: z.coerce.number().min(0).max(100000).multipleOf(0.01).default(0),
  capacity: z.coerce.number().int().min(1).max(10000).nullable().default(null),
  weekdays: z.array(z.number().int().min(0).max(6)).max(7).default([0, 1, 2, 3, 4, 5, 6]),
  enabled: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).max(1000).default(0),
})

const SettingsDto = z.object({
  daysAhead: z.coerce.number().int().min(1).max(14),
  closedDates: z.array(z.string().max(10)).max(100).default([]),
})

const svc = (req: Req) => {
  if (req.ctx.storeId === undefined) throw new BadRequestError("Store not resolved", "TENANT_NOT_RESOLVED")
  return new DeliverySlotService(BigInt(req.ctx.storeId))
}
const send = (res: Response, body: Parameters<typeof envelope>[1]): void => {
  envelope(res, body)
}
const idOf = (req: Req) => BigInt(String(req.params.id))

export const adminDeliverySlotsRouter = Router()

adminDeliverySlotsRouter.get(
  "/",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("shipping.view"),
  ctrl(async (req: Req, res: Response) => send(res, { status: 200, data: await svc(req).list() })),
)
adminDeliverySlotsRouter.post(
  "/",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("shipping.edit"),
  validate({ body: SlotDto }),
  ctrl(async (req: Req, res: Response) =>
    send(res, { status: 201, data: await svc(req).create(req.body as z.infer<typeof SlotDto>), message: "Slot added" }),
  ),
)
adminDeliverySlotsRouter.put(
  "/settings",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("shipping.edit"),
  validate({ body: SettingsDto }),
  ctrl(async (req: Req, res: Response) =>
    send(res, { status: 200, data: await svc(req).saveSettings(req.body as z.infer<typeof SettingsDto>), message: "Saved" }),
  ),
)
adminDeliverySlotsRouter.put(
  "/:id",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("shipping.edit"),
  validate({ body: SlotDto }),
  ctrl(async (req: Req, res: Response) =>
    send(res, { status: 200, data: await svc(req).update(idOf(req), req.body as z.infer<typeof SlotDto>), message: "Slot saved" }),
  ),
)
adminDeliverySlotsRouter.delete(
  "/:id",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("shipping.edit"),
  ctrl(async (req: Req, res: Response) =>
    send(res, { status: 200, data: await svc(req).remove(idOf(req)), message: "Slot deleted" }),
  ),
)
