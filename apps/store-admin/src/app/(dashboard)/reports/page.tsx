"use client";

/** Sales and gross profit: totals vs the previous period, a chart, and by period / source / payment method. */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { SalesChart } from "@/components/reports/sales-chart";
import {
  CostCoverageNote,
  Kpi,
  Note,
  ReportError,
  ReportLoading,
  ReportTable,
  fullDay,
  int,
  pctText,
  tk,
  useReportRange,
  words,
  type Column,
} from "@/components/reports/shared";
import { useSalesReportQuery, type Figures } from "@/lib/features/reports/reports-api-slice";

const PAYMENT_NAMES: Record<string, string> = { cod: "Cash on delivery", bkash: "bKash", nagad: "Nagad", rocket: "Rocket", bank_transfer: "Bank transfer" };

type MoneyKey = "itemsSubtotal" | "discounts" | "refunds" | "netSales" | "cogs" | "grossProfit" | "shipping" | "tax";
const money = <T extends Figures>(key: MoneyKey, label: string): Column<T> => ({
  key,
  label,
  align: "right",
  cell: (r) => tk(r[key]),
  csv: (r) => r[key],
});

function figureColumns<T extends Figures>(): Column<T>[] {
  return [
    { key: "orders", label: "Orders", align: "right", cell: (r) => int(r.orders), csv: (r) => r.orders },
    { key: "units", label: "Units", align: "right", cell: (r) => int(r.units), csv: (r) => r.units },
    money("itemsSubtotal", "Gross sales"),
    money("discounts", "Discounts"),
    money("refunds", "Refunds"),
    money("netSales", "Net sales"),
    money("cogs", "Cost of goods"),
    money("grossProfit", "Gross profit"),
    { key: "margin", label: "Margin", align: "right", cell: (r) => pctText(r.margin), csv: (r) => r.margin },
    money("shipping", "Delivery charged"),
    money("tax", "Tax"),
  ];
}

export default function SalesReportPage() {
  const { args } = useReportRange();
  const { data, error, isFetching } = useSalesReportQuery(args);
  if (error) return <ReportError error={error} />;
  if (!data) return <ReportLoading />;
  const t = data.total;
  const periodCol: Column<SalesReportRow> = {
    key: "period",
    label: data.bucket === "day" ? "Day" : data.bucket === "week" ? "Week starting" : "Month",
    cell: (r) => (data.bucket === "month" ? new Date(`${r.period}T00:00:00`).toLocaleDateString("en-GB", { month: "long", year: "numeric" }) : fullDay(r.period)),
    csv: (r) => r.period,
  };
  const keyCol = (label: string, names?: Record<string, string>): Column<KeyRow> => ({
    key: "key",
    label,
    cell: (r) => names?.[r.key] ?? words(r.key),
    csv: (r) => names?.[r.key] ?? r.key,
  });
  const shareCol: Column<KeyRow> = { key: "share", label: "Share", align: "right", cell: (r) => pctText(r.share), csv: (r) => r.share };

  return (
    <div className={isFetching ? "space-y-5 opacity-70 transition-opacity" : "space-y-5"}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Net sales" value={tk(t.netSales)} change={data.changes.netSales} />
        <Kpi label="Gross profit" value={tk(t.grossProfit)} change={data.changes.grossProfit} tone={t.grossProfit < 0 ? "bad" : undefined} />
        <Kpi label="Orders" value={int(t.orders)} change={data.changes.orders} />
        <Kpi label="Average order" value={tk(t.averageOrder)} change={data.changes.averageOrder} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Margin" value={pctText(t.margin)} hint="Gross profit ÷ net sales" />
        <Kpi label="Cost of goods sold" value={tk(t.cogs)} hint={`${int(t.units)} units sold`} />
        <Kpi label="Discounts given" value={tk(t.discounts)} hint={`${pctText(t.itemsSubtotal ? Math.round((t.discounts / t.itemsSubtotal) * 1000) / 10 : null)} of gross sales`} />
        <Kpi label="Refunds" value={tk(t.refunds)} hint="On orders placed in this period" />
      </div>
      <CostCoverageNote coverage={t.costCoverage} />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Net sales and gross profit</CardTitle>
        </CardHeader>
        <CardContent>
          <SalesChart data={data} />
        </CardContent>
      </Card>
      <Note>
        Net sales = gross sales − discounts − refunds (delivery charges and tax aren&apos;t counted as sales). Gross profit = net sales − the cost of the units kept, at their cost
        when sold. Compared with {fullDay(data.previous.from)} – {fullDay(data.previous.to)}.
      </Note>
      <div className="grid gap-5 2xl:grid-cols-2">
        <ReportTable title="By source" description="Where orders came from" filename="sales-by-source" rows={data.bySource} columns={[keyCol("Source"), ...pick(figureColumns<KeyRow>()), shareCol]} />
        {data.byStorefront.length > 1 && (
          <ReportTable
            title="By storefront"
            description="Which storefront orders were placed on"
            filename="sales-by-storefront"
            rows={data.byStorefront}
            columns={[keyCol("Storefront"), ...pick(figureColumns<KeyRow>()), shareCol]}
          />
        )}
        <ReportTable
          title="By payment method"
          filename="sales-by-payment"
          rows={data.byPayment}
          columns={[keyCol("Payment", PAYMENT_NAMES), ...pick(figureColumns<KeyRow>()), shareCol]}
        />
      </div>
      <ReportTable title={`By ${data.bucket}`} filename="sales-by-period" rows={data.series.filter((s) => s.orders > 0)} columns={[periodCol, ...figureColumns<SalesReportRow>()]} empty="No orders in this period." />
    </div>
  );
}

type SalesReportRow = Figures & { period: string };
type KeyRow = Figures & { key: string; share: number | null };

/** The shorter set for the side-by-side tables. */
const pick = <T extends Figures>(cols: Column<T>[]) => cols.filter((c) => ["orders", "netSales", "grossProfit", "margin"].includes(c.key));
