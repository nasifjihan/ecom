"use client";

import { useEffect, useState } from "react";
import { StorefrontMultiSelect } from "@/components/storefront-multi-select";
import { toast } from "sonner";
import { Plus, Trash2, X } from "lucide-react";
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Textarea,
} from "@/components/ui";
import { Field, Toggle, toSlug } from "@/components/content/shared";
import { LocationTree, useLocationIndex } from "@/components/shipping/location-tree";
import { errorText } from "@/lib/features/content/content-api-slice";
import {
  parseCostRules,
  useCreateMethodMutation,
  useCreateZoneMutation,
  useGetLocationsQuery,
  useUpdateMethodMutation,
  useUpdateZoneMutation,
  type ShippingMethod,
  type ShippingZone,
} from "@/lib/features/shipping/shipping-api-slice";

const list = (s: string) =>
  s.split(",").map((x) => x.trim()).filter(Boolean);

// ============================================================ zone

export function ZoneDialog({ zone, onClose }: { zone: ShippingZone | "new" | null; onClose: () => void }) {
  const { data: rows = [] } = useGetLocationsQuery(undefined, { skip: zone === null });
  const index = useLocationIndex(rows);
  const [create, { isLoading: creating }] = useCreateZoneMutation();
  const [update, { isLoading: updating }] = useUpdateZoneMutation();
  const [name, setName] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [countries, setCountries] = useState("BD");
  const [postcodes, setPostcodes] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [fronts, setFronts] = useState<string[]>([]);

  useEffect(() => {
    if (zone === null) return;
    const z = zone === "new" ? null : zone;
    setName(z?.name ?? "");
    setEnabled(z?.enabled ?? true);
    setCountries((z?.countries ?? ["BD"]).join(", "));
    setPostcodes((z?.postcodes ?? []).join(", "));
    setPicked(z?.locationIds ?? []);
    setFronts((z?.storefrontIds ?? []).map(String));
  }, [zone]);

  const pickedSet = new Set(picked);
  /** An area inside one that's already picked is covered by it. */
  const coveredBy = (id: string) => index.ancestors(id).find((a) => pickedSet.has(a.id));

  const togglePick = (id: string, on: boolean) => {
    if (!on) return setPicked((p) => p.filter((x) => x !== id));
    // Picking an area makes picked areas inside it redundant.
    setPicked((p) => [...p.filter((x) => !index.ancestors(x).some((a) => a.id === id)), id]);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = {
      name: name.trim(),
      enabled,
      countries: list(countries).map((c) => c.toUpperCase()),
      postcodes: list(postcodes),
      locationIds: picked,
      storefrontIds: fronts,
    };
    try {
      if (zone === "new") await create(body).unwrap();
      else if (zone) await update({ id: zone.id, ...body }).unwrap();
      toast.success("Zone saved");
      onClose();
    } catch (err) {
      toast.error(errorText(err, "Couldn't save the zone."));
    }
  };

  const legacy = zone && zone !== "new" && !zone.locationIds.length ? zone.states ?? [] : [];

  return (
    <Dialog open={zone !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <form onSubmit={save} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{zone === "new" ? "Add zone" : "Edit zone"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="zone-name" hint="Only you see this, e.g. Inside Dhaka.">
              <Input id="zone-name" required minLength={2} maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Countries" htmlFor="zone-countries" hint="2-letter codes, comma separated. BD for Bangladesh.">
              <Input id="zone-countries" required value={countries} onChange={(e) => setCountries(e.target.value)} />
            </Field>
          </div>

          <Field
            label="Areas"
            hint="Pick divisions, districts or upazilas. Leave empty to cover the whole country. When zones overlap, the one with the smallest matching area is used."
          >
            {legacy.length > 0 && (
              <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                This zone still matches by the place names {legacy.join(", ")}. Pick areas below to replace them.
              </p>
            )}
            <div className="flex min-h-9 flex-wrap gap-1.5 rounded-md border p-2">
              {picked.length === 0 ? (
                <span className="text-sm text-slate-500">Whole country</span>
              ) : (
                picked.map((id) => (
                  <span key={id} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs dark:bg-slate-800">
                    {index.label(id)}
                    <button type="button" onClick={() => togglePick(id, false)} aria-label={`Remove ${index.label(id)}`}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))
              )}
            </div>
            <LocationTree
              rows={rows}
              index={index}
              maxHeight="40vh"
              muted={(r) => !!coveredBy(r.id)}
              renderControl={(r) => {
                const parent = coveredBy(r.id);
                return (
                  <Checkbox
                    checked={pickedSet.has(r.id) || !!parent}
                    disabled={!!parent}
                    title={parent ? `Included with ${parent.en}` : undefined}
                    onCheckedChange={(v) => togglePick(r.id, v)}
                    aria-label={`Include ${r.en}`}
                  />
                );
              }}
            />
          </Field>

          <Field label="Postcodes (optional)" htmlFor="zone-postcodes" hint="Narrow the zone further, e.g. 1205, 1209 or 1200-1230.">
            <Input id="zone-postcodes" value={postcodes} onChange={(e) => setPostcodes(e.target.value)} />
          </Field>
          <StorefrontMultiSelect
            value={fronts}
            onChange={setFronts}
            hint="Only for the ticked storefronts. Where a storefront has its own zone for an address, it's used instead of shared zones."
          />
          <Toggle checked={enabled} onChange={setEnabled} label="Zone is active" hint="Inactive zones aren't offered at checkout." />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={creating || updating || name.trim().length < 2 || !list(countries).length}>
              Save zone
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================ delivery method

type Tier = { upToKg: string; cost: string };
const EMPTY_METHOD = {
  name: "",
  code: "",
  description: "",
  enabled: true,
  baseCost: "",
  perItemCost: "0",
  perKgExtra: "0",
  minimumCost: "0",
  minSubtotal: "0",
  freeFromSubtotal: "",
  minDays: "",
  maxDays: "",
  tiers: [] as Tier[],
};

export function MethodDialog({
  zoneId,
  method,
  onClose,
}: {
  zoneId: string;
  method: ShippingMethod | "new" | null;
  onClose: () => void;
}) {
  const [create, { isLoading: creating }] = useCreateMethodMutation();
  const [update, { isLoading: updating }] = useUpdateMethodMutation();
  const [f, setF] = useState(EMPTY_METHOD);
  const [codeTouched, setCodeTouched] = useState(false);
  const set = <K extends keyof typeof EMPTY_METHOD>(k: K, v: (typeof EMPTY_METHOD)[K]) => setF((s) => ({ ...s, [k]: v }));

  useEffect(() => {
    if (method === null) return;
    if (method === "new") {
      setF(EMPTY_METHOD);
      setCodeTouched(false);
      return;
    }
    const r = parseCostRules(method.costRules);
    setF({
      name: method.name,
      code: method.code,
      description: method.description ?? "",
      enabled: method.enabled,
      baseCost: String(Number(method.baseCost)),
      perItemCost: String(Number(method.perItemCost)),
      perKgExtra: String(r.perKgExtra ?? 0),
      minimumCost: String(r.minimumCost ?? 0),
      minSubtotal: String(r.minSubtotal ?? 0),
      freeFromSubtotal: method.freeFromSubtotal ? String(Number(method.freeFromSubtotal)) : "",
      minDays: method.deliveryEstimateMinDays?.toString() ?? "",
      maxDays: method.deliveryEstimateMaxDays?.toString() ?? "",
      tiers: (r.weightTiers ?? []).map((t) => ({ upToKg: String(t.upToKg), cost: String(t.cost) })),
    });
    setCodeTouched(true);
  }, [method]);

  const num = (v: string) => (v.trim() === "" ? 0 : Number(v));
  const optNum = (v: string) => (v.trim() === "" ? null : Number(v));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const tiers = f.tiers
      .filter((t) => t.upToKg.trim() && t.cost.trim())
      .map((t) => ({ upToKg: Number(t.upToKg), cost: Number(t.cost) }))
      .sort((a, b) => a.upToKg - b.upToKg);
    const body = {
      name: f.name.trim(),
      description: f.description.trim() || null,
      enabled: f.enabled,
      baseCost: tiers.length ? 0 : num(f.baseCost),
      perItemCost: num(f.perItemCost),
      perKgExtra: num(f.perKgExtra),
      minimumCost: num(f.minimumCost),
      minSubtotal: num(f.minSubtotal),
      weightTiers: tiers,
      freeFromSubtotal: optNum(f.freeFromSubtotal),
      deliveryEstimateMinDays: optNum(f.minDays),
      deliveryEstimateMaxDays: optNum(f.maxDays),
    };
    try {
      if (method === "new") await create({ zoneId, code: f.code, ...body }).unwrap();
      else if (method) await update({ id: method.id, ...body }).unwrap();
      toast.success("Delivery option saved");
      onClose();
    } catch (err) {
      toast.error(errorText(err, "Couldn't save the delivery option."));
    }
  };

  const money = (id: string, label: string, key: "baseCost" | "perItemCost" | "perKgExtra" | "minimumCost" | "minSubtotal" | "freeFromSubtotal", hint?: string, required = false) => (
    <Field label={label} htmlFor={id} hint={hint}>
      <Input
        id={id}
        type="number"
        min={0}
        step="0.01"
        inputMode="decimal"
        required={required}
        value={f[key]}
        onChange={(e) => set(key, e.target.value)}
      />
    </Field>
  );

  return (
    <Dialog open={method !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <form onSubmit={save} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{method === "new" ? "Add delivery option" : "Edit delivery option"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="m-name" hint="Customers see this at checkout.">
              <Input
                id="m-name"
                required
                minLength={2}
                maxLength={80}
                value={f.name}
                onChange={(e) => {
                  set("name", e.target.value);
                  if (method === "new" && !codeTouched) set("code", toSlug(e.target.value).replace(/-/g, "_").slice(0, 40));
                }}
              />
            </Field>
            <Field label="Code" htmlFor="m-code" hint="Lowercase letters, numbers and _. Can't change later.">
              <Input
                id="m-code"
                required
                pattern="[a-z0-9_-]{2,40}"
                disabled={method !== "new"}
                value={f.code}
                onChange={(e) => {
                  setCodeTouched(true);
                  set("code", e.target.value.toLowerCase());
                }}
              />
            </Field>
          </div>
          <Field label="Description (optional)" htmlFor="m-desc">
            <Textarea id="m-desc" rows={2} maxLength={500} value={f.description} onChange={(e) => set("description", e.target.value)} />
          </Field>

          <fieldset className="space-y-3 rounded-lg border p-4">
            <legend className="px-1 text-sm font-semibold">Price</legend>
            <Field
              label="Price by parcel weight"
              hint={f.tiers.length ? "The first row the parcel fits in sets the price. Weight is rounded up to the next half kilo." : "Optional. Without rows, the base price below is used."}
            >
              <div className="space-y-2">
                {f.tiers.map((t, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-sm text-slate-500">Up to</span>
                    <Input
                      type="number"
                      min={0.1}
                      step="0.1"
                      className="w-24"
                      aria-label="Up to kg"
                      value={t.upToKg}
                      onChange={(e) => set("tiers", f.tiers.map((x, j) => (j === i ? { ...x, upToKg: e.target.value } : x)))}
                    />
                    <span className="text-sm text-slate-500">kg costs ৳</span>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      className="w-28"
                      aria-label="Cost"
                      value={t.cost}
                      onChange={(e) => set("tiers", f.tiers.map((x, j) => (j === i ? { ...x, cost: e.target.value } : x)))}
                    />
                    <Button type="button" variant="ghost" size="icon" onClick={() => set("tiers", f.tiers.filter((_, j) => j !== i))} aria-label="Remove row">
                      <Trash2 className="h-4 w-4 text-rose-600" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={f.tiers.length >= 20}
                  onClick={() => set("tiers", [...f.tiers, { upToKg: String((Number(f.tiers.at(-1)?.upToKg) || 0) + 1), cost: "" }])}
                >
                  <Plus className="mr-1 h-4 w-4" /> Add weight row
                </Button>
              </div>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              {!f.tiers.length && money("m-base", "Base price ৳", "baseCost", "For a parcel up to 0.5 kg.", true)}
              {money("m-kg", "Each extra kg ৳", "perKgExtra", f.tiers.length ? "Above the last weight row." : "Above 0.5 kg.")}
              {money("m-item", "Each item ৳", "perItemCost", "Added per item in the order.")}
              {money("m-min", "Minimum price ৳", "minimumCost")}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            {money("m-free", "Free from order total ৳", "freeFromSubtotal", "Leave empty for never free.")}
            {money("m-minorder", "Only for orders from ৳", "minSubtotal", "0 = any order.")}
            <Field label="Delivery time (days)" hint="Shown to customers, e.g. 1–2 days.">
              <div className="flex items-center gap-2">
                <Input type="number" min={0} max={60} aria-label="From days" value={f.minDays} onChange={(e) => set("minDays", e.target.value)} />
                <span className="text-slate-500">to</span>
                <Input type="number" min={0} max={90} aria-label="To days" value={f.maxDays} onChange={(e) => set("maxDays", e.target.value)} />
              </div>
            </Field>
          </div>
          <Toggle checked={f.enabled} onChange={(v) => set("enabled", v)} label="Offer at checkout" />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={creating || updating || f.name.trim().length < 2 || (!f.tiers.length && f.baseCost.trim() === "")}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
