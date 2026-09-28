"use client";

/** A customer's wallet (balance, history, add / take money), loyalty level and referral details. */
import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Award, Minus, Plus, Wallet } from "lucide-react";
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
} from "@/components/ui";
import { Field } from "@/components/content/shared";
import { errorText } from "@/lib/features/content/content-api-slice";
import { useCan } from "@/lib/permissions";
import { WALLET_KIND_LABELS, useAdjustWalletMutation, useCustomerLoyaltyQuery } from "@/lib/features/marketing/loyalty-api-slice";

const tk = (n: number) => `৳${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export function CustomerWalletPanel({ customerId, loyaltyPoints }: { customerId: string; loyaltyPoints?: number }) {
  const { data } = useCustomerLoyaltyQuery(customerId);
  const { can } = useCan();
  const [mode, setMode] = useState<"add" | "take" | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [adjust, { isLoading }] = useAdjustWalletMutation();

  const save = async () => {
    const v = Number(amount);
    try {
      await adjust({ id: customerId, amount: mode === "take" ? -v : v, note }).unwrap();
      toast.success(mode === "take" ? `${tk(v)} taken from the wallet` : `${tk(v)} added to the wallet`);
      setMode(null);
      setAmount("");
      setNote("");
    } catch (e) {
      toast.error(errorText(e));
    }
  };

  if (!data) return <Skeleton className="h-40" />;
  const pct = data.next ? Math.min(100, Math.round((data.spend / data.next.minSpend) * 100)) : 100;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-slate-200 dark:border-slate-800">
          <CardContent className="space-y-2 p-5">
            <p className="flex items-center gap-2 text-sm text-slate-500">
              <Wallet className="h-4 w-4" /> Wallet
            </p>
            <p className="text-3xl font-bold tabular-nums">{tk(data.balance)}</p>
            {can("loyalty.edit") && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setMode("add")}>
                  <Plus className="mr-1 h-3.5 w-3.5" /> Add
                </Button>
                <Button size="sm" variant="outline" disabled={data.balance <= 0} onClick={() => setMode("take")}>
                  <Minus className="mr-1 h-3.5 w-3.5" /> Take
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="border-slate-200 dark:border-slate-800">
          <CardContent className="space-y-2 p-5">
            <p className="flex items-center gap-2 text-sm text-slate-500">
              <Award className="h-4 w-4" style={{ color: data.level?.color ?? undefined }} /> Level {!data.levelsEnabled && "(levels are off)"}
            </p>
            <p className="text-2xl font-semibold">{data.level?.name ?? "—"}</p>
            <p className="text-xs text-slate-500">{tk(data.spend)} spent on delivered orders</p>
            {data.next && (
              <>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-blue-600" style={{ width: `${pct}%` }} />
                </div>
                <p className="text-xs text-slate-500">
                  {tk(data.next.needed)} more to {data.next.name}
                </p>
              </>
            )}
          </CardContent>
        </Card>
        <Card className="border-slate-200 dark:border-slate-800">
          <CardContent className="space-y-1 p-5 text-sm">
            <p className="text-slate-500">Refer a friend</p>
            <p>
              Code: <span className="font-mono font-medium">{data.referral.code ?? "not made yet"}</span>
            </p>
            <p>
              {data.referral.friends} friend{data.referral.friends === 1 ? "" : "s"} · earned {tk(data.referral.earned)}
            </p>
            {data.referral.referredBy && (
              <p className="text-slate-600">
                Invited by{" "}
                <Link href={`/customers/${data.referral.referredBy.customerId}`} className="text-blue-600 hover:underline">
                  {data.referral.referredBy.name}
                </Link>
              </p>
            )}
            {!!loyaltyPoints && <p className="pt-1 text-xs text-slate-500">Loyalty points (older system): {loyaltyPoints.toLocaleString()}</p>}
          </CardContent>
        </Card>
      </div>
      <Card className="border-slate-200 dark:border-slate-800">
        <CardContent className="p-0">
          <h3 className="border-b px-5 py-3 text-sm font-semibold">Wallet history</h3>
          {!data.history.length ? (
            <p className="p-5 text-sm text-slate-500">Nothing yet.</p>
          ) : (
            <ul className="divide-y text-sm">
              {data.history.map((h) => (
                <li key={h.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                  <div className="min-w-0">
                    <p className="font-medium">{WALLET_KIND_LABELS[h.kind] ?? h.kind}</p>
                    <p className="truncate text-xs text-slate-500">
                      {new Date(h.at).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      {h.orderId && (
                        <>
                          {" · "}
                          <Link href={`/orders/${h.orderId}`} className="text-blue-600 hover:underline">
                            {h.orderNumber}
                          </Link>
                        </>
                      )}
                      {h.note ? ` · ${h.note}` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={h.amount > 0 ? "font-semibold text-emerald-700" : "font-semibold"}>
                      {h.amount > 0 ? "+" : "−"}
                      {tk(Math.abs(h.amount))}
                    </p>
                    <p className="text-xs text-slate-500">{tk(h.balanceAfter)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <Dialog open={mode !== null} onOpenChange={(v) => !v && setMode(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{mode === "take" ? "Take from the wallet" : "Add to the wallet"}</DialogTitle>
            <DialogDescription>The customer sees this in their wallet history.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <Field label="Amount (৳)" htmlFor="w-amount" hint={mode === "take" ? `Up to ${tk(data.balance)}` : undefined}>
              <Input id="w-amount" type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
            <Field label="Reason" htmlFor="w-note">
              <Input id="w-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder={mode === "take" ? "e.g. Added by mistake" : "e.g. Sorry for the late delivery"} />
            </Field>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setMode(null)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={isLoading || !(Number(amount) > 0) || note.trim().length < 3}>
              {mode === "take" ? "Take" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
