/**
 * EXPORT SHEETS — orders and customers as CSV or Excel, read in batches of 1,000 so a big shop's
 * export doesn't hold everything twice. Text typed by shoppers is made safe for spreadsheets
 * (a cell starting with = + - @ would run as a formula). Used by the background jobs, and by the
 * instant customer export for small lists.
 */
import type { Prisma } from "@prisma/client"
import { attachmentHeader, formatTimestampFilename, generateCsv, generateXlsx, type ExportColumn } from "@ecom/export-utils"
import { prisma } from "../../config"
import type { RequestContext } from "../../core"
import { staffOrderScope } from "../storefronts/storefronts.context"

export type SheetFormat = "csv" | "xlsx"
type Row = Record<string, string | number>
type Progress = (done: number, total: number) => Promise<void> | void

const BATCH = 1000

/** A cell a spreadsheet won't run as a formula. */
export const safeCell = (v: string | null | undefined) => {
  const s = (v ?? "").trim()
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s
}
const money = (v: Prisma.Decimal | number | null) => Math.round(Number(v ?? 0) * 100) / 100
const day = (d: Date) => d.toISOString().slice(0, 10)

export async function toFile(format: SheetFormat, base: string, sheet: string, columns: ExportColumn<Row>[], rows: Row[]) {
  const buffer = format === "csv" ? generateCsv(rows, columns, { includeBom: true }) : await generateXlsx([{ name: sheet, columns, rows }])
  const filename = formatTimestampFilename(base, format)
  return { buffer, filename, contentType: attachmentHeader(filename)["Content-Type"] }
}

// ------------------------------------------------------------------ orders

export interface OrderExportFilters {
  status?: string[]
  dateFrom?: string
  dateTo?: string
  search?: string
}

export const ORDER_COLUMNS: ExportColumn<Row>[] = [
  { key: "number", label: "Order", width: 20 },
  { key: "date", label: "Date", width: 12 },
  { key: "status", label: "Status", width: 14 },
  { key: "payment", label: "Payment", width: 12 },
  { key: "delivery", label: "Delivery", width: 14 },
  { key: "customer", label: "Customer", width: 24 },
  { key: "phone", label: "Phone", width: 16 },
  { key: "email", label: "Email", width: 26 },
  { key: "area", label: "Area", width: 18 },
  { key: "items", label: "Items", width: 8 },
  { key: "subtotal", label: "Items total", width: 12 },
  { key: "discount", label: "Discount", width: 10 },
  { key: "shipping", label: "Delivery charge", width: 12 },
  { key: "tax", label: "VAT", width: 10 },
  { key: "total", label: "Total", width: 12 },
  { key: "refunded", label: "Refunded", width: 10 },
  { key: "method", label: "Paid by", width: 12 },
  { key: "source", label: "Source", width: 12 },
]

