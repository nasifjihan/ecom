"use client";

/**
 * Abandoned carts: reminders to shoppers who left items in their cart (settings), and what was
 * left, reminded and won back. Only carts with a phone or email can be reminded: signed-in
 * shoppers, and guests who typed one at checkout.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ShoppingCart } from "lucide-react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Skeleton } from "@/components/ui";
import { Field, PageTitle, Toggle } from "@/components/content/shared";
import { errorText } from "@/lib/features/content/content-api-slice";
import { useCan } from "@/lib/permissions";
import {
  useGetAbandonedCartsQuery,
  useGetCartReminderSettingsQuery,
  useSaveCartReminderSettingsMutation,
  type CartReminderSettings,
} from "@/lib/features/marketing/cart-reminders-api-slice";

const taka = (n: number) => `৳${Math.round(n).toLocaleString("en-IN")}`;
const SELECT = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";
const WAITS = [30, 60, 120, 180, 360, 720, 1440];
const waitLabel = (m: number) => (m < 60 ? `${m} minutes` : m === 60 ? "1 hour" : `${m / 60} hours`);

export default function AbandonedCartsPage() {
  const { data: saved } = useGetCartReminderSettingsQuery();
  const [save, { isLoading: saving }] = useSaveCartReminderSettingsMutation();
  const { can } = useCan();
  const [s, setS] = useState<CartReminderSettings | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const { data: report, isFetching } = useGetAbandonedCartsQuery({ from: from || undefined, to: to ? `${to}T23:59:59` : undefined, page });
  useEffect(() => {
    if (saved) setS(saved);
  }, [saved]);
  const set = (p: Partial<CartReminderSettings>) => setS((cur) => (cur ? { ...cur, ...p } : cur));

  const onSave = async () => {
    if (!s) return;
    try {
      await save(s).unwrap();
      toast.success("Cart reminders saved");
    } catch (e) {
      toast.error(errorText(e));
    }
  };

  const totals = report?.totals;
  return (
    <div className="space-y-6">
      <PageTitle icon={ShoppingCart} title="Abandoned carts" description="Remind shoppers who left items in their cart, by SMS and email, with a link straight back to it." />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Reminders</CardTitle>
          <CardDescription>
            Carts with a phone or email can be reminded: signed-in shoppers, and guests who typed one at checkout. No SMS goes out between 10pm and 8am; those wait until morning.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!s ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <>
              <Toggle id="cr-on" checked={s.enabled} onChange={(v) => set({ enabled: v })} label="Send cart reminders" />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="First reminder after" htmlFor="cr-first" hint="Counted from the last time the shopper touched the cart.">
                  <select id="cr-first" className={SELECT} value={s.firstDelayMinutes} onChange={(e) => set({ firstDelayMinutes: Number(e.target.value) })}>
                    {WAITS.map((m) => (
                      <option key={m} value={m}>
                        {waitLabel(m)}
                      </option>
                    ))}
                  </select>
                </Field>
                <div className="flex items-end gap-6 pb-2 text-sm">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" className="h-4 w-4" checked={s.sms} onChange={(e) => set({ sms: e.target.checked })} /> SMS
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" className="h-4 w-4" checked={s.email} onChange={(e) => set({ email: e.target.checked })} /> Email
                  </label>
                </div>
              </div>
              <Toggle id="cr-second" checked={s.secondEnabled} onChange={(v) => set({ secondEnabled: v })} label="Send a second reminder" hint="Only if they didn't come back after the first one." />
              {s.secondEnabled && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Hours after the first" htmlFor="cr-second-h">
                    <Input id="cr-second-h" type="number" min={6} max={168} value={s.secondDelayHours} onChange={(e) => set({ secondDelayHours: Math.max(6, Number(e.target.value) || 24) })} />
                  </Field>
                  <Field label="Coupon to offer (optional)" htmlFor="cr-coupon" hint="A code from Marketing → Coupons, e.g. BACK10.">
                    <Input id="cr-coupon" maxLength={40} value={s.couponCode ?? ""} onChange={(e) => set({ couponCode: e.target.value.toUpperCase() || null })} />
                  </Field>
                </div>
              )}
              <p className="text-xs text-slate-500">The wording is in Settings → SMS and Settings → Emails (“Cart reminder”).</p>
              {can("promotions.edit") && (
                <div className="flex justify-end">
                  <Button onClick={onSave} disabled={saving || (s.enabled && !s.sms && !s.email)}>
                    {saving ? "Saving..." : "Save"}
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle className="text-base">What happened</CardTitle>
            <CardDescription>Carts reminded, and the ones that ordered after a reminder.</CardDescription>
          </div>
          <div className="flex gap-2">
            <Input type="date" aria-label="From" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
            <Input type="date" aria-label="To" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Abandoned", totals?.abandoned ?? 0],
              ["Reminded", totals?.reminded ?? 0],
              ["Recovered", totals?.recovered ?? 0],
              ["Recovered sales", taka(totals?.recoveredSales ?? 0)],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-lg border p-3">
                <p className="text-xs text-slate-500">{label}</p>
                <p className="text-xl font-bold">{value}</p>
              </div>
            ))}
          </div>
          {isFetching && !report ? (
            <Skeleton className="h-32 w-full" />
          ) : !report?.items.length ? (
            <p className="py-8 text-center text-sm text-slate-500">No abandoned carts in this period.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-slate-500">
                  <tr>
                    <th className="py-2 pr-3">When</th>
                    <th className="py-2 pr-3">Shopper</th>
                    <th className="py-2 pr-3">Items</th>
                    <th className="py-2 pr-3">Value</th>
                    <th className="py-2 pr-3">Reminders</th>
                    <th className="py-2">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {report.items.map((r) => (
                    <tr key={r.id} className="align-top">
                      <td className="py-2 pr-3 whitespace-nowrap">{new Date(r.createdAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                      <td className="py-2 pr-3">{r.contact || "—"}</td>
                      <td className="py-2 pr-3">{r.items.join(", ")}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">{taka(r.value)}</td>
                      <td className="py-2 pr-3">{r.reminders}</td>
                      <td className="py-2">
                        {r.order ? (
                          <Link href={`/orders/${r.order.id}`} className="font-medium text-emerald-600 hover:underline">
                            Ordered #{r.order.number}
                          </Link>
                        ) : r.recoveredAt ? (
                          <span className="text-emerald-600">Recovered</span>
                        ) : (
                          <span className="text-slate-500">Not yet</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {report && report.meta.totalPages > 1 && (
            <div className="flex justify-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <span className="self-center text-sm">
                {page} / {report.meta.totalPages}
              </span>
              <Button variant="outline" size="sm" disabled={page >= report.meta.totalPages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
