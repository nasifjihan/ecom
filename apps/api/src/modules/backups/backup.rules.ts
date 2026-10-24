/**
 * BACKUP RULES — names, when the nightly backup runs, and which old ones go. Pure, so they're
 * tested without a database. Times are the server's local time (TZ=Asia/Dhaka in the images).
 */

export const BACKUP_KEEP_DAILY = 7
export const BACKUP_KEEP_WEEKLY = 4
/** Local time of the nightly backup: quiet hours for a Bangladesh shop. */
export const BACKUP_AT = { hour: 2, minute: 30 }

const pad = (n: number) => String(n).padStart(2, "0")

/** "ecom-20261025-0230.dump" for a backup taken at that local time. */
export function backupName(at: Date): string {
  return `ecom-${at.getFullYear()}${pad(at.getMonth() + 1)}${pad(at.getDate())}-${pad(at.getHours())}${pad(at.getMinutes())}.dump`
}

/** The local time a backup name stands for, or null for files that aren't backups. */
export function backupTime(name: string): Date | null {
  const m = /^ecom-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})\.dump$/.exec(name)
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5])) : null
}

/** The next nightly run after `now` (today's, if it's still ahead, else tomorrow's). */
export function nextBackupAt(now: Date): Date {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), BACKUP_AT.hour, BACKUP_AT.minute)
  if (next <= now) next.setDate(next.getDate() + 1)
  return next
}

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
/** The Sunday that starts this backup's week. */
const weekKey = (d: Date) => dayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay()))

/**
 * Which backups to delete: keep the newest of each of the last 7 days that have one, then the
 * newest of each of the 4 weeks before those; everything older goes. Unknown names are kept.
 */
export function backupsToDelete(names: string[], keepDaily = BACKUP_KEEP_DAILY, keepWeekly = BACKUP_KEEP_WEEKLY): string[] {
  const dated = names
    .map((name) => ({ name, at: backupTime(name) }))
    .filter((b): b is { name: string; at: Date } => b.at !== null)
    .sort((a, b) => b.at.getTime() - a.at.getTime())
  const days = new Set<string>()
  const weeks = new Set<string>()
  const keep = new Set<string>()
  let weekly = 0
  for (const b of dated) {
    if (days.size < keepDaily && !days.has(dayKey(b.at))) {
      days.add(dayKey(b.at))
      weeks.add(weekKey(b.at))
      keep.add(b.name)
    } else if (days.size >= keepDaily && weekly < keepWeekly && !weeks.has(weekKey(b.at))) {
      // Weeks the daily backups already cover don't count; this is 4 more.
      weeks.add(weekKey(b.at))
      weekly++
      keep.add(b.name)
    }
  }
  return dated.filter((b) => !keep.has(b.name)).map((b) => b.name)
}

/** pg_dump / pg_restore take a plain connection string: Prisma's extra options (?schema=…) go. */
export function pgUrl(prismaUrl: string): string {
  return prismaUrl.split("?")[0]!
}
