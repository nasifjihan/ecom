/**
 * Online payments against a REAL Postgres, with the gateways faked at the HTTP level: keys stored
 * encrypted, a try opened for an order, the order paid only by the gateway's own answer, each try
 * settled once however many times the customer / IPN come back, mismatches left for staff.
 * Runs only when RUN_DB_TESTS=1.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import type { RequestContext } from "../../src/core"
import type { Fetch } from "../../src/modules/payments/gateways/gateway.adapters"

const runDb = process.env.RUN_DB_TESTS === "1"

describe.skipIf(!runDb)("online payments (Postgres)", () => {
  let prisma: typeof import("../../src/config/prisma").prisma
  let Online: typeof import("../../src/modules/payments/gateways/online.service").OnlinePaymentsService
  let setFetch: typeof import("../../src/modules/payments/gateways/online.service").setGatewayFetch
  let Payments: typeof import("../../src/modules/payments/payments.service").PaymentsService
  let Shop: typeof import("../../src/modules/storefront/storefront.service").StorefrontService
  let storeId: bigint
  let admin: RequestContext
  const suffix = Date.now().toString(36)
  let seq = 0

  // The fake gateways' state: what bKash / SSLCommerz will answer next.
  const gw = {
    executed: new Map<string, { amount: string; invoice: string; status: string }>(),
    sslValid: new Map<string, { amount: string; status: string }>(),
  }
  const fake: Fetch = (input, init) => Promise.resolve(answer(input, init))
  const answer = (input: Parameters<Fetch>[0], init: Parameters<Fetch>[1]): Response => {
    const url = new URL(
      typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url,
    )
    const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status })
    const body = typeof init?.body === "string" ? init.body : ""
    if (url.pathname.endsWith("/token/grant")) return json({ id_token: "TOKEN", expires_in: 3600 })
    if (url.pathname.endsWith("/checkout/create")) {
      const b = JSON.parse(body) as { merchantInvoiceNumber: string; amount: string }
      const id = `PAY-${b.merchantInvoiceNumber}`
      gw.executed.set(id, {
        amount: b.amount,
        invoice: b.merchantInvoiceNumber,
        status: "Initiated",
      })
      return json({ statusCode: "0000", paymentID: id, bkashURL: `https://pay.bka.test/${id}` })
    }
    if (url.pathname.endsWith("/checkout/execute") || url.pathname.endsWith("/payment/status")) {
      const { paymentID } = JSON.parse(body) as { paymentID: string }
      const p = gw.executed.get(paymentID)
      if (!p) return json({ statusCode: "2056", statusMessage: "Invalid Payment State" })
      return json({
        statusCode: "0000",
        paymentID,
        trxID: `TRX${paymentID.slice(-6)}`,
        transactionStatus: p.status,
        amount: p.amount,
        currency: "BDT",
        merchantInvoiceNumber: p.invoice,
      })
    }
    if (url.pathname.endsWith("/gwprocess/v4/api.php")) {
      const f = new URLSearchParams(body)
      return json({
        status: "SUCCESS",
        sessionkey: `S-${f.get("tran_id")}`,
        GatewayPageURL: `https://ssl.test/${f.get("tran_id")}`,
      })
    }
    if (url.pathname.endsWith("/validationserverAPI.php")) {
      const code = url.searchParams.get("val_id")!.replace(/^VAL-/, "")
      const p = gw.sslValid.get(code)
      return json(
        p
          ? {
              status: p.status,
              tran_id: code,
              amount: p.amount,
              currency_type: "BDT",
              currency_amount: p.amount,
              bank_tran_id: `BANK-${code.slice(-6)}`,
              risk_level: "0",
            }
          : { status: "INVALID_TRANSACTION" },
      )
    }
    if (url.pathname.endsWith("/merchantTransIDvalidationAPI.php")) {
      const code = url.searchParams.get("tran_id")!
      const p = gw.sslValid.get(code)
      return json({
        APIConnect: "DONE",
        no_of_trans_found: p ? 1 : 0,
        element: p
          ? [
              {
                status: p.status,
                tran_id: code,
                amount: p.amount,
                currency_type: "BDT",
                currency_amount: p.amount,
                bank_tran_id: `BANK-${code.slice(-6)}`,
              },
            ]
          : [],
      })
    }
    return json({ message: "not found" }, 404)
  }

  const makeOrder = async (gateway: string, total: number) =>
    prisma.order.create({
      data: {
        storeId,
        number: `OP${suffix}${++seq}`,
        orderKey: `ok_op_${suffix}_${seq}_secretkey`,
        status: "PENDING",
        billingFirstName: "Rahim",
        billingLastName: "Uddin",
        billingPhone: "01712345678",
        billingAddress1: "House 1",
        billingCity: "Dhaka",
        billingCountryCode: "BD",
        itemsSubtotal: total,
        grandTotal: total,
        currencyCode: "BDT",
        paymentGatewayCode: gateway,
        shippingMethodCode: "std",
        shippingMethodName: "Standard",
      },
    })

  beforeAll(async () => {
    ;({ prisma } = await import("../../src/config/prisma"))
    ;({ OnlinePaymentsService: Online, setGatewayFetch: setFetch } =
      await import("../../src/modules/payments/gateways/online.service"))
    ;({ PaymentsService: Payments } = await import("../../src/modules/payments/payments.service"))
    ;({ StorefrontService: Shop } = await import("../../src/modules/storefront/storefront.service"))
    setFetch(fake)
    storeId = (await prisma.store.create({ data: { name: "Pay Test", slug: `pay-${suffix}` } })).id
    await prisma.domain.create({
      data: { storeId, hostname: `pay-${suffix}.test`, type: "custom", primary: true },
    })
    for (const [code, name, mode, enabled] of [
      ["cod", "Cash on delivery", "online", true],
      ["bkash", "bKash", "online", false],
      ["sslcommerz", "SSLCommerz", "online", false],
      ["nagad", "Nagad", "online", false],
    ] as const) {
      await prisma.paymentGatewayConfig.create({ data: { storeId, code, name, mode, enabled } })
    }
    admin = {
      storeId,
      requestId: "test",
      locale: "en",
      currency: "BDT",
      admin: { id: 1n, role: "ADMIN", permissions: ["*"] },
    }
  })

  afterAll(async () => {
    setFetch?.(null)
    if (!prisma) return
    await prisma.order.deleteMany({ where: { storeId } })
    await prisma.store.delete({ where: { id: storeId } })
    await prisma.$disconnect()
  })

  it("stores keys encrypted, shows them masked and won't go online before a good test", async () => {
    const online = new Online(admin)
    const payments = new Payments(admin)
    await expect(
      payments.updateMethod("bkash", { enabled: true, mode: "online" } as never),
    ).rejects.toThrow(/Add your bKash keys/)
    const view = await online.saveKeys("bkash", {
      mode: "sandbox",
      credentials: {
        username: "merchantUser",
        password: "s3cret-pass",
        appKey: "appkey123456",
        appSecret: "appsecret999",
      },
    })
    expect(view.set).toBe(true)
    expect(view.fields.map((f) => f.value)).toEqual([
      "merc••••User",
      "••••••••",
      "appk••••3456",
      "••••••••",
    ])
    const row = await prisma.paymentGatewayConfig.findFirstOrThrow({
      where: { storeId, code: "bkash" },
    })
    expect(row.secrets).toBeTruthy()
    expect(row.secrets).not.toContain("s3cret-pass")
    expect(row.secrets).not.toContain("appsecret999")
    await expect(
      payments.updateMethod("bkash", { enabled: true, mode: "online" } as never),
    ).rejects.toThrow(/Test your bKash keys/)
    expect(await online.testKeys("bkash")).toEqual({ ok: true, note: "bKash sandbox keys work" })
    await payments.updateMethod("bkash", { enabled: true, mode: "online" } as never)
    // Blank fields keep what's saved.
    await online.saveKeys("bkash", { mode: "sandbox", credentials: { username: "", password: "" } })
    expect((await online.keys("bkash")).set).toBe(true)
    // Nagad can't go online; it's offered only once it's usable.
    await expect(
      payments.updateMethod("nagad", { enabled: true, mode: "online" } as never),
    ).rejects.toThrow(/can't take payments online yet/)
    const offered = (
      await new Shop({ storeId, requestId: "t", locale: "en", currency: "BDT" }).paymentMethods()
    ).map((m) => m.code)
    expect(offered).toEqual(["cod", "bkash"])
  })

  it("pays a bKash order only when bKash says so, once", async () => {
    const order = await makeOrder("bkash", 1500)
    const shop = new Online({ storeId, requestId: "t", locale: "en", currency: "BDT" })
    const { payUrl, attempt } = await shop.start(order.id, `https://pay-${suffix}.test`)
    expect(payUrl).toMatch(/^https:\/\/pay\.bka\.test\//)
    // Back before paying (the customer cancelled): nothing changes on the order.
    gw.executed.get(`PAY-${attempt}`)!.status = "Cancelled"
    const cancelled = await Online.finish("bkash", attempt)
    expect(cancelled.outcome).toBe("cancelled")
    expect(cancelled.redirect).toBe(
      `https://pay-${suffix}.test/checkout/thank-you?key=${order.orderKey}&payment=cancelled`,
    )
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus).toBe(
      "unpaid",
    )

    // A new try ("Pay now"), paid this time; the return link arrives twice.
    const second = await shop.startByOrderKey(order.orderKey, "https://evil.example.net")
    gw.executed.get(`PAY-${second.attempt}`)!.status = "Completed"
    const [a, b] = await Promise.all([
      Online.finish("bkash", second.attempt),
      Online.finish("bkash", second.attempt),
    ])
    expect([a.outcome, b.outcome]).toEqual(["paid", "paid"])
    // Sent back to the store's own address, not the one the request claimed.
    expect(a.redirect).toBe(
      `https://pay-${suffix}.test/checkout/thank-you?key=${order.orderKey}&payment=paid`,
    )
    const paid = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { paymentRecords: true },
    })
    expect(paid.paymentStatus).toBe("paid")
    expect(paid.status).toBe("PROCESSING")
    expect(
      paid.paymentRecords.map((r) => [
        r.kind,
        r.method,
        Number(r.amount),
        r.status,
        r.transactionId,
      ]),
    ).toEqual([["gateway", "bkash", 1500, "verified", `TRX${`PAY-${second.attempt}`.slice(-6)}`]])
    await expect(shop.start(order.id)).rejects.toThrow(/already paid/)
    const tries = await new Online(admin).attempts(order.id)
    expect(tries.map((t) => t.status)).toEqual(["paid", "cancelled"])
  })

  it("leaves a payment that doesn't match for staff instead of marking the order paid", async () => {
    const order = await makeOrder("bkash", 2000)
    const { attempt } = await new Online({
      storeId,
      requestId: "t",
      locale: "en",
      currency: "BDT",
    }).start(order.id)
    // bKash reports a smaller amount than the order's (a tampered or wrong payment).
    gw.executed.set(`PAY-${attempt}`, { amount: "20.00", invoice: attempt, status: "Completed" })
    const r = await Online.finish("bkash", attempt)
    expect(r.outcome).toBe("review")
    expect(r.redirect).toMatch(/payment=review$/)
    const o = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { paymentRecords: true, statusHistory: { orderBy: { id: "asc" } } },
    })
    expect(o.paymentStatus).toBe("unpaid")
    expect(o.paymentRecords).toHaveLength(0)
    expect(o.statusHistory.at(-1)?.note).toMatch(
      /needs a check: Paid, but ৳20.00 was paid, ৳2000.00 was due/,
    )
  })

  it("SSLCommerz: the IPN and the return settle the same try once", async () => {
    const online = new Online(admin)
    await online.saveKeys("sslcommerz", {
      mode: "sandbox",
      credentials: { storeId: "teststore", storePassword: "teststore@ssl" },
    })
    const order = await makeOrder("sslcommerz", 999.5)
    await prisma.paymentGatewayConfig.updateMany({
      where: { storeId, code: "sslcommerz" },
      data: { enabled: true },
    })
    const { payUrl, attempt } = await new Online({
      storeId,
      requestId: "t",
      locale: "en",
      currency: "BDT",
    }).start(order.id)
    expect(payUrl).toBe(`https://ssl.test/${attempt}`)
    // A forged notice for a payment SSLCommerz doesn't know: nothing happens.
    expect(
      (
        await Online.ipn("sslcommerz", {
          tran_id: attempt,
          val_id: `VAL-${attempt}`,
          status: "VALID",
          amount: "999.50",
        })
      ).outcome,
    ).toBe("failed")
    const fresh = await new Online({
      storeId,
      requestId: "t",
      locale: "en",
      currency: "BDT",
    }).start(order.id)
    gw.sslValid.set(fresh.attempt, { amount: "999.50", status: "VALID" })
    const ipn = await Online.ipn("sslcommerz", {
      tran_id: fresh.attempt,
      val_id: `VAL-${fresh.attempt}`,
    })
    const back = await Online.finish("sslcommerz", fresh.attempt, { result: "success" })
    expect([ipn.outcome, back.outcome]).toEqual(["paid", "paid"])
    const o = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { paymentRecords: true },
    })
    expect(o.paymentStatus).toBe("paid")
    expect(o.paymentRecords).toHaveLength(1)
    expect(Number(o.paymentRecords[0]!.amount)).toBe(999.5)
  })

  it("a gateway that won't open leaves the order unpaid with a message, and shows Pay now", async () => {
    await prisma.paymentGatewayConfig.updateMany({
      where: { storeId, code: "bkash" },
      data: { enabled: false },
    })
    const order = await makeOrder("bkash", 300)
    await expect(
      new Online({ storeId, requestId: "t", locale: "en", currency: "BDT" }).start(order.id),
    ).rejects.toThrow(/aren't available right now/)
    await prisma.paymentGatewayConfig.updateMany({
      where: { storeId, code: "bkash" },
      data: { enabled: true },
    })
    const view = await new Shop({
      storeId,
      requestId: "t",
      locale: "en",
      currency: "BDT",
    }).getOrderByKey(order.orderKey)
    expect(view.payment).toMatchObject({
      method: "bkash",
      manual: false,
      canPayOnline: true,
      due: 300,
    })
  })
})
