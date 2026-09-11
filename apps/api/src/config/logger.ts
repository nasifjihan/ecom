/**
 * PINO LOGGER — JSON structured logger.
 * Dev mode: pino-pretty human-readable output.
 * Prod mode: JSON lines → stdout (sent to CloudWatch/Loki/Datadog).
 */
import pinoHttp from "pino-http";
import pino from "pino";
import { env, isDev } from "./env";
import { createId } from "@paralleldrive/cuid2";

import type { IncomingMessage, ServerResponse } from "http";
// ... imports kept (import pinoHttp, pino, env, isDev, createId above)
const stdSerializers = {
  err: pino.stdSerializers.err,
  req: (req: any) => ({
    method: req.method,
    url: req.url,
    userAgent: req.headers?.["user-agent"],
  }),
  res: (res: any) => ({
    statusCode: res.statusCode,
  }),
};

const transport = isDev
  ? {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:HH:MM:ss Z",
        ignore: "pid,hostname,reqId,req,res",
        singleLine: true,
      },
    }
  : undefined;

const pinoHttpInstance = pinoHttp(
  {
    level: (env.LOG_LEVEL ?? "info") as any,
    autoLogging: {
      ignorePaths: ["/healthz", "/metrics", "/favicon.ico"],
      ignore: (req: IncomingMessage) => (req.url ?? "").startsWith("/_next"),
    },
    genReqId: (_req: IncomingMessage, res: ServerResponse) => {
      const existing = (res as unknown as { reqId?: string }).reqId;
      return existing ?? createId();
    },
    transport,
    serializers: stdSerializers,
  } as any,
);

export const logger = pinoHttpInstance.logger;
export const requestLogger = pinoHttpInstance;
