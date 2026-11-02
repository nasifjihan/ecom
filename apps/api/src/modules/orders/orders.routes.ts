import { z } from "zod";
import { Router } from "express";
import { authMiddleware, rbacMiddleware, validate } from "../../middleware";
import { ordersController } from "./orders.controller";
import type { Request, Response } from "express";
import { BadRequestError, NotFoundError, ctrl, envelope, type RequestContext } from "../../core";
import { EmailService, inBackground } from "../notifications";
import { SmsService } from "../sms/sms.service";
import { prisma } from "../../config";
import { InvoiceService, sendInvoice } from "../invoices";
import { packingSlips } from "../invoices/packing-slip";

const storeOf = (req: Request & { ctx: RequestContext }): bigint => {
  if (req.ctx.storeId === undefined) throw new BadRequestError("Store not resolved", "TENANT_NOT_RESOLVED");
  return BigInt(req.ctx.storeId);
};
import {
  OrderSearchQueryDto,
  OrderIdParamDto,
  OrderNumberParamDto,
  TransitionStatusDto,
  ExportOrdersDto,
  CreateCartDto,
  AddCartItemDto,
  InvoiceIdsQueryDto,
} from "./orders.dto";
import { ManualOrderDto, ManualOrderQuoteDto, ManualOrderService } from "./manual-order";
import { EditOrderDto, OrderEditService } from "./order-edit";
import { publicLocations } from "../locations/locations.service";

export const adminOrdersRouter = Router();

adminOrdersRouter.get(
  "/",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("orders.view"),
  validate({ query: OrderSearchQueryDto }),
  ordersController.listOrders,
);

/** Manual orders (phone, Facebook, walk-in): price a draft, then create it. */
adminOrdersRouter.post(
  "/manual/quote",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("orders.create"),
  validate({ body: ManualOrderQuoteDto }),
  ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    envelope(res, { status: 200, data: await new ManualOrderService(req.ctx).quote(req.body as ManualOrderQuoteDto) });
  }),
);
const PickQuery = z.object({ search: z.string().max(80).default("") });
const PickVariantParams = z.object({ productId: z.coerce.bigint().positive() });
adminOrdersRouter.get(
  "/manual/products",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("orders.create"),
  validate({ query: PickQuery }),
  ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const { search } = req.query as unknown as z.infer<typeof PickQuery>;
    envelope(res, { status: 200, data: await new ManualOrderService(req.ctx).pickProducts(search) });
  }),
);
adminOrdersRouter.get(
  "/manual/products/:productId/variants",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("orders.create"),
  validate({ params: PickVariantParams }),
  ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const { productId } = req.params as unknown as z.infer<typeof PickVariantParams>;
    envelope(res, { status: 200, data: await new ManualOrderService(req.ctx).pickVariants(BigInt(productId)) });
  }),
);
adminOrdersRouter.get(
  "/manual/areas",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("orders.create"),
  ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    if (req.ctx.storeId === undefined) throw new NotFoundError("Store");
    // The areas the store delivers to (same list as the storefront's checkout).
    envelope(res, { status: 200, data: await publicLocations(req.ctx.storeId) });
  }),
);
adminOrdersRouter.get(
  "/manual/customers",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("orders.create"),
  validate({ query: PickQuery }),
  ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const { search } = req.query as unknown as z.infer<typeof PickQuery>;
    envelope(res, { status: 200, data: await new ManualOrderService(req.ctx).pickCustomers(search) });
  }),
);
adminOrdersRouter.post(
  "/manual",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("orders.create"),
  validate({ body: ManualOrderDto }),
  ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    envelope(res, { status: 201, data: await new ManualOrderService(req.ctx).create(req.body as ManualOrderDto) });
  }),
);

/** Invoices for several orders in one PDF: ?ids=1,2,3 (up to 100). */
adminOrdersRouter.get(
  "/invoices",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("orders.view"),
  validate({ query: InvoiceIdsQueryDto }),
  ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const { ids } = req.query as unknown as { ids: bigint[] };
    sendInvoice(req, res, await InvoiceService.forContext(req.ctx).forOrderIds(ids));
  }),
);

/** Packing slips for several orders in one PDF: ?ids=1,2,3 (gifts leave prices off if asked). */
adminOrdersRouter.get(
  "/packing-slips",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("orders.view"),
  validate({ query: InvoiceIdsQueryDto }),
  ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const { ids } = req.query as unknown as { ids: bigint[] };
    sendInvoice(req, res, { number: "", ...(await packingSlips(storeOf(req), ids)) });
  }),
);

adminOrdersRouter.get(
  "/:id/packing-slip",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("orders.view"),
  validate({ params: OrderIdParamDto }),
  ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    sendInvoice(req, res, { number: "", ...(await packingSlips(storeOf(req), [BigInt((req.params as { id: string }).id)])) });
  }),
);

