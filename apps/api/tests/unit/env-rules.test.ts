import { describe, expect, it } from "vitest"
import { productionProblems } from "../../src/config/env-rules"

const hex = (seed: string) => seed.repeat(64).slice(0, 64)
const good = {
  JWT_ADMIN_ACCESS_SECRET: "9f3ad1c27b7e44a0b8b2f0c5d6e1a7b39f3ad1c27b7e44a0",
  JWT_ADMIN_REFRESH_SECRET: "1c27b7e44a0b8b2f0c5d6e1a7b39f3ad1c27b7e44a0b8b2f",
  JWT_CUSTOMER_ACCESS_SECRET: "b8b2f0c5d6e1a7b39f3ad1c27b7e44a01c27b7e44a0b8b2f",
  JWT_CUSTOMER_REFRESH_SECRET: "d6e1a7b39f3ad1c27b7e44a0b8b2f0c51c27b7e44a0b8b2f",
  JWT_SUPER_ACCESS_SECRET: "7b39f3ad1c27b7e44a0b8b2f0c5d6e1a1c27b7e44a0b8b2f",
  JWT_SUPER_REFRESH_SECRET: "44a0b8b2f0c5d6e1a7b39f3ad1c27b7e1c27b7e44a0b8b2f",
  COOKIE_SECRET: "f0c5d6e1a7b39f3ad1c27b7e44a0b8b21c27b7e44a0b8b2f",
  APP_ENCRYPTION_KEY: hex("a1b2c3d4"),
  STORAGE_DRIVER: "s3",
  S3_ACCESS_KEY: "AKIAEXAMPLEKEYREAL",
  S3_SECRET_KEY: "wJalrXUtnFEMIK7MDENGbPxRfiCYzz",
  S3_PUBLIC_URL: "https://media.shop.com",
  API_BASE_URL: "https://api.shop.com",
  COOKIE_DOMAIN: "shop.com",
  ALLOWED_ORIGINS_REGEX: "^https://([a-z0-9-]+\\.)?shop\\.com$",
  MAIL_DRIVER: "smtp",
  SMTP_HOST: "smtp.mailgun.org",
}

describe("productionProblems", () => {
  it("accepts settings fit for production", () => {
    expect(productionProblems(good)).toEqual([])
  })

  it.each([
    ["JWT_ADMIN_ACCESS_SECRET", "short", /at least 32/],
    ["JWT_ADMIN_ACCESS_SECRET", "replace-me-with-a-long-random-string-1234567", /placeholder/],
    ["COOKIE_SECRET", "x".repeat(40), /placeholder/],
    ["APP_ENCRYPTION_KEY", "0".repeat(64), /APP_ENCRYPTION_KEY/],
    ["APP_ENCRYPTION_KEY", "not-hex", /APP_ENCRYPTION_KEY/],
    ["S3_ACCESS_KEY", "minioadmin", /local MinIO keys/],
    ["S3_PUBLIC_URL", "http://localhost:9000/ecom-local", /S3_PUBLIC_URL/],
    ["API_BASE_URL", "http://api.shop.com", /https/],
    ["COOKIE_DOMAIN", "localhost", /COOKIE_DOMAIN/],
    ["ALLOWED_ORIGINS_REGEX", "^https?://(localhost)(:\\d+)?$", /ALLOWED_ORIGINS_REGEX/],
    ["MAIL_DRIVER", "log", /MAIL_DRIVER/],
    ["SMTP_HOST", "mailpit", /mail catcher/],
  ])("refuses %s = %s", (key, value, message) => {
    const problems = productionProblems({ ...good, [key]: value })
    expect(problems).toHaveLength(1)
    expect(problems[0]).toMatch(message)
  })

  it("refuses the same secret used twice", () => {
    expect(productionProblems({ ...good, COOKIE_SECRET: good.JWT_ADMIN_ACCESS_SECRET })).toEqual([
      "JWT_*/COOKIE_SECRET: each secret must be different",
    ])
  })

  it("doesn't check S3 keys with local disk storage", () => {
    expect(productionProblems({ ...good, STORAGE_DRIVER: "local", S3_ACCESS_KEY: "minioadmin" })).toEqual([])
  })
})

describe("bootstrapProblem", () => {
  it.each([
    [undefined, "Str0ngPassword!", /BOOTSTRAP_EMAIL/],
    ["owner@shop.com", undefined, /at least 12/],
    ["owner@shop.com", "short1", /at least 12/],
    ["owner@shop.com", "onlylettersherexx", /letters and at least one number/],
  ])("%s / %s", async (email, password, want) => {
    const { bootstrapProblem } = await import("../../scripts/bootstrap")
    expect(bootstrapProblem(email, password)).toMatch(want)
  })

  it("accepts a good owner", async () => {
    const { bootstrapProblem } = await import("../../scripts/bootstrap")
    expect(bootstrapProblem("owner@shop.com", "Long-pass-2026x")).toBeNull()
  })
})

describe("production rehearsal", () => {
  it("lets localhost addresses through, but never weak secrets", () => {
    const local = { ...good, PRODUCTION_REHEARSAL: "on", API_BASE_URL: "https://api.ecom.localhost", COOKIE_DOMAIN: "ecom.localhost", SMTP_HOST: "mailpit" }
    expect(productionProblems(local)).toEqual([])
    expect(productionProblems({ ...local, COOKIE_SECRET: "short" })).toHaveLength(1)
  })
})
