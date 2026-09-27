/**
 * COURIER ROUTES
 *   GET|POST /api/admin/couriers                      accounts (credentials never returned)
 *   PATCH|DELETE /api/admin/couriers/:id
 *   POST /api/admin/couriers/:id/test                 check the credentials with the courier
 *   POST /api/admin/couriers/:id/rotate-webhook       new webhook URL and secret
 *   GET  /api/admin/couriers/active                   enabled accounts, for booking
 *   GET  /api/admin/couriers/:id/pathao/cities|zones|areas, /:id/redx/areas
 *   GET  /api/admin/shipments/labels?ids=1,2          4x6 labels (PDF)
 *   GET  /api/admin/shipments/:id/courier-area?accountId=   the courier's area for the address
 *   POST /api/admin/shipments/:id/book                { accountId, pathao?, redx?, weightKg? }
 *   POST /api/admin/shipments/:id/sync                re-read the status from the courier
 *   POST /api/admin/shipments/sync                    all booked parcels on the way
 *   POST /api/admin/orders/book-courier               { accountId, orderIds } — bulk
 *   POST /api/webhooks/couriers/:courier/:token       courier status webhooks (no login)
 */
import { Router, type Request, type Response } from "express"
import { logger, prisma } from "../../config"
import { ctrl, envelope, type RequestContext } from "../../core"
import { authMiddleware, rbacMiddleware, validate } from "../../middleware"
import { CouriersService } from "./couriers.service"
import { parcelLabels } from "./couriers.label"
import {
  AreasQuery,
  BookParcelDto,
  BulkBookDto,
  CreateAccountDto,
  IdParam,
  LabelsQuery,
  RedxAreasQuery,
  SuggestQuery,
  UpdateAccountDto,
  WebhookParams,
  ZonesQuery,
} from "./couriers.dto"

type Req = Request & { ctx: RequestContext }
const svc = (req: Req) => new CouriersService(req.ctx)
const id = (req: Req) => BigInt((req.params as { id: string }).id)
const q = <T>(req: Req) => req.query as unknown as T
const send = (run: (req: Req) => Promise<unknown>, status = 200) =>
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { status, data: await run(req) })
  })

export const adminCouriersRouter = Router()
adminCouriersRouter.use(authMiddleware("adminOrSuper"))
adminCouriersRouter.get(
  "/active",
  rbacMiddleware("orders.view"),
  send((r) => svc(r).activeAccounts()),
)
adminCouriersRouter.get(
  "/",
  rbacMiddleware("settings.view"),
  send((r) => svc(r).listAccounts()),
)
adminCouriersRouter.post(
  "/",
  rbacMiddleware("settings.edit"),
  validate({ body: CreateAccountDto }),
  send((r) => svc(r).createAccount(r.body as CreateAccountDto), 201),
)
adminCouriersRouter.patch(
  "/:id",
  rbacMiddleware("settings.edit"),
  validate({ params: IdParam, body: UpdateAccountDto }),
  send((r) => svc(r).updateAccount(id(r), r.body as UpdateAccountDto)),
)
adminCouriersRouter.delete(
  "/:id",
  rbacMiddleware("settings.edit"),
  validate({ params: IdParam }),
  send((r) => svc(r).deleteAccount(id(r))),
)
adminCouriersRouter.post(
  "/:id/test",
  rbacMiddleware("settings.edit"),
  validate({ params: IdParam }),
  send((r) => svc(r).testAccount(id(r))),
)
adminCouriersRouter.post(
  "/:id/rotate-webhook",
  rbacMiddleware("settings.edit"),
  validate({ params: IdParam }),
  send((r) => svc(r).rotateWebhook(id(r))),
)
adminCouriersRouter.get(
  "/:id/pathao/cities",
  rbacMiddleware("orders.view"),
  validate({ params: IdParam }),
  send((r) => svc(r).pathaoCities(id(r))),
)
adminCouriersRouter.get(
  "/:id/pathao/zones",
  rbacMiddleware("orders.view"),
  validate({ params: IdParam, query: ZonesQuery }),
  send((r) => svc(r).pathaoZones(id(r), q<{ cityId: number }>(r).cityId)),
)
adminCouriersRouter.get(
  "/:id/pathao/areas",
  rbacMiddleware("orders.view"),
  validate({ params: IdParam, query: AreasQuery }),
  send((r) => svc(r).pathaoAreas(id(r), q<{ zoneId: number }>(r).zoneId)),
)
adminCouriersRouter.get(
  "/:id/redx/areas",
  rbacMiddleware("orders.view"),
  validate({ params: IdParam, query: RedxAreasQuery }),
  send((r) => svc(r).redxAreas(id(r), q<{ district?: string }>(r).district)),
)

