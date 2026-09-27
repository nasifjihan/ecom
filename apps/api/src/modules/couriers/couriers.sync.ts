/**
 * Scheduled courier sync: a BullMQ job scheduler runs CouriersService.syncDue every
 * COURIER_SYNC_MINUTES, so only one process checks parcels however many workers run.
 * Without Redis nothing is scheduled; "Sync statuses" on the Shipments page still works.
 */
import { Queue, Worker } from "bullmq"
import { Redis } from "ioredis"
import { env, logger } from "../../config"
import { CouriersService } from "./couriers.service"

const NAME = "courier-sync"
let queue: Queue | null = null
let worker: Worker | null = null

const connection = () => {
  const c = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    connectionName: "ecom-courier-sync",
  })
  c.on("error", (err) => logger.debug({ err: err.message }, "Courier sync Redis error"))
  return c
}

export async function startCourierSync(): Promise<void> {
  const minutes = env.COURIER_SYNC_MINUTES
  if (!minutes || env.NODE_ENV === "test" || queue) return
  try {
    queue = new Queue(NAME, { connection: connection(), skipVersionCheck: true })
    queue.on("error", (err) => logger.debug({ err: err.message }, "Courier sync queue error"))
    await queue.upsertJobScheduler(
      NAME,
      { every: minutes * 60_000 },
      { name: "sync", opts: { removeOnComplete: 50, removeOnFail: 50 } },
    )
    worker = new Worker(
      NAME,
      async () => {
        const out = await CouriersService.syncDue(Math.max(5, Math.floor(minutes / 2)))
        if (out.checked) logger.info(out, "Courier statuses synced")
        return out
      },
      { connection: connection(), concurrency: 1, skipVersionCheck: true },
    )
    worker.on("error", (err) => logger.debug({ err: err.message }, "Courier sync worker error"))
    logger.info({ minutes }, "Courier sync scheduled")
  } catch (err) {
    logger.warn({ err: (err as Error).message }, "Courier sync not scheduled")
  }
}

export async function stopCourierSync(): Promise<void> {
  await Promise.allSettled([worker?.close(), queue?.close()])
  worker = null
  queue = null
}
