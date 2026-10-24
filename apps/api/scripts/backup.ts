/**
 * DATABASE BACKUP — a compressed pg_dump, kept in BACKUP_DIR and copied to BACKUP_S3_BUCKET (a
 * private bucket, apart from the product images). Old ones are pruned: 7 daily + 4 weekly.
 *   pnpm --filter @ecom/api backup            one backup now
 *   pnpm --filter @ecom/api backup --daemon   every night at 02:30 (the "backup" service)
 * A failed backup exits non-zero (once) or is logged and retried the next night (daemon).
 */
import { spawn } from "node:child_process"
import { createReadStream } from "node:fs"
import { mkdir, readdir, stat, unlink } from "node:fs/promises"
import path from "node:path"
import { DeleteObjectCommand, ListObjectsV2Command, PutObjectCommand } from "@aws-sdk/client-s3"
import { env, logger } from "../src/config"
import { s3 } from "../src/config/s3"
import { backupName, backupsToDelete, nextBackupAt, pgUrl } from "../src/modules/backups/backup.rules"

export const BUCKET_PREFIX = "postgres/"

/** Runs a command with its arguments (no shell); rejects with its error output on failure. */
export function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "inherit", "pipe"] })
    let err = ""
    p.stderr.on("data", (c) => (err += c))
    p.on("error", reject)
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}: ${err.trim()}`))))
  })
}

async function pruneBucket(bucket: string) {
  const listed = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: BUCKET_PREFIX }))
  const names = (listed.Contents ?? []).map((o) => o.Key!.slice(BUCKET_PREFIX.length))
  for (const name of backupsToDelete(names)) await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: BUCKET_PREFIX + name }))
}

/** One backup: dump, copy to the bucket, prune both. Returns the file name. */
export async function backupOnce(now = new Date()): Promise<string> {
  await mkdir(env.BACKUP_DIR, { recursive: true })
  const name = backupName(now)
  const file = path.join(env.BACKUP_DIR, name)
  // Custom format: compressed, and pg_restore can restore all or part of it.
  await run("pg_dump", ["--format=custom", "--no-owner", "--no-privileges", `--file=${file}`, pgUrl(env.DIRECT_URL ?? env.DATABASE_URL)])
  const size = (await stat(file)).size
  if (env.BACKUP_S3_BUCKET) {
    await s3.send(new PutObjectCommand({ Bucket: env.BACKUP_S3_BUCKET, Key: BUCKET_PREFIX + name, Body: createReadStream(file), ContentLength: size }))
    await pruneBucket(env.BACKUP_S3_BUCKET)
  } else {
    logger.warn("BACKUP_S3_BUCKET is not set: the backup stays on this server only")
  }
  for (const old of backupsToDelete(await readdir(env.BACKUP_DIR))) await unlink(path.join(env.BACKUP_DIR, old))
  logger.info({ name, sizeKB: Math.round(size / 1024), copied: !!env.BACKUP_S3_BUCKET }, "Database backup done")
  return name
}

async function daemon() {
  logger.info("Nightly database backups at 02:30")
  for (;;) {
    const next = nextBackupAt(new Date())
    await new Promise((r) => setTimeout(r, next.getTime() - Date.now()))
    await backupOnce().catch((err: Error) => logger.error({ err: err.message }, "Database backup FAILED"))
  }
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/backup.ts")) {
  const job = process.argv.includes("--daemon") ? daemon() : backupOnce().then(() => process.exit(0))
  job.catch((err: Error) => {
    logger.error({ err: err.message }, "Database backup FAILED")
    process.exit(1)
  })
}
