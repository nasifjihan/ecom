"use client";

/** Starts a background export and says where to find it. */
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { errorText } from "@/lib/features/content/content-api-slice";
import { useStartExportMutation, type ExportFilters, type JobKind } from "@/lib/features/jobs/jobs-api-slice";

export function useExportJob() {
  const [start, { isLoading }] = useStartExportMutation();
  const router = useRouter();
  const run = async (kind: Exclude<JobKind, "import_products">, format: "csv" | "xlsx", filters?: ExportFilters) => {
    try {
      const job = await start({ kind, format, filters }).unwrap();
      toast.success(`${job.label} started`, {
        description: "It runs in the background. We'll tell you in the bell when the file is ready.",
        action: { label: "View jobs", onClick: () => router.push("/settings/jobs") },
      });
    } catch (err) {
      toast.error(errorText(err));
    }
  };
  return { run, starting: isLoading };
}
