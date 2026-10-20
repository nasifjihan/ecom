"use client";

/**
 * Import & export jobs: big exports and product imports that run in the background, with their
 * progress, result and file. Only the kinds you're allowed to run are listed. Files are kept 7 days.
 */
import Link from "next/link";
import { toast } from "sonner";
import { AlertTriangle, ArrowDownUp, CheckCircle2, Download, Loader2 } from "lucide-react";
import { openFile } from "@ecom/api-client";
import { Badge, Button, Card, CardContent, Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui";
import { EmptyState, PageTitle } from "@/components/content/shared";
import { errorText } from "@/lib/features/content/content-api-slice";
import { useDataJobFileMutation, useDataJobsQuery, type DataJob } from "@/lib/features/jobs/jobs-api-slice";

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }) : "—";

function Status({ job }: { job: DataJob }) {
  if (job.status === "done") return <Badge variant="success">Done</Badge>;
  if (job.status === "failed") return <Badge variant="destructive">Failed</Badge>;
  if (job.status === "queued") return <Badge variant="secondary">Waiting</Badge>;
  return (
    <div className="flex min-w-[120px] items-center gap-2" role="progressbar" aria-valuenow={job.progress} aria-valuemin={0} aria-valuemax={100} aria-label={`${job.label} progress`}>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
        <div className="h-full bg-blue-600 transition-all" style={{ width: `${job.progress}%` }} />
      </div>
      <span className="text-xs tabular-nums text-slate-500">{job.progress}%</span>
    </div>
  );
}

function Outcome({ job }: { job: DataJob }) {
  if (job.status === "failed") return <span className="text-sm text-red-700 dark:text-red-400">{job.error}</span>;
  if (job.status !== "done") return <span className="text-sm text-slate-400">—</span>;
  if (job.kind === "import_products" && job.result) {
    const r = job.result;
    return (
      <div className="text-sm">
        <span className="flex items-center gap-1">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> {r.created} created, {r.updated} updated
        </span>
        {r.failedCount > 0 && (
          <details className="mt-1">
            <summary className="flex cursor-pointer items-center gap-1 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-3.5 w-3.5" /> {r.failedCount} skipped
            </summary>
            <ul className="mt-1 max-h-40 list-disc overflow-y-auto pl-5 text-xs text-slate-600 dark:text-slate-400">
              {r.failed.map((f) => (
                <li key={f.sku || f.rows.join()}>
                  <span className="font-mono">{f.sku || "(no SKU)"}</span>: {f.message}
                </li>
              ))}
              {r.failedCount > r.failed.length && <li>…and {r.failedCount - r.failed.length} more</li>}
            </ul>
          </details>
        )}
      </div>
    );
  }
  return <span className="text-sm">{job.rows ?? 0} rows</span>;
}

export default function DataJobsPage() {
  const { data, isLoading } = useDataJobsQuery();
  const active = (data ?? []).some((j) => j.status === "queued" || j.status === "running");
  // Refresh while something is still running.
  useDataJobsQuery(undefined, { pollingInterval: active ? 2000 : 0, skip: !active });
  const [loadFile] = useDataJobFileMutation();

  const download = (job: DataJob) =>
    openFile(() => loadFile(job.id).unwrap(), { filename: job.filename ?? "export", mode: "download" }).catch((err: unknown) => toast.error(errorText(err, "Couldn't download the file")));

  return (
    <div className="space-y-5">
      <PageTitle
        icon={ArrowDownUp}
        title="Import & export jobs"
        description="Big exports and product imports run in the background, so you can keep working. Files are kept for 7 days."
      />
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <Skeleton className="m-6 h-40" />
          ) : !data?.length ? (
            <EmptyState
              icon={ArrowDownUp}
              title="No jobs yet"
              text="Exports of orders, customers and big catalogs, and product imports, show up here while they run and when they're done."
              action={
                <Button asChild variant="outline" size="sm">
                  <Link href="/orders">Go to orders</Link>
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Result</TableHead>
                    <TableHead className="w-32 text-right">File</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((j) => (
                    <TableRow key={j.id}>
                      <TableCell>
                        <p className="font-medium">{j.label}</p>
                        <p className="text-xs text-slate-500">
                          by {j.createdBy}
                          {j.inputName ? ` · ${j.inputName}` : ""}
                        </p>
                      </TableCell>
                      <TableCell className="text-sm">{when(j.createdAt)}</TableCell>
                      <TableCell>
                        <Status job={j} />
                      </TableCell>
                      <TableCell>
                        <Outcome job={j} />
                      </TableCell>
                      <TableCell className="text-right">
                        {j.hasFile ? (
                          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void download(j)} title={j.expiresAt ? `Kept until ${when(j.expiresAt)}` : undefined}>
                            <Download className="h-4 w-4" /> {j.filename?.split(".").pop()?.toUpperCase()}
                          </Button>
                        ) : j.status === "running" || j.status === "queued" ? (
                          <Loader2 className="ml-auto h-4 w-4 animate-spin text-slate-400" aria-label="Working" />
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
