"use client";

/** Dashboard: the next festivals on the calendar, with how close their sale is and the checklist. */
import Link from "next/link";
import { CalendarHeart, ListChecks } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle, cn } from "@/components/ui";
import { useCan } from "@/lib/permissions";
import { PHASE, dayRange, inDays, useUpcomingFestivalsQuery } from "@/lib/features/festivals/festivals-api-slice";

export default function UpcomingFestivals() {
  const { can } = useCan();
  const allowed = can("promotions.view");
  const { data = [], isLoading } = useUpcomingFestivalsQuery(undefined, { skip: !allowed });
  if (!allowed || isLoading) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarHeart className="h-4 w-4 text-violet-600" aria-hidden /> Coming up
        </CardTitle>
        <Button variant="link" asChild className="h-auto p-0 text-sm">
          <Link href="/marketing/festivals">Festival calendar</Link>
        </Button>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No festivals ahead on the calendar.{" "}
            <Link href="/marketing/festivals" className="font-medium text-blue-600 hover:underline dark:text-blue-400">
              Add Eid, Pohela Boishakh and more
            </Link>{" "}
            to plan sales and get a reminder before each one.
          </p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-3">
            {data.map((f) => (
              <li key={f.id}>
                <Link href={`/marketing/festivals/${f.id}`} className="block rounded-lg border p-4 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium">{f.name}</span>
                    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-medium", PHASE[f.phase].className)}>{PHASE[f.phase].label}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {dayRange(f.startsOn, f.endsOn)}
                    {f.dateIsEstimate && " (expected)"}
                  </p>
                  <p className="mt-2 text-sm">{f.daysToSale > 0 ? `Sale starts ${inDays(f.daysToSale)}` : `Sale on until ${dayRange(f.saleTo, f.saleTo, false)}`}</p>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                    <ListChecks className="h-3.5 w-3.5" aria-hidden /> {f.tasks.done} of {f.tasks.total} ready
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
