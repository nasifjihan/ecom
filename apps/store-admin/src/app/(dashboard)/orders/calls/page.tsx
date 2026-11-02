"use client";

/**
 * Confirm calls: cash-on-delivery orders to call before they're packed. No-answer orders come back
 * after the shop's wait; ones that ran out of tries or had a wrong number wait for staff. Also:
 * "check a number" before taking a phone order, the COD block list, and the order-check settings.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { PhoneCall } from "lucide-react";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Skeleton, cn } from "@/components/ui";
import { Field, PageTitle, Toggle } from "@/components/content/shared";
import { errorText } from "@/lib/features/content/content-api-slice";
import { useCan } from "@/lib/permissions";
import {
  CALL_LABELS,
  RISK_LABELS,
  RISK_STYLES,
  useCheckPhoneMutation,
  useGetCallListQuery,
  useGetCodBlocksQuery,
  useGetOrderCheckSettingsQuery,
  useLogCallMutation,
  useSaveOrderCheckSettingsMutation,
  useUnblockPhoneMutation,
  type CallOutcome,
  type CallTab,
  type OrderCheckSettings,
} from "@/lib/features/orders/order-checks-api-slice";

const taka = (n: number) => `৳${Math.round(n).toLocaleString("en-IN")}`;
const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const TABS: { value: CallTab; label: string }[] = [
  { value: "due", label: "To call now" },
  { value: "later", label: "Call again later" },
  { value: "stuck", label: "Couldn't reach" },
];
const QUICK: CallOutcome[] = ["confirmed", "no_answer", "wrong_number"];

export default function ConfirmCallsPage() {
  const { can } = useCan();
  const canEdit = can("orders.edit");
  const [tab, setTab] = useState<CallTab>("due");
  const [page, setPage] = useState(1);
  const { data, isFetching } = useGetCallListQuery({ tab, page });
  const [logCall] = useLogCallMutation();

  const call = async (id: string, outcome: CallOutcome) => {
    try {
      await logCall({ id, outcome }).unwrap();
      toast.success(`Saved: ${CALL_LABELS[outcome]}`);
    } catch (e) {
      toast.error(errorText(e));
    }
  };

  return (
    <div className="space-y-6">
      <PageTitle icon={PhoneCall} title="Confirm calls" description="Call cash-on-delivery customers before packing. Fake or cancelled orders: open the order to record them." />

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {TABS.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => {
                  setTab(t.value);
                  setPage(1);
                }}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-sm font-medium",
                  tab === t.value ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-400",
                )}
              >
                {t.label} <span className="opacity-70">{data?.counts[t.value] ?? 0}</span>
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {isFetching && !data ? (
            <Skeleton className="h-40 w-full" />
          ) : !data?.items.length ? (
            <p className="py-8 text-center text-sm text-slate-500">{tab === "due" ? "Nobody to call right now." : "Nothing here."}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-slate-500">
                  <tr>
                    <th className="py-2 pr-3">Order</th>
                    <th className="py-2 pr-3">Customer</th>
                    <th className="py-2 pr-3">Total</th>
                    <th className="py-2 pr-3">Record</th>
                    <th className="py-2 pr-3">Calls</th>
                    <th className="py-2">Outcome</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.items.map((o) => (
                    <tr key={o.id} className="align-top">
                      <td className="py-2 pr-3 whitespace-nowrap">
                        <Link href={`/orders/${o.id}`} className="font-medium text-indigo-600 hover:underline">
                          #{o.number}
                        </Link>
                        <div className="text-xs text-slate-500">{when(o.createdAt)}{o.status === "ON_HOLD" ? " · on hold" : ""}</div>
                      </td>
                      <td className="py-2 pr-3">
                        <div>{o.name}</div>
                        {o.phone && (
                          <a href={`tel:${o.phone}`} className="font-mono text-xs text-indigo-600 hover:underline">
                            {o.phone}
                          </a>
                        )}
                        {o.city && <div className="text-xs text-slate-500">{o.city}</div>}
                      </td>
                      <td className="py-2 pr-3 whitespace-nowrap">
                        {taka(o.total)}
                        <div className="text-xs text-slate-500">{o.items} item{o.items === 1 ? "" : "s"}</div>
                      </td>
                      <td className="py-2 pr-3">
                        {o.risk ? (
                          <Badge className={cn("border-transparent", RISK_STYLES[o.risk.level])} title={`${o.risk.delivered} delivered, ${o.risk.returned} returned`}>
                            {RISK_LABELS[o.risk.level]}
                          </Badge>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                        {o.risk && o.risk.delivered + o.risk.returned > 0 && (
                          <div className="text-xs text-slate-500">
                            {o.risk.delivered}✓ {o.risk.returned}✗
                          </div>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-xs text-slate-600">
                        {o.callAttempts ? `${o.callAttempts} · ${o.callStatus ? CALL_LABELS[o.callStatus] : ""}` : "Not called"}
                        {o.nextCallAt && <div>Again after {when(o.nextCallAt)}</div>}
                      </td>
                      <td className="py-2">
                        {canEdit && (
                          <div className="flex flex-wrap gap-1">
                            {QUICK.map((q) => (
                              <Button key={q} size="sm" variant={q === "confirmed" ? "default" : "outline"} className="h-7 text-xs" onClick={() => void call(o.id, q)}>
                                {CALL_LABELS[q]}
                              </Button>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {data && data.meta.totalPages > 1 && (
            <div className="mt-4 flex justify-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <span className="self-center text-sm">
                {page} / {data.meta.totalPages}
              </span>
              <Button variant="outline" size="sm" disabled={page >= data.meta.totalPages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <CheckNumberCard />
        <BlockListCard canEdit={canEdit} />
      </div>
      <SettingsCard canEdit={canEdit} />
    </div>
  );
}

function CheckNumberCard() {
  const [phone, setPhone] = useState("");
  const [check, { data, isLoading, reset }] = useCheckPhoneMutation();
  const run = async () => {
    try {
      await check(phone.trim()).unwrap();
    } catch (e) {
      toast.error(errorText(e));
    }
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Check a number</CardTitle>
        <CardDescription>Before taking a phone or Facebook order: how parcels to this number went, across every shop on the platform.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void run();
          }}
        >
          <Input
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              reset();
            }}
            placeholder="01712345678"
            inputMode="tel"
            aria-label="Phone number"
          />
          <Button type="submit" disabled={isLoading || phone.trim().length < 10}>
            Check
          </Button>
        </form>
        {data && (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-mono">{data.phone}</span>
              <Badge className={cn("border-transparent", RISK_STYLES[data.level])}>{RISK_LABELS[data.level]}</Badge>
              {data.blocked && <Badge className="border-transparent bg-red-600 text-white">COD blocked</Badge>}
            </div>
            <p className="text-slate-600 dark:text-slate-300">
              {data.all.delivered + data.all.returned === 0
                ? "No parcels to this number yet."
                : `${data.all.delivered} delivered, ${data.all.returned} returned (${data.rate}%). At your shop: ${data.here.delivered} delivered, ${data.here.returned} returned.`}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BlockListCard({ canEdit }: { canEdit: boolean }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const { data } = useGetCodBlocksQuery({ search: search.trim() || undefined, page });
  const [unblock] = useUnblockPhoneMutation();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">COD block list</CardTitle>
        <CardDescription>These numbers must pay online at checkout. Block a number from its order page.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search a number"
          aria-label="Search blocked numbers"
        />
        {!data?.items.length ? (
          <p className="text-slate-500">No blocked numbers.</p>
        ) : (
          <ul className="divide-y">
            {data.items.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <span className="font-mono">{b.phone}</span>
                  <div className="truncate text-xs text-slate-500">
                    {b.reason} · {when(b.createdAt)}
                  </div>
                </div>
                {canEdit && (
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => unblock({ id: b.id }).unwrap().then(() => toast.success("Number unblocked"), (e) => toast.error(errorText(e)))}>
                    Unblock
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        {data && data.meta.totalPages > 1 && (
          <div className="flex justify-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={page >= data.meta.totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SettingsCard({ canEdit }: { canEdit: boolean }) {
  const { data: saved } = useGetOrderCheckSettingsQuery();
  const [save, { isLoading }] = useSaveOrderCheckSettingsMutation();
  const [s, setS] = useState<OrderCheckSettings | null>(null);
  useEffect(() => {
    if (saved) setS(saved);
  }, [saved]);
  const set = (p: Partial<OrderCheckSettings>) => setS((cur) => (cur ? { ...cur, ...p } : cur));
  const n = (k: keyof OrderCheckSettings, label: string, hint: string, min: number, max: number) => (
    <Field label={label} htmlFor={`oc-${k}`} hint={hint}>
      <Input id={`oc-${k}`} type="number" min={min} max={max} value={String(s![k])} onChange={(e) => set({ [k]: Number(e.target.value) } as Partial<OrderCheckSettings>)} />
    </Field>
  );
  const onSave = async () => {
    if (!s) return;
    try {
      await save(s).unwrap();
      toast.success("Order checks saved");
    } catch (e) {
      toast.error(errorText(e));
    }
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Settings</CardTitle>
        <CardDescription>
          A number's record is its delivered and returned parcels on every shop on the platform. Shops see only the counts, never each other's orders or customers.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!s ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              {n("riskWatchBelow", "Watch below (%)", "Delivered share under this: Watch.", 1, 100)}
              {n("riskHighBelow", "High risk below (%)", "Under this: High risk.", 1, 100)}
              {n("riskMinParcels", "High risk needs parcels", "At least this many earlier parcels.", 1, 50)}
            </div>
            <Toggle id="oc-hold" checked={s.holdHighRisk} onChange={(v) => set({ holdHighRisk: v })} label="Put high-risk COD orders on hold" hint="They wait on hold until someone calls and confirms." />
            <div className="grid gap-4 sm:grid-cols-2">
              {n("callRetryHours", "No answer: call again after (hours)", "The order comes back to “To call now”.", 1, 48)}
              {n("callMaxTries", "Tries before giving up", "Then it moves to “Couldn't reach”.", 1, 10)}
            </div>
            <Toggle id="oc-exchange" checked={s.customerExchanges} onChange={(v) => set({ customerExchanges: v })} label="Customers can ask for an exchange online" hint="On their order page, next to returns. Staff can always start one." />
            <div className="grid gap-4 sm:grid-cols-2">
              {n("exchangeFee", "Exchange delivery charge (৳)", "Added to the replacement order.", 0, 10000)}
            </div>
            {canEdit && (
              <div className="flex justify-end">
                <Button onClick={onSave} disabled={isLoading}>
                  {isLoading ? "Saving..." : "Save"}
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
