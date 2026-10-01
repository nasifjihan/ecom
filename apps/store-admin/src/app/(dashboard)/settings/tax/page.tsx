"use client";

/**
 * VAT & invoices: whether shelf prices already include VAT, the order number prefix and the note
 * printed on every invoice. The BIN, trade licence and registered name are on Store details;
 * the VAT rates themselves are under Shipping → Taxes.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Receipt } from "lucide-react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Skeleton, Textarea } from "@/components/ui";
import { Field, PageTitle, Toggle } from "@/components/content/shared";
import { errorText } from "@/lib/features/content/content-api-slice";
import { useCan } from "@/lib/permissions";
import { useGetSettingsQuery, useUpdateSettingsMutation } from "@/lib/features/settings/settings-api-slice";

interface TaxSettings {
  pricesIncludeTax: boolean;
  orderPrefix: string;
  invoiceNote: string;
  sampleOrderNumber: string;
}

const PREFIX = /^[A-Za-z0-9]{0,6}$/;

export default function TaxSettingsPage() {
  const { data, isLoading } = useGetSettingsQuery("tax");
  const [save, { isLoading: saving }] = useUpdateSettingsMutation();
  const { can } = useCan();
  const canEdit = can("settings.edit");
  const saved = data as unknown as TaxSettings | undefined;
  const [included, setIncluded] = useState(false);
  const [prefix, setPrefix] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!saved) return;
    setIncluded(saved.pricesIncludeTax);
    setPrefix(saved.orderPrefix);
    setNote(saved.invoiceNote);
  }, [saved]);

  const prefixOk = PREFIX.test(prefix);
  const clean = prefix.trim().toUpperCase();
  const sample = saved ? (clean ? `${clean}-${saved.sampleOrderNumber.replace(/^[A-Z0-9]+-/, "")}` : saved.sampleOrderNumber.replace(/^[A-Z0-9]+-/, "")) : "";

  const onSave = async () => {
    if (!prefixOk) return;
    try {
      await save({ section: "tax", values: { pricesIncludeTax: included, orderPrefix: clean, invoiceNote: note } }).unwrap();
      toast.success("Saved");
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  return (
    <div className="space-y-6">
      <PageTitle icon={Receipt} title="VAT & invoices" description="How VAT is shown, how order numbers look, and what every invoice says." />
      {isLoading || !saved ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>VAT</CardTitle>
              <CardDescription>
                The rates are under{" "}
                <Link href="/shipping/taxes" className="text-primary underline-offset-2 hover:underline">
                  Shipping → Taxes
                </Link>
                . Changing this affects new orders only.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Toggle
                checked={included}
                onChange={setIncluded}
                label="Prices include VAT"
                hint={
                  included
                    ? "A ৳1,150 shirt costs ৳1,150 at checkout. At 15%, ৳150 of it is VAT, shown as “Includes VAT” under the total."
                    : "VAT is added at checkout: a ৳1,000 shirt at 15% costs ৳1,150."
                }
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Invoices</CardTitle>
              <CardDescription>
                Your registered name, BIN and trade licence are printed from{" "}
                <Link href="/settings/general" className="text-primary underline-offset-2 hover:underline">
                  Store details
                </Link>
                .
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <Field
                label="Order number prefix"
                htmlFor="orderPrefix"
                error={prefixOk ? null : "Up to 6 letters or digits"}
                hint={`Up to 6 letters or digits, for new orders. The next one will look like ${sample}. Existing orders keep their numbers.`}
              >
                <Input id="orderPrefix" value={prefix} maxLength={6} placeholder="e.g. FBD" onChange={(e) => setPrefix(e.target.value.replace(/-/g, ""))} />
              </Field>
              <Field label="Note on every invoice" htmlFor="invoiceNote" hint="Printed under the totals, e.g. your exchange policy or bank details.">
                <Textarea id="invoiceNote" rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
              </Field>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={onSave} disabled={!canEdit || saving || !prefixOk}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
