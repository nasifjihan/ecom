"use client";

/**
 * WhatsApp: order updates by WhatsApp to customers who opted in at checkout (or that staff ticked
 * for a phone order). "Record only" writes each message to the log without sending it; the Cloud
 * API sends through the shop's own WhatsApp Business number with templates approved by Meta.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, MessageCircle, RotateCcw, Send } from "lucide-react";
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
  cn,
} from "@/components/ui";
import { Field, PageTitle, Toggle } from "@/components/content/shared";
import { errorText } from "@/lib/features/content/content-api-slice";
import { useCan } from "@/lib/permissions";
import {
  WA_EVENT_INFO,
  useResendWhatsappMutation,
  useSaveWhatsappSettingsMutation,
  useTestWhatsappMutation,
  useWhatsappLogQuery,
  useWhatsappSettingsQuery,
  type WaEvent,
  type WaLanguage,
  type WaMessage,
  type WaSettings,
} from "@/lib/features/settings/whatsapp-api-slice";

const SELECT = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
const EVENTS = Object.keys(WA_EVENT_INFO) as WaEvent[];
const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const STATUS_STYLE: Record<WaMessage["status"], string> = {
  logged: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  sending: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  sent: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
  delivered: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  read: "bg-emerald-200 text-emerald-900 dark:bg-emerald-800/50 dark:text-emerald-200",
  failed: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
};
const STATUS_LABEL: Record<WaMessage["status"], string> = {
  logged: "Recorded only",
  sending: "Sending",
  sent: "Sent",
  delivered: "Delivered",
  read: "Read",
  failed: "Failed",
};

const copy = (v: string) =>
  void navigator.clipboard.writeText(v).then(
    () => toast.success("Copied"),
    () => toast.error("Couldn't copy; select it and copy by hand"),
  );

function SettingsForm({ s, canEdit }: { s: WaSettings; canEdit: boolean }) {
  const [provider, setProvider] = useState(s.provider);
  const [phoneNumberId, setPhoneNumberId] = useState(s.phoneNumberId ?? "");
  const [accessToken, setAccessToken] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [events, setEvents] = useState(s.events);
  const [testTo, setTestTo] = useState("");
  const [save, { isLoading }] = useSaveWhatsappSettingsMutation();
  const [test, { isLoading: testing }] = useTestWhatsappMutation();
  useEffect(() => {
    setProvider(s.provider);
    setPhoneNumberId(s.phoneNumberId ?? "");
    setEvents(s.events);
  }, [s]);
  const setE = (e: WaEvent, patch: Partial<WaSettings["events"][WaEvent]>) => setEvents((v) => ({ ...v, [e]: { ...v[e], ...patch } }));

  async function submit() {
    try {
      await save({
        provider,
        phoneNumberId: phoneNumberId.trim() || null,
        ...(accessToken.trim() ? { accessToken: accessToken.trim() } : {}),
        ...(appSecret.trim() ? { appSecret: appSecret.trim() } : {}),
        events,
      }).unwrap();
      setAccessToken("");
      setAppSecret("");
      toast.success("WhatsApp settings saved");
    } catch (e) {
      toast.error(errorText(e));
    }
  }

  async function sendTest() {
    try {
      const m = await test({ to: testTo }).unwrap();
      if (m.status === "failed") toast.error(`Not sent: ${m.error ?? "WhatsApp refused it"}`);
      else if (m.status === "logged") toast.info("Recorded in the log (\"Record only\" sends nothing)");
      else toast.success(`Test message sent to ${m.to}`);
    } catch (e) {
      toast.error(errorText(e));
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Connection</CardTitle>
          <CardDescription>
            From your app at developers.facebook.com → WhatsApp → API Setup. The access token and app secret are stored encrypted and never
            shown again; leave them empty to keep what&apos;s saved.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="How to send" htmlFor="wa-provider">
            <select id="wa-provider" className={SELECT} value={provider} onChange={(e) => setProvider(e.target.value === "cloud" ? "cloud" : "log")}>
              <option value="log">Record only (nothing is sent; for trying it out)</option>
              <option value="cloud">WhatsApp Cloud API (Meta)</option>
            </select>
          </Field>
          {provider === "cloud" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Phone number ID" htmlFor="wa-pnid" hint="The long number under your WhatsApp number in API Setup (not the phone number).">
                <Input id="wa-pnid" inputMode="numeric" value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value)} />
              </Field>
              <Field label="Access token" htmlFor="wa-token" hint={s.accessTokenHint ? `Saved: ${s.accessTokenHint}` : "A permanent token from a system user is best."}>
                <Input id="wa-token" type="password" autoComplete="off" value={accessToken} onChange={(e) => setAccessToken(e.target.value)} />
              </Field>
              <Field label="App secret" htmlFor="wa-secret" hint={s.appSecretHint ? `Saved: ${s.appSecretHint}` : "App settings → Basic. Checks that delivery updates really come from Meta."}>
                <Input id="wa-secret" type="password" autoComplete="off" value={appSecret} onChange={(e) => setAppSecret(e.target.value)} />
              </Field>
            </div>
          )}
          <div className="space-y-1 rounded-lg border bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-300">
            <p className="font-medium">Delivery updates (webhook): in your app, WhatsApp → Configuration, enter</p>
            {[
              ["Callback URL", s.webhookUrl],
              ["Verify token", s.verifyToken],
            ].map(([k, v]) => (
              <p key={k} className="flex flex-wrap items-center gap-2">
                {k}: <code className="rounded bg-white px-1.5 py-0.5 dark:bg-slate-800">{v}</code>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copy(v!)} aria-label={`Copy ${k}`}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </p>
            ))}
            <p>Then subscribe to the &quot;messages&quot; field. Sent, delivered, read and failed then show in the log below.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Order updates</CardTitle>
          <CardDescription>
            WhatsApp only lets a shop start a chat with a template Meta has approved. Create each template in WhatsApp Manager with the
            values below as {"{{1}}"}, {"{{2}}"}… in that order, then enter its name and language here. Messages go only to customers who
            ticked &quot;Send my order updates on WhatsApp&quot;.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {EVENTS.map((e) => (
            <div key={e} className="space-y-3 rounded-lg border p-4">
              <Toggle checked={events[e].enabled} onChange={(v) => setE(e, { enabled: v })} label={WA_EVENT_INFO[e].label} />
              <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
                <Field label="Template name" htmlFor={`wa-t-${e}`}>
                  <Input id={`wa-t-${e}`} value={events[e].template} onChange={(ev) => setE(e, { template: ev.target.value.trim().toLowerCase() })} className="font-mono" />
                </Field>
                <Field label="Language" htmlFor={`wa-l-${e}`}>
                  <select id={`wa-l-${e}`} className={SELECT} value={events[e].language} onChange={(ev) => setE(e, { language: ev.target.value as WaLanguage })}>
                    <option value="en">English (en)</option>
                    <option value="en_US">English US (en_US)</option>
                    <option value="bn">Bangla (bn)</option>
                  </select>
                </Field>
              </div>
              <p className="text-xs text-slate-500">
                {WA_EVENT_INFO[e].params.map((p, i) => `{{${i + 1}}} ${p}`).join(" · ")}
              </p>
            </div>
          ))}
          {canEdit && (
            <div className="flex justify-end">
              <Button onClick={() => void submit()} disabled={isLoading}>
                {isLoading ? "Saving…" : "Save"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Test message</CardTitle>
          <CardDescription>
            Sends Meta&apos;s ready-made &quot;hello_world&quot; template. In a test app, only numbers you added as recipients receive it.
            {s.lastTestAt ? ` Last test ${when(s.lastTestAt)}${s.lastError ? `: ${s.lastError}` : ": OK"}.` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Input className="w-56" placeholder="01XXXXXXXXX" inputMode="tel" value={testTo} onChange={(e) => setTestTo(e.target.value)} aria-label="Number to test" />
          <Button variant="outline" onClick={() => void sendTest()} disabled={!canEdit || testing || testTo.trim().length < 10}>
            <Send className="mr-1 h-4 w-4" /> {testing ? "Sending…" : "Send test"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function MessageLog({ canEdit }: { canEdit: boolean }) {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  useEffect(() => setPage(1), [status]);
  const { data, isFetching } = useWhatsappLogQuery({ page, status });
  const [resend] = useResendWhatsappMutation();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Sent WhatsApp messages</CardTitle>
        <CardDescription>Every message with its template values, and what Meta said about it.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <select className={cn(SELECT, "w-44")} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="">Any status</option>
          {(Object.keys(STATUS_LABEL) as WaMessage["status"][]).map((k) => (
            <option key={k} value={k}>
              {STATUS_LABEL[k]}
            </option>
          ))}
        </select>
        {!data ? (
          <Skeleton className="h-24" />
        ) : !data.items.length ? (
          <p className="py-8 text-center text-sm text-slate-500">No WhatsApp messages yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody className={cn(isFetching && "opacity-60")}>
                {data.items.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="whitespace-nowrap text-sm">{when(m.createdAt)}</TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-sm">+{m.to}</TableCell>
                    <TableCell className="max-w-md text-sm">
                      <span className="font-mono">{m.template}</span> <span className="text-xs text-slate-500">({m.language})</span>
                      {m.params.length > 0 && <span className="block text-xs text-slate-500">{m.params.join(" · ")}</span>}
                      {m.orderId && (
                        <a href={`/orders/${m.orderId}`} className="block text-xs text-blue-600 hover:underline">
                          Order #{m.orderId}
                        </a>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={cn("font-normal", STATUS_STYLE[m.status])}>{STATUS_LABEL[m.status]}</Badge>
                      {m.error && <span className="mt-1 block max-w-xs text-xs text-rose-600">{m.error}</span>}
                    </TableCell>
                    <TableCell>
                      {canEdit && m.status === "failed" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            void resend(m.id)
                              .unwrap()
                              .then(
                                () => toast.success("Sent again"),
                                (e: unknown) => toast.error(errorText(e)),
                              )
                          }
                        >
                          <RotateCcw className="mr-1 h-3.5 w-3.5" /> Send again
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

export default function WhatsappSettingsPage() {
  const { data, isLoading } = useWhatsappSettingsQuery();
  const { can } = useCan();
  const canEdit = can("settings.edit");
  return (
    <div className="space-y-6">
      <PageTitle icon={MessageCircle} title="WhatsApp" description="Order updates on WhatsApp for customers who ask for them, and every message sent." />
      {isLoading || !data ? <Skeleton className="h-64" /> : <SettingsForm s={data} canEdit={canEdit} />}
      <MessageLog canEdit={canEdit} />
    </div>
  );
}
