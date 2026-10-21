/**
 * WHATSAPP ROUTES
 *   GET|PUT /api/admin/whatsapp/settings      provider, number id, keys (never returned), order templates
 *   POST    /api/admin/whatsapp/test          { to } sends Meta's "hello_world" template
 *   GET     /api/admin/whatsapp/log           ?status=&kind=&search=&page=
 *   POST    /api/admin/whatsapp/log/:id/resend
 *   GET     /api/admin/orders/:id/whatsapp    messages sent for an order
 *   GET|POST /api/webhooks/whatsapp           Meta's webhook: the verify check, then delivery statuses
 */
import { Router, type Request, type Response } from "express"
import { z } from "zod"
import { BadRequestError, ctrl, envelope, type RequestContext } from "../../core"
import { authMiddleware, rbacMiddleware, validate } from "../../middleware"
import { logger } from "../../config"
import { WA_PROVIDERS, WhatsappService } from "./whatsapp.service"
import { WA_EVENTS, WA_LANGUAGES } from "./whatsapp.rules"

type Req = Request & { ctx: RequestContext }
const wa = (ctx: RequestContext) => {
  if (ctx.storeId === undefined)
    throw new BadRequestError("No store for this request", "STORE_REQUIRED")
  return new WhatsappService(BigInt(ctx.storeId))
}
const IdParam = z.object({ id: z.coerce.bigint().positive() })
const id = (req: Req) => (req.params as unknown as { id: bigint }).id

const SaveDto = z.object({
  provider: z.enum(WA_PROVIDERS).optional(),
  phoneNumberId: z.string().trim().max(30).nullish(),
  accessToken: z.string().trim().max(1000).optional(),
  appSecret: z.string().trim().max(200).optional(),
  events: z
    .record(
      z.enum(WA_EVENTS),
      z.object({
        enabled: z.boolean().optional(),
        template: z.string().trim().max(512).optional(),
        language: z.enum(WA_LANGUAGES).optional(),
      }),
    )
    .optional(),
})
const TestDto = z.object({ to: z.string().trim().min(10).max(20) })
const LogQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
  status: z.enum(["logged", "sending", "sent", "delivered", "read", "failed"]).optional(),
  kind: z.string().max(40).optional(),
  search: z.string().trim().max(60).optional(),
})

export const adminWhatsappRouter = Router()
adminWhatsappRouter.use(authMiddleware("adminOrSuper"))
adminWhatsappRouter.get(
  "/settings",
  rbacMiddleware("settings.view"),
  ctrl(
    async (req: Req, res: Response) => void envelope(res, { data: await wa(req.ctx).settings() }),
  ),
)
adminWhatsappRouter.put(
  "/settings",
  rbacMiddleware("settings.edit"),
  validate({ body: SaveDto }),
  ctrl(
    async (req: Req, res: Response) =>
      void envelope(res, {
        data: await wa(req.ctx).save(req.body as z.infer<typeof SaveDto>),
        message: "WhatsApp settings saved",
      }),
  ),
)
adminWhatsappRouter.post(
  "/test",
  rbacMiddleware("settings.edit"),
  validate({ body: TestDto }),
  ctrl(
    async (req: Req, res: Response) =>
      void envelope(res, { data: await wa(req.ctx).test((req.body as { to: string }).to) }),
  ),
)
adminWhatsappRouter.get(
  "/log",
  rbacMiddleware("settings.view"),
  validate({ query: LogQuery }),
  ctrl(async (req: Req, res: Response) => {
    const r = await wa(req.ctx).log(req.query as unknown as z.infer<typeof LogQuery>)
    envelope(res, { data: r.data, meta: r.meta })
  }),
)
adminWhatsappRouter.post(
  "/log/:id/resend",
  rbacMiddleware("settings.edit"),
  validate({ params: IdParam }),
  ctrl(
    async (req: Req, res: Response) =>
      void envelope(res, { data: await wa(req.ctx).resend(id(req)) }),
  ),
)

export const adminOrderWhatsappRouter = Router()
adminOrderWhatsappRouter.get(
  "/:id/whatsapp",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("orders.view"),
  validate({ params: IdParam }),
  ctrl(
    async (req: Req, res: Response) =>
      void envelope(res, {
        data: (await wa(req.ctx).log({ page: 1, perPage: 50, orderId: id(req) })).data,
      }),
  ),
)

/** Meta's webhook (raw body: the signature covers the exact bytes). A bad signature gets 401 and changes nothing. */
export const whatsappWebhookRouter = Router()
whatsappWebhookRouter.get("/", async (req: Request, res: Response) => {
  const q = req.query as Record<string, string | undefined>
  const echo = await WhatsappService.verifyChallenge(
    q["hub.mode"],
    q["hub.verify_token"],
    q["hub.challenge"],
  )
  if (echo === null) res.sendStatus(403)
  else res.type("text/plain").send(echo)
})
whatsappWebhookRouter.post("/", async (req: Request, res: Response) => {
  try {
    const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body ?? {}))
    const r = await WhatsappService.receive(raw, req.get("x-hub-signature-256"))
    res.sendStatus(r.refused ? 401 : 200)
  } catch (e) {
    logger.error({ err: (e as Error).message }, "WhatsApp webhook failed")
    res.sendStatus(500)
  }
})
