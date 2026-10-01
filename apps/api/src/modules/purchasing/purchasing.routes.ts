/**
 * PURCHASING ROUTES (/api/admin/purchasing, permissions purchasing.* and money_accounts.*)
 *   GET|POST /suppliers, GET|PATCH|DELETE /suppliers/:id
 *   GET|POST /grades, DELETE /grades/:id                  quality grades for purchase lines
 *   GET|POST /purchases, GET /purchases/:id, POST /purchases/:id/cancel
 *   POST /purchases/:id/receive, POST /purchases/:id/close   purchase orders: deliveries, close short
 *   GET|POST /returns, GET /returns/:id, POST /returns/:id/cancel   goods sent back to suppliers
 *   GET|POST /payments, DELETE /payments/:id              supplier payments (delete puts the money back)
 *   GET|POST /accounts, PATCH /accounts/:id, GET /accounts/:id/ledger, POST /accounts/move
 */
import { Router, type Request, type Response } from "express"
import type { z } from "zod"
import { ctrl, envelope, type RequestContext } from "../../core"
import { authMiddleware, rbacMiddleware, validate } from "../../middleware"
import { PurchasingService } from "./purchasing.service"
import {
  AccountDto,
  GradeDto,
  IdParam,
  MoveMoneyDto,
  PageQuery,
  PaymentDto,
  PaymentsQuery,
  PickQuery,
  PurchaseDto,
  PurchasesQuery,
  ReceiveDto,
  ReturnsQuery,
  SupplierReturnDto,
  SupplierDto,
  SupplierQuery,
  UpdateAccountDto,
  UpdateSupplierDto,
} from "./purchasing.dto"

type Req = Request & { ctx: RequestContext }
const svc = (req: Req) => new PurchasingService(req.ctx)
const id = (req: Req) => BigInt((req.params as { id: string }).id)
const body = <S extends z.ZodTypeAny>(req: Req) => req.body as z.infer<S>
const query = <S extends z.ZodTypeAny>(req: Req) => req.query as unknown as z.infer<S>

export const adminPurchasingRouter = Router()
adminPurchasingRouter.use(authMiddleware("adminOrSuper"))

// ---- suppliers
adminPurchasingRouter.get(
  "/suppliers",
  rbacMiddleware("purchasing.view"),
  validate({ query: SupplierQuery }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).suppliers(query<typeof SupplierQuery>(req)) })
  }),
)
adminPurchasingRouter.post(
  "/suppliers",
  rbacMiddleware("purchasing.create"),
  validate({ body: SupplierDto }),
  ctrl(async (req: Req, res: Response) => {
    const b = body<typeof SupplierDto>(req)
    envelope(res, {
      status: 201,
      data: await svc(req).createSupplier(b),
      message: "Supplier added",
    })
  }),
)
adminPurchasingRouter.get(
  "/suppliers/:id",
  rbacMiddleware("purchasing.view"),
  validate({ params: IdParam }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).supplier(id(req)) })
  }),
)
adminPurchasingRouter.patch(
  "/suppliers/:id",
  rbacMiddleware("purchasing.edit"),
  validate({ params: IdParam, body: UpdateSupplierDto }),
  ctrl(async (req: Req, res: Response) => {
    const b = body<typeof UpdateSupplierDto>(req)
    envelope(res, {
      data: await svc(req).updateSupplier(id(req), b),
      message: "Supplier saved",
    })
  }),
)
adminPurchasingRouter.delete(
  "/suppliers/:id",
  rbacMiddleware("purchasing.delete"),
  validate({ params: IdParam }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).deleteSupplier(id(req)), message: "Supplier deleted" })
  }),
)

// ---- product picker for purchase lines
adminPurchasingRouter.get(
  "/pick/products",
  rbacMiddleware("purchasing.view"),
  validate({ query: PickQuery }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).pickProducts(query<typeof PickQuery>(req).search) })
  }),
)

// ---- quality grades
adminPurchasingRouter.get(
  "/grades",
  rbacMiddleware("purchasing.view"),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).grades() })
  }),
)
adminPurchasingRouter.post(
  "/grades",
  rbacMiddleware("purchasing.create"),
  validate({ body: GradeDto }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { status: 201, data: await svc(req).addGrade(body<typeof GradeDto>(req).name) })
  }),
)
adminPurchasingRouter.delete(
  "/grades/:id",
  rbacMiddleware("purchasing.delete"),
  validate({ params: IdParam }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).deleteGrade(id(req)) })
  }),
)

