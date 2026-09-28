/**
 * STOREFRONT LANGUAGE — the storefront's own words in English and Bangla.
 *
 * The English text is the key: `t("Add to Cart")` shows "কার্টে যোগ করুন" in Bangla and the
 * English as it is otherwise, so a missing translation still reads fine. `{name}` placeholders
 * are filled from `vars`. Shop content (products, categories, menus) comes translated from the
 * API instead. `tests/i18n.test.ts` checks every t("…") in the storefronts has a Bangla entry.
 */
import { BN } from "./bn";

export type Locale = "en" | "bn";

/** The cookie that remembers the shopper's choice. */
export const LOCALE_COOKIE = "lang";

export const LOCALE_LABELS: Record<Locale, string> = { en: "English", bn: "বাংলা" };

/** For toLocaleDateString(): "28 Sept 2026" / "২৮ সেপ্টেম্বর, ২০২৬". */
export const DATE_LOCALES: Record<Locale, string> = { en: "en-GB", bn: "bn-BD" };

export const toLocale = (v: unknown): Locale | null => (v === "bn" ? "bn" : v === "en" ? "en" : null);

export type TranslateVars = Record<string, string | number>;

export function translate(locale: Locale, text: string, vars?: TranslateVars): string {
  const base = locale === "bn" ? (BN[text] ?? text) : text;
  if (!vars) return base;
  return base.replace(/\{(\w+)\}/g, (m: string, k: string) => (vars[k] !== undefined ? String(vars[k]) : m));
}

export type Translator = (text: string, vars?: TranslateVars) => string;

/**
 * Marks English kept in a list or constant and translated later with t(label): it returns the text
 * as it is, and lets tests/i18n.test.ts find it.
 */
export const msg = (text: string): string => text;

export const translatorFor =
  (locale: Locale): Translator =>
  (text, vars) =>
    translate(locale, text, vars);

/** Order statuses as words (English keys; translate with t()). */
export const ORDER_STATUS_WORDS: Record<string, string> = {
  PENDING: msg("Pending"),
  PROCESSING: msg("Processing"),
  ON_HOLD: msg("On hold"),
  SHIPPED: msg("Shipped"),
  OUT_FOR_DELIVERY: msg("Out for delivery"),
  DELIVERED: msg("Delivered"),
  COMPLETED: msg("Completed"),
  CANCELLED: msg("Cancelled"),
  REFUNDED: msg("Refunded"),
  PARTIALLY_REFUNDED: msg("Partly refunded"),
  FAILED: msg("Failed"),
};
export const orderStatusWord = (status: string): string =>
  ORDER_STATUS_WORDS[status.toUpperCase()] ?? status.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
