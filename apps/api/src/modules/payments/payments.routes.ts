/**
 * PAYMENT ROUTES
 *   GET  /api/admin/payments                     transfers to verify (?status, method, search) or COD cash (?kind=cod)
 *   POST /api/admin/payments/:id/verify          { amount?, note? } — the money is in the account
 *   POST /api/admin/payments/:id/reject          { reason } — the customer sees the reason
 *   POST /api/admin/payments/:id/not-collected   { reason } — COD cash the courier didn't get
 *   GET|POST /api/admin/orders/:id/payments      an order's payments / staff record a transfer
 *   GET  /api/admin/cod/summary                  cash with couriers, in hand, not shipped; owed by courier
 *   POST /api/admin/cod/confirm                  { ids } — cash counted at the shop
 *   GET|POST /api/admin/cod/settlements          courier payouts (flags shortfalls)
 *   GET  /api/admin/cod/settlements/:id
 *   POST /api/admin/cod/settlements/:id/resolve  { note }
 *   GET  /api/admin/payment-methods              payment method settings
 *   PATCH /api/admin/payment-methods/:code
 *   GET|PUT /api/admin/payment-methods/:code/keys    bKash / SSLCommerz merchant keys (masked; blank keeps)
 *   POST /api/admin/payment-methods/:code/keys/test  checks the keys with the gateway
 *   POST /api/admin/payments/attempts/:id/recheck    asks the gateway again about an online payment try
 *   POST /api/admin/payments/refunds/:id/check       how a refund SSLCommerz was still processing ended
 *   POST /api/storefront/account/orders/:orderRef/payments   the customer reports a transfer
 *   POST /api/storefront/checkout/orders/:orderKey/payment   same, from the thank-you page (no login)
 *   POST /api/storefront/checkout/orders/:orderKey/pay       a new online payment try ("Pay now")
 *   GET|POST /api/payments/return/:gateway?attempt=           back from bKash / SSLCommerz (redirects)
 *   POST /api/payments/ipn/sslcommerz                         SSLCommerz's payment notice
 */
import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { prisma } from "../../config";
import { NotFoundError, ctrl, envelope, type RequestContext } from "../../core";
import { authMiddleware, rbacMiddleware, validate } from "../../middleware";
import { PaymentsService } from "./payments.service";
import { OnlinePaymentsService } from "./gateways/online.service";
import { isOnlineGateway } from "./gateways/gateway.rules";
import {
  CodeParam,
  ConfirmCashDto,
  CreateSettlementDto,
  IdParam,
  NotCollectedDto,
  PaymentListDto,
  RejectDto,
  ResolveSettlementDto,
  SettlementListDto,
  StaffTransferDto,
  SubmitTransferDto,
  UpdatePaymentMethodDto,
  VerifyDto,
  GatewayKeysDto,
} from "./payments.dto";

type Req = Request & { ctx: RequestContext };
const svc = (req: Req) => new PaymentsService(req.ctx);
const id = (req: Req) => BigInt((req.params as { id: string }).id);
const send = (run: (req: Req) => Promise<unknown>, status = 200) =>
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { status, data: await run(req) });
  });
const paged = (run: (req: Req) => Promise<{ items: unknown; counts: unknown; meta: unknown }>) =>
  ctrl(async (req: Req, res: Response) => {
    const out = await run(req);
    envelope(res, { status: 200, data: { items: out.items, counts: out.counts }, meta: out.meta as never });
  });

