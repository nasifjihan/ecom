/**
 * WhatsApp order updates against a real Postgres: record-only mode, the customer's opt-in, once per
 * event, the Cloud API with a fake Meta, and Meta's signed webhook through the real app (raw body).
 * Runs only when RUN_DB_TESTS=1.
 */
import { createHmac } from "node:crypto"
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import request from "supertest"
import type { Express } from "express"

const runDb = process.env.RUN_DB_TESTS === "1"

describe.skipIf(!runDb)("WhatsApp (Postgres)", () => {
  let prisma: typeof import("../../src/config/prisma").prisma
  let WA: typeof import("../../src/modules/whatsapp/whatsapp.service").WhatsappService
  let app: Express
  let storeId: bigint | undefined
  const suffix = Date.now().toString(36)
  const phoneNumberId = `${Date.now()}`.slice(-12)
  let seq = 0

  const sent: { to: string; template: string; params: string[] }[] = []
  const meta = ((_url: string, init: RequestInit) => {
    const b = JSON.parse(init.body as string) as {
      to: string
      template: { name: string; components?: { parameters: { text: string }[] }[] }
    }
    sent.push({
      to: b.to,
      template: b.template.name,
      params: b.template.components?.[0]?.parameters.map((p) => p.text) ?? [],
    })
    return Promise.resolve(
      new Response(JSON.stringify({ messages: [{ id: `wamid.${sent.length}` }] }), { status: 200 }),
    )
  }) as unknown as typeof fetch

  const order = (optIn: boolean) =>
    prisma.order.create({
      data: {
        storeId: storeId!,
        number: `WA${suffix}${++seq}`,
        orderKey: `ok_wa_${suffix}_${seq}_secretkey`,
        status: "PENDING",
        billingFirstName: "Salma",
        billingLastName: "Begum",
        billingPhone: "01712345678",
        billingAddress1: "House 1",
        billingCity: "Dhaka",
        billingCountryCode: "BD",
        itemsSubtotal: 1250,
        grandTotal: 1250,
        currencyCode: "BDT",
        paymentGatewayCode: "cod",
        shippingMethodCode: "std",
        shippingMethodName: "Standard",
        whatsappOptIn: optIn,
      },
    })

  beforeAll(async () => {
    ;({ prisma } = await import("../../src/config/prisma"))
    ;({ WhatsappService: WA } = await import("../../src/modules/whatsapp/whatsapp.service"))
    const { buildApp } = await import("../../src/app")
    app = buildApp()
    storeId = (await prisma.store.create({ data: { name: "WA Test", slug: `wa-${suffix}` } })).id
  })

  afterAll(async () => {
    if (!prisma || !storeId) return // setup failed: an undefined id would match every row
    await prisma.order.deleteMany({ where: { storeId } })
    await prisma.store.delete({ where: { id: storeId } })
    await prisma.$disconnect()
  })

  it("record only: logs an opted-in customer's update once, and nothing for one who didn't opt in", async () => {
    const wa = new WA(storeId!, meta)
    expect((await wa.settings()).provider).toBe("log")
    await wa.save({ events: { order_placed: { enabled: true } } })
    const yes = await order(true)
    const no = await order(false)
    expect((await wa.orderEvent(yes.id, "order_placed"))?.status).toBe("logged")
    expect(await wa.orderEvent(yes.id, "order_placed")).toBeNull() // once per event
    expect(await wa.orderEvent(no.id, "order_placed")).toBeNull()
    expect(await wa.orderEvent(yes.id, "order_shipped")).toBeNull() // that event is off
    const log = await prisma.whatsappMessage.findMany({ where: { storeId } })
    expect(log).toHaveLength(1)
    expect(log[0]).toMatchObject({
      to: "8801712345678",
      template: "order_placed",
      language: "en",
      provider: "log",
    })
    expect(log[0]!.params).toEqual(["Salma", yes.number, "৳1,250", expect.any(String)])
    expect(sent).toHaveLength(0) // nothing went to Meta
  })

  it("refuses the Cloud API without its keys, and stores them encrypted with hints only", async () => {
    const wa = new WA(storeId!, meta)
    await expect(wa.save({ provider: "cloud" })).rejects.toThrow(/phone number ID and access token/)
    const s = await wa.save({
      provider: "cloud",
      phoneNumberId,
      accessToken: "EAAG-secret-token-9999",
      appSecret: "app-secret-5555",
    })
    expect(s).toMatchObject({
      provider: "cloud",
      phoneNumberId,
      accessTokenHint: "••••9999",
      appSecretHint: "••••5555",
    })
    const row = await prisma.storeWhatsappSetting.findUniqueOrThrow({
      where: { storeId: storeId! },
    })
    expect(row.credentials).not.toContain("secret-token")
  })

  it("sends through Meta, then Meta's signed statuses move it to delivered and read", async () => {
    const wa = new WA(storeId!, meta)
    await wa.save({
      events: { order_shipped: { enabled: true, template: "parcel_on_the_way", language: "bn" } },
    })
    const o = await order(true)
    const m = await wa.orderStatus(o.id, "SHIPPED")
    expect(m).toMatchObject({ status: "sent", providerRef: `wamid.${sent.length}` })
    expect(sent.at(-1)).toMatchObject({ to: "8801712345678", template: "parcel_on_the_way" })
    const status = (s: string) =>
      Buffer.from(
        JSON.stringify({
          entry: [
            {
              changes: [
                {
                  value: {
                    metadata: { phone_number_id: phoneNumberId },
                    statuses: [{ id: m!.providerRef, status: s }],
                  },
                },
              ],
            },
          ],
        }),
      )
    const sign = (b: Buffer, secret = "app-secret-5555") =>
      `sha256=${createHmac("sha256", secret).update(b).digest("hex")}`
    const post = (b: Buffer, sig: string) =>
      request(app)
        .post("/api/webhooks/whatsapp")
        .set("content-type", "application/json")
        .set("x-hub-signature-256", sig)
        .send(b.toString("utf8")) // as Meta sends it: the JSON text

    const forged = status("read")
    expect((await post(forged, sign(forged, "wrong-secret"))).status).toBe(401)
    expect((await prisma.whatsappMessage.findUniqueOrThrow({ where: { id: m!.id } })).status).toBe(
      "sent",
    )

    const delivered = status("delivered")
    expect((await post(delivered, sign(delivered))).status).toBe(200)
    const read = status("read")
    await post(read, sign(read))
    const late = status("delivered") // arrives after "read": changes nothing
    await post(late, sign(late))
    expect((await prisma.whatsappMessage.findUniqueOrThrow({ where: { id: m!.id } })).status).toBe(
      "read",
    )
  })

  it("answers Meta's verify check only with the store's own token", async () => {
    const { verifyToken } = await new WA(storeId!).settings()
    const ok = await request(app)
      .get("/api/webhooks/whatsapp")
      .query({
        "hub.mode": "subscribe",
        "hub.verify_token": verifyToken,
        "hub.challenge": "1158201444",
      })
    expect([ok.status, ok.text]).toEqual([200, "1158201444"])
    const bad = await request(app)
      .get("/api/webhooks/whatsapp")
      .query({ "hub.mode": "subscribe", "hub.verify_token": "guess", "hub.challenge": "1" })
    expect(bad.status).toBe(403)
  })

  it("a refused message is logged as failed with Meta's reason", async () => {
    const refusing = (() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            error: { message: "Recipient phone number not in allowed list", code: 131030 },
          }),
          { status: 400 },
        ),
      )) as unknown as typeof fetch
    const m = await new WA(storeId!, refusing).test("01712345678")
    expect(m).toMatchObject({
      status: "failed",
      template: "hello_world",
      error: "Recipient phone number not in allowed list (code 131030)",
    })
    expect((await new WA(storeId!).settings()).lastError).toMatch(/not in allowed list/)
  })
})
