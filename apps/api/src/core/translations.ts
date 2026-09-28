/**
 * TRANSLATIONS — rows (products, categories, brands, menu items…) keep their own text in the
 * shop's main language and other languages in a `translations` JSON column:
 *
 *   { "bn": { "name": "জামদানি শাড়ি", "description": "…" } }
 *
 * A request's language (`ctx.locale`) picks the text; anything not translated falls back to the
 * row's own text, so a half-translated shop still reads fine.
 */

export const LOCALES = ["en", "bn"] as const
export type Locale = (typeof LOCALES)[number]

export const LOCALE_NAMES: Record<Locale, { name: string; nativeName: string }> = {
  en: { name: "English", nativeName: "English" },
  bn: { name: "Bangla", nativeName: "বাংলা" },
}

/** "bn-BD", "BN", "bn" → "bn"; anything unknown → "en". */
export function normalizeLocale(raw: unknown): Locale {
  // Only a plain string counts (a repeated ?lang= arrives as an array).
  const code = (typeof raw === "string" ? raw : "")
    .trim()
    .toLowerCase()
    .split(/[-_,;]/)[0]
  return (LOCALES as readonly string[]).includes(code ?? "") ? (code as Locale) : "en"
}

/** The texts a row has in `locale` (non-empty strings only). */
export function translationsFor(json: unknown, locale: string): Record<string, string> {
  if (!json || typeof json !== "object" || Array.isArray(json)) return {}
  const forLocale = (json as Record<string, unknown>)[locale]
  if (!forLocale || typeof forLocale !== "object" || Array.isArray(forLocale)) return {}
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(forLocale as Record<string, unknown>)) {
    if (typeof v === "string" && v.trim()) out[k] = v
  }
  return out
}

/** `row[field]` in `locale`, or the row's own text. */
export function tr<R extends { translations?: unknown }, K extends keyof R & string>(
  row: R,
  locale: string,
  field: K,
): R[K] {
  if (locale === "en") return row[field]
  const t = translationsFor(row.translations, locale)[field]
  return (t ?? row[field]) as R[K]
}

/**
 * Merges `edits` (e.g. `{ bn: { name: "…" } }`) into a row's translations: a blank or null value
 * removes that text, an undefined one leaves it, and a language left with nothing is dropped.
 * Unknown languages are ignored.
 */
export function mergeTranslations(
  current: unknown,
  edits: Partial<Record<string, Record<string, string | null | undefined>>>,
): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {}
  for (const l of LOCALES) {
    const kept = translationsFor(current, l)
    if (Object.keys(kept).length) out[l] = kept
  }
  for (const [l, fields] of Object.entries(edits)) {
    if (!(LOCALES as readonly string[]).includes(l) || !fields) continue
    const next = { ...(out[l] ?? {}) }
    for (const [k, v] of Object.entries(fields)) {
      if (v === undefined) continue
      if (typeof v === "string" && v.trim()) next[k] = v.trim()
      else delete next[k]
    }
    if (Object.keys(next).length) out[l] = next
    else delete out[l]
  }
  return out
}
