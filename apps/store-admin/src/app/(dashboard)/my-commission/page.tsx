"use client";

/** My commission: my month's sales and commission, my target, my share link and my orders. */
import { useState } from "react";
import { toast } from "sonner";
import { Coins, Copy } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle, Select, SelectItem, Skeleton } from "@/components/ui";
import { EmptyState, PageTitle, STOREFRONT_URL } from "@/components/content/shared";
import { taka } from "@/components/orders/order-pickers";
import { CommissionTable, ProgressBar } from "@/components/sales/commission-table";
import { useCan } from "@/lib/permissions";
import { recentMonths, useMyCommissionQuery } from "@/lib/features/sales/sales-api-slice";

const MONTHS = recentMonths(12);

export default function MyCommissionPage() {
  const { can } = useCan();
  const [month, setMonth] = useState(MONTHS[0]!.value);
  const { data } = useMyCommissionQuery(month);
  const label = MONTHS.find((m) => m.value === month)?.label ?? month;

  if (!data) return <Skeleton className="h-64" />;
  if (!data.isSalesperson) {
    return <EmptyState icon={Coins} title="You're not on the sales team" text="Ask the shop owner to add you under Orders → Sales team." />;
  }
  const link = data.salesCode ? `${STOREFRONT_URL}/?sp=${data.salesCode}` : null;

  return (
    <div className="space-y-6">
      <PageTitle
        icon={Coins}
        title="My commission"
        description="Commission is earned when an order is delivered and paid. Refunds take back their share."
        actions={
          <div className="w-48">
            <Select aria-label="Month" value={month} onValueChange={setMonth}>
              {MONTHS.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </Select>
          </div>
        }
      />
      {!data.enabled && (
        <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          Commission is switched off right now, so new orders don&apos;t earn any.
        </p>
      )}
      <div className="grid gap-3 md:grid-cols-4">
        {[
          ["Sales", data.sales, `${data.orders} ${data.orders === 1 ? "order" : "orders"} delivered and paid in ${label}`],
          ["Earned", data.earned, `Commission in ${label}`],
          ["Waiting", data.pending, `${data.pendingOrders} ${data.pendingOrders === 1 ? "order" : "orders"} not delivered and paid yet`],
          ["Not paid yet", data.unpaid, "Earned, waiting for payout"],
        ].map(([l, v, h]) => (
          <Card key={l as string}>
            <CardContent className="p-4">
              <p className="text-xs text-slate-500">{l}</p>
              <p className="text-2xl font-semibold tabular-nums">{taka(v as number)}</p>
              <p className="text-xs text-slate-500">{h}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <CardContent className="space-y-2 p-4">
            <p className="text-sm font-medium">Target for {label}</p>
            {data.target ? (
              <>
                <p className="text-sm tabular-nums">
                  {taka(data.sales)} of {taka(data.target)} ({data.progress}%)
                </p>
                <ProgressBar value={data.progress} />
                <p className="text-xs text-slate-500">
                  {data.sales >= data.target ? "Target reached." : `${taka(data.target - data.sales)} to go.`}
                </p>
              </>
            ) : (
              <p className="text-sm text-slate-500">No target set for this month.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-2 p-4">
            <p className="text-sm font-medium">My share link</p>
            {link ? (
              <>
                <p className="break-all font-mono text-sm">{link}</p>
                <p className="text-xs text-slate-500">Online orders from this link (or any shop link ending in ?sp={data.salesCode}) are credited to you.</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    void navigator.clipboard?.writeText(link);
                    toast.success("Link copied");
                  }}
                >
                  <Copy className="mr-1.5 h-4 w-4" /> Copy link
                </Button>
              </>
            ) : (
              <p className="text-sm text-slate-500">No share link yet; ask the owner for a code.</p>
            )}
            {data.extraPct > 0 && <p className="text-xs text-slate-500">You get {data.extraPct}% extra on every rate.</p>}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">My orders</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <CommissionTable rows={data.rows} linkOrders={can("orders.view")} />
        </CardContent>
      </Card>
    </div>
  );
}
