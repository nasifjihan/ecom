/**
 * 07 — COOKIE PARSER.
 * Reads signed/unsigned cookies from header into `req.cookies` / `req.signedCookies`.
 * Uses COOKIE_SECRET from env (signs refresh tokens in secure httpOnly cookies).
 */
import type { Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import { env } from "../config";

const mw = cookieParser(env.COOKIE_SECRET, {
  decode: (val) => decodeURIComponent(val),
});

export default function cookieParserMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  mw(req, res, next);
}
