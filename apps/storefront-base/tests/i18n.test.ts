/**
 * Every t("…") in the storefronts has Bangla, with the same {placeholders}, and translate() fills
 * them. Keys are read straight from the source, so a new t("…") without Bangla fails here.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BN } from "../src/i18n/bn";
import { translate } from "../src/i18n/translate";

const ROOTS = [join(__dirname, "../src"), join(__dirname, "../../storefront-fashion/src")];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return files(p);
    return /\.(tsx?|jsx?)$/.test(name) ? [p] : [];
  });
}

/** Literal first arguments of t(…) and msg(…) calls. */
function keys(): Map<string, string> {
  const found = new Map<string, string>();
  const call = /(?<![\w.])(?:t|msg)\(\s*"((?:[^"\\]|\\.)*)"/g;
  for (const root of ROOTS)
    for (const f of files(root)) {
      const src = readFileSync(f, "utf8");
      for (const m of src.matchAll(call)) found.set(JSON.parse(`"${m[1]}"`) as string, f);
    }
  return found;
}

const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("storefront Bangla", () => {
  const all = keys();

  it("finds the storefront's words", () => {
    expect(all.size).toBeGreaterThan(200);
  });

  it("has Bangla for every t(…) text", () => {
    const missing = [...all.keys()].filter((k) => BN[k] === undefined);
    expect(missing).toEqual([]);
  });

  it("keeps the same {placeholders} in Bangla", () => {
    const wrong = Object.entries(BN).filter(([en, bn]) => vars(en).join() !== vars(bn).join());
    expect(wrong).toEqual([]);
  });

  it("fills placeholders and falls back to English", () => {
    expect(translate("bn", "{n} items", { n: 3 })).toBe(BN["{n} items"]!.replace("{n}", "3"));
    expect(translate("en", "{n} items", { n: 3 })).toBe("3 items");
    expect(translate("bn", "Not a known text")).toBe("Not a known text");
  });
});
