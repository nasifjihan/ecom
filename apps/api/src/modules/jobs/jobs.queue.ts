/**
 * The "data-jobs" BullMQ queue: one job at a time per process, so a big export doesn't slow the
 * shop. Without Redis a job runs straight away in this process instead. In tests nothing is queued;
 * tests call DataJobsService.run themselves.
 */
import { Queue, Worker } from "bullmq"
import { Redis } from "ioredis"
import { env, logger } from "../../config"
import { DataJobsService } from "./jobs.service"

const NAME = "data-jobs"
let queue: Queue | null = null
let worker: Worker | null = null

const connection = (failFast = false) => {
  const c = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null, enableOfflineQueue: !failFast, connectionName: "ecom-data-jobs" })
  c.on("error", (err) => logger.debug({ err: err.message }, "Data jobs Redis error"))
  return c
}

const runInline = (id: bigint) => void DataJobsService.run(id).catch((err: unknown) => logger.error({ err, jobId: String(id) }, "Data job crashed"))

export async function enqueueDataJob(id: bigint): Promise<void> {
  if (env.NODE_ENV === "test") return
  try {
    queue ??= new Queue(NAME, { connection: connection(true), skipVersionCheck: true })
    await Promise.race([
      queue.add("run", { id: String(id) }, { jobId: `job-${id}`, removeOnComplete: 100, removeOnFail: 100 }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Redis didn't answer in time")), 3000).unref()),
    ])
  } catch (err) {
    logger.warn({ err: (err as Error).message, jobId: String(id) }, "Job queue unavailable, running now")
    runInline(id)
  }
}

export function startDataJobs(): void {
  if (env.NODE_ENV === "test" || worker) return
  worker = new Worker(NAME, async (job) => DataJobsService.run(BigInt((job.data as { id: string }).id)), {
    connection: connection(),
    concurrency: 1,
    lockDuration: 10 * 60_000,
    skipVersionCheck: true,
  })
  worker.on("error", (err) => logger.debug({ err: err.message }, "Data jobs worker error"))
  logger.info("Import & export jobs running")
}

export async function stopDataJobs(): Promise<void> {
  await Promise.allSettled([worker?.close(), queue?.close()])
  worker = null
  queue = null
}
