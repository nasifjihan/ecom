"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Globe2,
  Package,
  PauseCircle,
  ShoppingCart,
  Users,
  Boxes,
  CreditCard,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Select,
  SelectItem,
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
} from "@/components/ui";
import {
  fromApiStore,
  useActivateStoreMutation,
  useGetPlansQuery,
  useGetStoreQuery,
  useSuspendStoreMutation,
  useUpdateStoreMutation,
} from "@/lib/features/platform/platform-api-slice";

const fd = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

const errorText = (err: any, fallback: string) =>
  typeof err?.data === "string" ? err.data : err?.data?.message ?? fallback;

function Stat({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <Card className="border-slate-200 dark:border-slate-800">
      <CardContent className="p-5 flex items-center gap-4">
        <div className="h-10 w-10 rounded-xl bg-rose-500/10 flex items-center justify-center">
          <Icon className="h-5 w-5 text-rose-600 dark:text-rose-400" />
        </div>
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
          <p className="text-xl font-bold text-slate-900 dark:text-white">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2 text-sm border-b border-slate-100 dark:border-slate-800 last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-800 dark:text-slate-200 text-right">{value}</span>
    </div>
  );
}

export default function SuperStoreDetailPage() {
  const params = useParams();
  const router = useRouter();
  const storeId = params.id as string;
  const [tab, setTab] = useState("overview");

  const { data: raw, isLoading, isError } = useGetStoreQuery(storeId);
  const { data: plans = [] } = useGetPlansQuery();
  const [suspendStore, { isLoading: suspending }] = useSuspendStoreMutation();
  const [activateStore, { isLoading: activating }] = useActivateStoreMutation();
  const [updateStore, { isLoading: updatingPlan }] = useUpdateStoreMutation();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }
  if (!raw || isError) {
    return (
      <div className="py-24 text-center">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Store not found</h1>
        <Link href="/stores" className="mt-6 inline-block text-sm font-medium text-rose-600 hover:underline">
          Back to all stores
        </Link>
      </div>
    );
  }

  const store = fromApiStore(raw);
  const g = raw.generalSettings ?? {};
  const loc = raw.localizationSettings ?? {};
  const admins: any[] = raw.admins ?? [];
  const sub = raw.billingSub;
  const features: Record<string, unknown> = raw.plan?.features ?? {};

  async function toggleStatus() {
    const suspend = store.status !== "suspended";
    try {
      await (suspend ? suspendStore(store.id) : activateStore(store.id)).unwrap();
      toast.success(`${suspend ? "Suspended" : "Activated"}: ${store.name}`);
    } catch (err) {
      toast.error(errorText(err, "Could not change the store status"));
    }
  }

  async function changePlan(planId: string) {
    if (!planId || planId === store.planId) return;
    try {
      await updateStore({ id: store.id, body: { planId } }).unwrap();
      toast.success("Plan updated");
    } catch (err) {
      toast.error(errorText(err, "Could not change the plan"));
    }
  }

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
            <div className="h-14 w-14 rounded-full flex items-center justify-center text-sm font-bold bg-gradient-to-br from-amber-500 to-orange-500 text-white">
              {store.logo}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{store.name}</h1>
                <Badge variant="secondary">{store.planName}</Badge>
                <Badge variant={store.status === "suspended" ? "destructive" : "default"} className="capitalize">
                  {store.status}
                </Badge>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {store.domain} · {store.slug} · created {fd(raw.createdAt)}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-44">
            <Select value={store.planId ?? ""} onValueChange={changePlan}>
              <SelectItem value="">Change plan…</SelectItem>
              {plans.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name} (${p.priceMonthly}/mo)
                </SelectItem>
              ))}
            </Select>
          </div>
          <Button
            variant={store.status === "suspended" ? "default" : "outline"}
            onClick={toggleStatus}
            disabled={suspending || activating || updatingPlan}
          >
            {store.status === "suspended" ? (
              <>
                <CheckCircle2 className="h-4 w-4 mr-1.5" /> Activate
              </>
            ) : (
              <>
                <PauseCircle className="h-4 w-4 mr-1.5" /> Suspend
              </>
            )}
          </Button>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={ShoppingCart} label="Orders" value={store.orders.toLocaleString()} />
        <Stat icon={Boxes} label="Products" value={store.products.toLocaleString()} />
        <Stat icon={Users} label="Customers" value={store.customers.toLocaleString()} />
        <Stat icon={CreditCard} label="MRR" value={`$${store.mrr.toLocaleString()}`} />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="justify-start">
          <TabsTrigger value="overview">
            <Building2 className="h-4 w-4 mr-1.5" /> Overview
          </TabsTrigger>
          <TabsTrigger value="users">
            <Users className="h-4 w-4 mr-1.5" /> Staff ({admins.length})
          </TabsTrigger>
          <TabsTrigger value="plan">
            <Package className="h-4 w-4 mr-1.5" /> Plan & Billing
          </TabsTrigger>
          <TabsTrigger value="domains">
            <Globe2 className="h-4 w-4 mr-1.5" /> Domains ({store.domains.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-slate-200 dark:border-slate-800">
              <CardHeader>
                <CardTitle className="text-base">Store</CardTitle>
              </CardHeader>
              <CardContent>
                <Row label="Owner" value={store.ownerName ? `${store.ownerName} (${store.ownerEmail})` : store.ownerEmail} />
                <Row label="Tagline" value={g.tagline || "—"} />
                <Row label="Country" value={store.country} />
                <Row label="Currency" value={loc.defaultCurrency ?? "—"} />
                <Row label="Timezone" value={g.timezone ?? "—"} />
                <Row label="Maintenance mode" value={g.maintenanceMode ? "On" : "Off"} />
              </CardContent>
            </Card>
            <Card className="border-slate-200 dark:border-slate-800">
              <CardHeader>
                <CardTitle className="text-base">Contact</CardTitle>
              </CardHeader>
              <CardContent>
                <Row label="Email from" value={g.emailFrom ? `${g.emailFromName ?? ""} <${g.emailFrom}>` : "—"} />
                <Row label="Phone" value={g.phone || "—"} />
                <Row
                  label="Address"
                  value={[g.addressLine1, g.addressLine2, g.city, g.state, g.postalCode].filter(Boolean).join(", ") || "—"}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="users" className="mt-6">
          <Card className="border-slate-200 dark:border-slate-800">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last login</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {admins.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.name}</TableCell>
                      <TableCell>{a.email}</TableCell>
                      <TableCell>{a.role?.name ?? "—"}</TableCell>
                      <TableCell className="capitalize">{a.status}</TableCell>
                      <TableCell>{fd(a.lastLoginAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plan" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-slate-200 dark:border-slate-800">
              <CardHeader>
                <CardTitle className="text-base">{store.planName}</CardTitle>
                <CardDescription>
                  {raw.plan ? `$${Number(raw.plan.priceMonthly)}/month · $${Number(raw.plan.priceYearly)}/year` : "No plan assigned"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {Object.entries(features).map(([k, v]) => (
                  <Row key={k} label={k.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase())} value={typeof v === "boolean" ? (v ? "Yes" : "No") : v === 0 ? "Unlimited" : String(v)} />
                ))}
              </CardContent>
            </Card>
            <Card className="border-slate-200 dark:border-slate-800">
              <CardHeader>
                <CardTitle className="text-base">Subscription</CardTitle>
                <CardDescription>Platform billing for this store</CardDescription>
              </CardHeader>
              <CardContent>
                {sub ? (
                  <>
                    <Row label="Status" value={sub.status} />
                    <Row label="Plan" value={sub.plan?.name ?? "—"} />
                    <Row label="Current period ends" value={fd(sub.currentPeriodEnd)} />
                    <Row label="Cancels at period end" value={sub.cancelAtPeriodEnd ? "Yes" : "No"} />
                  </>
                ) : (
                  <p className="text-sm text-slate-500">
                    No billing subscription yet. Stores get one once platform billing (Stripe) is connected.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="domains" className="mt-6">
          <Card className="border-slate-200 dark:border-slate-800">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Hostname</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Primary</TableHead>
                    <TableHead>SSL</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(raw.domains ?? []).map((d: any) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.hostname}</TableCell>
                      <TableCell className="capitalize">{d.type}</TableCell>
                      <TableCell>{d.primary ? "Yes" : "No"}</TableCell>
                      <TableCell>{d.sslEnabled ? "On" : "Off"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
