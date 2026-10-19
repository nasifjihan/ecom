"use client";

/** A new scheduled report email. */
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui";
import { EMPTY_SCHEDULE, ScheduleForm } from "@/components/reports/schedule-form";
import { errorText } from "@/lib/features/content/content-api-slice";
import { useCreateReportScheduleMutation, type ScheduleInput } from "@/lib/features/reports/report-schedules-api-slice";

export default function NewReportSchedulePage() {
  const router = useRouter();
  const [value, setValue] = useState<ScheduleInput>(EMPTY_SCHEDULE);
  const [create, { isLoading }] = useCreateReportScheduleMutation();

  const onSave = async () => {
    try {
      const s = await create(value).unwrap();
      toast.success(`Saved. First email: ${s.timing.toLowerCase()}.`);
      router.push(`/reports/schedules/${s.id}`);
    } catch (e) {
      toast.error(errorText(e));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Link href="/reports/schedules" className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400">
          <ArrowLeft className="h-4 w-4" /> Scheduled emails
        </Link>
        <Button onClick={onSave} disabled={isLoading}>
          {isLoading ? "Saving…" : "Save schedule"}
        </Button>
      </div>
      <ScheduleForm value={value} onChange={setValue} />
    </div>
  );
}
