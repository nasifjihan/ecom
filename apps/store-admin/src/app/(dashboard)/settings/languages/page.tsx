"use client";

/**
 * Languages: whether the storefront offers Bangla next to English, and which one it opens in.
 * Shoppers switch with the English / বাংলা button in the header. Product, category, brand and
 * menu names in Bangla are entered on their own editors.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Languages } from "lucide-react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Skeleton } from "@/components/ui";
import { Field, PageTitle, Toggle } from "@/components/content/shared";
import { errorText } from "@/lib/features/content/content-api-slice";
import { useCan } from "@/lib/permissions";
import { useLanguageSettingsQuery, useSaveLanguageSettingsMutation } from "@/lib/features/settings/languages-api-slice";

const SELECT = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

export default function LanguagesPage() {
  const { data, isLoading } = useLanguageSettingsQuery();
  const [save, { isLoading: saving }] = useSaveLanguageSettingsMutation();
  const { can } = useCan();
  const canEdit = can("settings.edit");
  const [bangla, setBangla] = useState(false);
  const [def, setDef] = useState<"en" | "bn">("en");

  useEffect(() => {
    if (!data) return;
    setBangla(data.languages.some((l) => l.code === "bn" && l.enabled));
    setDef(data.defaultLanguage);
  }, [data]);

  const onSave = async () => {
    try {
      await save({ enabled: bangla ? ["en", "bn"] : ["en"], defaultLanguage: bangla ? def : "en" }).unwrap();
      toast.success("Languages saved");
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  return (
    <div className="space-y-6">
      <PageTitle icon={Languages} title="Languages" description="Offer the storefront in Bangla as well as English." />
      {isLoading || !data ? (
        <Skeleton className="h-48 w-full" />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Storefront languages</CardTitle>
            <CardDescription>
              Shoppers switch with the English / বাংলা button in the header. Buttons, checkout and account pages are
              translated for you; product, category, brand and menu names show in Bangla where you&apos;ve written them
              (each editor has a Bangla field), and in English otherwise.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <Toggle
              checked={bangla}
              onChange={setBangla}
              label="Offer Bangla (বাংলা)"
              hint="Shows the language switch on the storefront."
            />
            <Field label="Storefront opens in" hint="Shoppers who haven't picked a language see this one. Invoices use the language the order was placed in.">
              <select className={SELECT} value={bangla ? def : "en"} disabled={!bangla} onChange={(e) => setDef(e.target.value === "bn" ? "bn" : "en")}>
                <option value="en">English</option>
                <option value="bn">বাংলা (Bangla)</option>
              </select>
            </Field>
            <div className="flex justify-end">
              <Button onClick={onSave} disabled={!canEdit || saving}>
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
