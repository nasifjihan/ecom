import { describe, expect, it } from "vitest"
import { ThemeDto } from "../../src/modules/content/content.dto"
import { defaultTheme, mergeTheme } from "../../src/modules/content/content.defaults"

const base = defaultTheme({ name: "Fashion BD" })

describe("theme settings (Batch 38)", () => {
  it("fills in colours, display and robots for themes saved before they existed", () => {
    const old = { colors: { primary: "#2563eb" }, brand: { storeName: "Old" } }
    const t = mergeTheme(base, old)
    expect(t.colors).toEqual({ primary: "#2563eb", secondary: "#f59e0b" })
    expect(t.display).toEqual({ showRating: true, showSoldCount: true, showLowStock: true, lowStockThreshold: 5 })
    expect(t.robots).toEqual({ blockAll: false, extra: "" })
    // A save without the new groups still parses, with the defaults.
    const parsed = ThemeDto.parse({ ...base, colors: { primary: "#2563eb" }, display: undefined, robots: undefined })
    expect(parsed.colors.secondary).toBe("#f59e0b")
    expect(parsed.robots.blockAll).toBe(false)
  })

  it("accepts robots.txt rules and refuses anything else", () => {
    const ok = (extra: string) => ThemeDto.safeParse({ ...base, robots: { blockAll: false, extra } }).success
    expect(ok("Disallow: /lp/old-offer\nUser-agent: GPTBot\nDisallow: /\n# keep AI crawlers out\n\nSitemap: https://shop.example/extra.xml")).toBe(true)
    expect(ok("")).toBe(true)
    expect(ok("<script>alert(1)</script>")).toBe(false)
    expect(ok("Disallow: /x\nnot a rule")).toBe(false)
  })

  it("keeps the low-stock level and colours in range", () => {
    const parse = (patch: object) => ThemeDto.safeParse({ ...base, ...patch }).success
    expect(parse({ display: { ...base.display, lowStockThreshold: 0 } })).toBe(false)
    expect(parse({ display: { ...base.display, lowStockThreshold: 20 } })).toBe(true)
    expect(parse({ colors: { primary: "#2563eb", secondary: "orange" } })).toBe(false)
  })
})
