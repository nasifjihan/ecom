"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Map as MapIcon, Pencil, Plus, Trash2, Truck } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";
import { EmptyState, PageTitle, Toggle } from "@/components/content/shared";
import { MethodDialog, ZoneDialog } from "@/components/shipping/zone-dialogs";
import { TYPE_LABEL } from "@/components/shipping/location-tree";
import { errorText } from "@/lib/features/content/content-api-slice";
import {
  parseCostRules,
  useDeleteMethodMutation,
  useDeleteZoneMutation,
  useGetZoneQuery,
  useGetZonesQuery,
  useUpdateMethodMutation,
  useUpdateZoneMutation,
  type ShippingMethod,
  type ShippingZone,
} from "@/lib/features/shipping/shipping-api-slice";

const taka = (n: number | string) => `৳${Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

function priceSummary(m: ShippingMethod) {
  const r = parseCostRules(m.costRules);
  const tiers = r.weightTiers ?? [];
  const parts = tiers.length
    ? [tiers.map((t) => `${taka(t.cost)} ≤ ${t.upToKg} kg`).join(", ")]
    : [taka(m.baseCost)];
  if (Number(r.perKgExtra)) parts.push(`+${taka(r.perKgExtra!)}/kg`);
  if (Number(m.perItemCost)) parts.push(`+${taka(m.perItemCost)}/item`);
  return parts.join(" ");
}

function ZoneCard({ zone, onEdit }: { zone: ShippingZone; onEdit: () => void }) {
  const { data: full, isLoading } = useGetZoneQuery(zone.id);
  const [updateZone] = useUpdateZoneMutation();
  const [deleteZone] = useDeleteZoneMutation();
  const [updateMethod] = useUpdateMethodMutation();
  const [deleteMethod] = useDeleteMethodMutation();
  const [method, setMethod] = useState<ShippingMethod | "new" | null>(null);
  const methods = full?.methods ?? [];
  const legacy = !zone.locationIds.length ? zone.states ?? [] : [];

  const run = async (p: Promise<unknown>, ok?: string) => {
    try {
      await p;
      if (ok) toast.success(ok);
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div className="min-w-0 space-y-2">
          <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
            {zone.name}
            {!zone.enabled && <Badge variant="secondary">Inactive</Badge>}
          </CardTitle>
          <div className="flex flex-wrap gap-1.5 text-sm">
            <Badge variant="outline">{zone.countries.join(", ")}</Badge>
            {zone.locations.length === 0 && legacy.length === 0 && <span className="text-slate-500">Whole country</span>}
            {zone.locations.slice(0, 8).map((l) => (
              <Badge key={l.id} variant="secondary" title={TYPE_LABEL[l.type]}>
                {l.nameEn} · {l.nameBn}
              </Badge>
            ))}
            {zone.locations.length > 8 && <span className="text-slate-500">+{zone.locations.length - 8} more</span>}
            {legacy.length > 0 && (
              <span className="text-amber-700 dark:text-amber-400">By place names: {legacy.join(", ")} — edit to pick areas</span>
            )}
            {(zone.postcodes ?? []).length > 0 && <Badge variant="outline">Postcodes {zone.postcodes!.join(", ")}</Badge>}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Toggle
            checked={zone.enabled}
            onChange={(v) => run(updateZone({ id: zone.id, enabled: v }).unwrap())}
            ariaLabel={`Zone ${zone.name} active`}
          />
          <Button variant="ghost" size="icon" title="Edit zone" onClick={onEdit}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="Delete zone"
            onClick={() => window.confirm(`Delete the zone "${zone.name}" and its delivery options?`) && run(deleteZone(zone.id).unwrap(), "Zone deleted")}
          >
            <Trash2 className="h-4 w-4 text-rose-600" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : methods.length === 0 ? (
          <p className="text-sm text-slate-500">No delivery options yet. Customers in this zone can&apos;t check out until you add one.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Option</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Free from</TableHead>
                  <TableHead>Orders from</TableHead>
                  <TableHead>Days</TableHead>
                  <TableHead className="text-right">Offered</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {methods.map((m) => {
                  const r = parseCostRules(m.costRules);
                  return (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.name}</TableCell>
                      <TableCell className="text-sm">{priceSummary(m)}</TableCell>
                      <TableCell>{m.freeFromSubtotal ? taka(m.freeFromSubtotal) : "—"}</TableCell>
                      <TableCell>{Number(r.minSubtotal) ? taka(r.minSubtotal!) : "Any"}</TableCell>
                      <TableCell>
                        {m.deliveryEstimateMinDays != null || m.deliveryEstimateMaxDays != null
                          ? Array.from(new Set([m.deliveryEstimateMinDays, m.deliveryEstimateMaxDays].filter((d) => d != null))).join("–")
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Toggle checked={m.enabled} onChange={(v) => run(updateMethod({ id: m.id, enabled: v }).unwrap())} ariaLabel={`Offer ${m.name}`} />
                          <Button variant="ghost" size="icon" title="Edit" onClick={() => setMethod(m)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Delete"
                            onClick={() => window.confirm(`Delete "${m.name}"?`) && run(deleteMethod(m.id).unwrap(), "Delivery option deleted")}
                          >
                            <Trash2 className="h-4 w-4 text-rose-600" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
        <Button variant="outline" size="sm" onClick={() => setMethod("new")}>
          <Plus className="mr-1 h-4 w-4" /> Add delivery option
        </Button>
      </CardContent>
      <MethodDialog zoneId={zone.id} method={method} onClose={() => setMethod(null)} />
    </Card>
  );
}

export default function ShippingZonesPage() {
  const { data: zones = [], isLoading } = useGetZonesQuery();
  const [editing, setEditing] = useState<ShippingZone | "new" | null>(null);

  return (
    <div className="space-y-6">
      <PageTitle
        icon={MapIcon}
        title="Shipping zones"
        description="Group delivery areas and set what delivery costs in each."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/shipping/locations">
                <Truck className="mr-2 h-4 w-4" /> Delivery areas
              </Link>
            </Button>
            <Button onClick={() => setEditing("new")}>
              <Plus className="mr-2 h-4 w-4" /> Add zone
            </Button>
          </>
        }
      />
      <p className="text-sm text-slate-600 dark:text-slate-400">
        A customer gets the options of the zone with the smallest area that contains their address: a thana beats a district, a
        district beats a division. If that zone has nothing for their order, the next one is used.
      </p>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : zones.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <EmptyState
              icon={MapIcon}
              title="No zones yet"
              text="Add a zone such as Inside Dhaka, then the delivery options and prices for it."
              action={<Button onClick={() => setEditing("new")}>Add zone</Button>}
            />
          </CardContent>
        </Card>
      ) : (
        zones.map((z) => <ZoneCard key={z.id} zone={z} onEdit={() => setEditing(z)} />)
      )}

      <ZoneDialog zone={editing} onClose={() => setEditing(null)} />
    </div>
  );
}
