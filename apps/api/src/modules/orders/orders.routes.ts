import { Router } from "express";
import { authMiddleware, rbacMiddleware, validate } from "../../middleware";
import { ordersController } from "./orders.controller";
import type { Request, Response } from "express";
import { NotFoundError, ctrl, envelope, type RequestContext } from "../../core";
import { EmailService } from "../notifications";
import { InvoiceService, sendInvoice } from "../invoices";
import {
  OrderSearchQueryDto,
  CreateOrderFromCartDto,
  OrderIdParamDto,
  OrderNumberParamDto,
  TransitionStatusDto,
  CreateRefundDto,
  ExportOrdersDto,
  PaymentInitiateDto,
  PaymentConfirmDto,
  IpnProviderParamDto,
  CreateCartDto,
  AddCartItemDto,
  InvoiceIdsQueryDto,
} from "./orders.dto";

export const adminOrdersRouter = Router();

adminOrdersRouter.get(
  "/",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("orders.*"),
  validate({ query: OrderSearchQueryDto }),
  ordersController.listOrders,
);

adminOrdersRouter.post(
  "/",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("orders.*"),
  validate({ body: CreateOrderFromCartDto }),
  ordersController.createOrderFromCart,
);

/** Invoices for several orders in one PDF: ?ids=1,2,3 (up to 100). */
adminOrdersRouter.get(
  "/invoices",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("orders.*"),
  validate({ query: InvoiceIdsQueryDto }),
  ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const { ids } = req.query as unknown as { ids: bigint[] };
    sendInvoice(req, res, await InvoiceService.forContext(req.ctx).forOrderIds(ids));
  }),
);

adminOrdersRouter.get(
  "/:id",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("orders.*"),
  validate({ params: OrderIdParamDto }),
  ordersController.getOrderById,
);

adminOrdersRouter.get(
  "/number/:number",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("orders.*"),
  validate({ params: OrderNumberParamDto }),
  ordersController.getOrderByNumber,
);

adminOrdersRouter.post(
  "/:id/status",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("orders.*"),
  validate({ params: OrderIdParamDto, body: TransitionStatusDto }),
  ordersController.transitionStatus,
);

/** The order's invoice as a PDF (?download=1 to save it as a file). */
adminOrdersRouter.get(
  "/:id/invoice",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("orders.*"),
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
  rbacMiddleware("orders.*"),
  validate({ params: OrderIdParamDto }),
  ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const sent = await EmailService.forContext(req.ctx).orderPlaced(BigInt((req.params as { id: string }).id), "customer");
    if (!sent) throw new NotFoundError("order");
    envelope(res, { status: 200, message: "Order email sent", data: { success: true } });
  }),
);

adminOrdersRouter.post(
  "/:id/refunds",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("orders.*"),
  validate({ params: OrderIdParamDto, body: CreateRefundDto }),
  ordersController.createRefund,
);

adminOrdersRouter.get(
  "/:id/refunds",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("orders.*"),
  validate({ params: OrderIdParamDto }),
  ordersController.listRefunds,
);

adminOrdersRouter.post(
  "/export",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("orders.*"),
  validate({ body: ExportOrdersDto }),
  ordersController.exportOrders,
);

adminOrdersRouter.post(
  "/:id/payments",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("orders.*"),
  validate({ params: OrderIdParamDto, body: PaymentInitiateDto }),
  ordersController.initiatePayment,
);

adminOrdersRouter.post(
  "/payments/confirm",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("orders.*"),
  validate({ body: PaymentConfirmDto }),
  ordersController.confirmPayment,
);

adminOrdersRouter.get(
  "/dashboard/stats",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("orders.*"),
  ordersController.dashboardStats,
);

adminOrdersRouter.get(
  "/shipping-methods",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("orders.*"),
  ordersController.listShippingMethods,
);

export const adminPaymentsRouter = Router();

adminPaymentsRouter.get(
  "/",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("payments.*"),
  validate({ query: OrderSearchQueryDto }),
  ordersController.listOrders,
);

adminPaymentsRouter.post(
  "/offline-confirm",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("payments.*"),
  validate({ body: PaymentConfirmDto }),
  ordersController.confirmPayment,
);

export const checkoutRouter = Router();

checkoutRouter.post(
  "/from-cart",
  authMiddleware("optional"),
  validate({ body: CreateOrderFromCartDto }),
  ordersController.createOrderFromCart,
);

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
  "/payments/initiate",
  authMiddleware("optional"),
  validate({ body: PaymentInitiateDto }),
  ordersController.initiatePayment,
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

export const paymentIpnRouter = Router();

paymentIpnRouter.post(
  "/:provider",
  validate({ params: IpnProviderParamDto }),
  ordersController.ipnWebhook,
);
