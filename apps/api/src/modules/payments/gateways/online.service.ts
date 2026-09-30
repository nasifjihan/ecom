/**
 * ONLINE PAYMENTS — bKash Checkout and SSLCommerz with each store's own keys.
 *
 *  1. Keys: staff enter the merchant keys (sandbox or live) in Settings → Payments; they're stored
 *     encrypted, never sent back (only masked), and "Test connection" checks them with the gateway.
 *  2. Paying: placing an order (or "Pay now" on the order page) opens a PaymentAttempt with our own
 *     code and sends the customer to the gateway's page.
 *  3. Back from the gateway (return link, or SSLCommerz's IPN): we ask the gateway's API how the
 *     payment ended. Only its answer counts, and only for that attempt's code, in taka, for the
 *     amount asked (gateway.rules judge). A paid attempt adds a verified "gateway" payment record
 *     and the order becomes paid (then processing); a mismatch is left for staff ("review").
 *  4. Each attempt is settled once: the return link, the IPN and a reload can all arrive, and only
 *     the first one to move the attempt out of "started" changes anything.
 */
import { Prisma } from "@prisma/client"
import { decrypt, encrypt, env, logger, prisma, tx } from "../../../config"
import { BadRequestError, ConflictError, NotFoundError, type RequestContext } from "../../../core"
import { PaymentsService } from "../payments.service"
import {
  GATEWAY_FIELDS,
  GatewayError,
  gatewayFor,
  type Fetch,
  type GatewayConfig,
  type GatewayResult,
  type OnlineGatewayCode,
} from "./gateway.adapters"
import {
  attemptCode,
  isFinal,
  isOnlineGateway,
  judge,
  maskKey,
  scrub,
  storefrontOrigin,
  type Verdict,
} from "./gateway.rules"

type T = Prisma.TransactionClient
const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v))
const NAMES: Record<OnlineGatewayCode, string> = { bkash: "bKash", sslcommerz: "SSLCommerz" }
/** Tries per order before we stop opening new ones (a stuck customer should call the shop). */
const MAX_ATTEMPTS = 10

/** For tests: the fetch the gateways use. */
let gatewayFetch: Fetch = (...a) => fetch(...a)
export function setGatewayFetch(f: Fetch | null) {
  gatewayFetch = f ?? ((...a) => fetch(...a))
}

export interface KeysInput {
  mode: "sandbox" | "live"
  /** Blank values keep what's saved. */
  credentials: Record<string, string>
}

/** The gateway's keys for a store, decrypted, or null when they aren't set. */
async function loadConfig(storeId: bigint, code: OnlineGatewayCode): Promise<GatewayConfig | null> {
  const g = await prisma.paymentGatewayConfig.findFirst({ where: { storeId, code } })
  if (!g?.secrets) return null
  let credentials: Record<string, string> = {}
  try {
    credentials = JSON.parse(decrypt(g.secrets) ?? "{}") as Record<string, string>
  } catch {
    return null
  }
  return { gateway: code, mode: g.testMode ? "sandbox" : "live", credentials }
}

const apiBase = () => env.API_BASE_URL.replace(/\/$/, "")

/** Where a gateway's word came from, for the notice log. */
export interface Seen {
  source: "return" | "ipn" | "recheck"
  payload?: Record<string, unknown>
  ip?: string | null
}

/** Records what a gateway sent or answered (never fails the request it's part of). */
async function logEvent(e: {
  storeId: bigint
  attemptId: bigint | null
  gateway: string
  source: string
  outcome: string
  note?: string | null
  payload?: Record<string, unknown>
  ip?: string | null
}) {
  try {
    await prisma.paymentEvent.create({
      data: {
        storeId: e.storeId,
        attemptId: e.attemptId,
        gateway: e.gateway,
        source: e.source,
        outcome: e.outcome,
        note: e.note?.slice(0, 500) ?? null,
        payload: e.payload ? (scrub(e.payload) as Prisma.InputJsonValue) : Prisma.DbNull,
        ip: e.ip?.slice(0, 64) ?? null,
      },
    })
  } catch (err) {
    logger.warn({ err: (err as Error).message }, "Couldn't log a payment event")
  }
}

export class OnlinePaymentsService {
  constructor(private readonly ctx: RequestContext) {}

  private get storeId(): bigint {
    if (this.ctx.storeId === undefined)
      throw new BadRequestError("No store for this request", "STORE_REQUIRED")
    return this.ctx.storeId
  }

