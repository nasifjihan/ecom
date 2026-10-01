"use client";

/**
 * One lead: who they are, the timeline of calls, messages and notes, the next follow-up,
 * and the way to an order (which wins the lead).
 */
import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, ExternalLink, MessageSquare, Pencil, Phone, ShoppingBag, StickyNote, Trash2, Undo2, UserPlus, XCircle } from "lucide-react";
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
  Textarea,
  cn,
} from "@/components/ui";
import { SELECT } from "@/components/purchasing/shared";
import { taka } from "@/components/orders/order-pickers";
import { LeadDialog, fromLocalInput, localInput } from "@/components/customers/lead-dialog";
import { FollowUpText, LeadStatusBadge, whenText } from "@/components/customers/lead-bits";
import { errorText } from "@/lib/features/content/content-api-slice";
import { useCan } from "@/lib/permissions";
import {
  LEAD_CHANNEL_LABELS,
  useAddLeadNoteMutation,
  useDeleteLeadMutation,
  useLeadOwnersQuery,
  useLeadQuery,
  useLeadToCustomerMutation,
  useSetLeadStatusMutation,
  useUpdateLeadMutation,
  type LeadDetail,
  type LeadNote,
} from "@/lib/features/customers/leads-api-slice";

/** A link to their profile, when the handle is a plain name on a site we know. */
function profileUrl(l: LeadDetail): string | null {
  const h = l.handle;
  if (l.channel === "whatsapp" && l.phone && /^01\d{9}$/.test(l.phone)) return `https://wa.me/88${l.phone}`;
  if (!h || /\s/.test(h)) return null;
  if (l.channel === "facebook" || l.channel === "messenger") return /^\d+$/.test(h) ? `https://www.facebook.com/profile.php?id=${h}` : `https://www.facebook.com/${h}`;
  if (l.channel === "instagram") return `https://www.instagram.com/${h}`;
  if (l.channel === "tiktok") return `https://www.tiktok.com/@${h}`;
  return null;
}

const NOTE_ICON = { call: Phone, message: MessageSquare, note: StickyNote, status: Undo2 } as const;
const NOTE_WORD = { call: "Call", message: "Message", note: "Note", status: "" } as const;

/** Tomorrow / in N days at 10:00 local time, for the quick follow-up buttons. */
const daysAhead = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(10, 0, 0, 0);
  return localInput(d.toISOString());
};

