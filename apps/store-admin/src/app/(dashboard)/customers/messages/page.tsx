"use client";

/**
 * Messages from the storefront's contact form: questions, "call me back" and problems with an
 * order. Open one to reply by SMS or email, add a note, give it to someone and mark it done.
 */
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { MessageSquare, Phone } from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, Input, Skeleton, Textarea, cn } from "@/components/ui";
import { PageTitle } from "@/components/content/shared";
import { errorText } from "@/lib/features/content/content-api-slice";
import { useCan } from "@/lib/permissions";
import { useLeadOwnersQuery } from "@/lib/features/customers/leads-api-slice";
import {
  KIND_LABELS,
  STATUS_LABELS,
  useGetMessageQuery,
  useListMessagesQuery,
  useReplyToMessageMutation,
  useUpdateMessageMutation,
  type MessageStatus,
} from "@/lib/features/customers/messages-api-slice";

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const TONE: Record<MessageStatus, string> = { new: "bg-amber-100 text-amber-800", open: "bg-blue-100 text-blue-700", done: "bg-emerald-100 text-emerald-700" };

function MessagesPage() {
  const params = useSearchParams();
  const [status, setStatus] = useState<MessageStatus | "">("new");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(params.get("open"));
  const { data, isLoading } = useListMessagesQuery({ status: status || undefined, search: search.trim() || undefined, page });

  const tab = (value: MessageStatus | "", label: string, n?: number) => (
    <button
      key={value || "all"}
      type="button"
      onClick={() => {
        setStatus(value);
        setPage(1);
      }}
      className={cn("rounded-md border px-3 py-1.5 text-sm font-medium", status === value ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-400")}
    >
      {label} {n !== undefined && <span className="opacity-70">{n}</span>}
    </button>
  );

  return (
    <div className="space-y-6">
      <PageTitle icon={MessageSquare} title="Messages" description="What customers sent through the contact form on your storefront." />
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {(["new", "open", "done"] as const).map((s) => tab(s, STATUS_LABELS[s], data?.counts[s] ?? 0))}
            {tab("", "All")}
          </div>
          <Input
            className="sm:w-64"
            placeholder="Search name, phone, email or text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            aria-label="Search messages"
          />
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : !data?.items.length ? (
            <p className="py-8 text-center text-sm text-slate-500">No messages here.</p>
          ) : (
            <ul className="divide-y">
              {data.items.map((m) => (
                <li key={m.id}>
                  <button type="button" onClick={() => setOpen(m.id)} className="flex w-full items-start gap-3 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-medium">{m.name}</span>
                        <Badge variant="outline" className="text-[11px]">
                          {KIND_LABELS[m.kind]}
                        </Badge>
                        {m.order && <span className="text-xs text-slate-500">Order #{m.order.number}</span>}
                        {m.assignedTo && <span className="text-xs text-slate-500">· {m.assignedTo.name}</span>}
                      </div>
                      <p className="truncate text-sm text-slate-600 dark:text-slate-300">{m.message}</p>
                      {m.callbackTime && <p className="text-xs text-slate-500">Call: {m.callbackTime}</p>}
                    </div>
                    <div className="shrink-0 text-right">
                      <Badge className={cn("border-transparent", TONE[m.status])}>{STATUS_LABELS[m.status]}</Badge>
                      <div className="mt-1 text-xs text-slate-500">{when(m.createdAt)}</div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
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
      {open && <MessageDialog id={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function MessageDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const { can } = useCan();
  const canEdit = can("customers.edit");
  const { data: m } = useGetMessageQuery(id);
  const { data: staff = [] } = useLeadOwnersQuery();
  const [update] = useUpdateMessageMutation();
  const [reply, { isLoading }] = useReplyToMessageMutation();
  const [channel, setChannel] = useState<"sms" | "email" | "note">("sms");
  const [body, setBody] = useState("");
  useEffect(() => {
    if (m) setChannel(m.phone ? "sms" : m.email ? "email" : "note");
  }, [m?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = async () => {
    try {
      await reply({ id, channel, body: body.trim() }).unwrap();
      setBody("");
      toast.success(channel === "note" ? "Note added" : "Reply sent");
    } catch (e) {
      toast.error(errorText(e));
    }
  };
  const set = (p: { status?: MessageStatus; assignedToId?: string | null }) => update({ id, ...p }).unwrap().catch((e) => toast.error(errorText(e)));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        {!m ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>
                {KIND_LABELS[m.kind]} from {m.name}
              </DialogTitle>
              <DialogDescription>{when(m.createdAt)}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 text-sm">
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-slate-600 dark:text-slate-300">
                {m.phone && (
                  <a href={`tel:${m.phone}`} className="inline-flex items-center gap-1 text-indigo-600 hover:underline">
                    <Phone className="h-3.5 w-3.5" /> {m.phone}
                  </a>
                )}
                {m.email && <span>{m.email}</span>}
                {m.order && (
                  <Link href={`/orders/${m.order.id}`} className="text-indigo-600 hover:underline">
                    Order #{m.order.number}
                  </Link>
                )}
                {m.customerId && (
                  <Link href={`/customers/${m.customerId}`} className="text-indigo-600 hover:underline">
                    Customer
                  </Link>
                )}
              </div>
              {m.callbackTime && <p className="font-medium">Best time to call: {m.callbackTime}</p>}
              <p className="whitespace-pre-wrap rounded-md bg-slate-50 p-3 dark:bg-slate-800/50">{m.message}</p>

              {m.replies.length > 0 && (
                <ul className="space-y-2">
                  {m.replies.map((r) => (
                    <li key={r.id} className={cn("rounded-md border p-2", r.channel === "note" && "border-dashed")}>
                      <div className="text-xs text-slate-500">
                        {r.channel === "note" ? "Note" : r.channel === "sms" ? "SMS" : "Email"} · {r.by} · {when(r.createdAt)}
                      </div>
                      <p className="whitespace-pre-wrap">{r.body}</p>
                    </li>
                  ))}
                </ul>
              )}

              {canEdit && (
                <>
                  <div className="space-y-2 border-t pt-3">
                    <div className="flex flex-wrap gap-2">
                      {(["sms", "email", "note"] as const).map((c) => (
                        <Button key={c} type="button" size="sm" variant={channel === c ? "default" : "outline"} disabled={(c === "sms" && !m.phone) || (c === "email" && !m.email)} onClick={() => setChannel(c)}>
                          {c === "sms" ? "Reply by SMS" : c === "email" ? "Reply by email" : "Note"}
                        </Button>
                      ))}
                    </div>
                    <Textarea rows={3} maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} placeholder={channel === "note" ? "Only staff see notes" : "Your reply"} />
                    <div className="flex justify-end">
                      <Button size="sm" onClick={send} disabled={isLoading || body.trim().length < 2}>
                        {channel === "note" ? "Add note" : "Send"}
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 border-t pt-3">
                    <select
                      className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                      value={m.assignedTo?.id ?? ""}
                      onChange={(e) => void set({ assignedToId: e.target.value || null })}
                      aria-label="Given to"
                    >
                      <option value="">Not given to anyone</option>
                      {staff.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                    {(["new", "open", "done"] as const).map((s) => (
                      <Button key={s} size="sm" variant={m.status === s ? "default" : "outline"} onClick={() => void set({ status: s })}>
                        {STATUS_LABELS[s]}
                      </Button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// useSearchParams (?open=) needs a Suspense boundary for the static build.
export default function MessagesRoute() {
  return (
    <Suspense>
      <MessagesPage />
    </Suspense>
  );
}
