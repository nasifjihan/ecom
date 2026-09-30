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
    /** How the next bKash refund goes, and how many reached "bKash". */
    bkashRefund: "ok" as "ok" | "refuse" | "timeout",
    bkashRefundCalls: 0,
    /** SSLCommerz: the refund's first answer, then what its status query says. */
    sslRefund: "processing" as "success" | "processing" | "failed",
    sslRefundStatus: "processing" as "refunded" | "processing" | "cancelled",
  }
  const fake: Fetch = (input, init) => {
    const u = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url
    if (u.includes("/payment/refund")) {
      gw.bkashRefundCalls++
      if (gw.bkashRefund === "timeout") return Promise.reject(new Error("socket hang up"))
    }
    return Promise.resolve(answer(input, init))
  }
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
    if (url.pathname.endsWith("/payment/refund")) {
      const b = JSON.parse(body) as { paymentID: string; trxID: string; amount: string }
      if (gw.bkashRefund === "refuse") return json({ statusCode: "2071", statusMessage: "Duplicate for all transactions" })
      return json({ completedTime: "now", transactionStatus: "Completed", originalTrxID: b.trxID, refundTrxID: `RF${b.trxID}`, amount: b.amount, currency: "BDT" })
    }
    if (url.pathname.endsWith("/merchantTransIDvalidationAPI.php") && url.searchParams.get("bank_tran_id")) {
      if (gw.sslRefund === "failed") return json({ APIConnect: "DONE", status: "failed", errorReason: "Refund amount is greater than the transaction amount" })
      return json({ APIConnect: "DONE", bank_tran_id: url.searchParams.get("bank_tran_id"), refund_ref_id: "SSLREF1", status: gw.sslRefund })
    }
    if (url.pathname.endsWith("/merchantTransIDvalidationAPI.php") && url.searchParams.get("refund_ref_id")) {
      return json({ APIConnect: "DONE", refund_ref_id: url.searchParams.get("refund_ref_id"), status: gw.sslRefundStatus })
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
    const role = await prisma.role.create({ data: { storeId, name: "Owner", slug: `own-${suffix}` } })
    const staff = await prisma.adminUser.create({ data: { storeId, email: `o-${suffix}@x.test`, name: "Owner", passwordHash: "x", roleId: role.id } })
    admin = { storeId, requestId: "test", locale: "en", currency: "BDT", admin: { id: staff.id, role: "ADMIN", permissions: ["*"] } }
  })

  afterAll(async () => {
    setFetch?.(null)
    if (!prisma) return
    await prisma.order.deleteMany({ where: { storeId } })
    await prisma.adminUser.deleteMany({ where: { storeId } })
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

  // ---------------------------------------------------------------- refunds

  const payOnline = async (gateway: "bkash" | "sslcommerz", total: number) => {
    await prisma.paymentGatewayConfig.updateMany({ where: { storeId, code: gateway }, data: { enabled: true, mode: "online" } })
    const order = await makeOrder(gateway, total)
    const { attempt } = await new Online({ storeId, requestId: "t", locale: "en", currency: "BDT" }).start(order.id)
    if (gateway === "bkash") {
      gw.executed.get(`PAY-${attempt}`)!.status = "Completed"
      expect((await Online.finish("bkash", attempt)).outcome).toBe("paid")
    } else {
      gw.sslValid.set(attempt, { amount: total.toFixed(2), status: "VALID" })
      expect((await Online.ipn("sslcommerz", { tran_id: attempt, val_id: `VAL-${attempt}` })).outcome).toBe("paid")
    }
    return order
  }
  const refund = async (orderId: bigint, amount: number) => {
    const { FulfilmentService } = await import("../../src/modules/fulfilment/fulfilment.service")
    const { CreateRefundDto } = await import("../../src/modules/fulfilment/fulfilment.dto")
    return new FulfilmentService(admin).createRefund(orderId, CreateRefundDto.parse({ extraAmount: amount, method: "original", reason: "Customer changed mind", restock: false }))
  }

  it("refunds through bKash, and two refunds at once can't both reach bKash", async () => {
    const order = await payOnline("bkash", 1000)
    gw.bkashRefund = "ok"
    gw.bkashRefundCalls = 0
    const both = await Promise.allSettled([refund(order.id, 600), refund(order.id, 600)])
    expect(both.map((r) => r.status).sort()).toEqual(["fulfilled", "rejected"])
    expect(gw.bkashRefundCalls).toBe(1)
    const lost = both.find((r): r is PromiseRejectedResult => r.status === "rejected")
    expect(String(lost?.reason)).toMatch(/Another refund on this payment/)
    const rest = await refund(order.id, 400)
    expect(rest).toMatchObject({ gatewayRefunded: true, fullyRefunded: true })
    const rows = await prisma.refund.findMany({ where: { orderId: order.id }, orderBy: { id: "asc" } })
    expect(rows.map((r) => [Number(r.amount), r.gatewayStatus, r.gatewayRefunded, r.gatewayTransactionId?.startsWith("RFTRX")])).toEqual([
      [600, "done", true, true],
      [400, "done", true, true],
    ])
    const tryRow = await prisma.paymentAttempt.findFirstOrThrow({ where: { orderId: order.id, status: "paid" } })
    expect(Number(tryRow.refundedAmount)).toBe(1000)
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus).toBe("refunded")
    // Nothing is left to send back.
    const o2 = await payOnline("bkash", 500)
    await refund(o2.id, 500)
    await expect(new Online(admin).refundOnline(o2.id, 10, "again")).rejects.toThrow(/already been refunded/)
    // The notice log: the customer's return, then each refund.
    const [t] = await new Online(admin).attempts(order.id)
    expect(t!.events.map((e) => [e.source, e.outcome]).reverse()).toEqual([
      ["return", "paid"],
      ["refund", "done"],
      ["refund", "done"],
    ])
  })

  it("records nothing when bKash refuses, and keeps the money held when bKash doesn't answer", async () => {
    const order = await payOnline("bkash", 800)
    gw.bkashRefund = "refuse"
    await expect(refund(order.id, 300)).rejects.toThrow(/bKash didn't send the money back: Duplicate for all transactions. Nothing was refunded/)
    expect(await prisma.refund.count({ where: { orderId: order.id } })).toBe(0)
    const held = () => prisma.paymentAttempt.findFirstOrThrow({ where: { orderId: order.id, status: "paid" } }).then((a) => Number(a.refundedAmount))
    expect(await held()).toBe(0)
    gw.bkashRefund = "timeout"
    await expect(refund(order.id, 300)).rejects.toThrow(/didn't answer, so we can't tell whether the money went back/)
    expect(await prisma.refund.count({ where: { orderId: order.id } })).toBe(0)
    // bKash may have sent it: the ৳300 stays held so a retry can't refund it twice.
    expect(await held()).toBe(300)
    gw.bkashRefund = "ok"
  })

  it("SSLCommerz: a refund still processing is checked later", async () => {
    const order = await payOnline("sslcommerz", 700)
    gw.sslRefund = "processing"
    const r = await refund(order.id, 700)
    expect(r).toMatchObject({ gatewayRefunded: false, gatewayStatus: "processing", gatewayTransactionId: "SSLREF1" })
    const online = new Online(admin)
    gw.sslRefundStatus = "processing"
    expect(await online.checkRefund(r.id)).toEqual({ status: "processing" })
    gw.sslRefundStatus = "refunded"
    expect(await online.checkRefund(r.id)).toEqual({ status: "done" })
    expect(await prisma.refund.findUniqueOrThrow({ where: { id: r.id } })).toMatchObject({ gatewayRefunded: true, gatewayStatus: "done" })
    // Refused outright: nothing recorded.
    const o2 = await payOnline("sslcommerz", 200)
    gw.sslRefund = "failed"
    await expect(refund(o2.id, 200)).rejects.toThrow(/greater than the transaction amount/)
    expect(await prisma.refund.count({ where: { orderId: o2.id } })).toBe(0)
  })
})
