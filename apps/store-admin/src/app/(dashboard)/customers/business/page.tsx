"use client";

/**
 * Business accounts: whether the shop sells to businesses, applications waiting for an answer,
 * and every account with its status. Approved accounts get the bulk prices marked "Businesses".
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Briefcase, Search } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
  cn,
} from "@/components/ui";
import { EmptyState, Field, PageTitle, Toggle } from "@/components/content/shared";
import { BusinessStatusBadge, ReviewDialog } from "@/components/customers/business-account";
import { errorText } from "@/lib/features/content/content-api-slice";
import { useCan } from "@/lib/permissions";
import {
  BUSINESS_TYPE_LABELS,
  useBusinessAccountsQuery,
  useUpdateWholesaleSettingsMutation,
  useWholesaleSettingsQuery,
  type BusinessAccount,
  type BusinessStatus,
  type WholesaleSettings,
} from "@/lib/features/wholesale/wholesale-api-slice";

const tk = (n: number) => `৳${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const date = (s: string) => new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

function SettingsCard({ settings, canEdit }: { settings: WholesaleSettings; canEdit: boolean }) {
  const [enabled, setEnabled] = useState(settings.enabled);
  const [autoApprove, setAutoApprove] = useState(settings.autoApprove);
  const [intro, setIntro] = useState(settings.intro ?? "");
  const [save, { isLoading }] = useUpdateWholesaleSettingsMutation();
  useEffect(() => {
    setEnabled(settings.enabled);
    setAutoApprove(settings.autoApprove);
    setIntro(settings.intro ?? "");
  }, [settings]);

  const onSave = async () => {
    try {
      await save({ enabled, autoApprove, intro: intro.trim() || null }).unwrap();
      toast.success("Wholesale settings saved");
    } catch (e) {
      toast.error(errorText(e));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Settings</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <Toggle
            checked={enabled}
            onChange={(v) => canEdit && setEnabled(v)}
            label="Sell to businesses"
            hint="Customers can apply for a business account from their account page. Approved accounts get business prices."
          />
          <Toggle
            checked={autoApprove}
            onChange={(v) => canEdit && setAutoApprove(v)}
            label="Approve applications automatically"
            hint="Off: you check each application first (recommended)."
          />
        </div>
        <Field label="Text above the application form" htmlFor="w-intro" hint="Who qualifies and what they get, e.g. “Shops ordering 10+ pieces get wholesale prices.”">
          <Textarea id="w-intro" rows={4} value={intro} disabled={!canEdit} onChange={(e) => setIntro(e.target.value)} />
        </Field>
        {canEdit && (
          <div className="flex justify-end lg:col-span-2">
            <Button onClick={onSave} disabled={isLoading}>
              Save settings
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const TABS: { key: BusinessStatus | "ALL"; label: string }[] = [
  { key: "PENDING", label: "Waiting" },
  { key: "APPROVED", label: "Approved" },
  { key: "SUSPENDED", label: "Suspended" },
  { key: "REJECTED", label: "Rejected" },
  { key: "ALL", label: "All" },
];

export default function BusinessAccountsPage() {
  const { can } = useCan();
  const canEdit = can("customers.edit");
  const { data: settings } = useWholesaleSettingsQuery();
  const [tab, setTab] = useState<BusinessStatus | "ALL">("PENDING");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [reviewing, setReviewing] = useState<BusinessAccount | null>(null);
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);
  const { data, isFetching } = useBusinessAccountsQuery({ status: tab === "ALL" ? undefined : tab, search: q || undefined, page });
  const counts = settings?.counts ?? {};
  const all = Object.values(counts).reduce((a, b) => a + (b ?? 0), 0);
  const pages = data ? Math.max(1, Math.ceil(data.total / data.perPage)) : 1;

  return (
    <div className="space-y-6">
      <PageTitle
        icon={Briefcase}
        title="Business accounts"
        description="Shops, resellers and companies that buy at business prices. To make a customer a business account yourself, open the customer and use the Business tab."
      />
      {settings ? <SettingsCard settings={settings} canEdit={canEdit} /> : <Skeleton className="h-40" />}

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Status">
              {TABS.map((t) => {
                const n = t.key === "ALL" ? all : counts[t.key] ?? 0;
                return (
                  <button
                    key={t.key}
                    role="tab"
                    aria-selected={tab === t.key}
                    onClick={() => {
                      setTab(t.key);
                      setPage(1);
                    }}
                    className={cn(
                      "rounded-full border px-3 py-1 text-sm transition-colors",
                      tab === t.key ? "border-primary bg-primary text-primary-foreground" : "hover:bg-slate-100 dark:hover:bg-slate-800",
                    )}
                  >
                    {t.label} <span className="tabular-nums opacity-75">{n}</span>
                  </button>
                );
              })}
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input className="pl-9" placeholder="Business, licence, phone or email" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search business accounts" />
            </div>
          </div>

          {!data ? (
            <Skeleton className="h-40" />
          ) : data.rows.length === 0 ? (
            <EmptyState
              icon={Briefcase}
              title={tab === "PENDING" ? "No applications waiting" : "No business accounts here"}
              text={settings?.enabled ? "New applications from the storefront show up under Waiting." : "Turn on “Sell to businesses” above so customers can apply."}
            />
          ) : (
            <div className={cn("overflow-x-auto", isFetching && "opacity-70")}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Business</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Trade licence / BIN</TableHead>
                    <TableHead className="text-right">Orders</TableHead>
                    <TableHead>Applied</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rows.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>
                        <p className="font-medium">{a.companyName}</p>
                        <p className="text-xs text-slate-500">{BUSINESS_TYPE_LABELS[a.businessType] ?? a.businessType}</p>
                      </TableCell>
                      <TableCell>
                        <Link href={`/customers/${a.customer.id}`} className="font-medium hover:underline">
                          {a.customer.name || "Customer"}
                        </Link>
                        <p className="text-xs text-slate-500">{a.customer.phone ?? a.customer.email}</p>
                      </TableCell>
                      <TableCell className="text-sm">
                        {a.tradeLicenseNo ?? <span className="text-slate-400">—</span>}
                        {a.vatRegNo && <p className="text-xs text-slate-500">BIN {a.vatRegNo}</p>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {a.customer.orderCount}
                        <p className="text-xs text-slate-500">{tk(a.customer.totalSpent)}</p>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">{date(a.appliedAt)}</TableCell>
                      <TableCell>
                        <BusinessStatusBadge status={a.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant={a.status === "PENDING" ? "default" : "outline"} onClick={() => setReviewing(a)}>
                          {a.status === "PENDING" && canEdit ? "Review" : "Open"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {pages > 1 && (
            <div className="flex items-center justify-end gap-2 text-sm">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <span className="tabular-nums">
                {page} / {pages}
              </span>
              <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      {reviewing && <ReviewDialog account={reviewing} onOpenChange={(v) => !v && setReviewing(null)} />}
    </div>
  );
}
