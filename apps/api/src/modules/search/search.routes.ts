/**
 * ADMIN SEARCH — GET /api/admin/search?q= (store staff), for the admin's Ctrl+K box. Up to 5 orders
 * (by number, phone, name or email; only the staff member's storefronts), customers (name, phone,
 * email) and products (name or SKU, not in the Trash). Each group only for those with its view
 * permission; the others come back empty.
 */
import { Router, type Request, type Response } from "express"
import { z } from "zod"
import { hasPermission } from "@ecom/shared-types"
import { prisma } from "../../config"
import { ctrl, envelope, type RequestContext } from "../../core"
import { authMiddleware, validate } from "../../middleware"
import { staffOrderScope } from "../storefronts/storefronts.context"

const LIMIT = 5
const SearchQuery = z.object({ q: z.string().trim().min(2, "Type at least 2 letters").max(100) })

const may = (ctx: RequestContext, code: string) => !!ctx.super || hasPermission(ctx.admin?.permissions ?? [], code)

/** Phone numbers are matched on their digits, so "01711-000101" finds 01711000101. */
const digitsOf = (q: string) => q.replace(/\D/g, "")

export async function adminSearch(ctx: RequestContext, q: string) {
  const storeId = ctx.storeId!
  const digits = digitsOf(q)
  const phone = digits.length >= 4 ? [{ contains: digits }] : []
  const text = { contains: q, mode: "insensitive" as const }
  const [orders, customers, products] = await Promise.all([
    may(ctx, "orders.view")
      ? prisma.order.findMany({
          where: {
            storeId,
            ...staffOrderScope(ctx),
            OR: [{ number: text }, { billingFirstName: text }, { billingLastName: text }, { billingEmail: text }, ...phone.map((p) => ({ billingPhone: p }))],
          },
          orderBy: { id: "desc" },
          take: LIMIT,
          select: { id: true, number: true, billingFirstName: true, billingLastName: true, billingPhone: true, grandTotal: true, status: true, createdAt: true },
        })
      : [],
    may(ctx, "customers.view")
      ? prisma.customer.findMany({
          where: { storeId, OR: [{ firstName: text }, { lastName: text }, { email: text }, ...phone.map((p) => ({ phone: p }))] },
          orderBy: { id: "desc" },
          take: LIMIT,
          select: { id: true, firstName: true, lastName: true, phone: true, email: true, orderCount: true },
        })
      : [],
    may(ctx, "products.view")
      ? prisma.product.findMany({
          where: { storeId, deletedAt: null, OR: [{ name: text }, { sku: text }] },
          orderBy: { id: "desc" },
          take: LIMIT,
          select: { id: true, name: true, sku: true, status: true, stockQty: true },
        })
      : [],
  ])
  return {
    orders: orders.map((o) => ({
      id: String(o.id),
      number: o.number,
      customer: `${o.billingFirstName} ${o.billingLastName}`.trim(),
      phone: o.billingPhone,
      total: Number(o.grandTotal),
      status: o.status,
      createdAt: o.createdAt.toISOString(),
    })),
    customers: customers.map((c) => ({ id: String(c.id), name: `${c.firstName} ${c.lastName}`.trim(), phone: c.phone, email: c.email, orders: c.orderCount })),
    products: products.map((p) => ({ id: String(p.id), name: p.name, sku: p.sku, status: p.status, stock: p.stockQty })),
  }
}

export const adminSearchRouter = Router()
adminSearchRouter.get(
  "/",
  authMiddleware("adminOrSuper"),
  validate({ query: SearchQuery }),
  ctrl(async (req: Request & { ctx: RequestContext }, res: Response) => {
    envelope(res, { data: await adminSearch(req.ctx, (req.query as unknown as z.infer<typeof SearchQuery>).q) })
  }),
)
