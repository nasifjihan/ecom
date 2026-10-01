"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ExternalLink, FileDown, Truck, Undo2 } from "lucide-react";
import { openFile } from "@ecom/api-client";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Separator, Skeleton, apiErrorMessage, cn, msg, orderStatusWord, toast, useT } from "@ecom/storefront-base";
import {
  RETURN_REASONS,
  useCancelMyOrderMutation,
  useGetMyOrderQuery,
  useMyOrderInvoiceMutation,
  useRequestReturnMutation,
  useSubmitMyOrderPaymentMutation,
  type MyOrder,
} from "@/lib/account";
import { AccountShell, OrderStatusBadge, formatBDT, formatDate } from "../../_components";
import { OrderPaymentCard } from "../../../_components/order-payment";

export default function OrderDetailPage() {
  const { ref } = useParams<{ ref: string }>();
  const t = useT();
  return (
    <AccountShell title={t("Order #{ref}", { ref })}>
      <OrderDetail orderRef={ref} />
    </AccountShell>
  );
}

function OrderDetail({ orderRef }: { orderRef: string }) {
  const { data: o, isLoading, isError } = useGetMyOrderQuery(orderRef);
  const [cancel, { isLoading: cancelling }] = useCancelMyOrderMutation();
  const [loadInvoice, { isLoading: loadingInvoice }] = useMyOrderInvoiceMutation();
  const [submitPayment] = useSubmitMyOrderPaymentMutation();
  const t = useT();

  if (isLoading) return <Skeleton className="h-96 w-full rounded-xl" />;
  if (isError || !o) {
    return (
      <p className="text-sm text-muted-foreground">
        {t("We couldn't find this order on your account.")}{" "}
        <Link href="/account/orders" className="text-primary hover:underline">
          {t("Back to your orders")}
        </Link>
      </p>
    );
  }

  const onCancel = async () => {
    if (!window.confirm(t("Cancel order #{ref}?", { ref: o.orderRef }))) return;
    try {
      await cancel(o.orderRef).unwrap();
      toast.success(t("Order cancelled"));
    } catch (err) {
      toast.error(t("Couldn't cancel the order"), { description: apiErrorMessage(err) });
    }
  };

  const onInvoice = async () => {
    try {
      await openFile(() => loadInvoice(o.orderRef).unwrap(), { filename: `invoice-INV-${o.orderRef}.pdf`, mode: "download" });
    } catch (err) {
      toast.error(t("Couldn't download the invoice"), { description: apiErrorMessage(err) });
    }
  };

  const rows: [string, number][] = [
    [t("Items"), o.itemsSubtotal],
    ...(o.promotions ?? []).filter((p) => p.amount > 0).map((p) => [p.name, -p.amount] as [string, number]),
    ...(o.discountTotal - (o.promotionDiscount ?? 0) - (o.memberDiscount ?? 0) > 0.004
      ? ([[`${t("Discount")}${o.couponUsed ? ` (${o.couponUsed})` : ""}`, -(o.discountTotal - (o.promotionDiscount ?? 0) - (o.memberDiscount ?? 0))]] as [string, number][])
      : []),
    ...((o.memberDiscount ?? 0) > 0 ? ([[t("{level} discount", { level: o.memberLevel ?? t("Member") }), -(o.memberDiscount ?? 0)]] as [string, number][]) : []),
    [t("Delivery"), o.shippingTotal],
    ...(o.taxTotal > 0 && !o.taxIncluded ? ([[t("VAT"), o.taxTotal]] as [string, number][]) : []),
    ...(o.feeTotal > 0 ? ([[t("Payment fee"), o.feeTotal]] as [string, number][]) : []),
    ...((o.walletUsed ?? 0) > 0 ? ([[t("Paid from wallet"), -(o.walletUsed ?? 0)]] as [string, number][]) : []),
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Link href="/account/orders" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> {t("All orders")}
        </Link>
        <div className="flex items-center gap-3">
          <OrderStatusBadge status={o.status} />
          <Button variant="outline" size="sm" disabled={loadingInvoice} onClick={onInvoice}>
            <FileDown className="h-4 w-4 mr-1.5" /> {loadingInvoice ? t("Preparing...") : t("Invoice")}
          </Button>
          {o.canCancel && (
            <Button variant="outline" size="sm" disabled={cancelling} onClick={onCancel}>
              {cancelling ? t("Cancelling...") : t("Cancel order")}
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("Items")}</CardTitle>
          <p className="text-sm text-muted-foreground">{t("Placed {date}", { date: formatDate(o.createdAt) })}</p>
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
                {i.giftFrom && <p className="text-xs font-semibold text-pink-600">{t("Free gift")} · {i.giftFrom}</p>}
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
              <dt>{t("Total")}</dt>
              <dd className="tabular-nums">{formatBDT(o.grandTotal, o.currency)}</dd>
            </div>
            {o.taxIncluded && o.taxTotal > 0 && (
              <p className="text-right text-xs text-muted-foreground">{t("Includes VAT {amount}", { amount: formatBDT(o.taxTotal, o.currency) })}</p>
            )}
            {(o.cashback ?? 0) > 0 && (
              <p className="pt-1 text-xs text-green-700">{t("{amount} cashback added to your wallet.", { amount: formatBDT(o.cashback ?? 0, o.currency) })}</p>
            )}
          </dl>
        </CardContent>
      </Card>

      {o.payment?.manual && (
        <OrderPaymentCard payment={o.payment} currency={o.currency} onSubmit={(input) => submitPayment({ orderRef: o.orderRef, ...input }).unwrap()} />
      )}
      {o.parcels.length > 0 && <Parcels order={o} />}
      {(o.returns.length > 0 || o.canRequestReturn) && <Returns order={o} />}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("Delivery")}</CardTitle>
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
            <CardTitle className="text-lg">{t("History")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3 text-sm">
              {o.history.length === 0 && (
                <li className="flex justify-between gap-3">
                  <span>{t("Order placed")}</span>
                  <span className="text-muted-foreground">{formatDate(o.createdAt)}</span>
                </li>
              )}
              {o.history.map((h, idx) => (
                <li key={idx} className="flex justify-between gap-3">
                  <span>{h.note || t(orderStatusWord(h.status))}</span>
                  <span className="text-muted-foreground">{formatDate(h.at)}</span>
                </li>
              ))}
            </ol>
            <p className="text-xs text-muted-foreground pt-4">
              {t("Payment:")} {o.paymentGateway === "cod" ? t("Cash on delivery") : o.paymentGateway ?? "—"} · {t(PAYMENT_STATUS_WORDS[o.paymentStatus] ?? o.paymentStatus.replace(/_/g, " ").toLowerCase())}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

const PAYMENT_STATUS_WORDS: Record<string, string> = {
  paid: msg("paid"),
  unpaid: msg("unpaid"),
  partially_paid: msg("partly paid"),
  refunded: msg("refunded"),
  partially_refunded: msg("partly refunded"),
  failed: msg("failed"),
};
const PARCEL_TEXT: Record<string, string> = {
  ready: msg("Packed, waiting for the courier"),
  picked_up: msg("With the courier"),
  in_transit: msg("On the way"),
  out_for_delivery: msg("Out for delivery"),
  delivered: msg("Delivered"),
  failed: msg("Delivery attempt failed"),
  returned: msg("Returned to the shop"),
  cancelled: msg("Cancelled"),
};
const PARCEL_TONE: Record<string, string> = {
  delivered: "bg-emerald-100 text-emerald-800",
  failed: "bg-red-100 text-red-800",
  returned: "bg-orange-100 text-orange-800",
  out_for_delivery: "bg-cyan-100 text-cyan-800",
};
const RETURN_TEXT: Record<string, string> = {
  requested: msg("Waiting for the shop to review"),
  approved: msg("Approved, please send the items back"),
  received: msg("Items received, refund on the way"),
  refunded: msg("Refunded"),
  rejected: msg("Not accepted"),
  cancelled: msg("Cancelled"),
};
const RETURN_TONE: Record<string, string> = {
  refunded: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-800",
  approved: "bg-blue-100 text-blue-800",
  received: "bg-indigo-100 text-indigo-800",
};

function Parcels({ order: o }: { order: MyOrder }) {
  const t = useT();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Truck className="h-5 w-5" /> {o.parcels.length > 1 ? t("Parcels ({n})", { n: o.parcels.length }) : t("Parcel")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {o.parcels.map((p) => (
          <div key={p.code} className="rounded-lg border p-4 text-sm space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">{p.courier ?? t("Courier")}</span>
              <Badge className={cn("border-0", PARCEL_TONE[p.status] ?? "bg-slate-100 text-slate-700")}>{t(PARCEL_TEXT[p.status] ?? p.status)}</Badge>
            </div>
            {p.trackingNumber && (
              <p>
                {t("Tracking:")}{" "}
                {p.trackingUrl ? (
                  <a href={p.trackingUrl} target="_blank" rel="noreferrer" className="font-mono text-primary hover:underline inline-flex items-center gap-1">
                    {p.trackingNumber} <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <span className="font-mono">{p.trackingNumber}</span>
                )}
              </p>
            )}
            <p className="text-muted-foreground">{p.items.map((i) => `${i.quantity} × ${i.title}`).join(", ")}</p>
            {(p.deliveredAt ?? p.shippedAt) && (
              <p className="text-xs text-muted-foreground">
                {p.deliveredAt ? t("Delivered {date}", { date: formatDate(p.deliveredAt) }) : t("Sent {date}", { date: formatDate(p.shippedAt!) })}
              </p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function Returns({ order: o }: { order: MyOrder }) {
  const [open, setOpen] = React.useState(false);
  const [qty, setQty] = React.useState<Record<string, number>>({});
  const [reason, setReason] = React.useState<string>(RETURN_REASONS[0].value);
  const [note, setNote] = React.useState("");
  const [requestReturn, { isLoading }] = useRequestReturnMutation();
  const t = useT();
  const items = Object.entries(qty).filter(([, q]) => q > 0).map(([orderItemId, quantity]) => ({ orderItemId, quantity }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!items.length) {
      toast.error(t("Choose the items to return"));
      return;
    }
    try {
      const r = await requestReturn({ orderRef: o.orderRef, items, reason, note: note.trim() || undefined }).unwrap();
      toast.success(t("Return requested"), { description: t("Reference {code}. The shop will get back to you.", { code: r.code }) });
      setOpen(false);
      setQty({});
      setNote("");
    } catch (err) {
      toast.error(t("Couldn't request the return"), { description: apiErrorMessage(err) });
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <Undo2 className="h-5 w-5" /> {t("Returns")}
          </CardTitle>
          {o.returnWindowUntil && (
            <p className="text-sm text-muted-foreground mt-1">
              {new Date(o.returnWindowUntil).getTime() > Date.now()
                ? t("You can ask for a return until {date}", { date: formatDate(o.returnWindowUntil) })
                : t("Returns closed on {date}", { date: formatDate(o.returnWindowUntil) })}
            </p>
          )}
        </div>
        {o.canRequestReturn && !open && (
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            {t("Request a return")}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {o.returns.map((r) => (
          <div key={r.code} className="rounded-lg border p-4 text-sm space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-xs">{r.code}</span>
              <Badge className={cn("border-0", RETURN_TONE[r.status] ?? "bg-amber-100 text-amber-800")}>{t(RETURN_TEXT[r.status] ?? r.status)}</Badge>
            </div>
            <p className="text-muted-foreground">{r.items.map((i) => `${i.quantity} × ${i.title}`).join(", ")}</p>
            <p className="text-xs text-muted-foreground">
              {t(RETURN_REASONS.find((x) => x.value === r.reason)?.label ?? r.reason ?? "")} · {t("asked {date}", { date: formatDate(r.createdAt) })} ·{" "}
              {formatBDT(r.amount, o.currency)}
            </p>
          </div>
        ))}
        {open && (
          <form onSubmit={submit} className="rounded-lg border p-4 space-y-4">
            <p className="text-sm font-medium">{t("What would you like to return?")}</p>
            {o.returnable.map((i) => (
              <div key={i.orderItemId} className="flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate">{i.title}</p>
                  {i.variantLabel && <p className="text-xs text-muted-foreground">{i.variantLabel}</p>}
                </div>
                <Input
                  type="number"
                  min={0}
                  max={i.quantity}
                  value={qty[i.orderItemId] ?? 0}
                  onChange={(e) => setQty({ ...qty, [i.orderItemId]: Math.max(0, Math.min(i.quantity, parseInt(e.target.value) || 0)) })}
                  className="w-20"
                  aria-label={t("How many {title} to return (up to {n})", { title: i.title, n: i.quantity })}
                />
              </div>
            ))}
            <div className="space-y-1.5">
              <Label htmlFor="return-reason">{t("Reason")}</Label>
              <select
                id="return-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {RETURN_REASONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {t(r.label)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="return-note">{t("Anything else?")}</Label>
              <textarea
                id="return-note"
                rows={3}
                maxLength={1000}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t("e.g. The size runs small")}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                {t("Cancel")}
              </Button>
              <Button type="submit" disabled={isLoading || !items.length}>
                {isLoading ? t("Sending...") : t("Request return")}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
