/**
 * SCHEDULED REPORT EMAILS — /api/admin/reports/schedules (reports.view to see, reports.edit to change)
 *   GET /                          the schedules
 *   GET /options                   staff who can be chosen
 *   GET /:id                       one, with its latest sendings
 *   POST /, PUT /:id, DELETE /:id
 *   POST /:id/enabled              { enabled } switch on or off
 *   POST /:id/send-now             send it now, for the days it would cover today
 *   GET /:id/preview               the PDF it would send now (?download=1 to save it)
 *   GET /:id/runs/:runId/pdf       a PDF that went out
 */
import { Router, type Request, type Response } from "express"
import { z } from "zod"
import { ctrl, envelope, type RequestContext } from "../../core"
import { rbacMiddleware, validate } from "../../middleware"
import { REPORT_BASES } from "./reports.rules"
import { FREQUENCIES, MAX_EMAILS, PERIODS, REPORT_KEYS } from "./report-schedule.rules"
import { ReportSchedulesService } from "./report-schedules.service"
import { sendPdf } from "./pdf.http"

type Req = Request & { ctx: RequestContext }
const svc = (req: Req) => new ReportSchedulesService(req.ctx)
const idOf = (req: Req) => BigInt((req.params as { id: string }).id)

const IdParam = z.object({ id: z.coerce.bigint().positive() })
const RunParam = IdParam.extend({ runId: z.coerce.bigint().positive() })
const Id = z.union([z.string().regex(/^\d+$/), z.number().int().positive()]).transform((v) => BigInt(v))

const ScheduleDto = z.object({
  name: z.string().trim().min(1, "Give the schedule a name").max(120),
  reports: z.array(z.enum(REPORT_KEYS)).min(1, "Choose at least one report").max(REPORT_KEYS.length),
  frequency: z.enum(FREQUENCIES),
  weekday: z.number().int().min(1).max(7).nullable().optional(),
  monthDay: z.number().int().min(1).max(28).nullable().optional(),
  sendHour: z.number().int().min(0).max(23),
  period: z.enum(PERIODS),
  basis: z.enum(REPORT_BASES).default("placed"),
  storefrontId: Id.nullable().optional(),
  staffIds: z.array(Id).max(50).default([]),
  emails: z.array(z.string().trim().max(200)).max(MAX_EMAILS, `At most ${MAX_EMAILS} other addresses`).default([]),
  enabled: z.boolean().optional(),
})
const EnabledDto = z.object({ enabled: z.boolean() })

export const reportSchedulesRouter = Router()

reportSchedulesRouter.get(
  "/",
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).list() })
  }),
)
reportSchedulesRouter.get(
  "/options",
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).options() })
  }),
)
reportSchedulesRouter.get(
  "/:id",
  validate({ params: IdParam }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).get(idOf(req)) })
  }),
)
reportSchedulesRouter.post(
  "/",
  rbacMiddleware("reports.edit"),
  validate({ body: ScheduleDto }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { status: 201, data: await svc(req).create(req.body as z.infer<typeof ScheduleDto>) })
  }),
)
reportSchedulesRouter.put(
  "/:id",
  rbacMiddleware("reports.edit"),
  validate({ params: IdParam, body: ScheduleDto }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).update(idOf(req), req.body as z.infer<typeof ScheduleDto>) })
  }),
)
reportSchedulesRouter.delete(
  "/:id",
  rbacMiddleware("reports.edit"),
  validate({ params: IdParam }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).remove(idOf(req)) })
  }),
)
reportSchedulesRouter.post(
  "/:id/enabled",
  rbacMiddleware("reports.edit"),
  validate({ params: IdParam, body: EnabledDto }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).setEnabled(idOf(req), (req.body as z.infer<typeof EnabledDto>).enabled) })
  }),
)
reportSchedulesRouter.post(
  "/:id/send-now",
  rbacMiddleware("reports.edit"),
  validate({ params: IdParam }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).sendNow(idOf(req)) })
  }),
)
reportSchedulesRouter.get(
  "/:id/preview",
  validate({ params: IdParam }),
  ctrl(async (req: Req, res: Response) => {
    sendPdf(req, res, await svc(req).preview(idOf(req)))
  }),
)
reportSchedulesRouter.get(
  "/:id/runs/:runId/pdf",
  validate({ params: RunParam }),
  ctrl(async (req: Req, res: Response) => {
    const p = req.params as unknown as z.infer<typeof RunParam>
    sendPdf(req, res, await svc(req).runPdf(BigInt(p.id), BigInt(p.runId)))
  }),
)
