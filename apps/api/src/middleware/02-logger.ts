/**
 * 02 — REQUEST LOGGER (pino-http).
 * Logs every request with method / url / status / latency.
 * Ignores /healthz, /metrics, /favicon.ico.
 */
import type { Request, Response, NextFunction } from "express";
import { requestLogger } from "../config";

export default function loggerMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  requestLogger(req, res);
  next();
}
