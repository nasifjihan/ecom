"use client";

/**
 * Courier accounts with an API: Steadfast, Pathao, RedX. Keys are stored encrypted and never shown
 * again (only their last 4 characters). Each account has a webhook URL to paste into the courier's
 * panel so parcel statuses update by themselves.
 */
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Copy, Truck, XCircle } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectItem,
  Skeleton,
  cn,
} from "@/components/ui";
import { apiError } from "@/lib/features/operations/fulfilment-api-slice";
import {
  COURIER_INFO,
  useCourierAccountsQuery,
  useCreateCourierAccountMutation,
  useDeleteCourierAccountMutation,
  useRotateCourierWebhookMutation,
  useTestCourierAccountMutation,
  useUpdateCourierAccountMutation,
  type CourierAccount,
  type CourierCode,
} from "@/lib/features/operations/couriers-api-slice";
import { useCan } from "@/lib/permissions";

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

function copy(text: string, what: string) {
  void navigator.clipboard?.writeText(text).then(
    () => toast.success(`${what} copied`),
    () => toast.error("Couldn't copy"),
  );
}

export default function CouriersPage() {
  const { data, isLoading } = useCourierAccountsQuery();
  const { can } = useCan();
  const canEdit = can("settings.edit");
  const [editing, setEditing] = useState<CourierAccount | "new" | null>(null);

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Truck className="h-5 w-5" /> Couriers
          </CardTitle>
          <CardDescription className="mt-1 max-w-2xl">
            Connect Steadfast, Pathao or RedX to book parcels from an order, print labels and have parcel statuses update themselves. Other
            couriers still work by hand: choose them on the parcel and type the tracking number.
          </CardDescription>
        </div>
        {canEdit && <Button onClick={() => setEditing("new")}>Add courier</Button>}
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && <Skeleton className="h-28 w-full rounded-xl" />}
        {data?.length === 0 && <p className="text-sm text-slate-500">No courier connected yet.</p>}
        {data?.map((a) => <AccountCard key={a.id} account={a} canEdit={canEdit} onEdit={() => setEditing(a)} />)}
      </CardContent>
      {editing && <AccountDialog account={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </Card>
  );
}

function AccountCard({ account: a, canEdit, onEdit }: { account: CourierAccount; canEdit: boolean; onEdit: () => void }) {
  const [test, { isLoading: testing }] = useTestCourierAccountMutation();
  const [update] = useUpdateCourierAccountMutation();
  const [remove] = useDeleteCourierAccountMutation();
  const [rotate] = useRotateCourierWebhookMutation();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const info = COURIER_INFO[a.courier];

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-900 dark:text-white">{a.label}</span>
            {a.label !== a.courierName && <span className="text-sm text-slate-500">{a.courierName}</span>}
            <Badge variant="outline" className={cn("text-[11px]", a.enabled ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "text-slate-500")}>{a.enabled ? "On" : "Off"}</Badge>
            {a.mode === "sandbox" && <Badge variant="outline" className="text-[11px] bg-amber-50 text-amber-700 border-amber-200">Sandbox</Badge>}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {Object.entries(a.credentialHints).map(([k, v]) => `${info.fields.find((f) => f.key === k)?.label ?? k} ${v ?? "—"}`).join(" · ")}
          </p>
          <p className="text-xs mt-1">
            {a.lastCheckedAt ? (
              a.lastError ? (
                <span className="text-red-600 inline-flex items-center gap-1"><XCircle className="h-3 w-3" /> {a.lastError} ({when(a.lastCheckedAt)})</span>
              ) : (
                <span className="text-emerald-600 inline-flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Connected ({when(a.lastCheckedAt)})</span>
              )
            ) : (
              <span className="text-slate-500">Not tested yet</span>
            )}
            {a.activeParcels > 0 && <span className="text-slate-500"> · {a.activeParcels} parcel(s) on the way</span>}
          </p>
        </div>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={testing}
              onClick={() => test(a.id).unwrap().then(setResult).catch((e: unknown) => toast.error(apiError(e, "Test failed")))}
            >
              {testing ? "Testing…" : "Test connection"}
            </Button>
            <Button size="sm" variant="outline" onClick={onEdit}>Edit</Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => update({ id: a.id, enabled: !a.enabled }).unwrap().catch((e: unknown) => toast.error(apiError(e, "Couldn't save")))}
            >
              {a.enabled ? "Turn off" : "Turn on"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                if (!window.confirm(`Remove ${a.label}? Its keys are deleted.`)) return;
                remove(a.id).unwrap().then(() => toast.success("Removed")).catch((e: unknown) => toast.error(apiError(e, "Couldn't remove")));
              }}
            >
              Remove
            </Button>
          </div>
        )}
      </div>
      {result && (
        <div className={cn("rounded-md px-3 py-2 text-sm", result.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800")}>{result.message}</div>
      )}
      {canEdit && (
        <div className="rounded-lg bg-slate-50 dark:bg-slate-900 p-3 space-y-2 text-xs">
          <p className="text-slate-600 dark:text-slate-400">{info.webhookHelp}</p>
          <div className="flex items-center gap-2">
            <span className="w-20 shrink-0 text-slate-500">Callback URL</span>
            <code className="flex-1 truncate font-mono">{a.webhookUrl}</code>
            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => copy(a.webhookUrl, "Callback URL")} aria-label="Copy callback URL"><Copy className="h-3.5 w-3.5" /></Button>
          </div>
          {a.courier !== "redx" && a.webhookSecret && (
            <div className="flex items-center gap-2">
              <span className="w-20 shrink-0 text-slate-500">Secret</span>
              <code className="flex-1 truncate font-mono">{a.webhookSecret}</code>
              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => copy(a.webhookSecret!, "Secret")} aria-label="Copy secret"><Copy className="h-3.5 w-3.5" /></Button>
            </div>
          )}
          <button
            type="button"
            className="text-indigo-600 hover:underline"
            onClick={() => {
              if (!window.confirm("Make a new callback URL and secret? Update them in the courier's panel afterwards.")) return;
              rotate(a.id).unwrap().then(() => toast.success("New callback URL made")).catch((e: unknown) => toast.error(apiError(e, "Couldn't change it")));
            }}
          >
            Make a new URL and secret
          </button>
        </div>
      )}
    </div>
  );
}

