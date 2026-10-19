"use client";

/**
 * One scheduled report: its settings (editable with reports.edit), "Send now", "Preview PDF",
 * and its latest sendings with the PDF that went out.
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, FileDown, Eye, Send, Trash2 } from "lucide-react";
import { openFile } from "@ecom/api-client";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui";
import { ScheduleForm } from "@/components/reports/schedule-form";
import { fullDay } from "@/components/reports/shared";
import { errorText } from "@/lib/features/content/content-api-slice";
import { useCan } from "@/lib/permissions";
import {
  useDeleteReportScheduleMutation,
  useReportRunPdfMutation,
  useReportScheduleQuery,
  useReportSchedulePreviewMutation,
  useSendReportScheduleNowMutation,
  useUpdateReportScheduleMutation,
  whenText,
  type ScheduleDetail,
  type ScheduleInput,
} from "@/lib/features/reports/report-schedules-api-slice";

const inputOf = (s: ScheduleDetail): ScheduleInput => ({
  name: s.name,
  reports: s.reports,
  frequency: s.frequency,
  weekday: s.weekday,
  monthDay: s.monthDay,
  sendHour: s.sendHour,
  period: s.period,
  basis: s.basis,
  storefrontId: s.storefrontId,
  staffIds: s.staffIds,
  emails: s.emails,
  enabled: s.enabled,
});

export default function ReportSchedulePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, isLoading, error } = useReportScheduleQuery(id);
  const [update, { isLoading: saving }] = useUpdateReportScheduleMutation();
  const [remove] = useDeleteReportScheduleMutation();
  const [sendNow, { isLoading: sending }] = useSendReportScheduleNowMutation();
  const [preview, { isLoading: previewing }] = useReportSchedulePreviewMutation();
  const [runPdf] = useReportRunPdfMutation();
  const { can } = useCan();
  const edit = can("reports.edit");
  const [value, setValue] = useState<ScheduleInput | null>(null);

  useEffect(() => {
    if (data) setValue(inputOf(data));
  }, [data]);
  const dirty = useMemo(() => !!data && !!value && JSON.stringify(inputOf(data)) !== JSON.stringify(value), [data, value]);

  if (isLoading) return <Skeleton className="h-96" />;
  if (error || !data || !value) return <p className="text-sm text-slate-500">This schedule wasn&apos;t found.</p>;

  const onSave = async () => {
    try {
      await update({ id, ...value }).unwrap();
      toast.success("Saved");
    } catch (e) {
      toast.error(errorText(e));
    }
  };
  const onSendNow = async () => {
    try {
      const s = await sendNow(id).unwrap();
      toast.success(`Sent to ${s.runs[0]?.recipients.length ?? 0} ${s.runs[0]?.recipients.length === 1 ? "person" : "people"}`);
    } catch (e) {
      toast.error(errorText(e));
    }
  };
  const onPreview = async () => {
    try {
      await openFile(() => preview(id).unwrap(), { filename: `${data.name}.pdf`, mode: "open" });
    } catch (e) {
      toast.error(errorText(e));
    }
  };
  const onDelete = async () => {
    if (!window.confirm(`Delete "${data.name}"? Its past PDFs go too.`)) return;
    try {
      await remove(id).unwrap();
      toast.success("Deleted");
      router.push("/reports/schedules");
    } catch (e) {
      toast.error(errorText(e));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/reports/schedules" className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400">
          <ArrowLeft className="h-4 w-4" /> Scheduled emails
        </Link>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={onPreview} disabled={previewing}>
            <Eye className="h-4 w-4" /> {previewing ? "Making PDF…" : "Preview PDF"}
          </Button>
          {edit && (
            <>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={onSendNow} disabled={sending || dirty} title={dirty ? "Save your changes first" : undefined}>
                <Send className="h-4 w-4" /> {sending ? "Sending…" : "Send now"}
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5 text-red-700 hover:text-red-800" onClick={onDelete}>
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
              <Button size="sm" onClick={onSave} disabled={!dirty || saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="rounded-lg border bg-white p-4 text-sm dark:bg-slate-900">
        <p>
          <span className="font-medium">{data.timing}</span>, covering {data.periodLabel.toLowerCase()}.{" "}
          {data.enabled ? <>Next: {whenText(data.nextRunAt)}.</> : <span className="text-slate-500">Switched off.</span>}
        </p>
        {data.lastStatus === "failed" && (
          <p className="mt-2 flex items-start gap-1.5 text-red-700 dark:text-red-400">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            Last sending failed{data.failures > 1 ? ` (${data.failures} in a row)` : ""}: {data.lastError}
            {!data.enabled && data.failures >= 3 ? " It was switched off after 3 failures; fix it and switch it back on." : ""}
          </p>
        )}
      </div>

      <ScheduleForm value={value} onChange={setValue} disabled={!edit} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Latest sendings</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {!data.runs.length ? (
            <p className="px-6 pb-6 text-sm text-slate-500">Nothing sent yet. Use &quot;Send now&quot; to try it.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sent</TableHead>
                    <TableHead>Covers</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead>Result</TableHead>
                    <TableHead className="w-24">PDF</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.runs.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-sm">
                        {whenText(r.createdAt)}
                        {r.trigger === "send_now" && <span className="ml-1 text-xs text-slate-500">(sent by hand)</span>}
                      </TableCell>
                      <TableCell className="text-sm">{r.from === r.to ? fullDay(r.from) : `${fullDay(r.from)} – ${fullDay(r.to)}`}</TableCell>
                      <TableCell className="max-w-[260px] truncate text-sm" title={r.recipients.join(", ")}>
                        {r.recipients.join(", ") || "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {r.status === "sent" ? <Badge variant="secondary">Sent</Badge> : <span className="text-red-700 dark:text-red-400">{r.error}</span>}
                      </TableCell>
                      <TableCell>
                        {r.hasPdf && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1"
                            onClick={() =>
                              void openFile(() => runPdf({ id, runId: r.id }).unwrap(), { filename: `${data.name}-${r.from}.pdf`, mode: "download" }).catch((e: unknown) => toast.error(errorText(e)))
                            }
                          >
                            <FileDown className="h-4 w-4" /> PDF
                          </Button>
                        )}
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
