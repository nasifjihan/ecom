/**
 * 04 — CORS.
 * Origin validated against ALLOWED_ORIGINS_REGEX.
 * Credentials (cookies) always included.
 * Vary: Origin so browser caches correctly per origin.
 */
import type { Request, Response, NextFunction } from "express";
import cors from "cors";
import { env } from "../config";
import { UnauthorizedError } from "../core";

const originRegex = new RegExp(env.ALLOWED_ORIGINS_REGEX, "i");

const corsMw = cors({
  credentials: true,
  origin: (origin, cb) => {
    // Same-origin / non-browser requests (mobile apps, Postman) have no Origin header → allow
    if (!origin) return cb(null, true);
    if (originRegex.test(origin)) return cb(null, true);
    return cb(new UnauthorizedError(`Origin ${origin} not allowed`, "AUTH_FORBIDDEN"));
  },
  methods: ["GET", "HEAD", "OPTIONS", "POST", "PUT", "PATCH", "DELETE"],
  allowedHeaders: [
    "Origin",
    "Accept",
    "Content-Type",
    "Authorization",
    "X-Request-Id",
    "X-Store-Id",
    "X-CSRF-Token",
    "X-Locale",
    // Placing an order / a refund once however often it's sent (15-idempotency).
    "Idempotency-Key",
  ],
  exposedHeaders: ["X-Request-Id", "X-Total-Count", "Link", "Idempotent-Replayed"],
  maxAge: 86400,
  preflightContinue: false,
  optionsSuccessStatus: 204,
});

export default function corsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  corsMw(req, res, next);
}