export const adminPaymentRecordsRouter = Router();
adminPaymentRecordsRouter.use(authMiddleware("adminOrSuper"));
adminPaymentRecordsRouter.get("/", rbacMiddleware("payments.view"), validate({ query: PaymentListDto }), paged((r) => svc(r).listPayments(r.query as unknown as PaymentListDto)));
adminPaymentRecordsRouter.post("/:id/verify", rbacMiddleware("payments.edit"), validate({ params: IdParam, body: VerifyDto }), send((r) => svc(r).verify(id(r), r.body as VerifyDto)));
adminPaymentRecordsRouter.post("/:id/reject", rbacMiddleware("payments.edit"), validate({ params: IdParam, body: RejectDto }), send((r) => svc(r).reject(id(r), r.body as RejectDto)));
adminPaymentRecordsRouter.post("/:id/not-collected", rbacMiddleware("payments.edit"), validate({ params: IdParam, body: NotCollectedDto }), send((r) => svc(r).markNotCollected(id(r), r.body as NotCollectedDto)));
adminPaymentRecordsRouter.post("/refunds/:id/check", rbacMiddleware("payments.edit"), validate({ params: IdParam }), send((r) => online(r).checkRefund(id(r))));
adminPaymentRecordsRouter.post("/attempts/:id/recheck", rbacMiddleware("payments.edit"), validate({ params: IdParam }), send((r) => online(r).recheck(id(r))));

/** Mounted on /api/admin/orders before the orders router. */
export const adminOrderPaymentsRouter = Router();
adminOrderPaymentsRouter.get("/:id/payments", authMiddleware("adminOrSuper"), rbacMiddleware("payments.view"), validate({ params: IdParam }), send((r) => svc(r).orderPayments(id(r))));
adminOrderPaymentsRouter.post(
  "/:id/payments",
  authMiddleware("adminOrSuper"),
  rbacMiddleware("payments.edit"),
  validate({ params: IdParam, body: StaffTransferDto }),
  send((r) => svc(r).submitTransfer(id(r), r.body as StaffTransferDto, "staff"), 201),
);

export const adminCodRouter = Router();
adminCodRouter.use(authMiddleware("adminOrSuper"));
adminCodRouter.get("/summary", rbacMiddleware("payments.view"), send((r) => svc(r).codSummary()));
adminCodRouter.post("/confirm", rbacMiddleware("payments.edit"), validate({ body: ConfirmCashDto }), send((r) => svc(r).confirmCash(r.body as ConfirmCashDto)));
adminCodRouter.get("/settlements", rbacMiddleware("payments.view"), validate({ query: SettlementListDto }), paged((r) => svc(r).listSettlements(r.query as unknown as SettlementListDto)));
adminCodRouter.post("/settlements", rbacMiddleware("payments.edit"), validate({ body: CreateSettlementDto }), send((r) => svc(r).createSettlement(r.body as CreateSettlementDto), 201));
adminCodRouter.get("/settlements/:id", rbacMiddleware("payments.view"), validate({ params: IdParam }), send((r) => svc(r).getSettlement(id(r))));
adminCodRouter.post(
  "/settlements/:id/resolve",
  rbacMiddleware("payments.edit"),
  validate({ params: IdParam, body: ResolveSettlementDto }),
  send((r) => svc(r).resolveSettlement(id(r), (r.body as ResolveSettlementDto).note)),
);

export const adminPaymentMethodsRouter = Router();
adminPaymentMethodsRouter.use(authMiddleware("adminOrSuper"));
adminPaymentMethodsRouter.get("/", rbacMiddleware("settings.view"), send((r) => svc(r).listMethods()));
adminPaymentMethodsRouter.patch(
  "/:code",
  rbacMiddleware("settings.edit"),
  validate({ params: CodeParam, body: UpdatePaymentMethodDto }),
  send((r) => svc(r).updateMethod((r.params as { code: string }).code, r.body as UpdatePaymentMethodDto)),
);
const online = (req: Req) => new OnlinePaymentsService(req.ctx);
const code = (req: Req) => (req.params as { code: string }).code;
adminPaymentMethodsRouter.get("/:code/keys", rbacMiddleware("settings.view"), validate({ params: CodeParam }), send((r) => online(r).keys(code(r))));
adminPaymentMethodsRouter.put(
  "/:code/keys",
  rbacMiddleware("settings.edit"),
  validate({ params: CodeParam, body: GatewayKeysDto }),
  send((r) => online(r).saveKeys(code(r), r.body as z.infer<typeof GatewayKeysDto>)),
);
adminPaymentMethodsRouter.post("/:code/keys/test", rbacMiddleware("settings.edit"), validate({ params: CodeParam }), send((r) => online(r).testKeys(code(r))));

