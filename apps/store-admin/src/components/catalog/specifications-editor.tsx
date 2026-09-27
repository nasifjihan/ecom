"use client";

/** Rows of the product page's specifications table: optional group, label, value. */
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from "@/components/ui";

export interface SpecRow {
  group?: string | null;
  label: string;
  value: string;
}

/** Rows worth saving (label and value filled), trimmed. */
export const cleanSpecs = (rows: SpecRow[]): SpecRow[] =>
  rows
    .map((r) => ({ group: r.group?.trim() ? r.group.trim() : null, label: r.label.trim(), value: r.value.trim() }))
    .filter((r) => r.label && r.value);

export function SpecificationsEditor({ value, onChange }: { value: SpecRow[]; onChange: (rows: SpecRow[]) => void }) {
  const set = (i: number, patch: Partial<SpecRow>) => onChange(value.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const move = (i: number, d: -1 | 1) => {
    const next = [...value];
    const [row] = next.splice(i, 1);
    next.splice(i + d, 0, row!);
    onChange(next);
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>Specifications</CardTitle>
        <CardDescription>
          Shown as a table on the product page, e.g. Fabric → Material: 100% cotton. Rows with the same group are shown together.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {value.length > 0 && (
          <div className="hidden grid-cols-[1fr_1fr_1.5fr_auto] gap-2 px-1 text-xs font-medium text-slate-500 sm:grid">
            <span>Group (optional)</span>
            <span>Label</span>
            <span>Value</span>
            <span />
          </div>
        )}
        {value.map((r, i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_1.5fr_auto]">
            <Input aria-label={`Row ${i + 1} group`} placeholder="Fabric" value={r.group ?? ""} onChange={(e) => set(i, { group: e.target.value })} />
            <Input aria-label={`Row ${i + 1} label`} placeholder="Material" value={r.label} onChange={(e) => set(i, { label: e.target.value })} />
            <Input aria-label={`Row ${i + 1} value`} placeholder="100% cotton" value={r.value} onChange={(e) => set(i, { value: e.target.value })} />
            <div className="flex gap-1">
              <Button type="button" variant="ghost" size="icon" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                <ArrowUp className="h-4 w-4" />
              </Button>
              <Button type="button" variant="ghost" size="icon" aria-label="Move down" disabled={i === value.length - 1} onClick={() => move(i, 1)}>
                <ArrowDown className="h-4 w-4" />
              </Button>
              <Button type="button" variant="ghost" size="icon" aria-label="Remove row" onClick={() => onChange(value.filter((_, j) => j !== i))}>
                <Trash2 className="h-4 w-4 text-red-600" />
              </Button>
            </div>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={value.length >= 60}
          onClick={() => onChange([...value, { group: value[value.length - 1]?.group ?? "", label: "", value: "" }])}
        >
          <Plus className="mr-1 h-4 w-4" /> Add row
        </Button>
      </CardContent>
    </Card>
  );
}
