/**
 * Festival reminders: a BullMQ job scheduler runs FestivalsService.sendDueReminders every hour,
 * so one process sends them however many workers run. Without Redis nothing is scheduled.
 */
import { Queue, Worker } from "bullmq"
import { Redis } from "ioredis"
import { env, logger } from "../../config"
import { FestivalsService } from "./festivals.service"

const NAME = "festival-reminders"
let queue: Queue | null = null
let worker: Worker | null = null

const connection = () => {
  const c = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null, connectionName: "ecom-festival-reminders" })
  c.on("error", (err) => logger.debug({ err: err.message }, "Festival reminders Redis error"))
  return c
}

export async function startFestivalReminders(): Promise<void> {
  if (env.NODE_ENV === "test" || queue) return
  try {
    queue = new Queue(NAME, { connection: connection(), skipVersionCheck: true })
    queue.on("error", (err) => logger.debug({ err: err.message }, "Festival reminders queue error"))
    await queue.upsertJobScheduler(NAME, { every: 60 * 60_000 }, { name: "remind", opts: { removeOnComplete: 20, removeOnFail: 20 } })
    worker = new Worker(
      NAME,
      async () => {
        const out = await FestivalsService.sendDueReminders()
        if (out.sent) logger.info(out, "Festival reminders sent")
        return out
      },
      { connection: connection(), concurrency: 1, skipVersionCheck: true },
    )
    worker.on("error", (err) => logger.debug({ err: err.message }, "Festival reminders worker error"))
    logger.info("Festival reminders scheduled")
  } catch (err) {
    logger.warn({ err: (err as Error).message }, "Festival reminders not scheduled")
  }
}

export async function stopFestivalReminders(): Promise<void> {
  await Promise.allSettled([worker?.close(), queue?.close()])
  worker = null
  queue = null
}
