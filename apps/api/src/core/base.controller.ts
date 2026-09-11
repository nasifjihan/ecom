import type { Request, Response, NextFunction } from "express";
import type { RequestContext } from "./base.repository";

/**
 * BASE CONTROLLER — attaches res.ok / res.fail helpers we use in every controller.
 * Always returns the ApiEnvelope shape (see docs Section 21).
 */
import { HttpError } from "./http.error";

const HTTP_STATUS_MESSAGES: Record<number, string> = {
  200: "OK",
  201: "CREATED",
  204: "NO_CONTENT",
  400: "BAD_REQUEST",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  413: "PAYLOAD_TOO_LARGE",
  415: "UNSUPPORTED_MEDIA",
  422: "UNPROCESSABLE_ENTITY",
  429: "TOO_MANY_REQUESTS",
  500: "INTERNAL_SERVER_ERROR",
};

export function envelope<T>(
  res: Response,
  {
    status = 200,
    data,
    meta,
    message,
    errors,
  }: {
    status?: number;
    data?: T | null;
    meta?: unknown;
    message?: string;
    errors?: Record<string, string[]>;
  },
) {
  const reqId = (res as any).reqId ?? (res.req as any)?.requestId ?? "";
  return res.status(status).json({
    success: status >= 200 && status < 400,
    message: message ?? (HTTP_STATUS_MESSAGES[status] ?? ""),
    data: data ?? null,
    meta: meta ?? undefined,
    errors,
    timestamp: new Date().toISOString(),
    requestId: reqId,
  });
}

export type Controller = (req: Request, res: Response, next: NextFunction) => Promise<void> | void;

/**
 * Wraps any async controller in a try/catch so next(err) is always called.
 * Prevents forgotten await rejection crashes.
 */
export const ctrl =
  (fn: (req: Request & { ctx: RequestContext }, res: Response) => Promise<void> | void): Controller =>
  (req, res, next) => {
    try {
      const maybePromise = fn(req as any, res);
      if (maybePromise && typeof (maybePromise as Promise<void>).catch === "function") {
        (maybePromise as Promise<void>).catch((err) => {
          if (err instanceof HttpError || err instanceof Error) next(err);
          else next(err);
        });
      }
    } catch (err) {
      next(err);
    }
  };

export abstract class BaseController {
  protected ok<T>(
    res: Response,
    data?: T | null,
    meta?: unknown,
    message = "OK",
    status = 200,
  ): void {
    envelope(res, { status, data, meta, message });
  }

  protected created<T>(res: Response, data?: T | null, message = "Created"): void {
    this.ok(res, data, undefined, message, 201);
  }

  protected deleted(res: Response, message = "Deleted"): void {
    this.ok(res, null, undefined, message, 200);
  }
}
