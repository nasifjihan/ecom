/**
 * Bangladesh locations: division -> district -> upazila/thana.
 * The tree is platform data that only changes when the API boots (syncLocations), so it is
 * held in memory. Which locations a store doesn't deliver to is per store (StoreLocationOff).
 */
import type { LocationType } from "@prisma/client";
import { prisma } from "../../config";
import { BadRequestError, NotFoundError } from "../../core";
import { normalizeName } from "./locations.data";

export type Loc = {
  id: bigint;
  code: string;
  type: LocationType;
  nameEn: string;
  nameBn: string;
  parentId: bigint | null;
  sortOrder: number;
};

type Tree = { byId: Map<string, Loc>; children: Map<string, Loc[]>; roots: Loc[] };

let treePromise: Promise<Tree> | null = null;

async function loadTree(): Promise<Tree> {
  const rows = await prisma.location.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }] });
  const byId = new Map<string, Loc>();
  const children = new Map<string, Loc[]>();
  const roots: Loc[] = [];
  for (const r of rows) {
    byId.set(String(r.id), r);
    if (r.parentId === null) roots.push(r);
    else {
      const k = String(r.parentId);
      if (!children.has(k)) children.set(k, []);
      children.get(k)!.push(r);
    }
  }
  return { byId, children, roots };
}

export function locationTree(): Promise<Tree> {
  if (!treePromise) treePromise = loadTree().catch((e) => { treePromise = null; throw e; });
  return treePromise;
}

/** For tests and after syncLocations() adds rows. */
export function resetLocationTree() { treePromise = null; }

const DEPTH: Record<LocationType, number> = { DIVISION: 1, DISTRICT: 2, UPAZILA: 3, THANA: 3 };
export const locationDepth = (l: Loc) => DEPTH[l.type];

/** Division first, then district, then upazila/thana. */
export async function locationChain(id: bigint | string): Promise<Loc[]> {
  const { byId } = await locationTree();
  const chain: Loc[] = [];
  let cur = byId.get(String(id));
  while (cur) {
    chain.unshift(cur);
    cur = cur.parentId === null ? undefined : byId.get(String(cur.parentId));
  }
  return chain;
}

export async function storeLocationsOff(storeId: bigint): Promise<Set<string>> {
  const rows = await prisma.storeLocationOff.findMany({ where: { storeId }, select: { locationId: true } });
  return new Set(rows.map((r) => String(r.locationId)));
}

/** The first location in the chain the store has switched off (a parent switches off everything under it). */
export const offInChain = (chain: Loc[], off: Set<string>) => chain.find((l) => off.has(String(l.id))) ?? null;

export type AddressLocationInput = {
  locationId?: bigint | string | null;
  division?: string | null;
  district?: string | null;
  upazila?: string | null;
};

export type ResolvedAddressLocation = {
  chain: Loc[];
  division: Loc | null;
  district: Loc | null;
  upazila: Loc | null;
  /** Deepest location found. */
  location: Loc | null;
};

const matches = (l: Loc, name: string) => {
  const n = normalizeName(name);
  return normalizeName(l.nameEn) === n || l.nameBn.trim() === name.trim();
};

/**
 * Finds the locations an address points at. A `locationId` wins (and must exist); otherwise
 * the division, district and upazila names are looked up (English, older spellings or Bangla).
 * Names that don't match leave that level null; they are never an error.
 */
export async function resolveAddressLocation(input: AddressLocationInput): Promise<ResolvedAddressLocation> {
  const { byId, children, roots } = await locationTree();
  let chain: Loc[] = [];
  if (input.locationId !== undefined && input.locationId !== null && String(input.locationId) !== "") {
    if (!byId.has(String(input.locationId))) throw new BadRequestError("Unknown delivery area", "LOCATION_NOT_FOUND");
    chain = await locationChain(input.locationId);
  } else {
    const division = input.division ? roots.find((l) => matches(l, input.division!)) : undefined;
    const districtPool = division
      ? children.get(String(division.id)) ?? []
      : roots.flatMap((r) => children.get(String(r.id)) ?? []);
    const district = input.district ? districtPool.find((l) => matches(l, input.district!)) : undefined;
    const upazila = district && input.upazila
      ? (children.get(String(district.id)) ?? []).find((l) => matches(l, input.upazila!))
      : undefined;
    if (district) chain = await locationChain((upazila ?? district).id);
    else if (division) chain = [division];
  }
  const at = (d: number) => chain.find((l) => locationDepth(l) === d) ?? null;
  return { chain, division: at(1), district: at(2), upazila: at(3), location: chain[chain.length - 1] ?? null };
}