export function orderWhere(ctx: RequestContext, f: OrderExportFilters): Prisma.OrderWhereInput {
  const search = f.search?.trim()
  return {
    storeId: ctx.storeId!,
    ...staffOrderScope(ctx),
    ...(f.status?.length ? { status: { in: f.status as never[] } } : {}),
    ...(f.dateFrom || f.dateTo
      ? { createdAt: { ...(f.dateFrom ? { gte: new Date(`${f.dateFrom}T00:00:00+06:00`) } : {}), ...(f.dateTo ? { lte: new Date(`${f.dateTo}T23:59:59.999+06:00`) } : {}) } }
      : {}),
    ...(search
      ? {
          OR: [
            { number: { contains: search, mode: "insensitive" } },
            { billingPhone: { contains: search } },
            { billingFirstName: { contains: search, mode: "insensitive" } },
            { billingLastName: { contains: search, mode: "insensitive" } },
            { billingEmail: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  }
}

export async function orderRows(ctx: RequestContext, f: OrderExportFilters, progress?: Progress): Promise<Row[]> {
  const where = orderWhere(ctx, f)
  const total = await prisma.order.count({ where })
  const out: Row[] = []
  let cursor: bigint | undefined
  for (;;) {
    const batch = await prisma.order.findMany({
      where,
      orderBy: { id: "asc" },
      take: BATCH,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        number: true,
        createdAt: true,
        status: true,
        paymentStatus: true,
        fulfillmentStatus: true,
        billingFirstName: true,
        billingLastName: true,
        billingPhone: true,
        billingEmail: true,
        shippingCity: true,
        shippingState: true,
        itemsSubtotal: true,
        discountTotal: true,
        shippingTotal: true,
        taxTotal: true,
        grandTotal: true,
        refundedTotal: true,
        paymentGatewayCode: true,
        source: true,
        _count: { select: { items: true } },
      },
    })
    for (const o of batch)
      out.push({
        number: o.number,
        date: day(o.createdAt),
        status: o.status.toLowerCase().replace(/_/g, " "),
        payment: o.paymentStatus,
        delivery: o.fulfillmentStatus,
        customer: safeCell(`${o.billingFirstName} ${o.billingLastName}`),
        phone: safeCell(o.billingPhone),
        email: safeCell(o.billingEmail),
        area: safeCell([o.shippingCity, o.shippingState].filter(Boolean).join(", ")),
        items: o._count.items,
        subtotal: money(o.itemsSubtotal),
        discount: money(o.discountTotal),
        shipping: money(o.shippingTotal),
        tax: money(o.taxTotal),
        total: money(o.grandTotal),
        refunded: money(o.refundedTotal),
        method: o.paymentGatewayCode,
        source: o.source,
      })
    await progress?.(out.length, total)
    if (batch.length < BATCH) break
    cursor = batch[batch.length - 1]!.id
  }
  return out
}

// ------------------------------------------------------------------ customers

export interface CustomerExportFilters {
  status?: string
  groupId?: string | bigint
  dateFrom?: string | Date
  dateTo?: string | Date
  acceptMarketing?: boolean
  minTotalSpent?: number
  maxTotalSpent?: number
}

export const CUSTOMER_COLUMNS: ExportColumn<Row>[] = [
  { key: "name", label: "Name", width: 24 },
  { key: "phone", label: "Phone", width: 16 },
  { key: "email", label: "Email", width: 28 },
  { key: "status", label: "Status", width: 10 },
  { key: "orders", label: "Orders", width: 8 },
  { key: "spent", label: "Total spent", width: 12 },
  { key: "source", label: "Came from", width: 12 },
  { key: "joined", label: "Joined", width: 12 },
]

export function customerWhere(storeId: bigint, f: CustomerExportFilters): Prisma.CustomerWhereInput {
  const spent = f.minTotalSpent !== undefined || f.maxTotalSpent !== undefined
  return {
    storeId,
    ...(f.status ? { status: f.status } : {}),
    ...(f.groupId !== undefined ? { groupId: BigInt(f.groupId) } : {}),
    ...(f.acceptMarketing !== undefined ? { acceptMarketing: f.acceptMarketing } : {}),
    ...(spent ? { totalSpent: { ...(f.minTotalSpent !== undefined ? { gte: f.minTotalSpent } : {}), ...(f.maxTotalSpent !== undefined ? { lte: f.maxTotalSpent } : {}) } } : {}),
    ...(f.dateFrom || f.dateTo ? { createdAt: { ...(f.dateFrom ? { gte: new Date(f.dateFrom) } : {}), ...(f.dateTo ? { lte: new Date(f.dateTo) } : {}) } } : {}),
  }
}

export async function customerRows(storeId: bigint, f: CustomerExportFilters, progress?: Progress): Promise<Row[]> {
  const where = customerWhere(storeId, f)
  const total = await prisma.customer.count({ where })
  const out: Row[] = []
  let cursor: bigint | undefined
  for (;;) {
    const batch = await prisma.customer.findMany({
      where,
      orderBy: { id: "asc" },
      take: BATCH,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: { id: true, firstName: true, lastName: true, phone: true, email: true, status: true, orderCount: true, totalSpent: true, source: true, createdAt: true },
    })
    for (const c of batch)
      out.push({
        name: safeCell(`${c.firstName} ${c.lastName}`),
        phone: safeCell(c.phone),
        email: safeCell(c.email),
        status: c.status,
        orders: c.orderCount,
        spent: money(c.totalSpent),
        source: c.source ?? "",
        joined: day(c.createdAt),
      })
    await progress?.(out.length, total)
    if (batch.length < BATCH) break
    cursor = batch[batch.length - 1]!.id
  }
  return out
}
