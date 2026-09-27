/**
 * PUBLIC STOREFRONT ROUTES (Batch #10).
 * Paths match what storefront-base's RTK slices call (baseUrl = /api):
 *   GET  /api/storefront/products, /products/:slug, /categories/tree, /brands
 *   POST /api/storefront/checkout, /checkout/coupons/apply
 *   GET  /api/storefront/checkout/payment-methods    (enabled gateways)
 *   GET  /api/storefront/checkout/orders/:orderKey   (thank-you page)
 *   GET  /api/storefront/checkout/orders/:orderKey/invoice, /account/orders/:orderRef/invoice   (PDF)
 * No login required; the store comes from the request origin (10-tenant.ts).
 */
import { Router, type Request, type Response } from "express";
import { UnauthorizedError, ctrl, type RequestContext } from "../../core";
import { InvoiceService, sendInvoice } from "../invoices";
import { authMiddleware, validate } from "../../middleware";
import { storefrontController } from "./storefront.controller";
import {
  StorefrontProductsQueryDto,
  StorefrontSlugParamDto,
  StorefrontOrderKeyParamDto,
  ApplyCouponDto,
  PlaceOrderDto,
  MyOrdersQueryDto,
  OrderRefParamDto,
} from "./storefront.dto";

export const storefrontCatalogRouter = Router();

storefrontCatalogRouter.get(
  "/products",
  validate({ query: StorefrontProductsQueryDto }),
  storefrontController.listProducts,
);

storefrontCatalogRouter.get(
  "/products/:slug",
  validate({ params: StorefrontSlugParamDto }),
  storefrontController.getProductBySlug,
);

storefrontCatalogRouter.get("/categories/tree", storefrontController.categoriesTree);

storefrontCatalogRouter.get("/brands", storefrontController.brands);

export const storefrontCheckoutRouter = Router();

storefrontCheckoutRouter.post(
  "/",
  authMiddleware("optional"),
  validate({ body: PlaceOrderDto }),
  storefrontController.placeOrder,
);

storefrontCheckoutRouter.post(
  "/coupons/apply",
  validate({ body: ApplyCouponDto }),
  storefrontController.applyCoupon,
);

storefrontCheckoutRouter.get("/payment-methods", storefrontController.paymentMethods);

storefrontCheckoutRouter.get(
  "/orders/:orderKey",
  validate({ params: StorefrontOrderKeyParamDto }),
  storefrontController.getOrderByKey,
);

type Req = Request & { ctx: RequestContext };
const invoices = (req: Req) => InvoiceService.forContext(req.ctx);

storefrontCheckoutRouter.get(
  "/orders/:orderKey/invoice",
  validate({ params: StorefrontOrderKeyParamDto }),
  ctrl(async (req: Req, res: Response) => {
    sendInvoice(req, res, await invoices(req).forOrderKey((req.params as { orderKey: string }).orderKey));
  }),
);

/** Mounted at /api/storefront/account next to the profile routes: the signed-in customer's orders. */
export const storefrontAccountRouter = Router();
storefrontAccountRouter.use(authMiddleware("customer"));

storefrontAccountRouter.get("/orders", validate({ query: MyOrdersQueryDto }), storefrontController.listMyOrders);
storefrontAccountRouter.get("/orders/:orderRef", validate({ params: OrderRefParamDto }), storefrontController.getMyOrder);
storefrontAccountRouter.post("/orders/:orderRef/cancel", validate({ params: OrderRefParamDto }), storefrontController.cancelMyOrder);
storefrontAccountRouter.get(
  "/orders/:orderRef/invoice",
  validate({ params: OrderRefParamDto }),
  ctrl(async (req: Req, res: Response) => {
    const customer = req.ctx.customer;
    if (!customer) throw new UnauthorizedError("Please sign in");
    const file = await invoices(req).forCustomer(customer.id, (req.params as { orderRef: string }).orderRef);
    sendInvoice(req, res, file);
  }),
);
