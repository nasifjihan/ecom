import { describe, expect, it } from "vitest"
import { ThemeDto } from "../../src/modules/content/content.dto"
import { createHash } from "node:crypto"
import { defaultTheme, mergeTheme, shopperTheme } from "../../src/modules/content/content.defaults"

const base = defaultTheme({ name: "Fashion BD" })

describe("theme settings (Batch 38)", () => {
  it("fills in colours, display and robots for themes saved before they existed", () => {
    const old = { colors: { primary: "#2563eb" }, brand: { storeName: "Old" } }
    const t = mergeTheme(base, old)
    expect(t.colors).toEqual({ primary: "#2563eb", secondary: "#f59e0b" })
    expect(t.display).toEqual({ showRating: true, showSoldCount: true, showLowStock: true, lowStockThreshold: 5, sizeGuideUrl: "" })
    expect(t.tracking).toEqual({ googleAnalyticsId: "", facebookPixelId: "", googleVerification: "" })
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

  it("checks tracking IDs and takes the code out of a pasted Google meta tag", () => {
    const parse = (tracking: object) => ThemeDto.safeParse({ ...base, tracking: { ...base.tracking, ...tracking } })
    const ok = parse({ googleAnalyticsId: "g-abc123xyz", facebookPixelId: "123456789012345", googleVerification: '<meta name="google-site-verification" content="aB3_x-9Zq" />' })
    expect(ok.success && ok.data.tracking).toEqual({ googleAnalyticsId: "G-ABC123XYZ", facebookPixelId: "123456789012345", googleVerification: "aB3_x-9Zq" })
    expect(parse({ googleAnalyticsId: "UA-12345-1" }).success).toBe(false)
    expect(parse({ facebookPixelId: "12ab" }).success).toBe(false)
    expect(parse({ googleVerification: '"><script>' }).success).toBe(false)
  })

  it("never shows shoppers the maintenance preview key, only its hash", () => {
    const key = "k".repeat(32)
    const shown = shopperTheme({ ...base, maintenance: { enabled: true, message: "Back at 6pm", previewKey: key } })
    expect(JSON.stringify(shown)).not.toContain(key)
    expect(shown.maintenance).toEqual({ enabled: true, message: "Back at 6pm", previewHash: createHash("sha256").update(key).digest("hex") })
    expect(shopperTheme(base).maintenance.previewHash).toBeNull()
  })

  it("keeps the low-stock level and colours in range", () => {
    const parse = (patch: object) => ThemeDto.safeParse({ ...base, ...patch }).success
    expect(parse({ display: { ...base.display, lowStockThreshold: 0 } })).toBe(false)
    expect(parse({ display: { ...base.display, lowStockThreshold: 20 } })).toBe(true)
    expect(parse({ colors: { primary: "#2563eb", secondary: "orange" } })).toBe(false)
  })
})
