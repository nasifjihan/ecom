"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CreditCard } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  SelectItem,
  Switch,
} from "@/components/ui";
import {
  apiErrorMessage,
  formatDate,
  formatMoney,
  useUpdateSubscriptionMutation,
  type StoreOverview,
  type StoreStatus,
  type SubscriptionStatus,
} from "@/lib/features/platform/platform-api-slice";

export const subscriptionStatusConfig: Record<SubscriptionStatus, { variant: "success" | "info" | "warning" | "secondary"; text: string }> = {
  active: { variant: "success", text: "Active" },
  trialing: { variant: "info", text: "Trialing" },
  past_due: { variant: "warning", text: "Past due" },
  cancelled: { variant: "secondary", text: "Cancelled" },
};

const FEATURE_LABELS: Record<string, string> = {
  maxProducts: "Products",
  staffUsers: "Staff users",
  storageGB: "Storage (GB)",
  customDomain: "Custom domain",
  enableDropshipping: "Dropshipping",
  enableSubscriptions: "Product subscriptions",
};

const toDateInput = (d: string | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : "");

/** The store's billing subscription: plan, status, renewal date and cancel-at-period-end. */
export function SubscriptionCard({
  storeId,
  storeName,
  storeStatus,
  plan,
  billingSub,
  mrr,
  onChangePlan,
}: {
  storeId: string;
  storeName: string;
  storeStatus: StoreStatus;
  plan: StoreOverview["store"]["plan"];
  billingSub: StoreOverview["store"]["billingSub"];
  mrr: number;
  onChangePlan: () => void;
}) {
  const [save, { isLoading }] = useUpdateSubscriptionMutation();
  const [status, setStatus] = useState<SubscriptionStatus>(billingSub?.status ?? (storeStatus === "trial" ? "trialing" : "active"));
  const [periodEnd, setPeriodEnd] = useState(toDateInput(billingSub?.currentPeriodEnd));
  const [cancelAtEnd, setCancelAtEnd] = useState(billingSub?.cancelAtPeriodEnd ?? false);

  useEffect(() => {
    setStatus(billingSub?.status ?? (storeStatus === "trial" ? "trialing" : "active"));
    setPeriodEnd(toDateInput(billingSub?.currentPeriodEnd));
    setCancelAtEnd(billingSub?.cancelAtPeriodEnd ?? false);
  }, [billingSub, storeStatus]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await save({
        storeId,
        status,
        cancelAtPeriodEnd: cancelAtEnd,
        currentPeriodEnd: periodEnd ? new Date(`${periodEnd}T00:00:00`).toISOString() : null,
      }).unwrap();
      toast.success(billingSub ? "Subscription updated" : "Subscription created", { description: storeName });
    } catch (err) {
      toast.error("Couldn't save the subscription", { description: apiErrorMessage(err) });
    }
  };

  const features = Object.entries(plan?.features ?? {});

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle className="text-lg">Current Plan</CardTitle>
            <CardDescription>{plan ? `${formatMoney(plan.priceMonthly)}/month or ${formatMoney(plan.priceYearly)}/year` : "No plan assigned"}</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={onChangePlan}>
            <CreditCard className="h-4 w-4 mr-1.5" />
            Change plan
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900 dark:text-white">{plan?.name ?? "—"}</span>
            <span className="text-sm text-slate-500">MRR {formatMoney(mrr)}</span>
          </div>
          {features.length > 0 && (
            <ul className="grid grid-cols-2 gap-2 text-sm">
              {features.map(([k, v]) => (
                <li key={k} className="flex justify-between gap-2 rounded-md bg-slate-50 dark:bg-slate-800/50 px-3 py-2">
                  <span className="text-slate-500">{FEATURE_LABELS[k] ?? k}</span>
                  <span className="font-medium text-slate-900 dark:text-white">
                    {typeof v === "boolean" ? (v ? "Yes" : "No") : v === 0 ? "Unlimited" : typeof v === "number" ? v.toLocaleString() : String(v)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg">Subscription</CardTitle>
            {billingSub ? (
              <Badge variant={subscriptionStatusConfig[billingSub.status]?.variant ?? "secondary"} className="border-0">
                {subscriptionStatusConfig[billingSub.status]?.text ?? billingSub.status}
              </Badge>
            ) : (
              <Badge variant="secondary">No record yet</Badge>
            )}
          </div>
          <CardDescription>
            {billingSub
              ? `Renews ${formatDate(billingSub.currentPeriodEnd)}${billingSub.cancelAtPeriodEnd ? ", then cancels" : ""}.`
              : "No payment provider is connected yet, so billing is tracked by hand here."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as SubscriptionStatus)}>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="trialing">Trialing</SelectItem>
                  <SelectItem value="past_due">Past due</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="period-end">Current period ends</Label>
                <Input id="period-end" type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={cancelAtEnd} onCheckedChange={setCancelAtEnd} />
              Cancel at the end of the period
            </label>
            <Button type="submit" disabled={isLoading || !plan} className="bg-rose-600 hover:bg-rose-500 text-white">
              {isLoading ? "Saving..." : billingSub ? "Save subscription" : "Create subscription"}
            </Button>
            {!plan && <p className="text-xs text-slate-500">Assign a plan first.</p>}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
