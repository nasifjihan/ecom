/**
 * REPORTS ROUTES (/api/admin/reports, permission reports.view). Every report takes ?from=&to=
 * (YYYY-MM-DD, shop time, both included; default the last 30 days) and most take ?basis=.
 *   GET /sales       totals vs previous period, chart series, by source and payment method
 *   GET /products    products and categories with cost and gross profit (?sort=revenue|units|profit)
 *   GET /discounts   coupons and automatic promotions
 *   GET /customers   new / returning / repeat, top customers, by area
 *   GET /couriers    parcels, success and return rates, COD and courier payouts
 *   GET /returns     refunds and returns
 *   GET /tax         tax collected per day or month
 *   GET /stock       stock value at cost and at selling price, today
 */
import { Router, type Request, type Response } from "express"
import type { z } from "zod"
import { ctrl, envelope, type RequestContext } from "../../core"
import { authMiddleware, rbacMiddleware, validate } from "../../middleware"
import { ReportsService } from "./reports.service"
import { ProductsQuery, RangeQuery } from "./reports.dto"

type Req = Request & { ctx: RequestContext }
const svc = (req: Req) => new ReportsService(req.ctx)
const query = <S extends z.ZodTypeAny>(req: Req) => req.query as unknown as z.infer<S>

export const adminReportsRouter = Router()
adminReportsRouter.use(authMiddleware("adminOrSuper"), rbacMiddleware("reports.view"))

const ranged = (
  path: string,
  run: (s: ReportsService, q: z.infer<typeof RangeQuery>) => Promise<unknown>,
) =>
  adminReportsRouter.get(
    path,
    validate({ query: RangeQuery }),
    ctrl(async (req: Req, res: Response) => {
      envelope(res, { data: await run(svc(req), query<typeof RangeQuery>(req)) })
    }),
  )

ranged("/sales", (s, q) => s.sales(q))
ranged("/discounts", (s, q) => s.discounts(q))
ranged("/customers", (s, q) => s.customers(q))
ranged("/couriers", (s, q) => s.couriers(q))
ranged("/returns", (s, q) => s.returns(q))
ranged("/tax", (s, q) => s.tax(q))

adminReportsRouter.get(
  "/products",
  validate({ query: ProductsQuery }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).products(query<typeof ProductsQuery>(req)) })
  }),
)
adminReportsRouter.get(
  "/stock",
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).stock() })
  }),
)
