"use client";

/** Small pieces shared by the leads list and a lead's page. */
import { cn } from "@/components/ui";
import { LEAD_STATUS_LABELS, type Lead, type LeadStatus } from "@/lib/features/customers/leads-api-slice";

const STATUS_STYLE: Record<LeadStatus, string> = {
  new: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
  contacted: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200",
  interested: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  won: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  lost: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  return <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", STATUS_STYLE[status])}>{LEAD_STATUS_LABELS[status]}</span>;
}

export const whenText = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });

/** The next follow-up, red when overdue and amber when it's today. */
export function FollowUpText({ lead }: { lead: Pick<Lead, "nextFollowUpAt" | "followUp" | "status"> }) {
  if (lead.status === "won" || lead.status === "lost") return <span className="text-sm text-muted-foreground">—</span>;
  if (!lead.nextFollowUpAt) return <span className="text-sm text-muted-foreground">Not set</span>;
  return (
    <span className={cn("text-sm", lead.followUp === "overdue" && "font-medium text-red-700", lead.followUp === "today" && "font-medium text-amber-700")}>
      {lead.followUp === "overdue" ? "Overdue · " : lead.followUp === "today" ? "Today · " : ""}
      {whenText(lead.nextFollowUpAt)}
    </span>
  );
}
