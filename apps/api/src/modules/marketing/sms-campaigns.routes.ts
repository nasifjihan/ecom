/**
 * Marketing > SMS campaigns (mounted at /api/admin/marketing/sms-campaigns), and the public stop
 * link (/api/storefront/sms-stop/:token).
 */
import { Router, type Request, type Response } from "express"
import { z } from "zod"
import { ctrl, envelope, type RequestContext } from "../../core"
import { authMiddleware, rbacMiddleware, validate } from "../../middleware"
import { SmsCampaigns, stopByToken } from "./sms-campaigns"
import { AudienceDto } from "./sms-campaigns.rules"

type Req = Request & { ctx: RequestContext }
const Id = z.object({ id: z.coerce.bigint().positive() })
const idOf = (r: Req) => BigInt((r.params as { id: string }).id)
const svc = (r: Req) => new SmsCampaigns(r.ctx)

const CampaignDto = z.object({
  name: z.string().trim().min(2, "Name the campaign").max(120),
  body: z.string().trim().min(5, "Write the message").max(1000),
  audience: AudienceDto.default({}),
  stopLink: z.boolean().default(true),
})
const PreviewDto = CampaignDto.pick({ body: true, audience: true, stopLink: true })

export const adminSmsCampaignsRouter = Router()
adminSmsCampaignsRouter.use(authMiddleware("adminOrSuper"))

adminSmsCampaignsRouter.get(
  "/",
  rbacMiddleware("promotions.view"),
  validate({ query: z.object({ page: z.coerce.number().int().min(1).default(1), perPage: z.coerce.number().int().min(1).max(100).default(25) }) }),
  ctrl(async (req: Req, res: Response) => {
    const q = req.query as unknown as { page: number; perPage: number }
    envelope(res, { data: await svc(req).list(q.page, q.perPage) })
  }),
)
adminSmsCampaignsRouter.post(
  "/preview",
  rbacMiddleware("promotions.view"),
  validate({ body: PreviewDto }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).preview(req.body as z.infer<typeof PreviewDto>) })
  }),
)
adminSmsCampaignsRouter.post(
  "/",
  rbacMiddleware("promotions.edit"),
  validate({ body: CampaignDto }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { status: 201, data: await svc(req).create(req.body as z.infer<typeof CampaignDto>), message: "Campaign saved" })
  }),
)
adminSmsCampaignsRouter.get(
  "/:id",
  rbacMiddleware("promotions.view"),
  validate({ params: Id }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).get(idOf(req)) })
  }),
)
adminSmsCampaignsRouter.put(
  "/:id",
  rbacMiddleware("promotions.edit"),
  validate({ params: Id, body: CampaignDto }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).update(idOf(req), req.body as z.infer<typeof CampaignDto>), message: "Campaign saved" })
  }),
)
adminSmsCampaignsRouter.delete(
  "/:id",
  rbacMiddleware("promotions.edit"),
  validate({ params: Id }),
  ctrl(async (req: Req, res: Response) => {
    await svc(req).remove(idOf(req))
    envelope(res, { data: { success: true }, message: "Campaign deleted" })
  }),
)
adminSmsCampaignsRouter.post(
  "/:id/test",
  rbacMiddleware("promotions.edit"),
  validate({ params: Id, body: z.object({ phone: z.string().trim().min(10).max(20) }) }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).test(idOf(req), (req.body as { phone: string }).phone), message: "Test SMS sent" })
  }),
)
adminSmsCampaignsRouter.post(
  "/:id/send",
  rbacMiddleware("promotions.edit"),
  validate({ params: Id, body: z.object({ at: z.coerce.date().optional().nullable() }) }),
  ctrl(async (req: Req, res: Response) => {
    const at = (req.body as { at?: Date | null }).at
    envelope(res, { data: await svc(req).send(idOf(req), at), message: at ? "Campaign scheduled" : "Campaign is sending" })
  }),
)
adminSmsCampaignsRouter.post(
  "/:id/cancel",
  rbacMiddleware("promotions.edit"),
  validate({ params: Id }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).cancel(idOf(req)), message: "Campaign cancelled" })
  }),
)

/** The "Stop" link in a campaign SMS. A POST, so a link preview can't opt someone out. */
export const storefrontSmsStopRouter = Router()
storefrontSmsStopRouter.post(
  "/:token",
  validate({ params: z.object({ token: z.string().regex(/^[\w-]{6,20}$/) }) }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await stopByToken((req.params as { token: string }).token) })
  }),
)
