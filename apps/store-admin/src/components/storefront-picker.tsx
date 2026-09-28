"use client";

/**
 * Which storefront an editor (look, home page, menus) is working on. Hidden while the store has a
 * single storefront. The choice is kept in the address (?storefront=ID) so a reload keeps it.
 */
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Store } from "lucide-react";
import { STOREFRONT_URL } from "@/components/content/shared";
import { storefrontUrl, useStorefrontsQuery, type Storefront } from "@/lib/features/storefronts/storefronts-api-slice";

export interface StorefrontChoice {
  storefronts: Storefront[];
  current: Storefront | undefined;
  /** The chosen storefront's id, or undefined for the default one (what the API expects). */
  storefrontId: string | undefined;
  /** More than one storefront: the picker shows. */
  several: boolean;
  viewUrl: string;
  choose: (id: string) => void;
}

export function useStorefrontChoice(): StorefrontChoice {
  const { data } = useStorefrontsQuery();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const storefronts = data ?? [];
  const wanted = params.get("storefront");
  const current = storefronts.find((s) => s.id === wanted) ?? storefronts.find((s) => s.isDefault);
  return {
    storefronts,
    current,
    storefrontId: current && !current.isDefault ? current.id : undefined,
    several: storefronts.length > 1,
    viewUrl: storefrontUrl(current, STOREFRONT_URL),
    choose: (id) => {
      const next = new URLSearchParams(params.toString());
      const sf = storefronts.find((s) => s.id === id);
      if (!sf || sf.isDefault) next.delete("storefront");
      else next.set("storefront", id);
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
  };
}

export function StorefrontPicker({ choice, note }: { choice: StorefrontChoice; note?: React.ReactNode }) {
  if (!choice.several) return null;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3 text-sm dark:border-blue-900 dark:bg-blue-950/40">
      <Store className="h-4 w-4 text-blue-600" aria-hidden />
      <label htmlFor="storefront-picker" className="font-medium">
        Storefront
      </label>
      <select
        id="storefront-picker"
        className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-900"
        value={choice.current?.id ?? ""}
        onChange={(e) => choice.choose(e.target.value)}
      >
        {choice.storefronts.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
            {s.isDefault ? " (default)" : ""}
            {!s.isActive ? " (closed)" : ""}
          </option>
        ))}
      </select>
      {note && <span className="text-slate-600 dark:text-slate-300">{note}</span>}
    </div>
  );
}
