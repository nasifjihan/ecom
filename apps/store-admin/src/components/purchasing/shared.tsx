"use client";

/** Pieces shared by the purchasing pages: the supplier form, the pay-supplier dialog and a few small bits. */
import * as React from "react";
import { toast } from "sonner";
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Textarea, cn } from "@/components/ui";
import { Field, Toggle } from "@/components/content/shared";
import { errorText } from "@/lib/features/content/content-api-slice";
import {
  PAYMENT_METHOD_LABELS,
  tk,
  today,
  useCreateSupplierMutation,
  useMoneyAccountsQuery,
  usePaySupplierMutation,
  useUpdateSupplierMutation,
  type PaymentMethod,
  type Supplier,
} from "@/lib/features/purchasing/purchasing-api-slice";

export const SELECT = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

/** Owed (red), paid ahead (green) or settled. */
export function Balance({ value, className }: { value: number; className?: string }) {
  if (Math.abs(value) < 0.005) return <span className={cn("text-slate-500", className)}>Settled</span>;
  return value > 0 ? (
    <span className={cn("font-medium text-red-700", className)}>{tk(value)} owed</span>
  ) : (
    <span className={cn("font-medium text-emerald-700", className)}>{tk(-value)} paid ahead</span>
  );
}

export function StatusPill({ status }: { status: string }) {
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", status === "cancelled" ? "bg-slate-100 text-slate-600" : "bg-emerald-100 text-emerald-800")}>
      {status}
    </span>
  );
}

const num = (s: string) => (s.trim() === "" ? undefined : Number(s));

