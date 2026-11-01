"use client";

/**
 * Pickup points: the shop's storage room or office where customers collect orders, free. They're
 * offered at checkout and listed on the contact page; a point can pack from its own warehouse.
 */
import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Store, Trash2 } from "lucide-react";
import { Button, Card, CardContent, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Skeleton } from "@/components/ui";
import { EmptyState, Field, PageTitle, Toggle } from "@/components/content/shared";
import { errorText } from "@/lib/features/content/content-api-slice";
import { useCan } from "@/lib/permissions";
import { useWarehousesQuery } from "@/lib/features/warehouses/warehouses-api-slice";
import {
  useDeletePickupPointMutation,
  useGetPickupPointsQuery,
  useSavePickupPointMutation,
  type PickupPoint,
  type PickupPointInput,
} from "@/lib/features/shipping/shipping-api-slice";

const BLANK: PickupPointInput = { name: "", address: "", district: "", phone: "", hours: "", mapUrl: "", readyInHours: 24, warehouseId: null, isActive: true, sortOrder: 0 };
const SELECT = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

export default function PickupPointsPage() {
  const { data = [], isLoading } = useGetPickupPointsQuery();
  const [remove] = useDeletePickupPointMutation();
  const { can } = useCan();
  const [editing, setEditing] = useState<PickupPoint | "new" | null>(null);

  const onDelete = async (p: PickupPoint) => {
    if (!window.confirm(`Remove "${p.name}"? Orders already placed keep their pickup details.`)) return;
    try {
      await remove(p.id).unwrap();
      toast.success("Pickup point removed");
    } catch (e) {
      toast.error(errorText(e));
    }
  };

  return (
    <div className="space-y-6">
      <PageTitle
        icon={Store}
        title="Pickup points"
        description="Places customers can collect orders from, for free: your storage room or office. Shown at checkout and on the contact page."
        actions={
          can("shipping.create") && (
            <Button onClick={() => setEditing("new")}>
              <Plus className="mr-1 h-4 w-4" /> Add pickup point
            </Button>
          )
        }
      />
      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : !data.length ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState icon={Store} title="No pickup points yet" text="Add one so customers can choose “Pick up from the shop” at checkout." />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {data.map((p) => (
            <Card key={p.id}>
              <CardContent className="space-y-1 p-5 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">
                      {p.name} {!p.isActive && <span className="ml-1 text-xs font-normal text-slate-500">(off)</span>}
                    </p>
                    <p className="text-slate-600 dark:text-slate-400">{[p.address, p.district].filter(Boolean).join(", ")}</p>
                  </div>
                  <div className="flex">
                    {can("shipping.edit") && (
                      <Button variant="ghost" size="icon" onClick={() => setEditing(p)} aria-label={`Edit ${p.name}`}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {can("shipping.delete") && (
                      <Button variant="ghost" size="icon" onClick={() => void onDelete(p)} aria-label={`Remove ${p.name}`}>
                        <Trash2 className="h-4 w-4 text-rose-600" />
                      </Button>
                    )}
                  </div>
                </div>
                {p.hours && <p className="text-slate-500">{p.hours}</p>}
                {p.phone && <p className="text-slate-500">{p.phone}</p>}
                <p className="text-slate-500">Ready {p.readyInHours === 0 ? "once packed" : `in about ${p.readyInHours} hours`}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <PointDialog point={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function PointDialog({ point, onClose }: { point: PickupPoint | "new" | null; onClose: () => void }) {
  const [save, { isLoading }] = useSavePickupPointMutation();
  const { data: warehouses = [] } = useWarehousesQuery();
  const [f, setF] = useState<PickupPointInput>(BLANK);
  const [openFor, setOpenFor] = useState<PickupPoint | "new" | null>(null);
  if (point !== openFor) {
    setOpenFor(point);
    if (point) setF(point === "new" ? BLANK : { ...BLANK, ...point });
  }
  const set = (patch: Partial<PickupPointInput>) => setF((cur) => ({ ...cur, ...patch }));
  const mapOk = !f.mapUrl || /^https:\/\//i.test(f.mapUrl);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await save({ ...(point && point !== "new" ? { id: point.id } : {}), ...f, phone: f.phone || null, hours: f.hours || null, mapUrl: f.mapUrl || null }).unwrap();
      toast.success("Pickup point saved");
      onClose();
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  return (
    <Dialog open={point !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{point === "new" ? "New pickup point" : "Edit pickup point"}</DialogTitle>
          </DialogHeader>
          <Field label="Name" htmlFor="pp-name" hint="As customers see it, e.g. Dhanmondi office.">
            <Input id="pp-name" required maxLength={80} value={f.name} onChange={(e) => set({ name: e.target.value })} />
          </Field>
          <Field label="Address" htmlFor="pp-address">
            <Input id="pp-address" required maxLength={300} value={f.address} onChange={(e) => set({ address: e.target.value })} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="District" htmlFor="pp-district">
              <Input id="pp-district" maxLength={64} value={f.district} onChange={(e) => set({ district: e.target.value })} placeholder="Dhaka" />
            </Field>
            <Field label="Phone (optional)" htmlFor="pp-phone">
              <Input id="pp-phone" maxLength={30} value={f.phone ?? ""} onChange={(e) => set({ phone: e.target.value })} />
            </Field>
          </div>
          <Field label="Opening hours (optional)" htmlFor="pp-hours">
            <Input id="pp-hours" maxLength={120} value={f.hours ?? ""} onChange={(e) => set({ hours: e.target.value })} placeholder="Sat–Thu, 10am–8pm" />
          </Field>
          <Field label="Google Maps link (optional)" htmlFor="pp-map" error={mapOk ? null : "Use a link starting with https://"}>
            <Input id="pp-map" maxLength={500} value={f.mapUrl ?? ""} onChange={(e) => set({ mapUrl: e.target.value })} placeholder="https://maps.app.goo.gl/..." />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Ready in (hours)" htmlFor="pp-ready" hint="0: once it's packed.">
              <Input id="pp-ready" type="number" min={0} max={720} value={f.readyInHours} onChange={(e) => set({ readyInHours: Math.max(0, Number(e.target.value) || 0) })} />
            </Field>
            <Field label="Packed from" htmlFor="pp-wh" hint="Its stock is used for these orders.">
              <select id="pp-wh" className={SELECT} value={f.warehouseId ?? ""} onChange={(e) => set({ warehouseId: e.target.value || null })}>
                <option value="">Choose automatically</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Toggle id="pp-active" checked={f.isActive} onChange={(v) => set({ isActive: v })} label="Offer at checkout" />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !f.name.trim() || f.address.trim().length < 5 || !mapOk}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
