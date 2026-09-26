"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  BarChart3,
  Building2,
  CheckCircle2,
  CreditCard,
  DollarSign,
  ExternalLink,
  FileText,
  Globe2,
  LogIn,
  Package,
  UserPlus,
  PauseCircle,
  ShoppingCart,
  Users,
  UserCog,
} from "lucide-react";
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  cn,
} from "@/components/ui";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  apiErrorMessage,
  formatDate,
  formatMoney,
  useCreateStoreOwnerMutation,
  useGetStoreOverviewQuery,
  useImpersonateOwnerMutation,
  useSetStoreStatusMutation,
} from "@/lib/features/platform/platform-api-slice";
import { EmptyRow, OwnerFields, PlanBadge, StoreStatusBadge, initials, type OwnerFieldsValue } from "@/components/platform/shared";
import { ChangePlanDialog } from "@/components/platform/change-plan-dialog";
import { DomainsTable } from "@/components/platform/domains-table";
import { AuditLogTable } from "@/components/platform/audit-log-table";
import { SubscriptionCard } from "@/components/platform/subscription-card";

function StatBlock({
  label,
  value,
  icon: Icon,
  iconColor,
  iconBg,
  sub,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  iconBg: string;
  sub?: string;
}) {
  return (
    <Card>
      <CardContent className="p-5 flex items-center gap-3">
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", iconBg)}>
          <Icon className={cn("h-5 w-5", iconColor)} />
        </div>
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
          <p className="text-lg font-bold text-slate-900 dark:text-white leading-tight">{value}</p>
          {sub && <p className="text-[11px] text-slate-500">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export default function SuperStoreDetailPage() {
  const params = useParams();
  const router = useRouter();
  const storeId = params.id as string;
  const [tab, setTab] = useState("overview");
  const [changingPlan, setChangingPlan] = useState(false);
  const { data, isLoading, isError } = useGetStoreOverviewQuery(storeId);
  const [setStoreStatus, { isLoading: statusBusy }] = useSetStoreStatusMutation();
  const [impersonate, { isLoading: impersonating }] = useImpersonateOwnerMutation();
  const [addingOwner, setAddingOwner] = useState(false);

  const loginAsOwner = async () => {
    // Open the tab now: browsers block window.open after an await.
    const tab = window.open("about:blank", "_blank");
    try {
      const grant = await impersonate(storeId).unwrap();
      const url = `${grant.adminUrl}/impersonate#token=${encodeURIComponent(grant.accessToken)}`;
      if (tab) tab.location.href = url;
      else window.location.href = url;
      toast.success(`Opened the store admin as ${grant.owner.email}`, {
        description: `The session lasts ${grant.expiresInMin} minutes and is recorded in the audit log.`,
      });
    } catch (err) {
      tab?.close();
      toast.error("Couldn't log in as the owner", { description: apiErrorMessage(err) });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-16 w-80" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <Card>
        <CardContent className="p-10 text-center space-y-3">
          <Building2 className="h-12 w-12 mx-auto opacity-40" />
          <p className="font-semibold text-slate-900 dark:text-white">Store not found</p>
          <Button variant="outline" onClick={() => router.push("/stores")}>
            Back to all stores
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { store, owner, admins, stats, quotas, daily, auditLogs } = data;
  const hasOwner = owner?.role?.slug === "owner" && owner.status === "active";
  const storefront = store.domains.find((d) => d.type === "storefront" && d.primary) ?? store.domains.find((d) => d.type === "storefront");

  const toggleStatus = async () => {
    const action = store.status === "suspended" ? "activate" : "suspend";
    if (action === "suspend" && !window.confirm(`Suspend ${store.name}? Its storefront and admin stop working until it is activated again.`)) return;
    try {
      await setStoreStatus({ id: store.id, action }).unwrap();
      toast.success(action === "suspend" ? `Suspended ${store.name}` : `Activated ${store.name}`);
    } catch (err) {
      toast.error("Couldn't change the store status", { description: apiErrorMessage(err) });
    }
  };

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-start justify-between flex-wrap gap-4"
      >
        <div className="space-y-3">
          <Button variant="ghost" size="sm" onClick={() => router.push("/stores")} className="-ml-2">
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Back to All Stores
          </Button>
          <div className="flex items-center gap-4">
            <Avatar className="h-14 w-14 border-2 border-slate-200 dark:border-slate-700">
              <div className="h-full w-full flex items-center justify-center text-sm font-bold bg-gradient-to-br from-rose-500 to-red-600 text-white">
                {initials(store.name)}
              </div>
            </Avatar>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{store.name}</h1>
                <PlanBadge name={store.plan?.name} />
                <StoreStatusBadge status={store.status} />
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {store.slug} · {store.primaryDomain || "no domain yet"} · created {formatDate(store.createdAt)}
                {store.status === "trial" && store.trialEndsAt ? ` · trial ends ${formatDate(store.trialEndsAt)}` : ""}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {storefront && (
            <Button variant="outline" size="sm" asChild>
              <a href={`${storefront.sslEnabled && !storefront.hostname.startsWith("localhost") ? "https" : "http"}://${storefront.hostname}`} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4 mr-1.5" />
                Open storefront
              </a>
            </Button>
          )}
          {hasOwner && (
            <Button variant="outline" size="sm" disabled={impersonating} onClick={loginAsOwner}>
              <LogIn className="h-4 w-4 mr-1.5" />
              Log in as owner
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setChangingPlan(true)}>
            <CreditCard className="h-4 w-4 mr-1.5" />
            Change plan
          </Button>
          <Button
            size="sm"
            disabled={statusBusy}
            onClick={toggleStatus}
            className={store.status === "suspended" ? "bg-emerald-600 hover:bg-emerald-500 text-white" : "bg-amber-600 hover:bg-amber-500 text-white"}
          >
            {store.status === "suspended" ? <CheckCircle2 className="h-4 w-4 mr-1.5" /> : <PauseCircle className="h-4 w-4 mr-1.5" />}
            {store.status === "suspended" ? "Activate store" : "Suspend store"}
          </Button>
        </div>
      </motion.div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-transparent p-0 h-auto border-b border-slate-200 dark:border-slate-800 w-full justify-start rounded-none">
          {[
            { id: "overview", label: "Overview", icon: BarChart3 },
            { id: "billing", label: "Billing", icon: CreditCard },
            { id: "users", label: `Admins (${admins.length})`, icon: Users },
            { id: "domains", label: `Domains (${store.domains.length})`, icon: Globe2 },
            { id: "audit", label: "Audit Log", icon: FileText },
          ].map((t) => (
            <TabsTrigger
              key={t.id}
              value={t.id}
              className={cn(
                "flex items-center gap-2 px-4 py-3 rounded-none border-b-2 border-transparent shadow-none bg-transparent",
                tab === t.id
                  ? "!border-rose-500 !text-rose-600 dark:!text-rose-400 !bg-transparent !shadow-none"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white",
              )}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatBlock
              label="MRR"
              value={formatMoney(data.mrr)}
              icon={DollarSign}
              iconBg="bg-emerald-500/10"
              iconColor="text-emerald-600"
              sub={store.status === "active" ? `${store.plan?.name ?? "No"} plan` : `Not billed while ${store.status}`}
            />
            <StatBlock
              label="GMV (all time)"
              value={formatMoney(stats.revenue, "BDT")}
              icon={ShoppingCart}
              iconBg="bg-blue-500/10"
              iconColor="text-blue-600"
              sub={`${formatMoney(stats.revenue30d, "BDT")} in the last 30 days`}
            />
            <StatBlock
              label="Orders"
              value={stats.orders.toLocaleString()}
              icon={FileText}
              iconBg="bg-amber-500/10"
              iconColor="text-amber-600"
              sub={`${stats.orders30d} in the last 30 days`}
            />
            <StatBlock
              label="Customers"
              value={stats.customers.toLocaleString()}
              icon={Users}
              iconBg="bg-purple-500/10"
              iconColor="text-purple-600"
              sub={`${stats.products} products`}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Last 30 Days</CardTitle>
                <CardDescription>Daily GMV and orders placed. Cancelled and failed orders don&apos;t count towards GMV.</CardDescription>
              </CardHeader>
              <CardContent className="h-72 pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={daily} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gmvGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.45} />
                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.03} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-200/50 dark:text-slate-800" />
                    <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#64748b" }} interval={4} />
                    <YAxis yAxisId="gmv" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={(v) => (v >= 1000 ? `৳${v / 1000}k` : `৳${v}`)} />
                    <YAxis yAxisId="orders" orientation="right" allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#64748b" }} />
                    <RechartsTooltip
                      formatter={(value: number, name: string) => (name === "revenue" ? [formatMoney(value, "BDT"), "GMV"] : [value, "Orders"])}
                      contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0" }}
                    />
                    <Area yAxisId="gmv" type="monotone" dataKey="revenue" stroke="#f43f5e" fill="url(#gmvGrad)" />
                    <Area yAxisId="orders" type="monotone" dataKey="orders" stroke="#3b82f6" fill="transparent" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Owner</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {owner ? (
                    <>
                      <p className="font-semibold text-slate-900 dark:text-white">{owner.name}</p>
                      <p className="text-slate-600 dark:text-slate-300">{owner.email}</p>
                      {owner.phone && <p className="text-slate-600 dark:text-slate-300">{owner.phone}</p>}
                      <p className="text-xs text-slate-500">
                        Last login {owner.lastLoginAt ? formatDate(owner.lastLoginAt) : "never"}
                      </p>
                    </>
                  ) : (
                    <p className="text-slate-500">This store has no admin users yet.</p>
                  )}
                  {!hasOwner && (
                    <Button size="sm" variant="outline" className="mt-2" onClick={() => setAddingOwner(true)}>
                      <UserPlus className="h-4 w-4 mr-1.5" />
                      Create owner login
                    </Button>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Plan Usage</CardTitle>
                  <CardDescription>{store.plan ? `${store.plan.name} plan limits` : "No plan assigned"}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pt-2">
                  {quotas.map((q) => {
                    const pct = q.limit ? Math.min(100, (q.used / q.limit) * 100) : 0;
                    const Icon = q.key === "products" ? Package : UserCog;
                    return (
                      <div key={q.key}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4 text-slate-500" />
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{q.label}</span>
                          </div>
                          <span className="text-xs text-slate-500 tabular-nums">
                            {q.used.toLocaleString()} / {q.limit ? q.limit.toLocaleString() : "unlimited"}
                          </span>
                        </div>
                        <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={cn("h-full rounded-full", pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-emerald-500")}
                            style={{ width: `${q.limit ? pct : 0}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="billing" className="mt-6">
          <SubscriptionCard storeId={store.id} storeName={store.name} storeStatus={store.status} plan={store.plan} billingSub={store.billingSub} mrr={data.mrr} onChangePlan={() => setChangingPlan(true)} />
        </TabsContent>

        <TabsContent value="users" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Store Admins</CardTitle>
              <CardDescription>Staff accounts that can sign in to this store&apos;s admin.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                <Table>
                  <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Login</TableHead>
                      <TableHead>Added</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {admins.length === 0 ? (
                      <EmptyRow colSpan={6} icon={Users} title="No admins yet" />
                    ) : (
                      admins.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell className="font-medium">{a.name}</TableCell>
                          <TableCell className="text-sm text-slate-600 dark:text-slate-300">{a.email}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{a.role?.name ?? "—"}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={a.status === "active" ? "success" : "secondary"} className="border-0 capitalize">
                              {a.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-slate-500">{a.lastLoginAt ? formatDate(a.lastLoginAt) : "Never"}</TableCell>
                          <TableCell className="text-xs text-slate-500">{formatDate(a.createdAt)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="domains" className="mt-6">
          <DomainsTable storeId={store.id} />
        </TabsContent>

        <TabsContent value="audit" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Audit Log</CardTitle>
              <CardDescription>
                Latest 25 admin actions in this store.{" "}
                <Link href={`/reports/audit?storeId=${store.id}`} className="text-rose-600 hover:underline">
                  See all
                </Link>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AuditLogTable logs={auditLogs} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <CreateOwnerDialog storeId={storeId} open={addingOwner} onOpenChange={setAddingOwner} />
      <ChangePlanDialog
        store={changingPlan ? { id: store.id, name: store.name, status: store.status, plan: store.plan } : null}
        onOpenChange={(o) => !o && setChangingPlan(false)}
      />
    </div>
  );
}

function CreateOwnerDialog({ storeId, open, onOpenChange }: { storeId: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [value, setValue] = useState<OwnerFieldsValue>({ name: "", email: "", password: "" });
  const [createOwner, { isLoading }] = useCreateStoreOwnerMutation();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createOwner({ storeId, name: value.name.trim(), email: value.email.trim(), password: value.password }).unwrap();
      toast.success(`Owner login created for ${value.email.trim()}`);
      setValue({ name: "", email: "", password: "" });
      onOpenChange(false);
    } catch (err) {
      toast.error("Couldn't create the owner", { description: apiErrorMessage(err) });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Create owner login</DialogTitle>
            <DialogDescription>The owner gets full access to this store&apos;s admin panel and signs in on its admin domain.</DialogDescription>
          </DialogHeader>
          <OwnerFields value={value} onChange={setValue} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading} className="bg-rose-600 hover:bg-rose-500 text-white">
              {isLoading ? "Creating..." : "Create owner"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
