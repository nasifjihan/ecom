"use client";

import * as React from "react";
import { setRequestLocale } from "@ecom/api-client";
import { LOCALE_COOKIE, LOCALE_LABELS, translatorFor, type Locale, type Translator } from "./translate";

interface LocaleState {
  locale: Locale;
  /** Languages the shop offers; the switcher shows when there's more than one. */
  languages: Locale[];
  t: Translator;
  setLocale: (l: Locale) => void;
}

const LocaleContext = React.createContext<LocaleState>({
  locale: "en",
  languages: ["en"],
  t: translatorFor("en"),
  setLocale: () => undefined,
});

/** Remembers the choice for a year and reloads, so server pages and API data follow it. */
function chooseLocale(l: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
  window.location.reload();
}

export function LocaleProvider({
  locale,
  languages,
  children,
}: {
  locale: Locale;
  languages: Locale[];
  children: React.ReactNode;
}) {
  // Set before any request goes out, so API answers (names, menus) come in this language.
  setRequestLocale(locale);
  const value = React.useMemo<LocaleState>(
    () => ({ locale, languages, t: translatorFor(locale), setLocale: chooseLocale }),
    [locale, languages],
  );
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export const useLocale = () => React.useContext(LocaleContext);

/** `const t = useT(); t("Add to Cart")` */
export const useT = (): Translator => React.useContext(LocaleContext).t;

/** "English | বাংলা" toggle, shown only when the shop offers both. */
export function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, languages, setLocale, t } = useLocale();
  if (languages.length < 2) return null;
  const other = languages.find((l) => l !== locale) ?? "en";
  return (
    <button
      type="button"
      onClick={() => setLocale(other)}
      className={className ?? "rounded-md px-2 py-1 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"}
      aria-label={t("Change language")}
      title={t("Change language")}
      lang={other}
    >
      {LOCALE_LABELS[other]}
    </button>
  );
}
