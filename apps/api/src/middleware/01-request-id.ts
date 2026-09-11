/**
 * 01 — ATTACH requestId (cuid2) to req/res/logger.
 * Returned in every response envelope's requestId field AND every log line
 * so junior devs can grep production logs for a single failing request.
 */
import type { Request, Response, NextFunction } from "express";
import { newId } from "@ecom/utils";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    export interface Request {
      requestId: string;
    }
  }
}

export default function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const id = newId("req");
  req.requestId = id;
  (res as any).reqId = id;
  res.setHeader("X-Request-Id", id);
  next();
}
