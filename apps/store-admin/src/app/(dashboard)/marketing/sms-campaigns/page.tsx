"use client";

/**
 * SMS campaigns: write a marketing SMS, choose who gets it, see how many people and SMS parts that
 * is, send yourself a test, then send now or at a set time. No SMS goes out 10pm–8am; those wait.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Skeleton, Textarea, cn } from "@/components/ui";
import { Field, PageTitle, Toggle } from "@/components/content/shared";
import { errorText } from "@/lib/features/content/content-api-slice";
import { useCan } from "@/lib/permissions";
import { useLoyaltyOverviewQuery } from "@/lib/features/marketing/loyalty-api-slice";
import {
  useCancelSmsCampaignMutation,
  useCreateSmsCampaignMutation,
  useDeleteSmsCampaignMutation,
  useGetSmsCampaignQuery,
  useListSmsCampaignsQuery,
  usePreviewSmsCampaignMutation,
  useSendSmsCampaignMutation,
  useTestSmsCampaignMutation,
  useUpdateSmsCampaignMutation,
  type Audience,
  type CampaignStatus,
  type SmsCampaign,
} from "@/lib/features/marketing/sms-campaigns-api-slice";

const STATUS: Record<CampaignStatus, { label: string; tone: string }> = {
  draft: { label: "Draft", tone: "bg-slate-100 text-slate-700" },
  scheduled: { label: "Scheduled", tone: "bg-blue-100 text-blue-700" },
  sending: { label: "Sending", tone: "bg-amber-100 text-amber-800" },
  sent: { label: "Sent", tone: "bg-emerald-100 text-emerald-700" },
  cancelled: { label: "Cancelled", tone: "bg-red-100 text-red-700" },
};
const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const taka = (n: number) => `৳${Math.round(n).toLocaleString("en-IN")}`;
const SELECT = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

export default function SmsCampaignsPage() {
  const { can } = useCan();
  const canEdit = can("promotions.edit");
  const [page, setPage] = useState(1);
  const { data, isLoading } = useListSmsCampaignsQuery({ page });
  const [editing, setEditing] = useState<SmsCampaign | "new" | null>(null);
  const [results, setResults] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageTitle icon={Send} title="SMS campaigns" description="Marketing SMS to your customers, through the SMS provider in Settings → SMS. Each message shows in the SMS log." />
        {canEdit && <Button onClick={() => setEditing("new")}>New campaign</Button>}
      </div>
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : !data?.items.length ? (
            <p className="py-8 text-center text-sm text-slate-500">No campaigns yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-slate-500">
                  <tr>
                    <th className="py-2 pr-3">Campaign</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">People</th>
                    <th className="py-2 pr-3">Sent</th>
                    <th className="py-2 pr-3">Failed</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.items.map((c) => (
                    <tr key={c.id} className="align-top">
                      <td className="py-2 pr-3">
                        <div className="font-medium">{c.name}</div>
                        <div className="max-w-md truncate text-xs text-slate-500">{c.body}</div>
                      </td>
                      <td className="py-2 pr-3">
                        <Badge className={cn("border-transparent", STATUS[c.status].tone)}>{STATUS[c.status].label}</Badge>
                        {c.status === "scheduled" && c.scheduledAt && <div className="text-xs text-slate-500">{when(c.scheduledAt)}</div>}
                        {c.status === "sent" && c.finishedAt && <div className="text-xs text-slate-500">{when(c.finishedAt)}</div>}
                      </td>
                      <td className="py-2 pr-3">{c.recipients || "—"}</td>
                      <td className="py-2 pr-3">{c.sent}</td>
                      <td className="py-2 pr-3">{c.failed}</td>
                      <td className="py-2 text-right">
                        {["draft", "scheduled"].includes(c.status) && canEdit ? (
                          <Button size="sm" variant="outline" onClick={() => setEditing(c)}>
                            Open
                          </Button>
                        ) : (
                          <Button size="sm" variant="ghost" onClick={() => setResults(c.id)}>
                            Results
                          </Button>
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
              <Button variant="outline" size="sm" disabled={page >= data.meta.totalPages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      {editing && <CampaignDialog campaign={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
      {results && <ResultsDialog id={results} canEdit={canEdit} onClose={() => setResults(null)} />}
    </div>
  );
}

function CampaignDialog({ campaign, onClose }: { campaign: SmsCampaign | null; onClose: () => void }) {
  const [name, setName] = useState(campaign?.name ?? "");
  const [body, setBody] = useState(campaign?.body ?? "Hi {name}, ");
  const [audience, setAudience] = useState<Audience>(campaign?.audience ?? {});
  const [stopLink, setStopLink] = useState(campaign?.stopLink ?? true);
  const [testPhone, setTestPhone] = useState("");
  const [at, setAt] = useState("");
  const [id, setId] = useState(campaign?.id ?? null);
  const { data: loyalty } = useLoyaltyOverviewQuery();
  const [preview, { data: reach }] = usePreviewSmsCampaignMutation();
  const [create, c] = useCreateSmsCampaignMutation();
  const [update, u] = useUpdateSmsCampaignMutation();
  const [remove] = useDeleteSmsCampaignMutation();
  const [test, t] = useTestSmsCampaignMutation();
  const [send, s] = useSendSmsCampaignMutation();
  const [cancel] = useCancelSmsCampaignMutation();

  // Live reach and SMS parts while typing.
  useEffect(() => {
    if (body.trim().length < 5) return;
    const h = setTimeout(() => void preview({ body, audience, stopLink }), 500);
    return () => clearTimeout(h);
  }, [body, audience, stopLink, preview]);

  const num = (k: keyof Audience) => (v: string) => setAudience((a) => ({ ...a, [k]: v ? Number(v) : undefined }));
  const save = async () => {
    const input = { name: name.trim(), body: body.trim(), audience, stopLink };
    const saved = id ? await update({ id, ...input }).unwrap() : await create(input).unwrap();
    setId(saved.id);
    return saved.id;
  };
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      toast.success(ok);
    } catch (e) {
      toast.error(errorText(e));
    }
  };
  const busy = c.isLoading || u.isLoading || s.isLoading;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{campaign ? campaign.name : "New SMS campaign"}</DialogTitle>
          <DialogDescription>{"{name}"} becomes each customer's first name. Bangla text makes it a Unicode SMS: fewer characters per SMS.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="Name (only you see it)" htmlFor="cmp-name">
            <Input id="cmp-name" maxLength={120} value={name} onChange={(e) => setName(e.target.value)} placeholder="Eid sale 2026" />
          </Field>
          <Field label="Message" htmlFor="cmp-body">
            <Textarea id="cmp-body" rows={4} maxLength={1000} value={body} onChange={(e) => setBody(e.target.value)} />
          </Field>
          {reach && (
            <p className="text-xs text-slate-500">
              {reach.length} characters{reach.unicode ? " (Unicode)" : ""} · {reach.parts} SMS each{stopLink ? ", with the stop link" : ""}
            </p>
          )}
          <Toggle id="cmp-stop" checked={stopLink} onChange={setStopLink} label="Add a stop link" hint="Customers who tap it get no more campaigns (order messages still go). Off saves characters." />

          <div className="space-y-2">
            <p className="text-sm font-semibold">Who gets it</p>
            <p className="text-xs text-slate-500">Customers with a phone number. Every filter you fill narrows it; leave them all empty for everyone.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Ordered in the last (days)" htmlFor="a-recent">
                <Input id="a-recent" type="number" min={1} value={audience.lastOrderWithinDays ?? ""} onChange={(e) => num("lastOrderWithinDays")(e.target.value)} />
              </Field>
              <Field label="Not ordered for (days)" htmlFor="a-lapsed" hint="Ordered before, but not since.">
                <Input id="a-lapsed" type="number" min={1} value={audience.noOrderForDays ?? ""} onChange={(e) => num("noOrderForDays")(e.target.value)} />
              </Field>
              <Field label="Spent at least (৳)" htmlFor="a-spent">
                <Input id="a-spent" type="number" min={0} value={audience.minSpent ?? ""} onChange={(e) => num("minSpent")(e.target.value)} />
              </Field>
              <Field label="District" htmlFor="a-district">
                <Input id="a-district" value={audience.district ?? ""} onChange={(e) => setAudience((a) => ({ ...a, district: e.target.value || undefined }))} placeholder="Dhaka" />
              </Field>
              {!!loyalty?.levels.length && (
                <Field label="Loyalty level" htmlFor="a-level">
                  <select id="a-level" className={SELECT} value={audience.levelId ?? ""} onChange={(e) => setAudience((a) => ({ ...a, levelId: e.target.value || undefined }))}>
                    <option value="">Any</option>
                    {loyalty.levels.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
            </div>
            {reach && (
              <div className="rounded-md bg-slate-50 p-3 text-sm dark:bg-slate-800/50">
                <span className="font-semibold">{reach.people.toLocaleString("en-IN")} people</span> · {reach.totalParts.toLocaleString("en-IN")} SMS in all
                {reach.optedOut > 0 && <span className="text-slate-500"> · {reach.optedOut} who opted out are left out</span>}
              </div>
            )}
          </div>

          <div className="grid gap-3 border-t pt-4 sm:grid-cols-2">
            <Field label="Send a test to" htmlFor="cmp-test">
              <div className="flex gap-2">
                <Input id="cmp-test" inputMode="tel" placeholder="01712345678" value={testPhone} onChange={(e) => setTestPhone(e.target.value)} />
                <Button variant="outline" disabled={t.isLoading || testPhone.trim().length < 10 || name.trim().length < 2} onClick={() => run(async () => test({ id: await save(), phone: testPhone.trim() }).unwrap(), "Test SMS sent")}>
                  Test
                </Button>
              </div>
            </Field>
            <Field label="Send later (optional)" htmlFor="cmp-at" hint="Leave empty to send now.">
              <Input id="cmp-at" type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} />
            </Field>
          </div>
        </div>
        <DialogFooter className="flex-wrap gap-2">
          {id && campaign?.status === "draft" && (
            <Button variant="ghost" className="mr-auto text-red-600" onClick={() => run(async () => { await remove(id).unwrap(); onClose(); }, "Campaign deleted")}>
              Delete
            </Button>
          )}
          {campaign?.status === "scheduled" && (
            <Button variant="ghost" className="mr-auto text-red-600" onClick={() => run(async () => { await cancel(campaign.id).unwrap(); onClose(); }, "Campaign cancelled")}>
              Cancel sending
            </Button>
          )}
          <Button variant="outline" disabled={busy || name.trim().length < 2} onClick={() => run(save, "Saved")}>
            Save draft
          </Button>
          <Button
            disabled={busy || name.trim().length < 2 || !reach?.people}
            onClick={() => {
              if (!at && !window.confirm(`Send to ${reach?.people ?? 0} people now?`)) return;
              void run(async () => {
                const sid = await save();
                await send({ id: sid, at: at ? new Date(at).toISOString() : null }).unwrap();
                onClose();
              }, at ? "Campaign scheduled" : "Campaign is sending");
            }}
          >
            {at ? "Schedule" : `Send to ${reach?.people ?? 0}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResultsDialog({ id, canEdit, onClose }: { id: string; canEdit: boolean; onClose: () => void }) {
  const { data } = useGetSmsCampaignQuery(id, { pollingInterval: 15_000 });
  const [cancel] = useCancelSmsCampaignMutation();
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{data?.name ?? "Campaign"}</DialogTitle>
          <DialogDescription>Orders count when someone who got it ordered within 3 days, with the same phone number.</DialogDescription>
        </DialogHeader>
        {!data ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <div className="space-y-3 text-sm">
            <p className="whitespace-pre-wrap rounded-md bg-slate-50 p-3 dark:bg-slate-800/50">{data.body}</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["People", data.recipients],
                ["Sent", data.sent],
                ["Failed", data.failed],
                ["Orders after", data.ordersAfter ?? 0],
              ].map(([l, v]) => (
                <div key={String(l)} className="rounded-lg border p-3">
                  <p className="text-xs text-slate-500">{l}</p>
                  <p className="text-xl font-bold">{v}</p>
                </div>
              ))}
            </div>
            <p className="text-slate-600">Sales from those orders: {taka(data.salesAfter ?? 0)}</p>
            {data.status === "sending" && <p className="text-xs text-amber-700">Still sending. SMS wait between 10pm and 8am.</p>}
          </div>
        )}
        <DialogFooter>
          {canEdit && data?.status === "sending" && (
            <Button variant="ghost" className="mr-auto text-red-600" onClick={() => cancel(id).unwrap().then(() => toast.success("Stopped"), (e) => toast.error(errorText(e)))}>
              Stop sending
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
