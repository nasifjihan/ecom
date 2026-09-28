"use client";

/** Track an order with its number and the phone number used on it; no account needed. */
import * as React from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Circle, Gift, PackageSearch, Truck, XCircle } from "lucide-react";
import { Button, Card, CardContent, DATE_LOCALES, apiErrorMessage, cn, formatMoney, msg, useLocale, useT } from "@ecom/storefront-base";
import { useTrackOrderMutation, type TrackedOrder } from "@/lib/engagement";
import { Field } from "../account/_components";

const PARCEL_LABELS: Record<string, string> = {
  ready: msg("Packed, waiting for the courier"),
  picked_up: msg("Picked up by the courier"),
  in_transit: msg("On the way"),
  out_for_delivery: msg("Out for delivery"),
  delivered: msg("Delivered"),
  failed: msg("Delivery attempt failed"),
  returned: msg("Returned to the shop"),
  cancelled: msg("Cancelled"),
};
const ENDED: Record<string, string> = {
  CANCELLED: msg("This order was cancelled."),
  REFUNDED: msg("This order was refunded."),
  FAILED: msg("This order didn't go through."),
};

function Result({ o }: { o: TrackedOrder }) {
  const t = useT();
  const { locale } = useLocale();
  const when = (iso: string) =>
    new Date(iso).toLocaleString(DATE_LOCALES[locale], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  return (
    <Card>
      <CardContent className="space-y-6 p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-bold">{t("Order {number}", { number: o.number })}</h2>
          <span className="text-sm text-muted-foreground">
            {t("Placed {date}", { date: when(o.placedAt) })} · {formatMoney(o.total, "BDT")}
          </span>
        </div>
        {o.step < 0 ? (
          <p className="flex items-center gap-2 rounded-lg bg-muted p-3 text-sm font-medium">
            <XCircle className="h-5 w-5 text-destructive" /> {t(ENDED[o.status] ?? "This order is closed.")}
          </p>
        ) : (
          <ol className="space-y-3" aria-label={t("Order progress")}>
            {o.steps.map((s, i) => (
              <li key={s.label} className="flex items-start gap-3">
                {s.done ? <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-emerald-600" /> : <Circle className="h-5 w-5 flex-shrink-0 text-muted-foreground" />}
                <span className={cn("text-sm", s.done ? "font-medium" : "text-muted-foreground", i === o.step && "text-foreground")}>
                  {t(s.label)}
                  {s.at && s.done && <span className="block text-xs text-muted-foreground">{when(s.at)}</span>}
                </span>
              </li>
            ))}
          </ol>
        )}
        {o.parcels.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">{t("Parcels")}</h3>
            {o.parcels.map((p) => (
              <div key={p.code} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
                <span className="flex items-center gap-2">
                  <Truck className="h-4 w-4 text-primary" />
                  <span>
                    {t(PARCEL_LABELS[p.status] ?? p.status)}
                    {p.courier && <span className="block text-xs text-muted-foreground">{p.courier}{p.trackingNumber ? ` · ${p.trackingNumber}` : ""}</span>}
                  </span>
                </span>
                {p.trackingUrl && (
                  <a href={p.trackingUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">
                    {t("Track with the courier")}
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">{t("Items")}</h3>
          <ul className="space-y-2">
            {o.items.map((i, n) => (
              <li key={`${i.title}-${n}`} className="flex items-center gap-3 text-sm">
                {i.image ? <img src={i.image} alt="" className="h-10 w-10 rounded object-cover" /> : <span className="h-10 w-10 rounded bg-muted" />}
                <span className="min-w-0 flex-1">
                  {i.title}
                  {i.option && <span className="block text-xs text-muted-foreground">{i.option}</span>}
                </span>
                {i.gift && <Gift className="h-4 w-4 text-pink-600" aria-label={t("Free gift")} />}
                <span className="text-muted-foreground">× {i.qty}</span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

export default function TrackPage() {
  const params = useSearchParams();
  const [number, setNumber] = React.useState(params.get("order") ?? "");
  const [phone, setPhone] = React.useState("");
  const [track, { data, isLoading, error, reset }] = useTrackOrderMutation();
  const t = useT();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    void track({ number: number.trim(), phone: phone.trim() });
  };

  return (
    <div className="container max-w-2xl space-y-6 py-10">
      <div className="space-y-1 text-center">
        <PackageSearch className="mx-auto h-10 w-10 text-primary" />
        <h1 className="text-2xl font-bold">{t("Track your order")}</h1>
        <p className="text-sm text-muted-foreground">{t("Enter the order number from your SMS or email and the phone number you ordered with.")}</p>
      </div>
      <Card>
        <CardContent className="p-6">
          <form onSubmit={submit} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <Field id="order" label={msg("Order number")} required value={number} onChange={(e) => { setNumber(e.target.value); reset(); }} placeholder={t("e.g. {example}", { example: "20260927000037" })} />
            <Field id="phone" label={msg("Phone number")} type="tel" inputMode="tel" required value={phone} onChange={(e) => { setPhone(e.target.value); reset(); }} placeholder="01XXXXXXXXX" />
            <Button type="submit" disabled={isLoading || number.trim().length < 4 || phone.trim().length < 10}>
              {isLoading ? t("Checking…") : t("Track")}
            </Button>
          </form>
          {error && (
            <p role="alert" className="mt-4 text-sm text-destructive">
              {apiErrorMessage(error, t("We couldn't find that order."))}
            </p>
          )}
        </CardContent>
      </Card>
      {data && <Result o={data} />}
    </div>
  );
}
