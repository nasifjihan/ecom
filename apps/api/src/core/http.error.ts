/**
 * HTTP ERROR CLASS HIERARCHY
 * Use `throw new NotFoundError("product_id")` inside services/repos/controllers.
 * The global error middleware at the END of app.ts catches them and formats
 * a consistent ApiEnvelope error response for the client.
 *
 * NEVER `res.status(404).send()` directly. Use these classes.
 */
import type { ErrorCode } from "./error-codes";

export class HttpError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly fields?: Record<string, string[]>;
  public readonly debug?: unknown;

  constructor(
    message: string,
    statusCode = 500,
    code: ErrorCode = "UNKNOWN_ERROR",
    fields?: Record<string, string[]>,
    debug?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.code = code;
    this.fields = fields;
    this.debug = debug;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends HttpError {
  constructor(message = "Bad request", code: ErrorCode = "BAD_REQUEST", fields?: Record<string, string[]>) {
    super(message, 400, code, fields);
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message = "Authentication required", code: ErrorCode = "AUTH_MISSING_TOKEN") {
    super(message, 401, code);
  }
}

export class ForbiddenError extends HttpError {
  constructor(message = "Forbidden — insufficient permission", code: ErrorCode = "AUTH_FORBIDDEN") {
    super(message, 403, code);
  }
}

export class NotFoundError extends HttpError {
  constructor(resource = "Resource", id?: string | number | bigint) {
    const msg = id ? `${resource} not found (id=${String(id)})` : `${resource} not found`;
    super(msg, 404, "NOT_FOUND");
  }
}

export class ConflictError extends HttpError {
  constructor(message = "Resource conflict", code: ErrorCode = "CONFLICT", fields?: Record<string, string[]>) {
    super(message, 409, code, fields);
  }
}

export class ValidationError extends HttpError {
  constructor(
    fields: Record<string, string[]>,
    message = "Validation failed",
    code: ErrorCode = "VALIDATION_FAILED",
  ) {
    super(message, 422, code, fields);
  }
}

export class RateLimitError extends HttpError {
  constructor(message = "Too many requests") {
    super(message, 429, "RATE_LIMITED");
  }
}

export class GoneError extends HttpError {
  constructor(message = "Resource no longer available") {
    super(message, 410, "GONE");
  }
}

export class UnsupportedMediaError extends HttpError {
  constructor(message = "Unsupported media type") {
    super(message, 415, "UNSUPPORTED_MEDIA");
  }
}

export class TooLargeError extends HttpError {
  constructor(message = "Payload too large") {
    super(message, 413, "PAYLOAD_TOO_LARGE");
  }
}

export class InternalServerError extends HttpError {
  constructor(message = "Something went wrong on our end", debug?: unknown) {
    super(message, 500, "INTERNAL_SERVER_ERROR", undefined, debug);
  }
}
