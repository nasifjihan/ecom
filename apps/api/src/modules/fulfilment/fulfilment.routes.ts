/**
 * FULFILMENT ROUTES
 *   GET  /api/admin/shipments                 parcels (status tab, search)
 *   GET|PATCH /api/admin/shipments/:id        a parcel / courier, tracking, COD amount
 *   POST /api/admin/shipments/:id/status      { status, note } — picked up, in transit, delivered, failed, …
 *   GET  /api/admin/returns                   returns (status tab, search)
 *   GET  /api/admin/returns/:id
 *   POST /api/admin/returns/:id/status        { status, note, restock } — approve, receive, reject, cancel
 *   POST /api/admin/orders/:id/shipments      pack items into a parcel
 *   POST /api/admin/orders/:id/returns        start a return for the customer
 *   GET|POST /api/admin/orders/:id/refunds    refunds (items, amount, method, restock, return)
 *   POST /api/storefront/account/orders/:orderRef/returns   the customer asks for a return
 */
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { prisma } from "../../config";
import { BadRequestError, NotFoundError, ctrl, envelope, type RequestContext } from "../../core";
import { authMiddleware, rbacMiddleware, validate } from "../../middleware";
import { FulfilmentService } from "./fulfilment.service";
import {
  CreateParcelDto,
  CreateRefundDto,
  CreateReturnDto,
  IdParam,
  ListQueryDto,
  MoveParcelDto,
  MoveReturnDto,
  UpdateParcelDto,
} from "./fulfilment.dto";

type Req = Request & { ctx: RequestContext };
const svc = (req: Req) => new FulfilmentService(req.ctx);
const id = (req: Req) => BigInt((req.params as { id: string }).id);
const send = (run: (req: Req) => Promise<unknown>, status = 200) =>
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { status, data: await run(req) });
  });
const paged = (run: (req: Req) => Promise<{ items: unknown; counts: unknown; meta: unknown }>) =>
  ctrl(async (req: Req, res: Response) => {
    const out = await run(req);
    envelope(res, { status: 200, data: { items: out.items, counts: out.counts }, meta: out.meta as never });
  });

export const adminShipmentsRouter = Router();
adminShipmentsRouter.use(authMiddleware("adminOrSuper"));
adminShipmentsRouter.get("/", rbacMiddleware("orders.view"), validate({ query: ListQueryDto }), paged((r) => svc(r).listParcels(r.query as unknown as ListQueryDto)));
adminShipmentsRouter.get("/:id", rbacMiddleware("orders.view"), validate({ params: IdParam }), send((r) => svc(r).getParcel(id(r))));
adminShipmentsRouter.patch("/:id", rbacMiddleware("orders.edit"), validate({ params: IdParam, body: UpdateParcelDto }), send((r) => svc(r).updateParcel(id(r), r.body as UpdateParcelDto)));
adminShipmentsRouter.post("/:id/status", rbacMiddleware("orders.edit"), validate({ params: IdParam, body: MoveParcelDto }), send((r) => svc(r).moveParcel(id(r), r.body as MoveParcelDto)));

export const adminReturnsRouter = Router();
adminReturnsRouter.use(authMiddleware("adminOrSuper"));
adminReturnsRouter.get("/", rbacMiddleware("orders.view"), validate({ query: ListQueryDto }), paged((r) => svc(r).listReturns(r.query as unknown as ListQueryDto)));
adminReturnsRouter.get("/:id", rbacMiddleware("orders.view"), validate({ params: IdParam }), send((r) => svc(r).getReturn(id(r))));
adminReturnsRouter.post("/:id/status", rbacMiddleware("orders.edit"), validate({ params: IdParam, body: MoveReturnDto }), send((r) => svc(r).moveReturn(id(r), r.body as MoveReturnDto)));

/** Mounted on /api/admin/orders ahead of the orders router. */
export const adminOrderFulfilmentRouter = Router();
adminOrderFulfilmentRouter.post(
  "/:id/shipments",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("orders.edit"),
  validate({ params: IdParam, body: CreateParcelDto }),
  send((r) => svc(r).createParcel(id(r), r.body as CreateParcelDto), 201),
);
adminOrderFulfilmentRouter.post(
  "/:id/returns",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("orders.edit"),
  validate({ params: IdParam, body: CreateReturnDto }),
  send((r) => svc(r).createReturn(id(r), r.body as CreateReturnDto, "staff"), 201),
);
adminOrderFulfilmentRouter.post(
  "/:id/refunds",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("orders.edit"),
  validate({ params: IdParam, body: CreateRefundDto }),
  send((r) => svc(r).createRefund(id(r), r.body as CreateRefundDto), 201),
);
adminOrderFulfilmentRouter.get(
  "/:id/refunds",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("orders.view"),
  validate({ params: IdParam }),
  send(async (r) => {
    if (r.ctx.storeId === undefined) throw new BadRequestError("No store for this request", "STORE_REQUIRED");
    return prisma.refund.findMany({ where: { orderId: id(r), storeId: r.ctx.storeId }, include: { items: true }, orderBy: { createdAt: "desc" } });
  }),
);

/** Mounted on /api/storefront/account. */
export const storefrontReturnsRouter = Router();
const OrderRef = z.object({ orderRef: z.string().min(3).max(40) });
storefrontReturnsRouter.post(
  "/orders/:orderRef/returns",
  authMiddleware("customer"),
  validate({ params: OrderRef, body: CreateReturnDto }),
  send(async (r) => {
    const { orderRef } = r.params as unknown as z.infer<typeof OrderRef>;
    const o = await prisma.order.findFirst({
      where: { storeId: r.ctx.storeId, number: orderRef, customerId: r.ctx.customer?.id },
      select: { id: true },
    });
    if (!o) throw new NotFoundError("Order", orderRef);
    const created = await svc(r).createReturn(o.id, r.body as CreateReturnDto, "customer");
    return { code: created.code, status: created.status };
  }, 201),
);
