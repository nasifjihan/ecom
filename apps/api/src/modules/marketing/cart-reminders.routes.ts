/**
 * Marketing > Abandoned carts (mounted at /api/admin/marketing/abandoned-carts): the reminder
 * settings, and what was abandoned, reminded and won back over a period.
 */
import { Router, type Request, type Response } from "express"
import { z } from "zod"
import { prisma } from "../../config"
import { BadRequestError, ctrl, envelope, type RequestContext } from "../../core"
import { authMiddleware, rbacMiddleware, validate } from "../../middleware"
import { reminderSettings } from "./cart-reminders"

type Req = Request & { ctx: RequestContext }
const storeOf = (r: Req) => {
  if (r.ctx.storeId === undefined) throw new BadRequestError("No store for this request", "STORE_REQUIRED")
  return BigInt(r.ctx.storeId)
}

export const SettingsDto = z.object({
  enabled: z.boolean(),
  firstDelayMinutes: z.coerce.number().int().min(30, "At least 30 minutes").max(24 * 60, "At most 24 hours"),
  secondEnabled: z.boolean(),
  secondDelayHours: z.coerce.number().int().min(6).max(7 * 24),
  couponCode: z.string().trim().toUpperCase().max(40).optional().nullable().transform((v) => v || null),
  sms: z.boolean(),
  email: z.boolean(),
})
type SettingsDto = z.infer<typeof SettingsDto>

const ReportQuery = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
})

export const adminCartRemindersRouter = Router()
adminCartRemindersRouter.use(authMiddleware("adminOrSuper"))

adminCartRemindersRouter.get(
  "/settings",
  rbacMiddleware("promotions.view"),
  ctrl(async (req: Req, res: Response) => {
    envelope(res, { data: await reminderSettings(storeOf(req)) })
  }),
)
adminCartRemindersRouter.put(
  "/settings",
  rbacMiddleware("promotions.edit"),
  validate({ body: SettingsDto }),
  ctrl(async (req: Req, res: Response) => {
    const storeId = storeOf(req)
    const dto = req.body as SettingsDto
    if (dto.enabled && !dto.sms && !dto.email) throw new BadRequestError("Choose SMS, email or both", "VALIDATION_FAILED")
    if (dto.couponCode && !(await prisma.coupon.count({ where: { storeId, code: dto.couponCode } })))
      throw new BadRequestError(`There's no coupon ${dto.couponCode}. Make it in Marketing → Coupons first.`, "VALIDATION_FAILED")
    await prisma.cartReminderSettings.upsert({ where: { storeId }, create: { storeId, ...dto }, update: dto })
    envelope(res, { data: await reminderSettings(storeId), message: "Cart reminders saved" })
  }),
)

/** Totals for the period (by when the cart was reminded) and the carts themselves, newest first. */
adminCartRemindersRouter.get(
  "/",
  rbacMiddleware("promotions.view"),
  validate({ query: ReportQuery }),
  ctrl(async (req: Req, res: Response) => {
    const storeId = storeOf(req)
    const q = req.query as unknown as z.infer<typeof ReportQuery>
    const when = { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lte: q.to } : {}) }
    const where = { storeId, ...(q.from || q.to ? { createdAt: when } : {}) }
    const [abandoned, reminded, recovered, value, rows, total] = await Promise.all([
      prisma.abandonedCart.count({ where }),
      prisma.abandonedCart.count({ where: { ...where, reminderSentAt: { not: null } } }),
      prisma.abandonedCart.count({ where: { ...where, recoveredAt: { not: null } } }),
      prisma.abandonedCart.findMany({ where: { ...where, recoveredOrderId: { not: null } }, select: { recoveredOrderId: true } }),
      prisma.abandonedCart.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (q.page - 1) * q.perPage,
        take: q.perPage,
        include: { cart: { select: { items: { select: { quantity: true, product: { select: { name: true } } } } } } },
      }),
      prisma.abandonedCart.count({ where }),
    ])
    const orders = await prisma.order.findMany({
      where: { storeId, id: { in: [...new Set([...value, ...rows].map((r) => r.recoveredOrderId).filter((x): x is bigint => !!x))] } },
      select: { id: true, number: true, grandTotal: true },
    })
    const orderOf = (id: bigint | null) => orders.find((o) => o.id === id)
    const recoveredSales = value.reduce((n, r) => n + Number(orderOf(r.recoveredOrderId)?.grandTotal ?? 0), 0)
    envelope(res, {
      data: {
        totals: { abandoned, reminded, recovered, recoveredSales: Math.round(recoveredSales * 100) / 100 },
        items: rows.map((r) => ({
          id: String(r.id),
          contact: [r.firstName, r.phone, r.customerEmail].filter(Boolean).join(" · "),
          items: r.cart.items.map((i) => `${i.quantity} × ${i.product.name}`),
          value: Number(r.totalAmount),
          createdAt: r.createdAt.toISOString(),
          reminders: r.reminder2SentAt ? 2 : r.reminderSentAt ? 1 : 0,
          recoveredAt: r.recoveredAt?.toISOString() ?? null,
          order: orderOf(r.recoveredOrderId) ? { id: String(r.recoveredOrderId), number: orderOf(r.recoveredOrderId)!.number } : null,
        })),
        meta: { page: q.page, perPage: q.perPage, total, totalPages: Math.max(1, Math.ceil(total / q.perPage)) },
      },
    })
  }),
)
