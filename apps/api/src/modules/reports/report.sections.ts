/**
 * REPORT SECTIONS — each report's figures as what the PDF draws: headline numbers, an optional bar
 * chart and tables, with the same wording and columns as the admin's report pages. No I/O, so the
 * PDF (report.pdf.ts) only lays out what's here.
 */
import type { ReportsService } from "./reports.service"
import { PDF_ROW_CAP, REPORT_LABELS, type ReportKey } from "./report-schedule.rules"

type Data<K extends keyof ReportsService> = ReportsService[K] extends (...a: never[]) => Promise<infer R> ? R : never

export interface ReportData {
  sales: Data<"sales">
  products: Data<"products">
  discounts: Data<"discounts">
  customers: Data<"customers">
  couriers: Data<"couriers">
  returns: Data<"returns">
  tax: Data<"tax">
  stock: Data<"stock">
}

export interface PdfStat {
  label: string
  value: string
  /** % change vs the previous period (null: nothing to compare). */
  change?: number | null
}

export interface PdfColumn {
  label: string
  align?: "left" | "right"
  /** Share of the table's width. */
  weight: number
}

export interface PdfTable {
  title: string
  columns: PdfColumn[]
  rows: string[][]
  /** Rows before the cap, so the PDF can say how many were left out. */
  totalRows: number
}

export interface PdfSection {
  key: ReportKey
  title: string
  note?: string
  stats: PdfStat[]
  chart?: { title: string; points: { label: string; value: number }[] }
  tables: PdfTable[]
}

// ------------------------------------------------------------------ formatting (as the admin shows it)

