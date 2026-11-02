/**
 * Cart reminders: a BullMQ job scheduler runs runCartReminders every 10 minutes, so one process
 * sends them however many workers run. Without Redis nothing is scheduled (and nothing is sent).
 */
import { Queue, Worker } from "bullmq"
import { Redis } from "ioredis"
import { env, logger } from "../../config"
import { runCartReminders } from "./cart-reminders"

const NAME = "cart-reminders"
let queue: Queue | null = null
let worker: Worker | null = null

const connection = () => {
  const c = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null, connectionName: "ecom-cart-reminders" })
  c.on("error", (err) => logger.debug({ err: err.message }, "Cart reminders Redis error"))
  return c
}

export async function startCartReminders(): Promise<void> {
  if (env.NODE_ENV === "test" || queue) return
  try {
    queue = new Queue(NAME, { connection: connection(), skipVersionCheck: true })
    queue.on("error", (err) => logger.debug({ err: err.message }, "Cart reminders queue error"))
    await queue.upsertJobScheduler(NAME, { every: 10 * 60_000 }, { name: "remind", opts: { removeOnComplete: 20, removeOnFail: 20 } })
    worker = new Worker(
      NAME,
      async () => {
        const out = await runCartReminders()
        if (out.sent || out.removed) logger.info(out, "Cart reminders sent")
        return out
      },
      { connection: connection(), concurrency: 1, skipVersionCheck: true },
    )
    worker.on("error", (err) => logger.debug({ err: err.message }, "Cart reminders worker error"))
    logger.info("Cart reminders scheduled")
  } catch (err) {
    logger.warn({ err: (err as Error).message }, "Cart reminders not scheduled")
  }
}

export async function stopCartReminders(): Promise<void> {
  await Promise.allSettled([worker?.close(), queue?.close()])
  worker = null
  queue = null
}
