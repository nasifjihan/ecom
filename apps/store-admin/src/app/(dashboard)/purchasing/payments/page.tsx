"use client";

/** Every payment made to suppliers; record one, or undo one entered by mistake (the money goes back). */
import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { HandCoins, Plus, Undo2 } from "lucide-react";
import { Button, Card, CardContent, Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, cn } from "@/components/ui";
import { PageTitle } from "@/components/content/shared";
import { Pager, PayDialog, SELECT } from "@/components/purchasing/shared";
import { errorText } from "@/lib/features/content/content-api-slice";
import { useCan } from "@/lib/permissions";
import {
  PAYMENT_METHOD_LABELS,
  shortDate,
  tk,
  useSupplierPaymentsQuery,
  useSuppliersQuery,
  useVoidSupplierPaymentMutation,
} from "@/lib/features/purchasing/purchasing-api-slice";

export default function SupplierPaymentsPage() {
  const { can } = useCan();
  const [supplierId, setSupplierId] = useState("");
  const [page, setPage] = useState(1);
  const [paying, setPaying] = useState(false);
  const { data: suppliers } = useSuppliersQuery();
  const { data, isFetching } = useSupplierPaymentsQuery({ supplierId, page });
  const [undo] = useVoidSupplierPaymentMutation();
  const chosen = suppliers?.find((s) => s.id === supplierId);

  return (
    <div className="space-y-6">
      <PageTitle
        icon={HandCoins}
        title="Supplier payments"
        description="Money paid to suppliers. Each payment comes out of one of your accounts."
        actions={
          can("purchasing.create") && (
            <Button disabled={!chosen} title={chosen ? undefined : "Choose a supplier first"} onClick={() => setPaying(true)}>
              <Plus className="mr-1 h-4 w-4" /> {chosen ? `Pay ${chosen.name}` : "Pay a supplier"}
            </Button>
          )
        }
      />
      <div className="flex flex-wrap items-center gap-3">
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
        {chosen && (
          <p className="text-sm text-slate-600">
            {chosen.balance > 0 ? `You owe ${tk(chosen.balance)}` : chosen.balance < 0 ? `Paid ${tk(-chosen.balance)} ahead` : "Settled"}
          </p>
        )}
      </div>
      <Card>
        <CardContent className={cn("p-0", isFetching && "opacity-60")}>
          {!data ? (
            <Skeleton className="m-4 h-24" />
          ) : !data.items.length ? (
            <p className="p-10 text-center text-sm text-slate-500">No payments yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Purchase</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((x) => (
                  <TableRow key={x.id}>
                    <TableCell>{shortDate(x.paidOn)}</TableCell>
                    <TableCell className="font-medium">{x.supplier}</TableCell>
                    <TableCell>
                      {x.purchaseId ? (
                        <Link href={`/purchasing/purchases/${x.purchaseId}`} className="text-blue-600 hover:underline">
                          {x.purchaseNumber}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {x.account} · {PAYMENT_METHOD_LABELS[x.method]}
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">{x.reference ?? x.notes ?? "—"}</TableCell>
                    <TableCell className="text-right font-medium">{tk(x.amount)}</TableCell>
                    <TableCell>
                      {can("purchasing.delete") && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            if (!confirm(`Undo this ${tk(x.amount)} payment? The money goes back into ${x.account}.`)) return;
                            try {
                              await undo(x.id).unwrap();
                              toast.success("Payment undone");
                            } catch (e) {
                              toast.error(errorText(e));
                            }
                          }}
                        >
                          <Undo2 className="mr-1 h-4 w-4" /> Undo
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
      {chosen && <PayDialog open={paying} onOpenChange={setPaying} supplierId={chosen.id} supplierName={chosen.name} suggested={chosen.balance} />}
    </div>
  );
}
