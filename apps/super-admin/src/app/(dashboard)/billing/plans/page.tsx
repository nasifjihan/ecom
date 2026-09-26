"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, CreditCard, Edit3, MoreHorizontal, Plus, Trash2, X } from "lucide-react";
import {
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  Label,
  Select,
  SelectItem,
  Skeleton,
  Switch,
  cn,
} from "@/components/ui";
import {
  apiErrorMessage,
  formatMoney,
  useCreatePlanMutation,
  useDeletePlanMutation,
  useGetPlansQuery,
  useUpdatePlanMutation,
  type Plan,
  type PlanFeatures,
  type PlanInput,
} from "@/lib/features/platform/platform-api-slice";
import { planColors } from "@/components/platform/shared";

/** Limits are numbers where 0 means unlimited; toggles are on/off features. */
const LIMITS: { key: keyof PlanFeatures; label: string; unit?: string }[] = [
  { key: "maxProducts", label: "Products" },
  { key: "staffUsers", label: "Staff users" },
  { key: "storageGB", label: "Storage", unit: "GB" },
];
const TOGGLES: { key: keyof PlanFeatures; label: string }[] = [
  { key: "customDomain", label: "Custom domain" },
  { key: "enableDropshipping", label: "Dropshipping" },
  { key: "enableSubscriptions", label: "Product subscriptions" },
];

const limitText = (v: unknown, unit = "") => (Number(v) > 0 ? `${Number(v).toLocaleString()}${unit ? ` ${unit}` : ""}` : "Unlimited");

