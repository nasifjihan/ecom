import { describe, expect, it, vi } from "vitest"
import rateLimitMiddleware, { rateLimitTier } from "../../src/middleware/09-rate-limit"
import { env } from "../../src/config"

vi.mock("../../src/config", async (orig) => ({ ...(await orig<object>()), redis: { status: "end" } }))

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

describe("rate limits with Redis down", () => {
  const run = (path: string, nodeEnv: typeof env.NODE_ENV) => {
    const was = env.NODE_ENV
    env.NODE_ENV = nodeEnv
    const next = vi.fn()
    rateLimitMiddleware({ method: "POST", path } as never, {} as never, next)
    env.NODE_ENV = was
    return next.mock.calls[0]?.[0] as { statusCode?: number } | undefined
  }
  it("refuses sign-in in production", () => expect(run("/api/auth/admin/login", "production")?.statusCode).toBe(429))
  it("lets other calls through in production", () => expect(run("/api/admin/orders", "production")).toBeUndefined())
  it("lets sign-in through in development", () => expect(run("/api/auth/admin/login", "development")).toBeUndefined())
})
