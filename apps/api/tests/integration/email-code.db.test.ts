/**
 * Signing in with a code sent by email, against a real Postgres. RUN_DB_TESTS=1 only.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest"
import request from "supertest"
import type { Express } from "express"

const runDb = process.env.RUN_DB_TESTS === "1"

describe.skipIf(!runDb)("email-code sign-in (Postgres)", () => {
  let app: Express
  let prisma: typeof import("../../src/config/prisma").prisma
  let storeId: bigint | undefined
  const suffix = Date.now().toString(36)
  const email = `code-${suffix}@example.com`
  let spy: { mock: { calls: unknown[][] } }
  const lastCode = () => String(spy.mock.calls.at(-1)?.[2])

  beforeAll(async () => {
    ;({ prisma } = await import("../../src/config/prisma"))
    const { buildApp } = await import("../../src/app")
    const { EmailService } = await import("../../src/modules/notifications")
    // Calls through (the email is really queued); the spy only lets the test read the code.
    spy = vi.spyOn(EmailService.prototype, "customerLoginCode")
    app = buildApp()
    storeId = (await prisma.store.create({ data: { name: "Code Store", slug: `code-${suffix}` } }))
      .id
  })

  afterAll(async () => {
    vi.restoreAllMocks()
    if (!prisma || !storeId) return // an undefined id would match every row
    await prisma.notification.deleteMany({ where: { storeId } })
    await prisma.customer.deleteMany({ where: { storeId } })
    await prisma.store.deleteMany({ where: { id: storeId } })
    await prisma.$disconnect()
  })

  const post = (path: string) => request(app).post(path).set("x-store-id", String(storeId))

  it("is refused until the shop turns it on", async () => {
    const res = await post("/api/auth/customer/email-code/request").send({ email })
    expect(res.status).toBe(400)
    const methods = await request(app)
      .get("/api/auth/customer/login-methods")
      .set("x-store-id", String(storeId))
    expect(methods.body.data).toMatchObject({ email: true, emailCode: false })
  })

  it("emails a code, hides it in the email log, and signs in a new customer once", async () => {
    await prisma.storeLoginSetting.create({ data: { storeId: storeId!, emailCode: true } })
    const sent = await post("/api/auth/customer/email-code/request").send({
      email: email.toUpperCase(),
    })
    expect(sent.status).toBe(200)
    const code = lastCode()
    expect(code).toMatch(/^\d{6}$/)

    const log = await prisma.notification.findFirstOrThrow({
      where: { storeId, eventKey: "customer_login_code" },
    })
    expect(log.body).not.toContain(code)
    expect(JSON.stringify(log.data)).not.toContain(code)
    const row = await prisma.loginCode.findFirstOrThrow({ where: { storeId, target: email } })
    expect(row.codeHash).not.toContain(code)

    const wrong = await post("/api/auth/customer/email-code/verify").send({
      email,
      code: code === "000000" ? "111111" : "000000",
    })
    expect(wrong.status).toBe(401)

    const ok = await post("/api/auth/customer/email-code/verify").send({
      email,
      code,
      firstName: "Mina",
    })
    expect(ok.status).toBe(200)
    expect(ok.body.data.created).toBe(true)
    expect(ok.body.data.accessToken).toBeTypeOf("string")
    const again = await post("/api/auth/customer/email-code/verify").send({ email, code })
    expect(again.status).toBe(401)
  })

  it("asks to wait before sending another code", async () => {
    const res = await post("/api/auth/customer/email-code/request").send({ email })
    expect(res.status).toBe(429)
  })

  it("signs in an existing guest record without making a second account", async () => {
    const guest = `guest-${suffix}@example.com`
    await prisma.customer.create({
      data: { storeId: storeId!, email: guest, firstName: "Old", lastName: "Guest", isGuest: true },
    })
    await post("/api/auth/customer/email-code/request").send({ email: guest })
    const ok = await post("/api/auth/customer/email-code/verify").send({
      email: guest,
      code: lastCode(),
    })
    expect(ok.body.data.created).toBe(false)
    const rows = await prisma.customer.findMany({ where: { storeId, email: guest } })
    expect(rows).toHaveLength(1)
    expect(rows[0]!.isGuest).toBe(false)
  })

  it("won't sign in a banned customer", async () => {
    const banned = `banned-${suffix}@example.com`
    await prisma.customer.create({
      data: { storeId: storeId!, email: banned, firstName: "B", lastName: "", status: "banned" },
    })
    await post("/api/auth/customer/email-code/request").send({ email: banned })
    const res = await post("/api/auth/customer/email-code/verify").send({
      email: banned,
      code: lastCode(),
    })
    expect(res.status).toBe(401)
  })
})
