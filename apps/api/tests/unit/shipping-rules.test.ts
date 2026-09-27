import { describe, it, expect } from "vitest";
import {
  chargeableKg,
  methodCost,
  pickZone,
  zoneSpecificity,
  type AddressForMatch,
  type ChainLoc,
  type ZoneForMatch,
} from "../../src/modules/shipping/shipping.rules";
import { readLocationTree } from "../../src/modules/locations/locations.data";

// Division 1 -> district 10 -> thana 100 (Dhaka / Dhaka / Dhanmondi); division 2 -> district 20 (Chattogram).
const dhakaDiv: ChainLoc = { id: 1n, nameEn: "Dhaka", depth: 1 };
const dhakaDist: ChainLoc = { id: 10n, nameEn: "Dhaka", depth: 2 };
const dhanmondi: ChainLoc = { id: 100n, nameEn: "Dhanmondi", depth: 3 };
const ctgDiv: ChainLoc = { id: 2n, nameEn: "Chattogram", depth: 1 };
const ctgDist: ChainLoc = { id: 20n, nameEn: "Chattogram", depth: 2 };

const addr = (chain: ChainLoc[], over: Partial<AddressForMatch> = {}): AddressForMatch => ({ countryCode: "BD", chain, ...over });
const zone = (over: Partial<ZoneForMatch> = {}): ZoneForMatch => ({ countries: ["BD"], locationIds: [], ...over });

describe("zoneSpecificity", () => {
  const cases: [string, ZoneForMatch, AddressForMatch, number | null][] = [
    ["country-wide zone", zone(), addr([dhakaDiv, dhakaDist, dhanmondi]), 0],
    ["other country", zone({ countries: ["US"] }), addr([dhakaDiv]), null],
    ["'*' country", zone({ countries: ["*"] }), addr([]), 0],
    ["division zone", zone({ locationIds: [1n] }), addr([dhakaDiv, dhakaDist, dhanmondi]), 1],
    ["district zone", zone({ locationIds: [10n] }), addr([dhakaDiv, dhakaDist, dhanmondi]), 2],
    ["thana zone", zone({ locationIds: [100n] }), addr([dhakaDiv, dhakaDist, dhanmondi]), 3],
    ["deepest of several hits", zone({ locationIds: [1n, 100n] }), addr([dhakaDiv, dhakaDist, dhanmondi]), 3],
    ["location elsewhere", zone({ locationIds: [20n] }), addr([dhakaDiv, dhakaDist]), null],
    ["address not in the list", zone({ locationIds: [1n] }), addr([]), null],
    ["disabled zone", zone({ enabled: false }), addr([dhakaDiv]), null],
    ["legacy name (division)", zone({ states: ["Chittagong"] }), addr([ctgDiv, ctgDist]), 2],
    ["legacy name, raw text", zone({ states: ["Sylhet"] }), addr([], { division: "Sylhet" }), 1],
    ["legacy name miss", zone({ states: ["Sylhet"] }), addr([dhakaDiv]), null],
    ["postcode in range", zone({ postcodes: ["1200-1230"] }), addr([], { postcode: "1209" }), 0],
    ["postcode outside range", zone({ postcodes: ["1200-1230"] }), addr([], { postcode: "4000" }), null],
  ];
  it.each(cases)("%s", (_name, z, a, expected) => {
    expect(zoneSpecificity(z, a)).toBe(expected);
  });
});

