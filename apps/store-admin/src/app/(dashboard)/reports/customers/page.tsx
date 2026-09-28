"use client";

/** New and returning customers, repeat buyers, top customers and where orders go. */
import Link from "next/link";
import { Kpi, Note, ReportError, ReportLoading, ReportTable, int, pctText, tk, useReportRange, type Column } from "@/components/reports/shared";
import { useCustomersReportQuery, type CustomersReport } from "@/lib/features/reports/reports-api-slice";

type Top = CustomersReport["topCustomers"][number];
type Area = CustomersReport["byArea"][number];

const topCols: Column<Top>[] = [
  {
    key: "name",
    label: "Customer",
    cell: (r) => (
      <Link href={`/customers/${r.id}`} className="font-medium hover:underline">
        {r.name}
      </Link>
    ),
    csv: (r) => r.name,
  },
  { key: "phone", label: "Phone", cell: (r) => r.phone ?? "—", csv: (r) => r.phone },
  { key: "orders", label: "Orders", align: "right", cell: (r) => int(r.orders), csv: (r) => r.orders },
  { key: "sales", label: "Net sales", align: "right", cell: (r) => tk(r.sales), csv: (r) => r.sales },
  { key: "lifetimeOrders", label: "Orders ever", align: "right", cell: (r) => int(r.lifetimeOrders), csv: (r) => r.lifetimeOrders },
  {
    key: "lastOrderAt",
    label: "Last order",
    align: "right",
    cell: (r) => new Date(r.lastOrderAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
    csv: (r) => r.lastOrderAt.slice(0, 10),
  },
];

const areaCols: Column<Area>[] = [
  { key: "area", label: "District / city", cell: (r) => r.area, csv: (r) => r.area },
  { key: "orders", label: "Orders", align: "right", cell: (r) => int(r.orders), csv: (r) => r.orders },
  { key: "sales", label: "Net sales", align: "right", cell: (r) => tk(r.sales), csv: (r) => r.sales },
];

export default function CustomersReportPage() {
  const { args } = useReportRange();
  const { data, error, isFetching } = useCustomersReportQuery(args);
  if (error) return <ReportError error={error} />;
  if (!data) return <ReportLoading />;
  const t = data.totals;
  const orders = t.customerOrders + t.guestOrders;
  return (
    <div className={isFetching ? "space-y-5 opacity-70" : "space-y-5"}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Customers who ordered" value={int(t.customers)} hint={`${int(t.newCustomers)} new · ${int(t.returningCustomers)} returning`} />
        <Kpi label="Ordered more than once" value={pctText(t.repeatRate)} hint={`${int(t.repeatCustomers)} customers in this period`} />
        <Kpi label="Net sales per customer" value={tk(t.salesPerCustomer)} hint="Customers with an account or a record" />
        <Kpi label="Guest orders" value={int(t.guestOrders)} hint={`${pctText(orders ? Math.round((t.guestOrders / orders) * 1000) / 10 : null)} of orders · ${tk(t.guestSales)}`} />
      </div>
      <div className="grid gap-5 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <ReportTable title="Top customers" filename="top-customers" rows={data.topCustomers} columns={topCols} empty="No customer orders in this period." />
        </div>
        <ReportTable title="By area" filename="orders-by-area" rows={data.byArea} columns={areaCols} />
      </div>
      <Note>New = their first order was in this period. Guest orders have no customer record, so they aren&apos;t in the customer counts.</Note>
    </div>
  );
}
