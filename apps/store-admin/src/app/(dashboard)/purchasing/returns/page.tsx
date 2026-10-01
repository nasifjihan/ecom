"use client";

/**
 * Goods sent back to suppliers. Each return took the units out of stock and took its value off what
 * the shop owes the supplier; cancel one entered by mistake to put both back. New returns are made
 * from a purchase ("Send back").
 */
import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Undo2 } from "lucide-react";
import { Button, Card, CardContent, Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, cn } from "@/components/ui";
import { EmptyState, PageTitle } from "@/components/content/shared";
import { Pager, SELECT, StatusPill } from "@/components/purchasing/shared";
import { errorText } from "@/lib/features/content/content-api-slice";
import { useCan } from "@/lib/permissions";
import { shortDate, tk, useCancelSupplierReturnMutation, useSupplierReturnsQuery, useSuppliersQuery } from "@/lib/features/purchasing/purchasing-api-slice";

export default function SupplierReturnsPage() {
  const { can } = useCan();
  const [supplierId, setSupplierId] = useState("");
  const [page, setPage] = useState(1);
  const { data: suppliers } = useSuppliersQuery();
  const { data, isFetching } = useSupplierReturnsQuery({ supplierId: supplierId || undefined, page });
  const [cancel] = useCancelSupplierReturnMutation();

  return (
    <div className="space-y-6">
      <PageTitle
        icon={Undo2}
        title="Supplier returns"
        description="Goods sent back to suppliers: they left stock and their value came off what you owe. Send goods back from a purchase."
      />
      <select
        className={cn(SELECT, "w-64")}
        value={supplierId}
        onChange={(e) => {
          setSupplierId(e.target.value);
          setPage(1);
        }}
        aria-label="Supplier"
      >
        <option value="">All suppliers</option>
        {(suppliers ?? []).map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <Card>
        <CardContent className="p-0">
          {!data ? (
            <Skeleton className="m-4 h-40" />
          ) : data.items.length === 0 ? (
            <EmptyState icon={Undo2} title="No returns" text="Open a purchase and use “Send back” to return faulty or wrong goods." />
          ) : (
            <Table className={isFetching ? "opacity-60" : undefined}>
              <TableHeader>
                <TableRow>
                  <TableHead>Return</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      {r.number}
                      {r.purchase && (
                        <Link href={`/purchasing/purchases/${r.purchase.id}`} className="block text-xs text-blue-600 hover:underline">
                          from {r.purchase.number}
                        </Link>
                      )}
                    </TableCell>
                    <TableCell>{shortDate(r.returnedOn)}</TableCell>
                    <TableCell>{r.supplier.name}</TableCell>
                    <TableCell className="text-sm">
                      {r.items.map((i) => (
                        <span key={i.id} className="block">
                          {i.qty} × {i.name}
                        </span>
                      ))}
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">{r.reason}</TableCell>
                    <TableCell className={cn("text-right font-medium", r.status === "cancelled" && "text-slate-400 line-through")}>{tk(r.total)}</TableCell>
                    <TableCell>
                      <StatusPill status={r.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      {r.status === "returned" && can("purchasing.delete") && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={async () => {
                            if (!confirm(`Cancel ${r.number}? The units go back into stock and the credit is removed.`)) return;
                            try {
                              await cancel(r.id).unwrap();
                              toast.success(`${r.number} cancelled`);
                            } catch (e) {
                              toast.error(errorText(e));
                            }
                          }}
                        >
                          Cancel
                        </Button>
                      )}
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
