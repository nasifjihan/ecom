import type { Request, Response, NextFunction } from "express";
import { logger, prisma, cacheGet, cacheSet, CACHE_KEYS } from "../config";
import type { RequestContext } from "../core";
import { ForbiddenError, UnauthorizedError, normalizeLocale } from "../core";
import { defaultLocale } from "../modules/settings/languages";

declare global {
  namespace Express {
    export interface Request {
      ctx: RequestContext;
      store?: { id: bigint; status: string };
    }
  }
}

/**
 * Domain rows may be stored with a port ("localhost:3000" in local dev, see seed.ts)
 * or without one (production hostnames), so try "host:port" first, then the bare host.
 */
function hostCandidates(origin?: string): string[] {
  if (!origin) return [];
  let hostPort: string;
  try {
    hostPort = new URL(origin).host;
  } catch {
    hostPort = origin.replace(/^https?:\/\//, "").split("/")[0] ?? "";
  }
  hostPort = hostPort.replace(/^www\./, "").toLowerCase();
  const bare = hostPort.split(":")[0] ?? "";
  return [...new Set([hostPort, bare].filter(Boolean))];
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
    const row = await prisma.domain.findFirst({
      where: { hostname: host },
      include: {
        store: {
          select: {
            id: true,
            status: true,
            name: true,
            trialEndsAt: true,
            planId: true,
          },
        },
      },
    });
    // Ids are stringified so the result survives the JSON round-trip through Redis
    // (JSON.stringify throws on BigInt, which used to make every lookup return null).
    const result = row
      ? {
          id: String(row.storeId),
          hostname: host,
          store: { ...row.store, id: String(row.store.id), planId: row.store.planId === null ? null : String(row.store.planId) },
        }
      : null;
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
  if (!req.ctx) {
    req.ctx = {
      storeId: undefined,
      requestId: req.requestId,
      ip: req.ip,
      // The storefront says which language it shows (header from the browser, ?lang= from its
      // server, where the query string also keeps cached pages apart per language).
      locale: normalizeLocale(req.get("x-locale") ?? req.query.lang ?? req.cookies?.locale),
      currency: (req.cookies?.currency as string) || "BDT",
    };
  }

  if (
    req.path === "/healthz" ||
    req.path === "/" ||
    req.path.startsWith("/favicon") ||
    req.path.startsWith("/robots") ||
    req.path.startsWith("/api/super/")
  ) {
    next();
    return;
  }

  let forcedStoreId = req.headers["x-store-id"]
    ? BigInt(String(req.headers["x-store-id"]))
    : undefined;

  const host = extractHost(req.headers.origin || req.headers.host);
  let resolved: any = null;
  if (!forcedStoreId && host) {
    for (const candidate of hostCandidates(req.headers.origin || req.headers.host)) {
      try {
        resolved = await Promise.race([
          resolveStoreByOrigin(candidate),
          new Promise<null>((_, rej) =>
            setTimeout(() => rej(new Error("tenant_resolve_timeout")), 1200),
          ),
        ]);
      } catch {
        resolved = null;
      }
      if (resolved?.id) break;
    }
    if (resolved?.id) forcedStoreId = BigInt(resolved.id);
  }

  if (!forcedStoreId && req.query.__storeId) {
    try { forcedStoreId = BigInt(String(req.query.__storeId)); } catch { /* ignore */ }
  }

  if (forcedStoreId) {
    req.ctx.storeId = forcedStoreId;
    if (resolved?.store) {
      req.store = { id: forcedStoreId, status: resolved.store.status };
    } else {
      req.store = { id: forcedStoreId, status: "active" };
    }
  }

  // A storefront request that doesn't say which language gets the shop's default.
  const namedLocale = req.get("x-locale") ?? req.query.lang ?? req.cookies?.locale;
  if (!namedLocale && req.ctx.storeId && req.path.startsWith("/api/storefront")) {
    req.ctx.locale = await defaultLocale(req.ctx.storeId).catch(() => "en" as const);
  }

  const needsStore = /^\/api\/(admin|store\/(?!(currencies|countries|states|find-domain)))/i.test(req.path);
  if (needsStore && !req.ctx.storeId) {
    logger.warn({ host, path: req.path, origin: req.headers.origin }, "Tenant unresolved");
    next(new UnauthorizedError(
      "Could not resolve which store this request belongs to — check your domain configuration",
      "TENANT_NOT_RESOLVED",
    ));
    return;
  }

  if (req.ctx.storeId && req.store?.status) {
    const status = req.store.status.toLowerCase();

    if (status === "suspended" && !req.path.startsWith("/api/super/")) {
      next(new ForbiddenError("This store has been suspended", "TENANT_SUSPENDED"));
      return;
    }

    if (status === "cancelled" && !req.path.startsWith("/api/super/")) {
      next(new ForbiddenError("This store has been cancelled", "TENANT_CANCELLED"));
      return;
    }

    if (status === "trial") {
      const trialEndsAt = resolved?.store?.trialEndsAt;
      if (trialEndsAt && new Date(trialEndsAt) < new Date()) {
        next(new ForbiddenError("Trial period has expired", "TENANT_TRIAL_EXPIRED"));
        return;
      }
    }
  }

  next();
}
