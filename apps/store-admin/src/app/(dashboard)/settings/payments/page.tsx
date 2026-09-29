"use client";

/**
 * Payment methods customers can choose at checkout. bKash, Nagad and Rocket run in "send money"
 * mode: customers pay the shop's number and type the transaction ID, which staff verify.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Wallet } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  Input,
  Label,
  Select,
  SelectItem,
  Skeleton,
  Textarea,
  cn,
} from "@/components/ui";
import { apiError } from "@/lib/features/operations/fulfilment-api-slice";
import { usePaymentMethodsQuery, useUpdatePaymentMethodMutation, type PaymentMethodSetting } from "@/lib/features/operations/payments-api-slice";
import { useCan } from "@/lib/permissions";

const ACCOUNT_TYPES = [
  { value: "personal", label: "Personal (customers use Send Money)" },
  { value: "agent", label: "Agent (customers use Cash Out)" },
  { value: "merchant", label: "Merchant (customers use Make Payment)" },
];

export default function PaymentMethodsPage() {
  const { data, isLoading } = usePaymentMethodsQuery();
  const { can } = useCan();
  const canEdit = can("settings.edit");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Wallet className="h-5 w-5" /> Payment methods
        </CardTitle>
        <CardDescription>
          What customers can pay with at checkout. For bKash, Nagad and Rocket, customers send money to your number and type the transaction ID;
          you check it under Orders → Payments to verify.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
        {data?.map((m) => <MethodCard key={m.code} method={m} canEdit={canEdit} />)}
      </CardContent>
    </Card>
  );
}

function MethodCard({ method: m, canEdit }: { method: PaymentMethodSetting; canEdit: boolean }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(m);
  const [save, { isLoading }] = useUpdatePaymentMethodMutation();
  useEffect(() => setForm(m), [m]);

  const manual = form.mode === "manual" || m.code === "bank_transfer";
  const wallet = m.manualCapable && m.code !== "bank_transfer";
  const online = !m.manualCapable && m.code !== "cod";

  async function submit(patch?: Partial<PaymentMethodSetting>) {
    const next = { ...form, ...patch };
    try {
      await save({
        code: m.code,
        enabled: next.enabled,
        name: next.name,
        description: next.description ?? "",
        instructions: next.instructions ?? "",
        ...(m.manualCapable ? { mode: m.code === "bank_transfer" ? "manual" : next.mode, accountNumber: next.accountNumber ?? "" } : {}),
        ...(wallet && next.accountType ? { accountType: next.accountType } : {}),
        feeFixed: Number(next.feeFixed) || 0,
        feePercent: Number(next.feePercent) || 0,
      }).unwrap();
      toast.success(`${next.name} saved`);
      setOpen(false);
    } catch (e) {
      toast.error(apiError(e, "Couldn't save"));
      setForm(m);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-900 dark:text-white">{m.name}</span>
            <Badge variant="outline" className={cn("text-[11px]", m.enabled ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "text-slate-500")}>
              {m.enabled ? "On" : "Off"}
            </Badge>
            {m.manualCapable && m.mode === "manual" && <Badge variant="outline" className="text-[11px]">Verify by hand</Badge>}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {m.code === "cod" && "Customers pay the courier or your rider on delivery."}
            {wallet && m.mode === "manual" && (m.accountNumber ? `Customers send money to ${m.accountNumber}${m.accountType ? ` (${m.accountType})` : ""}.` : "Add your number to turn it on.")}
            {wallet && m.mode === "online" && "Online checkout needs a merchant account set up for your store."}
            {m.code === "bank_transfer" && (m.instructions ? "Customers transfer to the bank account in the instructions." : "Add your bank details to turn it on.")}
            {online && "Online payment page. Needs a merchant account set up for your store."}
          </p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setOpen(!open)}>{open ? "Close" : "Edit"}</Button>
            <Button size="sm" variant={m.enabled ? "outline" : "default"} disabled={isLoading} onClick={() => void submit({ enabled: !m.enabled })}>
              {m.enabled ? "Turn off" : "Turn on"}
            </Button>
          </div>
        )}
      </div>
      {open && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-xs mb-1 block">Name at checkout</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-9" />
          </div>
          {wallet && (
            <div>
              <Label className="text-xs mb-1 block">How customers pay</Label>
              <Select value={form.mode} onValueChange={(v) => setForm({ ...form, mode: v as "manual" | "online" })}>
                <SelectItem value="manual">Send to our number, enter transaction ID</SelectItem>
                <SelectItem value="online">Online payment page</SelectItem>
              </Select>
            </div>
          )}
          {wallet && manual && (
            <>
              <div>
                <Label className="text-xs mb-1 block">{m.name} number</Label>
                <Input value={form.accountNumber ?? ""} onChange={(e) => setForm({ ...form, accountNumber: e.target.value })} placeholder="01XXXXXXXXX" className="h-9" />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Account type</Label>
                <Select value={form.accountType ?? "personal"} onValueChange={(v) => setForm({ ...form, accountType: v as PaymentMethodSetting["accountType"] })}>
                  {ACCOUNT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </Select>
              </div>
            </>
          )}
          <div className="sm:col-span-2">
            <Label className="text-xs mb-1 block">{m.code === "bank_transfer" ? "Bank details and instructions" : "Instructions shown at checkout"}</Label>
            <Textarea
              rows={3}
              value={form.instructions ?? ""}
              onChange={(e) => setForm({ ...form, instructions: e.target.value })}
              placeholder={m.code === "bank_transfer" ? "Bank, branch, account name, account number, routing number" : "e.g. Use Send Money, then enter the TrxID from the SMS"}
            />
          </div>
          <div>
            <Label className="text-xs mb-1 block">Fee: fixed (৳)</Label>
            <Input type="number" min={0} step="0.01" value={form.feeFixed} onChange={(e) => setForm({ ...form, feeFixed: Number(e.target.value) })} className="h-9" />
          </div>
          <div>
            <Label className="text-xs mb-1 block">Fee: % of the order</Label>
            <Input type="number" min={0} step="0.01" value={form.feePercent} onChange={(e) => setForm({ ...form, feePercent: Number(e.target.value) })} className="h-9" />
          </div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <Checkbox checked={form.enabled} onCheckedChange={(v) => setForm({ ...form, enabled: v })} /> Customers can choose {form.name}
          </label>
          <div className="sm:col-span-2 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => { setForm(m); setOpen(false); }}>Cancel</Button>
            <Button size="sm" disabled={isLoading} onClick={() => void submit()}>Save</Button>
          </div>
        </div>
      )}
    </div>
  );
}
