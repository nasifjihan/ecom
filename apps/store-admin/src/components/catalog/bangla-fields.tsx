"use client";

/**
 * The Bangla (বাংলা) versions of a product's, category's or brand's texts. The storefront shows
 * them when a shopper picks Bangla; an empty box shows the English instead.
 */
import { Languages } from "lucide-react";
import { Input, Label, Textarea } from "@/components/ui";

export type BanglaTexts = Record<string, string>;

export interface BanglaField {
  key: string;
  label: string;
  /** Rows for a multi-line box; a single-line input when left out. */
  rows?: number;
  placeholder?: string;
}

/** The Bangla texts saved on a row (`translations.bn`). */
export function banglaOf(row?: { translations?: unknown } | null): BanglaTexts {
  const t = row?.translations;
  if (!t || typeof t !== "object") return {};
  const bn = (t as Record<string, unknown>).bn;
  if (!bn || typeof bn !== "object") return {};
  return Object.fromEntries(Object.entries(bn as Record<string, unknown>).filter((e): e is [string, string] => typeof e[1] === "string"));
}

/** What to send to the API: every field, blank ones as null so they're removed. */
export function banglaPayload(fields: BanglaField[], value: BanglaTexts) {
  return { bn: Object.fromEntries(fields.map((f) => [f.key, value[f.key]?.trim() ? value[f.key]!.trim() : null])) };
}

export function BanglaFields({
  fields,
  value,
  onChange,
  idPrefix = "bn",
}: {
  fields: BanglaField[];
  value: BanglaTexts;
  onChange: (v: BanglaTexts) => void;
  idPrefix?: string;
}) {
  return (
    <div className="space-y-3 rounded-lg border border-dashed p-4" lang="bn">
      <div>
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Languages className="h-4 w-4 text-blue-600" /> In Bangla (বাংলা)
        </p>
        <p className="text-xs text-slate-500">Shown on the storefront when a shopper picks বাংলা. Leave a box empty to show the English.</p>
      </div>
      {fields.map((f) => {
        const id = `${idPrefix}-${f.key}`;
        const set = (v: string) => onChange({ ...value, [f.key]: v });
        return (
          <div key={f.key} className="space-y-1.5">
            <Label htmlFor={id}>{f.label}</Label>
            {f.rows ? (
              <Textarea id={id} rows={f.rows} value={value[f.key] ?? ""} placeholder={f.placeholder} onChange={(e) => set(e.target.value)} />
            ) : (
              <Input id={id} value={value[f.key] ?? ""} placeholder={f.placeholder} onChange={(e) => set(e.target.value)} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/** `{ bn: { name: "…" } }` from form values; blank ones as null so they're removed. */
export function bnTexts(values: Record<string, string | null | undefined>) {
  return { bn: Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v?.trim() ? v.trim() : null])) };
}
