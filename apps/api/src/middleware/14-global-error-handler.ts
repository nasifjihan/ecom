/**
 * 14 — GLOBAL ERROR HANDLER (the LAST middleware in app.ts).
 *
 * Catches EVERY error thrown down the middleware chain:
 *  - HttpErrors (subclasses: Validation/Forbidden/NotFound/etc.) → formatted with their codes
 *  - ZodError → 422 Validation
 *  - PrismaClientKnownRequestError → P2002 UNIQUE = 409 conflict, P2025 not found = 404
 *  - Prisma ValidationErrors / any unexpected Error → 500 + stacktrace logged (never expose to client)
 *  - JSON parse failures → 400 BadRequest
 *
 * ALWAYS returns ApiEnvelope shape (success:false, message, errors, requestId, timestamp).
 */
import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import {
  HttpError,
  envelope,
} from "../core";
import { logger, isDev } from "../config";
import type { ErrorCode } from "../core/error-codes";

type AnyErr = {
  name?: string;
  code?: string;
  message?: string;
  meta?: Record<string, unknown>;
  stack?: string;
  type?: string;
  issues?: unknown[];
  target?: unknown;
  errors?: unknown;
  fields?: Record<string, string[]>;
  statusCode?: number;
  debug?: unknown;
};

function asAnyErr(e: unknown): AnyErr {
  return (e ?? {}) as AnyErr;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function globalErrorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  let statusCode = 500;
  let message = "Internal Server Error";
  let code: ErrorCode = "INTERNAL_SERVER_ERROR";
  let fields: Record<string, string[]> | undefined;
  let debug: unknown | undefined;
  const e = asAnyErr(err);

  if (err instanceof HttpError) {
    statusCode = err.statusCode;
    message = err.message;
    code = err.code as ErrorCode;
    fields = err.fields;
    debug = err.debug;
  } else if (err instanceof ZodError) {
    statusCode = 422;
    code = "VALIDATION_FAILED";
    message = "Validation failed";
    fields = {};
    for (const issue of err.issues) {
      const k = issue.path.join(".") || "_";
      if (!fields[k]) fields[k] = [];
      fields[k].push(issue.message);
    }
  } else if (err instanceof SyntaxError) {
    if (e.type === "entity.parse.failed" || "body" in e) {
      statusCode = 400;
      code = "BAD_REQUEST";
      message = "Invalid JSON body";
    }
  } else if (e.name === "PrismaClientKnownRequestError") {
    const prismaCode = e.code ?? "";
    const target = Array.isArray(e.meta?.target) ? (e.meta.target as string[]) : undefined;
    switch (prismaCode) {
      case "P2002":
        statusCode = 409;
        code = "CONFLICT";
        message = `Duplicate ${target?.join("_") ?? "field"} value`;
        if (target && target.length) fields = { [String(target[0])]: [`Duplicate value`] };
        break;
      case "P2025":
        statusCode = 404;
        code = "NOT_FOUND";
        message = "Record not found";
        break;
      case "P2003":
        statusCode = 409;
        code = "CONFLICT";
        message = "Related record not found";
        break;
      default:
        statusCode = 500;
        message = "Database error";
        code = "INTERNAL_SERVER_ERROR";
        debug = { prismaCode };
    }
  } else if (e.name === "PrismaClientValidationError") {
    statusCode = 422;
    code = "VALIDATION_FAILED";
    message = "Query validation failed";
    debug = isDev ? e.message : undefined;
  } else if (err instanceof Error) {
    message = err.message || message;
    debug = isDev ? err.stack : undefined;
  } else {
    message = String(err) || message;
  }

  if (statusCode >= 500) {
    logger.error({ err, requestId: (req as any).requestId, path: req.path }, "Unhandled exception");
  } else if (statusCode >= 400) {
    logger.warn(
      { requestId: (req as any).requestId, path: req.path, statusCode, code },
      `4xx: ${message}`,
    );
  }

  envelope(res, {
    status: statusCode,
    data: null,
    message,
    errors: fields,
  });

  if (debug && isDev && statusCode >= 500) {
    // eslint-disable-next-line no-console
    console.debug("DEBUG:", debug);
  }
}
