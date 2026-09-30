import { describe, it, expect } from "vitest";
import { cleanValues, combinationCount, combinations, generateVariants, optionsOf, sameOptions, skuFor, usableOptions, MAX_COMBINATIONS } from "./variants";

describe("variant generator", () => {
  it("cleans typed values", () => {
    expect(cleanValues("S, M,  l ,M,, m")).toEqual(["S", "M", "l"]);
    expect(cleanValues(["Sky  Blue", "sky blue", " Red "])).toEqual(["Sky Blue", "Red"]);
  });

  it("skips empty options and merges repeated names", () => {
    expect(
      usableOptions([
        { name: "Size", values: ["S", "M"] },
        { name: "", values: ["x"] },
        { name: "Colour", values: [] },
        { name: " size ", values: ["M", "L"] },
      ]),
    ).toEqual([{ name: "Size", values: ["S", "M", "L"] }]);
  });

  it("makes every combination, the first option varying slowest", () => {
    const opts = [
      { name: "Size", values: ["S", "M"] },
      { name: "Colour", values: ["Red", "Sky Blue", "Black"] },
    ];
    expect(combinationCount(opts)).toBe(6);
    expect(combinations(opts).map((c) => `${c.size}/${c.colour}`)).toEqual(["S/Red", "S/Sky Blue", "S/Black", "M/Red", "M/Sky Blue", "M/Black"]);
    expect(combinations([])).toEqual([]);
    expect(combinationCount([])).toBe(0);
  });

  it("builds SKUs from the prefix and values", () => {
    expect(skuFor("ts-01", { size: "M", colour: "Sky Blue" })).toBe("TS-01-M-SKYBLUE");
    expect(skuFor("Panjabi 2026-", { size: "৪০" })).toBe("PANJABI-2026-৪০");
    expect(skuFor("", { size: "XL" })).toBe("XL");
  });

  it("adds only the combinations a product doesn't have, without clashing SKUs", () => {
    const opts = [
      { name: "Size", values: ["M", "L"] },
      { name: "Colour", values: ["Sky Blue", "Sky-blue", "Red"] },
    ];
    const existing = [{ attributeValues: { Colour: "red", size: "M" }, sku: "OLD-1" }];
    const r = generateVariants(opts, "TS", existing);
    expect(r.total).toBe(6);
    expect(r.alreadyThere).toBe(1);
    expect(r.toAdd.map((v) => v.sku)).toEqual(["TS-M-SKYBLUE", "TS-M-SKYBLUE-2", "TS-L-SKYBLUE", "TS-L-SKYBLUE-2", "TS-L-RED"]);
    expect(r.toAdd[0]!.attributeValues).toEqual({ size: "M", colour: "Sky Blue" });
  });

  it("refuses more than the limit", () => {
    const many = [
      { name: "A", values: Array.from({ length: 11 }, (_, i) => `a${i}`) },
      { name: "B", values: Array.from({ length: 10 }, (_, i) => `b${i}`) },
    ];
    expect(generateVariants(many, "X")).toEqual({ toAdd: [], alreadyThere: 0, total: 110, tooMany: true });
    expect(MAX_COMBINATIONS).toBe(100);
  });

  it("reads the options a product's variants already use", () => {
    expect(optionsOf([{ attributeValues: { size: "M", colour: "Red" } }, { attributeValues: { size: "L", colour: "red" } }])).toEqual([
      { name: "Size", values: ["M", "L"] },
      { name: "Colour", values: ["Red"] },
    ]);
    expect(sameOptions({ Size: "m" }, { size: " M " })).toBe(true);
  });
});
