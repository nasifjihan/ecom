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
  checkoutRouter,
  paymentIpnRouter,
} from "./modules/orders";
import { adminCustomersRouter, customerSelfRouter } from "./modules/customers";
import { adminInventoryRouter } from "./modules/inventory";
import { adminOrderSmsRouter, adminSmsRouter, registerSmsListeners } from "./modules/sms";
import { adminPurchasingRouter } from "./modules/purchasing";
import { adminReportsRouter } from "./modules/reports";
import { adminWarehousesRouter } from "./modules/stock";
import { adminStorefrontsRouter } from "./modules/storefronts";
import { adminSalesRouter } from "./modules/sales";
import { adminRedirectsRouter, storefrontRedirectsRouter } from "./modules/redirects";
import { adminQuotationsRouter, adminWholesaleRouter, storefrontQuotesRouter, storefrontWholesaleRouter } from "./modules/wholesale";
import { adminLoyaltyRouter, storefrontLoyaltyRouter } from "./modules/loyalty";
import { adminPromotionsRouter, adminQuestionsRouter, adminSearchTermsRouter, marketingCouponsRouter, marketingFlashSalesRouter, marketingReviewsRouter, storefrontPromotionsRouter } from "./modules/marketing";
import { superDashboardRouter, storeDashboardRouter } from "./modules/dashboard";
import { superPlatformRouter } from "./modules/platform";
import { adminSettingsRouter } from "./modules/settings/settings.routes";
import { adminShippingRouter, storefrontShippingRouter } from "./modules/shipping";
import { storefrontCatalogRouter, storefrontCheckoutRouter, storefrontAccountRouter, storefrontEngagementRouter, storefrontWishlistRouter } from "./modules/storefront";
import { adminContentRouter, storefrontContentRouter } from "./modules/content";
import { adminEmailsRouter, registerEmailListeners } from "./modules/notifications";
import { adminLocationsRouter, storefrontLocationsRouter } from "./modules/locations";
import { adminOrderFulfilmentRouter, adminReturnsRouter, adminShipmentsRouter, storefrontReturnsRouter } from "./modules/fulfilment";
import { adminCouriersRouter, adminOrderCourierRouter, adminShipmentCourierRouter, courierWebhooksRouter } from "./modules/couriers";
import {
  adminCodRouter,
  adminOrderPaymentsRouter,
  adminPaymentMethodsRouter,
  adminPaymentRecordsRouter,
  storefrontAccountPaymentsRouter,
  storefrontCheckoutPaymentsRouter,
} from "./modules/payments";
import { adminAuditRouter, adminPermissionsRouter, adminStaffRouter, adminTeamRolesRouter, auditMiddleware } from "./modules/team";
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

  // Order and account events turn into queued emails.
  registerEmailListeners();
  registerSmsListeners();

  // =============== MODULE ROUTES (Batch #5 wired) ===============
  app.use("/api/auth", authRoutes);
  app.use("/api/super", superPlatformRouter);                      // overview, plans, subscriptions, reports, audit logs
  app.use("/api/super/stores", superStoresRouter);
  app.use("/api/super/domains", superDomainsRouter);
  app.use("/api/super/admin-users", superAdminUsersRouter);
  app.use("/api/super/roles", superRolesRouter);
  app.use("/api/store", storeSelfRouter);
  // Every successful change through the store admin API goes into the activity log.
  app.use("/api/admin", auditMiddleware);
  app.use("/api/admin/permissions", adminPermissionsRouter);
  app.use("/api/admin/roles", adminTeamRolesRouter);                // roles and their permissions
  app.use("/api/admin/staff", adminStaffRouter);                    // staff accounts
  app.use("/api/admin/audit-logs", adminAuditRouter);               // activity log
  app.use("/api/admin/products", adminProductsRouter);
  app.use("/api/admin/categories", adminCategoriesRouter);
  app.use("/api/admin/brands", adminBrandsRouter);
  app.use("/api/admin/attributes", adminAttributesRouter);
  app.use("/api/admin/media", productUploadRouter);
  app.use("/api/admin/orders", adminOrderSmsRouter);                // SMS of an order, invoice by SMS
  app.use("/api/admin/orders", adminOrderCourierRouter);            // book many orders with a courier
  app.use("/api/admin/orders", adminOrderPaymentsRouter);           // payments of an order
  app.use("/api/admin/orders", adminOrderFulfilmentRouter);         // parcels, returns, refunds of an order
  app.use("/api/admin/shipments", adminShipmentCourierRouter);     // book, sync, labels
  app.use("/api/admin/shipments", adminShipmentsRouter);
  app.use("/api/admin/couriers", adminCouriersRouter);              // Steadfast / Pathao / RedX accounts
  app.use("/api/admin/returns", adminReturnsRouter);
  app.use("/api/admin/orders", adminOrdersRouter);
  app.use("/api/admin/payments", adminPaymentRecordsRouter);       // transfers to verify, COD cash
  app.use("/api/admin/cod", adminCodRouter);                        // cash collections, courier payouts
  app.use("/api/admin/payment-methods", adminPaymentMethodsRouter);
  app.use("/api/storefront/checkout", storefrontCheckoutPaymentsRouter);
  app.use("/api/storefront/checkout", storefrontCheckoutRouter); // Batch #10: POST / , /coupons/apply, GET /orders/:orderKey
  app.use("/api/storefront/checkout", checkoutRouter);
  app.use("/api/payments/ipn", paymentIpnRouter);
  app.use("/api/webhooks/couriers", courierWebhooksRouter);        // courier status webhooks
  app.use("/api/admin/customers", adminCustomersRouter);
  app.use("/api/storefront/account", storefrontAccountPaymentsRouter);
  app.use("/api/storefront/account", storefrontReturnsRouter);
  app.use("/api/storefront/account", storefrontWishlistRouter);
  app.use("/api/storefront/account", storefrontLoyaltyRouter);          // wallet, level, refer a friend
  app.use("/api/storefront/account", storefrontQuotesRouter);           // my quotes, ask for one, accept / decline
  app.use("/api/storefront/account", storefrontAccountRouter);
  app.use("/api/storefront/account", customerSelfRouter);
  app.use("/api/admin/inventory", adminInventoryRouter);
  app.use("/api/admin/marketing/promotions", adminPromotionsRouter);
  app.use("/api/admin/sms", adminSmsRouter);
  app.use("/api/admin/loyalty", adminLoyaltyRouter);                  // wallet, cashback, levels, referrals
  app.use("/api/admin/warehouses", adminWarehousesRouter);            // warehouses, stock per warehouse, transfers, order ship-from
  app.use("/api/admin/storefronts", adminStorefrontsRouter);          // storefronts, their web addresses, product range and prices
  app.use("/api/admin/quotations", adminQuotationsRouter);            // price quotes to customers
  app.use("/api/admin/sales", adminSalesRouter);                      // sales team: commission, targets, payouts
  app.use("/api/admin/redirects", adminRedirectsRouter);              // old addresses sent to new ones; broken links
  app.use("/api/storefront/redirects", storefrontRedirectsRouter);    // the list the storefront middleware uses; hits; not-found log
  app.use("/api/admin/wholesale", adminWholesaleRouter);              // business accounts, bulk prices, pricing by margin
  app.use("/api/storefront/wholesale", storefrontWholesaleRouter);    // apply for a business account, bulk prices on a product
  app.use("/api/admin/reports", adminReportsRouter);                  // sales and profit, products, discounts, customers, couriers, returns, tax, stock value
  app.use("/api/admin/purchasing", adminPurchasingRouter);            // suppliers, purchases, supplier payments, money accounts
  app.use("/api/admin/marketing/coupons", marketingCouponsRouter);
  app.use("/api/admin/marketing/flash-sales", marketingFlashSalesRouter);
  app.use("/api/admin/marketing/reviews", marketingReviewsRouter);
  app.use("/api/admin/marketing/questions", adminQuestionsRouter);
  app.use("/api/admin/marketing/search-terms", adminSearchTermsRouter);
  app.use("/api/super/dashboard", superDashboardRouter);
  app.use("/api/admin/dashboard", storeDashboardRouter);
  app.use("/api/admin/settings", adminSettingsRouter);
  app.use("/api/admin/shipping", adminShippingRouter);
  app.use("/api/storefront/shipping", storefrontShippingRouter);
  app.use("/api/admin/locations", adminLocationsRouter);             // BD divisions/districts/upazilas + delivery on/off
  app.use("/api/storefront/locations", storefrontLocationsRouter);
  app.use("/api/admin/emails", adminEmailsRouter);                   // email templates, preview, test send, sent log
  app.use("/api/admin/content", adminContentRouter);                 // pages, blog, FAQs, menus, theme, homepage
  app.use("/api/storefront/content", storefrontContentRouter);
  app.use("/api/storefront/promotions", storefrontPromotionsRouter);
  app.use("/api/storefront", storefrontEngagementRouter);           // search suggestions, tracking, flash-sale page, reviews, questions
  app.use("/api/storefront", storefrontCatalogRouter);             // Batch #10: public catalog
  app.use("/uploads", express.static(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "uploads"), { maxAge: "1y", immutable: true }));

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
