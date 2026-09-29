"use client";

/** The salesperson an order is credited to, their commission on it, and changing who it is. */
import { useState } from "react";
import { toast } from "sonner";
import { Trophy } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle, Select, SelectItem } from "@/components/ui";
import { taka } from "@/components/orders/order-pickers";
import { CommissionBadge } from "@/components/sales/commission-table";
import { errorText } from "@/lib/features/content/content-api-slice";
import { useCan } from "@/lib/permissions";
import { useOrderCommissionQuery, useSalespeopleQuery, useSetOrderSalespersonMutation } from "@/lib/features/sales/sales-api-slice";

export function OrderSalesperson({ orderId }: { orderId: string }) {
  const { can } = useCan();
  const canEdit = can("commissions.edit");
  const { data } = useOrderCommissionQuery(orderId);
  const { data: people = [] } = useSalespeopleQuery(undefined, { skip: !canEdit });
  const [set, { isLoading }] = useSetOrderSalespersonMutation();
  const [editing, setEditing] = useState(false);
  const [pick, setPick] = useState("");
  if (!data || (!data.salesperson && !canEdit)) return null;
  const c = data.commission;
  const paidOut = c?.state === "PAID";

  return (
    <Card className="border-slate-200 shadow-sm dark:border-slate-800">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Trophy className="h-4 w-4 text-indigo-600" /> Salesperson
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 pb-4 text-sm">
        {editing ? (
          <div className="flex gap-2">
            <div className="flex-1">
              <Select aria-label="Salesperson" value={pick} onValueChange={setPick}>
                <SelectItem value="">Nobody</SelectItem>
                {people.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </Select>
            </div>
            <Button
              size="sm"
              disabled={isLoading}
              onClick={async () => {
                try {
                  await set({ orderId, salespersonId: pick || null }).unwrap();
                  toast.success("Salesperson saved");
                  setEditing(false);
                } catch (e) {
                  toast.error(errorText(e));
                }
              }}
            >
              Save
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">{data.salesperson?.name ?? <span className="font-normal text-slate-500">Nobody</span>}</span>
            {canEdit && !paidOut && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setPick(data.salesperson?.id ?? "");
                  setEditing(true);
                }}
              >
                Change
              </Button>
            )}
          </div>
        )}
        {c && (
          <div className="flex items-center justify-between">
            <span className="text-slate-500">
              Commission on {taka(c.base)} ({[...new Set(c.lines.map((l) => `${l.rate}%`))].join(", ")})
            </span>
            <span className="flex items-center gap-2 font-medium tabular-nums">
              {taka(c.amount)} <CommissionBadge state={c.state} />
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
