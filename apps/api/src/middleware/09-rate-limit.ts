/**
 * 09 — RATE LIMITER.
 * Storage = Redis (shared across multiple API pods).
 * Prevents brute-force password guessing, scraping, abuse.
 * Limits:
 *  - /api/auth/login, /api/auth/register, /api/password-reset — STRICT: 20/min/ip
 *  - /api/store/* public routes — PUBLIC: 120/min/ip
 *  - All other routes (authenticated) — SOFT: 600/min/ip
 */
import { rateLimit } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import type { Request, Response, NextFunction } from "express";
import { redis, RATE_LIMITS } from "../config";
import { RateLimitError } from "../core";

function sendRedis(...args: any[]) {
  return (redis as any).call(...args);
}

const strictLimiter = rateLimit({
  windowMs: RATE_LIMITS.STRICT.windowMs,
  max: RATE_LIMITS.STRICT.max,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  validate: false,
  keyGenerator: (req) => `${req.ip}:${req.path}`,
  store: new RedisStore({ sendCommand: sendRedis as any }),
  handler: (req, _res, next) =>
    next(new RateLimitError(`Too many ${req.path.split("/").pop()} attempts — try again later.`)),
});

const publicLimiter = rateLimit({
  windowMs: RATE_LIMITS.PUBLIC.windowMs,
  max: RATE_LIMITS.PUBLIC.max,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  validate: false,
  store: new RedisStore({ sendCommand: sendRedis as any }),
  handler: (_req, _res, next) =>
    next(new RateLimitError("Rate limit exceeded — wait 1 minute")),
});

const authLimiter = rateLimit({
  windowMs: RATE_LIMITS.AUTHENTICATED.windowMs,
  max: RATE_LIMITS.AUTHENTICATED.max,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  validate: false,
  keyGenerator: (req) =>
    (req as any).ctx?.admin?.id?.toString() ||
    (req as any).ctx?.customer?.id?.toString() ||
    (req.ip ?? "unknown"),
  store: new RedisStore({ sendCommand: sendRedis as any }),
  handler: (_req, _res, next) =>
    next(new RateLimitError()),
});

const STRICT_PATHS = /\/api\/(auth|super|admin)\/((customer|admin|super)\/)?(login|register|password-reset|forgot|reset-password|otp|verify)/i;
const PUBLIC_PATHS = /\/api\/(store|pub|v1)\/(products|categories|brands|collections|pages|blogs|search|currencies|shipping|payment-methods|settings|countries|states)/i;

export default function rateLimitMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // Graceful degradation: if Redis not connected, skip rate-limiting entirely
  // (prevents hanging when Docker services aren't running locally).
  if ((redis as any).status !== "ready") {
    next();
    return;
  }
  // Public order tracking takes an order number + phone: limited like a login.
  if (STRICT_PATHS.test(req.path) || (req.path === "/api/storefront/track" && req.method === "GET")) {
    strictLimiter(req, res, next);
    return;
  }
  if (PUBLIC_PATHS.test(req.path)) {
    publicLimiter(req, res, next);
    return;
  }
  authLimiter(req, res, next);
}
