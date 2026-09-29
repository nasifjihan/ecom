/**
 * WAREHOUSE ROUTES (/api/admin/warehouses)
 *   GET|POST /, PATCH|DELETE /:id                 warehouses (inventory.view / inventory.edit)
 *   GET /stock?search=&warehouseId=               stock per warehouse
 *   GET|POST /transfers, GET /transfers/:id       transfers; POST sends (stock leaves the source)
 *   POST /transfers/:id/receive | /cancel         receive (with shortfall) or cancel (stock goes back)
 *   GET /orders/:orderId, POST /orders/:orderId   an order's stock per warehouse; ship it from another
 */
import { Router, type Request, type Response } from "express"
import type { z } from "zod"
import { ctrl, envelope, type RequestContext } from "../../core"
import { authMiddleware, rbacMiddleware, validate } from "../../middleware"
import { WarehousesService } from "./warehouses.service"
import {
  IdParam,
  MoveOrderDto,
  OrderIdParam,
  ReceiveDto,
  StockQuery,
  TransferDto,
  TransfersQuery,
  UpdateWarehouseDto,
  WarehouseDto,
} from "./stock.dto"

type Req = Request & { ctx: RequestContext }
const svc = (req: Req) => new WarehousesService(req.ctx)
const id = (req: Req) => BigInt((req.params as { id: string }).id)
const orderId = (req: Req) => BigInt((req.params as { orderId: string }).orderId)
const body = <S extends z.ZodTypeAny>(req: Req) => req.body as z.infer<S>
const query = <S extends z.ZodTypeAny>(req: Req) => req.query as unknown as z.infer<S>

export const adminWarehousesRouter = Router()
adminWarehousesRouter.use(authMiddleware("adminOrSuper"))

// ---- stock and transfers (before /:id)
adminWarehousesRouter.get(
  "/stock",
  rbacMiddleware("inventory.view"),
  validate({ query: StockQuery }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).stock(query<typeof StockQuery>(req)) })
  }),
)
adminWarehousesRouter.get(
  "/transfers",
  rbacMiddleware("inventory.view"),
  validate({ query: TransfersQuery }),
  ctrl(async (req: Req, res: Response) => {
    const r = await svc(req).transfers(query<typeof TransfersQuery>(req))
    envelope(res, { data: r.items, meta: r.meta })
  }),
)
adminWarehousesRouter.post(
  "/transfers",
  rbacMiddleware("inventory.edit"),
  validate({ body: TransferDto }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, {
      status: 201,
      data: await svc(req).send(body<typeof TransferDto>(req)),
      message: "Transfer sent",
    })
  }),
)
adminWarehousesRouter.get(
  "/transfers/:id",
  rbacMiddleware("inventory.view"),
  validate({ params: IdParam }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).transfer(id(req)) })
  }),
)
adminWarehousesRouter.post(
  "/transfers/:id/receive",
  rbacMiddleware("inventory.edit"),
  validate({ params: IdParam, body: ReceiveDto }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, {
      data: await svc(req).receive(id(req), body<typeof ReceiveDto>(req)),
      message: "Transfer received",
    })
  }),
)
adminWarehousesRouter.post(
  "/transfers/:id/cancel",
  rbacMiddleware("inventory.edit"),
  validate({ params: IdParam }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, {
      data: await svc(req).cancel(id(req)),
      message: "Transfer cancelled; the stock is back",
    })
  }),
)

// ---- orders
adminWarehousesRouter.get(
  "/orders/:orderId",
  rbacMiddleware("orders.view"),
  validate({ params: OrderIdParam }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).orderStock(orderId(req)) })
  }),
)
adminWarehousesRouter.post(
  "/orders/:orderId",
  rbacMiddleware("orders.edit"),
  validate({ params: OrderIdParam, body: MoveOrderDto }),
  ctrl(async (req: Req, res: Response) => {
    const r = await svc(req).moveOrder(orderId(req), body<typeof MoveOrderDto>(req).warehouseId)
    envelope(res, { data: r, message: "The order now ships from there" })
  }),
)

// ---- warehouses
adminWarehousesRouter.get(
  "/",
  rbacMiddleware("inventory.view"),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).list() })
  }),
)
adminWarehousesRouter.post(
  "/",
  rbacMiddleware("inventory.edit"),
  validate({ body: WarehouseDto }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, {
      status: 201,
      data: await svc(req).create(body<typeof WarehouseDto>(req)),
      message: "Warehouse added",
    })
  }),
)
adminWarehousesRouter.patch(
  "/:id",
  rbacMiddleware("inventory.edit"),
  validate({ params: IdParam, body: UpdateWarehouseDto }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, {
      data: await svc(req).update(id(req), body<typeof UpdateWarehouseDto>(req)),
      message: "Warehouse saved",
    })
  }),
)
adminWarehousesRouter.delete(
  "/:id",
  rbacMiddleware("inventory.edit"),
  validate({ params: IdParam }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).remove(id(req)), message: "Warehouse deleted" })
  }),
)
