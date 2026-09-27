"use client";

import Link from "next/link";
import { toast } from "sonner";
import { MapPin } from "lucide-react";
import { Badge, Card, CardContent, Skeleton } from "@/components/ui";
import { PageTitle, Toggle } from "@/components/content/shared";
import { LocationTree, useLocationIndex } from "@/components/shipping/location-tree";
import { errorText } from "@/lib/features/content/content-api-slice";
import {
  useGetLocationsQuery,
  useSetLocationDeliveryMutation,
  type AdminLocation,
} from "@/lib/features/shipping/shipping-api-slice";

export default function LocationsPage() {
  const { data: rows = [], isLoading } = useGetLocationsQuery();
  const [setDelivery] = useSetLocationDeliveryMutation();
  const index = useLocationIndex(rows);

  /** The switched-off area above this one, if any (it switches off everything under it). */
  const offParent = (r: AdminLocation) => index.ancestors(r.id).find((a) => !a.delivery);
  const offCount = rows.filter((r) => !r.delivery || offParent(r)).length;

  const flip = async (r: AdminLocation, enabled: boolean) => {
    try {
      await setDelivery({ id: r.id, enabled }).unwrap();
      const below = index.descendantCount(r.id);
      toast.success(
        enabled
          ? `Delivery to ${r.en} is on`
          : `Delivery to ${r.en}${below ? ` and the ${below} areas in it` : ""} is off`,
      );
    } catch (err) {
      toast.error(errorText(err, "Couldn't change delivery for this area."));
    }
  };

  return (
    <div className="space-y-6">
      <PageTitle
        icon={MapPin}
        title="Delivery areas"
        description="Bangladesh's divisions, districts, upazilas and Dhaka thanas. Customers pick from these at checkout."
      />

      <Card>
        <CardContent className="space-y-4 pt-6">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Switch off an area you don&apos;t deliver to: it disappears from checkout, along with everything in it.
            Prices are set per <Link href="/shipping/zones" className="font-medium text-blue-600 hover:underline">zone</Link>.
            {!isLoading && (
              <span className="ml-1">
                {rows.length - offCount} of {rows.length} areas are open for delivery.
              </span>
            )}
          </p>
          {isLoading ? (
            <Skeleton className="h-96 w-full" />
          ) : (
            <LocationTree
              rows={rows}
              index={index}
              muted={(r) => !r.delivery || !!offParent(r)}
              renderControl={(r) => {
                const parent = offParent(r);
                return (
                  <span title={parent ? `Off because ${parent.en} is off` : undefined} className={parent ? "pointer-events-none opacity-50" : undefined}>
                    <Toggle
                      checked={r.delivery && !parent}
                      onChange={(v) => flip(r, v)}
                      ariaLabel={`Deliver to ${r.en}`}
                    />
                  </span>
                );
              }}
              renderExtra={(r) => (
                <span className="flex shrink-0 gap-1">
                  {offParent(r) && <Badge variant="secondary">Off via {offParent(r)!.en}</Badge>}
                  {r.zones.map((z) => (
                    <Badge key={z.id} variant="outline" className="hidden md:inline-flex">
                      {z.name}
                    </Badge>
                  ))}
                </span>
              )}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
