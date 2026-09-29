"use client";

/**
 * Cash on delivery: what couriers still owe, cash at the shop, courier payouts (with shortfalls),
 * and the COD cash of each delivered parcel.
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AlertTriangle, Banknote, HandCoins, PackageCheck, Truck } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectItem,
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
import { apiError } from "@/lib/features/operations/fulfilment-api-slice";
import {
  PAYMENT_LABELS,
  PAYMENT_STYLES,
  SETTLEMENT_LABELS,
  SETTLEMENT_STYLES,
  useCodSummaryQuery,
  useConfirmCashMutation,
  useCreateSettlementMutation,
  useListPaymentsQuery,
  useListSettlementsQuery,
  useMarkNotCollectedMutation,
  useResolveSettlementMutation,
  type PaymentRow,
  type Settlement,
} from "@/lib/features/operations/payments-api-slice";
import { NoteDialog } from "@/components/orders/parcels-card";
import { money } from "@/components/orders/payment-dialogs";
import { useCan } from "@/lib/permissions";

const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const daysAgo = (iso: string | null) => (iso ? Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)) : 0);
const r2 = (n: number) => Math.round(n * 100) / 100;

const STAGES = [
  { value: "with_courier", label: "With courier" },
  { value: "cash_in_hand", label: "Cash in hand" },
  { value: "received", label: "Received" },
  { value: "not_collected", label: "Not collected" },
] as const;

function Kpi({ icon: Icon, label, amount, count, hint, tone }: { icon: typeof Truck; label: string; amount: number; count: number; hint: string; tone: string }) {
  return (
    <Card className="border-slate-200 dark:border-slate-800">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Icon className={cn("h-4 w-4", tone)} /> {label}
        </div>
        <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{money(amount)}</div>
        <div className="text-xs text-slate-500">{count} {hint}</div>
      </CardContent>
    </Card>
  );
}

export default function CashPage() {
  const { can } = useCan();
  const canEdit = can("payments.edit");
  const { data: summary, isLoading: loadingSummary } = useCodSummaryQuery();
  const [stage, setStage] = useState<string>("with_courier");
  const [courier, setCourier] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [payoutFor, setPayoutFor] = useState<{ code: string; name: string } | null>(null);
  const [notCollected, setNotCollected] = useState<PaymentRow | null>(null);
  const [resolving, setResolving] = useState<Settlement | null>(null);
  const [payoutTab, setPayoutTab] = useState("");

  const { data, isLoading, isFetching } = useListPaymentsQuery({
    kind: "cod",
    status: stage,
    courier: courier || undefined,
    search: search.trim() || undefined,
    page,
    perPage: 25,
  });
  const { data: payouts } = useListSettlementsQuery({ status: payoutTab || undefined });
  const [confirmCash, { isLoading: confirming }] = useConfirmCashMutation();
  const [markNotCollected, { isLoading: marking }] = useMarkNotCollectedMutation();
  const [resolve, { isLoading: resolvingBusy }] = useResolveSettlementMutation();

  const pickedIds = Object.entries(picked).filter(([, v]) => v).map(([k]) => k);
  const couriers = summary?.byCourier ?? [];

  async function receive(ids: string[]) {
    try {
      const r = await confirmCash({ ids }).unwrap();
      toast.success(`${money(r.amount)} marked received`);
      setPicked({});
    } catch (e) {
      toast.error(apiError(e, "Couldn't mark the cash received"));
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Banknote className="h-6 w-6" /> Cash & couriers
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Cash on delivery stays with the courier until they pay you. Record each payout here: the parcels it covers are marked received and any
          shortfall is flagged.
        </p>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {loadingSummary || !summary ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
        ) : (
          <>
            <Kpi icon={Truck} tone="text-indigo-600" label="With couriers" amount={summary.withCourier.amount} count={summary.withCourier.count} hint="delivered parcels not paid out" />
            <Kpi icon={HandCoins} tone="text-blue-600" label="Cash in hand" amount={summary.cashInHand.amount} count={summary.cashInHand.count} hint="collected by your riders or at the shop" />
            <Kpi icon={PackageCheck} tone="text-slate-500" label="Still to deliver" amount={summary.notShipped.amount} count={summary.notShipped.count} hint="cash on delivery orders not delivered yet" />
            <Kpi icon={AlertTriangle} tone="text-red-600" label="Short payouts" amount={summary.shortfalls.amount} count={summary.shortfalls.count} hint="payouts below what was collected" />
          </>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Owed by courier</CardTitle>
        </CardHeader>
        <CardContent>
          {couriers.length === 0 ? (
            <p className="text-sm text-slate-500">No courier owes you cash.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Courier</TableHead>
                    <TableHead className="text-right">Parcels</TableHead>
                    <TableHead className="text-right">Cash owed</TableHead>
                    <TableHead>Oldest</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {couriers.map((c) => (
                    <TableRow key={c.courierCode ?? "none"}>
                      <TableCell className="font-medium">{c.courierName ?? c.courierCode ?? "—"}</TableCell>
                      <TableCell className="text-right">{c.count}</TableCell>
                      <TableCell className="text-right font-semibold">{money(c.amount)}</TableCell>
                      <TableCell className={cn("text-sm", daysAgo(c.oldest) > 7 ? "text-red-600" : "text-slate-500")}>
                        {daysAgo(c.oldest) === 0 ? "today" : `${daysAgo(c.oldest)} days ago`}
                      </TableCell>
                      <TableCell className="text-right">
                        {canEdit && c.courierCode && (
                          <Button size="sm" className="h-8 text-xs" onClick={() => setPayoutFor({ code: c.courierCode!, name: c.courierName ?? c.courierCode! })}>
                            Record payout
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Parcel cash</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {STAGES.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => { setStage(s.value); setPage(1); setPicked({}); }}
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm font-medium border transition-colors whitespace-nowrap",
                  stage === s.value
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-700",
                )}
              >
                {s.label} <span className="opacity-70">{data?.counts[s.value]?.count ?? 0}</span>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Input className="h-9 max-w-xs" placeholder="Order number or name" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} aria-label="Search cash" />
            <Select value={courier} onValueChange={(v) => { setCourier(v); setPage(1); }} className="w-44">
              <SelectItem value="">All couriers</SelectItem>
              {couriers.filter((c) => c.courierCode).map((c) => <SelectItem key={c.courierCode} value={c.courierCode!}>{c.courierName ?? c.courierCode}</SelectItem>)}
            </Select>
            {canEdit && stage === "cash_in_hand" && pickedIds.length > 0 && (
              <Button size="sm" disabled={confirming} onClick={() => void receive(pickedIds)}>Mark {pickedIds.length} received</Button>
            )}
          </div>
          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
            <Table>
              <TableHeader>
                <TableRow>
                  {stage === "cash_in_hand" && canEdit && <TableHead className="w-8" />}
                  <TableHead>Order</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Parcel</TableHead>
                  <TableHead className="text-right">Cash</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && <TableRow><TableCell colSpan={7}><Skeleton className="h-8 w-full" /></TableCell></TableRow>}
                {!isLoading && (data?.items.length ?? 0) === 0 && (
                  <TableRow><TableCell colSpan={7} className="py-10 text-center text-sm text-slate-500">Nothing here.</TableCell></TableRow>
                )}
                {data?.items.map((p) => (
                  <TableRow key={p.id} className={cn(isFetching && "opacity-60")}>
                    {stage === "cash_in_hand" && canEdit && (
                      <TableCell>
                        <Checkbox checked={!!picked[p.id]} onCheckedChange={(v) => setPicked({ ...picked, [p.id]: v })} aria-label={`Pick order ${p.order?.number}`} />
                      </TableCell>
                    )}
                    <TableCell>
                      <Link href={`/orders/${p.orderId}`} className="text-sm font-medium text-indigo-600 hover:underline">{p.order?.number}</Link>
                      <div className="text-xs text-slate-500">{day(p.createdAt)}</div>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="font-medium">{p.order?.customerName}</div>
                      <div className="text-xs text-slate-500">{p.order?.phone}</div>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div>{p.courierName ?? (p.method === "cash" ? "Paid at entry" : "At the shop")}</div>
                      {p.shipment && <div className="text-xs font-mono text-slate-500">{p.shipment.code}</div>}
                    </TableCell>
                    <TableCell className="text-right font-semibold">{money(p.amount)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("text-[11px]", PAYMENT_STYLES[p.status])}>{PAYMENT_LABELS[p.status]}</Badge>
                      {p.settlement && <div className="text-xs text-slate-500 mt-0.5">{p.settlement.code}</div>}
                      {p.rejectReason && <div className="text-xs text-slate-500 mt-0.5 max-w-[200px]">{p.rejectReason}</div>}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {canEdit && p.status === "cash_in_hand" && (
                        <Button size="sm" className="h-8 text-xs mr-1" disabled={confirming} onClick={() => void receive([p.id])}>Received</Button>
                      )}
                      {canEdit && ["with_courier", "cash_in_hand"].includes(p.status) && (
                        <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setNotCollected(p)}>Not collected</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-slate-500">
              <span>page {page} of {data.totalPages}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
                <Button variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage(page + 1)}>Next</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3 flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
          <CardTitle className="text-base">Courier payouts</CardTitle>
          <div className="flex flex-wrap gap-2">
            {[["", "All"], ["short", "Short"], ["over", "Overpaid"], ["balanced", "Balanced"], ["resolved", "Settled"]].map(([v, l]) => (
              <button key={v} type="button" onClick={() => setPayoutTab(v!)}
                className={cn("px-2.5 py-1 rounded-md text-xs font-medium border", payoutTab === v ? "bg-slate-900 text-white border-slate-900 dark:bg-slate-200 dark:text-slate-900" : "border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-400")}>
                {l} {v && <span className="opacity-70">{payouts?.counts[v] ?? 0}</span>}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {(payouts?.items.length ?? 0) === 0 ? (
            <p className="text-sm text-slate-500">No payouts recorded.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Payout</TableHead>
                    <TableHead>Courier</TableHead>
                    <TableHead className="text-right">Parcels' cash</TableHead>
                    <TableHead className="text-right">Charges</TableHead>
                    <TableHead className="text-right">Received</TableHead>
                    <TableHead className="text-right">Difference</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payouts?.items.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>
                        <div className="font-mono text-xs font-semibold">{s.code}</div>
                        <div className="text-xs text-slate-500">{day(s.paidOn)}{s.reference && <> · {s.reference}</>}</div>
                      </TableCell>
                      <TableCell className="text-sm">{s.courierName}<div className="text-xs text-slate-500">{s.recordCount} parcels</div></TableCell>
                      <TableCell className="text-right text-sm">{money(s.expectedAmount)}</TableCell>
                      <TableCell className="text-right text-sm">{money(s.charges)}</TableCell>
                      <TableCell className="text-right text-sm font-semibold">{money(s.receivedAmount)}</TableCell>
                      <TableCell className={cn("text-right text-sm font-semibold", s.shortfall > 0 ? "text-red-600" : s.shortfall < 0 ? "text-amber-600" : "text-slate-400")}>
                        {s.shortfall === 0 ? "—" : s.shortfall > 0 ? `-${money(s.shortfall)}` : `+${money(-s.shortfall)}`}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("text-[11px]", SETTLEMENT_STYLES[s.status])}>{SETTLEMENT_LABELS[s.status] ?? s.status}</Badge>
                        {s.resolvedNote && <div className="text-xs text-slate-500 mt-0.5 max-w-[200px]">{s.resolvedNote}</div>}
                      </TableCell>
                      <TableCell className="text-right">
                        {canEdit && ["short", "over"].includes(s.status) && (
                          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setResolving(s)}>Mark settled</Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {payoutFor && <PayoutDialog courier={payoutFor} onClose={() => setPayoutFor(null)} />}
      {notCollected && (
        <NoteDialog
          title={`Cash not collected: order ${notCollected.order?.number}`}
          description={`${money(notCollected.amount)} will no longer count as owed. Say what happened (e.g. the customer paid less, or the rider lost it).`}
          confirm="Not collected"
          busy={marking}
          onClose={() => setNotCollected(null)}
          onConfirm={(reason) => {
            markNotCollected({ id: notCollected.id, orderId: notCollected.orderId, reason })
              .unwrap()
              .then(() => { toast.success("Marked not collected"); setNotCollected(null); })
              .catch((e: unknown) => toast.error(apiError(e, "Couldn't update")));
          }}
        />
      )}
      {resolving && (
        <NoteDialog
          title={`Settle ${resolving.code}`}
          description={`${resolving.courierName} paid ${resolving.shortfall > 0 ? `${money(resolving.shortfall)} too little` : `${money(-resolving.shortfall)} too much`}. Say how it was sorted out.`}
          confirm="Mark settled"
          busy={resolvingBusy}
          onClose={() => setResolving(null)}
          onConfirm={(note) => {
            resolve({ id: resolving.id, note })
              .unwrap()
              .then(() => { toast.success(`${resolving.code} settled`); setResolving(null); })
              .catch((e: unknown) => toast.error(apiError(e, "Couldn't update")));
          }}
        />
      )}
    </div>
  );
}

function PayoutDialog({ courier, onClose }: { courier: { code: string; name: string }; onClose: () => void }) {
  const { data, isLoading } = useListPaymentsQuery({ kind: "cod", status: "with_courier", courier: courier.code, perPage: 100 });
  const rows = useMemo(() => data?.items ?? [], [data]);
  const [off, setOff] = useState<Record<string, boolean>>({});
  const [charges, setCharges] = useState("0");
  const [received, setReceived] = useState("");
  const [reference, setReference] = useState("");
  const [paidOn, setPaidOn] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [create, { isLoading: saving }] = useCreateSettlementMutation();

  const chosen = rows.filter((r) => !off[r.id]);
  const expected = r2(chosen.reduce((s, r) => s + r.amount, 0));
  const net = r2(expected - (Number(charges) || 0));
  const diff = received === "" ? 0 : r2(net - Number(received));

  async function submit() {
    try {
      const s = await create({
        courierCode: courier.code,
        recordIds: chosen.length === rows.length ? undefined : chosen.map((r) => r.id),
        charges: Number(charges) || 0,
        receivedAmount: Number(received),
        reference: reference.trim() || undefined,
        paidOn,
        note: note.trim() || undefined,
      }).unwrap();
      if (s.status === "short") toast.warning(`${s.code} recorded: ${money(s.shortfall)} short`);
      else toast.success(`${s.code} recorded`);
      onClose();
    } catch (e) {
      toast.error(apiError(e, "Couldn't record the payout"));
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Payout from {courier.name}</DialogTitle>
          <DialogDescription>Untick parcels this payout doesn't cover. Check the courier's payout statement for their charges.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
            {isLoading && <Skeleton className="h-16 m-2" />}
            {rows.map((r) => (
              <label key={r.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="flex items-center gap-2">
                  <Checkbox checked={!off[r.id]} onCheckedChange={(v) => setOff({ ...off, [r.id]: !v })} />
                  <span>
                    {r.order?.number} <span className="text-xs text-slate-500 font-mono">{r.shipment?.code}</span>
                    <span className="block text-xs text-slate-500">{r.order?.customerName} · delivered {day(r.createdAt)}</span>
                  </span>
                </span>
                <span className="font-semibold">{money(r.amount)}</span>
              </label>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs mb-1 block">Courier charges kept (৳)</Label>
              <Input type="number" min={0} step="0.01" value={charges} onChange={(e) => setCharges(e.target.value)} className="h-9" />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Amount received (৳)</Label>
              <Input type="number" min={0} step="0.01" value={received} onChange={(e) => setReceived(e.target.value)} placeholder={String(net)} className="h-9" />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Reference</Label>
              <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Bank / bKash transaction" className="h-9" />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Paid on</Label>
              <Input type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} className="h-9" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs mb-1 block">Note</Label>
              <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>
          <dl className="rounded-lg bg-slate-50 dark:bg-slate-900 p-3 text-sm space-y-1">
            <div className="flex justify-between"><dt className="text-slate-500">{chosen.length} parcels' cash</dt><dd>{money(expected)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Less charges</dt><dd>-{money(Number(charges) || 0)}</dd></div>
            <div className="flex justify-between font-semibold"><dt>Should arrive</dt><dd>{money(net)}</dd></div>
            {received !== "" && diff !== 0 && (
              <div className={cn("flex justify-between font-semibold", diff > 0 ? "text-red-600" : "text-amber-600")}>
                <dt>{diff > 0 ? "Short by" : "Overpaid by"}</dt><dd>{money(Math.abs(diff))}</dd>
              </div>
            )}
          </dl>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving || !chosen.length || received === "" || Number(charges) > expected}>Record payout</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