  // ================================================================ keys (admin)

  private async method(code: string) {
    if (!isOnlineGateway(code))
      throw new BadRequestError(
        "Only bKash and SSLCommerz take payments online",
        "VALIDATION_FAILED",
      )
    const g = await prisma.paymentGatewayConfig.findFirst({
      where: { storeId: this.storeId, code },
    })
    if (!g) throw new NotFoundError("Payment method", code)
    return g
  }

  /** What the admin sees of a gateway's keys: which are set (masked), the mode and the last test. */
  async keys(code: string) {
    const g = await this.method(code)
    const gateway = code as OnlineGatewayCode
    const saved = (await loadConfig(this.storeId, gateway))?.credentials ?? {}
    return {
      code: gateway,
      mode: g.testMode ? "sandbox" : "live",
      set: GATEWAY_FIELDS[gateway].every((f) => Boolean(saved[f.key])),
      fields: GATEWAY_FIELDS[gateway].map((f) => ({
        key: f.key,
        label: f.label,
        secret: f.secret === true,
        // Secrets show as set / not set only; other fields masked.
        value: saved[f.key] ? (f.secret ? "••••••••" : maskKey(saved[f.key])) : null,
      })),
      lastTest: g.keysTestedAt
        ? { at: g.keysTestedAt, ok: g.keysTestOk === true, note: g.keysTestNote }
        : null,
      /** SSLCommerz: the payment notice address for its merchant panel (bKash Checkout needs none). */
      ...(gateway === "sslcommerz" ? { ipnUrl: `${apiBase()}/api/payments/ipn/sslcommerz` } : {}),
    }
  }

  async saveKeys(code: string, d: KeysInput) {
    const g = await this.method(code)
    const gateway = code as OnlineGatewayCode
    const saved = (await loadConfig(this.storeId, gateway))?.credentials ?? {}
    const next: Record<string, string> = {}
    for (const f of GATEWAY_FIELDS[gateway]) {
      const v = d.credentials[f.key]?.trim()
      const old = saved[f.key]
      if (v) next[f.key] = v
      else if (old) next[f.key] = old
    }
    const changed =
      JSON.stringify(next) !== JSON.stringify(saved) || (d.mode === "sandbox") !== g.testMode
    if (g.enabled && g.mode === "online" && GATEWAY_FIELDS[gateway].some((f) => !next[f.key])) {
      throw new BadRequestError(
        `${g.name} is on for customers; fill in every key (or turn it off first)`,
        "VALIDATION_FAILED",
      )
    }
    await prisma.paymentGatewayConfig.update({
      where: { id: g.id },
      data: {
        secrets: Object.keys(next).length ? encrypt(JSON.stringify(next)) : null,
        testMode: d.mode === "sandbox",
        // New keys or mode: the old test result no longer says anything.
        ...(changed ? { keysTestedAt: null, keysTestOk: null, keysTestNote: null } : {}),
      },
    })
    return this.keys(code)
  }

  async testKeys(code: string) {
    const g = await this.method(code)
    const cfg = await loadConfig(this.storeId, code as OnlineGatewayCode)
    let ok = false
    let note: string
    if (!cfg) note = "Add the keys first"
    else {
      try {
        note = await gatewayFor(cfg, gatewayFetch).test()
        ok = true
      } catch (e) {
        note = e instanceof GatewayError ? e.message : "Couldn't check the keys"
        if (!(e instanceof GatewayError))
          logger.warn({ err: (e as Error).message, code }, "Gateway key test failed")
      }
    }
    await prisma.paymentGatewayConfig.update({
      where: { id: g.id },
      data: { keysTestedAt: new Date(), keysTestOk: ok, keysTestNote: note.slice(0, 300) },
    })
    return { ok, note }
  }

  // ================================================================ paying (storefront)

  /** The storefront address a checkout came from, if it's one of the store's own. */
  private async origin(
    origin: string | null | undefined,
    storefrontId: bigint | null,
  ): Promise<string> {
    const domains = await prisma.domain.findMany({
      where: { storeId: this.storeId },
      orderBy: [{ primary: "desc" }, { id: "asc" }],
    })
    const hosts = domains.map((d) => d.hostname.toLowerCase().replace(/^www\./, ""))
    const own =
      domains.find((d) => storefrontId !== null && d.storefrontId === storefrontId) ??
      domains.find((d) => !d.storefrontId) ??
      domains[0]
    const scheme = (h: string) => (/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(h) ? "http" : "https")
    const fallback = own ? `${scheme(own.hostname)}://${own.hostname}` : "http://localhost:3000"
    return storefrontOrigin(origin, hosts, fallback)
  }

