"use client";

/**
 * Sales team: who's on it, their month (sales, commission earned and waiting, target), paying out
 * commission, and every order's commission. Commission is earned when an order is delivered and paid.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, Pencil, Trophy, UserPlus } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Select,
  SelectItem,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  cn,
} from "@/components/ui";
import { Field, PageTitle, STOREFRONT_URL, Toggle } from "@/components/content/shared";
import { taka } from "@/components/orders/order-pickers";
import { CommissionTable, ProgressBar } from "@/components/sales/commission-table";
import { errorText } from "@/lib/features/content/content-api-slice";
import { useCan } from "@/lib/permissions";
import {
  recentMonths,
  useCommissionsQuery,
  usePayoutCommissionMutation,
  useSalesTeamQuery,
  useSetSalesTargetMutation,
  useUpdateSalesSettingsMutation,
  useUpdateSalespersonMutation,
  type CommissionState,
  type SalesTeam,
  type Salesperson,
} from "@/lib/features/sales/sales-api-slice";

const MONTHS = recentMonths(12);
const monthLabel = (m: string) => MONTHS.find((x) => x.value === m)?.label ?? m;

function SettingsCard({ settings, canEdit }: { settings: SalesTeam["settings"]; canEdit: boolean }) {
  const [enabled, setEnabled] = useState(settings.enabled);
  const [rate, setRate] = useState(String(settings.defaultRate));
  const [save, { isLoading }] = useUpdateSalesSettingsMutation();
  useEffect(() => {
    setEnabled(settings.enabled);
    setRate(String(settings.defaultRate));
  }, [settings]);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Commission</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-[1fr_12rem_auto] md:items-end">
        <Toggle
          checked={enabled}
          onChange={(v) => canEdit && setEnabled(v)}
          label="Pay commission on sales"
          hint="Orders credited to a salesperson earn commission once they're delivered and paid. Rates: the product's, else its category's, else this default, plus the salesperson's extra."
        />
        <Field label="Default rate (%)" htmlFor="s-rate">
          <Input id="s-rate" type="number" min={0} max={100} step="0.5" value={rate} disabled={!canEdit} onChange={(e) => setRate(e.target.value)} />
        </Field>
        {canEdit && (
          <Button
            disabled={isLoading}
            onClick={async () => {
              try {
                await save({ enabled, defaultRate: Number(rate) || 0 }).unwrap();
                toast.success("Commission settings saved");
              } catch (e) {
                toast.error(errorText(e));
              }
            }}
          >
            Save
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function EditDialog({ person, month, onClose }: { person: Salesperson | null; month: string; onClose: () => void }) {
  const [extra, setExtra] = useState("");
  const [code, setCode] = useState("");
  const [target, setTarget] = useState("");
  const [update, u] = useUpdateSalespersonMutation();
  const [saveTarget, t] = useSetSalesTargetMutation();
  useEffect(() => {
    if (!person) return;
    setExtra(String(person.extraPct));
    setCode(person.salesCode ?? "");
    setTarget(person.target ? String(person.target) : "");
  }, [person]);
  if (!person) return null;
  const save = async () => {
    try {
      await update({ id: person.id, extraPct: Number(extra) || 0, salesCode: code.trim() || null }).unwrap();
      const amount = target.trim() ? Number(target) : null;
      if (amount !== person.target) await saveTarget({ id: person.id, month, amount }).unwrap();
      toast.success("Saved");
      onClose();
    } catch (e) {
      toast.error(errorText(e));
    }
  };
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{person.name}</DialogTitle>
          <DialogDescription>Their extra rate, share-link code and target for {monthLabel(month)}.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label="Extra commission (%)" htmlFor="e-extra" hint="Added to every rate for their orders.">
            <Input id="e-extra" type="number" min={0} max={50} step="0.5" value={extra} onChange={(e) => setExtra(e.target.value)} />
          </Field>
          <Field label="Share-link code" htmlFor="e-code" hint={code.trim() ? `Online orders from ${STOREFRONT_URL}/?sp=${code.trim().toUpperCase()} are theirs.` : "Letters and numbers."}>
            <Input id="e-code" value={code} maxLength={20} onChange={(e) => setCode(e.target.value.toUpperCase())} />
          </Field>
          <Field label={`Sales target for ${monthLabel(month)} (৳)`} htmlFor="e-target" hint="Items after discounts on delivered, paid orders. Empty: no target.">
            <Input id="e-target" type="number" min={0} step="1000" value={target} onChange={(e) => setTarget(e.target.value)} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={u.isLoading || t.isLoading}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function SalesTeamPage() {
  const { can } = useCan();
  const canEdit = can("commissions.edit");
  const [month, setMonth] = useState(MONTHS[0]!.value);
  const [who, setWho] = useState("");
  const [state, setState] = useState<CommissionState | "">("");
  const [adding, setAdding] = useState("");
  const [editing, setEditing] = useState<Salesperson | null>(null);
  const { data } = useSalesTeamQuery(month);
  const { data: rows } = useCommissionsQuery({ month, salespersonId: who || undefined, state: state || undefined });
  const [update] = useUpdateSalespersonMutation();
  const [payout, { isLoading: paying }] = usePayoutCommissionMutation();

  return (
    <div className="space-y-6">
      <PageTitle
        icon={Trophy}
        title="Sales team"
        description="Commission for the people who sell: orders they enter, quotes they turn into orders, and online orders from their share links."
        actions={
          <div className="w-48">
            <Select aria-label="Month" value={month} onValueChange={setMonth}>
              {MONTHS.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </Select>
          </div>
        }
      />
      {!data ? (
        <Skeleton className="h-64" />
      ) : (
        <>
          <SettingsCard settings={data.settings} canEdit={canEdit} />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              ["Sales", data.totals.sales, `Delivered and paid in ${monthLabel(month)}`],
              ["Commission earned", data.totals.earned, `In ${monthLabel(month)}`],
              ["Waiting", data.totals.pending, "Orders not delivered and paid yet"],
              ["To pay out", data.totals.unpaid, "Earned and not paid yet"],
            ].map(([label, value, hint]) => (
              <Card key={label as string}>
                <CardContent className="p-4">
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className="text-2xl font-semibold tabular-nums">{taka(value as number)}</p>
                  <p className="text-xs text-slate-500">{hint}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
              <CardTitle className="text-base">Salespeople</CardTitle>
              {canEdit && data.otherStaff.length > 0 && (
                <div className="flex gap-2">
                  <div className="w-56">
                    <Select aria-label="Staff member to add" value={adding} onValueChange={setAdding}>
                      <SelectItem value="">Add someone from staff…</SelectItem>
                      {data.otherStaff.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </Select>
                  </div>
                  <Button
                    variant="outline"
                    disabled={!adding}
                    onClick={async () => {
                      try {
                        await update({ id: adding, isSalesperson: true }).unwrap();
                        toast.success("Added to the sales team");
                        setAdding("");
                      } catch (e) {
                        toast.error(errorText(e));
                      }
                    }}
                  >
                    <UserPlus className="mr-2 h-4 w-4" /> Add
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {data.team.length === 0 ? (
                <p className="text-sm text-slate-500">Nobody on the sales team yet. Add staff members who sell.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Share link</TableHead>
                        <TableHead className="min-w-40">Target</TableHead>
                        <TableHead className="text-right">Sales</TableHead>
                        <TableHead className="text-right">Earned</TableHead>
                        <TableHead className="text-right">Waiting</TableHead>
                        <TableHead className="text-right">To pay</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.team.map((p) => (
                        <TableRow key={p.id} className={cn(!p.active && "opacity-60")}>
                          <TableCell>
                            <p className="font-medium">{p.name}</p>
                            <p className="text-xs text-slate-500">{p.extraPct ? `+${p.extraPct}% extra` : p.email}</p>
                          </TableCell>
                          <TableCell>
                            {p.salesCode ? (
                              <button
                                type="button"
                                className="inline-flex items-center gap-1 font-mono text-sm hover:underline"
                                title="Copy the share link"
                                onClick={() => {
                                  void navigator.clipboard?.writeText(`${STOREFRONT_URL}/?sp=${p.salesCode}`);
                                  toast.success("Share link copied");
                                }}
                              >
                                {p.salesCode} <Copy className="h-3 w-3" />
                              </button>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {p.target ? (
                              <div className="space-y-1">
                                <p className="text-xs tabular-nums">
                                  {p.progress}% of {taka(p.target)}
                                </p>
                                <ProgressBar value={p.progress} />
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400">No target</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {taka(p.sales)}
                            <p className="text-xs text-slate-500">{p.orders} {p.orders === 1 ? "order" : "orders"}</p>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{taka(p.earned)}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {taka(p.pending)}
                            <p className="text-xs text-slate-500">{p.pendingOrders} {p.pendingOrders === 1 ? "order" : "orders"}</p>
                          </TableCell>
                          <TableCell className="text-right font-medium tabular-nums">{taka(p.unpaid)}</TableCell>
                          <TableCell className="whitespace-nowrap text-right">
                            {canEdit && (
                              <div className="flex justify-end gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={p.unpaid <= 0 || paying}
                                  onClick={async () => {
                                    if (!confirm(`Mark ${taka(p.unpaid)} as paid to ${p.name}? This covers everything they earned up to the end of ${monthLabel(month)}.`)) return;
                                    try {
                                      const r = await payout({ id: p.id, month }).unwrap();
                                      toast.success(`${taka(r.amount)} marked as paid (${r.orders} orders)`);
                                    } catch (e) {
                                      toast.error(errorText(e));
                                    }
                                  }}
                                >
                                  Pay out
                                </Button>
                                <Button size="sm" variant="ghost" aria-label={`Edit ${p.name}`} onClick={() => setEditing(p)}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={async () => {
                                    if (!confirm(`Take ${p.name} off the sales team? Their past commission stays.`)) return;
                                    await update({ id: p.id, isSalesperson: false }).unwrap().catch((e) => toast.error(errorText(e)));
                                  }}
                                >
                                  Remove
                                </Button>
                              </div>
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
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
              <CardTitle className="text-base">Commission by order</CardTitle>
              <div className="flex gap-2">
                <div className="w-44">
                  <Select aria-label="Salesperson" value={who} onValueChange={setWho}>
                    <SelectItem value="">Everyone</SelectItem>
                    {data.team.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </Select>
                </div>
                <div className="w-44">
                  <Select aria-label="State" value={state} onValueChange={(v) => setState(v as CommissionState | "")}>
                    <SelectItem value="">Waiting and earned</SelectItem>
                    <SelectItem value="PENDING">Waiting</SelectItem>
                    <SelectItem value="EARNED">Earned</SelectItem>
                    <SelectItem value="PAID">Paid out</SelectItem>
                    <SelectItem value="CANCELLED">Cancelled</SelectItem>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">{rows ? <CommissionTable rows={rows} showSalesperson linkOrders /> : <Skeleton className="m-4 h-24" />}</CardContent>
          </Card>
        </>
      )}
      <EditDialog person={editing} month={month} onClose={() => setEditing(null)} />
    </div>
  );
}
