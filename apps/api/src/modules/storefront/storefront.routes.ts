/**
 * PUBLIC STOREFRONT ROUTES (Batch #10).
 * Paths match what storefront-base's RTK slices call (baseUrl = /api):
 *   GET  /api/storefront/products, /products/:slug, /categories/tree, /brands
 *   POST /api/storefront/checkout, /checkout/coupons/apply
 *   GET  /api/storefront/checkout/payment-methods    (enabled gateways)
 *   GET  /api/storefront/checkout/orders/:orderKey   (thank-you page)
 * No login required; the store comes from the request origin (10-tenant.ts).
 */
import { Router } from "express";
import { authMiddleware, validate } from "../../middleware";
import { storefrontController } from "./storefront.controller";
import {
  StorefrontProductsQueryDto,
  StorefrontSlugParamDto,
  StorefrontOrderKeyParamDto,
  ApplyCouponDto,
  PlaceOrderDto,
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
