"use client";

/**
 * Taxes: the VAT/tax rates added at checkout. Every rate whose country (and division, district or
 * postcode, when set) matches the delivery address applies. Whether shelf prices already include
 * VAT is set in Settings → VAT & invoices.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Plus, Receipt, Trash2 } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Skeleton,
} from "@/components/ui";
import { EmptyState, Field, PageTitle, Toggle } from "@/components/content/shared";
import { errorText } from "@/lib/features/content/content-api-slice";
import { useCan } from "@/lib/permissions";
import {
  useCreateTaxRateMutation,
  useDeleteTaxRateMutation,
  useGetTaxClassesQuery,
  useGetTaxRatesQuery,
  useUpdateTaxRateMutation,
  type TaxRate,
  type TaxRateInput,
} from "@/lib/features/shipping/shipping-api-slice";

const EMPTY: TaxRateInput = { taxClassId: "", countryCode: "BD", state: "", city: "", postcode: "", rate: 15, name: "VAT", compound: false, priority: 1 };

/** "Bangladesh · Dhaka division" style text for where a rate applies. */
function where(r: Pick<TaxRate, "countryCode" | "state" | "city" | "postcode">) {
  return [r.countryCode === "*" ? "Every country" : r.countryCode, r.state, r.city, r.postcode].filter(Boolean).join(" · ");
}

function RateDialog({ rate, onClose }: { rate: TaxRate | "new" | null; onClose: () => void }) {
  const { data: classes = [] } = useGetTaxClassesQuery();
  const [create, { isLoading: creating }] = useCreateTaxRateMutation();
  const [update, { isLoading: updating }] = useUpdateTaxRateMutation();
  const [f, setF] = useState<TaxRateInput>(EMPTY);

  useEffect(() => {
    if (rate === null) return;
    setF(
      rate === "new"
        ? { ...EMPTY, taxClassId: classes[0]?.id ?? "" }
        : { ...rate, state: rate.state ?? "", city: rate.city ?? "", postcode: rate.postcode ?? "" },
    );
  }, [rate, classes]);

  const set = <K extends keyof TaxRateInput>(k: K, v: TaxRateInput[K]) => setF((s) => ({ ...s, [k]: v }));
  const bad =
    !f.taxClassId
      ? "Pick a tax class"
      : f.name.trim().length < 2
        ? "Give it a name, e.g. VAT"
        : !/^([A-Za-z]{2}|\*)$/.test(f.countryCode)
          ? "Use a two-letter country code (BD) or * for every country"
          : !(f.rate >= 0 && f.rate <= 100)
            ? "The rate must be 0–100%"
            : null;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (bad) return;
    const body: TaxRateInput = {
      taxClassId: f.taxClassId,
      countryCode: f.countryCode.toUpperCase(),
      state: f.state?.trim() ?? "",
      city: f.city?.trim() ?? "",
      postcode: f.postcode?.trim() ?? "",
      rate: Math.round(f.rate * 100) / 100,
      name: f.name.trim(),
      compound: f.compound,
      priority: f.priority,
    };
    try {
      if (rate === "new") await create(body).unwrap();
      else if (rate) await update({ id: rate.id, ...body }).unwrap();
      toast.success("Tax rate saved");
      onClose();
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  return (
    <Dialog open={rate !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{rate === "new" ? "Add tax rate" : "Edit tax rate"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name" htmlFor="t-name" hint="Shown on the invoice, e.g. VAT.">
              <Input id="t-name" value={f.name} maxLength={60} onChange={(e) => set("name", e.target.value)} />
            </Field>
            <Field label="Rate %" htmlFor="t-rate">
              <Input id="t-rate" type="number" min={0} max={100} step={0.01} value={String(f.rate)} onChange={(e) => set("rate", Number(e.target.value || 0))} />
            </Field>
          </div>
          <Field label="Tax class" htmlFor="t-class">
            <select
              id="t-class"
              value={f.taxClassId}
              onChange={(e) => set("taxClassId", e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Country" htmlFor="t-country" hint="BD, or * for every country.">
              <Input id="t-country" value={f.countryCode} maxLength={2} onChange={(e) => set("countryCode", e.target.value.toUpperCase())} />
            </Field>
            <Field label="Division" htmlFor="t-state" hint="Empty = all.">
              <Input id="t-state" value={f.state} maxLength={64} onChange={(e) => set("state", e.target.value)} />
            </Field>
            <Field label="District" htmlFor="t-city" hint="Empty = all.">
              <Input id="t-city" value={f.city} maxLength={64} onChange={(e) => set("city", e.target.value)} />
            </Field>
            <Field label="Postcode" htmlFor="t-post" hint="Empty = all.">
              <Input id="t-post" value={f.postcode} maxLength={12} onChange={(e) => set("postcode", e.target.value)} />
            </Field>
          </div>
          <Toggle
            checked={f.compound}
            onChange={(v) => set("compound", v)}
            label="Compound"
            hint="Charged on the total with delivery and the other taxes, not on the items alone."
          />
          {bad && <p className="text-sm text-destructive">{bad}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!!bad || creating || updating}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function TaxesPage() {
  const { data: rates, isLoading } = useGetTaxRatesQuery();
  const [remove] = useDeleteTaxRateMutation();
  const { can } = useCan();
  const [editing, setEditing] = useState<TaxRate | "new" | null>(null);

  const onDelete = async (r: TaxRate) => {
    if (!window.confirm(`Delete "${r.name}" (${r.rate}%)? Orders already placed keep their VAT.`)) return;
    try {
      await remove(r.id).unwrap();
      toast.success("Tax rate deleted");
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  return (
    <div className="space-y-6">
      <PageTitle
        icon={Receipt}
        title="Taxes"
        description="Rates added at checkout. Every rate that matches the delivery address applies."
        actions={
          can("taxes.create") && (
            <Button onClick={() => setEditing("new")}>
              <Plus className="mr-1.5 h-4 w-4" /> Add rate
            </Button>
          )
        }
      />
      <p className="text-sm text-slate-500">
        Whether your prices already include VAT is set in{" "}
        <Link href="/settings/tax" className="text-primary underline-offset-2 hover:underline">
          Settings → VAT &amp; invoices
        </Link>
        .
      </p>
      {isLoading || !rates ? (
        <Skeleton className="h-48 w-full" />
      ) : rates.length === 0 ? (
        <EmptyState icon={Receipt} title="No tax rates" text="No VAT is added at checkout. Add a rate such as VAT 15% for BD." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {rates.map((r) => (
            <Card key={r.id}>
              <CardContent className="flex items-start justify-between gap-3 p-4">
                <div className="space-y-1">
                  <div className="font-semibold">
                    {r.name} <span className="font-normal text-slate-500">{r.rate}%</span>
                  </div>
                  <div className="text-sm text-slate-500">{where(r)}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {r.taxClass && <Badge variant="outline" className="font-normal">{r.taxClass.name}</Badge>}
                    {r.compound && <Badge variant="secondary">Compound</Badge>}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  {can("taxes.edit") && (
                    <Button variant="outline" size="sm" onClick={() => setEditing(r)}>
                      Edit
                    </Button>
                  )}
                  {can("taxes.delete") && (
                    <Button variant="outline" size="sm" aria-label={`Delete ${r.name}`} onClick={() => void onDelete(r)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <RateDialog rate={editing} onClose={() => setEditing(null)} />
    </div>
  );
}