  /**
   * Opens a try at paying an order online and returns the gateway's page. Throws a message the
   * customer can read when the gateway can't be opened (the order stays, unpaid).
   */
  async start(
    orderId: bigint,
    origin?: string | null,
  ): Promise<{ payUrl: string; attempt: string }> {
    const order = await prisma.order.findFirst({
      where: { id: orderId, storeId: this.storeId },
      include: { items: { select: { productName: true, quantity: true } }, paymentRecords: true },
    })
    if (!order) throw new NotFoundError("Order", String(orderId))
    const gateway = order.paymentGatewayCode
    if (!isOnlineGateway(gateway))
      throw new BadRequestError("This order isn't paid online", "BAD_REQUEST")
    if (["CANCELLED", "REFUNDED", "FAILED"].includes(order.status))
      throw new BadRequestError("This order was cancelled", "CONFLICT")
    if (["paid", "refunded", "partially_refunded"].includes(order.paymentStatus))
      throw new BadRequestError("This order is already paid", "ORDER_ALREADY_PAID")
    const g = await prisma.paymentGatewayConfig.findFirst({
      where: { storeId: this.storeId, code: gateway },
    })
    const cfg = await loadConfig(this.storeId, gateway)
    if (!g?.enabled || g.mode !== "online" || !cfg)
      throw new BadRequestError(
        `${NAMES[gateway]} payments aren't available right now. Please contact the shop.`,
        "PAYMENT_GATEWAY_ERROR",
      )
    if ((await prisma.paymentAttempt.count({ where: { orderId } })) >= MAX_ATTEMPTS)
      throw new BadRequestError(
        "Too many payment tries for this order. Please contact the shop.",
        "RATE_LIMITED",
      )
    const paid = order.paymentRecords
      .filter((r) => r.status === "verified" && (r.kind === "gateway" || r.kind === "transfer"))
      .reduce((s, r) => s + num(r.amount), 0)
    const amount = Math.round((num(order.grandTotal) - paid) * 100) / 100
    if (amount <= 0)
      throw new BadRequestError("Nothing is left to pay on this order", "ORDER_ALREADY_PAID")

    const code = attemptCode(order.number)
    const shop = await this.origin(origin, order.storefrontId)
    const attempt = await prisma.paymentAttempt.create({
      data: {
        storeId: this.storeId,
        orderId,
        gateway,
        code,
        amount,
        mode: cfg.mode,
        returnUrl: `${shop}/checkout/thank-you?key=${encodeURIComponent(order.orderKey)}`,
      },
    })
    try {
      const started = await gatewayFor(cfg, gatewayFetch).start({
        code,
        amount,
        returnUrl: `${apiBase()}/api/payments/return/${gateway}?attempt=${encodeURIComponent(code)}`,
        ipnUrl: `${apiBase()}/api/payments/ipn/${gateway}`,
        customer: {
          name: `${order.billingFirstName ?? ""} ${order.billingLastName ?? ""}`.trim(),
          phone: order.billingPhone ?? order.shippingPhone ?? "",
          email: order.billingEmail,
          address: order.billingAddress1 ?? order.shippingAddress1 ?? "",
          city: order.billingCity ?? order.shippingCity ?? "",
        },
        productName: order.items.map((i) => i.productName).join(", "),
        itemCount: order.items.reduce((s, i) => s + i.quantity, 0),
      })
      await prisma.paymentAttempt.update({
        where: { id: attempt.id },
        data: { reference: started.reference },
      })
      return { payUrl: started.payUrl, attempt: code }
    } catch (e) {
      const why = e instanceof GatewayError ? e.message : "The payment page couldn't be opened"
      if (!(e instanceof GatewayError))
        logger.error(
          { err: (e as Error).message, orderId: String(orderId) },
          "Couldn't start an online payment",
        )
      await prisma.paymentAttempt.update({
        where: { id: attempt.id },
        data: { status: "failed", note: why.slice(0, 300) },
      })
      throw new BadRequestError(
        `${NAMES[gateway]} couldn't be opened just now. Please try again in a minute.`,
        "PAYMENT_GATEWAY_ERROR",
      )
    }
  }

