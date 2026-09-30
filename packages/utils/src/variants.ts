/**
 * VARIANT GENERATOR — every combination of a product's options (Size × Colour …), with SKUs.
 * Options are stored on a variant as `attributeValues`, keyed by the option name in lowercase
 * ({ size: "M", colour: "Red" }); the storefront shows them as "Size: M • Colour: Red".
 */

export interface VariantOption {
  name: string;
  values: string[];
}

/** The most combinations one run can make. */
export const MAX_COMBINATIONS = 100;

/** An option's key on a variant: its name, trimmed and lowercase. */
export const optionKey = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ");

/** "S, M,  l ,M" → ["S", "M", "l"]: trimmed, empties and repeats (any case) dropped. */
export function cleanValues(raw: string | string[]): string[] {
  const list = Array.isArray(raw) ? raw : raw.split(",");
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of list) {
    const t = v.trim().replace(/\s+/g, " ");
    if (!t || seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    out.push(t);
  }
  return out;
}

/** Options with a name and at least one value, merged by name, in the order given. */
export function usableOptions(options: VariantOption[]): VariantOption[] {
  const byKey = new Map<string, VariantOption>();
  for (const o of options) {
    const key = optionKey(o.name);
    const values = cleanValues(o.values);
    if (!key || !values.length) continue;
    const had = byKey.get(key);
    byKey.set(key, had ? { name: had.name, values: cleanValues([...had.values, ...values]) } : { name: o.name.trim(), values });
  }
  return [...byKey.values()];
}

/** How many variants the options make. */
export const combinationCount = (options: VariantOption[]) =>
  usableOptions(options).reduce((n, o) => n * o.values.length, usableOptions(options).length ? 1 : 0);

/** Every combination, first option varying slowest: S/Red, S/Blue, M/Red … */
export function combinations(options: VariantOption[]): Record<string, string>[] {
  const opts = usableOptions(options);
  if (!opts.length) return [];
  let out: Record<string, string>[] = [{}];
  for (const o of opts) {
    const key = optionKey(o.name);
    out = out.flatMap((c) => o.values.map((v) => ({ ...c, [key]: v })));
  }
  return out;
}

/** A SKU part: letters and digits only, uppercase ("Sky Blue" → "SKYBLUE", "৩৮" kept as is). */
const skuPart = (s: string) => s.toUpperCase().replace(/[^\p{L}\p{N}]+/gu, "");

/** "TS-01" + { size: "M", colour: "Sky Blue" } → "TS-01-M-SKYBLUE". */
export function skuFor(prefix: string, values: Record<string, string>): string {
  const head = prefix.trim().toUpperCase().replace(/\s+/g, "-").replace(/-+$/, "");
  const tail = Object.values(values).map(skuPart).filter(Boolean);
  return [head, ...tail].filter(Boolean).join("-");
}

/** Do two variants have the same options (names and values, any case)? */
export function sameOptions(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const norm = (o: Record<string, unknown>) =>
    Object.entries(o)
      .map(([k, v]) => `${optionKey(k)}=${String(v).trim().toLowerCase()}`)
      .sort()
      .join("|");
  return norm(a) === norm(b);
}

export interface GeneratedVariant {
  attributeValues: Record<string, string>;
  sku: string;
}

/**
 * The combinations a product doesn't have yet (existing ones are kept as they are), with SKUs
 * that don't clash with its own. `tooMany` when the options make more than MAX_COMBINATIONS.
 */
export function generateVariants(
  options: VariantOption[],
  skuPrefix: string,
  existing: { attributeValues?: Record<string, unknown> | null; sku?: string | null }[] = [],
): { toAdd: GeneratedVariant[]; alreadyThere: number; total: number; tooMany: boolean } {
  const total = combinationCount(options);
  if (total > MAX_COMBINATIONS) return { toAdd: [], alreadyThere: 0, total, tooMany: true };
  const skus = new Set(existing.map((e) => (e.sku ?? "").toUpperCase()).filter(Boolean));
  const toAdd: GeneratedVariant[] = [];
  let alreadyThere = 0;
  for (const values of combinations(options)) {
    if (existing.some((e) => sameOptions(e.attributeValues ?? {}, values))) {
      alreadyThere++;
      continue;
    }
    let sku = skuFor(skuPrefix, values);
    // Two values can make the same SKU ("Sky Blue" and "Sky-blue"): number the later one.
    for (let n = 2; sku && skus.has(sku.toUpperCase()); n++) sku = `${skuFor(skuPrefix, values)}-${n}`;
    if (sku) skus.add(sku.toUpperCase());
    toAdd.push({ attributeValues: values, sku });
  }
  return { toAdd, alreadyThere, total, tooMany: false };
}

/** The options a product's variants already use, to start the generator from them. */
export function optionsOf(variants: { attributeValues?: Record<string, unknown> | null }[]): VariantOption[] {
  const byKey = new Map<string, VariantOption>();
  for (const v of variants) {
    for (const [k, raw] of Object.entries(v.attributeValues ?? {})) {
      const key = optionKey(k);
      const value = String(raw);
      const o = byKey.get(key) ?? { name: key.charAt(0).toUpperCase() + key.slice(1), values: [] };
      o.values = cleanValues([...o.values, value]);
      byKey.set(key, o);
    }
  }
  return [...byKey.values()];
}
