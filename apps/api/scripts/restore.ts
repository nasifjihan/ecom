/**
 * DATABASE RESTORE from a backup made by scripts/backup.ts (in BACKUP_DIR, else fetched from
 * BACKUP_S3_BUCKET).
 *   pnpm --filter @ecom/api restore latest --test     restore into a scratch database, compare
 *                                                     row counts with the live one, drop it
 *   pnpm --filter @ecom/api restore <file> --yes      replace the live database (stop api and
 *                                                     worker first; see DEPLOYMENT.md)
 */
import { createWriteStream } from "node:fs"
import { access, readdir } from "node:fs/promises"
import path from "node:path"
import { Readable } from "node:stream"
import { pipeline } from "node:stream/promises"
import { GetObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3"
import { PrismaClient } from "@prisma/client"
import { env } from "../src/config"
import { s3 } from "../src/config/s3"
import { backupTime, pgUrl } from "../src/modules/backups/backup.rules"
import { BUCKET_PREFIX, run } from "./backup"

const exists = (f: string) => access(f).then(() => true, () => false)

/** The backup file on disk: a name, or "latest" (newest here or in the bucket). */
async function backupFile(which: string): Promise<string> {
  const local = (await readdir(env.BACKUP_DIR).catch(() => [] as string[])).filter((n) => backupTime(n))
  let remote: string[] = []
  if (env.BACKUP_S3_BUCKET) {
    const listed = await s3.send(new ListObjectsV2Command({ Bucket: env.BACKUP_S3_BUCKET, Prefix: BUCKET_PREFIX }))
    remote = (listed.Contents ?? []).map((o) => o.Key!.slice(BUCKET_PREFIX.length)).filter((n) => backupTime(n))
  }
  const name = which === "latest" ? [...local, ...remote].sort().at(-1) : path.basename(which)
  if (!name || !backupTime(name)) throw new Error(`No backup called ${which}`)
  const file = path.join(env.BACKUP_DIR, name)
  if (await exists(file)) return file
  if (!env.BACKUP_S3_BUCKET || !remote.includes(name)) throw new Error(`${name} is neither in ${env.BACKUP_DIR} nor in the bucket`)
  const obj = await s3.send(new GetObjectCommand({ Bucket: env.BACKUP_S3_BUCKET, Key: BUCKET_PREFIX + name }))
  await pipeline(obj.Body as Readable, createWriteStream(file))
  return file
}

/** Rows in every table, by name. */
async function rowCounts(url: string): Promise<Map<string, number>> {
  const db = new PrismaClient({ datasources: { db: { url } } })
  try {
    const tables = await db.$queryRaw<{ t: string }[]>`SELECT tablename AS t FROM pg_tables WHERE schemaname = 'public' ORDER BY 1`
    const out = new Map<string, number>()
    for (const { t } of tables) {
      const [r] = await db.$queryRawUnsafe<{ n: bigint }[]>(`SELECT count(*) AS n FROM "${t.replace(/"/g, "")}"`)
      out.set(t, Number(r!.n))
    }
    return out
  } finally {
    await db.$disconnect()
  }
}

async function main() {
  const [which, ...flags] = process.argv.slice(2)
  if (!which) throw new Error("Say which backup: a file name, or latest")
  const file = await backupFile(which)
  const live = pgUrl(env.DIRECT_URL ?? env.DATABASE_URL)

  if (flags.includes("--test")) {
    const scratch = `restore_test_${Date.now().toString(36)}`
    const admin = new PrismaClient({ datasources: { db: { url: live } } })
    await admin.$executeRawUnsafe(`CREATE DATABASE "${scratch}"`)
    const scratchUrl = live.replace(/\/[^/]+$/, `/${scratch}`)
    try {
      await run("pg_restore", ["--no-owner", "--no-privileges", `--dbname=${scratchUrl}`, file])
      const [a, b] = await Promise.all([rowCounts(live), rowCounts(scratchUrl)])
      const differ = [...a].filter(([t, n]) => b.get(t) !== n).map(([t, n]) => `${t}: live ${n}, backup ${b.get(t) ?? "missing"}`)
      console.log(`Restored ${path.basename(file)} into a scratch database: ${b.size} tables, ${[...b.values()].reduce((s, n) => s + n, 0)} rows.`)
      console.log(differ.length ? `Differs from live (writes since the backup are expected):\n  ${differ.join("\n  ")}` : "Every table matches the live database.")
    } finally {
      await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${scratch}" WITH (FORCE)`)
      await admin.$disconnect()
    }
    return
  }

  if (!flags.includes("--yes")) {
    throw new Error("This REPLACES the live database. Stop api and worker, then run again with --yes (or use --test first).")
  }
  // One transaction: if anything fails, the live database is left as it was.
  await run("pg_restore", ["--clean", "--if-exists", "--no-owner", "--no-privileges", "--single-transaction", `--dbname=${live}`, file])
  console.log(`Restored ${path.basename(file)} over the live database. Start api and worker again.`)
}

main().then(
  () => process.exit(0),
  (err: Error) => {
    console.error(err.message)
    process.exit(1)
  },
)
