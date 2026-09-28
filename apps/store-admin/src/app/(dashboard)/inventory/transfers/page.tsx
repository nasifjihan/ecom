"use client";

/** Stock moving between warehouses: on the way, received (with any shortfall), cancelled. */
import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeftRight, ArrowRight, Ban, PackageCheck, Plus } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
  cn,
} from "@/components/ui";
import { Field, PageTitle } from "@/components/content/shared";
import { errorText } from "@/lib/features/content/content-api-slice";
import { useCan } from "@/lib/permissions";
import {
  transferStatusLabel,
  useCancelTransferMutation,
  useReceiveTransferMutation,
  useTransferQuery,
  useTransfersQuery,
  type Transfer,
} from "@/lib/features/warehouses/warehouses-api-slice";

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const TABS: { value: Transfer["status"] | ""; label: string }[] = [
  { value: "in_transit", label: "On the way" },
  { value: "received", label: "Received" },
  { value: "cancelled", label: "Cancelled" },
  { value: "", label: "All" },
];

function StatusPill({ status }: { status: Transfer["status"] }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-xs font-medium",
        status === "in_transit" ? "bg-amber-100 text-amber-800" : status === "received" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600",
      )}
    >
      {transferStatusLabel[status]}
    </span>
  );
}

function TransferDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const { data: t } = useTransferQuery(id);
  const { can } = useCan();
  const [got, setGot] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [receive, r] = useReceiveTransferMutation();
  const [cancel, c] = useCancelTransferMutation();
  useEffect(() => {
    if (t) setGot(Object.fromEntries(t.items.map((i) => [i.id, String(i.qtyReceived ?? i.qtySent)])));
  }, [t]);
  const short = t ? t.items.reduce((a, i) => a + Math.max(0, i.qtySent - (Number(got[i.id]) || 0)), 0) : 0;
  const bad = t
    ? t.items.some((i) => {
        const v = Number(got[i.id]);
        return !Number.isInteger(v) || v < 0 || v > i.qtySent;
      })
    : false;
  const doReceive = async () => {
    if (!t) return;
    try {
      await receive({ id: t.id, items: t.items.map((i) => ({ id: i.id, qty: Number(got[i.id]) })), note }).unwrap();
      toast.success(short ? `${t.code} received, ${short} short` : `${t.code} received in full`);
      onClose();
    } catch (e) {
      toast.error(errorText(e));
    }
  };
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        {!t ? (
          <Skeleton className="h-40" />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {t.code} <StatusPill status={t.status} />
              </DialogTitle>
              <DialogDescription className="flex flex-wrap items-center gap-1.5">
                {t.from.name} <ArrowRight className="h-3.5 w-3.5" /> {t.to.name} · sent {when(t.sentAt)}
                {t.receivedAt ? ` · received ${when(t.receivedAt)}` : ""}
              </DialogDescription>
            </DialogHeader>
            {t.note && <p className="text-sm text-slate-600">Note: {t.note}</p>}
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-slate-500">
                  <th className="py-2 font-medium">Item</th>
                  <th className="py-2 text-right font-medium">Sent</th>
                  <th className="w-32 py-2 text-right font-medium">{t.status === "in_transit" ? "Arrived" : "Received"}</th>
                </tr>
              </thead>
              <tbody>
                {t.items.map((i) => (
                  <tr key={i.id} className="border-b last:border-0">
                    <td className="py-2">
                      {i.name}
                      {i.sku && <span className="block text-xs text-slate-500">{i.sku}</span>}
                    </td>
                    <td className="py-2 text-right tabular-nums">{i.qtySent}</td>
                    <td className="py-2 text-right">
                      {t.status === "in_transit" && can("inventory.edit") ? (
                        <Input
                          type="number"
                          min={0}
                          max={i.qtySent}
                          className="ml-auto h-8 w-24 text-right"
                          value={got[i.id] ?? ""}
                          onChange={(e) => setGot((g) => ({ ...g, [i.id]: e.target.value }))}
                          aria-label={`Arrived: ${i.name}`}
                        />
                      ) : (
                        <span className={cn("tabular-nums", i.qtyReceived !== null && i.qtyReceived < i.qtySent && "font-medium text-red-700")}>{i.qtyReceived ?? "—"}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {t.status === "received" && (
              <p className="text-sm">
                {t.shortfall ? (
                  <span className="text-red-700">
                    {t.shortfall} unit{t.shortfall > 1 ? "s" : ""} short{t.receivedNote ? `: ${t.receivedNote}` : ""}. Written off as a loss.
                  </span>
                ) : (
                  "Everything arrived."
                )}
              </p>
            )}
            {t.status === "in_transit" && can("inventory.edit") && (
              <Field
                label={short ? `Why are ${short} missing?` : "Note (optional)"}
                htmlFor="rcv-note"
                hint={short ? "Missing units are written off; they don't come back to the sending warehouse." : undefined}
              >
                <Textarea id="rcv-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder={short ? "e.g. 1 torn in transit" : undefined} />
              </Field>
            )}
            <DialogFooter className="gap-2">
              {t.status === "in_transit" && can("inventory.edit") && (
                <>
                  <Button
                    variant="ghost"
                    disabled={c.isLoading}
                    onClick={async () => {
                      if (!confirm(`Cancel ${t.code}? Everything goes back to ${t.from.name}.`)) return;
                      try {
                        await cancel(t.id).unwrap();
                        toast.success(`${t.code} cancelled; the stock is back in ${t.from.name}`);
                        onClose();
                      } catch (e) {
                        toast.error(errorText(e));
                      }
                    }}
                  >
                    <Ban className="mr-1 h-4 w-4 text-red-600" /> Cancel transfer
                  </Button>
                  <Button onClick={doReceive} disabled={r.isLoading || bad || (short > 0 && !note.trim())}>
                    <PackageCheck className="mr-1 h-4 w-4" /> Receive at {t.to.code}
                  </Button>
                </>
              )}
              {t.status !== "in_transit" && (
                <Button variant="outline" onClick={onClose}>
                  Close
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function TransfersPage() {
  const [status, setStatus] = useState<Transfer["status"] | "">("in_transit");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  const { data, isFetching } = useTransfersQuery({ status: status || undefined, page });
  const { can } = useCan();
  useEffect(() => setPage(1), [status]);

  return (
    <div className="space-y-6">
      <PageTitle
        icon={ArrowLeftRight}
        title="Stock transfers"
        description="Sending takes stock out of the warehouse at once. Receiving adds what arrived; anything missing is written off."
        actions={
          can("inventory.edit") && (
            <Button asChild>
              <Link href="/inventory/transfers/new">
                <Plus className="mr-1 h-4 w-4" /> New transfer
              </Link>
            </Button>
          )
        }
      />
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Button key={t.label} size="sm" variant={status === t.value ? "default" : "outline"} onClick={() => setStatus(t.value)}>
            {t.label}
          </Button>
        ))}
        <Link href="/inventory/warehouses" className="ml-auto self-center text-sm text-blue-600 hover:underline">
          Warehouses
        </Link>
      </div>
      <Card>
        <CardContent className={cn("p-0", isFetching && "opacity-60")}>
          {!data ? (
            <Skeleton className="m-4 h-24" />
          ) : !data.items.length ? (
            <p className="p-10 text-center text-sm text-slate-500">{status === "in_transit" ? "Nothing on the way." : "No transfers here."}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Transfer</TableHead>
                  <TableHead>From → to</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead className="text-right">Units</TableHead>
                  <TableHead className="text-right">Short</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((t) => (
                  <TableRow key={t.id} className="cursor-pointer" onClick={() => setOpen(t.id)}>
                    <TableCell className="font-medium">
                      <button type="button" className="text-blue-600 hover:underline" onClick={() => setOpen(t.id)}>
                        {t.code}
                      </button>
                      {t.note && <span className="block max-w-[240px] truncate text-xs text-slate-500">{t.note}</span>}
                    </TableCell>
                    <TableCell>
                      {t.from.code} → {t.to.code}
                    </TableCell>
                    <TableCell className="text-sm">{when(t.sentAt)}</TableCell>
                    <TableCell className="text-right tabular-nums">{t.units}</TableCell>
                    <TableCell className={cn("text-right tabular-nums", t.shortfall ? "font-medium text-red-700" : "text-slate-400")}>{t.shortfall ?? "—"}</TableCell>
                    <TableCell>
                      <StatusPill status={t.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span>
            Page {page} of {data.totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}
      {open && <TransferDialog key={open} id={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
