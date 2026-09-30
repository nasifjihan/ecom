/**
 * Idempotency-Key against a REAL Postgres, on a tiny app with a counting route: a repeat gets the
 * first answer (the route runs once), even when both arrive together; a different body with the
 * same key is refused; a failure frees the key. Runs only when RUN_DB_TESTS=1.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import express, { type Express, type NextFunction, type Request, type Response } from "express"
import request from "supertest"

const runDb = process.env.RUN_DB_TESTS === "1"

interface Answer {
  data: { order: string; id: string }
}

describe.skipIf(!runDb)("Idempotency-Key (Postgres)", () => {
  let prisma: typeof import("../../src/config/prisma").prisma
  let app: Express
  let storeId: bigint
  let runs = 0
  const suffix = Date.now().toString(36)

  beforeAll(async () => {
    ;({ prisma } = await import("../../src/config/prisma"))
    const { idempotent, globalErrorHandler } = await import("../../src/middleware")
    storeId = (await prisma.store.create({ data: { name: "Idem", slug: `idem-${suffix}` } })).id
    app = express()
    app.use(express.json())
    app.use((req: Request, _res: Response, next: NextFunction) => {
      ;(req as Request & { ctx: unknown }).ctx = { storeId, requestId: "t", locale: "en", currency: "BDT" }
      // Like validate(): ids arrive as BigInts (a plain JSON.stringify of the body would throw).
      const body = req.body as { items?: unknown[] }
      if (Array.isArray(body.items)) body.items = body.items.map((i) => BigInt(i as number))
      next()
    })
    app.post("/orders", idempotent("checkout"), async (req: Request, res: Response) => {
      runs++
      await new Promise((r) => setTimeout(r, 150))
      if ((req.body as { fail?: boolean }).fail) {
        res.status(422).json({ success: false, message: "Out of stock" })
        return
      }
      res.status(201).json({ success: true, data: { order: `ORD-${runs}`, id: String(runs) } })
    })
    app.use(globalErrorHandler)
  })

  afterAll(async () => {
    if (!prisma) return
    await prisma.store.delete({ where: { id: storeId } })
    await prisma.$disconnect()
  })

  const post = (key: string | null, body: object) => {
    const r = request(app).post("/orders").send(body)
    return key ? r.set("Idempotency-Key", key) : r
  }

  it("places the order once and gives the same answer back on a retry", async () => {
    runs = 0
    const first = await post(`key-one-${suffix}`, { items: [1] })
    const again = await post(`key-one-${suffix}`, { items: [1] })
    expect(first.status).toBe(201)
    expect(again.status).toBe(201)
    expect(again.body).toEqual(first.body)
    expect((again.body as Answer).data).toEqual({ order: "ORD-1", id: "1" })
    expect(again.headers["idempotent-replayed"]).toBe("true")
    expect(runs).toBe(1)
  })

  it("runs a double click once", async () => {
    runs = 0
    const [a, b] = await Promise.all([post(`key-two-${suffix}`, { items: [2] }), post(`key-two-${suffix}`, { items: [2] })])
    // The second waits for the first and gets the same answer (no error for the customer).
    expect([a.status, b.status]).toEqual([201, 201])
    expect(b.body).toEqual(a.body)
    expect(runs).toBe(1)
    // Once the first is done, a retry gets its answer.
    expect(((await post(`key-two-${suffix}`, { items: [2] })).body as Answer).data.order).toBe("ORD-1")
  })

  it("refuses the same key for a different order, and frees a key after a failure", async () => {
    await post(`key-three-${suffix}`, { items: [3] })
    const other = await post(`key-three-${suffix}`, { items: [4] })
    expect(other.status).toBe(400)
    expect((other.body as { message: string }).message).toMatch(/already used for a different request/)
    runs = 0
    expect((await post(`key-four-${suffix}`, { items: [5], fail: true })).status).toBe(422)
    // The failure isn't kept: the retry runs again.
    expect((await post(`key-four-${suffix}`, { items: [5], fail: true })).status).toBe(422)
    expect(runs).toBe(2)
    // No key: runs every time, as before.
    runs = 0
    await post(null, { items: [6] })
    await post(null, { items: [6] })
    expect(runs).toBe(2)
    expect((await post("bad key!", { items: [7] })).status).toBe(400)
  })
})
