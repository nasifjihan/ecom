/**
 * Scheduled report emails: a BullMQ job scheduler runs ReportSchedulesService.sendDue every
 * 15 minutes, so one process sends them however many workers run. Without Redis nothing is sent
 * on schedule ("Send now" still works).
 */
import { Queue, Worker } from "bullmq"
import { Redis } from "ioredis"
import { env, logger } from "../../config"
import { ReportSchedulesService } from "./report-schedules.service"

const NAME = "report-schedules"
let queue: Queue | null = null
let worker: Worker | null = null

const connection = () => {
  const c = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null, connectionName: "ecom-report-schedules" })
  c.on("error", (err) => logger.debug({ err: err.message }, "Report schedules Redis error"))
  return c
}

export async function startReportSchedules(): Promise<void> {
  if (env.NODE_ENV === "test" || queue) return
  try {
    queue = new Queue(NAME, { connection: connection(), skipVersionCheck: true })
    queue.on("error", (err) => logger.debug({ err: err.message }, "Report schedules queue error"))
    await queue.upsertJobScheduler(NAME, { every: 15 * 60_000 }, { name: "send", opts: { removeOnComplete: 20, removeOnFail: 20 } })
    worker = new Worker(
      NAME,
      async () => {
        const out = await ReportSchedulesService.sendDue()
        if (out.due) logger.info(out, "Scheduled reports sent")
        return out
      },
      // Building a few PDFs can take a while; don't let BullMQ think the job stalled.
      { connection: connection(), concurrency: 1, lockDuration: 5 * 60_000, skipVersionCheck: true },
    )
    worker.on("error", (err) => logger.debug({ err: err.message }, "Report schedules worker error"))
    logger.info("Scheduled report emails running")
  } catch (err) {
    logger.warn({ err: (err as Error).message }, "Scheduled report emails not started")
  }
}

export async function stopReportSchedules(): Promise<void> {
  await Promise.allSettled([worker?.close(), queue?.close()])
  worker = null
  queue = null
}
