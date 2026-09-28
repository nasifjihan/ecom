"use client";

/** Tax collected per day or month, for filing. */
import { Kpi, Note, ReportError, ReportLoading, ReportTable, fullDay, int, pctText, tk, useReportRange, type Column } from "@/components/reports/shared";
import { useTaxReportQuery, type TaxReport } from "@/lib/features/reports/reports-api-slice";

type Row = TaxReport["periods"][number];

export default function TaxReportPage() {
  const { args } = useReportRange();
  const { data, error, isFetching } = useTaxReportQuery(args);
  if (error) return <ReportError error={error} />;
  if (!data) return <ReportLoading />;
  const t = data.totals;
  const cols: Column<Row>[] = [
    {
      key: "period",
      label: data.bucket === "day" ? "Day" : "Month",
      cell: (r) => (data.bucket === "day" ? fullDay(r.period) : new Date(`${r.period}T00:00:00`).toLocaleDateString("en-GB", { month: "long", year: "numeric" })),
      csv: (r) => (data.bucket === "day" ? r.period : r.period.slice(0, 7)),
    },
    { key: "orders", label: "Orders", align: "right", cell: (r) => int(r.orders), csv: (r) => r.orders },
    { key: "taxedOrders", label: "With tax", align: "right", cell: (r) => int(r.taxedOrders), csv: (r) => r.taxedOrders },
    { key: "sales", label: "Sales after discounts", align: "right", cell: (r) => tk(r.sales), csv: (r) => r.sales },
    { key: "shipping", label: "Delivery charged", align: "right", cell: (r) => tk(r.shipping), csv: (r) => r.shipping },
    { key: "tax", label: "Tax collected", align: "right", cell: (r) => tk(r.tax), csv: (r) => r.tax },
  ];
  return (
    <div className={isFetching ? "space-y-5 opacity-70" : "space-y-5"}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Tax collected" value={tk(t.tax)} />
        <Kpi label="Sales after discounts" value={tk(t.sales)} />
        <Kpi label="Effective rate" value={pctText(t.effectiveRate)} hint="Tax ÷ sales after discounts" />
        <Kpi label="Orders with tax" value={int(t.taxedOrders)} hint={`of ${int(t.orders)} orders`} />
      </div>
      <ReportTable title={data.bucket === "day" ? "By day" : "By month"} filename="tax" rows={data.periods.filter((p) => p.orders > 0)} columns={cols} empty="No orders in this period." />
      <Note>Tax is what was charged on orders placed in the period. Refunds don&apos;t reduce it here; check refunded orders before filing.</Note>
    </div>
  );
}
