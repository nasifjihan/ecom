"use client";

/**
 * "Only on these storefronts" for promotions, coupons, delivery zones and staff. Nothing ticked
 * means every storefront. Hidden while the store has a single storefront.
 */
import { Store } from "lucide-react";
import { Checkbox } from "@/components/ui";
import { useStorefrontOptionsQuery } from "@/lib/features/storefronts/storefronts-api-slice";

export function StorefrontMultiSelect({
  value,
  onChange,
  label = "Storefronts",
  allText = "Every storefront",
  hint,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  label?: string;
  allText?: string;
  hint?: string;
}) {
  const { data } = useStorefrontOptionsQuery();
  if (!data || data.length < 2) return null;
  const toggle = (id: string, on: boolean) => onChange(on ? [...new Set([...value, id])] : value.filter((v) => v !== id));
  return (
    <fieldset className="space-y-2">
      <legend className="flex items-center gap-1.5 text-sm font-medium">
        <Store className="h-4 w-4 text-slate-500" aria-hidden /> {label}
      </legend>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {data.map((s) => (
          <label key={s.id} className="flex items-center gap-2 text-sm">
            <Checkbox checked={value.includes(s.id)} onCheckedChange={(v) => toggle(s.id, v === true)} aria-label={s.name} />
            {s.name}
          </label>
        ))}
      </div>
      <p className="text-xs text-slate-500">{value.length ? hint ?? "Only on the ticked storefronts." : `${allText} (none ticked).`}</p>
    </fieldset>
  );
}
