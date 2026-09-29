/**
 * FESTIVAL CALENDAR ROUTES — /api/admin/festivals (Promotions permissions: view / create / edit / delete)
 *   GET /?year=              the year's festivals
 *   GET /upcoming            the next few, for the dashboard
 *   GET /link-options        promotions, flash sales, coupons and landing pages to link
 *   POST /presets            add the built-in festivals of a year
 *   GET /:id, POST /, PATCH /:id, DELETE /:id
 *   POST /:id/tasks/:taskId  tick a checklist item
 *   POST /:id/match          set a linked campaign's dates to the festival's sale
 */
import { Router, type Request, type Response } from "express"
import { z } from "zod"
import { ctrl, envelope, type RequestContext } from "../../core"
import { authMiddleware, rbacMiddleware, validate } from "../../middleware"
import { FestivalsService, type FestivalInput, type LinkKind } from "./festivals.service"

type Req = Request & { ctx: RequestContext }
const svc = (req: Req) => new FestivalsService(req.ctx)
const idOf = (req: Req) => BigInt((req.params as { id: string }).id)

const IdParam = z.object({ id: z.coerce.bigint().positive() })
const YearDto = z.object({ year: z.coerce.number().int().min(2000).max(2100) })
const DayDto = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
const KIND = z.enum(["promotion", "flash_sale", "coupon", "landing_page"])
const Ids = z.array(z.string().regex(/^\d+$/)).max(50)

const FestivalDto = z.object({
  name: z.string().trim().min(1).max(120),
  startsOn: DayDto,
  endsOn: DayDto,
  saleFrom: DayDto,
  saleTo: DayDto,
  dateIsEstimate: z.boolean().optional(),
  remindDays: z.number().int().min(0).max(90).optional(),
  note: z.string().trim().max(2000).nullable().optional(),
  checklist: z.array(z.object({ id: z.string().max(20), text: z.string().trim().max(200), done: z.boolean() })).max(40).optional(),
  links: z.object({ promotion: Ids, flash_sale: Ids, coupon: Ids, landing_page: Ids }).partial().optional(),
})
const TaskParam = z.object({ id: z.coerce.bigint().positive(), taskId: z.string().max(20) })
const TaskDto = z.object({ done: z.boolean() })
const MatchDto = z.object({ kind: KIND, itemId: z.coerce.bigint().positive() })

export const adminFestivalsRouter = Router()
adminFestivalsRouter.use(authMiddleware("adminOrSuper"))

adminFestivalsRouter.get(
  "/",
  rbacMiddleware("promotions.view"),
  validate({ query: YearDto }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).list((req.query as unknown as z.infer<typeof YearDto>).year) })
  }),
)
adminFestivalsRouter.get(
  "/upcoming",
  rbacMiddleware("promotions.view"),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).upcoming() })
  }),
)
adminFestivalsRouter.get(
  "/link-options",
  rbacMiddleware("promotions.view"),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).linkOptions() })
  }),
)
adminFestivalsRouter.post(
  "/presets",
  rbacMiddleware("promotions.create"),
  validate({ body: YearDto }),
  ctrl(async (req: Req, res: Response) => {
    const r = await svc(req).addPresets((req.body as z.infer<typeof YearDto>).year)
    envelope(res, { data: r, message: r.added ? `${r.added} festivals added` : "All festivals are already on the calendar" })
  }),
)
adminFestivalsRouter.get(
  "/:id",
  rbacMiddleware("promotions.view"),
  validate({ params: IdParam }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).get(idOf(req)) })
  }),
)
adminFestivalsRouter.post(
  "/",
  rbacMiddleware("promotions.create"),
  validate({ body: FestivalDto }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { status: 201, data: await svc(req).create(req.body as FestivalInput), message: "Festival added" })
  }),
)
adminFestivalsRouter.patch(
  "/:id",
  rbacMiddleware("promotions.edit"),
  validate({ params: IdParam, body: FestivalDto }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).update(idOf(req), req.body as FestivalInput), message: "Festival saved" })
  }),
)
adminFestivalsRouter.post(
  "/:id/tasks/:taskId",
  rbacMiddleware("promotions.edit"),
  validate({ params: TaskParam, body: TaskDto }),
  ctrl(async (req: Req, res: Response) => {
    const taskId = (req.params as { taskId: string }).taskId
    envelope(res, { data: await svc(req).setTask(idOf(req), taskId, (req.body as z.infer<typeof TaskDto>).done) })
  }),
)
adminFestivalsRouter.post(
  "/:id/match",
  rbacMiddleware("promotions.view"),
  validate({ params: IdParam, body: MatchDto }),
  ctrl(async (req: Req, res: Response) => {
    const b = req.body as { kind: LinkKind; itemId: bigint }
    envelope(res, { data: await svc(req).matchDates(idOf(req), b.kind, BigInt(b.itemId)), message: "Dates set to the festival's sale" })
  }),
)
adminFestivalsRouter.delete(
  "/:id",
  rbacMiddleware("promotions.delete"),
  validate({ params: IdParam }),
  ctrl(async (req: Req, res: Response) => {
    await svc(req).remove(idOf(req))
    envelope(res, { data: null, message: "Festival removed" })
  }),
)
