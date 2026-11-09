"use client";

/**
 * "This number belongs to …": shown under a phone field (Create customer, New order) once the typed
 * number matches a customer, with their other names and orders, and a button to use them.
 */
import Link from "next/link";
import { UserCheck } from "lucide-react";
import { Button } from "@/components/ui";
import { useDebounced } from "@/components/orders/order-pickers";
import { useCustomerByPhoneQuery, type PhoneOwner } from "@/lib/features/operations/operations-api-slice";

const digits = (s: string) => s.replace(/\D/g, "");

export function usePhoneOwner(phone: string) {
  const typed = useDebounced(phone.trim(), 400);
  const { data } = useCustomerByPhoneQuery(typed, { skip: digits(typed).length < 10 });
  return digits(typed).length < 10 ? null : data ?? null;
}

export function PhoneOwnerNote({ owner, onUse, useLabel = "Use this customer" }: { owner: PhoneOwner | null; onUse?: (o: PhoneOwner) => void; useLabel?: string }) {
  if (!owner) return null;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
      <UserCheck className="h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1">
        This number belongs to{" "}
        <Link href={`/customers/${owner.id}`} className="font-semibold underline">
          {owner.name}
        </Link>{" "}
        ({owner.orderCount} order{owner.orderCount === 1 ? "" : "s"}){owner.otherNames.length ? `, also ordered as ${owner.otherNames.join(", ")}` : ""}
        {owner.banned ? " · banned" : ""}.
      </span>
      {onUse && (
        <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => onUse(owner)}>
          {useLabel}
        </Button>
      )}
    </div>
  );
}
