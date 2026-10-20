import { describe, expect, it } from "vitest"
import {
  MAX_BOOKMARKS,
  PreferencesDto,
  readPreferences,
} from "../../src/modules/admin-users/preferences"

const b = (href: string, label = "Page") => ({ href, label })

describe("admin preferences", () => {
  it("takes admin pages as bookmarks and a text size", () => {
    expect(
      PreferencesDto.safeParse({
        bookmarks: [b("/orders"), b("/orders/12?tab=items")],
        textSize: "lg",
      }).success,
    ).toBe(true)
  })
  it("refuses other sites, protocol-relative links, duplicates and too many", () => {
    expect(PreferencesDto.safeParse({ bookmarks: [b("https://evil.example")] }).success).toBe(false)
    expect(PreferencesDto.safeParse({ bookmarks: [b("//evil.example")] }).success).toBe(false)
    expect(PreferencesDto.safeParse({ bookmarks: [b("/orders"), b("/orders")] }).success).toBe(
      false,
    )
    const many = Array.from({ length: MAX_BOOKMARKS + 1 }, (_, i) => b(`/p${i}`))
    expect(PreferencesDto.safeParse({ bookmarks: many }).success).toBe(false)
    expect(PreferencesDto.safeParse({ textSize: "xl" }).success).toBe(false)
  })
  it("reads nothing or an old shape as the defaults", () => {
    expect(readPreferences(null)).toEqual({ bookmarks: [], textSize: "md" })
    expect(readPreferences({ bookmarks: "nope", textSize: 3 })).toEqual({
      bookmarks: [],
      textSize: "md",
    })
    expect(readPreferences({ bookmarks: [b("/reports", "Reports")], textSize: "sm" })).toEqual({
      bookmarks: [b("/reports", "Reports")],
      textSize: "sm",
    })
  })
})
