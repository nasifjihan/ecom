/**
 * Google / Facebook sign-in in test mode, against a real Postgres. RUN_DB_TESTS=1 only.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import request from "supertest"
import type { Express } from "express"

const runDb = process.env.RUN_DB_TESTS === "1"
const ORIGIN = "http://localhost:3000"

describe.skipIf(!runDb)("social sign-in (Postgres)", () => {
  let app: Express
  let prisma: typeof import("../../src/config/prisma").prisma
  let storeId: bigint | undefined
  const suffix = Date.now().toString(36)

  beforeAll(async () => {
    ;({ prisma } = await import("../../src/config/prisma"))
    const { buildApp } = await import("../../src/app")
    app = buildApp()
    storeId = (
      await prisma.store.create({ data: { name: "Social Store", slug: `social-${suffix}` } })
    ).id
  })

  afterAll(async () => {
    if (!prisma || !storeId) return // an undefined id would match every row
    await prisma.customer.deleteMany({ where: { storeId } })
    await prisma.storefront.deleteMany({ where: { storeId } })
    await prisma.store.deleteMany({ where: { id: storeId } })
    await prisma.$disconnect()
  })

  const post = (path: string, origin = ORIGIN) =>
    request(app).post(path).set("x-store-id", String(storeId)).set("origin", origin)
  /** Start, then finish with what the (test-mode) provider sent back. */
  async function signIn(provider: "google" | "facebook") {
    const start = await post(`/api/auth/customer/oauth/${provider}/start`).send({ next: "/cart" })
    expect(start.status).toBe(200)
    const back = new URL(start.body.data.url as string)
    expect(`${back.origin}${back.pathname}`).toBe(`${ORIGIN}/account/oauth/callback`)
    return post("/api/auth/customer/oauth/finish").send({
      code: back.searchParams.get("code"),
      state: back.searchParams.get("state"),
    })
  }

  it("needs keys (or test mode) before a provider can be switched on", async () => {
    const admin = await import("../../src/modules/auth/customer-login")
    const svc = new admin.CustomerLoginService(storeId!)
    await expect(svc.save({ google: { enabled: true } })).rejects.toThrow(/client ID/)
    const s = await svc.save({
      google: { enabled: true, clientId: "id", clientSecret: "secret-1234" },
    })
    expect(s.google).toMatchObject({
      enabled: true,
      clientId: "id",
      secretHint: "••••1234",
      ready: true,
    })
    const row = await prisma.storeLoginSetting.findUniqueOrThrow({ where: { storeId: storeId! } })
    expect(row.googleClientSecret).not.toContain("secret-1234")
    await svc.save({ socialTestMode: true, facebook: { enabled: true } })
  })

  it("signs in a new customer with Google and links the account", async () => {
    const res = await signIn("google")
    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({ created: true, next: "/cart" })
    const link = await prisma.customerIdentity.findFirstOrThrow({
      where: { storeId, provider: "google" },
    })
    expect(link.subject).toBe("test-google-1")
  })

  it("finds the same customer the second time", async () => {
    const res = await signIn("google")
    expect(res.body.data.created).toBe(false)
    expect(await prisma.customer.count({ where: { storeId } })).toBe(1)
  })

  it("links Facebook to an existing account with the same confirmed email", async () => {
    const c = await prisma.customer.create({
      data: {
        storeId: storeId!,
        email: "facebook.tester@example.com",
        firstName: "Had",
        lastName: "Account",
      },
    })
    const res = await signIn("facebook")
    expect(res.body.data.created).toBe(false)
    expect(res.body.data.user.id).toBe(String(c.id))
    expect(await prisma.customerIdentity.count({ where: { customerId: c.id } })).toBe(1)
  })

  it("refuses a tampered state, another store's address, or a storefront with the buttons off", async () => {
    const start = await post("/api/auth/customer/oauth/google/start").send({})
    const state = new URL(start.body.data.url as string).searchParams.get("state")!
    const bad = await post("/api/auth/customer/oauth/finish").send({
      code: "test-mode",
      state: `${state}x`,
    })
    expect(bad.status).toBe(401)
    const elsewhere = await post(
      "/api/auth/customer/oauth/finish",
      "https://evil.example.com",
    ).send({
      code: "test-mode",
      state,
    })
    expect(elsewhere.status).toBe(401) // CORS turns it away; startOAuth also checks the store's domains
    const wrongCode = await post("/api/auth/customer/oauth/finish").send({
      code: "real-code",
      state,
    })
    expect(wrongCode.status).toBe(401)

    await prisma.storefront.updateMany({ where: { storeId }, data: { socialLogin: false } })
    const { forgetStorefronts } = await import("../../src/modules/storefronts/storefronts.context")
    forgetStorefronts(storeId!)
    const off = await post("/api/auth/customer/oauth/google/start").send({})
    expect(off.status).toBe(400)
    const methods = await request(app)
      .get("/api/auth/customer/login-methods")
      .set("x-store-id", String(storeId))
    expect(methods.body.data).toMatchObject({ google: false, facebook: false })
  })
})