  /** "Pay now" on the order page: a new try for an unpaid online order found by its secret key. */
  async startByOrderKey(orderKey: string, origin?: string | null) {
    const order = await prisma.order.findFirst({
      where: { storeId: this.storeId, orderKey },
      select: { id: true },
    })
    if (!order) throw new NotFoundError("Order")
    return this.start(order.id, origin)
  }

  // ================================================================ back from the gateway

  /**
   * The customer is back (or SSLCommerz posted its notice): ask the gateway how the attempt ended
   * and settle it. Returns where to send the customer.
   */
  static async finish(
    gateway: OnlineGatewayCode,
    code: string,
    params: { valId?: string | null; result?: string | null } = {},
    seen: Seen = { source: "return" },
  ) {
    const attempt = await prisma.paymentAttempt.findUnique({ where: { code } })
    if (attempt?.gateway !== gateway) throw new NotFoundError("Payment")
    const back = (outcome: string) => `${attempt.returnUrl}&payment=${outcome}`
    const log = (outcome: string, note?: string | null) => logEvent({ storeId: attempt.storeId, attemptId: attempt.id, gateway, outcome, note, ...seen })
    if (isFinal(attempt.status)) {
      await log(attempt.status, "Already settled; nothing changed")
      return {
        outcome: attempt.status,
        redirect: back(attempt.status === "paid" ? "paid" : "review"),
      }
    }
    const cfg = await loadConfig(attempt.storeId, gateway)
    if (!cfg) {
      await log("pending", "No keys saved for this gateway")
      return { outcome: "pending", redirect: back("pending") }
    }
    let result: GatewayResult
    try {
      result = await gatewayFor(
        { ...cfg, mode: attempt.mode === "live" ? "live" : "sandbox" },
        gatewayFetch,
      ).confirm({
        reference: attempt.reference,
        code: attempt.code,
        valId: params.valId,
      })
    } catch (e) {
      logger.warn({ err: (e as Error).message, attempt: code }, "Couldn't check an online payment")
      await log("error", (e as Error).message)
      return { outcome: "pending", redirect: back("pending") }
    }
    // SSLCommerz's fail/cancel pages: nothing was paid when its API has nothing paid either.
    if (result.state === "pending" && (params.result === "fail" || params.result === "cancel")) {
      result = {
        ...result,
        state: params.result === "cancel" ? "cancelled" : "failed",
        message:
          params.result === "cancel" ? "Cancelled on SSLCommerz" : "Payment failed on SSLCommerz",
      }
    }
    const verdict = judge({ code: attempt.code, amount: num(attempt.amount) }, result)
    const outcome = await OnlinePaymentsService.settle(attempt.id, verdict, result)
    await log(outcome, verdict.note ?? result.message)
    return {
      outcome,
      redirect: back(outcome === "paid" ? "paid" : outcome === "review" ? "review" : outcome),
    }
  }

