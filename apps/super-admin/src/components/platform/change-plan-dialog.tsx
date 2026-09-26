"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Select,
  SelectItem,
} from "@/components/ui";
import {
  apiErrorMessage,
  useGetPlansQuery,
  useUpdateStoreMutation,
  type StoreStatus,
} from "@/lib/features/platform/platform-api-slice";

type PlanTarget = { id: string; name: string; status: StoreStatus; plan: { id: string; name: string } | null };

/** Moves a store to another plan and/or between trial, active and cancelled. */
export function ChangePlanDialog({ store, onOpenChange }: { store: PlanTarget | null; onOpenChange: (open: boolean) => void }) {
  const { data: plans = [] } = useGetPlansQuery();
  const [updateStore, { isLoading }] = useUpdateStoreMutation();
  const [planId, setPlanId] = useState("");
  const [status, setStatus] = useState<StoreStatus>("active");

  useEffect(() => {
    if (store) {
      setPlanId(store.plan?.id ?? "");
      setStatus(store.status);
    }
  }, [store]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!store) return;
    try {
      await updateStore({ id: store.id, planId: planId || undefined, status }).unwrap();
      const plan = plans.find((p) => p.id === planId);
      toast.success(`${store.name} updated`, { description: `${plan?.name ?? "No plan"} · ${status}` });
      onOpenChange(false);
    } catch (err) {
      toast.error("Couldn't update the plan", { description: apiErrorMessage(err) });
    }
  };

  return (
    <Dialog open={!!store} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Change plan</DialogTitle>
            <DialogDescription>{store?.name}. Only active stores count towards MRR.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Plan</Label>
            <Select value={planId} onValueChange={setPlanId}>
              {!store?.plan && <SelectItem value="">No plan</SelectItem>}
              {plans.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name} (${p.priceMonthly}/mo, ${p.priceYearly}/yr)
                </SelectItem>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Store status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as StoreStatus)}>
              <SelectItem value="trial">Trial</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading} className="bg-rose-600 hover:bg-rose-500 text-white">
              {isLoading ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
