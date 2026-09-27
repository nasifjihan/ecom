"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, FileDown } from "lucide-react";
import { openFile } from "@ecom/api-client";
import { Button, Card, CardContent, CardHeader, CardTitle, Separator, Skeleton, apiErrorMessage, toast } from "@ecom/storefront-base";
import { useCancelMyOrderMutation, useGetMyOrderQuery, useMyOrderInvoiceMutation } from "@/lib/account";
import { AccountShell, OrderStatusBadge, formatBDT, formatDate } from "../../_components";

export default function OrderDetailPage() {
  const { ref } = useParams<{ ref: string }>();
  return (
    <AccountShell title={`Order #${ref}`}>
      <OrderDetail orderRef={ref} />
    </AccountShell>
  );
}

function OrderDetail({ orderRef }: { orderRef: string }) {
  const { data: o, isLoading, isError } = useGetMyOrderQuery(orderRef);
  const [cancel, { isLoading: cancelling }] = useCancelMyOrderMutation();
  const [loadInvoice, { isLoading: loadingInvoice }] = useMyOrderInvoiceMutation();

  if (isLoading) return <Skeleton className="h-96 w-full rounded-xl" />;
  if (isError || !o) {
    return (
      <p className="text-sm text-muted-foreground">
        We couldn't find this order on your account.{" "}
        <Link href="/account/orders" className="text-primary hover:underline">
          Back to your orders
        </Link>
      </p>
    );
  }

  const onCancel = async () => {
    if (!window.confirm(`Cancel order #${o.orderRef}?`)) return;
    try {
      await cancel(o.orderRef).unwrap();
      toast.success("Order cancelled");
    } catch (err) {
      toast.error("Couldn't cancel the order", { description: apiErrorMessage(err) });
    }
  };

  const onInvoice = async () => {
    try {
      await openFile(() => loadInvoice(o.orderRef).unwrap(), { filename: `invoice-INV-${o.orderRef}.pdf`, mode: "download" });
    } catch (err) {
      toast.error("Couldn't download the invoice", { description: apiErrorMessage(err) });
    }
  };

  const rows: [string, number][] = [
    ["Items", o.itemsSubtotal],
    ...(o.discountTotal > 0 ? ([[`Discount${o.couponUsed ? ` (${o.couponUsed})` : ""}`, -o.discountTotal]] as [string, number][]) : []),
    ["Delivery", o.shippingTotal],
    ...(o.taxTotal > 0 ? ([["Tax", o.taxTotal]] as [string, number][]) : []),
    ...(o.feeTotal > 0 ? ([["Payment fee", o.feeTotal]] as [string, number][]) : []),
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Link href="/account/orders" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> All orders
        </Link>
        <div className="flex items-center gap-3">
          <OrderStatusBadge status={o.status} />
          <Button variant="outline" size="sm" disabled={loadingInvoice} onClick={onInvoice}>
            <FileDown className="h-4 w-4 mr-1.5" /> {loadingInvoice ? "Preparing..." : "Invoice"}
          </Button>
          {o.canCancel && (
            <Button variant="outline" size="sm" disabled={cancelling} onClick={onCancel}>
              {cancelling ? "Cancelling..." : "Cancel order"}
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Items</CardTitle>
          <p className="text-sm text-muted-foreground">Placed {formatDate(o.createdAt)}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {o.items.map((i) => (
            <div key={i.id} className="flex items-center gap-4">
              <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-muted">
                {i.image ? <img src={i.image} alt="" className="h-full w-full object-cover" /> : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{i.title}</p>
                {i.variantLabel && <p className="text-xs text-muted-foreground">{i.variantLabel}</p>}
                <p className="text-xs text-muted-foreground">
                  {i.qty} × {formatBDT(i.price, o.currency)}
                </p>
              </div>
              <p className="font-medium tabular-nums">{formatBDT(i.lineTotal, o.currency)}</p>
            </div>
          ))}
          <Separator />
          <dl className="space-y-1 text-sm">
            {rows.map(([label, value]) => (
              <div key={label} className="flex justify-between">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="tabular-nums">{formatBDT(value, o.currency)}</dd>
              </div>
            ))}
            <div className="flex justify-between pt-2 text-base font-semibold">
              <dt>Total</dt>
              <dd className="tabular-nums">{formatBDT(o.grandTotal, o.currency)}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Delivery</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <p className="font-medium">{o.shipping.name}</p>
            <p>{o.shipping.address}</p>
            <p>{[o.shipping.upazila, o.shipping.city, o.shipping.division, o.shipping.postcode].filter(Boolean).join(", ")}</p>
            {o.phone && <p>{o.phone}</p>}
            {o.shippingMethodName && <p className="text-muted-foreground pt-2">{o.shippingMethodName}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">History</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3 text-sm">
              {o.history.length === 0 && (
                <li className="flex justify-between gap-3">
                  <span>Order placed</span>
                  <span className="text-muted-foreground">{formatDate(o.createdAt)}</span>
                </li>
              )}
              {o.history.map((h, idx) => (
                <li key={idx} className="flex justify-between gap-3">
                  <span className="capitalize">{h.note || h.status.replace(/_/g, " ").toLowerCase()}</span>
                  <span className="text-muted-foreground">{formatDate(h.at)}</span>
                </li>
              ))}
            </ol>
            <p className="text-xs text-muted-foreground pt-4">
              Payment: {o.paymentGateway === "cod" ? "Cash on delivery" : o.paymentGateway ?? "—"} · {o.paymentStatus.replace(/_/g, " ").toLowerCase()}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
