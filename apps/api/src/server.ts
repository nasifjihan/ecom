/**
 * SERVER ENTRY POINT.
 * - Loads env validation FIRST (crashes fast on missing vars).
 * - Starts Express listener.
 * - Handles graceful shutdown (SIGTERM/SIGINT, uncaughtException, unhandledRejection).
 * - Future: start BullMQ worker(s) + connect prisma/redis + ensure S3 bucket.
 */
import { env } from "./config/env";
import { buildApp } from "./app";
import { logger, disconnectPrisma, disconnectRedis, redis } from "./config";
import { ensureBucket } from "./config/s3";
import { initEmailQueue, startEmailWorker, stopEmailQueue } from "./modules/notifications";

async function bootstrap() {
  const app = buildApp();

  // Try best-effort infra connections now; failures log warnings but don't prevent boot
  // (Prisma client lazily connects on first query; redis.connect may fail first run until docker compose up).
  try {
    await redis.connect().catch(() => void 0);
  } catch { /* ignore */ }
  try {
    await ensureBucket().catch((e) => logger.warn({ err: e?.message }, "S3 bucket ensure skipped"));
  } catch { /* ignore */ }

  // Emails go through the Redis queue; this process sends them unless EMAIL_WORKER=off
  // (then `pnpm worker` runs the sender on its own).
  initEmailQueue();
  if (env.EMAIL_WORKER === "on") startEmailWorker();

  const server = app.listen(env.API_PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`\n
  🚀  E-Commerce Platform API is LIVE
      Mode:    ${env.NODE_ENV}
      Port:    ${env.API_PORT}
      Health:  http://localhost:${env.API_PORT}/healthz
      Log lvl: ${env.LOG_LEVEL}
`);
  });

  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;

  const shutdown = async (signal: NodeJS.Signals, exitCode = 0) => {
    logger.fatal({ signal }, `Caught ${signal} — shutting down gracefully`);
    server.close(() => {
      // eslint-disable-next-line no-console
      console.log("✅ HTTP server closed");
    });
    await Promise.allSettled([
      stopEmailQueue(),
      disconnectPrisma(),
      disconnectRedis(),
    ]);
    setTimeout(() => process.exit(exitCode), 5_000).unref();
  };

  process.on("SIGINT", () => shutdown("SIGINT", 0));
  process.on("SIGTERM", () => shutdown("SIGTERM", 0));
  process.on("uncaughtException", (err) => {
    logger.error({ err }, "UNCAUGHT EXCEPTION");
    setTimeout(() => process.exit(1), 1000).unref();
  });
  process.on("unhandledRejection", (reason) => {
    logger.error({ err: reason }, "UNHANDLED PROMISE REJECTION");
  });
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("🔥 Failed to start server:", err);
  process.exit(1);
});
