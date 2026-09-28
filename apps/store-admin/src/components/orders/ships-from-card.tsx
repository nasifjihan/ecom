"use client";

/**
 * Where an order ships from: the warehouse holding its stock, each line's held units against what's
 * on that shelf, where else the stock is, and (while it's open) moving the order to another warehouse.
 */
import Link from "next/link";
import { toast } from "sonner";
import { AlertTriangle, Warehouse } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, cn } from "@/components/ui";
import { errorText } from "@/lib/features/content/content-api-slice";
import { useMoveOrderWarehouseMutation, useOrderStockQuery } from "@/lib/features/warehouses/warehouses-api-slice";

export function ShipsFromCard({ orderId, canEdit }: { orderId: string | number; canEdit: boolean }) {
  const { data } = useOrderStockQuery(String(orderId));
  const [move, { isLoading }] = useMoveOrderWarehouseMutation();
  if (!data) return null;
  const held = data.lines.reduce((a, l) => a + l.held, 0);
  const short = data.lines.filter((l) => l.short > 0);
  // Only worth showing when there's a choice to make or something to fix.
  if (data.warehouses.length < 2 && !short.length) return null;

  return (
    <Card className="border-slate-200 shadow-sm dark:border-slate-800">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Warehouse className="h-4 w-4 text-indigo-600" /> Ships from
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {canEdit && data.canMove ? (
            <select
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              value={data.warehouse?.id ?? ""}
              disabled={isLoading}
              aria-label="Ships from"
              onChange={async (e) => {
                try {
                  await move({ orderId: String(orderId), warehouseId: e.target.value }).unwrap();
                  toast.success("The order's stock is now held there");
                } catch (err) {
                  toast.error(errorText(err));
                }
              }}
            >
              {data.warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.code})
                </option>
              ))}
            </select>
          ) : (
            <span className="font-medium">{data.warehouse ? `${data.warehouse.name} (${data.warehouse.code})` : "Default warehouse"}</span>
          )}
          <span className="text-xs text-slate-500">{held ? `${held} unit${held > 1 ? "s" : ""} held until packed` : "Nothing held (packed, or finished)"}</span>
        </div>
        {held > 0 && (
          <ul className="divide-y rounded-lg border text-sm">
            {data.lines
              .filter((l) => l.held > 0)
              .map((l) => (
                <li key={l.orderItemId} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                  <span className="min-w-0 truncate">{l.name}</span>
                  <span className={cn("tabular-nums", l.short ? "font-medium text-red-700" : "text-slate-600")}>
                    {l.held} held · {l.onShelf} on the shelf
                    {l.elsewhere.length ? ` · ${l.elsewhere.map((x) => `${x.code} ${x.free}`).join(", ")} free elsewhere` : ""}
                  </span>
                </li>
              ))}
          </ul>
        )}
        {short.length > 0 && (
          <p className="flex items-start gap-1.5 text-xs text-amber-800">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            This warehouse doesn&apos;t have all of it on the shelf yet. Ship from another warehouse above, or{" "}
            <Link href="/inventory/transfers/new" className="underline">
              transfer stock in
            </Link>{" "}
            before packing.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