  /** Applies a verdict to a try once. Returns the try's status afterwards. */
  static async settle(attemptId: bigint, verdict: Verdict, result: GatewayResult): Promise<string> {
    if (verdict.status === "pending") return "pending"
    const attempt = await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: attemptId } })
    const ctx: RequestContext = {
      storeId: attempt.storeId,
      requestId: `payment-${attempt.code}`,
      locale: "en",
      currency: "BDT",
    }
    const payments = new PaymentsService(ctx)
    const name = NAMES[attempt.gateway as OnlineGatewayCode] ?? attempt.gateway
    const done = await tx(async (t: T) => {
      // Only the first answer to arrive moves a try out of "started" (or "failed": a later paid wins).
      const moved = await t.paymentAttempt.updateMany({
        where: {
          id: attemptId,
          status: {
            in:
              verdict.status === "paid" || verdict.status === "review"
                ? ["started", "failed", "cancelled"]
                : ["started"],
          },
        },
        data: {
          status: verdict.status,
          note: verdict.note,
          gatewayTxnId: result.txnId,
          raw: scrub(result.raw) as Prisma.InputJsonValue,
          ...(verdict.status === "paid" ? { paidAt: new Date() } : {}),
        },
      })
      if (moved.count === 0) return null
      if (verdict.status === "paid") {
        await t.paymentRecord.create({
          data: {
            storeId: attempt.storeId,
            orderId: attempt.orderId,
            kind: "gateway",
            method: attempt.gateway,
            amount: attempt.amount,
            transactionId: result.txnId,
            status: "verified",
            moneyIsWith: "gateway",
            submittedBy: "system",
            checkedAt: new Date(),
            note: `${name} ${attempt.mode === "live" ? "" : "(sandbox) "}payment ${attempt.code}`.replace(
              "  ",
              " ",
            ),
          },
        })
        const sync = await payments.syncTransfers(t, attempt.orderId)
        await t.orderStatusLog.create({
          data: {
            orderId: attempt.orderId,
            status: sync.orderStatus as never,
            note: `Paid online with ${name}: ৳${num(attempt.amount).toFixed(2)}${result.txnId ? `, transaction ${result.txnId}` : ""}`,
          },
        })
        return sync
      }
      if (verdict.status === "review") {
        const o = await t.order.findUniqueOrThrow({
          where: { id: attempt.orderId },
          select: { status: true },
        })
        await t.orderStatusLog.create({
          data: {
            orderId: attempt.orderId,
            status: o.status,
            note: `${name} payment needs a check: ${verdict.note ?? ""}`.slice(0, 500),
          },
        })
      }
      return { before: "", after: "", orderStatus: "" }
    })
    if (done && verdict.status === "paid") await payments.startIfPaid(attempt.orderId, done)
    const now = await prisma.paymentAttempt.findUniqueOrThrow({
      where: { id: attemptId },
      select: { status: true },
    })
    return now.status
  }

  /** SSLCommerz's payment notice (IPN): the tran_id says which try, the validation API says the rest. */
  static async ipn(gateway: OnlineGatewayCode, body: Record<string, unknown>, ip?: string | null) {
    const code = typeof body.tran_id === "string" ? body.tran_id : ""
    const valId = typeof body.val_id === "string" ? body.val_id : null
    if (!code) throw new BadRequestError("No tran_id", "BAD_REQUEST")
    return OnlinePaymentsService.finish(gateway, code, { valId }, { source: "ipn", payload: body, ip })
  }

  // ================================================================ refunds

  /**
   * Sends part of an order's online payment back through its gateway (a refund "to the original
   * method"). The amount is first reserved on the paid try with one conditional update, so two
   * refunds at once can't both reach the gateway. A clear refusal releases it; no answer at all
   * (a timeout) keeps it, since the gateway may have sent the money: staff check its panel.
   */
  async refundOnline(orderId: bigint, amount: number, reason: string) {
    const tries = await prisma.paymentAttempt.findMany({ where: { orderId, storeId: this.storeId, status: "paid" }, orderBy: { paidAt: "asc" } })
    if (!tries.length) return null
    const left = (t: (typeof tries)[number]) => Math.round((num(t.amount) - num(t.refundedAmount)) * 100) / 100
    const a = tries.find((t) => left(t) >= amount - 0.009)
    const name = NAMES[tries[0]!.gateway as OnlineGatewayCode] ?? tries[0]!.gateway
    if (!a) {
      const most = Math.max(...tries.map(left))
      throw new BadRequestError(
        most > 0 ? `At most ৳${most.toFixed(2)} can go back through ${name} in one refund` : `This order's ${name} payment has already been refunded`,
        "REFUND_AMOUNT_EXCEEDS_PAID",
      )
    }
    const gateway = a.gateway as OnlineGatewayCode
    const cfg = await loadConfig(this.storeId, gateway)
    if (!cfg) throw new BadRequestError(`Add your ${name} keys to refund through ${name}, or refund another way`, "PAYMENT_GATEWAY_ERROR")
    if (!a.gatewayTxnId) throw new BadRequestError(`${name} gave no transaction id for this payment; refund another way`, "PAYMENT_GATEWAY_ERROR")
    const reserved = await prisma.$executeRaw`UPDATE "PaymentAttempt" SET "refundedAmount" = "refundedAmount" + ${amount} WHERE id = ${a.id} AND "refundedAmount" + ${amount} <= "amount" + 0.009`
    if (reserved === 0) throw new ConflictError("Another refund on this payment is going through; reload the order and try again")
    const log = (outcome: string, note: string | null, payload?: Record<string, unknown>) =>
      logEvent({ storeId: this.storeId, attemptId: a.id, gateway, source: "refund", outcome, note, payload })
    try {
      const r = await gatewayFor({ ...cfg, mode: a.mode === "live" ? "live" : "sandbox" }, gatewayFetch).refund({
        reference: a.reference,
        txnId: a.gatewayTxnId,
        amount,
        reason,
      })
      await log(r.state, `৳${amount.toFixed(2)}${r.ref ? `, refund ${r.ref}` : ""}`, r.raw)
      return { attemptId: a.id, gateway, name, state: r.state, ref: r.ref }
    } catch (e) {
      const answered = e instanceof GatewayError && e.httpStatus !== undefined
      if (answered) {
        await prisma.$executeRaw`UPDATE "PaymentAttempt" SET "refundedAmount" = GREATEST(0, "refundedAmount" - ${amount}) WHERE id = ${a.id}`
        await log("error", (e as Error).message)
        throw new BadRequestError(`${name} didn't send the money back: ${(e as Error).message}. Nothing was refunded; try again or refund another way.`, "PAYMENT_GATEWAY_ERROR")
      }
      await log("unknown", (e as Error).message)
      logger.error({ err: (e as Error).message, attempt: a.code }, "Gateway refund: no answer")
      throw new BadRequestError(
        `${name} didn't answer, so we can't tell whether the money went back. Check the ${name} merchant panel before trying again.`,
        "PAYMENT_GATEWAY_ERROR",
      )
    }
  }

  /** A refund SSLCommerz was still processing: ask how it ended and update the refund. */
  async checkRefund(refundId: bigint) {
    const rf = await prisma.refund.findFirst({ where: { id: refundId, storeId: this.storeId }, include: { paymentAttempt: true } })
    if (!rf?.paymentAttempt) throw new NotFoundError("Refund")
    if (rf.gatewayStatus !== "processing" || !rf.gatewayTransactionId) return { status: rf.gatewayStatus }
    const a = rf.paymentAttempt
    const gateway = a.gateway as OnlineGatewayCode
    const cfg = await loadConfig(this.storeId, gateway)
    if (!cfg) throw new BadRequestError("The gateway's keys aren't saved", "PAYMENT_GATEWAY_ERROR")
    const r = await gatewayFor({ ...cfg, mode: a.mode === "live" ? "live" : "sandbox" }, gatewayFetch).refundStatus(rf.gatewayTransactionId)
    await logEvent({ storeId: this.storeId, attemptId: a.id, gateway, source: "refund_check", outcome: r.state, note: `Refund ${rf.gatewayTransactionId}`, payload: r.raw })
    if (r.state === "processing") return { status: "processing" }
    const note = r.state === "done" ? `Refunded by ${NAMES[gateway]}` : `${NAMES[gateway]} didn't complete the refund: pay it back another way`
    await tx(async (t: T) => {
      await t.refund.update({ where: { id: rf.id }, data: { gatewayStatus: r.state, gatewayRefunded: r.state === "done", gatewayNote: note } })
      if (r.state === "failed") await t.$executeRaw`UPDATE "PaymentAttempt" SET "refundedAmount" = GREATEST(0, "refundedAmount" - ${rf.amount}) WHERE id = ${a.id}`
      await t.orderStatusLog.create({ data: { orderId: rf.orderId, status: (await t.order.findUniqueOrThrow({ where: { id: rf.orderId }, select: { status: true } })).status, note: `৳${num(rf.amount).toFixed(2)} refund: ${note}` } })
    })
    return { status: r.state }
  }

  // ================================================================ staff

  /** An order's online payment tries, newest first (for the order page). */
  async attempts(orderId: bigint) {
    const rows = await prisma.paymentAttempt.findMany({
      where: { orderId, storeId: this.storeId },
      include: { events: { orderBy: { createdAt: "desc" }, take: 10 } },
      orderBy: { createdAt: "desc" },
      take: 20,
    })
    return rows.map((a) => ({
      id: String(a.id),
      gateway: a.gateway,
      code: a.code,
      amount: num(a.amount),
      refundedAmount: num(a.refundedAmount),
      mode: a.mode,
      status: a.status,
      transactionId: a.gatewayTxnId,
      note: a.note,
      createdAt: a.createdAt,
      paidAt: a.paidAt,
      /** What the gateway sent or answered about it (newest first). */
      events: a.events.map((e) => ({ source: e.source, outcome: e.outcome, note: e.note, at: e.createdAt })),
    }))
  }


  /** Staff: ask the gateway again about a try that's still open (the customer closed the tab …). */
  async recheck(attemptId: bigint) {
    const a = await prisma.paymentAttempt.findFirst({
      where: { id: attemptId, storeId: this.storeId },
    })
    if (!a) throw new NotFoundError("Payment try")
    const { outcome } = await OnlinePaymentsService.finish(a.gateway as OnlineGatewayCode, a.code, {}, { source: "recheck" })
    return { status: outcome }
  }
}
