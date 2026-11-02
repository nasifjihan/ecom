/**
 * PUBLIC STOREFRONT ROUTES (Batch #10).
 * Paths match what storefront-base's RTK slices call (baseUrl = /api):
 *   GET  /api/storefront/products, /products/:slug, /categories/tree, /brands
 *   POST /api/storefront/checkout, /checkout/coupons/apply, /checkout/cart/prices
 *   GET  /api/storefront/checkout/payment-methods    (enabled gateways)
 *   GET  /api/storefront/checkout/orders/:orderKey   (thank-you page)
 *   GET  /api/storefront/account/coupons   my coupons: usable now (uses left) and used on past orders
 *   GET  /api/storefront/checkout/orders/:orderKey/invoice, /account/orders/:orderRef/invoice   (PDF)
 * No login required; the store comes from the request origin (10-tenant.ts).
 */
import { Router, type Request, type Response } from "express";
import { UnauthorizedError, ctrl, envelope, type RequestContext } from "../../core";
import { InvoiceService, sendInvoice } from "../invoices";
import { authMiddleware, validate, idempotent } from "../../middleware";
import { storefrontController } from "./storefront.controller";
import { MAX_SAVED_LINES, SavedCarts } from "./saved-cart";
import { z } from "zod";
import {
  StorefrontProductsQueryDto,
  StorefrontSlugParamDto,
  StorefrontOrderKeyParamDto,
  ApplyCouponDto,
  CartPricesDto,
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

// Size, colour… filters for the same list (its own path so "/products/:slug" can't take it).
storefrontCatalogRouter.get(
  "/product-options",
  validate({ query: StorefrontProductsQueryDto }),
  storefrontController.productOptions,
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
  idempotent("checkout"),
  storefrontController.placeOrder,
);

storefrontCheckoutRouter.post(
  "/cart/prices",
  authMiddleware("optional"),
  validate({ body: CartPricesDto }),
  storefrontController.cartPrices,
);

storefrontCheckoutRouter.post(
  "/coupons/apply",
  validate({ body: ApplyCouponDto }),
  storefrontController.applyCoupon,
);

storefrontCheckoutRouter.get("/coupons/available", authMiddleware("optional"), storefrontController.availableCoupons);

storefrontCheckoutRouter.get("/payment-methods", storefrontController.paymentMethods);
storefrontCheckoutRouter.get("/delivery-choices", storefrontController.deliveryChoices);

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

storefrontAccountRouter.get("/coupons", storefrontController.myCoupons);
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

/**
 * Mounted at /api/storefront/cart: the cart kept on the server (signed in, or a guest who typed a
 * phone or email at checkout), the reminder link back to it, and "no more reminders".
 */
export const storefrontCartRouter = Router();
storefrontCartRouter.use(authMiddleware("optional"));
const SavedLineDto = z.object({ productId: z.coerce.bigint().positive(), variantId: z.coerce.bigint().positive().optional().nullable(), qty: z.coerce.number().int().min(1).max(100) });
const CartToken = z.string().regex(/^cart_[\w-]{10,40}$/);
const SaveCartDto = z.object({
  token: CartToken.optional().nullable(),
  items: z.array(SavedLineDto).max(MAX_SAVED_LINES),
  contact: z.object({ phone: z.string().max(20).optional().nullable(), email: z.string().max(254).optional().nullable(), firstName: z.string().max(80).optional().nullable() }).optional(),
});
const lineOf = (l: z.infer<typeof SavedLineDto>) => ({ productId: l.productId, variantId: l.variantId ?? null, qty: l.qty });
const carts = (req: Req) => new SavedCarts(req.ctx);

storefrontCartRouter.get(
  "/",
  validate({ query: z.object({ token: CartToken.optional() }) }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await carts(req).load((req.query as { token?: string }).token) });
  }),
);
storefrontCartRouter.put(
  "/",
  validate({ body: SaveCartDto }),
  ctrl(async (req: Req, res: Response) => {
    const b = req.body as z.infer<typeof SaveCartDto>;
    envelope(res, { data: await carts(req).save({ token: b.token, lines: b.items.map(lineOf), contact: b.contact }) });
  }),
);
/** After signing in: the account's saved cart joined with the one in this browser. */
storefrontCartRouter.post(
  "/join",
  validate({ body: SaveCartDto.pick({ token: true, items: true }) }),
  ctrl(async (req: Req, res: Response) => {
    const b = req.body as z.infer<typeof SaveCartDto>;
    envelope(res, { data: await carts(req).join(b.token, b.items.map(lineOf)) });
  }),
);
const RecoveryParam = z.object({ recoveryToken: z.string().regex(/^[\w-]{16,64}$/) });
storefrontCartRouter.get(
  "/recover/:recoveryToken",
  validate({ params: RecoveryParam }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await carts(req).recover((req.params as { recoveryToken: string }).recoveryToken) });
  }),
);
storefrontCartRouter.post(
  "/unsubscribe/:recoveryToken",
  validate({ params: RecoveryParam }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await carts(req).unsubscribe((req.params as { recoveryToken: string }).recoveryToken) });
  }),
);
