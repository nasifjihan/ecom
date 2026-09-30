"use client";

/**
 * Payment methods customers can choose at checkout. bKash, Nagad and Rocket can run in "send money"
 * mode: customers pay the shop's number and type the transaction ID, which staff verify. bKash and
 * SSLCommerz can also take payments online with the store's own merchant keys (GatewayKeys).
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, KeyRound, Loader2, Wallet, XCircle } from "lucide-react";
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
import {
  useGatewayKeysQuery,
  usePaymentMethodsQuery,
  useSaveGatewayKeysMutation,
  useTestGatewayKeysMutation,
  useUpdatePaymentMethodMutation,
  type PaymentMethodSetting,
} from "@/lib/features/operations/payments-api-slice";
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
          What customers can pay with at checkout. For bKash, Nagad and Rocket sent to your number, customers type the transaction ID and you
          verify it under Orders → Payments. bKash and SSLCommerz can also take payments online with your merchant keys: an order is marked paid
          only when the gateway itself confirms the payment.
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
  // A refresh (e.g. after saving keys) mustn't undo edits made while the form is open.
  useEffect(() => {
    if (!open) setForm(m);
  }, [m, open]);

  const manual = form.mode === "manual" || m.code === "bank_transfer";
  const wallet = m.manualCapable && m.code !== "bank_transfer";
  // Online through our own gateway connection (bKash in online mode, SSLCommerz).
  const onlineGateway = m.onlineCapable && (m.code === "sslcommerz" || form.mode === "online");
  const unavailable = !m.manualCapable && !m.onlineCapable && m.code !== "cod";

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
            {m.onlineCapable && (m.code === "sslcommerz" || m.mode === "online") &&
              (!m.keysSet
                ? `Add your ${m.name} merchant keys to take payments online.`
                : m.keysTestOk
                  ? `Customers pay on ${m.name}'s page; the order is paid once ${m.name} confirms it.`
                  : `Keys saved. Test them before turning ${m.name} on.`)}
            {wallet && !m.onlineCapable && m.mode === "online" && "Online payments aren't available for this method yet. Switch it to “send to our number”."}
            {m.code === "bank_transfer" && (m.instructions ? "Customers transfer to the bank account in the instructions." : "Add your bank details to turn it on.")}
            {unavailable && "Not available yet."}
          </p>
        </div>
        {canEdit && !(unavailable && !m.enabled) && (
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
                {(m.onlineCapable || m.mode === "online") && <SelectItem value="online">Online payment page ({m.name} merchant)</SelectItem>}
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
          {onlineGateway && (
            <div className="sm:col-span-2">
              <GatewayKeys code={m.code} name={m.name} />
            </div>
          )}
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

/**
 * A gateway's merchant keys: sandbox or live, each key (saved ones come back masked; leave a box
 * empty to keep it), Save and Test connection. Keys are stored encrypted and never shown again.
 */
function GatewayKeys({ code, name }: { code: string; name: string }) {
  const { data, isLoading } = useGatewayKeysQuery(code);
  const [save, { isLoading: saving }] = useSaveGatewayKeysMutation();
  const [test, { isLoading: testing }] = useTestGatewayKeysMutation();
  const [mode, setMode] = useState<"sandbox" | "live">("sandbox");
  const [values, setValues] = useState<Record<string, string>>({});
  useEffect(() => {
    if (data) setMode(data.mode);
  }, [data]);

  if (isLoading || !data) return <Skeleton className="h-40 w-full rounded-lg" />;

  const typed = Object.values(values).some((v) => v.trim() !== "");
  const dirty = typed || mode !== data.mode;

  async function onSave() {
    try {
      await save({ code, mode, credentials: values }).unwrap();
      setValues({});
      toast.success(`${name} keys saved. Test them before turning ${name} on.`);
    } catch (e) {
      toast.error(apiError(e, "Couldn't save the keys"));
    }
  }

  async function onTest() {
    try {
      const r = await test(code).unwrap();
      if (r.ok) toast.success(r.note);
      else toast.error(r.note);
    } catch (e) {
      toast.error(apiError(e, "Couldn't test the keys"));
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/40">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <KeyRound className="h-4 w-4" /> {name} merchant keys
        </div>
        {data.lastTest && (
          <span className={cn("flex items-center gap-1 text-xs", data.lastTest.ok ? "text-emerald-700 dark:text-emerald-400" : "text-red-600")}>
            {data.lastTest.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
            {data.lastTest.note ?? (data.lastTest.ok ? "Keys work" : "Keys didn't work")}
          </span>
        )}
      </div>
      <p className="mb-3 text-xs text-slate-500">
        From your {name} merchant panel. Use sandbox keys to try it out, then switch to live. Saved keys are encrypted and shown masked; leave a
        box empty to keep what&apos;s saved.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label className="mb-1 block text-xs">Mode</Label>
          <Select value={mode} onValueChange={(v) => setMode(v === "live" ? "live" : "sandbox")} aria-label={`${name} mode`}>
            <SelectItem value="sandbox">Sandbox (test payments)</SelectItem>
            <SelectItem value="live">Live (real money)</SelectItem>
          </Select>
        </div>
        {data.fields.map((f) => (
          <div key={f.key}>
            <Label htmlFor={`${code}-${f.key}`} className="mb-1 block text-xs">
              {f.label}
            </Label>
            <Input
              id={`${code}-${f.key}`}
              type={f.secret ? "password" : "text"}
              autoComplete="off"
              className="h-9"
              placeholder={f.value ? `Saved: ${f.value}` : "Not set"}
              value={values[f.key] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
            />
          </div>
        ))}
      </div>
      {data.ipnUrl && (
        <p className="mt-3 break-all text-xs text-slate-500">
          In the SSLCommerz panel, set the IPN URL to <code className="rounded bg-white px-1 py-0.5 dark:bg-slate-800">{data.ipnUrl}</code>
        </p>
      )}
      {mode === "live" && <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">Live mode takes real money from customers.</p>}
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <Button size="sm" variant="outline" disabled={!data.set || dirty || testing} onClick={() => void onTest()}>
          {testing && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
          Test connection
        </Button>
        <Button size="sm" disabled={!dirty || saving} onClick={() => void onSave()}>
          {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
          Save keys
        </Button>
      </div>
    </div>
  );
}