// ------------------------------------------------------------------ storefront

const reply = (p: { transactionId: string | null; status: string; amount: unknown }) => ({
  transactionId: p.transactionId,
  status: p.status,
  amount: Number(p.amount),
});

/** Mounted on /api/storefront/account before the account router. */
export const storefrontAccountPaymentsRouter = Router();
const OrderRef = z.object({ orderRef: z.string().min(3).max(40) });
storefrontAccountPaymentsRouter.post(
  "/orders/:orderRef/payments",
  authMiddleware("customer"),
  validate({ params: OrderRef, body: SubmitTransferDto }),
  send(async (r) => {
    const { orderRef } = r.params as unknown as z.infer<typeof OrderRef>;
    const o = await prisma.order.findFirst({ where: { storeId: r.ctx.storeId, number: orderRef, customerId: r.ctx.customer?.id }, select: { id: true } });
    if (!o) throw new NotFoundError("Order", orderRef);
    return reply(await svc(r).submitTransfer(o.id, r.body as SubmitTransferDto, "customer"));
  }, 201),
);

/** Mounted on /api/storefront/checkout; the order key (from the thank-you link) is the secret. */
export const storefrontCheckoutPaymentsRouter = Router();
const OrderKey = z.object({ orderKey: z.string().min(10).max(80) });
storefrontCheckoutPaymentsRouter.post(
  "/orders/:orderKey/pay",
  authMiddleware("optional"),
  validate({ params: OrderKey }),
  send(async (r) => {
    const { orderKey } = r.params as unknown as z.infer<typeof OrderKey>;
    return online(r).startByOrderKey(orderKey, r.get("origin") ?? r.get("referer"));
  }),
);
storefrontCheckoutPaymentsRouter.post(
  "/orders/:orderKey/payment",
  authMiddleware("optional"),
  validate({ params: OrderKey, body: SubmitTransferDto }),
  send(async (r) => {
    const { orderKey } = r.params as unknown as z.infer<typeof OrderKey>;
    const o = await prisma.order.findFirst({ where: { storeId: r.ctx.storeId, orderKey }, select: { id: true } });
    if (!o) throw new NotFoundError("Order");
    return reply(await svc(r).submitTransfer(o.id, r.body as SubmitTransferDto, "customer"));
  }, 201),
);

// ------------------------------------------------------------------ back from the gateway (public)

/** Where the gateway sends the customer back: checks the payment with the gateway, then redirects to the order page. */
export const paymentReturnRouter = Router();
const Gateway = z.object({ gateway: z.string().refine(isOnlineGateway, "Unknown gateway") });
const Back = z.object({ attempt: z.string().min(5).max(80), result: z.string().max(20).optional() }).passthrough();
paymentReturnRouter.all("/:gateway", validate({ params: Gateway, query: Back }), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const gateway = (req.params as { gateway: string }).gateway;
    if (!isOnlineGateway(gateway)) throw new NotFoundError("Payment");
    const q = req.query as unknown as z.infer<typeof Back>;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const valId = typeof body.val_id === "string" ? body.val_id : null;
    const { redirect } = await OnlinePaymentsService.finish(
      gateway,
      q.attempt,
      { valId, result: q.result ?? null },
      { source: "return", payload: { ...(req.query as Record<string, unknown>), ...body }, ip: req.ip },
    );
    res.redirect(303, redirect);
  } catch (e) {
    next(e);
  }
});

/** SSLCommerz's payment notice (form post). bKash Checkout has no notice: its return is checked instead. */
export const paymentIpnRouter = Router();
paymentIpnRouter.post("/sslcommerz", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { outcome } = await OnlinePaymentsService.ipn("sslcommerz", (req.body ?? {}) as Record<string, unknown>, req.ip);
    res.status(200).json({ received: true, status: outcome });
  } catch (e) {
    next(e);
  }
});
