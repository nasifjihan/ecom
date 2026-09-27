"use client";

/**
 * SMS: the provider the shop's messages go through (BulkSMSBD, Alpha SMS, SSL Wireless), which
 * order updates customers get by SMS and what they say, phone sign-in on the storefront, and
 * every SMS sent. Keys are stored encrypted and only their last 4 characters are shown.
 */
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, MessageSquareText, RotateCcw, Search, Send, XCircle } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
import { Field, PageTitle, Toggle } from "@/components/content/shared";
import { errorText } from "@/lib/features/content/content-api-slice";
import { useCan } from "@/lib/permissions";
import {
  SMS_EVENT_LABELS,
  SMS_KIND_LABELS,
  smsParts,
  useResendSmsMutation,
  useSaveSmsSettingsMutation,
  useSmsLogQuery,
  useSmsSettingsQuery,
  useTestSmsMutation,
  type SmsEvent,
  type SmsSettings,
} from "@/lib/features/settings/sms-api-slice";

const SELECT = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const PLACEHOLDERS = ["{name}", "{order}", "{total}", "{store}", "{phone}", "{courier}", "{tracking}", "{link}"];

const STATUS_STYLE: Record<string, string> = {
  sent: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  logged: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  failed: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
  sending: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
};

function PartsHint({ text }: { text: string }) {
  const p = smsParts(text);
  return (
    <span className={cn("text-xs", p.parts > 2 ? "text-amber-600" : "text-slate-500")}>
      {p.length} characters · {p.parts} SMS{p.parts === 1 ? "" : " parts"}
      {p.unicode ? " · Unicode (Bangla or symbols: 70 a part)" : ""}
    </span>
  );
}

// ------------------------------------------------------------------ provider + events

