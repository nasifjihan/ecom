"use client";

/** One purchase: items with landed cost, charges, payments against it; pay the rest or cancel it. */
import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Ban, ShoppingBag, Wallet } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle, Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui";
import { PageTitle } from "@/components/content/shared";
import { PayDialog, StatusPill } from "@/components/purchasing/shared";
import { errorText } from "@/lib/features/content/content-api-slice";
import { useCan } from "@/lib/permissions";
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_TERM_LABELS,
  shortDate,
  tk,
  useCancelPurchaseMutation,
  usePurchaseQuery,
} from "@/lib/features/purchasing/purchasing-api-slice";

export default function PurchasePage() {
  const { id } = useParams<{ id: string }>();
  const { data: p, error } = usePurchaseQuery(id);
  const [cancel, { isLoading: cancelling }] = useCancelPurchaseMutation();
  const [paying, setPaying] = useState(false);
  const { can } = useCan();

  if (error) return <p className="p-10 text-center text-sm text-slate-500">{errorText(error, "Purchase not found.")}</p>;
  if (!p) return <Skeleton className="h-64" />;
  const due = Math.max(0, Math.round((p.total - p.paid) * 100) / 100);

  return (
    <div className="space-y-6">
      <PageTitle
        icon={ShoppingBag}
        title={`Purchase ${p.number}`}
        description={`${p.supplier.name} · ${shortDate(p.purchasedOn)}${p.reference ? ` · ref ${p.reference}` : ""}`}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/purchasing/purchases">
                <ArrowLeft className="mr-1 h-4 w-4" /> Purchases
              </Link>
            </Button>
            {p.status === "received" && can("purchasing.create") && (
              <Button onClick={() => setPaying(true)}>
                <Wallet className="mr-1 h-4 w-4" /> Pay supplier
              </Button>
            )}
            {p.status === "received" && can("purchasing.delete") && (
              <Button
                variant="outline"
                disabled={cancelling}
                onClick={async () => {
                  if (!confirm(`Cancel ${p.number}? Its stock is taken back out. Payments stay on the supplier's account.`)) return;
                  try {
                    await cancel(p.id).unwrap();
                    toast.success(`${p.number} cancelled and its stock removed`);
                  } catch (e) {
                    toast.error(errorText(e));
                  }
                }}
              >
                <Ban className="mr-1 h-4 w-4 text-red-600" /> Cancel purchase
              </Button>
            )}
          </>
        }
      />

      {p.status === "cancelled" && (
        <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          Cancelled {p.cancelledAt ? shortDate(p.cancelledAt) : ""}. Its stock was removed and it no longer counts toward what you owe {p.supplier.name}.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-4">
        {[
          ["Total", tk(p.total)],
          ["Paid against it", tk(p.paid)],
          ["Payment", PAYMENT_TERM_LABELS[p.paymentTerm]],
          ["Source", `${p.sourcingType === "import" ? `Import${p.originCountry ? ` from ${p.originCountry}` : ""}` : "Local"}${p.warehouse ? ` · into ${p.warehouse.code}` : ""}`],
        ].map(([k, v]) => (
          <Card key={k}>
            <CardContent className="p-4">
              <p className="text-xs text-slate-500">{k}</p>
              <p className="text-lg font-semibold">{v}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Items</CardTitle>
          <StatusPill status={p.status} />
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Grade</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Unit cost</TableHead>
                <TableHead className="text-right">Discount</TableHead>
                <TableHead className="text-right">Line total</TableHead>
                <TableHead className="text-right">Landed / unit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {p.items.map((i) => (
                <TableRow key={i.id}>
                  <TableCell>
                    <Link href={`/catalog/products/${i.productId}`} className="font-medium hover:underline">
                      {i.name}
                    </Link>
                  </TableCell>
                  <TableCell>{i.qualityGrade ?? "—"}</TableCell>
                  <TableCell className="text-right">{i.qty}</TableCell>
                  <TableCell className="text-right">{tk(i.unitCost)}</TableCell>
                  <TableCell className="text-right text-sm text-slate-600">
                    {[i.discountPct ? `${i.discountPct}%` : "", i.discountAmount ? tk(i.discountAmount) : ""].filter(Boolean).join(" + ") || "—"}
                  </TableCell>
                  <TableCell className="text-right">{tk(i.lineTotal)}</TableCell>
                  <TableCell className="text-right font-medium">{tk(i.landedUnitCost)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <dl className="ml-auto max-w-sm space-y-1 p-4 text-sm">
            {(
              [
                ["Items", p.itemsSubtotal],
                ["Shipping / transport", p.shippingCost],
                ["Customs duty", p.customsDuty],
                ["Other charges", p.otherCharges],
                ["Discount", -p.discount],
              ] as const
            )
              .filter(([k, v]) => k === "Items" || v !== 0)
              .map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <dt className="text-slate-600">{k}</dt>
                  <dd>{v < 0 ? `−${tk(-v)}` : tk(v)}</dd>
                </div>
              ))}
            <div className="flex justify-between border-t pt-1 text-base font-semibold">
              <dt>Total</dt>
              <dd>{tk(p.total)}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payments against this purchase</CardTitle>
        </CardHeader>
        <CardContent>
          {p.payments.length === 0 ? (
            <p className="text-sm text-slate-500">None. {p.paymentTerm === "credit" ? "It's on credit." : ""}</p>
          ) : (
            <ul className="divide-y text-sm">
              {p.payments.map((x) => (
                <li key={x.id} className="flex flex-wrap justify-between gap-2 py-2">
                  <span>
                    {shortDate(x.paidOn)} · {PAYMENT_METHOD_LABELS[x.method]} from {x.account}
                    {x.reference ? ` · ${x.reference}` : ""}
                  </span>
                  <span className="font-medium">{tk(x.amount)}</span>
                </li>
              ))}
            </ul>
          )}
          {p.notes && <p className="mt-4 whitespace-pre-line text-sm text-slate-600">{p.notes}</p>}
        </CardContent>
      </Card>

      <PayDialog
        open={paying}
        onOpenChange={setPaying}
        supplierId={p.supplier.id}
        supplierName={p.supplier.name}
        purchaseId={p.id}
        purchaseNumber={p.number}
        suggested={due}
      />
    </div>
  );
}
