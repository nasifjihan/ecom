"use client";

/**
 * Who gets which messages: the emails and SMS customers get at each order step, and the alerts
 * the team gets (in the bell, by email, by SMS) and who gets them. Customer switches are the
 * same ones as on Settings > Emails and Settings > SMS.
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { BellRing, ChevronDown } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";
import { PageTitle, Toggle } from "@/components/content/shared";
import { errorText } from "@/lib/features/content/content-api-slice";
import { useCan } from "@/lib/permissions";
import {
  useNotificationMatrixQuery,
  useSaveNotificationMatrixMutation,
  type CustomerMessageRow,
  type Matrix,
  type StaffAlertRow,
} from "@/lib/features/settings/alerts-api-slice";

function WhoPicker({ row, people, disabled, onChange }: { row: StaffAlertRow; people: Matrix["people"]; disabled: boolean; onChange: (ids: string[]) => void }) {
  if (row.toAssignee) return <span className="text-sm text-muted-foreground">The person it&apos;s given to</span>;
  const chosen = people.filter((p) => row.staffIds.includes(p.id));
  const summary = chosen.length ? chosen.map((p) => p.name).join(", ") : "Owners";
  const noMobile = row.sms ? (chosen.length ? chosen : people.filter((p) => p.owner)).filter((p) => !p.hasMobile) : [];
  return (
    <div className="space-y-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={disabled} className="max-w-[220px] justify-between gap-2" aria-label={`Who gets "${row.label}"`}>
            <span className="truncate">{summary}</span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64 p-2">
          <p className="px-1 pb-2 text-xs text-muted-foreground">Nobody ticked: the store&apos;s owners.</p>
          {people.map((p) => (
            <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800">
              <input
                type="checkbox"
                checked={row.staffIds.includes(p.id)}
                onChange={(e) => onChange(e.target.checked ? [...row.staffIds, p.id] : row.staffIds.filter((x) => x !== p.id))}
              />
              <span className="min-w-0 flex-1 truncate">{p.name}</span>
              <span className="text-xs text-muted-foreground">{p.role}</span>
            </label>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {noMobile.length > 0 && <p className="text-xs text-amber-700">No mobile on file for {noMobile.map((p) => p.name).join(", ")}: no SMS for them.</p>}
    </div>
  );
}

export default function NotificationSettingsPage() {
  const { data, isLoading } = useNotificationMatrixQuery();
  const [save, { isLoading: saving }] = useSaveNotificationMatrixMutation();
  const { can } = useCan();
  const edit = can("emails.edit");
  const [customers, setCustomers] = useState<CustomerMessageRow[]>([]);
  const [staff, setStaff] = useState<StaffAlertRow[]>([]);

  useEffect(() => {
    if (!data) return;
    setCustomers(data.customers);
    setStaff(data.staff);
  }, [data]);

  const dirty = useMemo(() => !!data && (JSON.stringify(data.customers) !== JSON.stringify(customers) || JSON.stringify(data.staff) !== JSON.stringify(staff)), [data, customers, staff]);
  const setC = (key: string, patch: Partial<CustomerMessageRow>) => setCustomers((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const setS = (event: string, patch: Partial<StaffAlertRow>) => setStaff((rows) => rows.map((r) => (r.event === event ? { ...r, ...patch } : r)));

  const onSave = async () => {
    try {
      await save({
        customers: customers.map((c) => ({ key: c.key, email: c.email, ...(c.sms === null ? {} : { sms: c.sms }) })),
        staff: staff.map((s) => ({ event: s.event, inApp: s.inApp, email: s.email, sms: s.sms, ...(s.toAssignee ? {} : { staffIds: s.staffIds }) })),
      }).unwrap();
      toast.success("Saved");
    } catch (e) {
      toast.error(errorText(e));
    }
  };

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16" />
        <Skeleton className="h-72" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageTitle
        icon={BellRing}
        title="Notifications"
        description="Who gets which messages: what customers are sent at each step of their order, and what your team hears about."
        actions={
          edit ? (
            <Button onClick={() => void onSave()} disabled={saving || !dirty}>
              {saving ? "Saving…" : "Save"}
            </Button>
          ) : null
        }
      />

      {!data.smsReady && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          SMS is in test mode: messages are written to the SMS log, not sent. Choose a provider in{" "}
          <Link href="/settings/sms" className="font-medium underline">
            Settings → SMS
          </Link>
          .
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Customers</CardTitle>
          <CardDescription>
            Email only goes to customers who gave an email; SMS to Bangladeshi mobile numbers. Change the wording in{" "}
            <Link href="/settings/emails" className="underline">
              Emails
            </Link>{" "}
            and{" "}
            <Link href="/settings/sms" className="underline">
              SMS
            </Link>
            .
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Message</TableHead>
                <TableHead className="w-24">Email</TableHead>
                <TableHead className="w-24">SMS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((c) => (
                <TableRow key={c.key}>
                  <TableCell className="text-sm">{c.label}</TableCell>
                  <TableCell>
                    {edit ? <Toggle checked={c.email} onChange={(v) => setC(c.key, { email: v })} ariaLabel={`${c.label} by email`} /> : c.email ? "On" : "Off"}
                  </TableCell>
                  <TableCell>
                    {c.sms === null ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : edit ? (
                      <Toggle checked={c.sms} onChange={(v) => setC(c.key, { sms: v })} ariaLabel={`${c.label} by SMS`} />
                    ) : c.sms ? (
                      "On"
                    ) : (
                      "Off"
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your team</CardTitle>
          <CardDescription>
            The bell is the icon at the top of the admin. Team SMS go to the mobile number on each person&apos;s staff profile.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Alert</TableHead>
                <TableHead className="w-20">Bell</TableHead>
                <TableHead className="w-20">Email</TableHead>
                <TableHead className="w-20">SMS</TableHead>
                <TableHead>Who</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staff.map((s) => (
                <TableRow key={s.event}>
                  <TableCell>
                    <div className="text-sm font-medium">{s.label}</div>
                    <div className="max-w-xs text-xs text-muted-foreground">{s.description}</div>
                  </TableCell>
                  {(["inApp", "email", "sms"] as const).map((k) => (
                    <TableCell key={k}>
                      {edit ? (
                        <Toggle checked={s[k]} onChange={(v) => setS(s.event, { [k]: v })} ariaLabel={`${s.label}: ${k === "inApp" ? "bell" : k === "email" ? "email" : "SMS"}`} />
                      ) : s[k] ? (
                        "On"
                      ) : (
                        "Off"
                      )}
                    </TableCell>
                  ))}
                  <TableCell>
                    <WhoPicker row={s} people={data.people} disabled={!edit} onChange={(ids) => setS(s.event, { staffIds: ids })} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
