"use client";

/**
 * "Deliver to": the shopper picks a district and sees each delivery option's charge and days
 * (the shop's shipping zones, as checkout uses them). The choice is kept in this browser; signed-in
 * shoppers start with their default address.
 */
import * as React from "react";
import { MapPin, Truck } from "lucide-react";
import { LocationSelects, formatMoney, useGetShippingRatesQuery, useT, type LocationValue } from "@ecom/storefront-base";
import { useAppSelector } from "@/lib/store";
import { useGetMyAddressesQuery } from "@/lib/account";

const KEY = "deliverTo";

function stored(): LocationValue | null {
  try {
    const v = JSON.parse(window.localStorage.getItem(KEY) ?? "null") as LocationValue | null;
    return v && typeof v === "object" && typeof v.district === "string" ? v : null;
  } catch {
    return null;
  }
}

export function DeliveryEstimate({ subtotal, weightKG, qty, extraDays = 0 }: { subtotal: number; weightKG?: number; qty: number; extraDays?: number }) {
  const t = useT();
  const signedIn = useAppSelector((s) => s.auth.isAuthenticated);
  const { data: addresses } = useGetMyAddressesQuery(undefined, { skip: !signedIn });
  const [place, setPlace] = React.useState<LocationValue>({});
  const [editing, setEditing] = React.useState(false);
  React.useEffect(() => {
    const s = stored();
    if (s) return setPlace(s);
    const a = addresses?.find((x) => x.isDefault) ?? addresses?.[0];
    if (a) setPlace({ division: a.state ?? "", district: a.city, upazila: a.upazila ?? "", locationId: a.locationId ?? null });
  }, [addresses]);
  const pick = (next: Required<LocationValue>) => {
    setPlace(next);
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // Private mode: the choice lasts for this page only.
    }
  };
  const { data: rates, isFetching } = useGetShippingRatesQuery(
    {
      countryCode: "BD",
      division: place.division || undefined,
      district: place.district || undefined,
      upazila: place.upazila || undefined,
      locationId: place.locationId ?? undefined,
      subtotal,
      weightKG,
      qty,
    },
    { skip: !place.district },
  );
  const days = (r: { minDeliveryDays?: number; maxDeliveryDays?: number }) => {
    if (r.minDeliveryDays === undefined && r.maxDeliveryDays === undefined) return null;
    const lo = (r.minDeliveryDays ?? r.maxDeliveryDays ?? 0) + extraDays;
    const hi = (r.maxDeliveryDays ?? r.minDeliveryDays ?? 0) + extraDays;
    return lo === hi ? t("{n} days", { n: lo }) : t("{from}–{to} days", { from: lo, to: hi });
  };

  return (
    <div className="space-y-2 rounded-lg border p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 font-medium">
          <MapPin className="h-4 w-4 text-primary" />
          {place.district ? t("Deliver to {place}", { place: [place.upazila, place.district].filter(Boolean).join(", ") }) : t("Delivery charge and time")}
        </span>
        <button type="button" onClick={() => setEditing((e) => !e)} className="-my-2 -mr-2 px-2 py-2 text-sm font-medium text-primary hover:underline">
          {place.district ? t("Change") : t("Choose area")}
        </button>
      </div>
      {(editing || !place.district) && (
        <div className="grid gap-2 sm:grid-cols-3">
          <LocationSelects value={place} onChange={(v) => { pick(v); if (v.district) setEditing(false); }} idPrefix="est" required={false} />
        </div>
      )}
      {place.district && (
        <ul className="space-y-1">
          {isFetching && !rates && <li className="text-muted-foreground">{t("Checking…")}</li>}
          {rates?.length === 0 && <li className="text-muted-foreground">{t("Sorry, we don't deliver there yet.")}</li>}
          {rates?.map((r) => (
            <li key={r.methodId} className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5">
                <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                {r.methodName}
                {days(r) && <span className="text-muted-foreground">· {days(r)}</span>}
              </span>
              <span className="font-medium">{r.cost > 0 ? formatMoney(r.cost) : t("Free")}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
