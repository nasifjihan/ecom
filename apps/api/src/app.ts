/**
 * EXPRESS APP FACTORY.
 * Middleware applied in the EXACT documented order (01 → 14).
 * Routes mounted after body parsers / tenant resolvers,
 * BEFORE globalErrorHandler (which MUST be last).
 */
import express, { type Request, type Response, type Express } from "express";
import { fileURLToPath } from "node:url";
import {
  requestIdMiddleware,
  loggerMiddleware,
  helmetMiddleware,
  corsMiddleware,
  hppMiddleware,
  compressionMiddleware,
  cookieParserMiddleware,
  bodyParserMiddleware,
  rateLimitMiddleware,
  tenantMiddleware,
  globalErrorHandler,
} from "./middleware";
import { NotFoundError, envelope, ctrl } from "./core";
import { env } from "./config";
import { authRoutes } from "./modules/auth";
import {
  superStoresRouter,
  superDomainsRouter,
  storeSelfRouter,
} from "./modules/stores";
import {
  adminUsersRouter,
  adminRolesRouter,
  superAdminUsersRouter,
  superRolesRouter,
} from "./modules/admin-users";
import {
  adminProductsRouter,
  adminCategoriesRouter,
  adminBrandsRouter,
  adminAttributesRouter,
  productUploadRouter,
} from "./modules/catalog";
import {
  adminOrdersRouter,
  adminPaymentsRouter,
  checkoutRouter,
  paymentIpnRouter,
} from "./modules/orders";
import { adminCustomersRouter, customerSelfRouter } from "./modules/customers";
import { adminInventoryRouter } from "./modules/inventory";
import { marketingCouponsRouter, marketingFlashSalesRouter, marketingReviewsRouter } from "./modules/marketing";
import { superDashboardRouter, storeDashboardRouter } from "./modules/dashboard";
import { superPlatformRouter } from "./modules/platform";
import { adminShippingRouter, storefrontShippingRouter } from "./modules/shipping";
import { storefrontCatalogRouter, storefrontCheckoutRouter } from "./modules/storefront";
import path from "node:path";

let _app: Express | null = null;

export function buildApp(): Express {
  if (_app) return _app;
  const app = express();
  // Prisma returns BigInt ids; JSON.stringify throws on BigInt, so emit them as strings.
  // Credential columns are dropped from every response, whichever query returned the row.
  const SECRET_KEYS = new Set(["passwordHash", "twoFactorSecret"]);
  app.set("json replacer", (key: string, value: unknown) => {
    if (SECRET_KEYS.has(key)) return undefined;
    return typeof value === "bigint" ? value.toString() : value;
  });
  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  /* ======================================================================
   *  ORDER MATTERS! Add new middleware ONLY in the numbered ranges below.
   * ====================================================================== */

  // 01-09: Infrastructure middleware
  app.use(requestIdMiddleware);       // 01 — requestId FIRST (used by all downstream)
  app.use(loggerMiddleware);          // 02
  app.use(helmetMiddleware);          // 03
  app.use(corsMiddleware);            // 04
  app.use(hppMiddleware);             // 05
  app.use(compressionMiddleware);     // 06
  app.use(cookieParserMiddleware);    // 07
  app.use(bodyParserMiddleware);      // 08 — must parse BEFORE routes
  app.use(rateLimitMiddleware);       // 09 — after body so we can limit per-user if logged in

  // ----- Tenant resolver (before routes) -----
  app.use(tenantMiddleware);          // 10

  // =============== HEALTH / PUBLIC ===============
  app.get(
    "/healthz",
    ctrl(async (_req: Request & { ctx: any }, res: Response) => {
      envelope(res, {
        data: { ok: true, env: env.NODE_ENV, uptimeMs: Math.trunc(process.uptime() * 1000) },
      });
    }),
  );
  app.get("/", ctrl(async (_req: Request & { ctx: any }, res: Response) => {
    envelope(res, { message: "E-Commerce Platform API — see /healthz", data: { version: "0.1.0" } });
  }));

  // =============== MODULE ROUTES (Batch #5 wired) ===============
  app.use("/api/auth", authRoutes);
  app.use("/api/super", superPlatformRouter);                      // overview, plans, subscriptions, reports, audit logs
  app.use("/api/super/stores", superStoresRouter);
  app.use("/api/super/domains", superDomainsRouter);
  app.use("/api/super/admin-users", superAdminUsersRouter);
  app.use("/api/super/roles", superRolesRouter);
  app.use("/api/store", storeSelfRouter);
  app.use("/api/admin/users", adminUsersRouter);
  app.use("/api/admin/roles", adminRolesRouter);
  app.use("/api/admin/products", adminProductsRouter);
  app.use("/api/admin/categories", adminCategoriesRouter);
  app.use("/api/admin/brands", adminBrandsRouter);
  app.use("/api/admin/attributes", adminAttributesRouter);
  app.use("/api/admin/media", productUploadRouter);
  app.use("/api/admin/orders", adminOrdersRouter);
  app.use("/api/admin/payments", adminPaymentsRouter);
  app.use("/api/storefront/checkout", storefrontCheckoutRouter); // Batch #10: POST / , /coupons/apply, GET /orders/:orderKey
  app.use("/api/storefront/checkout", checkoutRouter);
  app.use("/api/payments/ipn", paymentIpnRouter);
  app.use("/api/admin/customers", adminCustomersRouter);
  app.use("/api/storefront/account", customerSelfRouter);
  app.use("/api/admin/inventory", adminInventoryRouter);
  app.use("/api/admin/marketing/coupons", marketingCouponsRouter);
  app.use("/api/admin/marketing/flash-sales", marketingFlashSalesRouter);
  app.use("/api/admin/marketing/reviews", marketingReviewsRouter);
  app.use("/api/super/dashboard", superDashboardRouter);
  app.use("/api/admin/dashboard", storeDashboardRouter);
  app.use("/api/admin/shipping", adminShippingRouter);
  app.use("/api/storefront/shipping", storefrontShippingRouter);
  app.use("/api/storefront", storefrontCatalogRouter);             // Batch #10: public catalog
  app.use("/uploads", express.static(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "uploads"), { maxAge: "1y", immutable: true }));

  // =============== 404 catch-all ===============
  app.all(
    "*",
    ctrl(async (req: Request & { ctx: any }) => {
      throw new NotFoundError(`${req.method} ${req.path}`);
    }),
  );

  // =============== GLOBAL ERROR (MUST BE LAST) ===============
  app.use(globalErrorHandler);         // 14

  _app = app;
  return _app;
}
