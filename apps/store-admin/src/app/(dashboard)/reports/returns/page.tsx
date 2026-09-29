"use client";

/** Refunds given and returns asked for: how much, why, how, and which products. */
import { Kpi, Note, ReportError, ReportLoading, ReportTable, int, pctText, tk, useReportRange, words, type Column } from "@/components/reports/shared";
import { useReturnsReportQuery, type ReturnsReport } from "@/lib/features/reports/reports-api-slice";

type Refund = ReturnsReport["refundsByMethod"][number];
type Ret = ReturnsReport["returnsByStatus"][number];
type Product = ReturnsReport["mostRefunded"][number];

const METHODS: Record<string, string> = { original: "Original payment", cash: "Cash", bkash: "bKash", nagad: "Nagad", bank: "Bank", store_credit: "Store credit" };

const refundCols = (label: string, names?: Record<string, string>): Column<Refund>[] => [
  { key: "key", label, cell: (r) => names?.[r.key] ?? r.key, csv: (r) => r.key },
  { key: "refunds", label: "Refunds", align: "right", cell: (r) => int(r.refunds), csv: (r) => r.refunds },
  { key: "amount", label: "Amount", align: "right", cell: (r) => tk(r.amount), csv: (r) => r.amount },
];
const returnCols: Column<Ret>[] = [
  { key: "key", label: "Status", cell: (r) => words(r.key), csv: (r) => r.key },
  { key: "returns", label: "Returns", align: "right", cell: (r) => int(r.returns), csv: (r) => r.returns },
  { key: "amount", label: "Asked for", align: "right", cell: (r) => tk(r.amount), csv: (r) => r.amount },
];
const reasonCols: Column<{ key: string; returns: number }>[] = [
  { key: "key", label: "Reason", cell: (r) => r.key, csv: (r) => r.key },
  { key: "returns", label: "Returns", align: "right", cell: (r) => int(r.returns), csv: (r) => r.returns },
];
const productCols: Column<Product>[] = [
  { key: "name", label: "Product", cell: (r) => <span className="font-medium">{r.name}</span>, csv: (r) => r.name },
  { key: "units", label: "Units refunded", align: "right", cell: (r) => int(r.units), csv: (r) => r.units },
  { key: "amount", label: "Refunded", align: "right", cell: (r) => tk(r.amount), csv: (r) => r.amount },
];

export default function ReturnsReportPage() {
  const { args } = useReportRange();
  const { data, error, isFetching } = useReturnsReportQuery(args);
  if (error) return <ReportError error={error} />;
  if (!data) return <ReportLoading />;
  const t = data.totals;
  return (
    <div className={isFetching ? "space-y-5 opacity-70" : "space-y-5"}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Refunded" value={tk(t.refunded)} hint={`${int(t.refunds)} refunds on ${int(t.refundedOrders)} orders`} />
        <Kpi label="Returns asked for" value={int(t.returns)} hint={`${pctText(t.returnRate)} of ${int(t.ordersPlaced)} orders placed`} />
        <Kpi label="Average refund" value={tk(t.refunds ? Math.round(t.refunded / t.refunds) : 0)} />
        <Kpi label="Refunds as store credit" value={tk(data.refundsByMethod.find((m) => m.key === "store_credit")?.amount ?? 0)} hint="Money that stays with the shop" />
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <ReportTable title="Refunds by how they were paid" filename="refunds-by-method" rows={data.refundsByMethod} columns={refundCols("Method", METHODS)} />
        <ReportTable title="Returns by status" filename="returns-by-status" rows={data.returnsByStatus} columns={returnCols} />
        <ReportTable title="Refund reasons" filename="refund-reasons" rows={data.refundsByReason} columns={refundCols("Reason")} />
        <ReportTable title="Return reasons" filename="return-reasons" rows={data.returnsByReason} columns={reasonCols} />
      </div>
      <ReportTable title="Most refunded products" filename="most-refunded" rows={data.mostRefunded} columns={productCols} />
      <Note>Refunds and returns here are counted by the day they were given or asked for. The Sales report counts a refund against the day its order was placed.</Note>
    </div>
  );
}
