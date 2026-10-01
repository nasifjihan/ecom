"use client";

/**
 * CRM leads: people who asked on Facebook, Instagram, WhatsApp or by phone and haven't ordered.
 * Open leads are sorted by their next follow-up, so what's due comes first.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlarmClock, CalendarClock, Plus, Target } from "lucide-react";
import { Button, Card, CardContent, Input, Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, cn } from "@/components/ui";
import { EmptyState, PageTitle } from "@/components/content/shared";
import { Pager, SELECT } from "@/components/purchasing/shared";
import { taka } from "@/components/orders/order-pickers";
import { LeadDialog } from "@/components/customers/lead-dialog";
import { FollowUpText, LeadStatusBadge } from "@/components/customers/lead-bits";
import { useCan } from "@/lib/permissions";
import {
  LEAD_CHANNEL_LABELS,
  useLeadOwnersQuery,
  useLeadTagsQuery,
  useLeadsQuery,
  type LeadQuery,
  type LeadStatus,
} from "@/lib/features/customers/leads-api-slice";

type Tab = "open" | LeadStatus | "all";
const TABS: { key: Tab; label: string }[] = [
  { key: "open", label: "Open" },
  { key: "new", label: "New" },
  { key: "contacted", label: "Contacted" },
  { key: "interested", label: "Interested" },
  { key: "won", label: "Won" },
  { key: "lost", label: "Lost" },
  { key: "all", label: "All" },
];

export default function LeadsPage() {
  const router = useRouter();
  const { can } = useCan();
  const [tab, setTab] = useState<Tab>("open");
  const [due, setDue] = useState<"" | "overdue" | "today">("");
  const [owner, setOwner] = useState("");
  const [tag, setTag] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);
  useEffect(() => setPage(1), [tab, due, owner, tag, search]);
  // Opened from a tag on a lead's page (?tag=eid).
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tag");
    if (t) {
      setTag(t);
      setTab("all");
    }
  }, []);

  const q: LeadQuery = {
    status: tab === "all" ? undefined : tab,
    due: due || undefined,
    owner: owner || undefined,
    tag: tag || undefined,
    search: search.trim() || undefined,
    page,
  };
  const { data, isFetching } = useLeadsQuery(q);
  const { data: owners = [] } = useLeadOwnersQuery();
  const { data: tags = [] } = useLeadTagsQuery();
  const counts = data?.counts;
  const countOf = (t: Tab) => {
    if (!counts) return null;
    if (t === "open") return counts.new + counts.contacted + counts.interested;
    if (t === "all") return Object.values(counts).reduce((a, b) => a + b, 0);
    return counts[t];
  };

  return (
    <div className="space-y-6">
      <PageTitle
        icon={Target}
        title="Leads"
        description="People who asked on Facebook, Instagram, WhatsApp or by phone but haven't ordered yet. Note each call, set the next follow-up, and make the order when they're ready."
        actions={
          can("leads.create") ? (
            <Button onClick={() => setAdding(true)}>
              <Plus className="mr-1 h-4 w-4" /> Add lead
            </Button>
          ) : null
        }
      />

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => setDue(due === "overdue" ? "" : "overdue")}
          className={cn("flex items-center gap-2 rounded-lg border px-4 py-2 text-sm", due === "overdue" ? "border-red-500 bg-red-50 text-red-800" : "bg-background")}
          aria-pressed={due === "overdue"}
        >
          <AlarmClock className="h-4 w-4 text-red-600" /> Overdue follow-ups <strong>{data?.overdue ?? "–"}</strong>
        </button>
        <button
          type="button"
          onClick={() => setDue(due === "today" ? "" : "today")}
          className={cn("flex items-center gap-2 rounded-lg border px-4 py-2 text-sm", due === "today" ? "border-amber-500 bg-amber-50 text-amber-900" : "bg-background")}
          aria-pressed={due === "today"}
        >
          <CalendarClock className="h-4 w-4 text-amber-600" /> Due today <strong>{data?.today ?? "–"}</strong>
        </button>
      </div>

      <div className="flex flex-wrap gap-1 border-b" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn("-mb-px border-b-2 px-3 py-2 text-sm", tab === t.key ? "border-primary font-medium text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}
          >
            {t.label} <span className="text-xs text-muted-foreground">{countOf(t.key) ?? ""}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <select aria-label="Followed by" className={cn(SELECT, "w-48")} value={owner} onChange={(e) => setOwner(e.target.value)}>
          <option value="">Everyone&apos;s leads</option>
          <option value="me">My leads</option>
          <option value="none">Not given to anyone</option>
          {owners.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        <select aria-label="Tag" className={cn(SELECT, "w-40")} value={tag} onChange={(e) => setTag(e.target.value)}>
          <option value="">Any tag</option>
          {tags.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <Input aria-label="Search" placeholder="Name, phone, @name or what they want" className="w-72" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0">
          {!data && isFetching ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : !data?.items.length ? (
            <EmptyState
              icon={Target}
              title={due || owner || tag || search ? "No leads match" : "No leads here"}
              text="Add the people who comment, message or call asking about your products, so nobody is forgotten."
              action={
                can("leads.create") ? (
                  <Button onClick={() => setAdding(true)}>
                    <Plus className="mr-1 h-4 w-4" /> Add lead
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lead</TableHead>
                    <TableHead>Wants</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Next follow-up</TableHead>
                    <TableHead>Followed by</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((l) => (
                    <TableRow key={l.id} className="cursor-pointer" onClick={() => router.push(`/customers/leads/${l.id}`)}>
                      <TableCell>
                        <Link href={`/customers/leads/${l.id}`} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
                          {l.name}
                        </Link>
                        <div className="text-xs text-muted-foreground">
                          {LEAD_CHANNEL_LABELS[l.channel] ?? l.channel}
                          {l.handle ? ` · ${l.handle}` : ""}
                          {l.phone ? ` · ${l.phone}` : ""}
                        </div>
                        {l.tags.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {l.tags.map((t) => (
                              <span key={t} className="rounded bg-slate-100 px-1.5 text-[11px] text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <div className="line-clamp-2 text-sm">{l.interest ?? "—"}</div>
                        {l.value !== null && <div className="text-xs text-muted-foreground">about {taka(l.value)}</div>}
                      </TableCell>
                      <TableCell>
                        <LeadStatusBadge status={l.status} />
                        {l.status === "won" && l.orderNumber && <div className="text-xs text-muted-foreground">#{l.orderNumber}</div>}
                      </TableCell>
                      <TableCell>
                        <FollowUpText lead={l} />
                      </TableCell>
                      <TableCell className="text-sm">{l.owner?.name ?? <span className="text-muted-foreground">No one</span>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      {data && <Pager page={page} totalPages={data.totalPages} onPage={setPage} />}

      <LeadDialog open={adding} onOpenChange={setAdding} onSaved={(l) => router.push(`/customers/leads/${l.id}`)} />
    </div>
  );
}
