import { describe, expect, it } from "vitest"
import { rateLimitTier } from "../../src/middleware/09-rate-limit"

describe("rateLimitTier", () => {
  it.each([
    // Sign-in and resets: strict, from any app.
    ["POST", "/api/auth/admin/login", "strict"],
    ["POST", "/api/auth/super/login", "strict"],
    ["POST", "/api/auth/customer/login", "strict"],
    // Order tracking takes a phone number: strict, though it's a storefront read.
    ["GET", "/api/storefront/track", "strict"],
    // Storefront reads: no limit (server-rendered pages all come from one address).
    ["GET", "/api/storefront/products", "none"],
    ["GET", "/api/storefront/products/silk-saree", "none"],
    ["GET", "/api/storefront/shipping/taxes", "none"],
    // Storefront writes keep the general limit.
    ["POST", "/api/storefront/orders", "general"],
    ["POST", "/api/storefront/products/1/reviews", "general"],
    // Admin calls keep the general limit.
    ["GET", "/api/admin/orders", "general"],
  ])("%s %s → %s", (method, path, want) => {
    expect(rateLimitTier(method, path)).toBe(want)
  })
})
