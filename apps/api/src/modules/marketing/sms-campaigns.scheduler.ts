/**
 * SMS campaigns: a BullMQ job scheduler runs runSmsCampaigns every minute, so one process
 * sends them however many workers run. Without Redis nothing is scheduled (and nothing is sent).
 */
import { Queue, Worker } from "bullmq"
import { Redis } from "ioredis"
import { env, logger } from "../../config"
import { runSmsCampaigns } from "./sms-campaigns"

const NAME = "sms-campaigns"
let queue: Queue | null = null
let worker: Worker | null = null

const connection = () => {
  const c = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null, connectionName: "ecom-sms-campaigns" })
  c.on("error", (err) => logger.debug({ err: err.message }, "SMS campaigns Redis error"))
  return c
}

export async function startSmsCampaigns(): Promise<void> {
  if (env.NODE_ENV === "test" || queue) return
  try {
    queue = new Queue(NAME, { connection: connection(), skipVersionCheck: true })
    queue.on("error", (err) => logger.debug({ err: err.message }, "SMS campaigns queue error"))
    await queue.upsertJobScheduler(NAME, { every: 60_000 }, { name: "send", opts: { removeOnComplete: 20, removeOnFail: 20 } })
    worker = new Worker(
      NAME,
      async () => {
        const out = await runSmsCampaigns()
        if (out.sent) logger.info(out, "SMS campaigns sent")
        return out
      },
      { connection: connection(), concurrency: 1, skipVersionCheck: true },
    )
    worker.on("error", (err) => logger.debug({ err: err.message }, "SMS campaigns worker error"))
    logger.info("SMS campaigns scheduled")
  } catch (err) {
    logger.warn({ err: (err as Error).message }, "SMS campaigns not scheduled")
  }
}

export async function stopSmsCampaigns(): Promise<void> {
  await Promise.allSettled([worker?.close(), queue?.close()])
  worker = null
  queue = null
}