describe("pickZone", () => {
  it("prefers the most specific zone even when it costs more", () => {
    const best = pickZone([
      { name: "country", specificity: 1, cheapest: 60 },
      { name: "dhaka", specificity: 2, cheapest: 120 },
    ]);
    expect(best?.name).toBe("dhaka");
  });
  it("breaks ties on the cheaper option", () => {
    const best = pickZone([
      { name: "a", specificity: 2, cheapest: 150 },
      { name: "b", specificity: 2, cheapest: 90 },
    ]);
    expect(best?.name).toBe("b");
  });
  it("skips a more specific zone that has nothing to offer this cart", () => {
    const best = pickZone([
      { name: "dhaka", specificity: 2, cheapest: 120 },
      { name: "dhanmondi", specificity: 3, cheapest: Infinity },
    ]);
    expect(best?.name).toBe("dhaka");
  });
  it("still names a zone when none can deliver", () => {
    expect(pickZone([{ name: "x", specificity: 1, cheapest: Infinity }])?.name).toBe("x");
  });
  it("returns null when nothing matched", () => {
    expect(pickZone([])).toBeNull();
  });
});

describe("methodCost", () => {
  const cart = (subtotal: number, weightKG = 0, qty = 1) => ({ subtotal, weightKG, qty });
  const base = { baseCost: 60, perItemCost: 0, costRules: { perKgExtra: 20, minimumCost: 0 } };

  it("charges per started half kilo above 0.5 kg", () => {
    expect(chargeableKg(1.2)).toBe(1.5);
    const r = methodCost(base, cart(500, 1.2));
    expect(r).toMatchObject({ available: true, cost: 80 }); // 60 + (1.5 - 0.5) * 20
  });
  it("adds per-item cost and respects the minimum", () => {
    expect(methodCost({ ...base, perItemCost: 5 }, cart(500, 0, 3))).toMatchObject({ cost: 75 });
    expect(methodCost({ ...base, costRules: { minimumCost: 100 } }, cart(500))).toMatchObject({ cost: 100 });
  });
  it("is free from the free-delivery subtotal", () => {
    expect(methodCost({ ...base, freeFromSubtotal: 1000 }, cart(1000, 2))).toMatchObject({ cost: 0, free: true, beforeFree: 90 });
    expect(methodCost({ ...base, freeFromSubtotal: 1000 }, cart(999))).toMatchObject({ cost: 60, free: false });
  });
  it("hides a method below its minimum order", () => {
    expect(methodCost({ ...base, costRules: { minSubtotal: 2000 } }, cart(1500))).toMatchObject({ available: false });
    expect(methodCost({ ...base, costRules: { minSubtotal: 2000 } }, cart(2000))).toMatchObject({ available: true });
  });
  it("hides a disabled method", () => {
    expect(methodCost({ ...base, enabled: false }, cart(500))).toMatchObject({ available: false });
  });

  const tiered = {
    baseCost: 999, // ignored when tiers exist
    costRules: JSON.stringify({ perKgExtra: 25, weightTiers: [{ upToKg: 3, cost: 110 }, { upToKg: 1, cost: 70 }] }),
  };
  it.each([
    [0.3, 70],
    [1, 70],
    [1.1, 110], // 1.5 kg chargeable -> 3 kg tier
    [3, 110],
    [3.2, 135], // one started kg above the last tier
    [5, 160],
  ])("weight tiers: %s kg costs %s", (kg, expected) => {
    expect(methodCost(tiered, cart(100, kg))).toMatchObject({ cost: expected });
  });
});

describe("bundled location list", () => {
  it("has 8 divisions, 64 districts, the upazilas and the Dhaka thanas, with Bangla names", () => {
    const tree = readLocationTree();
    const all = tree.flatMap((d) => [d, ...(d.children ?? []).flatMap((x) => [x, ...(x.children ?? [])])]);
    const count = (t: string) => all.filter((n) => n.type === t).length;
    expect(count("DIVISION")).toBe(8);
    expect(count("DISTRICT")).toBe(64);
    expect(count("UPAZILA")).toBe(494);
    expect(count("THANA")).toBe(50);
    expect(new Set(all.map((n) => n.code)).size).toBe(all.length);
    expect(all.every((n) => n.en && n.bn)).toBe(true);
    expect(tree.map((d) => d.en)).toEqual(["Barishal", "Chattogram", "Dhaka", "Khulna", "Mymensingh", "Rajshahi", "Rangpur", "Sylhet"]);
  });
});
