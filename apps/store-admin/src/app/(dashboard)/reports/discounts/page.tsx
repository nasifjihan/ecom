"use client";

/** What coupons and automatic promotions cost and what they brought in. */
import { Kpi, Note, ReportError, ReportLoading, ReportTable, int, pctText, tk, useReportRange, words, type Column } from "@/components/reports/shared";
import { useDiscountsReportQuery, type DiscountsReport } from "@/lib/features/reports/reports-api-slice";

type Coupon = DiscountsReport["coupons"][number];
type Promo = DiscountsReport["promotions"][number];

const PROMO_TYPES: Record<string, string> = { discount: "Discount", bxgy: "Buy X get Y", free_delivery: "Free delivery", free_gift: "Free gift" };

const couponCols: Column<Coupon>[] = [
  { key: "code", label: "Code", cell: (r) => <span className="font-mono font-medium">{r.code}</span>, csv: (r) => r.code },
  { key: "orders", label: "Orders", align: "right", cell: (r) => int(r.orders), csv: (r) => r.orders },
  { key: "discount", label: "Discount given", align: "right", cell: (r) => tk(r.discount), csv: (r) => r.discount },
  { key: "sales", label: "Sales (after discounts)", align: "right", cell: (r) => tk(r.sales), csv: (r) => r.sales },
  { key: "averageOrder", label: "Average order", align: "right", cell: (r) => tk(r.averageOrder), csv: (r) => r.averageOrder },
  { key: "salesPerTaka", label: "Sales per ৳1 off", align: "right", cell: (r) => (r.salesPerTaka === null ? "—" : `৳${r.salesPerTaka}`), csv: (r) => r.salesPerTaka },
  { key: "newCustomers", label: "First orders", align: "right", cell: (r) => int(r.newCustomers), csv: (r) => r.newCustomers },
];

const promoCols: Column<Promo>[] = [
  { key: "name", label: "Promotion", cell: (r) => <span className="font-medium">{r.name}</span>, csv: (r) => r.name },
  { key: "type", label: "Type", cell: (r) => PROMO_TYPES[r.type] ?? words(r.type), csv: (r) => r.type },
  { key: "orders", label: "Orders", align: "right", cell: (r) => int(r.orders), csv: (r) => r.orders },
  { key: "discount", label: "Discount given", align: "right", cell: (r) => (r.discount ? tk(r.discount) : "—"), csv: (r) => r.discount },
  { key: "sales", label: "Sales (after discounts)", align: "right", cell: (r) => tk(r.sales), csv: (r) => r.sales },
];

export default function DiscountsReportPage() {
  const { args } = useReportRange();
  const { data, error, isFetching } = useDiscountsReportQuery(args);
  if (error) return <ReportError error={error} />;
  if (!data) return <ReportLoading />;
  const t = data.totals;
  return (
    <div className={isFetching ? "space-y-5 opacity-70" : "space-y-5"}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="All discounts" value={tk(t.allDiscounts)} hint={`${pctText(t.discountRate)} of sales before discounts`} />
        <Kpi label="Coupons" value={tk(t.couponDiscount)} hint={`${int(t.ordersWithCoupon)} of ${int(t.orders)} orders`} />
        <Kpi label="Automatic promotions" value={tk(t.promotionDiscount)} hint={`${int(t.ordersWithPromotion)} orders`} />
        <Kpi label="Staff discounts" value={tk(t.manualDiscount)} hint="Given on orders entered by hand" />
      </div>
      <ReportTable title="Coupons" filename="coupons" rows={data.coupons} columns={couponCols} empty="No coupons used in this period." />
      <ReportTable title="Automatic promotions" filename="promotions" rows={data.promotions} columns={promoCols} empty="No promotions applied in this period." />
      <Note>&quot;First orders&quot; counts customers whose first order used the coupon. Free gifts and free delivery show no discount here; the gift&apos;s cost is in cost of goods.</Note>
    </div>
  );
}
