import { describe, expect, it } from "vitest"
import { backupName, backupTime, backupsToDelete, nextBackupAt, pgUrl } from "../../src/modules/backups/backup.rules"

const at = (y: number, m: number, d: number, h = 2, min = 30) => new Date(y, m - 1, d, h, min)

describe("backup names", () => {
  it("round-trips the local time", () => {
    expect(backupName(at(2026, 10, 5))).toBe("ecom-20261005-0230.dump")
    expect(backupTime("ecom-20261005-0230.dump")).toEqual(at(2026, 10, 5))
    expect(backupTime("notes.txt")).toBeNull()
  })
})

describe("nextBackupAt", () => {
  it("is tonight's 02:30 before it, tomorrow's after", () => {
    expect(nextBackupAt(at(2026, 10, 25, 1, 0))).toEqual(at(2026, 10, 25))
    expect(nextBackupAt(at(2026, 10, 25, 2, 30))).toEqual(at(2026, 10, 26))
    expect(nextBackupAt(at(2026, 10, 31, 23, 59))).toEqual(at(2026, 11, 1))
  })
})

describe("backupsToDelete", () => {
  it("keeps 7 daily and 4 weekly backups", () => {
    // One backup a night for 60 nights, ending Sunday 2026-10-25.
    const names = Array.from({ length: 60 }, (_, i) => backupName(at(2026, 10, 25 - i)))
    const gone = new Set(backupsToDelete(names))
    const kept = names.filter((n) => !gone.has(n))
    expect(kept.slice(0, 7)).toEqual(names.slice(0, 7)) // the last 7 nights
    expect(kept).toHaveLength(11) // + one in each of 4 earlier weeks
    // Each weekly one is the newest of its week (a Saturday, as weeks start on Sunday).
    for (const n of kept.slice(7)) expect(backupTime(n)!.getDay()).toBe(6)
  })

  it("keeps the newest of a day with several backups", () => {
    const names = [backupName(at(2026, 10, 25, 2, 30)), backupName(at(2026, 10, 25, 14, 0))]
    expect(backupsToDelete(names)).toEqual(["ecom-20261025-0230.dump"])
  })

  it("never deletes files that aren't backups, nor a short history", () => {
    expect(backupsToDelete(["readme.txt", backupName(at(2026, 10, 25))])).toEqual([])
  })
})

describe("pgUrl", () => {
  it("drops Prisma's options, which pg_dump refuses", () => {
    expect(pgUrl("postgresql://ecom:pw@postgres:5432/ecom_platform?schema=public&connection_limit=20")).toBe(
      "postgresql://ecom:pw@postgres:5432/ecom_platform",
    )
  })
})
