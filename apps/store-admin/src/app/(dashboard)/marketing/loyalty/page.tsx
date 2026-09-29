"use client";

/**
 * Loyalty & wallet: what the program has given out, the wallet / cashback / level / referral
 * settings, the levels themselves, and every referral.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Award, Pencil, Plus, Trash2, Wallet } from "lucide-react";
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
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  cn,
} from "@/components/ui";
import { Field, PageTitle, Toggle } from "@/components/content/shared";
import { errorText } from "@/lib/features/content/content-api-slice";
import { useCan } from "@/lib/permissions";
import {
  REFERRAL_STATUS_LABELS,
  useDeleteLoyaltyLevelMutation,
  useLoyaltyOverviewQuery,
  useReferralsQuery,
  useSaveLoyaltyLevelMutation,
  useUpdateLoyaltySettingsMutation,
  type LoyaltyLevel,
  type LoyaltySettings,
  type Referral,
} from "@/lib/features/marketing/loyalty-api-slice";

const tk = (n: number) => `৳${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
type Form = Record<keyof LoyaltySettings, string | boolean>;

function toForm(s: LoyaltySettings): Form {
  return Object.fromEntries(
    Object.entries(s).map(([k, v]) => [k, typeof v === "boolean" ? v : v === null ? "" : String(v)]),
  ) as Form;
}

function SettingsCard({ settings, canEdit }: { settings: LoyaltySettings; canEdit: boolean }) {
  const [f, setF] = useState<Form>(toForm(settings));
  const [save, { isLoading }] = useUpdateLoyaltySettingsMutation();
  useEffect(() => setF(toForm(settings)), [settings]);
  const num = (k: keyof LoyaltySettings) => Number(f[k] || 0);
  const flag = (k: keyof LoyaltySettings) => f[k] === true;
  const input = (k: keyof LoyaltySettings, label: string, hint?: string, suffix = "৳") => (
    <Field label={`${label} (${suffix})`} htmlFor={`l-${k}`} hint={hint}>
      <Input id={`l-${k}`} type="number" min={0} step="0.01" value={String(f[k])} disabled={!canEdit} onChange={(e) => setF((p) => ({ ...p, [k]: e.target.value }))} />
    </Field>
  );
  const onSave = async () => {
    try {
      await save({
        walletEnabled: flag("walletEnabled"),
        walletMaxPercent: num("walletMaxPercent"),
        cashbackEnabled: flag("cashbackEnabled"),
        cashbackPercent: num("cashbackPercent"),
        cashbackMinOrder: num("cashbackMinOrder"),
        cashbackMaxPerOrder: f.cashbackMaxPerOrder === "" ? null : num("cashbackMaxPerOrder"),
        levelsEnabled: flag("levelsEnabled"),
        referralEnabled: flag("referralEnabled"),
        referrerReward: num("referrerReward"),
        refereeReward: num("refereeReward"),
        referralMinOrder: num("referralMinOrder"),
      }).unwrap();
      toast.success("Loyalty settings saved");
    } catch (e) {
      toast.error(errorText(e));
    }
  };
  const toggle = (k: keyof LoyaltySettings, label: string, hint: string) => (
    <Toggle checked={flag(k)} onChange={(v) => canEdit && setF((p) => ({ ...p, [k]: v }))} label={label} hint={hint} />
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Settings</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-3 rounded-lg border p-4">
          {toggle("walletEnabled", "Customers can pay from their wallet", "At checkout, signed-in customers tick “Pay from my wallet”.")}
          {input("walletMaxPercent", "Most of an order the wallet may pay", "100 = the whole order", "%")}
        </section>
        <section className="space-y-3 rounded-lg border p-4">
          {toggle("cashbackEnabled", "Cashback", "Credited to the wallet when an order is delivered; taken back in proportion if it's refunded.")}
          <div className="grid gap-3 sm:grid-cols-3">
            {input("cashbackPercent", "Cashback", "Of items after discounts", "%")}
            {input("cashbackMinOrder", "From orders of")}
            {input("cashbackMaxPerOrder", "Up to", "Empty = no limit")}
          </div>
        </section>
        <section className="space-y-3 rounded-lg border p-4">
          {toggle("levelsEnabled", "Loyalty levels", "Customers move up by what they spend on delivered orders; each level can give a discount and extra cashback.")}
        </section>
        <section className="space-y-3 rounded-lg border p-4">
          {toggle("referralEnabled", "Refer a friend", "Customers share a link from their account. Both get their reward when the friend's first order is delivered.")}
          <div className="grid gap-3 sm:grid-cols-3">
            {input("referrerReward", "Sharer gets")}
            {input("refereeReward", "Friend gets")}
            {input("referralMinOrder", "First order at least")}
          </div>
        </section>
        {canEdit && (
          <div className="flex justify-end lg:col-span-2">
            <Button onClick={onSave} disabled={isLoading}>
              Save settings
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LevelDialog({ open, onOpenChange, level }: { open: boolean; onOpenChange: (v: boolean) => void; level: LoyaltyLevel | null }) {
  const [f, setF] = useState({ name: "", minSpend: "", discountPercent: "", cashbackPercent: "", color: "#64748b" });
  const [save, { isLoading }] = useSaveLoyaltyLevelMutation();
  useEffect(() => {
    if (!open) return;
    setF({
      name: level?.name ?? "",
      minSpend: level ? String(level.minSpend) : "",
      discountPercent: level ? String(level.discountPercent) : "0",
      cashbackPercent: level ? String(level.cashbackPercent) : "0",
      color: level?.color ?? "#64748b",
    });
  }, [open, level]);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  const submit = async () => {
    try {
      await save({
        id: level?.id,
        name: f.name,
        minSpend: Number(f.minSpend || 0),
        discountPercent: Number(f.discountPercent || 0),
        cashbackPercent: Number(f.cashbackPercent || 0),
        color: f.color,
      }).unwrap();
      toast.success(level ? "Level saved; customers' levels updated" : "Level added; customers' levels updated");
      onOpenChange(false);
    } catch (e) {
      toast.error(errorText(e));
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{level ? "Edit level" : "Add level"}</DialogTitle>
          <DialogDescription>Spend counts items less discounts and refunds on delivered orders.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name" htmlFor="lv-name">
            <Input id="lv-name" value={f.name} onChange={set("name")} placeholder="e.g. Platinum" />
          </Field>
          <Field label="Colour" htmlFor="lv-color">
            <Input id="lv-color" type="color" value={f.color} onChange={set("color")} className="h-10 p-1" />
          </Field>
          <Field label="Reached at spend (৳)" htmlFor="lv-min" className="col-span-2">
            <Input id="lv-min" type="number" min={0} value={f.minSpend} onChange={set("minSpend")} />
          </Field>
          <Field label="Discount (%)" htmlFor="lv-disc" hint="Off items at checkout">
            <Input id="lv-disc" type="number" min={0} max={50} step="0.5" value={f.discountPercent} onChange={set("discountPercent")} />
          </Field>
          <Field label="Extra cashback (%)" htmlFor="lv-cb" hint="On top of the store's">
            <Input id="lv-cb" type="number" min={0} max={100} step="0.5" value={f.cashbackPercent} onChange={set("cashbackPercent")} />
          </Field>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={isLoading || f.name.trim().length < 2}>
            {level ? "Save" : "Add level"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const REF_TABS: { value: Referral["status"] | ""; label: string }[] = [
  { value: "", label: "All" },
  { value: "signed_up", label: "Joined" },
  { value: "ordered", label: "Ordered" },
  { value: "rewarded", label: "Rewarded" },
];

function Referrals() {
  const [status, setStatus] = useState<Referral["status"] | "">("");
  const [page, setPage] = useState(1);
  const { data, isFetching } = useReferralsQuery({ status: status || undefined, page });
  useEffect(() => setPage(1), [status]);
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">Referrals</CardTitle>
        <div className="flex gap-1">
          {REF_TABS.map((t) => (
            <Button key={t.label} size="sm" variant={status === t.value ? "default" : "outline"} onClick={() => setStatus(t.value)}>
              {t.label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className={cn("p-0", isFetching && "opacity-60")}>
        {!data ? (
          <Skeleton className="m-4 h-20" />
        ) : !data.items.length ? (
          <p className="p-8 text-center text-sm text-slate-500">No referrals yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Shared by</TableHead>
                <TableHead>Friend</TableHead>
                <TableHead>First order</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Reward</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Link href={`/customers/${r.referrer.id}`} className="font-medium hover:underline">
                      {r.referrer.name}
                    </Link>
                    <span className="block font-mono text-xs text-slate-500">{r.code}</span>
                  </TableCell>
                  <TableCell>
                    {r.friend ? (
                      <Link href={`/customers/${r.friend.id}`} className="hover:underline">
                        {r.friend.name}
                      </Link>
                    ) : (
                      "—"
                    )}
                    <span className="block text-xs text-slate-500">{new Date(r.at).toLocaleDateString("en-GB")}</span>
                  </TableCell>
                  <TableCell>
                    {r.order ? (
                      <Link href={`/orders/${r.order.id}`} className="text-blue-600 hover:underline">
                        {r.order.number}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>{REFERRAL_STATUS_LABELS[r.status]}</TableCell>
                  <TableCell className="text-right">{r.status === "rewarded" ? tk(r.reward) : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 p-4 text-sm">
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
    </Card>
  );
}

export default function LoyaltyPage() {
  const { data } = useLoyaltyOverviewQuery();
  const { can } = useCan();
  const canEdit = can("loyalty.edit");
  const [editing, setEditing] = useState<LoyaltyLevel | null>(null);
  const [adding, setAdding] = useState(false);
  const [remove] = useDeleteLoyaltyLevelMutation();

  return (
    <div className="space-y-6">
      <PageTitle icon={Wallet} title="Loyalty & wallet" description="Cashback and refunds into customers' wallets, loyalty levels with their own discount, and refer-a-friend rewards." />
      {!data ? (
        <Skeleton className="h-64" />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["In customers' wallets", tk(data.stats.walletBalance), `${data.stats.customersWithBalance} customers`],
              ["Cashback given", tk(data.stats.cashbackGiven), "Less any taken back"],
              ["Spent from wallets", tk(data.stats.spentFromWallets), "On orders not cancelled"],
              ["Referral rewards", tk(data.stats.referralRewards), `${data.stats.referrals.rewarded ?? 0} friends rewarded`],
            ].map(([k, v, h]) => (
              <Card key={k}>
                <CardContent className="space-y-1 p-4">
                  <p className="text-xs text-slate-500">{k}</p>
                  <p className="text-2xl font-semibold tabular-nums">{v}</p>
                  <p className="text-xs text-slate-500">{h}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <SettingsCard settings={data.settings} canEdit={canEdit} />
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base">Levels</CardTitle>
                {!data.settings.levelsEnabled && <p className="mt-1 text-xs text-amber-700">Levels are off: customers see no level and get no level discount.</p>}
              </div>
              {canEdit && (
                <Button size="sm" onClick={() => setAdding(true)}>
                  <Plus className="mr-1 h-4 w-4" /> Add level
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Level</TableHead>
                    <TableHead className="text-right">From spend</TableHead>
                    <TableHead className="text-right">Discount</TableHead>
                    <TableHead className="text-right">Extra cashback</TableHead>
                    <TableHead className="text-right">Customers</TableHead>
                    <TableHead className="w-28" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.levels.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="font-medium">
                        <span className="flex items-center gap-2">
                          <Award className="h-4 w-4" style={{ color: l.color ?? undefined }} /> {l.name}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{tk(l.minSpend)}</TableCell>
                      <TableCell className="text-right">{l.discountPercent ? `${l.discountPercent}%` : "—"}</TableCell>
                      <TableCell className="text-right">{l.cashbackPercent ? `+${l.cashbackPercent}%` : "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{l.customers}</TableCell>
                      <TableCell className="text-right">
                        {canEdit && (
                          <>
                            <Button size="icon" variant="ghost" aria-label={`Edit ${l.name}`} onClick={() => setEditing(l)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label={`Delete ${l.name}`}
                              onClick={async () => {
                                if (!confirm(`Delete ${l.name}? Its customers move to the level below.`)) return;
                                try {
                                  await remove(l.id).unwrap();
                                  toast.success("Level deleted");
                                } catch (e) {
                                  toast.error(errorText(e));
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <Referrals />
        </>
      )}
      <LevelDialog open={adding || !!editing} onOpenChange={(v) => !v && (setAdding(false), setEditing(null))} level={editing} />
    </div>
  );
}
