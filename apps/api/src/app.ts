/**
 * EXPRESS APP FACTORY.
 * Middleware applied in the EXACT documented order (01 → 14).
 * Routes mounted after body parsers / tenant resolvers,
 * BEFORE globalErrorHandler (which MUST be last).
 */
import express, { type Request, type Response, type Express } from "express";
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

let _app: Express | null = null;

export function buildApp(): Express {
  if (_app) return _app;
  const app = express();
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

  // =============== MODULE ROUTES (mounted here as we build modules) ===============
  // Modules added in later batches are mounted via `registerRoutes(app)`.
  // Example:
  //   import authRoutes from "../modules/auth/routes";
  //   app.use("/api/admin/auth", authRoutes);
  // For now, NO real routes → every unknown path will hit the 404 below.

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