export const tk = (v: number) => `${v < 0 ? "−" : ""}৳${Math.abs(v).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`
export const int = (v: number) => v.toLocaleString("en-IN")
export const pctText = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `${v}%`)
export const words = (s: string | null | undefined) => (s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ") : "—")
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
/** "5 Oct 2026"; "5 Oct" without the year. */
export const dayText = (d: string, year = true) => {
  const [y, m, day] = d.split("-").map(Number) as [number, number, number]
  return `${day} ${MONTHS[m - 1]}${year ? ` ${y}` : ""}`
}
export const monthText = (d: string) => `${MONTHS[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`

const col = (label: string, weight: number, align: "left" | "right" = "right"): PdfColumn => ({ label, weight, align })
const name = (label: string, weight = 3) => col(label, weight, "left")

function table(title: string, columns: PdfColumn[], rows: string[][]): PdfTable {
  return { title, columns, rows: rows.slice(0, PDF_ROW_CAP), totalRows: rows.length }
}

const periodLabel = (bucket: string, k: string) => (bucket === "month" ? monthText(k) : bucket === "week" ? `w/c ${dayText(k, false)}` : dayText(k, false))

const costNote = (coverage: number | null | undefined) =>
  coverage !== null && coverage !== undefined && coverage < 100
    ? `${coverage}% of units sold have a cost price; profit counts the rest at no cost, so it's overstated.`
    : undefined

// ------------------------------------------------------------------ each report

function sales(d: ReportData["sales"]): PdfSection {
  const t = d.total
  const breakdown = (title: string, first: string, rows: typeof d.bySource, label: (k: string) => string = words) =>
    table(title, [name(first), col("Orders", 1), col("Net sales", 1.4), col("Gross profit", 1.4), col("Share", 1)], rows.map((r) => [label(r.key), int(r.orders), tk(r.netSales), tk(r.grossProfit), pctText(r.share)]))
  return {
    key: "sales",
    title: REPORT_LABELS.sales,
    note: costNote(t.costCoverage),
    stats: [
      { label: "Net sales", value: tk(t.netSales), change: d.changes.netSales },
      { label: "Gross profit", value: tk(t.grossProfit), change: d.changes.grossProfit },
      { label: "Orders", value: int(t.orders), change: d.changes.orders },
      { label: "Average order", value: tk(t.averageOrder), change: d.changes.averageOrder },
      { label: "Margin", value: pctText(t.margin) },
      { label: "Discounts", value: tk(t.discounts) },
      { label: "Refunds", value: tk(t.refunds) },
      { label: "Delivery charged", value: tk(t.shipping) },
    ],
    chart: { title: "Net sales", points: d.series.map((p) => ({ label: periodLabel(d.bucket, p.period), value: p.netSales })) },
    tables: [
      table(
        d.bucket === "day" ? "By day" : d.bucket === "week" ? "By week" : "By month",
        [name("Period", 2), col("Orders", 1), col("Net sales", 1.4), col("Cost of goods", 1.4), col("Gross profit", 1.4)],
        d.series.map((p) => [periodLabel(d.bucket, p.period), int(p.orders), tk(p.netSales), tk(p.cogs), tk(p.grossProfit)]),
      ),
      breakdown("By source", "Source", d.bySource),
      breakdown("By payment method", "Payment", d.byPayment, (k) => (k === "unknown" ? "—" : k.toUpperCase().replace(/_/g, " "))),
      ...(d.byStorefront.length > 1 ? [breakdown("By storefront", "Storefront", d.byStorefront, (k) => k)] : []),
    ],
  }
}

function products(d: ReportData["products"]): PdfSection {
  const units = d.products.reduce((a, p) => a + p.units, 0)
  const net = d.products.reduce((a, p) => a + p.netSales, 0)
  const gp = d.products.reduce((a, p) => a + p.grossProfit, 0)
  return {
    key: "products",
    title: REPORT_LABELS.products,
    stats: [
      { label: "Products sold", value: int(d.products.length) },
      { label: "Units sold", value: int(units) },
      { label: "Net sales", value: tk(net) },
      { label: "Gross profit", value: tk(gp) },
    ],
    tables: [
      table(
        "Products (by net sales)",
        [name("Product", 3.4), col("Units", 0.8), col("Returned", 0.9), col("Net sales", 1.2), col("Profit", 1.2), col("Margin", 0.9)],
        d.products.map((p) => [p.sku ? `${p.name} (${p.sku})` : p.name, int(p.units), int(p.unitsReturned), tk(p.netSales), tk(p.grossProfit), pctText(p.margin)]),
      ),
      table(
        "Categories",
        [name("Category"), col("Products", 1), col("Units", 1), col("Net sales", 1.3), col("Profit", 1.3), col("Margin", 1)],
        d.categories.map((c) => [c.category, int(c.products), int(c.units), tk(c.netSales), tk(c.grossProfit), pctText(c.margin)]),
      ),
    ],
  }
}

function discounts(d: ReportData["discounts"]): PdfSection {
  const t = d.totals
  return {
    key: "discounts",
    title: REPORT_LABELS.discounts,
    stats: [
      { label: "All discounts", value: tk(t.allDiscounts) },
      { label: "Discount rate", value: pctText(t.discountRate) },
      { label: "Coupons", value: tk(t.couponDiscount) },
      { label: "Promotions", value: tk(t.promotionDiscount) },
      { label: "Staff discounts", value: tk(t.manualDiscount) },
      { label: "Orders with a coupon", value: int(t.ordersWithCoupon) },
    ],
    tables: [
      table(
        "Coupons",
        [name("Code", 2), col("Orders", 0.9), col("Discount", 1.2), col("Sales", 1.2), col("Sales per ৳1", 1.1), col("New customers", 1.2)],
        d.coupons.map((c) => [c.code, int(c.orders), tk(c.discount), tk(c.sales), c.salesPerTaka === null ? "—" : `৳${c.salesPerTaka}`, int(c.newCustomers)]),
      ),
      table(
        "Automatic promotions",
        [name("Promotion"), name("Type", 1.5), col("Orders", 1), col("Discount", 1.2), col("Sales", 1.2)],
        d.promotions.map((p) => [p.name, words(p.type), int(p.orders), tk(p.discount), tk(p.sales)]),
      ),
    ],
  }
}

function customers(d: ReportData["customers"]): PdfSection {
  const t = d.totals
  return {
    key: "customers",
    title: REPORT_LABELS.customers,
    stats: [
      { label: "Customers", value: int(t.customers) },
      { label: "New", value: int(t.newCustomers) },
      { label: "Returning", value: int(t.returningCustomers) },
      { label: "Ordered more than once", value: pctText(t.repeatRate) },
      { label: "Sales per customer", value: tk(t.salesPerCustomer) },
      { label: "Guest orders", value: int(t.guestOrders) },
    ],
    tables: [
      table(
        "Top customers",
        [name("Customer", 2.4), name("Phone", 1.5), col("Orders", 0.9), col("Sales", 1.2), col("All-time orders", 1.3)],
        d.topCustomers.map((c) => [c.name || "—", c.phone ?? "—", int(c.orders), tk(c.sales), int(c.lifetimeOrders)]),
      ),
      table("By area", [name("Area"), col("Orders", 1), col("Sales", 1.4)], d.byArea.map((a) => [a.area, int(a.orders), tk(a.sales)])),
    ],
  }
}

function couriers(d: ReportData["couriers"]): PdfSection {
  return {
    key: "couriers",
    title: REPORT_LABELS.couriers,
    stats: [
      { label: "COD still to reach you", value: tk(d.cod.outstanding) },
      { label: "With couriers", value: tk(d.cod.withCourier) },
      { label: "Cash in hand", value: tk(d.cod.cashInHand) },
      { label: "COD received", value: tk(d.cod.received) },
      { label: "Payout shortfall", value: tk(d.unsettledShortfall) },
    ],
    tables: [
      table(
        "Couriers",
        [name("Courier", 1.6), col("Parcels", 0.9), col("Delivered", 1), col("Returned", 1), col("Success", 0.9), col("Days", 0.7), col("COD delivered", 1.3), col("Shortfall", 1.1)],
        d.couriers.map((c) => [
          c.name || c.code,
          int(c.parcels),
          int(c.delivered),
          int(c.returned + c.failed),
          pctText(c.successRate),
          c.averageDays === null ? "—" : String(c.averageDays),
          tk(c.codDelivered),
          tk(c.shortfall),
        ]),
      ),
    ],
  }
}

function returns(d: ReportData["returns"]): PdfSection {
  const t = d.totals
  const keyed = (title: string, first: string, rows: { key: string; refunds?: number; returns?: number; amount: number }[], count: "refunds" | "returns") =>
    table(title, [name(first, 2.5), col(count === "refunds" ? "Refunds" : "Returns", 1), col("Amount", 1.3)], rows.map((r) => [words(r.key), int(r[count] ?? 0), tk(r.amount)]))
  return {
    key: "returns",
    title: REPORT_LABELS.returns,
    stats: [
      { label: "Refunded", value: tk(t.refunded) },
      { label: "Refunds", value: int(t.refunds) },
      { label: "Returns asked for", value: int(t.returns) },
      { label: "Returns per 100 orders", value: pctText(t.returnRate) },
    ],
    tables: [
      keyed("Refunds by method", "Method", d.refundsByMethod, "refunds"),
      keyed("Refunds by reason", "Reason", d.refundsByReason, "refunds"),
      keyed("Returns by status", "Status", d.returnsByStatus, "returns"),
      table("Return reasons", [name("Reason", 2.5), col("Returns", 1)], d.returnsByReason.map((r) => [words(r.key), int(r.returns)])),
      table("Most refunded products", [name("Product", 2.5), col("Units", 1), col("Amount", 1.3)], d.mostRefunded.map((r) => [r.name, int(r.units), tk(r.amount)])),
    ],
  }
}

function tax(d: ReportData["tax"]): PdfSection {
  const t = d.totals
  return {
    key: "tax",
    title: REPORT_LABELS.tax,
    note: "Sales and delivery are shown before VAT.",
    stats: [
      { label: "Tax collected", value: tk(t.tax) },
      { label: "Sales", value: tk(t.sales) },
      { label: "Effective rate", value: pctText(t.effectiveRate) },
      { label: "Orders with tax", value: `${int(t.taxedOrders)} of ${int(t.orders)}` },
    ],
    tables: [
      table(
        d.bucket === "day" ? "By day" : "By month",
        [name("Period", 2), col("Orders", 1), col("Sales", 1.4), col("Delivery", 1.2), col("Tax", 1.2)],
        d.periods.map((p) => [periodLabel(d.bucket, p.period), int(p.orders), tk(p.sales), tk(p.shipping), tk(p.tax)]),
      ),
    ],
  }
}

function stock(d: ReportData["stock"]): PdfSection {
  const t = d.totals
  return {
    key: "stock",
    title: REPORT_LABELS.stock,
    note:
      "Stock on hand when the report was made, not for the dates above." +
      (t.productsWithoutCost ? ` ${int(t.productsWithoutCost)} products have no cost price and count as ৳0 at cost.` : ""),
    stats: [
      { label: "At cost", value: tk(t.costValue) },
      { label: "At selling price", value: tk(t.retailValue) },
      { label: "Profit if it all sells", value: tk(t.potentialProfit) },
      { label: "Units in stock", value: int(t.units) },
    ],
    tables: [
      table(
        "Categories",
        [name("Category"), col("Products", 1), col("Units", 1), col("At cost", 1.3), col("At selling price", 1.5)],
        d.categories.map((c) => [c.category, int(c.products), int(c.units), tk(c.costValue), tk(c.retailValue)]),
      ),
      table(
        "Products (by value at cost)",
        [name("Product", 3.2), col("Units", 0.9), col("At cost", 1.2), col("At selling price", 1.4), col("Profit", 1.2)],
        d.products.map((p) => [p.sku ? `${p.name} (${p.sku})` : p.name, int(p.units), tk(p.costValue), tk(p.retailValue), tk(p.potentialProfit)]),
      ),
    ],
  }
}

const BUILD: { [K in ReportKey]: (d: ReportData[K]) => PdfSection } = { sales, products, discounts, customers, couriers, returns, tax, stock }

export function buildSection<K extends ReportKey>(key: K, data: ReportData[K]): PdfSection {
  return BUILD[key](data)
}

/** The lines the email shows above the attachment (from the sales figures, when they're included). */
export function summaryLines(d: Partial<ReportData>): string[] {
  const s = d.sales
  if (!s) return []
  const ch = (v: number | null) => (v === null ? "" : ` (${v >= 0 ? "+" : "−"}${Math.abs(v)}% vs the period before)`)
  return [
    `Net sales: ${tk(s.total.netSales)}${ch(s.changes.netSales)}`,
    `Orders: ${int(s.total.orders)}${ch(s.changes.orders)}`,
    `Gross profit: ${tk(s.total.grossProfit)}${ch(s.changes.grossProfit)}`,
  ]
}
