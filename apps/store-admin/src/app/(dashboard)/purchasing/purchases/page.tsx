"use client";

/** Stock bought from suppliers: each purchase added stock and set the products' cost price. */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Search, ShoppingBag } from "lucide-react";
import { Button, Card, CardContent, Input, Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, cn } from "@/components/ui";
import { PageTitle } from "@/components/content/shared";
import { Pager, SELECT, StatusPill } from "@/components/purchasing/shared";
import { useCan } from "@/lib/permissions";
import { PAYMENT_TERM_LABELS, shortDate, tk, usePurchasesQuery, useSuppliersQuery } from "@/lib/features/purchasing/purchasing-api-slice";

export default function PurchasesPage() {
  const router = useRouter();
  const { can } = useCan();
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [status, setStatus] = useState<"" | "received" | "cancelled">("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => {
    const t = setTimeout(() => setSearch(text.trim()), 300);
    return () => clearTimeout(t);
  }, [text]);
  useEffect(() => setPage(1), [search, supplierId, status, from, to]);
  const { data: suppliers } = useSuppliersQuery();
  const { data, isFetching } = usePurchasesQuery({ search, supplierId, status: status || undefined, from, to, page });

  return (
    <div className="space-y-6">
      <PageTitle
        icon={ShoppingBag}
        title="Purchases"
        description="Stock bought from suppliers. Recording a purchase adds the stock and updates each product's cost price."
        actions={
          can("purchasing.create") && (
            <Button asChild>
              <Link href="/purchasing/purchases/new">
                <Plus className="mr-1 h-4 w-4" /> Record purchase
              </Link>
            </Button>
          )
        }
      />
      <div className="flex flex-wrap items-end gap-2">
        <div className="relative w-64">
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <Input className="pl-9" placeholder="Number, reference or supplier" value={text} onChange={(e) => setText(e.target.value)} aria-label="Search purchases" />
        </div>
        <select className={cn(SELECT, "w-48")} value={supplierId} onChange={(e) => setSupplierId(e.target.value)} aria-label="Supplier">
          <option value="">All suppliers</option>
          {(suppliers ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select className={cn(SELECT, "w-36")} value={status} onChange={(e) => setStatus(e.target.value as typeof status)} aria-label="Status">
          <option value="">Any status</option>
          <option value="received">Received</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <Input type="date" className="w-40" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date" />
        <Input type="date" className="w-40" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To date" />
        {data && <p className="ml-auto text-sm text-slate-600">Received in this list: <b>{tk(data.totalValue)}</b></p>}
      </div>
      <Card>
        <CardContent className={cn("p-0", isFetching && "opacity-60")}>
          {!data ? (
            <Skeleton className="m-4 h-24" />
          ) : !data.items.length ? (
            <p className="p-10 text-center text-sm text-slate-500">No purchases here yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Purchase</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Items</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((p) => (
                  <TableRow key={p.id} className="cursor-pointer" onClick={() => router.push(`/purchasing/purchases/${p.id}`)}>
                    <TableCell className="font-medium">
                      <Link href={`/purchasing/purchases/${p.id}`} className="text-blue-600 hover:underline">
                        {p.number}
                      </Link>
                      {p.reference && <span className="block text-xs text-slate-500">{p.reference}</span>}
                    </TableCell>
                    <TableCell>{shortDate(p.purchasedOn)}</TableCell>
                    <TableCell>{p.supplier}</TableCell>
                    <TableCell className="text-sm text-slate-600">
                      {p.sourcingType === "import" ? `Import${p.originCountry ? ` · ${p.originCountry}` : ""}` : "Local"}
                      {p.sourceFrom && <span className="block text-xs">{p.sourceFrom}</span>}
                    </TableCell>
                    <TableCell className="text-right">{p.items}</TableCell>
                    <TableCell className="text-right font-medium">{tk(p.total)}</TableCell>
                    <TableCell className="text-sm">
                      {PAYMENT_TERM_LABELS[p.paymentTerm]}
                      {p.paid > 0 && <span className="block text-xs text-slate-500">{tk(p.paid)} paid against it</span>}
                    </TableCell>
                    <TableCell>
                      <StatusPill status={p.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      {data && <Pager page={page} totalPages={data.totalPages} onPage={setPage} />}
    </div>
  );
}
