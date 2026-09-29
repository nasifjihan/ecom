"use client";

/**
 * Redirects: old web addresses sent to new ones (so old links, bookmarks and search results keep
 * working), and the broken links visitors hit, each one a click away from a redirect.
 * Changing a product's, category's, page's or blog post's address adds a redirect on its own.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CornerUpRight, ExternalLink, Pencil, Plus, Search, Trash2, Upload } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
  Textarea,
  cn,
} from "@/components/ui";
import { EmptyState, Field, PageTitle, STOREFRONT_URL, Toggle } from "@/components/content/shared";
import { errorText } from "@/lib/features/content/content-api-slice";
import { useCan } from "@/lib/permissions";
import {
  useBrokenLinksQuery,
  useDeleteRedirectsMutation,
  useDismissBrokenMutation,
  useImportRedirectsMutation,
  useRedirectsQuery,
  useSaveRedirectMutation,
  type Redirect,
} from "@/lib/features/redirects/redirects-api-slice";

const when = (s: string | null) => (s ? new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");

interface Draft {
  id?: string;
  fromPath: string;
  toUrl: string;
  statusCode: 301 | 302;
  isActive: boolean;
  note: string;
}

function RedirectDialog({ draft, onClose }: { draft: Draft | null; onClose: () => void }) {
  const [f, setF] = useState<Draft | null>(draft);
  const [save, { isLoading }] = useSaveRedirectMutation();
  useEffect(() => setF(draft), [draft]);
  if (!f) return null;
  const submit = async () => {
    try {
      await save({ id: f.id, fromPath: f.fromPath, toUrl: f.toUrl, statusCode: f.statusCode, isActive: f.isActive, note: f.note.trim() || null }).unwrap();
      toast.success(f.id ? "Redirect saved" : "Redirect added");
      onClose();
    } catch (e) {
      toast.error(errorText(e));
    }
  };
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{f.id ? "Edit redirect" : "Add a redirect"}</DialogTitle>
          <DialogDescription>Visitors of the old address go straight to the new one.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label="Old address" htmlFor="r-from" hint="A path on your shop, like /summer-sale or /old-page.html">
            <Input id="r-from" value={f.fromPath} placeholder="/old-page" onChange={(e) => setF({ ...f, fromPath: e.target.value })} />
          </Field>
          <Field label="New address" htmlFor="r-to" hint="A path on your shop (/collections/eid) or a full web address (https://…)">
            <Input id="r-to" value={f.toUrl} placeholder="/new-page" onChange={(e) => setF({ ...f, toUrl: e.target.value })} />
          </Field>
          <Field label="Type" htmlFor="r-type">
            <Select id="r-type" value={String(f.statusCode)} onValueChange={(v) => setF({ ...f, statusCode: v === "302" ? 302 : 301 })}>
              <SelectItem value="301">Moved for good (301) — search engines move the old page's ranking</SelectItem>
              <SelectItem value="302">For now (302) — e.g. during a sale</SelectItem>
            </Select>
          </Field>
          <Field label="Note (optional)" htmlFor="r-note">
            <Input id="r-note" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
          </Field>
          <Toggle checked={f.isActive} onChange={(v) => setF({ ...f, isActive: v })} label="On" hint="Switch off to keep it without using it." />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={isLoading || !f.fromPath.trim() || !f.toUrl.trim()}>
            {f.id ? "Save" : "Add redirect"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [text, setText] = useState("");
  const [result, setResult] = useState<{ added: number; updated: number; errors: { line: number; message: string }[] } | null>(null);
  const [run, { isLoading }] = useImportRedirectsMutation();
  useEffect(() => {
    if (open) {
      setText("");
      setResult(null);
    }
  }, [open]);
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Paste redirects</DialogTitle>
          <DialogDescription>One per line: old address, new address, and optionally 302. Commas or tabs (copied from a spreadsheet) both work.</DialogDescription>
        </DialogHeader>
        <Textarea rows={10} className="font-mono text-sm" aria-label="Redirects to add" placeholder={"/old-shirt, /products/denim-shirt\n/eid, /collections/eid-2026, 302"} value={text} onChange={(e) => setText(e.target.value)} />
        {result && (
          <div className="space-y-1 text-sm">
            <p className="font-medium">
              {result.added} added, {result.updated} updated
            </p>
            {result.errors.length > 0 && (
              <ul className="max-h-32 overflow-auto rounded-md bg-red-50 p-2 text-red-800 dark:bg-red-950 dark:text-red-200">
                {result.errors.map((e) => (
                  <li key={e.line}>
                    Line {e.line}: {e.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button
            disabled={isLoading || !text.trim()}
            onClick={async () => {
              try {
                const r = await run(text).unwrap();
                setResult(r);
                if (!r.errors.length) toast.success(`${r.added} added, ${r.updated} updated`);
              } catch (e) {
                toast.error(errorText(e));
              }
            }}
          >
            Add these
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BrokenLinks({ onFix, canEdit }: { onFix: (path: string) => void; canEdit: boolean }) {
  const [page, setPage] = useState(1);
  const { data } = useBrokenLinksQuery({ page });
  const [dismiss] = useDismissBrokenMutation();
  if (!data) return <Skeleton className="h-40" />;
  if (!data.rows.length) {
    return <EmptyState icon={CornerUpRight} title="No broken links" text="When visitors open an address that doesn't exist, it shows up here so you can send them somewhere useful." />;
  }
  return (
    <div className="space-y-3">
      {canEdit && (
        <div className="flex justify-end">
          <Button size="sm" variant="ghost" onClick={() => confirm("Clear the whole list?") && dismiss("all")}>
            Clear list
          </Button>
        </div>
      )}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Address</TableHead>
              <TableHead className="text-right">Visits</TableHead>
              <TableHead>Last seen</TableHead>
              <TableHead>Came from</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.map((b) => (
              <TableRow key={b.id}>
                <TableCell className="font-mono text-sm">{b.path}</TableCell>
                <TableCell className="text-right tabular-nums">{b.hits}</TableCell>
                <TableCell className="whitespace-nowrap text-sm">{when(b.lastSeen)}</TableCell>
                <TableCell className="max-w-64 truncate text-xs text-slate-500" title={b.referrer ?? ""}>
                  {b.referrer ?? "—"}
                </TableCell>
                <TableCell className="whitespace-nowrap text-right">
                  {canEdit && (
                    <>
                      <Button size="sm" onClick={() => onFix(b.path)}>
                        Add redirect
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => dismiss([b.id])}>
                        Ignore
                      </Button>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {data.total > data.perPage && (
        <div className="flex justify-end gap-2 text-sm">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <Button size="sm" variant="outline" disabled={page * data.perPage >= data.total} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

export default function RedirectsPage() {
  const { can } = useCan();
  const canEdit = can("online_store.edit");
  const [tab, setTab] = useState<"redirects" | "broken">("redirects");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [importing, setImporting] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);
  const { data, isFetching } = useRedirectsQuery({ search: q || undefined, page });
  const [remove] = useDeleteRedirectsMutation();
  const blank: Draft = { fromPath: "", toUrl: "", statusCode: 301, isActive: true, note: "" };
  const edit = (r: Redirect): Draft => ({ id: r.id, fromPath: r.fromPath, toUrl: r.toUrl, statusCode: r.statusCode, isActive: r.isActive, note: r.note ?? "" });

  return (
    <div className="space-y-6">
      <PageTitle
        icon={CornerUpRight}
        title="Redirects"
        description="Send visitors of old addresses to new ones, so old links, bookmarks and Google results keep working. Changing a product's, category's, page's or blog post's address adds one automatically."
        actions={
          canEdit ? (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setImporting(true)}>
                <Upload className="mr-2 h-4 w-4" /> Paste a list
              </Button>
              <Button onClick={() => setDraft(blank)}>
                <Plus className="mr-2 h-4 w-4" /> Add redirect
              </Button>
            </div>
          ) : undefined
        }
      />
      <div className="flex gap-1.5" role="tablist" aria-label="Show">
        {(
          [
            ["redirects", `Redirects${data ? ` ${data.total}` : ""}`],
            ["broken", `Broken links${data ? ` ${data.brokenLinks}` : ""}`],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={cn(
              "rounded-full border px-3 py-1 text-sm transition-colors",
              tab === k ? "border-primary bg-primary text-primary-foreground" : "hover:bg-slate-100 dark:hover:bg-slate-800",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="space-y-4 p-4">
          {tab === "broken" ? (
            <BrokenLinks canEdit={canEdit} onFix={(path) => setDraft({ ...blank, fromPath: path })} />
          ) : (
            <>
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input className="pl-9" placeholder="Search addresses" aria-label="Search redirects" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              {!data ? (
                <Skeleton className="h-40" />
              ) : data.rows.length === 0 ? (
                <EmptyState icon={CornerUpRight} title="No redirects yet" text="Add one when you rename a page or move a collection, or paste a list from your old website." />
              ) : (
                <div className={cn("overflow-x-auto", isFetching && "opacity-70")}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Old address</TableHead>
                        <TableHead>New address</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Used</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.rows.map((r) => (
                        <TableRow key={r.id} className={cn(!r.isActive && "opacity-60")}>
                          <TableCell>
                            <a href={`${STOREFRONT_URL}${r.fromPath}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-sm hover:underline">
                              {r.fromPath} <ExternalLink className="h-3 w-3" />
                            </a>
                            {r.note && <p className="text-xs text-slate-500">{r.note}</p>}
                          </TableCell>
                          <TableCell className="max-w-80 break-all font-mono text-sm">{r.toUrl}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              <Badge variant="outline">{r.statusCode === 301 ? "301 moved" : "302 for now"}</Badge>
                              {r.auto && <Badge variant="secondary">Automatic</Badge>}
                              {!r.isActive && <Badge variant="outline">Off</Badge>}
                            </div>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {r.hits}
                            <p className="text-xs text-slate-500">{r.lastHitAt ? `last ${when(r.lastHitAt)}` : "not yet"}</p>
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-right">
                            {canEdit && (
                              <>
                                <Button size="sm" variant="ghost" aria-label={`Edit redirect from ${r.fromPath}`} onClick={() => setDraft(edit(r))}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  aria-label={`Delete redirect from ${r.fromPath}`}
                                  onClick={async () => {
                                    if (!confirm(`Delete the redirect from ${r.fromPath}?`)) return;
                                    await remove([r.id]).unwrap().catch((e) => toast.error(errorText(e)));
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 text-rose-600" />
                                </Button>
                              </>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              {data && data.total > data.perPage && (
                <div className="flex justify-end gap-2 text-sm">
                  <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    Previous
                  </Button>
                  <Button size="sm" variant="outline" disabled={page * data.perPage >= data.total} onClick={() => setPage((p) => p + 1)}>
                    Next
                  </Button>
                </div>
              )}
              <p className="text-xs text-slate-500">The shop picks up changes within a minute.</p>
            </>
          )}
        </CardContent>
      </Card>
      <RedirectDialog draft={draft} onClose={() => setDraft(null)} />
      <ImportDialog open={importing} onClose={() => setImporting(false)} />
    </div>
  );
}
