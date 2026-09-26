/**
 * WORKER ENTRY POINT (`pnpm worker`) — sends queued emails in its own process.
 * Run the API with EMAIL_WORKER=off when using this, so emails aren't picked up twice.
 */
import { logger, disconnectPrisma, disconnectRedis } from "../config"
import { startEmailWorker, stopEmailQueue } from "../modules/notifications"

startEmailWorker()
logger.info("Worker running. Press Ctrl+C to stop.")

const stop = async () => {
  await stopEmailQueue()
  await Promise.allSettled([disconnectPrisma(), disconnectRedis()])
  process.exit(0)
}
process.on("SIGINT", () => void stop())
process.on("SIGTERM", () => void stop())
