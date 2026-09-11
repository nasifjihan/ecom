/**
 * 10 — TENANT / STORE RESOLUTION.
 *
 * Core of multi-tenant architecture: EVERY request is bound to exactly 0 or 1 store.
 *
 * Resolution order (first match wins):
 *   1) Header X-Store-Id (force override by super-admin API calls between stores)
 *   2) req.headers.origin → look up host in `domains` table → match store
 *   3) req.query.__storeId (dev fallback)
 *
 * Attaches:
 *   req.ctx.storeId = bigint
 *   req.ctx.store = Store row
 *
 * Super-admin endpoints (start with /api/super/) do not get a store.
 *
 * NOTE: This middleware uses a raw SQL fallback since Prisma schema may not exist
 * in Batch #3. After Batch #4 it will auto-upgrade to `prisma.domain.findFirst`.
 */
import type { Request, Response, NextFunction } from "express";
import { logger, prisma, cacheGet, cacheSet, CACHE_KEYS } from "../config";
import type { RequestContext } from "../core";
import { ForbiddenError, UnauthorizedError } from "../core";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    export interface Request {
      ctx: RequestContext;
      store?: { id: bigint; status: string };
    }
  }
}

function extractHost(origin?: string): string | null {
  if (!origin) return null;
  try {
    return new URL(origin).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    const o = (origin || "").replace(/^https?:\/\//, "");
    return (o.split(":")[0] || "").replace(/^www\./, "").toLowerCase() || null;
  }
}

async function resolveStoreByOrigin(host: string) {
  const cacheKey = CACHE_KEYS.storeByDomain(host);
  const cached = await cacheGet<any>(cacheKey);
  if (cached) return cached;
  try {
    // We don't require tables to exist yet; wrapped in try/catch for first-run.
    const row = await (prisma as any).domain?.findFirst?.({
      where: { hostname: host, active: true },
      select: { id: true, hostname: true, storeId: true, store: { select: { id: true, status: true, name: true, active: true } } },
    });
    const result = row ? { id: row.storeId, hostname: host, store: row.store } : null;
    if (result) await cacheSet(cacheKey, result, CACHE_KEYS.TTL_LONG);
    else await cacheSet(cacheKey, null, 30);
    return result;
  } catch {
    return null;
  }
}

export default async function tenantMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  // Initialize ctx (empty) for every request — auth/controller will fill more fields.
  if (!req.ctx) {
    req.ctx = {
      storeId: undefined,
      requestId: req.requestId,
      locale: String(req.headers["accept-language"] || req.cookies?.locale || "en").split(",")[0] || "en",
      currency: (req.cookies?.currency as string) || "BDT",
    };
  }

  // Super-admin platform endpoints: no store binding
  if (req.path.startsWith("/api/super/")) {
    next();
    return;
  }

  // 1) X-Store-Id header override (super admin impersonating store via API)
  let forcedStoreId = req.headers["x-store-id"]
    ? BigInt(String(req.headers["x-store-id"]))
    : undefined;

  // 2) domain lookup
  const host = extractHost(req.headers.origin || req.headers.host);
  let resolved: any = null;
  if (!forcedStoreId && host) {
    resolved = await resolveStoreByOrigin(host);
    if (resolved?.id) forcedStoreId = BigInt(resolved.id);
  }

  // 3) Dev fallback query param
  if (!forcedStoreId && req.query.__storeId) {
    try { forcedStoreId = BigInt(String(req.query.__storeId)); } catch { /* ignore */ }
  }

  if (forcedStoreId) {
    req.ctx.storeId = forcedStoreId;
    if (resolved?.store) req.store = { id: forcedStoreId, status: resolved.store.status };
    else req.store = { id: forcedStoreId, status: "ACTIVE" };
  }

  // Endpoints that REQUIRE a bound store (anything under /api/admin or /api/store except store list/search)
  const needsStore = /^\/api\/(admin|store\/(?!(currencies|countries|states|find-domain)))/i.test(req.path);
  if (needsStore && !req.ctx.storeId) {
    logger.warn({ host, path: req.path, origin: req.headers.origin }, "Tenant unresolved");
    next(new UnauthorizedError(
      "Could not resolve which store this request belongs to — check your domain configuration",
      "TENANT_NOT_RESOLVED",
    ));
    return;
  }
  if (req.ctx.storeId && req.store?.status === "SUSPENDED") {
    next(new ForbiddenError("This store has been suspended", "TENANT_SUSPENDED"));
    return;
  }
  next();
}
