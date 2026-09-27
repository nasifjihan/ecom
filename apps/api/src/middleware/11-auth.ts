/**
 * 11 — AUTHENTICATION.
 * 3 JWT audiences: SUPER, ADMIN, CUSTOMER. Separated so a customer token can never
 * hit an admin endpoint (even if token leaked).
 *
 * Bearer in Authorization header OR (customer/admin) in httpOnly secure cookie.
 */
import type { Request, Response, NextFunction } from "express";
import { jwt as jwtCfg, prisma, cacheGet, cacheSet, CACHE_KEYS } from "../config";
import { UnauthorizedError, ForbiddenError } from "../core";
import type { TokenAudience } from "../config/jwt";
import { COOKIE_NAMES } from "../config";
import { adminPermissions } from "../config/admin-permissions";
import type { UserType } from "@ecom/shared-types";

type AuthGuardType = "super" | "admin" | "customer" | "adminOrSuper" | "any" | "optional";

function extractBearer(req: Request): string | undefined {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) return authHeader.slice(7);
  return undefined;
}

function readToken(req: Request, audience: TokenAudience): string | undefined {
  const bearer = extractBearer(req);
  if (bearer) return bearer;
  if (audience === "admin") return req.cookies?.[COOKIE_NAMES.ADMIN_REFRESH] as string | undefined;
  if (audience === "customer") return req.cookies?.[COOKIE_NAMES.CUSTOMER_REFRESH] as string | undefined;
  if (audience === "super") return req.cookies?.[COOKIE_NAMES.SUPER_REFRESH] as string | undefined;
  return undefined;
}

async function attachToCtx(
  req: Request,
  audience: TokenAudience,
  decoded: Awaited<ReturnType<typeof jwtCfg.verifyAccessToken>>,
) {
  const obj = {
    id: BigInt(decoded.sub),
    role: decoded.role,
    email: decoded.email,
    type: decoded.type as UserType,
    permissions: [] as string[],
  };
  if (audience === "super") {
    req.ctx.super = { id: obj.id };
    req.ctx.admin = { id: obj.id, role: "SUPER", permissions: ["*"] };
  } else if (audience === "admin") {
    const storeId = (decoded as any).storeId;
    const permissions = storeId && decoded.sub
      ? await adminPermissions(BigInt(storeId), BigInt(decoded.sub)).catch(() => [] as string[])
      : [];
    req.ctx.admin = { id: obj.id, role: obj.role ?? "ADMIN", permissions };
  } else {
    req.ctx.customer = { id: obj.id };
  }
}

export default function authMiddleware(guard: AuthGuardType = "any") {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const candidates: TokenAudience[] =
        guard === "super" ? ["super"] :
        guard === "admin" ? ["admin"] :
        guard === "customer" ? ["customer"] :
        guard === "adminOrSuper" ? ["admin", "super"] :
        ["customer", "admin", "super"];

      let found = false;
      for (const aud of candidates) {
        const tok = readToken(req, aud);
        if (!tok) continue;
        try {
          const decoded = jwtCfg.verifyAccessToken(tok, aud);
          await attachToCtx(req, aud, decoded);
          found = true;
          break;
        } catch {
          // keep trying other audiences
        }
      }

      if (!found && guard !== "optional") {
        if (extractBearer(req)) throw new UnauthorizedError("Invalid or expired token", "AUTH_INVALID_TOKEN");
        throw new UnauthorizedError("Authentication required", "AUTH_MISSING_TOKEN");
      }
      next();
    } catch (err) {
      if (err instanceof UnauthorizedError || err instanceof ForbiddenError) next(err);
      else next(new UnauthorizedError("Authentication failed", "AUTH_INVALID_TOKEN"));
    }
  };
}
