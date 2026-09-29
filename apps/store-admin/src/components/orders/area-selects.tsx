"use client";

/** Division -> District -> Upazila/Thana selects over the areas the store delivers to. */
import { useMemo } from "react";
import { Label } from "@/components/ui";
import type { OrderArea } from "@/lib/features/operations/manual-order-api-slice";

export interface AreaValue {
  divisionId: string;
  districtId: string;
  upazilaId: string;
}

const SELECT =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50";

export function AreaSelects({
  rows,
  isLoading,
  value,
  onChange,
}: {
  /** Areas the store delivers to (switched-off areas already left out). */
  rows: OrderArea[];
  isLoading?: boolean;
  value: AreaValue;
  onChange: (v: AreaValue, deepestId: string | null) => void;
}) {
  const children = useMemo(() => {
    const m = new Map<string | null, OrderArea[]>();
    for (const r of rows) {
      const list = m.get(r.parentId) ?? [];
      list.push(r);
      m.set(r.parentId, list);
    }
    for (const list of m.values()) list.sort((a, b) => a.en.localeCompare(b.en));
    return m;
  }, [rows]);

  const pick = (divisionId: string, districtId = "", upazilaId = "") =>
    onChange({ divisionId, districtId, upazilaId }, upazilaId || districtId || null);

  const opt = (r: OrderArea) => (
    <option key={r.id} value={r.id}>
      {r.en} · {r.bn}
      {r.type === "THANA" ? " (thana)" : ""}
    </option>
  );

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="space-y-1.5">
        <Label htmlFor="area-division">Division</Label>
        <select id="area-division" className={SELECT} disabled={isLoading} value={value.divisionId} onChange={(e) => pick(e.target.value)}>
          <option value="">{isLoading ? "Loading…" : "Select division"}</option>
          {(children.get(null) ?? []).map(opt)}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="area-district">District</Label>
        <select
          id="area-district"
          className={SELECT}
          disabled={!value.divisionId}
          value={value.districtId}
          onChange={(e) => pick(value.divisionId, e.target.value)}
        >
          <option value="">Select district</option>
          {(children.get(value.divisionId) ?? []).map(opt)}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="area-upazila">Upazila / Thana</Label>
        <select
          id="area-upazila"
          className={SELECT}
          disabled={!value.districtId}
          value={value.upazilaId}
          onChange={(e) => pick(value.divisionId, value.districtId, e.target.value)}
        >
          <option value="">Optional</option>
          {(children.get(value.districtId) ?? []).map(opt)}
        </select>
      </div>
    </div>
  );
}
