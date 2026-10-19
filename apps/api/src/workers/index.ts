/**
 * WORKER ENTRY POINT (`pnpm worker`) — sends queued emails, syncs courier statuses, and sends
 * festival reminders and scheduled report emails, in its own process.
 * Run the API with EMAIL_WORKER=off when using this, so emails aren't picked up twice.
 */
import { logger, disconnectPrisma, disconnectRedis } from "../config"
import { startEmailWorker, stopEmailQueue } from "../modules/notifications"
import { startCourierSync, stopCourierSync } from "../modules/couriers"
import { startFestivalReminders, stopFestivalReminders } from "../modules/festivals"
import { startReportSchedules, stopReportSchedules } from "../modules/reports"

startEmailWorker()
void startCourierSync()
void startFestivalReminders()
void startReportSchedules()
logger.info("Worker running. Press Ctrl+C to stop.")

const stop = async () => {
  await stopEmailQueue()
  await stopCourierSync()
  await stopFestivalReminders()
  await stopReportSchedules()
  await Promise.allSettled([disconnectPrisma(), disconnectRedis()])
  process.exit(0)
}
process.on("SIGINT", () => void stop())
process.on("SIGTERM", () => void stop())