/** Mounted on /api/admin/shipments before the parcels router (its "/:id" would catch "labels"). */
export const adminShipmentCourierRouter = Router()
adminShipmentCourierRouter.use(authMiddleware("adminOrSuper"))
adminShipmentCourierRouter.get(
  "/labels",
  rbacMiddleware("orders.view"),
  validate({ query: LabelsQuery }),
  ctrl(async (req: Req, res: Response) => {
    const pdf = await parcelLabels(req.ctx.storeId!, q<{ ids: bigint[] }>(req).ids)
    res.setHeader("Content-Type", "application/pdf")
    res.setHeader("Content-Length", String(pdf.length))
    res.setHeader(
      "Content-Disposition",
      `${req.query.download ? "attachment" : "inline"}; filename="labels.pdf"`,
    )
    res.setHeader("Cache-Control", "private, no-store")
    res.status(200).end(pdf)
  }),
)
adminShipmentCourierRouter.post(
  "/sync",
  rbacMiddleware("orders.edit"),
  send((r) => svc(r).syncStore()),
)
adminShipmentCourierRouter.get(
  "/:id/courier-area",
  rbacMiddleware("orders.view"),
  validate({ params: IdParam, query: SuggestQuery }),
  send(async (r) => {
    const s = await prisma.shipment.findFirst({
      where: { id: id(r), storeId: r.ctx.storeId },
      select: {
        order: { select: { shippingCity: true, shippingUpazila: true, shippingState: true } },
      },
    })
    if (!s) return {}
    return svc(r).suggestArea(q<{ accountId: bigint }>(r).accountId, {
      district: s.order.shippingCity,
      upazila: s.order.shippingUpazila,
      division: s.order.shippingState,
    })
  }),
)
adminShipmentCourierRouter.post(
  "/:id/book",
  rbacMiddleware("orders.edit"),
  validate({ params: IdParam, body: BookParcelDto }),
  send((r) => svc(r).bookParcel(id(r), r.body as BookParcelDto)),
)
adminShipmentCourierRouter.post(
  "/:id/sync",
  rbacMiddleware("orders.edit"),
  validate({ params: IdParam }),
  send((r) => svc(r).syncParcel(id(r))),
)

/** Mounted on /api/admin/orders before the orders router. */
export const adminOrderCourierRouter = Router()
adminOrderCourierRouter.post(
  "/book-courier",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("orders.edit"),
  validate({ body: BulkBookDto }),
  send((r) => svc(r).bulkBook(r.body as BulkBookDto)),
)

/**
 * Courier webhooks. Answers quickly with what each courier expects: Pathao wants 202 and its
 * integration header (the same constant for every merchant, from Pathao's own WooCommerce plugin).
 */
/** Webhook bodies arrive as raw bytes (see 08-body-parser): JSON, or form-encoded from some couriers. */
function webhookBody(raw: unknown): Record<string, unknown> {
  if (!Buffer.isBuffer(raw))
    return (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>
  const text = raw.toString("utf8").trim()
  if (!text) return {}
  try {
    const v: unknown = JSON.parse(text)
    return v && typeof v === "object" ? (v as Record<string, unknown>) : {}
  } catch {
    return Object.fromEntries(new URLSearchParams(text))
  }
}

const PATHAO_INTEGRATION_SECRET = "f3992ecc-59da-4cbe-a049-a13da2018d51"
export const courierWebhooksRouter = Router()
courierWebhooksRouter.post(
  "/:courier/:token",
  validate({ params: WebhookParams }),
  async (req: Req, res: Response) => {
    const { courier, token } = req.params as { courier: string; token: string }
    const body = webhookBody(req.body)
    if (courier === "pathao")
      res.setHeader("X-Pathao-Merchant-Webhook-Integration-Secret", PATHAO_INTEGRATION_SECRET)
    try {
      const out = await CouriersService.webhook(courier, token, req.headers, body)
      if (courier === "pathao") return res.status(202).json({ received: true })
      if (courier === "steadfast")
        return res
          .status(200)
          .json({ status: "success", message: "Webhook received successfully." })
      return res.status(200).json({ received: true, handled: out.handled })
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode ?? 500
      if (status >= 500)
        logger.error({ err: (e as Error).message, courier }, "Courier webhook failed")
      return res.status(status === 404 ? 404 : status >= 500 ? 500 : 400).json({
        status: "error",
        message: status === 404 ? "Unknown webhook" : "Couldn't handle it",
      })
    }
  },
)
