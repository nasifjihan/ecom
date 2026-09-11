/**
 * 12 — RBAC PERMISSION CHECK.
 * Requires `authMiddleware("adminOrSuper")` upstream first.
 *
 * Permissions are strings like "product.create", "order.update.*", "report.read.sales".
 * Wildcards: "*" means everything; "order.*" means all order actions.
 *
 * Usage: Router.patch("/:id", requirePerm("order.update"), controller.update)
 */
import type { Request, Response, NextFunction } from "express";
import { ForbiddenError } from "../core";

function hasPerm(perms: string[], required: string): boolean {
  if (!perms.length) return false;
  if (perms.includes("*")) return true;
  if (perms.includes(required)) return true;
  const prefix = required.split(".").slice(0, -1).join(".") + ".*";
  if (perms.includes(prefix)) return true;
  for (const p of perms) {
    if (p.endsWith(".*")) {
      const base = p.slice(0, -2);
      if (required.startsWith(base)) return true;
    }
  }
  return false;
}

export default function rbacMiddleware(required: string | string[]) {
  const needed: string[] = Array.isArray(required) ? required : [required];
  return (req: Request, _res: Response, next: NextFunction): void => {
    // Super admin = all permissions
    if (req.ctx.super) return next();
    const perms = req.ctx.admin?.permissions ?? [];
    const role = req.ctx.admin?.role ?? "UNKNOWN";
    const ok = needed.every((n) => hasPerm(perms, n));
    if (!ok) {
      return next(
        new ForbiddenError(
          `Role ${role} lacks permission: ${needed.join(", ")}`,
          "AUTH_INSUFFICIENT_PERMISSION",
        ),
      );
    }
    next();
  };
}
