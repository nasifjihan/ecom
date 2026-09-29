"use client";

/** What the stock on hand is worth today, at cost and at selling price. */
import Link from "next/link";
import { Kpi, Note, ReportError, ReportLoading, ReportTable, int, tk, type Column } from "@/components/reports/shared";
import { useStockReportQuery, type StockReport } from "@/lib/features/reports/reports-api-slice";

type Row = StockReport["products"][number];
type Cat = StockReport["categories"][number];

const productCols: Column<Row>[] = [
  {
    key: "name",
    label: "Product",
    cell: (r) => (
      <Link href={`/catalog/products/${r.productId}`} className="font-medium hover:underline">
        {r.name}
      </Link>
    ),
    csv: (r) => r.name,
  },
  { key: "sku", label: "SKU", cell: (r) => <span className="text-slate-500">{r.sku ?? "—"}</span>, csv: (r) => r.sku },
  { key: "category", label: "Category", cell: (r) => r.category, csv: (r) => r.category },
  { key: "units", label: "In stock", align: "right", cell: (r) => int(r.units), csv: (r) => r.units },
  {
    key: "costValue",
    label: "Value at cost",
    align: "right",
    cell: (r) => (r.unitsWithoutCost === r.units ? <span className="text-amber-700">no cost</span> : tk(r.costValue)),
    csv: (r) => r.costValue,
  },
  { key: "retailValue", label: "Value at selling price", align: "right", cell: (r) => tk(r.retailValue), csv: (r) => r.retailValue },
  { key: "unitsWithoutCost", label: "Units without cost", align: "right", cell: (r) => (r.unitsWithoutCost ? int(r.unitsWithoutCost) : "—"), csv: (r) => r.unitsWithoutCost },
];
const catCols: Column<Cat>[] = [
  { key: "category", label: "Category", cell: (r) => <span className="font-medium">{r.category}</span>, csv: (r) => r.category },
  { key: "products", label: "Products", align: "right", cell: (r) => int(r.products), csv: (r) => r.products },
  { key: "units", label: "In stock", align: "right", cell: (r) => int(r.units), csv: (r) => r.units },
  { key: "costValue", label: "Value at cost", align: "right", cell: (r) => tk(r.costValue), csv: (r) => r.costValue },
  { key: "retailValue", label: "Value at selling price", align: "right", cell: (r) => tk(r.retailValue), csv: (r) => r.retailValue },
];

export default function StockReportPage() {
  const { data, error, isFetching } = useStockReportQuery();
  if (error) return <ReportError error={error} />;
  if (!data) return <ReportLoading />;
  const t = data.totals;
  return (
    <div className={isFetching ? "space-y-5 opacity-70" : "space-y-5"}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Stock value at cost" value={tk(t.costValue)} hint={`${int(t.units)} units of ${int(t.products)} products`} />
        <Kpi label="At selling price" value={tk(t.retailValue)} />
        <Kpi label="Profit if it all sells" value={tk(t.potentialProfit)} hint="At today's prices, before discounts" />
        <Kpi
          label="Units without a cost price"
          value={int(t.unitsWithoutCost)}
          hint={t.productsWithoutCost ? `${int(t.productsWithoutCost)} products; their cost counts as ৳0` : "Every unit has a cost"}
          tone={t.unitsWithoutCost ? "bad" : undefined}
        />
      </div>
      <ReportTable title="By category" filename="stock-value-by-category" rows={data.categories} columns={catCols} />
      <ReportTable title="Products" filename="stock-value" rows={data.products} columns={productCols} limit={100} empty="Nothing in stock." />
      <Note>As of {new Date(data.asOf).toLocaleString("en-GB")}. Only products that track stock are counted; options use their own cost and price when set.</Note>
    </div>
  );
}
