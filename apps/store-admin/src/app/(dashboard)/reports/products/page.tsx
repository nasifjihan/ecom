"use client";

/** Products and categories: units, net sales, cost of goods and gross profit. */
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui";
import { CostCoverageNote, Note, ReportError, ReportLoading, ReportTable, int, pctText, tk, useReportRange, type Column } from "@/components/reports/shared";
import { useProductsReportQuery, type ProductsReport } from "@/lib/features/reports/reports-api-slice";

type Row = ProductsReport["products"][number];
type Cat = ProductsReport["categories"][number];

const SORTS = [
  { key: "revenue", label: "Net sales" },
  { key: "units", label: "Units" },
  { key: "profit", label: "Gross profit" },
] as const;

const productCols: Column<Row>[] = [
  {
    key: "name",
    label: "Product",
    cell: (r) =>
      r.productId ? (
        <Link href={`/catalog/products/${r.productId}`} className="font-medium hover:underline">
          {r.name}
        </Link>
      ) : (
        <span className="font-medium">{r.name}</span>
      ),
    csv: (r) => r.name,
  },
  { key: "sku", label: "SKU", cell: (r) => <span className="text-slate-500">{r.sku ?? "—"}</span>, csv: (r) => r.sku },
  { key: "category", label: "Category", cell: (r) => r.category ?? "—", csv: (r) => r.category },
  { key: "orders", label: "Orders", align: "right", cell: (r) => int(r.orders), csv: (r) => r.orders },
  { key: "units", label: "Units", align: "right", cell: (r) => int(r.units), csv: (r) => r.units },
  { key: "unitsReturned", label: "Returned", align: "right", cell: (r) => (r.unitsReturned ? int(r.unitsReturned) : "—"), csv: (r) => r.unitsReturned },
  { key: "netSales", label: "Net sales", align: "right", cell: (r) => tk(r.netSales), csv: (r) => r.netSales },
  { key: "cogs", label: "Cost of goods", align: "right", cell: (r) => (r.costCoverage === 0 ? <span className="text-amber-700">no cost</span> : tk(r.cogs)), csv: (r) => r.cogs },
  { key: "grossProfit", label: "Gross profit", align: "right", cell: (r) => <span className={r.grossProfit < 0 ? "text-red-700" : ""}>{tk(r.grossProfit)}</span>, csv: (r) => r.grossProfit },
  { key: "margin", label: "Margin", align: "right", cell: (r) => (r.costCoverage === 0 ? "—" : pctText(r.margin)), csv: (r) => r.margin },
  { key: "costCoverage", label: "Units with cost", align: "right", cell: (r) => pctText(r.costCoverage), csv: (r) => r.costCoverage },
];

const catCols: Column<Cat>[] = [
  { key: "category", label: "Category", cell: (r) => <span className="font-medium">{r.category}</span>, csv: (r) => r.category },
  { key: "products", label: "Products sold", align: "right", cell: (r) => int(r.products), csv: (r) => r.products },
  { key: "units", label: "Units", align: "right", cell: (r) => int(r.units), csv: (r) => r.units },
  { key: "netSales", label: "Net sales", align: "right", cell: (r) => tk(r.netSales), csv: (r) => r.netSales },
  { key: "cogs", label: "Cost of goods", align: "right", cell: (r) => tk(r.cogs), csv: (r) => r.cogs },
  { key: "grossProfit", label: "Gross profit", align: "right", cell: (r) => tk(r.grossProfit), csv: (r) => r.grossProfit },
  { key: "margin", label: "Margin", align: "right", cell: (r) => pctText(r.margin), csv: (r) => r.margin },
];

export default function ProductsReportPage() {
  const { args } = useReportRange();
  const [sort, setSort] = useState<ProductsReport["sort"]>("revenue");
  const { data, error, isFetching } = useProductsReportQuery({ ...args, sort });
  if (error) return <ReportError error={error} />;
  if (!data) return <ReportLoading />;
  const units = data.products.reduce((a, p) => a + p.units, 0);
  const withCost = data.products.reduce((a, p) => a + ((p.costCoverage ?? 0) / 100) * p.units, 0);
  return (
    <div className={isFetching ? "space-y-5 opacity-70" : "space-y-5"}>
      <CostCoverageNote coverage={units ? Math.round((withCost / units) * 1000) / 10 : null} />
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-slate-500">Sort by</span>
        {SORTS.map((s) => (
          <Button key={s.key} size="sm" variant={sort === s.key ? "default" : "outline"} onClick={() => setSort(s.key)}>
            {s.label}
          </Button>
        ))}
      </div>
      <ReportTable title="Products" filename="products" rows={data.products} columns={productCols} limit={100} empty="No products sold in this period." />
      <ReportTable title="Categories" description="Each product counts in its main category." filename="categories" rows={data.categories} columns={catCols} />
      <Note>Net sales are the line prices after discounts, less what was refunded on those lines. A returned unit that went back into stock isn&apos;t a cost.</Note>
    </div>
  );
}
