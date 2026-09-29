"use client";

/**
 * Division -> District -> Upazila/Thana pickers for Bangladesh addresses, from the areas
 * the store delivers to. Names show in English and Bangla. The deepest pick is reported as
 * `locationId`; the district is required, the upazila/thana is optional.
 */
import * as React from "react";
import { useGetLocationsQuery, type StoreLocation } from "../../lib/features/checkout/checkout-api-slice";
import { useT } from "../../i18n/provider";

export type LocationValue = {
  division?: string;
  district?: string;
  upazila?: string;
  locationId?: string | null;
};

export interface LocationSelectsProps {
  value: LocationValue;
  onChange: (next: Required<LocationValue>) => void;
  /** Class for each <select>, to match the surrounding form. */
  selectClassName?: string;
  /** Wraps each field: (label, control, id) => layout. */
  renderField?: (label: string, control: React.ReactNode, id: string) => React.ReactNode;
  idPrefix?: string;
  required?: boolean;
}

// Older spellings that saved addresses may still use.
const ALIASES: Record<string, string> = {
  chittagong: "chattogram",
  chattagram: "chattogram",
  barisal: "barishal",
  comilla: "cumilla",
  jessore: "jashore",
  bogra: "bogura",
};
const norm = (s?: string | null) => {
  const n = (s ?? "").trim().toLowerCase();
  return ALIASES[n] ?? n;
};

const DEFAULT_SELECT =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

const defaultField = (label: string, control: React.ReactNode, id: string) => (
  <div className="space-y-1.5">
    <label htmlFor={id} className="text-sm font-medium">
      {label}
    </label>
    {control}
  </div>
);

export function LocationSelects({
  value,
  onChange,
  selectClassName = DEFAULT_SELECT,
  renderField = defaultField,
  idPrefix = "loc",
  required = true,
}: LocationSelectsProps) {
  const { data: rows = [], isLoading } = useGetLocationsQuery();

  const children = React.useMemo(() => {
    const m = new Map<string | null, StoreLocation[]>();
    for (const r of rows) {
      const list = m.get(r.parentId) ?? [];
      list.push(r);
      m.set(r.parentId, list);
    }
    for (const list of m.values()) list.sort((a, b) => a.en.localeCompare(b.en));
    return m;
  }, [rows]);

  const byId = React.useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);
  const find = (parentId: string | null, name?: string) =>
    name ? (children.get(parentId) ?? []).find((r) => norm(r.en) === norm(name) || r.bn === name.trim()) : undefined;

  // Resolve the current names to rows (saved addresses only carry names).
  const division = find(null, value.division);
  const district = division ? find(division.id, value.district) : undefined;
  const upazila = district ? find(district.id, value.upazila) : undefined;

  const emit = (d?: StoreLocation, di?: StoreLocation, u?: StoreLocation) =>
    onChange({
      division: d?.en ?? "",
      district: di?.en ?? "",
      upazila: u?.en ?? "",
      locationId: (u ?? di)?.id ?? null,
    });

  // Once the list loads, report the id for a prefilled address, or clear a district
  // that isn't one of the store's areas (old free text) so the customer picks again.
  const expectedId = (upazila ?? district)?.id ?? null;
  React.useEffect(() => {
    if (!rows.length) return;
    const staleDistrict = !!value.district && !district;
    if ((value.locationId ?? null) !== expectedId || staleDistrict) emit(division, district, upazila);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.length, expectedId, value.locationId, value.district]);

  const label = (r: StoreLocation) => `${r.en} · ${r.bn}`;
  const t = useT();
  const divisions = children.get(null) ?? [];
  const districts = division ? children.get(division.id) ?? [] : [];
  const upazilas = district ? children.get(district.id) ?? [] : [];

  return (
    <>
      {renderField(
        t("Division *"),
        <select
          id={`${idPrefix}-division`}
          className={selectClassName}
          value={division?.id ?? ""}
          required={required}
          disabled={isLoading}
          onChange={(e) => emit(byId.get(e.target.value))}
        >
          <option value="">{isLoading ? t("Loading…") : t("Select division")}</option>
          {divisions.map((r) => (
            <option key={r.id} value={r.id}>
              {label(r)}
            </option>
          ))}
        </select>,
        `${idPrefix}-division`,
      )}
      {renderField(
        t("District *"),
        <select
          id={`${idPrefix}-district`}
          className={selectClassName}
          value={district?.id ?? ""}
          required={required}
          disabled={!division}
          onChange={(e) => emit(division, byId.get(e.target.value))}
        >
          <option value="">{division ? t("Select district") : t("Select a division first")}</option>
          {districts.map((r) => (
            <option key={r.id} value={r.id}>
              {label(r)}
            </option>
          ))}
        </select>,
        `${idPrefix}-district`,
      )}
      {renderField(
        t("Upazila / Thana"),
        <select
          id={`${idPrefix}-upazila`}
          className={selectClassName}
          value={upazila?.id ?? ""}
          disabled={!district || upazilas.length === 0}
          onChange={(e) => emit(division, district, byId.get(e.target.value))}
        >
          <option value="">{district ? t("Select area (optional)") : t("Select a district first")}</option>
          {upazilas.map((r) => (
            <option key={r.id} value={r.id}>
              {r.type === "THANA" ? `${label(r)} (${t("thana")})` : label(r)}
            </option>
          ))}
        </select>,
        `${idPrefix}-upazila`,
      )}
    </>
  );
}

export default LocationSelects;
