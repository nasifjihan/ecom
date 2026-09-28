/**
 * STORE LANGUAGES — which languages the storefront offers and which it opens in.
 * Stored on StoreLocalizationSetting (`allowedLanguages`, `defaultLanguage`); English is always on.
 */
import { prisma } from "../../config"
import { LOCALE_NAMES, LOCALES, normalizeLocale, type Locale } from "../../core"

export interface StoreLanguages {
  enabled: Locale[]
  default: Locale
}

/** Keeps known codes, always English, in a stable order; the default must be one of them. */
export function cleanLanguages(enabled: unknown, def: unknown): StoreLanguages {
  const wanted = new Set(Array.isArray(enabled) ? enabled.map((c) => normalizeLocale(c)) : [])
  wanted.add("en")
  const list = LOCALES.filter((l) => wanted.has(l))
  const d = normalizeLocale(def)
  return { enabled: list, default: list.includes(d) ? d : "en" }
}

export async function storeLanguages(storeId: bigint): Promise<StoreLanguages> {
  const s = await prisma.storeLocalizationSetting.findUnique({
    where: { storeId },
    select: { allowedLanguages: true, defaultLanguage: true },
  })
  return cleanLanguages(s?.allowedLanguages, s?.defaultLanguage)
}

/** Each store's default language, kept a minute (storefront requests that don't name one use it). */
const defaults = new Map<string, { locale: Locale; until: number }>()

export async function defaultLocale(storeId: bigint): Promise<Locale> {
  const hit = defaults.get(String(storeId))
  if (hit && hit.until > Date.now()) return hit.locale
  const locale = (await storeLanguages(storeId)).default
  defaults.set(String(storeId), { locale, until: Date.now() + 60_000 })
  return locale
}

export async function saveStoreLanguages(storeId: bigint, enabled: string[], def: string) {
  const clean = cleanLanguages(enabled, def)
  defaults.delete(String(storeId))
  await prisma.storeLocalizationSetting.upsert({
    where: { storeId },
    update: { allowedLanguages: clean.enabled, defaultLanguage: clean.default },
    create: {
      storeId,
      defaultCurrency: "BDT",
      allowedLanguages: clean.enabled,
      defaultLanguage: clean.default,
    },
  })
  return clean
}

/** For the admin page: every language we have, with whether the shop offers it. */
export function languagesView(l: StoreLanguages) {
  return {
    languages: LOCALES.map((code) => ({
      code,
      ...LOCALE_NAMES[code],
      enabled: l.enabled.includes(code),
    })),
    defaultLanguage: l.default,
  }
}
