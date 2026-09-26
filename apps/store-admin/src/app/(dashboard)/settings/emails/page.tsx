"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Eye, Inbox, Mail, Pencil, RotateCw, Search, Users, UserRound } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui";
import { EmptyState, Toggle } from "@/components/content/shared";
import { errorText } from "@/lib/features/content/content-api-slice";
import {
  useGetEmailLogEntryQuery,
  useGetEmailLogQuery,
  useGetEmailTemplatesQuery,
  useResendEmailMutation,
  useSaveEmailTemplateMutation,
  type EmailAudience,
  type EmailStatus,
  type EmailTemplateRow,
} from "@/lib/features/settings/emails-api-slice";
import { EmailFrame, StatusBadge, formatDateTime } from "./_components";

const GROUPS: { audience: EmailAudience; title: string; description: string; icon: typeof Users }[] = [
  { audience: "customer", title: "To customers", description: "Order updates and account emails your customers receive.", icon: UserRound },
  { audience: "staff", title: "To your team", description: "Alerts for you and your staff.", icon: Users },
];

export default function EmailSettingsPage() {
  const [tab, setTab] = useState("templates");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-blue-600" /> Emails
          </CardTitle>
          <CardDescription>
            Choose which emails your store sends and what they say. They use the logo and brand colour from Content &gt; Theme.
          </CardDescription>
        </CardHeader>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="templates">Emails</TabsTrigger>
          <TabsTrigger value="log">Sent emails</TabsTrigger>
        </TabsList>
        <TabsContent value="templates" className="space-y-6">
          <Templates />
        </TabsContent>
        <TabsContent value="log">
          <SentLog />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Templates() {
  const { data, isLoading } = useGetEmailTemplatesQuery();
  const [save] = useSaveEmailTemplateMutation();
  const [busy, setBusy] = useState<string | null>(null);

  const flip = async (t: EmailTemplateRow) => {
    setBusy(t.key);
    try {
      await save({ key: t.key, enabled: !t.enabled }).unwrap();
      toast.success(`${t.label} ${t.enabled ? "turned off" : "turned on"}`);
    } catch (e) {
      toast.error(errorText(e, "Couldn't change that email."));
    } finally {
      setBusy(null);
    }
  };

  if (isLoading) return <Skeleton className="h-96 w-full" />;

  return (
    <>
      {GROUPS.map((g) => (
        <Card key={g.audience}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <g.icon className="h-4 w-4 text-slate-500" /> {g.title}
            </CardTitle>
            <CardDescription>{g.description}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y border-t">
              {(data ?? [])
                .filter((t) => t.audience === g.audience)
                .map((t) => (
                  <li key={t.key} className="flex items-center gap-4 px-6 py-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/settings/emails/${t.key}`} className="font-medium text-slate-900 hover:underline dark:text-white">
                          {t.label}
                        </Link>
                        {t.customised && (
                          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                            Edited
                          </span>
                        )}
                        {!t.enabled && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            Off
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{t.description}</p>
                    </div>
                    <div className={busy === t.key ? "pointer-events-none opacity-60" : undefined}>
                      <Toggle checked={t.enabled} onChange={() => flip(t)} ariaLabel={`Send ${t.label}`} />
                    </div>
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/settings/emails/${t.key}`}>
                        <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
                      </Link>
                    </Button>
                  </li>
                ))}
            </ul>
          </CardContent>
        </Card>
      ))}
    </>
  );
}

const STATUSES: { value: EmailStatus | ""; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "sent", label: "Sent" },
  { value: "failed", label: "Failed" },
  { value: "retrying", label: "Retrying" },
  { value: "queued", label: "Sending" },
];

function SentLog() {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<EmailStatus | "">("");
  const [page, setPage] = useState(1);
  const [viewing, setViewing] = useState<string | null>(null);
  const [resend, { isLoading: resending }] = useResendEmailMutation();

  // Search as the user types, without a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading, isFetching, refetch } = useGetEmailLogQuery(
    { page, perPage: 20, search: query || undefined, status: status || undefined },
    { pollingInterval: 15_000 },
  );
  const rows = data?.items ?? [];

  const onResend = async (id: string) => {
    try {
      const sent = await resend(id).unwrap();
      toast.success(sent.status === "failed" ? "Tried again, but it failed" : `Sent again to ${sent.to.join(", ")}`);
      setViewing(null);
    } catch (e) {
      toast.error(errorText(e, "Couldn't send it again."));
    }
  };

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input className="pl-9" placeholder="Search by subject" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select
            className="sm:w-44"
            value={status}
            onValueChange={(v) => {
              setStatus(v as EmailStatus | "");
              setPage(1);
            }}
          >
            {STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </Select>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="sm:ml-auto">
            <RotateCw className={`mr-1.5 h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>

        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title={query || status ? "No emails match" : "No emails sent yet"}
            text="Emails appear here as your store sends them: order confirmations, status updates, password resets and tests."
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24 text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="max-w-[18rem]">
                      <div className="truncate font-medium" title={r.subject}>
                        {r.subject}
                      </div>
                      <div className="truncate text-xs text-slate-500">
                        {r.templateLabel}
                        {r.recipientType === "test" ? " (test)" : ""} · {formatDateTime(r.sentAt ?? r.createdAt)}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[12rem] truncate text-sm" title={r.to.join(", ")}>
                      {r.to.join(", ")}
                    </TableCell>
                    <TableCell className="max-w-[11rem]">
                      <StatusBadge status={r.status} logOnly={r.logOnly} />
                      {r.status !== "sent" && r.error && (
                        <div className="mt-1 truncate text-xs text-red-600" title={r.error}>
                          {r.error}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="View" aria-label="View" onClick={() => setViewing(r.id)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="Send again" aria-label="Send again" disabled={resending} onClick={() => onResend(r.id)}>
                          <RotateCw className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>
              Page {data.page} of {data.totalPages} ({data.total} emails)
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="h-4 w-4" /> Newer
              </Button>
              <Button variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>
                Older <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        {viewing && <SentEmail id={viewing} onResend={() => onResend(viewing)} onClose={() => setViewing(null)} resending={resending} />}
      </Dialog>
    </Card>
  );
}

function SentEmail({ id, onResend, onClose, resending }: { id: string; onResend: () => void; onClose: () => void; resending: boolean }) {
  const { data, isLoading } = useGetEmailLogEntryQuery(id);
  return (
    <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="pr-6 leading-snug">{data?.subject ?? "Email"}</DialogTitle>
        {data && (
          <DialogDescription>
            To {data.to.join(", ")} · {formatDateTime(data.sentAt ?? data.createdAt)}
          </DialogDescription>
        )}
      </DialogHeader>
      {isLoading || !data ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <StatusBadge status={data.status} logOnly={data.logOnly} />
            {data.attempts > 1 && <span className="text-slate-500">{data.attempts} attempts</span>}
            {data.error && data.status !== "sent" && <span className="text-red-600">{data.error}</span>}
            <div className="ml-auto flex gap-2">
              <Button size="sm" variant="outline" disabled={resending} onClick={onResend}>
                <RotateCw className="mr-1.5 h-3.5 w-3.5" /> Send again
              </Button>
              <Button size="sm" variant="ghost" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
          <EmailFrame html={data.html} title={data.subject} />
        </>
      )}
    </DialogContent>
  );
}
