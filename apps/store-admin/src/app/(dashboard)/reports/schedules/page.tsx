"use client";

/** Scheduled report emails: each schedule, when it goes next, how the last one went, and an on/off switch. */
import Link from "next/link";
import { toast } from "sonner";
import { AlertTriangle, CalendarClock, Plus } from "lucide-react";
import { Badge, Button, Card, CardContent, Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui";
import { EmptyState, Toggle } from "@/components/content/shared";
import { errorText } from "@/lib/features/content/content-api-slice";
import { useCan } from "@/lib/permissions";
import { useReportSchedulesQuery, useSetReportScheduleEnabledMutation, whenText } from "@/lib/features/reports/report-schedules-api-slice";

export default function ReportSchedulesPage() {
  const { data, isLoading } = useReportSchedulesQuery();
  const [setEnabled] = useSetReportScheduleEnabledMutation();
  const { can } = useCan();
  const edit = can("reports.edit");

  const onToggle = async (id: string, enabled: boolean) => {
    try {
      await setEnabled({ id, enabled }).unwrap();
      toast.success(enabled ? "Switched on" : "Switched off");
    } catch (e) {
      toast.error(errorText(e));
    }
  };

  if (isLoading) return <Skeleton className="h-64" />;
  const rows = data ?? [];

  return (
    <div className="space-y-4">
      {edit && rows.length > 0 && (
        <div className="flex justify-end">
          <Button asChild size="sm" className="gap-1.5">
            <Link href="/reports/schedules/new">
              <Plus className="h-4 w-4" /> New schedule
            </Link>
          </Button>
        </div>
      )}
      <Card>
        <CardContent className="p-0">
          {!rows.length ? (
            <EmptyState
              icon={CalendarClock}
              title="No scheduled reports yet"
              text="Get last week's sales in your inbox every Monday, or last month's figures for your accountant on the 1st."
              action={
                edit ? (
                  <Button asChild size="sm" className="gap-1.5">
                    <Link href="/reports/schedules/new">
                      <Plus className="h-4 w-4" /> New schedule
                    </Link>
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>When</TableHead>
                    <TableHead>Covers</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead>Next</TableHead>
                    <TableHead>Last</TableHead>
                    <TableHead className="w-16">On</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((s) => {
                    const people = s.staff.length + s.emails.length;
                    return (
                      <TableRow key={s.id}>
                        <TableCell>
                          <Link href={`/reports/schedules/${s.id}`} className="font-medium hover:underline">
                            {s.name}
                          </Link>
                          <p className="text-xs text-slate-500">
                            {s.reportLabels.join(", ")}
                            {s.storefrontName ? ` · ${s.storefrontName}` : ""}
                          </p>
                        </TableCell>
                        <TableCell className="text-sm">{s.timing}</TableCell>
                        <TableCell className="text-sm">{s.periodLabel}</TableCell>
                        <TableCell className="text-sm" title={[...s.staff.map((p) => p.name), ...s.emails].join(", ")}>
                          {people} {people === 1 ? "person" : "people"}
                        </TableCell>
                        <TableCell className="text-sm">{s.enabled ? whenText(s.nextRunAt) : "—"}</TableCell>
                        <TableCell className="text-sm">
                          {s.lastStatus === "failed" ? (
                            <span className="flex items-center gap-1 text-red-700 dark:text-red-400" title={s.lastError ?? undefined}>
                              <AlertTriangle className="h-3.5 w-3.5" /> Failed
                            </span>
                          ) : s.lastStatus === "sent" ? (
                            <Badge variant="secondary">Sent {whenText(s.lastRunAt)}</Badge>
                          ) : (
                            <span className="text-slate-400">Not yet</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {edit ? (
                            <Toggle checked={s.enabled} onChange={(v) => void onToggle(s.id, v)} ariaLabel={`${s.name} on`} />
                          ) : s.enabled ? (
                            "On"
                          ) : (
                            "Off"
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
