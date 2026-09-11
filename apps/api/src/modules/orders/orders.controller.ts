import type { Request, Response } from "express";
import { envelope, ctrl, BaseController, type RequestContext, NotFoundError, ConflictError, BadRequestError } from "../../core";
import { OrdersService } from "./orders.service";
import type {
  CreateOrderFromCartDto as CreateOrderFromCartDtoType,
  TransitionStatusDto as TransitionStatusDtoType,
  OrderSearchQueryDto as OrderSearchQueryDtoType,
  OrderIdParamDto as OrderIdParamDtoType,
  OrderNumberParamDto as OrderNumberParamDtoType,
  CreateRefundDto as CreateRefundDtoType,
  PaymentInitiateDto as PaymentInitiateDtoType,
  PaymentConfirmDto as PaymentConfirmDtoType,
  IpnProviderParamDto as IpnProviderParamDtoType,
  CreateCartDto as CreateCartDtoType,
  AddCartItemDto as AddCartItemDtoType,
  ExportOrdersDto as ExportOrdersDtoType,
} from "./orders.dto";

class OrdersController extends BaseController {
  private getService(ctx: RequestContext): OrdersService {
    return new OrdersService(ctx);
  }

  createOrderFromCart = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const dto = req.body as CreateOrderFromCartDtoType;
    const result = await svc.createOrderFromCart(dto);
    envelope(res, { status: 201, data: result, message: "Order created" });
  });

  transitionStatus = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const params = req.params as unknown as OrderIdParamDtoType;
    const dto = req.body as TransitionStatusDtoType;
    const order = await svc.transitionStatus(params.id, dto);
    envelope(res, { status: 200, data: order, message: "Order status updated" });
  });

  listOrders = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const filters = req.query as unknown as OrderSearchQueryDtoType;
    const result = await svc.listOrders(filters);
    envelope(res, { status: 200, data: result.data, meta: result.meta });
  });

  getOrderById = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const params = req.params as unknown as OrderIdParamDtoType;
    const order = await svc.getOrderById(params.id);
    envelope(res, { status: 200, data: order });
  });

  getOrderByNumber = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const params = req.params as unknown as OrderNumberParamDtoType;
    const order = await svc.getOrderByNumber(params.number);
    envelope(res, { status: 200, data: order });
  });

  createRefund = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const dto = req.body as CreateRefundDtoType;
    const refund = await svc.createRefund(dto);
    envelope(res, { status: 201, data: refund, message: "Refund created" });
  });

  listRefunds = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const params = req.params as unknown as OrderIdParamDtoType;
    const oid = BigInt(params.id);
    const refunds = await (svc as any).refunds.listForOrder(oid, req.ctx);
    envelope(res, { status: 200, data: refunds });
  });

  initiatePayment = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const params = req.params as unknown as OrderIdParamDtoType;
    const dto = req.body as PaymentInitiateDtoType;
    const order = await svc.getOrderById(params.id);
    const result = await svc.initiatePayment(dto, order);
    envelope(res, { status: 200, data: result });
  });

  confirmPayment = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const dto = req.body as PaymentConfirmDtoType;
    const result = await svc.confirmPayment(dto);
    envelope(res, { status: 200, data: result, message: "Payment confirmed" });
  });

  ipnWebhook = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const params = req.params as unknown as IpnProviderParamDtoType;
    const rawBody = (req as any).rawBody ?? Buffer.from(JSON.stringify(req.body)).toString("utf8");
    const headers = req.headers as Record<string, string | string[] | undefined>;
    const query = req.query as Record<string, unknown>;
    const result = await svc.parsePaymentIpn(params.provider as any, headers, rawBody, query);
    envelope(res, { status: 200, data: result });
  });

  listCarts = ctrl(async (_req: Request & { ctx: RequestContext }, res: Response) => {
    envelope(res, { status: 200, data: [], meta: { page: 1, perPage: 20, total: 0 } });
  });

  createCart = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const dto = req.body as CreateCartDtoType;
    const cart = await svc.createGuestCart(dto as any);
    envelope(res, { status: 201, data: cart, message: "Cart created" });
  });

  addItemToCart = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const params = req.params as { cartId: string };
    const body = req.body as AddCartItemDtoType;
    const cartId = BigInt(params.cartId);
    const result = await svc.addCartItem(
      cartId,
      body.productId,
      body.variantId ?? null,
      body.quantity,
      body.unitPrice ?? undefined,
    );
    envelope(res, { status: 200, data: result, message: "Cart item updated" });
  });

  listCustomerOrders = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    if (!req.ctx.customer?.id) {
      throw new BadRequestError("Customer context required", "BAD_REQUEST");
    }
    const filters = req.query as unknown as OrderSearchQueryDtoType;
    const result = await svc.customerScopedGetMyOrders(req.ctx.customer.id, filters);
    envelope(res, { status: 200, data: result.data, meta: result.meta });
  });

  cancelMyOrder = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    if (!req.ctx.customer?.id) {
      throw new BadRequestError("Customer context required", "BAD_REQUEST");
    }
    const params = req.params as unknown as OrderIdParamDtoType;
    const order = await svc.getOrderById(params.id);
    const orderStatus = (order as any).status as string;
    const orderCustomerId = (order as any).customerId;
    if (orderCustomerId && BigInt(orderCustomerId) !== BigInt(req.ctx.customer.id)) {
      throw new NotFoundError("order", params.id);
    }
    if (orderStatus !== "PENDING" && orderStatus !== "PROCESSING") {
      throw new ConflictError(
        `Cannot cancel order with status ${orderStatus}`,
        "ORDER_CANNOT_CANCEL",
      );
    }
    const updated = await svc.transitionStatus(params.id, {
      newStatus: "CANCELLED",
      note: "Cancelled by customer",
      notifyCustomer: true,
    } as any);
    envelope(res, { status: 200, data: updated, message: "Order cancelled" });
  });

  dashboardStats = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const filters = req.query as unknown as {
      status?: string[];
      paymentStatus?: string[];
      dateFrom?: Date;
      dateTo?: Date;
    };
    const stats = await svc.aggregateStats(filters);
    envelope(res, { status: 200, data: stats });
  });

  exportOrders = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const dto = req.body as ExportOrdersDtoType;
    const result = await svc.exportOrders(dto.format, dto);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${result.filename}"`,
    );
    envelope(res, { status: 200, data: result, message: "Export generated" });
  });

  listShippingMethods = ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    const svc = this.getService(req.ctx);
    const countryCode = (req.query.countryCode as string) ?? "BD";
    const state = (req.query.state as string) ?? null;
    const postcode = (req.query.postcode as string) ?? null;
    const zone = await (svc as any).shipping.matchZoneByAddress(countryCode, state, postcode, req.ctx);
    let methods: unknown[] = [];
    if (zone) {
      methods = await (svc as any).shipping.methodsForZone((zone as any).id);
    }
    envelope(res, { status: 200, data: methods });
  });
}

export const ordersController = new OrdersController();
