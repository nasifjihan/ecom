/**
 * REPORTS — read-only figures for the store admin: sales and gross profit over time and by source /
 * payment method, products and categories, coupons and promotions, customers, couriers and cash on
 * delivery, returns and refunds, stock value and tax. Date rules and profit maths live in
 * reports.rules.ts; everything here is SQL over the store's own rows.
 *
 * Orders are counted on the day they were placed (shop time). Refunds on an order count against
 * that order's day, so a period's profit doesn't change sign when a refund lands later; the returns
 * report lists refunds by the day they were given.
 */
import { Prisma } from "@prisma/client"
import { prisma } from "../../config"
import { BadRequestError, type RequestContext } from "../../core"
import {
  bucketKeys,
  change,
  pct,
  pickBucket,
  previousRange,
  profit,
  resolveRange,
  round2,
  statusesFor,
  type Bucket,
  type DayRange,
  type ReportBasis,
  type SalesFigures,
} from "./reports.rules"

export interface RangeQuery {
  from?: string
  to?: string
  basis?: ReportBasis
}

const n = (v: unknown) => (v === null || v === undefined ? 0 : Number(v))

interface FigureRow {
  k: string | null
  orders: number
  items_subtotal: number
  discounts: number
  shipping: number
  tax: number
  refunds: number
  cogs: number
  units: number
  units_cost: number
}

const figures = (r: FigureRow | undefined): SalesFigures => ({
  orders: n(r?.orders),
  itemsSubtotal: round2(n(r?.items_subtotal)),
  discounts: round2(n(r?.discounts)),
  shipping: round2(n(r?.shipping)),
  tax: round2(n(r?.tax)),
  refunds: round2(n(r?.refunds)),
  cogs: round2(n(r?.cogs)),
  units: n(r?.units),
  unitsWithCost: n(r?.units_cost),
})

/** A figures block with its profit numbers, as the admin shows it. */
const withProfit = (f: SalesFigures) => ({ ...f, ...profit(f) })

export class ReportsService {
  constructor(private readonly ctx: RequestContext) {}

  private get storeId(): bigint {
    if (this.ctx.storeId === undefined)
      throw new BadRequestError("No store for this request", "STORE_REQUIRED")
    return this.ctx.storeId
  }