export default function BillingPlansPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { data: plans = [], isLoading, isError } = useGetPlansQuery();
  const [deletePlan] = useDeletePlanMutation();
  const [editing, setEditing] = useState<Plan | "new" | null>(params.get("new") === "1" ? "new" : null);

  useEffect(() => {
    if (params.get("new") === "1") setEditing("new");
  }, [params]);

  const totalMrr = plans.reduce((s, p) => s + p.mrr, 0);
  const totalStores = plans.reduce((s, p) => s + p.storeCount, 0);

  const remove = async (plan: Plan) => {
    if (!window.confirm(`Delete the ${plan.name} plan?`)) return;
    try {
      await deletePlan(plan.id).unwrap();
      toast.success(`Deleted ${plan.name}`);
    } catch (err) {
      toast.error("Couldn't delete the plan", { description: apiErrorMessage(err) });
    }
  };

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-center justify-between flex-wrap gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Billing Plans</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {plans.length} plans · {totalStores} stores on a plan · {formatMoney(totalMrr)} MRR from active stores
          </p>
        </div>
        <Button size="sm" className="bg-rose-600 hover:bg-rose-500 text-white" onClick={() => setEditing("new")}>
          <Plus className="h-4 w-4 mr-2" />
          New Plan
        </Button>
      </motion.div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-96 rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <Card>
          <CardContent className="p-10 text-center text-slate-500">Couldn&apos;t load plans. Check that the API is running.</CardContent>
        </Card>
      ) : plans.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center space-y-2">
            <CreditCard className="h-12 w-12 mx-auto opacity-40" />
            <p className="font-medium">No plans yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {plans.map((plan, i) => {
            const yearlySaving = plan.priceMonthly * 12 - plan.priceYearly;
            return (
              <motion.div key={plan.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05, duration: 0.3 }}>
                <Card className="h-full border-slate-200 dark:border-slate-800">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-xl font-bold">{plan.name}</CardTitle>
                        <Badge variant="secondary" className={cn("border-0", planColors[plan.type])}>
                          {plan.type}
                        </Badge>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Actions for ${plan.name}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem onClick={() => setEditing(plan)} className="cursor-pointer">
                            <Edit3 className="h-4 w-4 mr-2" />
                            Edit plan
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => remove(plan)} className="cursor-pointer text-red-600 focus:text-red-600">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="mt-4 flex items-end gap-1">
                      <span className="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">{formatMoney(plan.priceMonthly)}</span>
                      <span className="text-sm text-slate-500 dark:text-slate-400 mb-1.5">/month</span>
                    </div>
                    <p className="text-xs text-slate-500">
                      {formatMoney(plan.priceYearly)}/year
                      {yearlySaving > 0 && <span className="text-emerald-600 dark:text-emerald-400 font-medium"> · saves {formatMoney(yearlySaving)}</span>}
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-3 gap-2 text-center">
                      {[
                        { label: "Stores", value: plan.storeCount },
                        { label: "Active", value: plan.activeStores },
                        { label: "MRR", value: formatMoney(plan.mrr) },
                      ].map((m) => (
                        <div key={m.label} className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                          <p className="text-[10px] text-slate-500 uppercase tracking-wider">{m.label}</p>
                          <p className="text-sm font-bold text-slate-900 dark:text-white">{m.value}</p>
                        </div>
                      ))}
                    </div>
                    <ul className="space-y-2">
                      {LIMITS.map((l) => (
                        <li key={String(l.key)} className="flex items-center justify-between text-sm">
                          <span className="text-slate-600 dark:text-slate-300">{l.label}</span>
                          <span className="font-medium text-slate-900 dark:text-white">{limitText(plan.features[l.key], l.unit)}</span>
                        </li>
                      ))}
                      {TOGGLES.map((t) => (
                        <li key={String(t.key)} className="flex items-center gap-2 text-sm">
                          {plan.features[t.key] ? <Check className="h-4 w-4 text-emerald-500" /> : <X className="h-4 w-4 text-slate-400" />}
                          <span className={plan.features[t.key] ? "text-slate-600 dark:text-slate-300" : "text-slate-400 line-through"}>{t.label}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      <PlanDialog
        plan={editing}
        onOpenChange={(o) => {
          if (!o) {
            setEditing(null);
            if (params.get("new")) router.replace("/billing/plans");
          }
        }}
      />
    </div>
  );
}

function PlanDialog({ plan, onOpenChange }: { plan: Plan | "new" | null; onOpenChange: (open: boolean) => void }) {
  const [createPlan, { isLoading: creating }] = useCreatePlanMutation();
  const [updatePlan, { isLoading: updating }] = useUpdatePlanMutation();
  const [form, setForm] = useState<PlanInput>({ name: "", type: "BASIC", priceMonthly: 0, priceYearly: 0, features: {} });

  useEffect(() => {
    if (plan === "new") setForm({ name: "", type: "BASIC", priceMonthly: 0, priceYearly: 0, features: { maxProducts: 100, staffUsers: 2, storageGB: 5, customDomain: false } });
    else if (plan) setForm({ name: plan.name, type: plan.type, priceMonthly: plan.priceMonthly, priceYearly: plan.priceYearly, features: { ...plan.features } });
  }, [plan]);

  const setFeature = (key: keyof PlanFeatures, value: number | boolean) => setForm((f) => ({ ...f, features: { ...f.features, [key]: value } }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (plan === "new") {
        await createPlan(form).unwrap();
        toast.success(`Created ${form.name}`);
      } else if (plan) {
        await updatePlan({ id: plan.id, ...form }).unwrap();
        toast.success(`Saved ${form.name}`, { description: plan.storeCount ? `Applies to ${plan.storeCount} store(s) on this plan.` : undefined });
      }
      onOpenChange(false);
    } catch (err) {
      toast.error("Couldn't save the plan", { description: apiErrorMessage(err) });
    }
  };

  return (
    <Dialog open={!!plan} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{plan === "new" ? "New plan" : `Edit ${plan?.name ?? ""}`}</DialogTitle>
            <DialogDescription>Prices are in USD. Set a limit to 0 for unlimited.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="plan-name">Name</Label>
              <Input id="plan-name" required minLength={2} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Tier</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as Plan["type"] })}>
                <SelectItem value="BASIC">Basic</SelectItem>
                <SelectItem value="PRO">Pro</SelectItem>
                <SelectItem value="ENTERPRISE">Enterprise</SelectItem>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="price-m">Monthly price</Label>
              <Input id="price-m" type="number" min={0} step="0.01" required value={form.priceMonthly} onChange={(e) => setForm({ ...form, priceMonthly: Number(e.target.value) })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="price-y">Yearly price</Label>
              <Input id="price-y" type="number" min={0} step="0.01" required value={form.priceYearly} onChange={(e) => setForm({ ...form, priceYearly: Number(e.target.value) })} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {LIMITS.map((l) => (
              <div key={String(l.key)} className="space-y-1.5">
                <Label htmlFor={`f-${String(l.key)}`}>
                  {l.label}
                  {l.unit ? ` (${l.unit})` : ""}
                </Label>
                <Input
                  id={`f-${String(l.key)}`}
                  type="number"
                  min={0}
                  value={Number(form.features[l.key] ?? 0)}
                  onChange={(e) => setFeature(l.key, Number(e.target.value))}
                />
              </div>
            ))}
          </div>
          <div className="space-y-2">
            {TOGGLES.map((t) => (
              <label key={String(t.key)} className="flex items-center gap-2 text-sm">
                <Switch checked={!!form.features[t.key]} onCheckedChange={(v) => setFeature(t.key, v)} />
                {t.label}
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={creating || updating} className="bg-rose-600 hover:bg-rose-500 text-white">
              {creating || updating ? "Saving..." : plan === "new" ? "Create plan" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
