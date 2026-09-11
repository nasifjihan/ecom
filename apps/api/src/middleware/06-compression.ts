/**
 * 06 — GZIP / DEFLATE compression.
 * Reduces JSON response size ~60-80%.
 * Skip for images / videos / PDFs (already compressed or streamed).
 */
import type { Request, Response, NextFunction } from "express";
import compression from "compression";
import type { NextHandleFunction } from "connect";

const shouldCompress = (req: Parameters<typeof compression.filter>[0], res: Parameters<typeof compression.filter>[1]): boolean => {
  if ((req.headers as any)["x-no-compression"]) return false;
  const ct = res.getHeader("Content-Type") as string | undefined;
  if (ct?.includes("image/") || ct?.includes("video/") || ct === "application/pdf") return false;
  return compression.filter(req, res);
};

const mw: NextHandleFunction = compression({
  level: 6,
  threshold: 1024,
  filter: shouldCompress,
}) as unknown as NextHandleFunction;

export default function compressionMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  mw(req as any, res as any, next);
}
