"use client";

import { Fragment, useState } from "react";
import { Activity, ChevronDown, ChevronRight } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
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
} from "@/components/ui";
import { useGetAuditLogsQuery, type AuditEntry } from "@/lib/features/team/team-api-slice";

const SELECT = "h-9 rounded-md border border-input bg-background px-2 text-sm";
const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });

const VERBS: Record<string, string> = { create: "created", update: "updated", delete: "deleted" };
/** "orders.status" -> "Orders · status", "marketing.coupons.create" -> "Coupons · created". */
function describe(e: AuditEntry) {
  const parts = e.action.split(".").filter((p) => !["marketing", "content", "shipping"].includes(p) || p === e.objectType);
  const last = parts[parts.length - 1] ?? "";
  const words = (VERBS[last] ? [...parts.slice(0, -1), VERBS[last]] : parts).map((w) => w.replace(/_/g, " "));
  const [first, ...rest] = words;
  return [first ? first.charAt(0).toUpperCase() + first.slice(1) : "", rest.join(" ")].filter(Boolean).join(" · ");
}

export default function ActivityPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [objectType, setObjectType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const { data, isLoading, isFetching } = useGetAuditLogsQuery({
    page,
    perPage: 25,
    search: search.trim() || undefined,
    objectType: objectType || undefined,
    from: from || undefined,
    to: to ? `${to}T23:59:59` : undefined,
  });
  const items = data?.items ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Activity className="h-5 w-5" /> Activity log
        </CardTitle>
        <p className="text-sm text-slate-500">Every change made in this admin: who, what, when and from where. Passwords and keys are never stored.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Input className="h-9 max-w-xs" placeholder="Search action or record id" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} aria-label="Search activity" />
          <select className={SELECT} value={objectType} onChange={(e) => { setObjectType(e.target.value); setPage(1); }} aria-label="Type">
            <option value="">Everything</option>
            {(data?.objectTypes ?? []).map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1 text-sm text-slate-500">
            From <Input type="date" className="h-9 w-40" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
          </label>
          <label className="flex items-center gap-1 text-sm text-slate-500">
            To <Input type="date" className="h-9 w-40" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
          </label>
        </div>

        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : items.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500">Nothing recorded for these filters yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>When</TableHead>
                  <TableHead>Who</TableHead>
                  <TableHead>What</TableHead>
                  <TableHead>Record</TableHead>
                  <TableHead>IP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className={isFetching ? "opacity-60" : undefined}>
                {items.map((e) => (
                  <Fragment key={e.id}>
                    <TableRow className="cursor-pointer" onClick={() => setOpen(open === e.id ? null : e.id)}>
                      <TableCell>{open === e.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm">{when(e.createdAt)}</TableCell>
                      <TableCell className="text-sm">{e.admin?.name ?? e.changes?.by ?? "—"}</TableCell>
                      <TableCell className="text-sm font-medium">{describe(e)}</TableCell>
                      <TableCell className="font-mono text-xs">{e.objectId ? `${e.objectType} #${e.objectId}` : e.objectType}</TableCell>
                      <TableCell className="font-mono text-xs text-slate-500">{e.ipAddress ?? "—"}</TableCell>
                    </TableRow>
                    {open === e.id && (
                      <TableRow>
                        <TableCell />
                        <TableCell colSpan={5}>
                          <p className="mb-1 font-mono text-xs text-slate-500">
                            {e.changes?.method} {e.changes?.path}
                          </p>
                          <pre className="max-h-72 overflow-auto rounded-md bg-slate-50 p-3 text-xs dark:bg-slate-900">
                            {JSON.stringify(e.changes?.body ?? null, null, 2)}
                          </pre>
                          {e.userAgent && <p className="mt-1 truncate text-xs text-slate-400">{e.userAgent}</p>}
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">
              {data.total} entries · page {page} of {data.totalPages}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                Newer
              </Button>
              <Button variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage(page + 1)}>
                Older
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