  private async tz(): Promise<string> {
    const s = await prisma.storeGeneralSetting.findUnique({
      where: { storeId: this.storeId },
      select: { timezone: true },
    })
    const tz = s?.timezone ?? "Asia/Dhaka"
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: tz })
      return tz
    } catch {
      return "Asia/Dhaka" // a mistyped zone in settings shouldn't break every report
    }
  }

  private async range(q: RangeQuery) {
    const tz = await this.tz()
    const r = resolveRange(q, new Date(), tz)
    if ("error" in r) throw new BadRequestError(r.error, "VALIDATION_FAILED")
    return { tz, r, basis: q.basis ?? "placed" }
  }

  private static head(tz: string, r: DayRange, basis?: ReportBasis) {
    return { from: r.fromDay, to: r.toDay, days: r.days, timezone: tz, ...(basis ? { basis } : {}) }
  }

  /**
   * Sales figures for orders placed in the range, grouped by `key` (a SQL expression over the
   * order row `o`). Cost of goods counts units kept: a refund that put stock back removes its units.
   */
  private async salesBy(r: DayRange, basis: ReportBasis, key: Prisma.Sql): Promise<FigureRow[]> {
    return prisma.$queryRaw<FigureRow[]>`
      WITH o AS (
        SELECT o."id", ${key} AS k, o."itemsSubtotal", o."discountTotal", o."shippingTotal",
               o."taxTotal", o."refundedTotal"
        FROM "Order" o
        WHERE o."storeId" = ${this.storeId}
          AND o."createdAt" >= ${r.start} AND o."createdAt" < ${r.end}
          AND o."status"::text = ANY(${statusesFor(basis)})
      ),
      back AS (
        SELECT ri."orderItemId", SUM(ri."quantity") AS qty
        FROM "RefundItem" ri JOIN "Refund" rf ON rf."id" = ri."refundId"
        WHERE rf."storeId" = ${this.storeId} AND rf."restockItems"
        GROUP BY ri."orderItemId"
      ),
      l AS (
        SELECT oi."orderId",
               SUM(oi."quantity") AS units,
               SUM(CASE WHEN oi."unitCost" IS NOT NULL THEN oi."quantity" ELSE 0 END) AS units_cost,
               SUM(COALESCE(oi."unitCost", 0) * GREATEST(oi."quantity" - COALESCE(b.qty, 0), 0)) AS cogs
        FROM "OrderItem" oi
        JOIN o ON o."id" = oi."orderId"
        LEFT JOIN back b ON b."orderItemId" = oi."id"
        GROUP BY oi."orderId"
      )
      SELECT o.k::text AS k,
             COUNT(*)::int AS orders,
             SUM(o."itemsSubtotal")::float8 AS items_subtotal,
             SUM(o."discountTotal")::float8 AS discounts,
             SUM(o."shippingTotal")::float8 AS shipping,
             SUM(o."taxTotal")::float8 AS tax,
             SUM(o."refundedTotal")::float8 AS refunds,
             COALESCE(SUM(l.cogs), 0)::float8 AS cogs,
             COALESCE(SUM(l.units), 0)::int AS units,
             COALESCE(SUM(l.units_cost), 0)::int AS units_cost
      FROM o LEFT JOIN l ON l."orderId" = o."id"
      GROUP BY o.k
    `
  }

  private static bucketSql(bucket: Bucket, tz: string) {
    return Prisma.sql`to_char(date_trunc(${bucket}, (o."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${tz}), 'YYYY-MM-DD')`
  }

  // ================================================================ sales and profit

  /** Totals vs the previous period of the same length, a chart series, and by source / payment. */
  async sales(q: RangeQuery) {
    const { tz, r, basis } = await this.range(q)
    const prev = previousRange(r, tz)
    const bucket = pickBucket(r.days)
    const all = Prisma.sql`'all'`
    const [cur, before, series, sources, payments] = await Promise.all([
      this.salesBy(r, basis, all),
      this.salesBy(prev, basis, all),
      this.salesBy(r, basis, ReportsService.bucketSql(bucket, tz)),
      this.salesBy(r, basis, Prisma.sql`o."source"`),
      this.salesBy(r, basis, Prisma.sql`o."paymentGatewayCode"`),
    ])
    const total = withProfit(figures(cur[0]))
    const previous = withProfit(figures(before[0]))
    const byKey = new Map(series.map((s) => [s.k, s]))
    const breakdown = (rows: FigureRow[]) =>
      rows
        .map((row) => ({ key: row.k ?? "unknown", ...withProfit(figures(row)) }))
        .sort((a, b) => b.netSales - a.netSales)
        .map((row) => ({ ...row, share: pct(row.netSales, total.netSales) }))
    return {
      ...ReportsService.head(tz, r, basis),
      previous: { from: prev.fromDay, to: prev.toDay },
      bucket,
      total,
      changes: {
        orders: change(total.orders, previous.orders),
        netSales: change(total.netSales, previous.netSales),
        grossProfit: change(total.grossProfit, previous.grossProfit),
        averageOrder: change(total.averageOrder, previous.averageOrder),
      },
      series: bucketKeys(r, bucket).map((k) => ({
        period: k,
        ...withProfit(figures(byKey.get(k))),
      })),
      bySource: breakdown(sources),
      byPayment: breakdown(payments),
    }
  }

  // ================================================================ products and categories

  async products(q: RangeQuery & { sort?: "revenue" | "units" | "profit" }) {
    const { tz, r, basis } = await this.range(q)
    const rows = await prisma.$queryRaw<
      {
        product_id: bigint | null
        name: string
        sku: string | null
        units: number
        units_back: number
        revenue: number
        refunded: number
        cogs: number
        units_cost: number
        orders: number
      }[]
    >`
      WITH back AS (
        SELECT ri."orderItemId",
               SUM(CASE WHEN rf."restockItems" THEN ri."quantity" ELSE 0 END) AS qty,
               SUM(ri."amount") AS amount
        FROM "RefundItem" ri JOIN "Refund" rf ON rf."id" = ri."refundId"
        WHERE rf."storeId" = ${this.storeId}
        GROUP BY ri."orderItemId"
      )
      SELECT oi."productId" AS product_id,
             MAX(oi."productName") AS name,
             MAX(oi."productSku") AS sku,
             SUM(oi."quantity")::int AS units,
             COALESCE(SUM(b.qty), 0)::int AS units_back,
             SUM(oi."lineSubtotal" - oi."lineDiscount")::float8 AS revenue,
             COALESCE(SUM(b.amount), 0)::float8 AS refunded,
             SUM(COALESCE(oi."unitCost", 0) * GREATEST(oi."quantity" - COALESCE(b.qty, 0), 0))::float8 AS cogs,
             SUM(CASE WHEN oi."unitCost" IS NOT NULL THEN oi."quantity" ELSE 0 END)::int AS units_cost,
             COUNT(DISTINCT oi."orderId")::int AS orders
      FROM "OrderItem" oi
      JOIN "Order" o ON o."id" = oi."orderId"
      LEFT JOIN back b ON b."orderItemId" = oi."id"
      WHERE o."storeId" = ${this.storeId}
        AND o."createdAt" >= ${r.start} AND o."createdAt" < ${r.end}
        AND o."status"::text = ANY(${statusesFor(basis)})
      GROUP BY oi."productId", CASE WHEN oi."productId" IS NULL THEN oi."productName" END
    `
    const ids = rows.flatMap((x) => (x.product_id === null ? [] : [x.product_id]))
    const cats = await prisma.productCategory.findMany({
      where: { productId: { in: ids } },
      select: { productId: true, primary: true, category: { select: { id: true, name: true } } },
      orderBy: [{ primary: "desc" }, { categoryId: "asc" }],
    })
    const catOf = new Map<string, { id: string; name: string }>()
    for (const c of cats)
      if (!catOf.has(String(c.productId)))
        catOf.set(String(c.productId), { id: String(c.category.id), name: c.category.name })

    const items = rows.map((x) => {
      const netSales = round2(n(x.revenue) - n(x.refunded))
      const grossProfit = round2(netSales - n(x.cogs))
      return {
        productId: x.product_id === null ? null : String(x.product_id),
        name: x.name,
        sku: x.sku,
        category: x.product_id === null ? null : (catOf.get(String(x.product_id))?.name ?? null),
        orders: x.orders,
        units: x.units,
        unitsReturned: x.units_back,
        revenue: round2(n(x.revenue)),
        refunded: round2(n(x.refunded)),
        netSales,
        cogs: round2(n(x.cogs)),
        grossProfit,
        margin: pct(grossProfit, netSales),
        costCoverage: pct(x.units_cost, x.units),
      }
    })
    const sort = q.sort ?? "revenue"
    const sortKey = { revenue: "netSales", units: "units", profit: "grossProfit" } as const
    items.sort((a, b) => b[sortKey[sort]] - a[sortKey[sort]])

    const byCat = new Map<
      string,
      { category: string; units: number; netSales: number; cogs: number; products: number }
    >()
    for (const i of items) {
      const key = i.category ?? "Uncategorised"
      const c = byCat.get(key) ?? { category: key, units: 0, netSales: 0, cogs: 0, products: 0 }
      c.units += i.units
      c.netSales = round2(c.netSales + i.netSales)
      c.cogs = round2(c.cogs + i.cogs)
      c.products += 1
      byCat.set(key, c)
    }
    const categories = [...byCat.values()]
      .map((c) => {
        const grossProfit = round2(c.netSales - c.cogs)
        return { ...c, grossProfit, margin: pct(grossProfit, c.netSales) }
      })
      .sort((a, b) => b.netSales - a.netSales)

    return { ...ReportsService.head(tz, r, basis), sort, products: items.slice(0, 500), categories }
  }

  // ================================================================ coupons and promotions

  async discounts(q: RangeQuery) {
    const { tz, r, basis } = await this.range(q)
    const where = Prisma.sql`o."storeId" = ${this.storeId}
      AND o."createdAt" >= ${r.start} AND o."createdAt" < ${r.end}
      AND o."status"::text = ANY(${statusesFor(basis)})`
    const [coupons, promos, totals] = await Promise.all([
      prisma.$queryRaw<
        {
          code: string
          orders: number
          discount: number
          sales: number
          customers: number
          new_customers: number
        }[]
      >`
        SELECT UPPER(o."couponUsed") AS code,
               COUNT(*)::int AS orders,
               SUM(o."couponDiscountAmount")::float8 AS discount,
               SUM(o."itemsSubtotal" - o."discountTotal")::float8 AS sales,
               COUNT(DISTINCT o."customerId")::int AS customers,
               COUNT(DISTINCT o."customerId") FILTER (
                 WHERE NOT EXISTS (
                   SELECT 1 FROM "Order" p
                   WHERE p."customerId" = o."customerId" AND p."createdAt" < o."createdAt"
                     AND p."status"::text NOT IN ('CANCELLED', 'FAILED')
                 )
               )::int AS new_customers
        FROM "Order" o
        WHERE ${where} AND o."couponUsed" IS NOT NULL AND o."couponUsed" <> ''
        GROUP BY UPPER(o."couponUsed")
        ORDER BY discount DESC
      `,
      prisma.$queryRaw<
        { name: string; type: string; orders: number; discount: number; sales: number }[]
      >`
        SELECT p->>'name' AS name, p->>'type' AS type,
               COUNT(DISTINCT o."id")::int AS orders,
               SUM(COALESCE((p->>'amount')::numeric, 0))::float8 AS discount,
               SUM(o."itemsSubtotal" - o."discountTotal")::float8 AS sales
        FROM "Order" o, jsonb_array_elements(
          CASE WHEN jsonb_typeof(o."promotions"::jsonb) = 'array' THEN o."promotions"::jsonb ELSE '[]'::jsonb END
        ) p
        WHERE ${where}
        GROUP BY 1, 2
        ORDER BY orders DESC
      `,
      prisma.$queryRaw<
        {
          orders: number
          with_coupon: number
          with_promo: number
          coupon: number
          promo: number
          manual: number
          all_discounts: number
          sales: number
        }[]
      >`
        SELECT COUNT(*)::int AS orders,
               COUNT(*) FILTER (WHERE o."couponUsed" IS NOT NULL AND o."couponUsed" <> '')::int AS with_coupon,
               COUNT(*) FILTER (WHERE o."promotionDiscount" > 0 OR o."promotions" IS NOT NULL)::int AS with_promo,
               COALESCE(SUM(o."couponDiscountAmount"), 0)::float8 AS coupon,
               COALESCE(SUM(o."promotionDiscount"), 0)::float8 AS promo,
               COALESCE(SUM(o."manualDiscount"), 0)::float8 AS manual,
               COALESCE(SUM(o."discountTotal"), 0)::float8 AS all_discounts,
               COALESCE(SUM(o."itemsSubtotal" - o."discountTotal"), 0)::float8 AS sales
        FROM "Order" o WHERE ${where}
      `,
    ])
    const t = totals[0]
    return {
      ...ReportsService.head(tz, r, basis),
      totals: {
        orders: n(t?.orders),
        ordersWithCoupon: n(t?.with_coupon),
        ordersWithPromotion: n(t?.with_promo),
        couponDiscount: round2(n(t?.coupon)),
        promotionDiscount: round2(n(t?.promo)),
        manualDiscount: round2(n(t?.manual)),
        allDiscounts: round2(n(t?.all_discounts)),
        /** Discounts as % of what sales would have been without them. */
        discountRate: pct(n(t?.all_discounts), n(t?.sales) + n(t?.all_discounts)),
      },
      coupons: coupons.map((c) => ({
        code: c.code,
        orders: c.orders,
        discount: round2(n(c.discount)),
        sales: round2(n(c.sales)),
        averageOrder: c.orders ? round2(n(c.sales) / c.orders) : 0,
        customers: c.customers,
        newCustomers: c.new_customers,
        /** Sales per ৳1 of discount. */
        salesPerTaka: n(c.discount) ? round2(n(c.sales) / n(c.discount)) : null,
      })),
      promotions: promos.map((p) => ({
        name: p.name,
        type: p.type,
        orders: p.orders,
        discount: round2(n(p.discount)),
        sales: round2(n(p.sales)),
      })),
    }
  }

  // ================================================================ customers

  async customers(q: RangeQuery) {
    const { tz, r, basis } = await this.range(q)
    const statuses = statusesFor(basis)
    const [summary, top, cities] = await Promise.all([
      prisma.$queryRaw<
        {
          customers: number
          new_customers: number
          repeat_customers: number
          guest_orders: number
          customer_orders: number
          guest_sales: number
          customer_sales: number
        }[]
      >`
        WITH o AS (
          SELECT o."customerId", o."createdAt", (o."itemsSubtotal" - o."discountTotal" - o."refundedTotal") AS sales
          FROM "Order" o
          WHERE o."storeId" = ${this.storeId}
            AND o."createdAt" >= ${r.start} AND o."createdAt" < ${r.end}
            AND o."status"::text = ANY(${statuses})
        ),
        c AS (
          SELECT o."customerId", COUNT(*) AS orders,
                 NOT EXISTS (
                   SELECT 1 FROM "Order" p
                   WHERE p."customerId" = o."customerId" AND p."storeId" = ${this.storeId}
                     AND p."createdAt" < ${r.start} AND p."status"::text = ANY(${statuses})
                 ) AS is_new
          FROM o WHERE o."customerId" IS NOT NULL
          GROUP BY o."customerId"
        )
        SELECT (SELECT COUNT(*) FROM c)::int AS customers,
               (SELECT COUNT(*) FROM c WHERE is_new)::int AS new_customers,
               (SELECT COUNT(*) FROM c WHERE orders > 1)::int AS repeat_customers,
               (SELECT COUNT(*) FROM o WHERE "customerId" IS NULL)::int AS guest_orders,
               (SELECT COUNT(*) FROM o WHERE "customerId" IS NOT NULL)::int AS customer_orders,
               (SELECT COALESCE(SUM(sales), 0) FROM o WHERE "customerId" IS NULL)::float8 AS guest_sales,
               (SELECT COALESCE(SUM(sales), 0) FROM o WHERE "customerId" IS NOT NULL)::float8 AS customer_sales
      `,
      prisma.$queryRaw<
        {
          id: bigint
          name: string
          phone: string | null
          email: string | null
          orders: number
          sales: number
          first_at: Date
          last_at: Date
          lifetime_orders: number
        }[]
      >`
        SELECT c."id", TRIM(c."firstName" || ' ' || c."lastName") AS name, c."phone", c."email",
               COUNT(o."id")::int AS orders,
               SUM(o."itemsSubtotal" - o."discountTotal" - o."refundedTotal")::float8 AS sales,
               MIN(o."createdAt") AS first_at, MAX(o."createdAt") AS last_at,
               c."orderCount"::int AS lifetime_orders
        FROM "Order" o JOIN "Customer" c ON c."id" = o."customerId"
        WHERE o."storeId" = ${this.storeId}
          AND o."createdAt" >= ${r.start} AND o."createdAt" < ${r.end}
          AND o."status"::text = ANY(${statuses})
        GROUP BY c."id"
        ORDER BY sales DESC
        LIMIT 50
      `,
      prisma.$queryRaw<{ city: string; orders: number; sales: number }[]>`
        SELECT COALESCE(NULLIF(TRIM(COALESCE(o."shippingState", o."billingState", o."shippingCity", o."billingCity")), ''), 'Unknown') AS city,
               COUNT(*)::int AS orders,
               SUM(o."itemsSubtotal" - o."discountTotal" - o."refundedTotal")::float8 AS sales
        FROM "Order" o
        WHERE o."storeId" = ${this.storeId}
          AND o."createdAt" >= ${r.start} AND o."createdAt" < ${r.end}
          AND o."status"::text = ANY(${statuses})
        GROUP BY 1
        ORDER BY orders DESC
        LIMIT 20
      `,
    ])
    const s = summary[0]
    const customers = n(s?.customers)
    return {
      ...ReportsService.head(tz, r, basis),
      totals: {
        customers,
        newCustomers: n(s?.new_customers),
        returningCustomers: customers - n(s?.new_customers),
        repeatCustomers: n(s?.repeat_customers),
        /** Customers who ordered more than once in the range. */
        repeatRate: pct(n(s?.repeat_customers), customers),
        customerOrders: n(s?.customer_orders),
        guestOrders: n(s?.guest_orders),
        customerSales: round2(n(s?.customer_sales)),
        guestSales: round2(n(s?.guest_sales)),
        salesPerCustomer: customers ? round2(n(s?.customer_sales) / customers) : 0,
      },
      topCustomers: top.map((c) => ({
        id: String(c.id),
        name: c.name,
        phone: c.phone,
        email: c.email,
        orders: c.orders,
        sales: round2(n(c.sales)),
        lifetimeOrders: c.lifetime_orders,
        lastOrderAt: c.last_at.toISOString(),
      })),
      byArea: cities.map((c) => ({ area: c.city, orders: c.orders, sales: round2(n(c.sales)) })),
    }
  }

  // ================================================================ couriers and cash on delivery

  async couriers(q: RangeQuery) {
    const { tz, r } = await this.range(q)
    const [parcels, cod, settlements] = await Promise.all([
      prisma.$queryRaw<
        {
          code: string
          name: string
          parcels: number
          delivered: number
          failed: number
          returned: number
          cancelled: number
          open: number
          cod_delivered: number
          fees: number
          days: number | null
        }[]
      >`
        SELECT s."providerCode" AS code, MAX(s."providerName") AS name,
               COUNT(*)::int AS parcels,
               COUNT(*) FILTER (WHERE s."status" = 'delivered')::int AS delivered,
               COUNT(*) FILTER (WHERE s."status" = 'failed')::int AS failed,
               COUNT(*) FILTER (WHERE s."status" = 'returned')::int AS returned,
               COUNT(*) FILTER (WHERE s."status" = 'cancelled')::int AS cancelled,
               COUNT(*) FILTER (WHERE s."status" NOT IN ('delivered', 'failed', 'returned', 'cancelled'))::int AS open,
               COALESCE(SUM(s."codAmount") FILTER (WHERE s."status" = 'delivered'), 0)::float8 AS cod_delivered,
               COALESCE(SUM(s."deliveryFee"), 0)::float8 AS fees,
               AVG(EXTRACT(EPOCH FROM (s."deliveredAt" - COALESCE(s."shippedAt", s."createdAt"))) / 86400)
                 FILTER (WHERE s."status" = 'delivered' AND s."deliveredAt" IS NOT NULL)::float8 AS days
        FROM "Shipment" s
        WHERE s."storeId" = ${this.storeId} AND s."createdAt" >= ${r.start} AND s."createdAt" < ${r.end}
        GROUP BY s."providerCode"
        ORDER BY parcels DESC
      `,
      prisma.$queryRaw<{ status: string; records: number; amount: number }[]>`
        SELECT pr."status", COUNT(*)::int AS records, SUM(pr."amount")::float8 AS amount
        FROM "PaymentRecord" pr
        WHERE pr."storeId" = ${this.storeId} AND pr."kind" = 'cod'
          AND pr."createdAt" >= ${r.start} AND pr."createdAt" < ${r.end}
        GROUP BY pr."status"
      `,
      prisma.$queryRaw<
        {
          code: string
          name: string
          payouts: number
          expected: number
          charges: number
          received: number
          shortfall: number
        }[]
      >`
        SELECT cs."courierCode" AS code, MAX(cs."courierName") AS name, COUNT(*)::int AS payouts,
               SUM(cs."expectedAmount")::float8 AS expected, SUM(cs."charges")::float8 AS charges,
               SUM(cs."receivedAmount")::float8 AS received,
               SUM(CASE WHEN cs."status" = 'resolved' THEN 0 ELSE cs."shortfall" END)::float8 AS shortfall
        FROM "CourierSettlement" cs
        WHERE cs."storeId" = ${this.storeId} AND cs."paidOn" >= ${r.start} AND cs."paidOn" < ${r.end}
        GROUP BY cs."courierCode"
      `,
    ])
    const codBy = (s: string) => cod.find((c) => c.status === s)
    const codTotal = cod.reduce((a, c) => a + n(c.amount), 0)
    return {
      ...ReportsService.head(tz, r),
      couriers: parcels.map((p) => {
        const settled = settlements.find((s) => s.code === p.code)
        const finished = p.delivered + p.returned + p.failed
        return {
          code: p.code,
          name: p.name,
          parcels: p.parcels,
          delivered: p.delivered,
          failed: p.failed,
          returned: p.returned,
          cancelled: p.cancelled,
          inProgress: p.open,
          /** Delivered out of parcels that reached an end (delivered, failed or returned). */
          successRate: pct(p.delivered, finished),
          returnRate: pct(p.returned + p.failed, finished),
          codDelivered: round2(n(p.cod_delivered)),
          deliveryFees: round2(n(p.fees)),
          averageDays: p.days === null ? null : Math.round(n(p.days) * 10) / 10,
          payouts: settled?.payouts ?? 0,
          paidOut: round2(n(settled?.received)),
          charges: round2(n(settled?.charges)),
          shortfall: round2(n(settled?.shortfall)),
        }
      }),
      cod: {
        total: round2(codTotal),
        withCourier: round2(n(codBy("with_courier")?.amount)),
        cashInHand: round2(n(codBy("cash_in_hand")?.amount)),
        received: round2(n(codBy("received")?.amount)),
        notCollected: round2(n(codBy("not_collected")?.amount)),
        /** Still to reach the shop's account. */
        outstanding: round2(n(codBy("with_courier")?.amount) + n(codBy("cash_in_hand")?.amount)),
      },
      unsettledShortfall: round2(settlements.reduce((a, s) => a + n(s.shortfall), 0)),
    }
  }

  // ================================================================ returns and refunds

  async returns(q: RangeQuery) {
    const { tz, r } = await this.range(q)
    const [refunds, byMethod, byReason, returns, returnReasons, topReturned, orders] =
      await Promise.all([
        prisma.$queryRaw<{ refunds: number; amount: number; orders: number }[]>`
        SELECT COUNT(*)::int AS refunds, COALESCE(SUM("amount"), 0)::float8 AS amount,
               COUNT(DISTINCT "orderId")::int AS orders
        FROM "Refund" WHERE "storeId" = ${this.storeId} AND "createdAt" >= ${r.start} AND "createdAt" < ${r.end}
      `,
        prisma.$queryRaw<{ key: string; refunds: number; amount: number }[]>`
        SELECT "method" AS key, COUNT(*)::int AS refunds, SUM("amount")::float8 AS amount
        FROM "Refund" WHERE "storeId" = ${this.storeId} AND "createdAt" >= ${r.start} AND "createdAt" < ${r.end}
        GROUP BY 1 ORDER BY amount DESC
      `,
        prisma.$queryRaw<{ key: string; refunds: number; amount: number }[]>`
        SELECT "reason" AS key, COUNT(*)::int AS refunds, SUM("amount")::float8 AS amount
        FROM "Refund" WHERE "storeId" = ${this.storeId} AND "createdAt" >= ${r.start} AND "createdAt" < ${r.end}
        GROUP BY 1 ORDER BY refunds DESC LIMIT 15
      `,
        prisma.$queryRaw<{ key: string; returns: number; amount: number }[]>`
        SELECT "status" AS key, COUNT(*)::int AS returns, SUM("requestedAmount")::float8 AS amount
        FROM "ReturnRequest" WHERE "storeId" = ${this.storeId} AND "createdAt" >= ${r.start} AND "createdAt" < ${r.end}
        GROUP BY 1 ORDER BY returns DESC
      `,
        prisma.$queryRaw<{ key: string; returns: number }[]>`
        SELECT "reason" AS key, COUNT(*)::int AS returns
        FROM "ReturnRequest" WHERE "storeId" = ${this.storeId} AND "createdAt" >= ${r.start} AND "createdAt" < ${r.end}
        GROUP BY 1 ORDER BY returns DESC LIMIT 15
      `,
        prisma.$queryRaw<{ name: string; units: number; amount: number }[]>`
        SELECT MAX(oi."productName") AS name, SUM(ri."quantity")::int AS units, SUM(ri."amount")::float8 AS amount
        FROM "RefundItem" ri
        JOIN "Refund" rf ON rf."id" = ri."refundId"
        JOIN "OrderItem" oi ON oi."id" = ri."orderItemId"
        WHERE rf."storeId" = ${this.storeId} AND rf."createdAt" >= ${r.start} AND rf."createdAt" < ${r.end}
        GROUP BY COALESCE(oi."productId"::text, oi."productName")
        ORDER BY units DESC LIMIT 20
      `,
        prisma.order.count({
          where: {
            storeId: this.storeId,
            createdAt: { gte: r.start, lt: r.end },
            status: { notIn: ["CANCELLED", "FAILED"] },
          },
        }),
      ])
    const rf = refunds[0]
    const returnCount = returns.reduce((a, x) => a + x.returns, 0)
    return {
      ...ReportsService.head(tz, r),
      totals: {
        refunds: n(rf?.refunds),
        refunded: round2(n(rf?.amount)),
        refundedOrders: n(rf?.orders),
        returns: returnCount,
        ordersPlaced: orders,
        /** Returns asked for in the range, per 100 orders placed in it. */
        returnRate: pct(returnCount, orders),
      },
      refundsByMethod: byMethod.map((x) => ({
        key: x.key,
        refunds: x.refunds,
        amount: round2(n(x.amount)),
      })),
      refundsByReason: byReason.map((x) => ({
        key: x.key,
        refunds: x.refunds,
        amount: round2(n(x.amount)),
      })),
      returnsByStatus: returns.map((x) => ({
        key: x.key,
        returns: x.returns,
        amount: round2(n(x.amount)),
      })),
      returnsByReason: returnReasons,
      mostRefunded: topReturned.map((x) => ({
        name: x.name,
        units: x.units,
        amount: round2(n(x.amount)),
      })),
    }
  }

  // ================================================================ tax

  async tax(q: RangeQuery) {
    const { tz, r, basis } = await this.range(q)
    const bucket = pickBucket(r.days) === "day" ? "day" : "month"
    const rows = await prisma.$queryRaw<
      { k: string; orders: number; taxed: number; sales: number; shipping: number; tax: number }[]
    >`
      SELECT ${ReportsService.bucketSql(bucket, tz)} AS k,
             COUNT(*)::int AS orders,
             COUNT(*) FILTER (WHERE o."taxTotal" > 0)::int AS taxed,
             SUM(o."itemsSubtotal" - o."discountTotal")::float8 AS sales,
             SUM(o."shippingTotal")::float8 AS shipping,
             SUM(o."taxTotal")::float8 AS tax
      FROM "Order" o
      WHERE o."storeId" = ${this.storeId}
        AND o."createdAt" >= ${r.start} AND o."createdAt" < ${r.end}
        AND o."status"::text = ANY(${statusesFor(basis)})
      GROUP BY 1
    `
    const byKey = new Map(rows.map((x) => [x.k, x]))
    const periods = bucketKeys(r, bucket).map((k) => {
      const x = byKey.get(k)
      return {
        period: k,
        orders: n(x?.orders),
        taxedOrders: n(x?.taxed),
        sales: round2(n(x?.sales)),
        shipping: round2(n(x?.shipping)),
        tax: round2(n(x?.tax)),
      }
    })
    const sum = (f: (p: (typeof periods)[number]) => number) =>
      round2(periods.reduce((a, p) => a + f(p), 0))
    const sales = sum((p) => p.sales)
    const tax = sum((p) => p.tax)
    return {
      ...ReportsService.head(tz, r, basis),
      bucket,
      totals: {
        orders: sum((p) => p.orders),
        taxedOrders: sum((p) => p.taxedOrders),
        sales,
        shipping: sum((p) => p.shipping),
        tax,
        /** Tax as % of sales after discounts. */
        effectiveRate: pct(tax, sales),
      },
      periods,
    }
  }

  // ================================================================ stock value (today)

  async stock() {
    const products = await prisma.product.findMany({
      where: { storeId: this.storeId, status: { not: "archived" } },
      select: {
        id: true,
        name: true,
        sku: true,
        manageStock: true,
        stockQty: true,
        costPrice: true,
        supplierCost: true,
        regularPrice: true,
        salePrice: true,
        categories: {
          select: { primary: true, category: { select: { name: true } } },
          orderBy: [{ primary: "desc" }, { categoryId: "asc" }],
          take: 1,
        },
        variants: {
          where: { status: "active" },
          select: {
            stockQty: true,
            costPrice: true,
            regularPrice: true,
            salePrice: true,
            manageStock: true,
          },
        },
      },
    })
    const rows = products.map((p) => {
      const lines = p.variants.length
        ? p.variants.map((v) => ({
            qty: v.manageStock ? Math.max(0, n(v.stockQty)) : 0,
            cost: v.costPrice ?? p.costPrice ?? p.supplierCost,
            price: v.salePrice ?? v.regularPrice ?? p.salePrice ?? p.regularPrice,
          }))
        : [
            {
              qty: p.manageStock ? Math.max(0, n(p.stockQty)) : 0,
              cost: p.costPrice ?? p.supplierCost,
              price: p.salePrice ?? p.regularPrice,
            },
          ]
      const units = lines.reduce((a, l) => a + l.qty, 0)
      const unitsNoCost = lines.reduce((a, l) => a + (l.cost === null ? l.qty : 0), 0)
      const costValue = round2(lines.reduce((a, l) => a + l.qty * n(l.cost), 0))
      const retailValue = round2(lines.reduce((a, l) => a + l.qty * n(l.price), 0))
      return {
        productId: String(p.id),
        name: p.name,
        sku: p.sku,
        category: p.categories[0]?.category.name ?? "Uncategorised",
        units,
        unitsWithoutCost: unitsNoCost,
        costValue,
        retailValue,
        /** Profit if all of it sells at today's price. */
        potentialProfit: round2(retailValue - costValue),
      }
    })
    const inStock = rows.filter((x) => x.units > 0)
    const byCat = new Map<
      string,
      { category: string; products: number; units: number; costValue: number; retailValue: number }
    >()
    for (const x of inStock) {
      const c = byCat.get(x.category) ?? {
        category: x.category,
        products: 0,
        units: 0,
        costValue: 0,
        retailValue: 0,
      }
      c.products += 1
      c.units += x.units
      c.costValue = round2(c.costValue + x.costValue)
      c.retailValue = round2(c.retailValue + x.retailValue)
      byCat.set(x.category, c)
    }
    const total = (f: (x: (typeof rows)[number]) => number) =>
      round2(inStock.reduce((a, x) => a + f(x), 0))
    return {
      asOf: new Date().toISOString(),
      totals: {
        products: inStock.length,
        units: total((x) => x.units),
        costValue: total((x) => x.costValue),
        retailValue: total((x) => x.retailValue),
        potentialProfit: total((x) => x.potentialProfit),
        unitsWithoutCost: total((x) => x.unitsWithoutCost),
        productsWithoutCost: inStock.filter((x) => x.unitsWithoutCost > 0).length,
      },
      categories: [...byCat.values()].sort((a, b) => b.costValue - a.costValue),
      products: inStock.sort((a, b) => b.costValue - a.costValue).slice(0, 500),
    }
  }
}
