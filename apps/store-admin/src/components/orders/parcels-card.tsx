"use client";

/** Order page: the order's parcels, their courier status history, and packing a new parcel. */
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, ExternalLink, Package, Pencil, Plus, Printer, RefreshCw, Send, Truck } from "lucide-react";
import { openFile } from "@ecom/api-client";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  Label,
  Select,
  SelectItem,
  Textarea,
  cn,
} from "@/components/ui";
import {
  COURIERS,
  FULFILLMENT_LABELS,
  FULFILLMENT_STYLES,
  PARCEL_LABELS,
  PARCEL_NEXT,
  PARCEL_STYLES,
  apiError,
  courierStatusText,
  useCreateParcelMutation,
  useMoveParcelMutation,
  useUpdateParcelMutation,
  type Parcel,
  type ParcelStatus,
} from "@/lib/features/operations/fulfilment-api-slice";
import type { OrderLine } from "@/lib/features/operations/operations-api-slice";
import { useParcelLabelsMutation, useSyncParcelMutation } from "@/lib/features/operations/couriers-api-slice";
import { BookCourierDialog } from "./book-courier-dialog";

const money = (n: number) => `৳ ${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

interface Props {
  order: {
    id: string | number;
    status: string;
    paymentMethod: string;
    paymentStatus?: string;
    grandTotal: number;
    fulfillmentStatus: string;
    lines: OrderLine[];
    parcels?: Parcel[];
  };
  canEdit: boolean;
}

export function ParcelsCard({ order, canEdit }: Props) {
  const parcels = order.parcels ?? [];
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Parcel | null>(null);
  const [failing, setFailing] = useState<Parcel | null>(null);
  const [booking, setBooking] = useState<Parcel | null>(null);
  const [syncParcel, { isLoading: syncing }] = useSyncParcelMutation();
  const [loadLabels] = useParcelLabelsMutation();

  async function sync(p: Parcel) {
    try {
      const r = await syncParcel({ parcelId: p.id, orderId: order.id }).unwrap();
      if (!r.ok) toast.error(r.error ?? "The courier didn't answer");
      else toast.success(r.moved?.length ? `${p.code}: ${PARCEL_LABELS[r.moved[r.moved.length - 1] as ParcelStatus]}` : `${p.code}: no change (${courierStatusText(r.courierStatus ?? null)})`);
    } catch (e) {
      toast.error(apiError(e, "Couldn't check with the courier"));
    }
  }

  async function label(p: Parcel) {
    try {
      await openFile(() => loadLabels([p.id]).unwrap(), { filename: `label-${p.code}.pdf`, mode: "open" });
    } catch {
      toast.error("Couldn't make the label");
    }
  }
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [moveParcel, { isLoading: moving }] = useMoveParcelMutation();

  const names = useMemo(() => new Map(order.lines.map((l) => [String(l.id), l.productName])), [order.lines]);
  /** Units of each line not in a live parcel yet. */
  const remaining = useMemo(() => {
    const packed = new Map<string, number>();
    for (const p of parcels) {
      if (p.status === "cancelled" || p.status === "returned") continue;
      for (const i of p.items) packed.set(i.orderItemId, (packed.get(i.orderItemId) ?? 0) + i.quantity);
    }
    return new Map(order.lines.map((l) => [String(l.id), Math.max(0, l.quantity - (packed.get(String(l.id)) ?? 0))]));
  }, [parcels, order.lines]);
  const unpacked = [...remaining.values()].reduce((a, b) => a + b, 0);
  const closed = ["CANCELLED", "REFUNDED", "FAILED"].includes(order.status);

  async function move(p: Parcel, status: ParcelStatus, note?: string) {
    try {
      await moveParcel({ id: p.id, orderId: order.id, status, note }).unwrap();
      toast.success(`${p.code}: ${PARCEL_LABELS[status]}`);
      setFailing(null);
    } catch (e) {
      toast.error(apiError(e, "Couldn't update the parcel"));
    }
  }

  return (
    <Card className="border-slate-200 shadow-sm dark:border-slate-800">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Truck className="h-4 w-4 text-indigo-600" /> Parcels
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              <Badge variant="outline" className={cn("font-medium", FULFILLMENT_STYLES[order.fulfillmentStatus])}>
                {FULFILLMENT_LABELS[order.fulfillmentStatus] ?? order.fulfillmentStatus}
              </Badge>
              {unpacked > 0 && parcels.length > 0 && <span className="ml-2">{unpacked} unit(s) not packed</span>}
            </CardDescription>
          </div>
          {canEdit && !closed && unpacked > 0 && (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" /> Parcel
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pb-4 space-y-3">
        {parcels.length === 0 && (
          <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-700 p-4 text-center text-sm text-slate-500">
            <Package className="h-6 w-6 mx-auto mb-1 text-slate-400" />
            Nothing packed yet. Create a parcel when the items are ready to hand to a courier.
          </div>
        )}
        {parcels.map((p) => {
          const next = PARCEL_NEXT[p.status] ?? [];
          return (
            <div key={p.id} className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 text-sm space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs font-semibold">{p.code}</span>
                <Badge variant="outline" className={cn("text-[11px]", PARCEL_STYLES[p.status])}>
                  {PARCEL_LABELS[p.status]}
                </Badge>
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400 space-y-0.5">
                <div>
                  {p.providerName ?? "No courier"}
                  {p.trackingNumber && (
                    <>
                      {" · "}
                      {p.trackingUrl ? (
                        <a href={p.trackingUrl} target="_blank" rel="noreferrer" className="font-mono text-indigo-600 hover:underline inline-flex items-center gap-0.5">
                          {p.trackingNumber} <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="font-mono">{p.trackingNumber}</span>
                      )}
                    </>
                  )}
                </div>
                {p.consignmentId && (
                  <div>
                    Courier says: <span className="font-medium text-slate-800 dark:text-slate-200">{courierStatusText(p.courierStatus) ?? "—"}</span>
                    {p.lastSyncedAt && <span className="text-slate-400"> · checked {when(p.lastSyncedAt)}</span>}
                    {p.deliveryFee != null && <span className="text-slate-400"> · charge {money(p.deliveryFee)}</span>}
                  </div>
                )}
                {p.courierMessage && <div className="text-amber-600">{p.courierMessage}</div>}
                {p.codAmount > 0 && <div>Collect on delivery: <span className="font-semibold text-slate-800 dark:text-slate-200">{money(p.codAmount)}</span></div>}
                <div>{p.items.map((i) => `${i.quantity} × ${names.get(i.orderItemId) ?? "Item"}`).join(", ")}</div>
                {p.failedReason && p.status === "failed" && <div className="text-red-600">Failed: {p.failedReason}</div>}
              </div>
              <div className="flex items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  className="text-xs text-slate-500 hover:text-indigo-600 inline-flex items-center gap-0.5"
                  onClick={() => setOpen({ ...open, [p.id]: !open[p.id] })}
                >
                  {open[p.id] ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  History ({p.events.length})
                </button>
                {canEdit && (
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => void label(p)} aria-label="Print label" title="Label">
                      <Printer className="h-3.5 w-3.5" />
                    </Button>
                    {p.consignmentId && !["delivered", "returned", "cancelled"].includes(p.status) && (
                      <Button size="sm" variant="ghost" className="h-7 px-2" disabled={syncing} onClick={() => void sync(p)} aria-label="Check with the courier" title="Check with the courier">
                        <RefreshCw className={cn("h-3.5 w-3.5", syncing && "animate-spin")} />
                      </Button>
                    )}
                    {!p.consignmentId && p.status === "ready" && (
                      <Button size="sm" className="h-7 gap-1 text-xs" onClick={() => setBooking(p)}>
                        <Send className="h-3 w-3" /> Book
                      </Button>
                    )}
                    {!p.consignmentId && !["delivered", "returned", "cancelled"].includes(p.status) && (
                      <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setEditing(p)} aria-label="Edit courier details">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {next.length > 0 && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" disabled={moving}>
                            Update <ChevronDown className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuLabel>Move parcel to</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {next.map((s) => (
                            <DropdownMenuItem key={s} onClick={() => (s === "failed" ? setFailing(p) : move(p, s))}>
                              {PARCEL_LABELS[s]}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                )}
              </div>
              {open[p.id] && (
                <ol className="border-l-2 border-slate-200 dark:border-slate-700 ml-1 pl-3 space-y-1.5">
                  {p.events.map((e) => (
                    <li key={e.id} className="text-xs">
                      <span className="font-medium">{PARCEL_LABELS[e.status as ParcelStatus] ?? e.status}</span>
                      <span className="text-slate-500"> · {when(e.createdAt)}</span>
                      {e.note && <div className="text-slate-500">{e.note}</div>}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          );
        })}
      </CardContent>

      {creating && (
        <CreateParcelDialog
          order={order}
          remaining={remaining}
          otherCod={parcels.filter((p) => p.status !== "cancelled" && p.status !== "returned").reduce((s, p) => s + p.codAmount, 0)}
          onClose={() => setCreating(false)}
        />
      )}
      {editing && <EditParcelDialog orderId={order.id} parcel={editing} onClose={() => setEditing(null)} />}
      {booking && (
        <BookCourierDialog
          parcel={{ id: booking.id, orderId: order.id, code: booking.code, weightKg: booking.weightKg }}
          onClose={() => setBooking(null)}
        />
      )}
      {failing && (
        <NoteDialog
          title={`Delivery failed: ${failing.code}`}
          description="Say what happened (customer unreachable, refused, wrong address…). The parcel can be sent out again or returned to you."
          confirm="Mark failed"
          busy={moving}
          onClose={() => setFailing(null)}
          onConfirm={(note) => move(failing, "failed", note)}
        />
      )}
    </Card>
  );
}

function CreateParcelDialog({
  order,
  remaining,
  otherCod,
  onClose,
}: {
  order: Props["order"];
  remaining: Map<string, number>;
  otherCod: number;
  onClose: () => void;
}) {
  const [qty, setQty] = useState<Record<string, number>>(() => Object.fromEntries(remaining));
  const [courier, setCourier] = useState<string>(COURIERS[0].code);
  const [otherName, setOtherName] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");
  const isCod = order.paymentMethod === "COD" && order.paymentStatus !== "PAID";
  const [cod, setCod] = useState(isCod ? String(Math.max(0, order.grandTotal - otherCod)) : "0");
  const [weight, setWeight] = useState("");
  const [note, setNote] = useState("");
  const [createParcel, { isLoading }] = useCreateParcelMutation();

  const items = order.lines
    .map((l) => ({ orderItemId: String(l.id), quantity: qty[String(l.id)] ?? 0 }))
    .filter((i) => i.quantity > 0);

  async function submit() {
    if (!items.length) { toast.error("Choose at least one item"); return; }
    const c = COURIERS.find((x) => x.code === courier)!;
    const courierName = courier === "other" ? otherName.trim() : c.name;
    if (courierName.length < 2) { toast.error("Name the courier"); return; }
    try {
      const p = await createParcel({
        orderId: order.id,
        items,
        courierCode: courier,
        courierName,
        trackingNumber: trackingNumber.trim() || undefined,
        trackingUrl: trackingUrl.trim() || undefined,
        codAmount: cod === "" ? undefined : Number(cod),
        weightKg: weight ? Number(weight) : undefined,
        note: note.trim() || undefined,
      }).unwrap();
      toast.success(`Parcel ${p.code} created`);
      onClose();
    } catch (e) {
      toast.error(apiError(e, "Couldn't create the parcel"));
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New parcel</DialogTitle>
          <DialogDescription>Pack items into a parcel and hand it to a courier. Split the order into several parcels if needed.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs">Items in this parcel</Label>
            {order.lines.map((l) => {
              const left = remaining.get(String(l.id)) ?? 0;
              return (
                <div key={l.id} className="flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{l.productName}</div>
                    <div className="text-xs text-slate-500">{left} of {l.quantity} not packed</div>
                  </div>
                  <Input
                    type="number"
                    min={0}
                    max={left}
                    disabled={left === 0}
                    value={qty[String(l.id)] ?? 0}
                    onChange={(e) => setQty({ ...qty, [String(l.id)]: Math.max(0, Math.min(left, parseInt(e.target.value) || 0)) })}
                    className="h-8 w-20"
                    aria-label={`Quantity of ${l.productName}`}
                  />
                </div>
              );
            })}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className={courier === "other" ? "" : "col-span-2"}>
              <Label className="text-xs mb-1 block">Courier</Label>
              <Select value={courier} onValueChange={setCourier}>
                {COURIERS.map((c) => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}
              </Select>
            </div>
            {courier === "other" && (
              <div>
                <Label className="text-xs mb-1 block">Courier name</Label>
                <Input value={otherName} onChange={(e) => setOtherName(e.target.value)} className="h-10" />
              </div>
            )}
            <div>
              <Label className="text-xs mb-1 block">Tracking number</Label>
              <Input value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} placeholder="Optional" className="h-9" />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Tracking link</Label>
              <Input value={trackingUrl} onChange={(e) => setTrackingUrl(e.target.value)} placeholder="https://…" className="h-9" />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Cash to collect (৳)</Label>
              <Input type="number" min={0} step="0.01" value={cod} onChange={(e) => setCod(e.target.value)} className="h-9" />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Weight (kg)</Label>
              <Input type="number" min={0} step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="Optional" className="h-9" />
            </div>
          </div>
          <div>
            <Label className="text-xs mb-1 block">Note</Label>
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Fragile, call before delivery" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={isLoading || !items.length}>Create parcel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditParcelDialog({ orderId, parcel, onClose }: { orderId: string | number; parcel: Parcel; onClose: () => void }) {
  const known = COURIERS.some((c) => c.code === parcel.providerCode);
  const [courier, setCourier] = useState<string>(known ? parcel.providerCode! : "other");
  const [otherName, setOtherName] = useState(known ? "" : parcel.providerName ?? "");
  const [trackingNumber, setTrackingNumber] = useState(parcel.trackingNumber ?? "");
  const [trackingUrl, setTrackingUrl] = useState(parcel.trackingUrl ?? "");
  const [cod, setCod] = useState(String(parcel.codAmount));
  const [updateParcel, { isLoading }] = useUpdateParcelMutation();

  async function submit() {
    const courierName = courier === "other" ? otherName.trim() : COURIERS.find((c) => c.code === courier)!.name;
    if (courierName.length < 2) { toast.error("Name the courier"); return; }
    try {
      await updateParcel({
        id: parcel.id,
        orderId,
        courierCode: courier,
        courierName,
        trackingNumber: trackingNumber.trim(),
        trackingUrl: trackingUrl.trim(),
        codAmount: Number(cod) || 0,
      }).unwrap();
      toast.success("Parcel updated");
      onClose();
    } catch (e) {
      toast.error(apiError(e, "Couldn't update the parcel"));
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Courier details: {parcel.code}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs mb-1 block">Courier</Label>
            <Select value={courier} onValueChange={setCourier}>
              {COURIERS.map((c) => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}
            </Select>
          </div>
          {courier === "other" && (
            <div>
              <Label className="text-xs mb-1 block">Courier name</Label>
              <Input value={otherName} onChange={(e) => setOtherName(e.target.value)} className="h-9" />
            </div>
          )}
          <div>
            <Label className="text-xs mb-1 block">Tracking number</Label>
            <Input value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} className="h-9" />
          </div>
          <div>
            <Label className="text-xs mb-1 block">Tracking link</Label>
            <Input value={trackingUrl} onChange={(e) => setTrackingUrl(e.target.value)} placeholder="https://…" className="h-9" />
          </div>
          <div>
            <Label className="text-xs mb-1 block">Cash to collect (৳)</Label>
            <Input type="number" min={0} step="0.01" value={cod} onChange={(e) => setCod(e.target.value)} className="h-9" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={isLoading}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Asks for a note before a status change that needs one. */
export function NoteDialog({
  title,
  description,
  confirm,
  busy,
  required = true,
  children,
  onClose,
  onConfirm,
}: {
  title: string;
  description?: string;
  confirm: string;
  busy?: boolean;
  required?: boolean;
  children?: React.ReactNode;
  onClose: () => void;
  onConfirm: (note: string) => void;
}) {
  const [note, setNote] = useState("");
  const ok = !required || note.trim().length >= 2;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children}
        <div>
          <Label className="text-xs mb-1 block">{required ? "Note" : "Note (optional)"}</Label>
          <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} autoFocus />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onConfirm(note.trim())} disabled={busy === true || !ok}>{confirm}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