// ---- purchases
adminPurchasingRouter.get(
  "/purchases",
  rbacMiddleware("purchasing.view"),
  validate({ query: PurchasesQuery }),
  ctrl(async (req: Req, res: Response) => {
    const r = await svc(req).purchases(query<typeof PurchasesQuery>(req))
    envelope(res, { data: r.items, meta: r.meta })
  }),
)
adminPurchasingRouter.post(
  "/purchases",
  rbacMiddleware("purchasing.create"),
  validate({ body: PurchaseDto }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, {
      status: 201,
      data: await svc(req).createPurchase(body<typeof PurchaseDto>(req)),
      message: body<typeof PurchaseDto>(req).receiveNow === false ? "Purchase order saved" : "Purchase recorded and stock added",
    })
  }),
)
adminPurchasingRouter.get(
  "/purchases/:id",
  rbacMiddleware("purchasing.view"),
  validate({ params: IdParam }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).purchase(id(req)) })
  }),
)
adminPurchasingRouter.post(
  "/purchases/:id/cancel",
  rbacMiddleware("purchasing.delete"),
  validate({ params: IdParam }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, {
      data: await svc(req).cancelPurchase(id(req)),
      message: "Purchase cancelled and its stock removed",
    })
  }),
)

adminPurchasingRouter.post(
  "/purchases/:id/receive",
  rbacMiddleware("purchasing.create"),
  validate({ params: IdParam, body: ReceiveDto }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).receivePurchase(id(req), body<typeof ReceiveDto>(req)), message: "Delivery received and stock added" })
  }),
)
adminPurchasingRouter.post(
  "/purchases/:id/close",
  rbacMiddleware("purchasing.create"),
  validate({ params: IdParam }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).closePurchase(id(req)), message: "Order closed" })
  }),
)

// ---- returns to suppliers
adminPurchasingRouter.get(
  "/returns",
  rbacMiddleware("purchasing.view"),
  validate({ query: ReturnsQuery }),
  ctrl(async (req: Req, res: Response) => {
    const r = await svc(req).returns(query<typeof ReturnsQuery>(req))
    envelope(res, { data: r.items, meta: r.meta })
  }),
)
adminPurchasingRouter.post(
  "/returns",
  rbacMiddleware("purchasing.create"),
  validate({ body: SupplierReturnDto }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { status: 201, data: await svc(req).createReturn(body<typeof SupplierReturnDto>(req)), message: "Return recorded and stock removed" })
  }),
)
adminPurchasingRouter.get(
  "/returns/:id",
  rbacMiddleware("purchasing.view"),
  validate({ params: IdParam }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).supplierReturn(id(req)) })
  }),
)
adminPurchasingRouter.post(
  "/returns/:id/cancel",
  rbacMiddleware("purchasing.delete"),
  validate({ params: IdParam }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).cancelReturn(id(req)), message: "Return cancelled and stock put back" })
  }),
)

// ---- supplier payments
adminPurchasingRouter.get(
  "/payments",
  rbacMiddleware("purchasing.view"),
  validate({ query: PaymentsQuery }),
  ctrl(async (req: Req, res: Response) => {
    const r = await svc(req).payments(query<typeof PaymentsQuery>(req))
    envelope(res, { data: r.items, meta: r.meta })
  }),
)
adminPurchasingRouter.post(
  "/payments",
  rbacMiddleware("purchasing.create"),
  validate({ body: PaymentDto }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, {
      status: 201,
      data: await svc(req).pay(body<typeof PaymentDto>(req)),
      message: "Payment recorded",
    })
  }),
)
adminPurchasingRouter.delete(
  "/payments/:id",
  rbacMiddleware("purchasing.delete"),
  validate({ params: IdParam }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, {
      data: await svc(req).voidPayment(id(req)),
      message: "Payment undone; the money is back in its account",
    })
  }),
)

// ---- money accounts
adminPurchasingRouter.get(
  "/accounts",
  rbacMiddleware("money_accounts.view"),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await svc(req).accounts() })
  }),
)
adminPurchasingRouter.post(
  "/accounts",
  rbacMiddleware("money_accounts.create"),
  validate({ body: AccountDto }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, {
      status: 201,
      data: await svc(req).createAccount(body<typeof AccountDto>(req)),
      message: "Account added",
    })
  }),
)
adminPurchasingRouter.post(
  "/accounts/move",
  rbacMiddleware("money_accounts.edit"),
  validate({ body: MoveMoneyDto }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, {
      data: await svc(req).moveMoney(body<typeof MoveMoneyDto>(req)),
      message: "Recorded",
    })
  }),
)
adminPurchasingRouter.patch(
  "/accounts/:id",
  rbacMiddleware("money_accounts.edit"),
  validate({ params: IdParam, body: UpdateAccountDto }),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, {
      data: await svc(req).updateAccount(id(req), body<typeof UpdateAccountDto>(req)),
      message: "Account saved",
    })
  }),
)
adminPurchasingRouter.get(
  "/accounts/:id/ledger",
  rbacMiddleware("money_accounts.view"),
  validate({ params: IdParam, query: PageQuery }),
  ctrl(async (req: Req, res: Response) => {
    const r = await svc(req).ledger(id(req), query<typeof PageQuery>(req))
    envelope(res, { data: r, meta: r.meta })
  }),
)
