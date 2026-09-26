/**
 * EMAIL QUEUE — BullMQ "notifications" queue.
 *
 * Every email is rendered up front and saved as a Notification row (channel "email"), so the
 * admin's sent-email log shows exactly what went out. The queue job only carries that row's id;
 * the worker sends it, retrying 3 times with exponential backoff, and records the outcome.
 * If Redis isn't reachable the email is sent straight away instead, so nothing is lost.
 */
import { Queue, Worker } from "bullmq"
import { Redis } from "ioredis"
import type { Prisma } from "@prisma/client"
import { env, getMailer, logger, prisma } from "../../config"

export const EMAIL_QUEUE_NAME = "notifications"
const ATTEMPTS = 3
const QUEUE_TIMEOUT_MS = 3000

interface EmailJob {
  logId: string
}

/** What a queued email carries besides its subject (title) and HTML (body). */
export interface EmailLogData {
  to: string[]
  text: string
  replyTo: string | null
  fromName: string
  template: string
  status: "queued" | "sent" | "retrying" | "failed"
  attempts: number
  error?: string
  messageId?: string
  /** Set when the mail driver is "log": the email was recorded but not handed to a mail server. */
  logOnly?: boolean
  orderId?: string
}

let queue: Queue<EmailJob> | null = null
let worker: Worker<EmailJob> | null = null

const connection = (failFast: boolean) => {
  const c = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    // A queue connection should fail fast when Redis is down, so the caller can send inline instead.
    enableOfflineQueue: !failFast,
    connectionName: failFast ? "ecom-email-queue" : "ecom-email-worker",
  })
  c.on("error", (err) => logger.debug({ err: err.message }, "Email queue Redis error"))
  return c
}

/**
 * BullMQ warns unless Redis uses "noeviction". Our Redis also holds the cache, so docker-compose
 * uses "volatile-lru": only keys with an expiry are evicted, and queue keys never expire.
 */
const SKIP_POLICY_CHECK = { skipVersionCheck: true }

const useQueue = () => env.EMAIL_QUEUE === "bullmq" && env.NODE_ENV !== "test"

/** Opens the queue connection early, so it's ready by the time the first email is sent. */
export function initEmailQueue(): void {
  if (!useQueue() || queue) return
  queue = new Queue<EmailJob>(EMAIL_QUEUE_NAME, {
    ...SKIP_POLICY_CHECK,
    connection: connection(true),
    defaultJobOptions: {
      attempts: ATTEMPTS,
      backoff: { type: "exponential", delay: 10_000 },
      removeOnComplete: 1000,
      removeOnFail: 5000,
    },
  })
  queue.on("error", (err) => logger.debug({ err: err.message }, "Email queue error"))
}

/** Queues a saved email, or sends it now when there's no queue. Never throws. */
export async function dispatchEmail(logId: bigint): Promise<void> {
  if (useQueue()) {
    initEmailQueue()
    try {
      const added = queue!.add(
        "email",
        { logId: String(logId) },
        { jobId: `email-${String(logId)}` },
      )
      added.catch(() => undefined)
      // BullMQ waits for Redis to come back rather than failing, so give up after a moment.
      // If the job does get queued later, the worker skips it because the email is already sent.
      await Promise.race([
        added,
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("Redis didn't answer in time")),
            QUEUE_TIMEOUT_MS,
          ).unref(),
        ),
      ])
      return
    } catch (err) {
      logger.warn(
        { err: (err as Error).message, logId: String(logId) },
        "Email queue unavailable, sending now",
      )
    }
  }
  await deliver(logId, 1, 1).catch(() => undefined)
}

const readData = (row: { data: Prisma.JsonValue }) => (row.data ?? {}) as unknown as EmailLogData

async function update(id: bigint, data: EmailLogData, sentAt?: Date) {
  await prisma.notification.update({
    where: { id },
    data: { data: data as unknown as Prisma.InputJsonValue, ...(sentAt ? { sentAt } : {}) },
  })
}

/**
 * Sends one saved email. Throws on failure unless this was the last attempt, so the queue retries.
 */
export async function deliver(logId: bigint, attempt: number, maxAttempts: number): Promise<void> {
  const row = await prisma.notification.findUnique({ where: { id: logId } })
  if (!row) return
  const data = readData(row)
  if (data.status === "sent") return
  try {
    const info = (await getMailer().sendMail({
      from: { name: data.fromName, address: env.MAIL_FROM_ADDRESS },
      to: data.to,
      replyTo: data.replyTo ?? undefined,
      subject: row.title,
      html: row.body ?? undefined,
      text: data.text,
    })) as { messageId?: string }
    await update(
      logId,
      {
        ...data,
        status: "sent",
        attempts: attempt,
        error: undefined,
        messageId: info.messageId,
        logOnly: env.MAIL_DRIVER === "log",
      },
      new Date(),
    )
    logger.info(
      {
        to: data.to,
        subject: row.title,
        template: data.template,
        logOnly: env.MAIL_DRIVER === "log",
      },
      "📧 Email sent",
    )
  } catch (err) {
    const message = (err as Error).message || "Unknown mail error"
    const last = attempt >= maxAttempts
    await update(logId, {
      ...data,
      status: last ? "failed" : "retrying",
      attempts: attempt,
      error: message,
    })
    logger.warn(
      { to: data.to, template: data.template, attempt, err: message },
      last ? "Email failed" : "Email failed, will retry",
    )
    if (!last) throw err
  }
}

/** Starts sending queued emails in this process. Safe to call more than once. */
export function startEmailWorker(): void {
  if (!useQueue() || worker) return
  worker = new Worker<EmailJob>(
    EMAIL_QUEUE_NAME,
    async (job) =>
      deliver(BigInt(job.data.logId), job.attemptsMade + 1, job.opts.attempts ?? ATTEMPTS),
    { ...SKIP_POLICY_CHECK, connection: connection(false), concurrency: 5 },
  )
  worker.on("error", (err) => logger.debug({ err: err.message }, "Email worker error"))
  logger.info("📨 Email worker started")
}

export async function stopEmailQueue(): Promise<void> {
  await Promise.allSettled([worker?.close(), queue?.close()])
  worker = null
  queue = null
}
