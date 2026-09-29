"use client";

/**
 * Festival calendar: the year's festivals and shopping days on a timeline (sale window light,
 * festival days solid), then a table with each one's status, checklist and linked campaigns.
 */
import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { CalendarHeart, ChevronLeft, ChevronRight, ListChecks, Plus, Sparkles } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle, Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, cn } from "@/components/ui";
import { EmptyState, PageTitle } from "@/components/content/shared";
import { errorText } from "@/lib/features/content/content-api-slice";
import { useCan } from "@/lib/permissions";
import {
  PHASE,
  dayRange,
  inDays,
  useAddFestivalPresetsMutation,
  useFestivalsQuery,
  type FestivalSummary,
} from "@/lib/features/festivals/festivals-api-slice";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Day of the year (0-based) and the year's length. */
function dayOfYear(day: string, year: number) {
  const t = Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)));
  return (t - Date.UTC(year, 0, 1)) / 86_400_000;
}
const yearLength = (year: number) => (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / 86_400_000;

function Timeline({ year, today, festivals }: { year: number; today: string; festivals: FestivalSummary[] }) {
  const len = yearLength(year);
  const pct = (day: string, end = false) => (Math.min(len, Math.max(0, dayOfYear(day, year) + (end ? 1 : 0))) / len) * 100;
  const todayAt = today.startsWith(String(year)) ? pct(today) : null;
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[760px]">
        <div className="grid grid-cols-[180px_1fr] text-xs text-slate-500 dark:text-slate-400">
          <span />
          <div className="grid grid-cols-12 border-b pb-1 dark:border-slate-700">
            {MONTHS.map((m) => (
              <span key={m} className="pl-1">
                {m}
              </span>
            ))}
          </div>
        </div>
        <ul>
          {festivals.map((f) => (
            <li key={f.id} className="grid grid-cols-[180px_1fr] items-center">
              <Link href={`/marketing/festivals/${f.id}`} className="truncate py-1.5 pr-3 text-sm hover:underline" title={f.name}>
                {f.name}
              </Link>
              <div className="relative h-7">
                <div className="absolute inset-0 grid grid-cols-12" aria-hidden>
                  {MONTHS.map((m) => (
                    <span key={m} className="border-l border-slate-100 dark:border-slate-800" />
                  ))}
                </div>
                <Link
                  href={`/marketing/festivals/${f.id}`}
                  title={`Sale ${dayRange(f.saleFrom, f.saleTo)} · festival ${dayRange(f.startsOn, f.endsOn)}`}
                  aria-label={`${f.name}: sale ${dayRange(f.saleFrom, f.saleTo)}, festival ${dayRange(f.startsOn, f.endsOn)}`}
                  className={cn(
                    "absolute top-1.5 h-4 rounded-sm",
                    f.phase === "over" ? "bg-slate-200 dark:bg-slate-700" : "bg-violet-200 dark:bg-violet-500/30",
                  )}
                  style={{ left: `${pct(f.saleFrom)}%`, width: `max(4px, ${pct(f.saleTo, true) - pct(f.saleFrom)}%)` }}
                />
                {todayAt !== null && <span aria-hidden className="pointer-events-none absolute inset-y-0 z-10 w-px bg-rose-500" style={{ left: `${todayAt}%` }} />}
                <span
                  aria-hidden
                  className={cn("pointer-events-none absolute top-1 h-5 rounded-sm", f.phase === "over" ? "bg-slate-400 dark:bg-slate-500" : "bg-violet-600")}
                  style={{ left: `${pct(f.startsOn)}%`, width: `max(4px, ${pct(f.endsOn, true) - pct(f.startsOn)}%)` }}
                />
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex gap-4 text-xs text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-5 rounded-sm bg-violet-200 dark:bg-violet-500/30" /> Sale window
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-5 rounded-sm bg-violet-600" /> Festival days
          </span>
          {todayAt !== null && (
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-px bg-rose-500" /> Today
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function FestivalCalendarPage() {
  const { can } = useCan();
  const [year, setYear] = useState(() => new Date().getFullYear());
  const { data, isLoading, isFetching } = useFestivalsQuery(year);
  const [addPresets, { isLoading: adding }] = useAddFestivalPresetsMutation();
  const festivals = data?.festivals ?? [];

  const onAdd = async () => {
    try {
      const r = await addPresets(year).unwrap();
      toast.success(r.added ? `${r.added} festivals added to ${year}` : "All festivals are already on the calendar");
    } catch (e) {
      toast.error(errorText(e, "Couldn't add the festivals."));
    }
  };

  const addButton =
    can("promotions.create") && (data?.presetsToAdd ?? 0) > 0 ? (
      <Button variant="outline" onClick={onAdd} disabled={adding}>
        <Sparkles className="mr-2 h-4 w-4" /> Add {data!.presetsToAdd} Bangladesh festivals
      </Button>
    ) : null;

  return (
    <div className="space-y-6">
      <PageTitle
        icon={CalendarHeart}
        title="Festival calendar"
        description="Eid, Pohela Boishakh, Puja and other shopping seasons: when each sale should run, what to get ready, and the offers set up for it."
        actions={
          <>
            {addButton}
            {can("promotions.create") && (
              <Button asChild>
                <Link href="/marketing/festivals/new">
                  <Plus className="mr-2 h-4 w-4" /> New festival
                </Link>
              </Button>
            )}
          </>
        }
      />

      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={() => setYear((y) => y - 1)} aria-label="Previous year">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className={cn("w-16 text-center text-lg font-semibold tabular-nums", isFetching && "opacity-60")}>{year}</span>
        <Button variant="outline" size="icon" onClick={() => setYear((y) => y + 1)} aria-label="Next year">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {data && data.unknownDates.length > 0 && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          Dates for {data.unknownDates.join(", ")} in {year} aren't known yet: they follow the moon. Add them with “New festival” once they're announced.
        </p>
      )}

      {isLoading ? (
        <Skeleton className="h-72 w-full" />
      ) : festivals.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <EmptyState
              icon={CalendarHeart}
              title={`Nothing on the calendar for ${year}`}
              text="Add Bangladesh's shopping festivals in one click (Eid, Pohela Boishakh, Puja, 11.11 and more), or add your own, like the shop's anniversary."
              action={addButton ?? undefined}
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{year} at a glance</CardTitle>
            </CardHeader>
            <CardContent>
              <Timeline year={year} today={data!.today} festivals={festivals} />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Festival</TableHead>
                      <TableHead>Sale</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Checklist</TableHead>
                      <TableHead className="text-right">Campaigns</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {festivals.map((f) => (
                      <TableRow key={f.id} className={cn(f.phase === "over" && "text-slate-400")}>
                        <TableCell>
                          <Link href={`/marketing/festivals/${f.id}`} className="font-medium hover:underline">
                            {f.name}
                          </Link>
                          <div className="text-xs text-slate-500">
                            {dayRange(f.startsOn, f.endsOn)}
                            {f.dateIsEstimate && <span className="ml-1 text-amber-700 dark:text-amber-400">· expected</span>}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{dayRange(f.saleFrom, f.saleTo, false)}</TableCell>
                        <TableCell>
                          <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", PHASE[f.phase].className)}>{PHASE[f.phase].label}</span>
                          {f.phase !== "over" && f.daysToSale > 0 && <div className="mt-1 text-xs text-slate-500">Sale starts {inDays(f.daysToSale)}</div>}
                        </TableCell>
                        <TableCell className="text-sm">
                          <span className="inline-flex items-center gap-1.5">
                            <ListChecks className="h-4 w-4 text-slate-400" aria-hidden />
                            {f.tasks.done}/{f.tasks.total}
                          </span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{f.links || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
