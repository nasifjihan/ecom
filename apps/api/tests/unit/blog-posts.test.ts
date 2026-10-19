import { describe, expect, it } from "vitest"
import { postTiming } from "../../src/modules/content/content.service"

const now = new Date("2026-10-19T10:00:00Z")
const past = new Date("2026-10-01T08:00:00Z")
const future = new Date("2026-10-25T06:00:00Z")

describe("blog post timing", () => {
  it("publishes now the first time, and keeps the original date after that", () => {
    expect(postTiming("published", null, null, now)).toEqual({ publishedAt: now, scheduledAt: null })
    expect(postTiming("published", null, past, now)).toEqual({ scheduledAt: null })
  })

  it("schedules only for a time ahead, dating the post at that time", () => {
    expect(postTiming("scheduled", future, null, now)).toEqual({ publishedAt: future, scheduledAt: future })
    expect(postTiming("scheduled", null, null, now)).toEqual({ error: "Choose when the post goes live" })
    expect(postTiming("scheduled", past, null, now)).toEqual({ error: "Choose a time in the future, or publish it now" })
  })

  it("publishing a scheduled post early dates it now", () => {
    expect(postTiming("published", future, future, now)).toEqual({ publishedAt: now, scheduledAt: null })
  })

  it("a draft drops a pending schedule but keeps a real publish date", () => {
    expect(postTiming("draft", future, future, now)).toEqual({ scheduledAt: null, publishedAt: null })
    expect(postTiming("draft", null, past, now)).toEqual({ scheduledAt: null })
  })
})
