/**
 * IMPORT & EXPORT JOBS — /api/admin/jobs (store staff; each kind checks its own permissions)
 *   GET /                    the latest jobs of the kinds you may run
 *   GET /:id                 one job, with its progress
 *   GET /:id/file            the finished export
 *   POST /exports            { kind, format, filters } start an export
 *   POST /imports/products   multipart "file": import products in the background
 */
import { Router, type Request, type Response } from "express"
import { z } from "zod"
import { ctrl, envelope, type RequestContext } from "../../core"
import { authMiddleware, validate } from "../../middleware"
import { fileOf, parseSheetUpload } from "../catalog/import/import.routes"
import { DataJobsService } from "./jobs.service"

type Req = Request & { ctx: RequestContext }
const svc = (req: Req) => new DataJobsService(req.ctx)

const IdParam = z.object({ id: z.coerce.bigint().positive() })
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD").optional()

const ExportDto = z.object({
  kind: z.enum(["export_orders", "export_customers", "export_products", "export_newsletter"]),
  format: z.enum(["csv", "xlsx"]).default("csv"),
  /** The list page's filters; each export reads the ones it knows. */
  filters: z
    .object({
      status: z.union([z.string().max(40), z.array(z.string().max(40)).max(20)]).optional(),
      dateFrom: day,
      dateTo: day,
      search: z.string().trim().max(100).optional(),
      // Orders page filters (see orders/order-filters.ts).
      minTotal: z.number().nonnegative().optional(),
      maxTotal: z.number().nonnegative().optional(),
      paymentGateway: z.string().max(40).optional(),
      hasCoupon: z.boolean().optional(),
      createdByAdminId: z.string().regex(/^\d+$/).optional(),
      shippingZoneId: z.string().regex(/^\d+$/).optional(),
      storefrontId: z.string().regex(/^\d+$/).optional(),
      source: z.string().max(200).optional(),
      groupId: z.string().regex(/^\d+$/).optional(),
      acceptMarketing: z.boolean().optional(),
    })
    .default({}),
})

export const adminJobsRouter = Router()
adminJobsRouter.use(authMiddleware("adminOrSuper"))

adminJobsRouter.get(
  "/",
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).list() })
  }),
)
adminJobsRouter.get(
  "/:id",
  validate({ params: IdParam }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).get(BigInt((req.params as { id: string }).id)) })
  }),
)
adminJobsRouter.get(
  "/:id/file",
  validate({ params: IdParam }),
  ctrl(async (req: Req, res: Response) => {
    const f = await svc(req).file(BigInt((req.params as { id: string }).id))
    res.setHeader("Content-Type", f.contentType)
    res.setHeader("Content-Disposition", `attachment; filename="${f.filename}"`)
    res.setHeader("Cache-Control", "private, no-store")
    res.status(200).end(f.buffer)
  }),
)
adminJobsRouter.post(
  "/exports",
  validate({ body: ExportDto }),
  ctrl(async (req: Req, res: Response) => {
    const { kind, format, filters } = req.body as z.infer<typeof ExportDto>
    const f = { ...filters, ...(kind === "export_orders" && typeof filters.status === "string" ? { status: [filters.status] } : {}) }
    envelope(res, { status: 202, data: await svc(req).createExport(kind, { format, ...f }), message: "Export started" })
  }),
)
adminJobsRouter.post(
  "/imports/products",
  parseSheetUpload,
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { status: 202, data: await svc(req).createProductImport(fileOf(req)), message: "Import started" })
  }),
)
