"use client";

/** Book many orders with one courier account; shows each order's result. */
import { useEffect, useState } from "react";
import { useStorefrontOptionsQuery } from "@/lib/features/storefronts/storefronts-api-slice";
import Link from "next/link";
import { toast } from "sonner";
import { CheckCircle2, XCircle } from "lucide-react";
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
import { apiError } from "@/lib/features/operations/fulfilment-api-slice";
import { useActiveCouriersQuery, useBulkBookCourierMutation, type BulkResult } from "@/lib/features/operations/couriers-api-slice";

/** Bulk booking choice: each order goes to its storefront's courier. */
const EACH = "storefront";

export function BulkBookDialog({ orderIds, onClose }: { orderIds: (string | number)[]; onClose: () => void }) {
  const { data: accounts } = useActiveCouriersQuery();
  const [accountId, setAccountId] = useState("");
  const { data: storefronts = [] } = useStorefrontOptionsQuery();
  const severalFronts = storefronts.length > 1;
  const [result, setResult] = useState<BulkResult | null>(null);
  const [run, { isLoading }] = useBulkBookCourierMutation();
  useEffect(() => {
    if (!accountId && accounts?.length) setAccountId(accounts[0]!.id);
  }, [accounts, accountId]);

  async function submit() {
    try {
      const r = await run({ ...(accountId === EACH ? {} : { accountId }), orderIds }).unwrap();
      setResult(r);
      if (r.failed === 0) toast.success(`${r.booked} order(s) booked`);
      else toast.warning(`${r.booked} booked, ${r.failed} need attention`);
    } catch (e) {
      toast.error(apiError(e, "Couldn't book"));
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Book {orderIds.length} order(s) with a courier</DialogTitle>
          <DialogDescription>
            Each order's ready parcel is booked, or a parcel is made with everything not packed yet. Pathao and RedX areas are matched from the
            address; orders that don't match are listed so you can book them from the order page.
          </DialogDescription>
        </DialogHeader>
        {!accounts?.length ? (
          <p className="text-sm text-slate-600">
            Connect a courier first in <Link href="/settings/couriers" className="text-indigo-600 hover:underline">Settings → Couriers</Link>.
          </p>
        ) : !result ? (
          <div>
            <Label className="text-xs mb-1 block">Courier</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.label}{a.label !== a.courierName ? ` (${a.courierName})` : ""}</SelectItem>
              ))}
              {severalFronts && <SelectItem value={EACH}>Each storefront&apos;s courier</SelectItem>}
            </Select>
            {accountId === EACH && (
              <p className="mt-1 text-xs text-slate-500">Each order goes to the courier set on its storefront (Online Store → Storefronts).</p>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
            {result.results.map((r) => (
              <li key={r.orderId} className="py-2 flex items-start gap-2">
                {r.ok ? <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5" /> : <XCircle className="h-4 w-4 text-red-600 mt-0.5" />}
                <div>
                  <Link href={`/orders/${r.orderId}`} className="font-medium text-indigo-600 hover:underline">{r.number}</Link>
                  <div className="text-xs text-slate-500">{r.ok ? `${r.parcel} · ${r.consignmentId}` : r.error}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{result ? "Close" : "Cancel"}</Button>
          {!result && accounts?.length ? <Button onClick={submit} disabled={isLoading || !accountId}>{isLoading ? "Booking…" : "Book"}</Button> : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