function AccountDialog({ account, onClose }: { account: CourierAccount | null; onClose: () => void }) {
  const [courier, setCourier] = useState<CourierCode>(account?.courier ?? "steadfast");
  const [label, setLabel] = useState(account?.label ?? "");
  const [mode, setMode] = useState<"sandbox" | "live">(account?.mode ?? "live");
  const [enabled, setEnabled] = useState(account?.enabled ?? true);
  const [creds, setCreds] = useState<Record<string, string>>({});
  const [settings, setSettings] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(account?.settings ?? {}).map(([k, v]) => [k, String(v)])),
  );
  const [create, { isLoading: creating }] = useCreateCourierAccountMutation();
  const [update, { isLoading: saving }] = useUpdateCourierAccountMutation();
  const info = COURIER_INFO[courier];

  const numbers = Object.fromEntries(Object.entries(settings).filter(([, v]) => v !== "").map(([k, v]) => [k, Number(v)]));
  async function submit() {
    const given = Object.fromEntries(Object.entries(creds).filter(([, v]) => v.trim()));
    try {
      if (account) {
        await update({ id: account.id, label, mode, enabled, settings: numbers, ...(Object.keys(given).length ? { credentials: given } : {}) }).unwrap();
      } else {
        await create({ courier, label, mode, enabled, credentials: given, settings: numbers }).unwrap();
      }
      toast.success(`${label || info.name} saved. Use "Test connection" to check the keys.`);
      onClose();
    } catch (e) {
      toast.error(apiError(e, "Couldn't save"));
    }
  }

  const set = (k: string, v: string) => setSettings({ ...settings, [k]: v });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{account ? `Edit ${account.label}` : "Add a courier"}</DialogTitle>
          <DialogDescription>{info.help}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-xs mb-1 block">Courier</Label>
            {account ? (
              <p className="h-10 flex items-center text-sm font-medium">{info.name}</p>
            ) : (
              <Select value={courier} onValueChange={(v) => { setCourier(v as CourierCode); setCreds({}); setSettings({}); }}>
                {(Object.keys(COURIER_INFO) as CourierCode[]).map((c) => (
                  <SelectItem key={c} value={c}>{COURIER_INFO[c].name}</SelectItem>
                ))}
              </Select>
            )}
          </div>
          <div>
            <Label className="text-xs mb-1 block">Name (optional)</Label>
            <Input className="h-10" value={label} onChange={(e) => setLabel(e.target.value)} placeholder={info.name} />
          </div>
          {info.fields.map((f) => (
            <div key={f.key} className={info.fields.length === 1 ? "sm:col-span-2" : ""}>
              <Label className="text-xs mb-1 block">{f.label}</Label>
              <Input
                className="h-9 font-mono"
                type={f.secret ? "password" : "text"}
                autoComplete="off"
                value={creds[f.key] ?? ""}
                onChange={(e) => setCreds({ ...creds, [f.key]: e.target.value })}
                placeholder={account?.credentialHints[f.key] ? `Saved (${account.credentialHints[f.key]}); leave empty to keep` : ""}
              />
            </div>
          ))}
          {courier !== "steadfast" && (
            <div>
              <Label className="text-xs mb-1 block">Environment</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as "sandbox" | "live")}>
                <SelectItem value="live">Live</SelectItem>
                <SelectItem value="sandbox">Sandbox (testing)</SelectItem>
              </Select>
            </div>
          )}
          {courier === "pathao" && (
            <>
              <div>
                <Label className="text-xs mb-1 block">Pickup store ID</Label>
                <Input className="h-9" value={settings.storeId ?? ""} onChange={(e) => set("storeId", e.target.value.replace(/\D/g, ""))} placeholder="Your default store" />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Delivery</Label>
                <Select value={settings.deliveryType ?? "48"} onValueChange={(v) => set("deliveryType", v)}>
                  <SelectItem value="48">Normal</SelectItem>
                  <SelectItem value="12">On demand</SelectItem>
                </Select>
              </div>
              <div>
                <Label className="text-xs mb-1 block">Item type</Label>
                <Select value={settings.itemType ?? "2"} onValueChange={(v) => set("itemType", v)}>
                  <SelectItem value="2">Parcel</SelectItem>
                  <SelectItem value="1">Document</SelectItem>
                </Select>
              </div>
            </>
          )}
          {courier === "redx" && (
            <div>
              <Label className="text-xs mb-1 block">Pickup store ID (optional)</Label>
              <Input className="h-9" value={settings.pickupStoreId ?? ""} onChange={(e) => set("pickupStoreId", e.target.value.replace(/\D/g, ""))} />
            </div>
          )}
          <div>
            <Label className="text-xs mb-1 block">Default parcel weight (kg)</Label>
            <Input className="h-9" type="number" min={0.1} step="0.1" value={settings.defaultWeightKg ?? ""} onChange={(e) => set("defaultWeightKg", e.target.value)} placeholder="0.5" />
          </div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <Checkbox checked={enabled} onCheckedChange={setEnabled} /> Staff can book parcels with this account
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={creating || saving}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