// ------------------------------------------------------------ API shapes

const pub = (l: Loc) => ({
  id: String(l.id),
  parentId: l.parentId === null ? null : String(l.parentId),
  type: l.type,
  en: l.nameEn,
  bn: l.nameBn,
});

/** Storefront: every location the store delivers to, flat, parents before children. */
export async function publicLocations(storeId: bigint) {
  const { roots, children } = await locationTree();
  const off = await storeLocationsOff(storeId);
  const out: ReturnType<typeof pub>[] = [];
  const walk = (l: Loc) => {
    if (off.has(String(l.id))) return;
    out.push(pub(l));
    for (const c of children.get(String(l.id)) ?? []) walk(c);
  };
  roots.forEach(walk);
  return out;
}

/** Store admin: every location with its delivery switch and the zones that name it. */
export async function adminLocations(storeId: bigint) {
  const { roots, children } = await locationTree();
  const off = await storeLocationsOff(storeId);
  const links = await prisma.shippingZoneLocation.findMany({
    where: { zone: { storeId } },
    select: { locationId: true, zone: { select: { id: true, name: true } } },
  });
  const zonesFor = new Map<string, { id: string; name: string }[]>();
  for (const l of links) {
    const k = String(l.locationId);
    if (!zonesFor.has(k)) zonesFor.set(k, []);
    zonesFor.get(k)!.push({ id: String(l.zone.id), name: l.zone.name });
  }
  const out: (ReturnType<typeof pub> & { delivery: boolean; zones: { id: string; name: string }[] })[] = [];
  const walk = (l: Loc) => {
    out.push({ ...pub(l), delivery: !off.has(String(l.id)), zones: zonesFor.get(String(l.id)) ?? [] });
    for (const c of children.get(String(l.id)) ?? []) walk(c);
  };
  roots.forEach(walk);
  return out;
}

export async function setLocationDelivery(storeId: bigint, locationId: bigint, enabled: boolean) {
  const { byId } = await locationTree();
  const loc = byId.get(String(locationId));
  if (!loc) throw new NotFoundError("Location", String(locationId));
  if (enabled) {
    await prisma.storeLocationOff.deleteMany({ where: { storeId, locationId } });
  } else {
    await prisma.storeLocationOff.upsert({
      where: { storeId_locationId: { storeId, locationId } },
      create: { storeId, locationId },
      update: {},
    });
  }
  return { id: String(locationId), delivery: enabled };
}

/**
 * Fills an address's division/district/upazila from the picked location, or finds the location
 * from the typed names. Only Bangladesh addresses; others come back unchanged with no location.
 */
export async function addressWithLocation<T extends {
  countryCode?: string | null;
  locationId?: bigint | string | null;
  division?: string | null;
  district?: string | null;
  upazila?: string | null;
}>(address: T): Promise<T & { locationId: bigint | null; chain: Loc[] }> {
  if ((address.countryCode ?? "BD") !== "BD") return { ...address, locationId: null, chain: [] };
  const place = await resolveAddressLocation(address);
  const picked = address.locationId !== undefined && address.locationId !== null && String(address.locationId) !== "";
  if (picked && !place.district) {
    throw new BadRequestError("Pick a district for the address", "LOCATION_NOT_FOUND");
  }
  return {
    ...address,
    division: picked ? place.division?.nameEn ?? null : address.division,
    district: picked ? place.district!.nameEn : address.district,
    upazila: picked ? place.upazila?.nameEn ?? null : address.upazila,
    locationId: place.location && place.district ? place.location.id : null,
    chain: place.chain,
  };
}
