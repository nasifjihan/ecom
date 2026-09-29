import { describe, it, expect } from "vitest"
import {
  adjust,
  cleanHostname,
  gatewayOffered,
  listedIn,
  onStorefront,
  storefrontCode,
  storefrontPriceRow,
  storefrontZones,
} from "../../src/modules/storefronts/storefronts.rules"

describe("storefront prices", () => {
  const row = { regularPrice: 1000, salePrice: 800, salePriceStartAt: null, salePriceEndAt: null }

  it("keeps the product's price when the storefront changes nothing", () => {
    expect(storefrontPriceRow(row, { priceAdjustPercent: 0 }, null)).toBe(row)
    expect(storefrontPriceRow(row, null, undefined)).toBe(row)
  })

  it("adjusts regular and sale price by the storefront's percent, to whole taka", () => {
    expect(storefrontPriceRow(row, { priceAdjustPercent: 10 }, null)).toMatchObject({ regularPrice: 1100, salePrice: 880 })
    expect(storefrontPriceRow({ ...row, regularPrice: 999, salePrice: null }, { priceAdjustPercent: -15 }, null)).toMatchObject({
      regularPrice: 849,
      salePrice: null,
    })
    expect(adjust(1234.5, 0)).toBe(1234.5)
    expect(adjust(100, -100)).toBe(0)
  })

  it("keeps the sale window when adjusting", () => {
    const start = new Date("2026-01-01")
    expect(storefrontPriceRow({ ...row, salePriceStartAt: start }, { priceAdjustPercent: 5 }, null).salePriceStartAt).toBe(start)
  })

  it("uses the product's own price there over any adjustment", () => {
    const own = { listed: true, regularPrice: 1500, salePrice: 1200 }
    expect(storefrontPriceRow(row, { priceAdjustPercent: 10 }, own)).toEqual({
      regularPrice: 1500,
      salePrice: 1200,
      salePriceStartAt: null,
      salePriceEndAt: null,
    })
  })

  it("ignores an own sale price that isn't below the own regular price", () => {
    expect(storefrontPriceRow(row, null, { listed: true, regularPrice: 500, salePrice: 600 }).salePrice).toBeNull()
  })

  it("a row without its own price only changes whether it's sold", () => {
    expect(storefrontPriceRow(row, { priceAdjustPercent: 10 }, { listed: false, regularPrice: null, salePrice: null })).toMatchObject({
      regularPrice: 1100,
    })
  })
})

describe("storefront range", () => {
  it("follows the product's row, else whether the storefront takes new products", () => {
    expect(listedIn({ includeNewProducts: true }, null)).toBe(true)
    expect(listedIn({ includeNewProducts: false }, null)).toBe(false)
    expect(listedIn({ includeNewProducts: true }, { listed: false })).toBe(false)
    expect(listedIn({ includeNewProducts: false }, { listed: true })).toBe(true)
  })
})

describe("storefront codes and web addresses", () => {
  it("makes a short code from a name", () => {
    expect(storefrontCode("Kids shop")).toBe("KIDS-SHOP")
    expect(storefrontCode("  wholesale / B2B!! ")).toBe("WHOLESALE-B2")
    expect(storefrontCode("--")).toBe("")
  })

  it("keeps only the host (and port) of an address", () => {
    expect(cleanHostname("https://www.Kids.MyShop.com/products?x=1")).toBe("kids.myshop.com")
    expect(cleanHostname("127.0.0.1:3000")).toBe("127.0.0.1:3000")
    expect(cleanHostname("shop.com.bd")).toBe("shop.com.bd")
    expect(cleanHostname("not a host")).toBeNull()
    expect(cleanHostname("-bad-.com")).toBeNull()
    expect(cleanHostname("")).toBeNull()
  })
})

describe("storefront settings", () => {
  it("limits to storefronts only when a list is given", () => {
    expect(onStorefront([], 2n)).toBe(true)
    expect(onStorefront([], null)).toBe(true)
    expect(onStorefront([1n, 2n], 2n)).toBe(true)
    expect(onStorefront([1n], 2n)).toBe(false)
    expect(onStorefront([1n], undefined)).toBe(false)
  })

  it("offers every payment method unless the storefront picks some", () => {
    expect(gatewayOffered([], "bkash")).toBe(true)
    expect(gatewayOffered(["cod"], "cod")).toBe(true)
    expect(gatewayOffered(["cod"], "bkash")).toBe(false)
  })

  it("uses a storefront's own delivery zones over shared ones, and never another storefront's", () => {
    const shared = { id: "shared", storefrontIds: [] as bigint[] }
    const kids = { id: "kids", storefrontIds: [2n] }
    const main = { id: "main", storefrontIds: [1n] }
    expect(storefrontZones([shared, kids, main], 2n).map((z) => z.id)).toEqual(["kids"])
    expect(storefrontZones([shared, kids], 1n).map((z) => z.id)).toEqual(["shared"])
    expect(storefrontZones([shared, main], 1n).map((z) => z.id)).toEqual(["main"])
    expect(storefrontZones([kids], 1n)).toEqual([])
  })
})
