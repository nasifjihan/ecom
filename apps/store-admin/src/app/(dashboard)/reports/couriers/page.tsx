"use client";

/** Parcels per courier (delivered, returned, how long), cash on delivery and courier payouts. */
import { Kpi, Note, ReportError, ReportLoading, ReportTable, int, pctText, tk, useReportRange, type Column } from "@/components/reports/shared";
import { useCouriersReportQuery, type CouriersReport } from "@/lib/features/reports/reports-api-slice";

type Row = CouriersReport["couriers"][number];

const cols: Column<Row>[] = [
  { key: "name", label: "Courier", cell: (r) => <span className="font-medium">{r.name}</span>, csv: (r) => r.name },
  { key: "parcels", label: "Parcels", align: "right", cell: (r) => int(r.parcels), csv: (r) => r.parcels },
  { key: "delivered", label: "Delivered", align: "right", cell: (r) => int(r.delivered), csv: (r) => r.delivered },
  { key: "returned", label: "Returned / failed", align: "right", cell: (r) => int(r.returned + r.failed), csv: (r) => r.returned + r.failed },
  { key: "inProgress", label: "On the way", align: "right", cell: (r) => int(r.inProgress), csv: (r) => r.inProgress },
  { key: "successRate", label: "Delivered %", align: "right", cell: (r) => pctText(r.successRate), csv: (r) => r.successRate },
  { key: "averageDays", label: "Avg. days", align: "right", cell: (r) => r.averageDays ?? "—", csv: (r) => r.averageDays },
  { key: "codDelivered", label: "COD delivered", align: "right", cell: (r) => tk(r.codDelivered), csv: (r) => r.codDelivered },
  { key: "deliveryFees", label: "Courier fees", align: "right", cell: (r) => tk(r.deliveryFees), csv: (r) => r.deliveryFees },
  { key: "paidOut", label: "Paid to you", align: "right", cell: (r) => tk(r.paidOut), csv: (r) => r.paidOut },
  { key: "shortfall", label: "Short paid", align: "right", cell: (r) => <span className={r.shortfall > 0 ? "text-red-700" : ""}>{tk(r.shortfall)}</span>, csv: (r) => r.shortfall },
];

export default function CouriersReportPage() {
  const { args } = useReportRange();
  const { data, error, isFetching } = useCouriersReportQuery(args);
  if (error) return <ReportError error={error} />;
  if (!data) return <ReportLoading />;
  const parcels = data.couriers.reduce((a, c) => a + c.parcels, 0);
  const delivered = data.couriers.reduce((a, c) => a + c.delivered, 0);
  const back = data.couriers.reduce((a, c) => a + c.returned + c.failed, 0);
  return (
    <div className={isFetching ? "space-y-5 opacity-70" : "space-y-5"}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Parcels sent" value={int(parcels)} hint={`${int(delivered)} delivered · ${int(back)} came back`} />
        <Kpi label="Came back" value={pctText(delivered + back ? Math.round((back / (delivered + back)) * 1000) / 10 : null)} hint="Returned or failed, of parcels that finished" tone={back > delivered ? "bad" : undefined} />
        <Kpi label="COD still to come in" value={tk(data.cod.outstanding)} hint={`${tk(data.cod.withCourier)} with couriers · ${tk(data.cod.cashInHand)} with staff`} />
        <Kpi label="Short paid by couriers" value={tk(data.unsettledShortfall)} hint="Payouts below what they collected, not yet resolved" tone={data.unsettledShortfall > 0 ? "bad" : undefined} />
      </div>
      <ReportTable title="By courier" filename="couriers" rows={data.couriers} columns={cols} empty="No parcels in this period." />
      <Note>Parcels are counted by the day they were created; payouts by the day the courier paid. Avg. days runs from pickup (or creation) to delivery.</Note>
    </div>
  );
}