function Timeline({ notes }: { notes: LeadNote[] }) {
  return (
    <ol className="space-y-4">
      {notes.map((n) => {
        const Icon = NOTE_ICON[n.kind];
        return (
          <li key={n.id} className="flex gap-3">
            <span className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full", n.kind === "status" ? "bg-slate-100 text-slate-500 dark:bg-slate-800" : "bg-primary/10 text-primary")}>
              <Icon className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className={cn("whitespace-pre-wrap text-sm", n.kind === "status" && "text-muted-foreground")}>
                {NOTE_WORD[n.kind] && <strong className="mr-1">{NOTE_WORD[n.kind]}:</strong>}
                {n.body}
              </p>
              <p className="text-xs text-muted-foreground">
                {n.author ?? "Staff"} · {whenText(n.createdAt)}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export default function LeadPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { can } = useCan();
  const { data: lead, isLoading } = useLeadQuery(id);
  const { data: owners = [] } = useLeadOwnersQuery();
  const [addNote, { isLoading: noting }] = useAddLeadNoteMutation();
  const [setStatus, { isLoading: moving }] = useSetLeadStatusMutation();
  const [update] = useUpdateLeadMutation();
  const [toCustomer, { isLoading: converting }] = useLeadToCustomerMutation();
  const [remove] = useDeleteLeadMutation();
  const [kind, setKind] = useState<"call" | "message" | "note">("call");
  const [body, setBody] = useState("");
  const [next, setNext] = useState("");
  const [editing, setEditing] = useState(false);
  const [losing, setLosing] = useState(false);
  const [reason, setReason] = useState("");
  const edit = can("leads.edit");

  if (isLoading || !lead) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-64" />
      </div>
    );
  }
  const open = lead.status !== "won" && lead.status !== "lost";
  const url = profileUrl(lead);

  const run = async (p: Promise<unknown>, ok?: string) => {
    try {
      await p;
      if (ok) toast.success(ok);
      return true;
    } catch (e) {
      toast.error(errorText(e));
      return false;
    }
  };

  const startOrder = async () => {
    if (!lead.customer) {
      const done = await run(toCustomer(lead.id).unwrap());
      if (!done) return;
    }
    router.push(`/orders/new?lead=${lead.id}`);
  };

  return (
    <div className="space-y-6">
      <Link href="/customers/leads" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to leads
      </Link>

      <Card>
        <CardContent className="flex flex-col gap-4 p-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold">{lead.name}</h1>
              <LeadStatusBadge status={lead.status} />
            </div>
            <p className="text-sm text-muted-foreground">
              Asked on {LEAD_CHANNEL_LABELS[lead.channel] ?? lead.channel}
              {lead.handle ? ` as ${lead.handle}` : ""} · added {whenText(lead.createdAt)}
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {lead.phone && (
                <a href={`tel:${lead.phone}`} className="inline-flex items-center gap-1 hover:underline">
                  <Phone className="h-3.5 w-3.5" /> {lead.phone}
                </a>
              )}
              {lead.email && <span>{lead.email}</span>}
              {url && (
                <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                  <ExternalLink className="h-3.5 w-3.5" /> Open on {LEAD_CHANNEL_LABELS[lead.channel]}
                </a>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {open && can("orders.create") && edit && (
              <Button onClick={() => void startOrder()} disabled={converting || lead.customer?.banned}>
                <ShoppingBag className="mr-1 h-4 w-4" /> New order
              </Button>
            )}
            {lead.customer ? (
              <Button variant="outline" asChild>
                <Link href={`/customers/${lead.customer.id}`}>Open customer</Link>
              </Button>
            ) : (
              edit && (
                <Button variant="outline" onClick={() => void run(toCustomer(lead.id).unwrap(), "Saved as a customer")} disabled={converting || (!lead.phone && !lead.email)}>
                  <UserPlus className="mr-1 h-4 w-4" /> Make customer
                </Button>
              )
            )}
            {edit && (
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil className="mr-1 h-4 w-4" /> Edit
              </Button>
            )}
            {can("leads.delete") && (
              <Button
                variant="outline"
                className="text-red-700"
                aria-label="Delete lead"
                onClick={async () => {
                  if (!window.confirm(`Delete the lead for ${lead.name}? Its notes go too.`)) return;
                  if (await run(remove(lead.id).unwrap(), "Lead deleted")) router.push("/customers/leads");
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {lead.customer?.banned && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">This person&apos;s customer account is banned, so they can&apos;t order.</div>
      )}
      {lead.status === "won" && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          Won{lead.closedAt ? ` on ${whenText(lead.closedAt)}` : ""} with{" "}
          {lead.orderId ? (
            <Link href={`/orders/${lead.orderId}`} className="font-medium underline">
              order #{lead.orderNumber}
            </Link>
          ) : (
            "an order"
          )}
          .
        </div>
      )}
      {lead.status === "lost" && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-slate-50 p-4 text-sm dark:bg-slate-900">
          <span>
            <strong>Lost</strong>
            {lead.closedAt ? ` on ${whenText(lead.closedAt)}` : ""}: {lead.lostReason}
          </span>
          {edit && (
            <Button size="sm" variant="outline" onClick={() => void run(setStatus({ id: lead.id, status: "interested" }).unwrap(), "Lead reopened")} disabled={moving}>
              <Undo2 className="mr-1 h-4 w-4" /> Reopen
            </Button>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          {edit && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Add to the timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <form
                  className="space-y-3"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const ok = await run(addNote({ id: lead.id, kind, body: body.trim(), ...(next ? { nextFollowUpAt: fromLocalInput(next) } : {}) }).unwrap(), "Added");
                    if (ok) {
                      setBody("");
                      setNext("");
                    }
                  }}
                >
                  <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="What happened">
                    {(["call", "message", "note"] as const).map((k) => (
                      <button
                        key={k}
                        type="button"
                        role="radio"
                        aria-checked={kind === k}
                        onClick={() => setKind(k)}
                        className={cn("rounded-full border px-3 py-1 text-sm", kind === k ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground")}
                      >
                        {k === "call" ? "Called" : k === "message" ? "Messaged" : "Note"}
                      </button>
                    ))}
                  </div>
                  <Textarea
                    aria-label="What was said"
                    rows={3}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder={kind === "call" ? "Wants size 42 in white, will confirm after salary on the 5th" : kind === "message" ? "Sent the price list and photos on Messenger" : "Anything worth remembering"}
                    maxLength={2000}
                  />
                  {open && (
                    <div className="flex flex-wrap items-center gap-2">
                      <label htmlFor="next" className="text-sm text-muted-foreground">
                        Follow up
                      </label>
                      <Input id="next" type="datetime-local" className="w-56" value={next} onChange={(e) => setNext(e.target.value)} />
                      <Button type="button" size="sm" variant="ghost" onClick={() => setNext(daysAhead(1))}>
                        Tomorrow
                      </Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => setNext(daysAhead(3))}>
                        In 3 days
                      </Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => setNext(daysAhead(7))}>
                        Next week
                      </Button>
                    </div>
                  )}
                  <Button type="submit" disabled={noting || !body.trim()}>
                    Add
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <Timeline notes={lead.notes} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {open && edit && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Move to</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {(["contacted", "interested"] as const)
                  .filter((s) => s !== lead.status)
                  .map((s) => (
                    <Button key={s} size="sm" variant="outline" disabled={moving} onClick={() => void run(setStatus({ id: lead.id, status: s }).unwrap())}>
                      {s === "contacted" ? "Contacted" : "Interested"}
                    </Button>
                  ))}
                <Button size="sm" variant="outline" className="text-red-700" onClick={() => setLosing(true)}>
                  <XCircle className="mr-1 h-4 w-4" /> Lost
                </Button>
                <p className="w-full text-xs text-muted-foreground">It&apos;s won when you make its order with New order.</p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">Wants</div>
                <div className="whitespace-pre-wrap">{lead.interest ?? "—"}</div>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Expected value</span>
                <span>{lead.value === null ? "—" : taka(lead.value)}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Next follow-up</span>
                <FollowUpText lead={lead} />
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last contact</span>
                <span>{lead.lastContactAt ? whenText(lead.lastContactAt) : "—"}</span>
              </div>
              <div className="space-y-1">
                <label htmlFor="owner" className="text-xs text-muted-foreground">
                  Followed by
                </label>
                <select
                  id="owner"
                  className={SELECT}
                  value={lead.owner?.id ?? ""}
                  disabled={!edit}
                  onChange={(e) => void run(update({ id: lead.id, ownerId: e.target.value || null }).unwrap(), "Saved")}
                >
                  <option value="">No one</option>
                  {owners.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>
              {lead.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {lead.tags.map((t) => (
                    <Link key={t} href={`/customers/leads?tag=${encodeURIComponent(t)}`} className="rounded bg-slate-100 px-2 py-0.5 text-xs dark:bg-slate-800">
                      {t}
                    </Link>
                  ))}
                </div>
              )}
              {lead.customer && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Customer</span>
                  <Link href={`/customers/${lead.customer.id}`} className="text-primary hover:underline">
                    {lead.customer.name} ({lead.customer.orderCount} orders)
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <LeadDialog open={editing} onOpenChange={setEditing} lead={lead} />

      <Dialog open={losing} onOpenChange={setLosing}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Mark {lead.name} as lost?</DialogTitle>
            <DialogDescription>Say why, so you can see later what loses sales. You can reopen it.</DialogDescription>
          </DialogHeader>
          <Input aria-label="Why it was lost" placeholder="e.g. Too expensive, bought elsewhere, no reply" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setLosing(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={moving || reason.trim().length < 2}
              onClick={async () => {
                if (await run(setStatus({ id: lead.id, status: "lost", reason: reason.trim() }).unwrap(), "Marked as lost")) {
                  setLosing(false);
                  setReason("");
                }
              }}
            >
              Mark as lost
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
