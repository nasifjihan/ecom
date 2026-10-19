"use client";

/**
 * The scheduled report form: which reports, how often and at what hour, which days they cover,
 * which orders and storefront, and who gets them (staff and other addresses).
 */
import { useState } from "react";
import { X } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, cn } from "@/components/ui";
import { Field, Toggle } from "@/components/content/shared";
import { useStorefrontOptionsQuery } from "@/lib/features/storefronts/storefronts-api-slice";
import {
  PERIODS,
  REPORTS,
  WEEKDAYS,
  useReportScheduleOptionsQuery,
  type ReportKey,
  type ScheduleInput,
} from "@/lib/features/reports/report-schedules-api-slice";

export const EMPTY_SCHEDULE: ScheduleInput = {
  name: "Weekly sales",
  reports: ["sales", "products"],
  frequency: "weekly",
  weekday: 1,
  monthDay: null,
  sendHour: 8,
  period: "last_week",
  basis: "placed",
  storefrontId: null,
  staffIds: [],
  emails: [],
  enabled: true,
};

const select = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm disabled:opacity-60";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ScheduleForm({
  value,
  onChange,
  disabled = false,
}: {
  value: ScheduleInput;
  onChange: (v: ScheduleInput) => void;
  disabled?: boolean;
}) {
  const { data: opts } = useReportScheduleOptionsQuery();
  const { data: allFronts = [] } = useStorefrontOptionsQuery();
  const [email, setEmail] = useState("");
  const set = (patch: Partial<ScheduleInput>) => onChange({ ...value, ...patch });
  const fronts = opts?.myStorefrontIds ? allFronts.filter((f) => opts.myStorefrontIds!.includes(String(f.id))) : allFronts;
  const toggleReport = (k: ReportKey) =>
    set({ reports: value.reports.includes(k) ? value.reports.filter((x) => x !== k) : REPORTS.map((r) => r.key).filter((x) => x === k || value.reports.includes(x)) });
  // Staff limited to some storefronts can only get reports for one of theirs.
  const canGet = (p: { storefrontIds: string[] }) => !p.storefrontIds.length || (value.storefrontId !== null && p.storefrontIds.includes(value.storefrontId));
  const addEmail = () => {
    const e = email.trim().toLowerCase();
    if (!EMAIL.test(e) || value.emails.includes(e)) return;
    set({ emails: [...value.emails, e] });
    setEmail("");
  };
  const usesBasis = value.reports.some((k) => ["sales", "products", "discounts", "customers", "tax"].includes(k));

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">What it sends</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Name" htmlFor="sch-name" hint="Shown as the email subject and the PDF title.">
            <Input id="sch-name" value={value.name} maxLength={120} disabled={disabled} onChange={(e) => set({ name: e.target.value })} />
          </Field>
          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium">Reports</legend>
            <div className="grid grid-cols-2 gap-1">
              {REPORTS.map((r) => (
                <label key={r.key} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-slate-50 dark:hover:bg-slate-800">
                  <input type="checkbox" checked={value.reports.includes(r.key)} disabled={disabled} onChange={() => toggleReport(r.key)} />
                  {r.label}
                </label>
              ))}
            </div>
          </fieldset>
          <Field label="Days it covers" htmlFor="sch-period" hint={PERIODS.find((p) => p.key === value.period)?.hint}>
            <select id="sch-period" className={select} value={value.period} disabled={disabled} onChange={(e) => set({ period: e.target.value as ScheduleInput["period"] })}>
              {PERIODS.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Which orders" htmlFor="sch-basis" hint={usesBasis ? undefined : "Not used by the reports chosen."}>
              <select id="sch-basis" className={select} value={value.basis} disabled={disabled} onChange={(e) => set({ basis: e.target.value as ScheduleInput["basis"] })}>
                <option value="placed">All placed orders</option>
                <option value="delivered">Delivered orders only</option>
              </select>
            </Field>
            {(fronts.length > 1 || opts?.myStorefrontIds) && (
              <Field label="Storefront" htmlFor="sch-front">
                <select
                  id="sch-front"
                  className={select}
                  value={value.storefrontId ?? ""}
                  disabled={disabled}
                  onChange={(e) => set({ storefrontId: e.target.value || null })}
                >
                  {!opts?.myStorefrontIds && <option value="">All storefronts</option>}
                  {opts?.myStorefrontIds && !value.storefrontId && <option value="">Choose one…</option>}
                  {fronts.map((f) => (
                    <option key={f.id} value={String(f.id)}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-5">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">When</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <Field label="How often" htmlFor="sch-freq">
              <select
                id="sch-freq"
                className={select}
                value={value.frequency}
                disabled={disabled}
                onChange={(e) => {
                  const frequency = e.target.value as ScheduleInput["frequency"];
                  set({ frequency, weekday: frequency === "weekly" ? (value.weekday ?? 1) : null, monthDay: frequency === "monthly" ? (value.monthDay ?? 1) : null });
                }}
              >
                <option value="daily">Every day</option>
                <option value="weekly">Every week</option>
                <option value="monthly">Every month</option>
              </select>
            </Field>
            {value.frequency === "weekly" && (
              <Field label="On" htmlFor="sch-day">
                <select id="sch-day" className={select} value={value.weekday ?? 1} disabled={disabled} onChange={(e) => set({ weekday: Number(e.target.value) })}>
                  {WEEKDAYS.map((d, i) => (
                    <option key={d} value={i + 1}>
                      {d}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            {value.frequency === "monthly" && (
              <Field label="On day" htmlFor="sch-mday" hint="1–28, so every month has it.">
                <select id="sch-mday" className={select} value={value.monthDay ?? 1} disabled={disabled} onChange={(e) => set({ monthDay: Number(e.target.value) })}>
                  {Array.from({ length: 28 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {i + 1}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <Field label="At" htmlFor="sch-hour" hint="Shop time.">
              <select id="sch-hour" className={select} value={value.sendHour} disabled={disabled} onChange={(e) => set({ sendHour: Number(e.target.value) })}>
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>
                    {String(h).padStart(2, "0")}:00
                  </option>
                ))}
              </select>
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Who gets it</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <fieldset className="space-y-1">
              <legend className="mb-1 text-sm font-medium">Your team</legend>
              <div className="max-h-56 space-y-0.5 overflow-y-auto">
                {(opts?.people ?? []).map((p) => {
                  const ok = canGet(p);
                  const checked = value.staffIds.includes(p.id);
                  return (
                    <label
                      key={p.id}
                      className={cn("flex items-center gap-2 rounded px-1 py-1.5 text-sm", ok ? "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800" : "opacity-60")}
                      title={ok ? p.email : "Works on some storefronts only: choose one of theirs above"}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled || (!ok && !checked)}
                        onChange={(e) => set({ staffIds: e.target.checked ? [...value.staffIds, p.id] : value.staffIds.filter((x) => x !== p.id) })}
                      />
                      <span className="min-w-0 flex-1 truncate">{p.name}</span>
                      <span className="text-xs text-slate-500">{ok ? p.role : "other storefronts"}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
            <Field label="Other email addresses" htmlFor="sch-email" hint="Your accountant or a partner, for example. Up to 10.">
              <div className="flex gap-2">
                <Input
                  id="sch-email"
                  type="email"
                  value={email}
                  placeholder="name@example.com"
                  disabled={disabled || value.emails.length >= 10}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addEmail();
                    }
                  }}
                />
                <Button type="button" variant="outline" disabled={disabled || !EMAIL.test(email.trim())} onClick={addEmail}>
                  Add
                </Button>
              </div>
            </Field>
            {value.emails.length > 0 && (
              <ul className="flex flex-wrap gap-1.5">
                {value.emails.map((e) => (
                  <li key={e} className="flex items-center gap-1 rounded-full bg-slate-100 py-0.5 pl-2.5 pr-1 text-xs dark:bg-slate-800">
                    {e}
                    {!disabled && (
                      <button type="button" className="rounded-full p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700" aria-label={`Remove ${e}`} onClick={() => set({ emails: value.emails.filter((x) => x !== e) })}>
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {value.enabled !== undefined && <Toggle checked={value.enabled} onChange={(v) => !disabled && set({ enabled: v })} label="On" hint="Off: kept, but not sent." />}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