adminOrdersRouter.get(
  "/:id",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("orders.view"),
  validate({ params: OrderIdParamDto }),
  ordersController.getOrderById,
);

adminOrdersRouter.get(
  "/number/:number",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("orders.view"),
  validate({ params: OrderNumberParamDto }),
  ordersController.getOrderByNumber,
);

adminOrdersRouter.post(
  "/:id/status",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("orders.edit"),
  validate({ params: OrderIdParamDto, body: TransitionStatusDto }),
  ordersController.transitionStatus,
);

/** Change the address, items or delivery charge before a parcel is packed (modules/orders/order-edit). */
adminOrdersRouter.put(
  "/:id/edit",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("orders.edit"),
  validate({ params: OrderIdParamDto, body: EditOrderDto }),
  ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const r = await new OrderEditService(req.ctx).edit(BigInt((req.params as { id: string }).id), req.body as EditOrderDto);
    envelope(res, { status: 200, data: r, message: "Order updated" });
  }),
);

/** The order's invoice as a PDF (?download=1 to save it as a file). */
adminOrdersRouter.get(
  "/:id/invoice",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("orders.view"),
  validate({ params: OrderIdParamDto }),
  ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const file = await InvoiceService.forContext(req.ctx).forOrderId(BigInt((req.params as { id: string }).id));
    sendInvoice(req, res, file);
  }),
);

/** Sends the order confirmation email to the customer again (the order page's "Send email" button). */
adminOrdersRouter.post(
  "/:id/send-email",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("orders.edit"),
  validate({ params: OrderIdParamDto }),
  ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const sent = await EmailService.forContext(req.ctx).orderPlaced(BigInt((req.params as { id: string }).id), "customer");
    if (!sent) throw new NotFoundError("order");
    envelope(res, { status: 200, message: "Order email sent", data: { success: true } });
  }),
);

// Refunds, parcels and returns: modules/fulfilment (mounted on /api/admin/orders before this router).

adminOrdersRouter.post(
  "/export",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("orders.view"),
  validate({ body: ExportOrdersDto }),
  ordersController.exportOrders,
);

adminOrdersRouter.get(
  "/dashboard/stats",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("orders.view"),
  ordersController.dashboardStats,
);

adminOrdersRouter.get(
  "/shipping-methods",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("orders.view"),
  ordersController.listShippingMethods,
);

export const checkoutRouter = Router();

checkoutRouter.get(
  "/my-orders",
  authMiddleware("customer"),
  ordersController.listCustomerOrders,
);

checkoutRouter.post(
  "/my-orders/:id/cancel",
  authMiddleware("customer"),
  validate({ params: OrderIdParamDto }),
  ordersController.cancelMyOrder,
);

checkoutRouter.post(
  "/carts",
  authMiddleware("optional"),
  validate({ body: CreateCartDto }),
  ordersController.createCart,
);

checkoutRouter.post(
  "/carts/:cartId/items",
  authMiddleware("optional"),
  validate({ body: AddCartItemDto }),
  ordersController.addItemToCart,
);

/** A pickup order is ready to collect: noted on the order, and the customer gets an email and SMS. */
adminOrdersRouter.post(
  "/:id/ready-for-pickup",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("orders.edit"),
  validate({ params: z.object({ id: z.coerce.bigint().positive() }) }),
  ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const storeId = storeOf(req);
    const id = (req.params as unknown as { id: bigint }).id;
    const o = await prisma.order.findFirst({ where: { id, storeId }, select: { status: true, shippingMethodCode: true } });
    if (!o) throw new NotFoundError("Order", id);
    if (o.shippingMethodCode !== "pickup") throw new BadRequestError("This order is delivered, not picked up", "VALIDATION_FAILED");
    if (["CANCELLED", "REFUNDED", "FAILED", "DELIVERED", "COMPLETED"].includes(o.status))
      throw new BadRequestError("This order is already closed", "VALIDATION_FAILED");
    const readyAt = new Date();
    await prisma.$transaction([
      prisma.order.update({ where: { id }, data: { readyForPickupAt: readyAt } }),
      prisma.orderStatusLog.create({ data: { orderId: id, status: o.status, note: "Ready to pick up (customer told)", notifyCustomer: true, adminId: req.ctx.admin?.id ?? null } }),
    ]);
    inBackground("pickup ready email", () => new EmailService(storeId).orderReadyForPickup(id));
    void new SmsService(storeId).orderEvent(id, "pickup_ready").catch(() => undefined);
    envelope(res, { data: { readyForPickupAt: readyAt.toISOString() }, message: "Customer told the order is ready" });
  }),
);