function SettingsForm({ s, canEdit }: { s: SmsSettings; canEdit: boolean }) {
  const [provider, setProvider] = useState(s.provider);
  const [senderId, setSenderId] = useState(s.senderId ?? "");
  const [creds, setCreds] = useState<Record<string, string>>({});
  const [events, setEvents] = useState(s.events);
  const [otp, setOtp] = useState(s.phoneOtpLogin);
  const [save, { isLoading }] = useSaveSmsSettingsMutation();
  const [test, { isLoading: testing }] = useTestSmsMutation();
  const [testTo, setTestTo] = useState("");

  useEffect(() => {
    setEvents(s.events);
    setOtp(s.phoneOtpLogin);
  }, [s]);

  const info = s.providers.find((p) => p.code === provider)!;
  const sameProvider = provider === s.provider;

  async function submit() {
    try {
      await save({
        provider,
        senderId: info.senderId === "none" ? null : senderId.trim() || null,
        credentials: Object.fromEntries(Object.entries(creds).filter(([, v]) => v.trim())),
        events,
        phoneOtpLogin: otp,
      }).unwrap();
      setCreds({});
      toast.success("SMS settings saved");
    } catch (e) {
      toast.error(errorText(e));
    }
  }

  async function sendTest() {
    try {
      const m = await test({ to: testTo }).unwrap();
      if (m.status === "failed") toast.error(`Not sent: ${m.error}`);
      else if (m.status === "logged") toast.info("Recorded in the log (the 'Record only' provider sends nothing)");
      else toast.success(`Test SMS sent to ${m.to}`);
    } catch (e) {
      toast.error(errorText(e));
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">SMS provider</CardTitle>
          <CardDescription>The bulk-SMS account the shop&apos;s messages are sent from. Keys are stored encrypted.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Provider" htmlFor="sms-provider">
              <select id="sms-provider" className={SELECT} value={provider} onChange={(e) => setProvider(e.target.value)} disabled={!canEdit}>
                {s.providers.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            {info.senderId !== "none" && (
              <Field
                label={info.senderId === "required" ? "Sender ID" : "Sender ID (optional)"}
                htmlFor="sms-sender"
                hint="The name or number customers see, as approved by the provider."
              >
                <Input id="sms-sender" value={senderId} onChange={(e) => setSenderId(e.target.value)} disabled={!canEdit} />
              </Field>
            )}
            {info.fields.map((f) => {
              const stored = sameProvider ? s.credentialHints[f.key] : null;
              return (
                <Field key={f.key} label={f.label} htmlFor={`sms-${f.key}`} hint={stored ? `Saved (${stored}). Leave empty to keep it.` : undefined}>
                  <Input
                    id={`sms-${f.key}`}
                    type={f.secret ? "password" : "text"}
                    autoComplete="off"
                    value={creds[f.key] ?? ""}
                    placeholder={stored ?? ""}
                    onChange={(e) => setCreds((c) => ({ ...c, [f.key]: e.target.value }))}
                    disabled={!canEdit}
                  />
                </Field>
              );
            })}
          </div>
          {provider === "log" && (
            <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
              &quot;Record only&quot; sends nothing: messages appear in the log below, so you can check the wording before connecting a provider.
            </p>
          )}
          {!sameProvider && <p className="text-xs text-slate-500">Save to switch provider, then send a test.</p>}
          <div className="flex flex-wrap items-end gap-3 border-t pt-4">
            <Field label="Send a test SMS to" htmlFor="sms-test" className="w-56">
              <Input id="sms-test" placeholder="01XXXXXXXXX" value={testTo} onChange={(e) => setTestTo(e.target.value)} />
            </Field>
            <Button variant="outline" onClick={sendTest} disabled={!canEdit || testing || !sameProvider || testTo.trim().length < 10}>
              <Send className="mr-2 h-4 w-4" /> {testing ? "Sending…" : "Send test"}
            </Button>
            {s.lastTestAt && (
              <span className={cn("flex items-center gap-1 text-sm", s.lastError ? "text-rose-600" : "text-emerald-700")}>
                {s.lastError ? <XCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                Last test {when(s.lastTestAt)}: {s.lastError ?? "sent"}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sign in with phone</CardTitle>
          <CardDescription>Customers get a 6-digit code by SMS instead of using a password. New numbers get an account automatically.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Toggle
            checked={otp}
            onChange={setOtp}
            label="Customers can sign in with a code sent to their phone"
            hint="Codes last 5 minutes and work once. A number can get a new code once a minute, 5 an hour; 5 wrong tries end a code."
          />
          {otp && provider === "log" && <p className="text-xs text-rose-600">Choose a provider that sends SMS first.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Order updates by SMS</CardTitle>
          <CardDescription>
            Sent to the order&apos;s phone number when these happen (not when you choose not to tell the customer). You can write them in Bangla,
            but Unicode SMS fit 70 characters a part instead of 160.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-xs text-slate-500">
            Placeholders: {PLACEHOLDERS.map((p) => (
              <code key={p} className="mr-1 rounded bg-slate-100 px-1 dark:bg-slate-800">
                {p}
              </code>
            ))}
          </p>
          {(Object.keys(SMS_EVENT_LABELS) as SmsEvent[]).map((e) => (
            <div key={e} className="space-y-2 rounded-md border p-3">
              <Toggle
                checked={events[e].enabled}
                onChange={(v) => setEvents((x) => ({ ...x, [e]: { ...x[e], enabled: v } }))}
                label={SMS_EVENT_LABELS[e]}
              />
              {events[e].enabled && (
                <>
                  <Textarea
                    rows={2}
                    aria-label={`${SMS_EVENT_LABELS[e]} message`}
                    value={events[e].template}
                    onChange={(ev) => setEvents((x) => ({ ...x, [e]: { ...x[e], template: ev.target.value } }))}
                    disabled={!canEdit}
                  />
                  <PartsHint text={events[e].template} />
                </>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {canEdit && (
        <div className="flex justify-end">
          <Button onClick={submit} disabled={isLoading}>
            {isLoading ? "Saving…" : "Save SMS settings"}
          </Button>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ log

function SmsLog({ canEdit }: { canEdit: boolean }) {
  const [page, setPage] = useState(1);
  const [kind, setKind] = useState("");
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setSearch(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => setPage(1), [kind, status, search]);
  const { data, isFetching } = useSmsLogQuery({ page, kind, status, search });
  const [resend] = useResendSmsMutation();
  const kinds = useMemo(() => Object.entries(SMS_KIND_LABELS), []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Sent SMS</CardTitle>
        <CardDescription>
          Every message, including failures and why. Sign-in codes are hidden.
          {data ? ` ${data.partsLast30Days} SMS parts sent in the last 30 days.` : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <div className="relative w-60">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <Input className="pl-9" placeholder="Number or text" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search SMS" />
          </div>
          <select className={cn(SELECT, "w-48")} value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Type">
            <option value="">All types</option>
            {kinds.map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
          <select className={cn(SELECT, "w-36")} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
            <option value="">Any status</option>
            <option value="sent">Sent</option>
            <option value="failed">Failed</option>
            <option value="logged">Recorded only</option>
          </select>
        </div>
        {!data ? (
          <Skeleton className="h-24" />
        ) : !data.items.length ? (
          <p className="py-8 text-center text-sm text-slate-500">No SMS yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody className={cn(isFetching && "opacity-60")}>
                {data.items.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="whitespace-nowrap text-sm">{when(m.createdAt)}</TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-sm">{m.to}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {SMS_KIND_LABELS[m.kind] ?? m.kind}
                      {m.orderId && (
                        <a href={`/orders/${m.orderId}`} className="block text-xs text-blue-600 hover:underline">
                          Order #{m.orderId}
                        </a>
                      )}
                    </TableCell>
                    <TableCell className="max-w-md text-sm">
                      {m.body}
                      <span className="block text-xs text-slate-500">
                        {m.provider} · {m.segments} part{m.segments === 1 ? "" : "s"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STATUS_STYLE[m.status])}>
                        {m.status === "logged" ? "recorded" : m.status}
                      </span>
                      {m.error && <span className="mt-1 block max-w-[14rem] text-xs text-rose-600">{m.error}</span>}
                    </TableCell>
                    <TableCell>
                      {canEdit && m.status === "failed" && m.kind !== "otp" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={async () => {
                            try {
                              const r = await resend(m.id).unwrap();
                              if (r.status === "failed") toast.error(`Still not sent: ${r.error}`);
                              else toast.success("Sent again");
                            } catch (e) {
                              toast.error(errorText(e));
                            }
                          }}
                        >
                          <RotateCcw className="mr-1 h-4 w-4" /> Resend
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
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
      </CardContent>
    </Card>
  );
}

export default function SmsSettingsPage() {
  const { data, isLoading } = useSmsSettingsQuery();
  const { can } = useCan();
  const canEdit = can("settings.edit");
  return (
    <div className="space-y-6">
      <PageTitle icon={MessageSquareText} title="SMS" description="Order updates by SMS, phone sign-in, and every message sent." />
      {isLoading || !data ? <Skeleton className="h-64" /> : <SettingsForm s={data} canEdit={canEdit} />}
      <SmsLog canEdit={canEdit} />
      <p className="text-xs text-slate-500">
        <Badge variant="secondary" className="mr-1">
          Tip
        </Badge>
        Amounts are written as &quot;Tk 1,200&quot;: the ৳ sign would make every message Unicode and cost about twice as much.
      </p>
    </div>
  );
}
