/**
 * 05 — HPP (HTTP Parameter Pollution).
 * Prevents repeated query params overriding each other, e.g. ?role=admin&role=user
 * → without HPP this becomes role = ['admin','user'] and may bypass validators.
 */
import type { Request, Response, NextFunction } from "express";
import type { NextHandleFunction } from "connect";
import hpp from "hpp";

const mw = hpp({
  whitelist: ["id", "ids", "tags", "categoryId", "brandId", "status", "sort"],
}) as unknown as NextHandleFunction;

export default function hppMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  mw(req as any, res as any, next);
}
