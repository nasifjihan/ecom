/**
 * 03 — SECURITY HEADERS (helmet).
 * Adds CSP, HSTS, X-Frame-Options, X-Content-Type-Options, referrer policy, etc.
 * Relaxed for dev, tightened for production.
 */
import type { Request, Response, NextFunction } from "express";
import helmet from "helmet";
import { isDev } from "../config";

const devCsp = {
  useDefaults: true,
  directives: {
    "default-src": ["'self'"],
    "img-src": ["'self'", "data:", "blob:", "http:", "https:"],
    "script-src": ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
    "style-src": ["'self'", "'unsafe-inline'"],
    "connect-src": ["'self'", "ws:", "wss:", "http:", "https:"],
    "frame-ancestors": ["*"],
  },
};

const prodCsp = {
  useDefaults: true,
  directives: {
    "default-src": ["'self'"],
    "img-src": ["'self'", "data:", "blob:", "https:"],
    "script-src": ["'self'"],
    "style-src": ["'self'", "'unsafe-inline'"],
    "connect-src": ["'self'", "https:"],
    "upgrade-insecure-requests": [],
    "frame-ancestors": ["'none'"],
  },
};

const helmetMw = helmet({
  contentSecurityPolicy: isDev ? devCsp : prodCsp,
  hsts: isDev ? false : { maxAge: 31_536_000, includeSubDomains: true, preload: true },
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
  crossOriginResourcePolicy: { policy: "cross-origin" },
});

export default function helmetMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  helmetMw(req, res, next);
}
