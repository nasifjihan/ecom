/**
 * Delivery rules with no I/O, so they can be table-tested.
 *
 * Zones: a zone names locations (a division, district or upazila/thana). An address matches a zone
 * when one of those locations is the address's own area or one above it. The most specific match
 * wins: upazila (3) beats district (2) beats division (1) beats a zone that names no locations (0).
 * Zones tied at the same level: the one with the cheaper option wins.
 *
 * Methods: base cost (or a weight tier), plus per item, plus per kg above the tiers or above 0.5 kg,
 * never below the minimum cost; free at or above `freeFromSubtotal`; hidden below `minSubtotal`.
 */
import { normalizeName } from "../locations/locations.data";

export type ChainLoc = { id: bigint | string; nameEn: string; depth: number };

export type ZoneForMatch = {
  countries: unknown;
  states?: unknown;
  postcodes?: unknown;
  enabled?: boolean;
  /** Location ids the zone names (empty = the whole country list). */
  locationIds: (bigint | string)[];
};

export type AddressForMatch = {
  countryCode: string;
  /** Division first, deepest last. Empty when the address isn't in the location list. */
  chain: ChainLoc[];
  /** Raw text, used only for zones saved before locations existed. */
  division?: string;
  district?: string;
  postcode?: string;
};

const arr = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);

function postcodeOk(zonePostcodes: string[], postcode?: string) {
  if (!zonePostcodes.length || !postcode) return true;
  const n = parseInt(postcode, 10);
  return zonePostcodes.some((p) => {
    if (p === "*" || p === postcode) return true;
    const [a, b] = p.split("-").map((x) => parseInt(x, 10));
    return p.includes("-") && !Number.isNaN(a) && !Number.isNaN(b) && !Number.isNaN(n) && n >= a! && n <= b!;
  });
}

/** How specifically a zone matches an address, or null when it doesn't. */
export function zoneSpecificity(zone: ZoneForMatch, address: AddressForMatch): number | null {
  if (zone.enabled === false) return null;
  const countries = arr(zone.countries);
  if (!countries.includes(address.countryCode) && !countries.includes("*")) return null;
  if (!postcodeOk(arr(zone.postcodes), address.postcode)) return null;

  if (zone.locationIds.length) {
    const ids = new Set(zone.locationIds.map(String));
    const hit = address.chain.filter((l) => ids.has(String(l.id)));
    return hit.length ? Math.max(...hit.map((l) => l.depth)) : null;
  }

  // Zones saved before locations existed list names in `states`.
  const names = arr(zone.states).map(normalizeName);
  if (!names.length) return 0;
  const hit = address.chain.filter((l) => names.includes(normalizeName(l.nameEn)));
  if (hit.length) return Math.max(...hit.map((l) => l.depth));
  const raw = [address.division, address.district].filter(Boolean).map((s) => normalizeName(s!));
  return raw.some((r) => names.includes(r)) ? 1 : null;
}

export type WeightTier = { upToKg: number; cost: number };

export type MethodRules = {
  perKgExtra?: number;
  minimumCost?: number;
  weightTiers?: WeightTier[];
  minSubtotal?: number;
};

export type MethodForCost = {
  enabled?: boolean;
  baseCost: unknown;
  perItemCost?: unknown;
  freeFromSubtotal?: unknown;
  costRules?: unknown;
};

export const parseRules = (v: unknown): MethodRules => {
  if (!v) return {};
  if (typeof v === "string") {
    try { return JSON.parse(v) as MethodRules; } catch { return {}; }
  }
  return v as MethodRules;
};

const r2 = (n: number) => Math.round(n * 100) / 100;
/** Couriers bill by the started half kilo. */
export const chargeableKg = (kg: number) => (!kg || kg <= 0 ? 0 : Math.ceil(kg * 2) / 2);

export type MethodCost =
  | { available: false; reason: string }
  | { available: true; cost: number; beforeFree: number; free: boolean; weightKg: number };

export function methodCost(method: MethodForCost, cart: { subtotal: number; weightKG: number; qty: number }): MethodCost {
  if (method.enabled === false) return { available: false, reason: "disabled" };
  const rules = parseRules(method.costRules);
  const minSubtotal = Number(rules.minSubtotal ?? 0);
  if (minSubtotal > 0 && cart.subtotal < minSubtotal) {
    return { available: false, reason: `Orders from ${minSubtotal.toFixed(2)}` };
  }
  const kg = chargeableKg(cart.weightKG);
  const perKg = Number(rules.perKgExtra ?? 0);
  const tiers = [...(rules.weightTiers ?? [])].sort((a, b) => a.upToKg - b.upToKg);

  let cost: number;
  if (tiers.length) {
    const tier = tiers.find((t) => kg <= t.upToKg);
    const last = tiers[tiers.length - 1]!;
    cost = tier ? Number(tier.cost) : Number(last.cost) + Math.ceil(kg - last.upToKg) * perKg;
  } else {
    cost = Number(method.baseCost ?? 0) + (kg > 0.5 ? (kg - 0.5) * perKg : 0);
  }
  cost += Number(method.perItemCost ?? 0) * cart.qty;
  cost = Math.max(cost, Number(rules.minimumCost ?? 0));
  cost = r2(cost);

  const freeAbove = Number(method.freeFromSubtotal ?? 0);
  if (freeAbove > 0 && cart.subtotal >= freeAbove) {
    return { available: true, cost: 0, beforeFree: cost, free: true, weightKg: kg };
  }
  return { available: true, cost, beforeFree: cost, free: false, weightKg: kg };
}

/**
 * From the zones that match, keep the most specific; among ties, the one whose cheapest
 * option costs least. `cheapest` is that zone's lowest price (Infinity when it offers nothing).
 * A zone with nothing to offer this cart (e.g. every method needs a bigger order) steps aside
 * for the next most specific one.
 */
export function pickZone<T extends { specificity: number; cheapest: number }>(matches: T[]): T | null {
  const offering = matches.filter((m) => Number.isFinite(m.cheapest));
  let best: T | null = null;
  for (const m of offering.length ? offering : matches) {
    if (!best || m.specificity > best.specificity || (m.specificity === best.specificity && m.cheapest < best.cheapest)) {
      best = m;
    }
  }
  return best;
}
