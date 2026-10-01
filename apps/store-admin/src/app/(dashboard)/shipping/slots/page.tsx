"use client";

/**
 * Delivery slots: the time windows customers can pick at checkout with delivery options that
 * use them ("Customer picks a delivery time" on the option). Each slot has an order-by time, an
 * optional charge and a daily limit; closed days skip slot deliveries.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CalendarClock, Plus, Trash2, X } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Skeleton,
} from "@/components/ui";
import { EmptyState, Field, PageTitle, Toggle } from "@/components/content/shared";
import { errorText } from "@/lib/features/content/content-api-slice";
import { useCan } from "@/lib/permissions";
import {
  useCreateDeliverySlotMutation,
  useDeleteDeliverySlotMutation,
  useGetDeliverySlotsQuery,
  useSaveSlotSettingsMutation,
  useUpdateDeliverySlotMutation,
  type DeliverySlot,
  type SlotInput,
} from "@/lib/features/shipping/shipping-api-slice";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const EMPTY: SlotInput = {
  name: "",
  startTime: "10:00",
  endTime: "13:00",
  cutoffMinutes: 120,
  fee: 0,
  capacity: null,
  weekdays: [0, 1, 2, 3, 4, 5, 6],
  enabled: true,
  sortOrder: 0,
};

/** "2 h before", "the day before at …" style text for the order-by time. */
function orderBy(s: Pick<SlotInput, "startTime" | "cutoffMinutes">) {
  const [h = 0, m = 0] = s.startTime.split(":").map(Number);
  const at = h * 60 + m - s.cutoffMinutes;
  if (s.cutoffMinutes === 0) return "until it starts";
  const days = at < 0 ? Math.ceil(-at / 1440) : 0;
  const mins = ((at % 1440) + 1440) % 1440;
  const hm = `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
  return days === 0 ? `by ${hm} the same day` : days === 1 ? `by ${hm} the day before` : `by ${hm}, ${days} days before`;
}

function SlotDialog({ slot, onClose }: { slot: DeliverySlot | "new" | null; onClose: () => void }) {
  const [create, { isLoading: creating }] = useCreateDeliverySlotMutation();
  const [update, { isLoading: updating }] = useUpdateDeliverySlotMutation();
  const [f, setF] = useState<SlotInput>(EMPTY);
  const [cutoffHours, setCutoffHours] = useState("2");
  const [capacity, setCapacity] = useState("");

  useEffect(() => {
    if (slot === null) return;
    const v = slot === "new" ? EMPTY : slot;
    setF({ ...EMPTY, ...v });
    setCutoffHours(String(v.cutoffMinutes / 60));
    setCapacity(v.capacity === null ? "" : String(v.capacity));
  }, [slot]);

  const set = <K extends keyof SlotInput>(k: K, v: SlotInput[K]) => setF((s) => ({ ...s, [k]: v }));
  const cutoffMinutes = Math.round(Number(cutoffHours || 0) * 60);
  const bad =
    f.name.trim().length < 1 ? "Give it a name" : f.endTime <= f.startTime ? "The window must end after it starts" : !f.weekdays.length ? "Pick at least one day" : null;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (bad) return;
    const body = { ...f, name: f.name.trim(), cutoffMinutes, capacity: capacity.trim() ? Number(capacity) : null };
    try {
      if (slot === "new") await create(body).unwrap();
      else if (slot) await update({ id: slot.id, ...body }).unwrap();
      toast.success("Slot saved");
      onClose();
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  return (
    <Dialog open={slot !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{slot === "new" ? "Add delivery slot" : "Edit delivery slot"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <Field label="Name" htmlFor="s-name" hint="Customers see it, e.g. Morning or Evening.">
            <Input id="s-name" value={f.name} maxLength={60} onChange={(e) => set("name", e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="From" htmlFor="s-start">
              <Input id="s-start" type="time" value={f.startTime} onChange={(e) => set("startTime", e.target.value)} />
            </Field>
            <Field label="To" htmlFor="s-end">
              <Input id="s-end" type="time" value={f.endTime} onChange={(e) => set("endTime", e.target.value)} />
            </Field>
          </div>
          <Field label="Orders close (hours before it starts)" htmlFor="s-cutoff" hint={`Customers order ${orderBy({ startTime: f.startTime, cutoffMinutes })}.`}>
            <Input id="s-cutoff" type="number" min={0} max={168} step={0.5} value={cutoffHours} onChange={(e) => setCutoffHours(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Extra charge ৳" htmlFor="s-fee" hint="Added to delivery. 0 = free.">
              <Input id="s-fee" type="number" min={0} step={1} value={String(f.fee)} onChange={(e) => set("fee", Number(e.target.value || 0))} />
            </Field>
            <Field label="Orders per day" htmlFor="s-cap" hint="Empty = no limit.">
              <Input id="s-cap" type="number" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} />
            </Field>
          </div>
          <Field label="Runs on">
            <div className="flex flex-wrap gap-1.5">
              {DAYS.map((d, i) => {
                const on = f.weekdays.includes(i);
                return (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={on}
                    onClick={() => set("weekdays", on ? f.weekdays.filter((x) => x !== i) : [...f.weekdays, i].sort())}
                    className={`rounded-md border px-2.5 py-1 text-sm ${on ? "border-primary bg-primary text-primary-foreground" : "text-slate-600 dark:text-slate-300"}`}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </Field>
          <Toggle checked={f.enabled} onChange={(v) => set("enabled", v)} label="Offer at checkout" />
          {bad && <p className="text-sm text-destructive">{bad}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!!bad || creating || updating}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SlotSettingsCard({ daysAhead, closedDates, canEdit }: { daysAhead: number; closedDates: string[]; canEdit: boolean }) {
  const [save, { isLoading }] = useSaveSlotSettingsMutation();
  const [days, setDays] = useState(String(daysAhead));
  const [closed, setClosed] = useState<string[]>(closedDates);
  const [adding, setAdding] = useState("");
  useEffect(() => {
    setDays(String(daysAhead));
    setClosed(closedDates);
  }, [daysAhead, closedDates]);

  const onSave = async () => {
    try {
      await save({ daysAhead: Number(days), closedDates: closed }).unwrap();
      toast.success("Saved");
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Booking window and closed days</CardTitle>
        <CardDescription>Closed days (holidays) have no slot deliveries.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Field label="Customers can book up to (days ahead, today included)" htmlFor="days-ahead">
          <Input id="days-ahead" type="number" min={1} max={14} className="max-w-[8rem]" value={days} onChange={(e) => setDays(e.target.value)} />
        </Field>
        <Field label="Closed days" htmlFor="closed-add">
          <div className="flex flex-wrap items-center gap-2">
            {closed.map((d) => (
              <Badge key={d} variant="secondary" className="gap-1">
                {d}
                <button type="button" aria-label={`Remove ${d}`} onClick={() => setClosed(closed.filter((x) => x !== d))}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            <Input id="closed-add" type="date" className="max-w-[11rem]" value={adding} onChange={(e) => setAdding(e.target.value)} />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!adding || closed.includes(adding)}
              onClick={() => {
                setClosed([...closed, adding].sort());
                setAdding("");
              }}
            >
              Add
            </Button>
          </div>
        </Field>
        <div className="flex justify-end">
          <Button onClick={onSave} disabled={!canEdit || isLoading || !(Number(days) >= 1 && Number(days) <= 14)}>
            {isLoading ? "Saving..." : "Save"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DeliverySlotsPage() {
  const { data, isLoading } = useGetDeliverySlotsQuery();
  const [remove] = useDeleteDeliverySlotMutation();
  const { can } = useCan();
  const canEdit = can("shipping.edit");
  const [editing, setEditing] = useState<DeliverySlot | "new" | null>(null);

  const onDelete = async (s: DeliverySlot) => {
    if (!window.confirm(`Delete "${s.name}"? Orders already booked keep their time.`)) return;
    try {
      await remove(s.id).unwrap();
      toast.success("Slot deleted");
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  return (
    <div className="space-y-6">
      <PageTitle
        icon={CalendarClock}
        title="Delivery slots"
        description="Time windows customers pick at checkout. Turn on “Customer picks a delivery time” on a delivery option (Shipping → Zones) to use them."
        actions={
          canEdit && (
            <Button onClick={() => setEditing("new")}>
              <Plus className="mr-1.5 h-4 w-4" /> Add slot
            </Button>
          )
        }
      />
      {isLoading || !data ? (
        <Skeleton className="h-48 w-full" />
      ) : (
        <>
          {data.slots.length === 0 ? (
            <EmptyState icon={CalendarClock} title="No delivery slots yet" text="Add windows such as Morning 10:00–13:00 or Evening 17:00–21:00." />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {data.slots.map((s) => (
                <Card key={s.id} className={s.enabled ? "" : "opacity-60"}>
                  <CardContent className="space-y-2 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold">
                          {s.name} <span className="font-normal text-slate-500">{s.startTime}–{s.endTime}</span>
                        </div>
                        <div className="text-sm text-slate-500">
                          Order {orderBy(s)} · {s.fee > 0 ? `+৳${s.fee}` : "no extra charge"} · {s.capacity ? `${s.capacity} a day` : "no limit"}
                        </div>
                        <div className="text-xs text-slate-500">{s.weekdays.length === 7 ? "Every day" : s.weekdays.map((d) => DAYS[d]).join(", ")}</div>
                      </div>
                      {!s.enabled && <Badge variant="secondary">Off</Badge>}
                    </div>
                    {s.upcoming.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {s.upcoming.slice(0, 7).map((u) => (
                          <Badge key={u.date} variant="outline" className="font-normal">
                            {u.date}: {u.orders}
                            {s.capacity ? ` / ${s.capacity}` : ""} booked
                          </Badge>
                        ))}
                      </div>
                    )}
                    {canEdit && (
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => setEditing(s)}>
                          Edit
                        </Button>
                        <Button variant="outline" size="sm" aria-label={`Delete ${s.name}`} onClick={() => void onDelete(s)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          <SlotSettingsCard daysAhead={data.settings.daysAhead} closedDates={data.settings.closedDates} canEdit={canEdit} />
        </>
      )}
      <SlotDialog slot={editing} onClose={() => setEditing(null)} />
    </div>
  );
}
