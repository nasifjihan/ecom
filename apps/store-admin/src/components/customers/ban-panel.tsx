"use client";

/** Ban a customer (they can't sign in or order, even as a guest with their phone/email), or lift it. */
import { useState } from "react";
import { toast } from "sonner";
import { Ban, ShieldCheck } from "lucide-react";
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input } from "@/components/ui";
import { errorText } from "@/lib/features/content/content-api-slice";
import { useCan } from "@/lib/permissions";
import { useBanCustomerMutation, useUnbanCustomerMutation, type Customer } from "@/lib/features/operations/operations-api-slice";

export function BanBanner({ customer }: { customer: Customer }) {
  const [unban, { isLoading }] = useUnbanCustomerMutation();
  const { can } = useCan();
  if (!customer.banned) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
      <span>
        <Ban className="mr-1.5 inline h-4 w-4" />
        <strong>Banned</strong>
        {customer.bannedAt ? ` on ${new Date(customer.bannedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}` : ""}
        {customer.banReason ? `: ${customer.banReason}` : ""}. They can&apos;t sign in or place orders, even as a guest with this phone or email.
      </span>
      {can("customers.edit") && (
        <Button
          variant="outline"
          size="sm"
          disabled={isLoading}
          onClick={async () => {
            try {
              await unban(customer.id).unwrap();
              toast.success("Ban lifted");
            } catch (e) {
              toast.error(errorText(e));
            }
          }}
        >
          <ShieldCheck className="mr-1 h-4 w-4" /> Lift ban
        </Button>
      )}
    </div>
  );
}

export function BanButton({ customer }: { customer: Customer }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [ban, { isLoading }] = useBanCustomerMutation();
  const { can } = useCan();
  if (customer.banned || !can("customers.edit")) return null;
  return (
    <>
      <Button variant="outline" size="sm" className="gap-1.5 text-red-700" onClick={() => setOpen(true)}>
        <Ban className="h-4 w-4" /> Ban
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ban {customer.name}?</DialogTitle>
            <DialogDescription>
              They won&apos;t be able to sign in or order, signed in or as a guest using {customer.phone ?? "their phone"}
              {customer.email ? ` or ${customer.email}` : ""}. Orders already placed aren&apos;t touched.
            </DialogDescription>
          </DialogHeader>
          <Input aria-label="Reason" placeholder="Why, e.g. refused 3 cash-on-delivery parcels" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={isLoading || reason.trim().length < 3}
              onClick={async () => {
                try {
                  await ban({ id: customer.id, reason: reason.trim() }).unwrap();
                  toast.success(`${customer.name} banned`);
                  setOpen(false);
                  setReason("");
                } catch (e) {
                  toast.error(errorText(e));
                }
              }}
            >
              Ban customer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
