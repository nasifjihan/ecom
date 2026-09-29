import { describe, it, expect } from "vitest"
import { isReserved, makesLoop, normalizePath, normalizeTarget, parseImport, resolveChains } from "../../src/modules/redirects/redirect.rules"

describe("redirect addresses", () => {
  it("keeps one form of the old address", () => {
    expect(normalizePath("/Summer-Sale/?utm=x#top")).toBe("/summer-sale")
    expect(normalizePath("summer-sale")).toBe("/summer-sale")
    expect(normalizePath("https://shop.example.com/Old//Page/")).toBe("/old/page")
    expect(normalizePath("/%E0%A6%88%E0%A6%A6")).toBe("/ঈদ")
    expect(normalizePath("/")).toBe("/")
    expect(normalizePath("   ")).toBeNull()
    expect(normalizePath("/has space")).toBeNull()
  })

  it("won't redirect the home page or the shop's own machinery", () => {
    expect(isReserved("/")).toBe(true)
    expect(isReserved("/api/storefront")).toBe(true)
    expect(isReserved("/_next/static/x.js")).toBe(true)
    expect(isReserved("/apiary")).toBe(false)
  })

  it("keeps the new address's query, or a full web address", () => {
    expect(normalizeTarget("/search?q=eid")).toBe("/search?q=eid")
    expect(normalizeTarget("products/new/")).toBe("/products/new")
    expect(normalizeTarget("https://facebook.com/shop")).toBe("https://facebook.com/shop")
    expect(normalizeTarget("//evil.com")).toBeNull()
    expect(normalizeTarget("javascript:alert(1)")).toBe("/javascript:alert(1)")
    expect(normalizeTarget("")).toBeNull()
  })
})

describe("redirect chains", () => {
  const r = (fromPath: string, toUrl: string, statusCode = 301) => ({ fromPath, toUrl, statusCode })

  it("follows a chain to the end, permanent only if every hop is", () => {
    const out = resolveChains([r("/a", "/b"), r("/b", "/c", 302), r("/c", "/d"), r("/x", "https://x.com")])
    expect(out).toEqual([r("/a", "/d", 302), r("/b", "/d", 302), r("/c", "/d"), r("/x", "https://x.com")])
  })

  it("matches the next hop however it was typed", () => {
    expect(resolveChains([r("/a", "/B/?ref=1"), r("/b", "/c")])[0]).toEqual(r("/a", "/c"))
  })

  it("leaves out redirects caught in a loop, and refuses new loops", () => {
    expect(resolveChains([r("/a", "/b"), r("/b", "/a"), r("/c", "/d")])).toEqual([r("/c", "/d")])
    const list = [r("/a", "/b"), r("/b", "/c")]
    expect(makesLoop(list, r("/c", "/a"))).toBe(true)
    expect(makesLoop(list, r("/c", "/d"))).toBe(false)
    expect(makesLoop([], r("/a", "/A/"))).toBe(true)
    expect(makesLoop(list, r("/a", "/z"))).toBe(false)
  })
})

describe("pasted redirects", () => {
  it("reads old, new and an optional code", () => {
    const { rows, errors } = parseImport("from,to\n/Old-Shirt, /products/shirt\n\n# a note\n/eid\t/collections/eid\t302\n/, /home\nbad\n/x,/y,303")
    expect(rows.map((x) => [x.line, x.fromPath, x.toUrl, x.statusCode])).toEqual([
      [2, "/old-shirt", "/products/shirt", 301],
      [5, "/eid", "/collections/eid", 302],
    ])
    expect(errors).toEqual([
      { line: 6, message: "/ can't be redirected" },
      { line: 7, message: "The new address is missing or not valid" },
      { line: 8, message: "Use 301 or 302" },
    ])
  })
})
