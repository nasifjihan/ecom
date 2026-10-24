/**
 * READINESS — GET /readyz says whether the shop really works, not just that the API is up
 * (that's /healthz): the database and Redis answer, the background worker is alive (it writes a
 * heartbeat to Redis every 30 s) and emails aren't piling up. 503 with the problems when not.
 * For an outside uptime monitor; Docker keeps using /healthz, so a stopped worker doesn't make
 * the API container look unhealthy.
 */
import { Router, type Request, type Response } from "express"
import { cacheGet, cacheSet, logger, prisma, redis } from "../../config"
import { emailBacklog } from "../notifications"

export const HEARTBEAT_KEY = "worker:heartbeat"
const HEARTBEAT_EVERY_MS = 30_000
/** A heartbeat older than this means the worker has stopped. */
export const WORKER_STALE_MS = 120_000
/** More emails waiting than this means they aren't going out. */
export const EMAIL_BACKLOG_LIMIT = 200

export interface Readiness {
  db: boolean
  redis: boolean
  /** How long ago the worker last wrote its heartbeat; null when it never has. */
  workerAgeMs: number | null
  emailBacklog: number
}

/** The verdict: ok, or the problems in plain words. Pure. */
export function readinessProblems(r: Readiness): string[] {
  const out: string[] = []
  if (!r.db) out.push("The database isn't answering")
  if (!r.redis) out.push("Redis isn't answering")
  else if (r.workerAgeMs === null) out.push("The background worker hasn't started")
  else if (r.workerAgeMs > WORKER_STALE_MS) out.push(`The background worker stopped ${Math.round(r.workerAgeMs / 60_000)} minutes ago`)
  if (r.emailBacklog > EMAIL_BACKLOG_LIMIT) out.push(`${r.emailBacklog} emails are waiting to be sent`)
  return out
}

let beat: NodeJS.Timeout | null = null

/** In the process that runs the background jobs (the worker, or the API with EMAIL_WORKER=on). */
export function startWorkerHeartbeat() {
  if (beat) return
  const write = () => void cacheSet(HEARTBEAT_KEY, Date.now(), 600).catch((err: Error) => logger.warn({ err: err.message }, "Heartbeat not written"))
  write()
  beat = setInterval(write, HEARTBEAT_EVERY_MS)
  beat.unref()
}

export function stopWorkerHeartbeat() {
  if (beat) clearInterval(beat)
  beat = null
}

const settle = <T>(p: Promise<T>, fallback: T, ms = 3000) =>
  Promise.race([p.catch(() => fallback), new Promise<T>((r) => setTimeout(() => r(fallback), ms))])

export async function readiness(nowMs = Date.now()): Promise<Readiness> {
  const [db, redisOk, last, backlog] = await Promise.all([
    settle(prisma.$queryRaw`SELECT 1`.then(() => true), false),
    settle(redis.ping().then((p) => p === "PONG"), false),
    settle(cacheGet<number>(HEARTBEAT_KEY), null),
    settle(emailBacklog(), 0),
  ])
  return { db, redis: redisOk, workerAgeMs: last ? nowMs - last : null, emailBacklog: backlog }
}

export const readyzRouter = Router()
readyzRouter.get("/", (_req: Request, res: Response) => {
  void readiness().then((r) => {
    const problems = readinessProblems(r)
    res.status(problems.length ? 503 : 200).json({ ok: problems.length === 0, problems, ...r })
  })
})
