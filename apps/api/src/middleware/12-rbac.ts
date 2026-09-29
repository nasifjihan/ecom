/**
 * 12 — RBAC PERMISSION CHECK.
 * Requires `authMiddleware("adminOrSuper")` upstream first.
 *
 * Codes are `area.action` from PERMISSION_AREAS in @ecom/shared-types (e.g. "orders.edit").
 * "*" (the owner) passes everything; "orders.*" passes every orders action.
 *
 * Usage: router.patch("/:id", rbacMiddleware("orders.edit"), controller.update)
 */
import type { Request, Response, NextFunction } from "express";
import { hasPermission } from "@ecom/shared-types";
import { ForbiddenError } from "../core";

export default function rbacMiddleware(required: string | string[]) {
  const needed: string[] = Array.isArray(required) ? required : [required];
  return (req: Request, _res: Response, next: NextFunction): void => {
    // Super admin = all permissions
    if (req.ctx.super) return next();
    const perms = req.ctx.admin?.permissions ?? [];
    const role = req.ctx.admin?.role ?? "UNKNOWN";
    const ok = needed.every((n) => hasPermission(perms, n));
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
