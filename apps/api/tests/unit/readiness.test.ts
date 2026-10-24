import { describe, expect, it } from "vitest"
import { readinessProblems } from "../../src/modules/health/health"

const ok = { db: true, redis: true, workerAgeMs: 10_000, emailBacklog: 3 }

describe("readinessProblems", () => {
  it("is ready when everything answers and the worker is fresh", () => {
    expect(readinessProblems(ok)).toEqual([])
  })

  it.each([
    [{ db: false }, "The database isn't answering"],
    [{ redis: false }, "Redis isn't answering"],
    [{ workerAgeMs: null }, "The background worker hasn't started"],
    [{ workerAgeMs: 5 * 60_000 }, "The background worker stopped 5 minutes ago"],
    [{ emailBacklog: 500 }, "500 emails are waiting to be sent"],
  ])("%j → %s", (change, problem) => {
    expect(readinessProblems({ ...ok, ...change })).toEqual([problem])
  })

  it("doesn't blame the worker when Redis itself is down", () => {
    expect(readinessProblems({ ...ok, redis: false, workerAgeMs: null })).toEqual(["Redis isn't answering"])
  })
})