/** Add a supplier, or edit one when `supplier` is given. Calls `onSaved` with the saved supplier's id. */
export function SupplierDialog({
  open,
  onOpenChange,
  supplier,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  supplier?: Supplier | null;
  onSaved?: (id: string) => void;
}) {
  const blank = { name: "", contactPerson: "", contactPhone: "", contactEmail: "", countryCode: "", address: "", notes: "", openingBalance: "" };
  const [f, setF] = React.useState(blank);
  const [active, setActive] = React.useState(true);
  const [create, c] = useCreateSupplierMutation();
  const [update, u] = useUpdateSupplierMutation();

  React.useEffect(() => {
    if (!open) return;
    setF(
      supplier
        ? {
            name: supplier.name,
            contactPerson: supplier.contactPerson ?? "",
            contactPhone: supplier.contactPhone ?? "",
            contactEmail: supplier.contactEmail ?? "",
            countryCode: supplier.countryCode ?? "",
            address: supplier.address ?? "",
            notes: supplier.notes ?? "",
            openingBalance: supplier.openingBalance ? String(supplier.openingBalance) : "",
          }
        : blank,
    );
    setActive(supplier?.isActive ?? true);
  }, [open, supplier]);

  const set = (k: keyof typeof blank) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

  const save = async () => {
    const body = { ...f, openingBalance: num(f.openingBalance) ?? 0, isActive: active };
    try {
      const s = supplier ? await update({ id: supplier.id, ...body }).unwrap() : await create(body).unwrap();
      toast.success(supplier ? "Supplier saved" : "Supplier added");
      onOpenChange(false);
      onSaved?.(s.id);
    } catch (e) {
      toast.error(errorText(e));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{supplier ? "Edit supplier" : "Add supplier"}</DialogTitle>
          <DialogDescription>Who you buy stock from. Their balance is worked out from purchases and payments.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="s-name" className="sm:col-span-2">
            <Input id="s-name" value={f.name} onChange={set("name")} placeholder="e.g. Karim Textiles" />
          </Field>
          <Field label="Contact person" htmlFor="s-person">
            <Input id="s-person" value={f.contactPerson} onChange={set("contactPerson")} />
          </Field>
          <Field label="Phone" htmlFor="s-phone">
            <Input id="s-phone" value={f.contactPhone} onChange={set("contactPhone")} inputMode="tel" />
          </Field>
          <Field label="Email" htmlFor="s-email">
            <Input id="s-email" type="email" value={f.contactEmail} onChange={set("contactEmail")} />
          </Field>
          <Field label="Country" htmlFor="s-country">
            <Input id="s-country" value={f.countryCode} onChange={set("countryCode")} placeholder="Bangladesh" />
          </Field>
          <Field label="Address" htmlFor="s-address" className="sm:col-span-2">
            <Input id="s-address" value={f.address} onChange={set("address")} />
          </Field>
          <Field
            label="Opening balance (৳)"
            htmlFor="s-opening"
            hint="What you already owed them when you started using this. Negative if you had paid ahead."
            className="sm:col-span-2"
          >
            <Input id="s-opening" type="number" step="0.01" value={f.openingBalance} onChange={set("openingBalance")} placeholder="0" />
          </Field>
          <Field label="Notes" htmlFor="s-notes" className="sm:col-span-2">
            <Textarea id="s-notes" rows={2} value={f.notes} onChange={set("notes")} />
          </Field>
          {supplier && (
            <div className="sm:col-span-2">
              <Toggle checked={active} onChange={setActive} label="Active" hint="Turned-off suppliers aren't offered for new purchases." />
            </div>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={c.isLoading || u.isLoading || f.name.trim().length < 2}>
            {supplier ? "Save" : "Add supplier"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Record a payment to a supplier (optionally against one purchase); the money leaves the chosen account. */
export function PayDialog({
  open,
  onOpenChange,
  supplierId,
  supplierName,
  purchaseId,
  purchaseNumber,
  suggested,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  supplierId: string;
  supplierName: string;
  purchaseId?: string;
  purchaseNumber?: string;
  /** Pre-filled amount, e.g. what is still owed. */
  suggested?: number;
}) {
  const { data: accounts } = useMoneyAccountsQuery();
  const live = (accounts ?? []).filter((a) => a.isActive);
  const [amount, setAmount] = React.useState("");
  const [accountId, setAccountId] = React.useState("");
  const [method, setMethod] = React.useState<PaymentMethod>("cash");
  const [paidOn, setPaidOn] = React.useState(today());
  const [reference, setReference] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [pay, { isLoading }] = usePaySupplierMutation();

  React.useEffect(() => {
    if (!open) return;
    setAmount(suggested && suggested > 0 ? String(suggested) : "");
    setPaidOn(today());
    setReference("");
    setNotes("");
  }, [open, suggested]);
  React.useEffect(() => {
    if (!accountId && live[0]) setAccountId(live[0].id);
  }, [accountId, live]);

  const account = live.find((a) => a.id === accountId);
  const value = Number(amount);
  const short = !!account && value > account.balance;

  const save = async () => {
    try {
      await pay({ supplierId, purchaseId: purchaseId ?? null, accountId, amount: value, method, paidOn, reference, notes }).unwrap();
      toast.success(`Paid ${tk(value)} to ${supplierName}`);
      onOpenChange(false);
    } catch (e) {
      toast.error(errorText(e));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Pay {supplierName}</DialogTitle>
          <DialogDescription>{purchaseNumber ? `Against purchase ${purchaseNumber}.` : "Lowers what you owe this supplier."}</DialogDescription>
        </DialogHeader>
        {live.length === 0 ? (
          <p className="text-sm text-slate-600">
            Add a money account first (Purchasing → Accounts) so the payment has somewhere to come from.
          </p>
        ) : (
          <div className="grid gap-4">
            <Field label="Amount (৳)" htmlFor="p-amount" error={short ? `${account.name} only has ${tk(account.balance)}` : null}>
              <Input id="p-amount" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="From account" htmlFor="p-account">
                <select id="p-account" className={SELECT} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                  {live.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({tk(a.balance)})
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Method" htmlFor="p-method">
                <select id="p-method" className={SELECT} value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
                  {Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Date" htmlFor="p-date">
                <Input id="p-date" type="date" value={paidOn} max={today()} onChange={(e) => setPaidOn(e.target.value)} />
              </Field>
              <Field label="Reference" htmlFor="p-ref">
                <Input id="p-ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="TrxID / cheque no." />
              </Field>
            </div>
            <Field label="Note" htmlFor="p-notes">
              <Input id="p-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
          </div>
        )}
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={isLoading || !accountId || !(value > 0) || short}>
            Record payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Previous / Page x of y / Next. */
export function Pager({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-end gap-2 text-sm">
      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Previous
      </Button>
      <span>
        Page {page} of {totalPages}
      </span>
      <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
        Next
      </Button>
    </div>
  );
}
