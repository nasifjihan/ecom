"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Clock, PauseCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectItem,
  cn,
} from "@/components/ui";
import {
  apiErrorMessage,
  useCreateStoreMutation,
  useGetPlansQuery,
  type StoreStatus,
} from "@/lib/features/platform/platform-api-slice";

export const planColors: Record<string, string> = {
  BASIC: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  PRO: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  ENTERPRISE: "bg-rose-500/10 text-rose-700 dark:text-rose-400",
};

export const storeStatusConfig: Record<
  StoreStatus,
  { variant: "success" | "info" | "destructive" | "secondary"; icon: React.ComponentType<{ className?: string }>; text: string; color: string }
> = {
  active: { variant: "success", icon: CheckCircle2, text: "Active", color: "text-emerald-600" },
  trial: { variant: "info", icon: Clock, text: "Trial", color: "text-blue-600" },
  suspended: { variant: "destructive", icon: PauseCircle, text: "Suspended", color: "text-red-600" },
  cancelled: { variant: "secondary", icon: XCircle, text: "Cancelled", color: "text-slate-500" },
};

export function PlanBadge({ name }: { name?: string | null }) {
  return (
    <Badge variant="secondary" className={cn("border-0", name ? planColors[name] : "")}>
      {name ?? "No plan"}
    </Badge>
  );
}

export function StoreStatusBadge({ status }: { status: StoreStatus }) {
  const s = storeStatusConfig[status] ?? storeStatusConfig.cancelled;
  const Icon = s.icon;
  return (
    <div className="flex items-center gap-1.5">
      <Icon className={cn("h-3.5 w-3.5", s.color)} />
      <Badge variant={s.variant} className="border-0">
        {s.text}
      </Badge>
    </div>
  );
}

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

/** Store names become slugs: lowercase, a-z0-9 and dashes. */
export const slugify = (v: string) =>
  v
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

export function CreateStoreDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (id: string) => void;
}) {
  const { data: plans = [] } = useGetPlansQuery();
  const [createStore, { isLoading }] = useCreateStoreMutation();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [planId, setPlanId] = useState("");
  const [status, setStatus] = useState<StoreStatus>("trial");
  const [trialDays, setTrialDays] = useState("14");
  const [owner, setOwner] = useState({ name: "", email: "", password: "" });

  useEffect(() => {
    if (!open) {
      setOwner({ name: "", email: "", password: "" });
      setName("");
      setSlug("");
      setSlugTouched(false);
      setPlanId("");
      setStatus("trial");
      setTrialDays("14");
    }
  }, [open]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const store = await createStore({
        name: name.trim(),
        slug,
        planId: planId || undefined,
        status,
        trialDays: status === "trial" ? Number(trialDays) || 0 : undefined,
        owner: owner.email.trim() ? { name: owner.name.trim(), email: owner.email.trim(), password: owner.password } : undefined,
      }).unwrap();
      toast.success(`Store created: ${store.name}`, {
        description: "Add a storefront domain so customers can reach it.",
      });
      onOpenChange(false);
      onCreated?.(store.id);
    } catch (err) {
      toast.error("Couldn't create the store", { description: apiErrorMessage(err) });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>New store</DialogTitle>
            <DialogDescription>Creates the tenant with its default staff roles. Add the owner now or later, then its domains.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="store-name">Store name</Label>
            <Input
              id="store-name"
              value={name}
              required
              minLength={2}
              onChange={(e) => {
                setName(e.target.value);
                if (!slugTouched) setSlug(slugify(e.target.value));
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="store-slug">Slug</Label>
            <Input
              id="store-slug"
              value={slug}
              required
              minLength={3}
              pattern="[a-z0-9-]+"
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(slugify(e.target.value));
              }}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Plan</Label>
              <Select value={planId} onValueChange={setPlanId}>
                <SelectItem value="">No plan</SelectItem>
                {plans.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} (${p.priceMonthly}/mo)
                  </SelectItem>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as StoreStatus)}>
                <SelectItem value="trial">Trial</SelectItem>
                <SelectItem value="active">Active</SelectItem>
              </Select>
            </div>
          </div>
          {status === "trial" && (
            <div className="space-y-1.5">
              <Label htmlFor="trial-days">Trial length (days)</Label>
              <Input id="trial-days" type="number" min={0} max={365} value={trialDays} onChange={(e) => setTrialDays(e.target.value)} />
            </div>
          )}
          <OwnerFields value={owner} onChange={setOwner} optional />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading} className="bg-rose-600 hover:bg-rose-500 text-white">
              {isLoading ? "Creating..." : "Create store"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export type OwnerFieldsValue = { name: string; email: string; password: string };

/** Owner login fields. When `optional`, they are only required once an email is typed. */
export function OwnerFields({ value, onChange, optional }: { value: OwnerFieldsValue; onChange: (v: OwnerFieldsValue) => void; optional?: boolean }) {
  const required = !optional || value.email.trim() !== "";
  const set = (k: keyof OwnerFieldsValue) => (e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...value, [k]: e.target.value });
  return (
    <fieldset className="space-y-3 rounded-lg border border-slate-200 dark:border-slate-800 p-3">
      <legend className="px-1 text-xs font-semibold text-slate-600 dark:text-slate-300">Owner login{optional ? " (optional)" : ""}</legend>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="owner-name">Name</Label>
          <Input id="owner-name" value={value.name} required={required} minLength={2} onChange={set("name")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="owner-email">Email</Label>
          <Input id="owner-email" type="email" value={value.email} required={!optional} onChange={set("email")} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="owner-password">Password</Label>
        <Input id="owner-password" type="password" autoComplete="new-password" value={value.password} required={required} minLength={8} onChange={set("password")} />
      </div>
    </fieldset>
  );
}

export function EmptyRow({ colSpan, icon: Icon, title, hint }: { colSpan: number; icon: React.ComponentType<{ className?: string }>; title: string; hint?: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="text-center py-12 text-slate-500">
        <Icon className="h-12 w-12 mx-auto mb-3 opacity-40" />
        <p className="font-medium">{title}</p>
        {hint && <p className="text-sm mt-1">{hint}</p>}
      </td>
    </tr>
  );
}

export function Pager({
  page,
  totalPages,
  total,
  perPage,
  noun,
  onPage,
}: {
  page: number;
  totalPages: number;
  total: number;
  perPage: number;
  noun: string;
  onPage: (p: number) => void;
}) {
  const from = total === 0 ? 0 : (page - 1) * perPage + 1;
  const to = Math.min(total, page * perPage);
  return (
    <div className="flex items-center justify-between mt-5 flex-wrap gap-3">
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Showing <span className="font-semibold text-slate-700 dark:text-slate-300">{from}</span> to{" "}
        <span className="font-semibold text-slate-700 dark:text-slate-300">{to}</span> of{" "}
        <span className="font-semibold text-slate-700 dark:text-slate-300">{total}</span> {noun}
      </p>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </Button>
        <span className="text-xs text-slate-500 tabular-nums">
          Page {page} of {Math.max(1, totalPages)}
        </span>
        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}
