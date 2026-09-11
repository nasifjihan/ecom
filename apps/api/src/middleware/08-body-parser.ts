/**
 * 08 — BODY PARSERS (JSON + form-encoded + raw webhook buffer).
 * - JSON: up to 10MB (so admin can save big page-builder JSON)
 * - URL encoded: 1MB, extended for nested objects
 * - `/webhooks/*` gets RAW buffer (Stripe/SSLCommerz/bKash MUST verify HMAC signatures
 *   on the exact raw byte payload — not on parsed & re-stringified body which may differ).
 */
import type { Request, Response, NextFunction } from "express";
import express from "express";
import { FILE_UPLOAD } from "../config";

const jsonParser = express.json({
  limit: "10mb",
  strict: true,
  verify: (req: any, _res, buf, encoding) => {
    const reqUrl = (req.originalUrl as string) || (req.url as string) || "";
    if (reqUrl.startsWith("/api/webhooks")) {
      req.rawBody = buf.toString(typeof encoding === "string" ? (encoding as BufferEncoding) : "utf8");
    }
  },
});

const urlParser = express.urlencoded({ extended: true, limit: "1mb" });

const rawWebhookParser = express.raw({ type: "*/*", limit: `${FILE_UPLOAD.MAX_FILE_SIZE}` });

export default function bodyParserMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const pathUrl = req.originalUrl || req.url;
  if (pathUrl.startsWith("/api/webhooks")) {
    rawWebhookParser(req, res, next);
  } else if (/text\/xml|application\/xml/.test(req.headers["content-type"] || "")) {
    urlParser(req, res, next);
  } else {
    jsonParser(req, res, () => urlParser(req, res, next));
  }
}
