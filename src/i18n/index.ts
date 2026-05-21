import { en } from "./en";
import { fr } from "./fr";
import { de } from "./de";
import { es } from "./es";
import { zh } from "./zh";
import { ja } from "./ja";
import { ar } from "./ar";
import { uk } from "./uk";
import type { Locale, TranslationKey, Translations } from "./types";

export type { Locale, TranslationKey, Translations };

/**
 * All bundles indexed by locale. English is `as const` (it defines the
 * key set) while the others are typed `Translations`, which keeps the
 * record shape uniform at the call site.
 */
const translations: Record<Locale, Translations> = {
  en,
  fr,
  de,
  es,
  zh,
  ja,
  ar,
  uk
};

/**
 * Resolve the best-fit locale from the browser's language preferences.
 * Falls back to English when no prefix matches a supported locale.
 */
export function detectLocale(): Locale {
  const raw = (navigator.languages?.[0] || navigator.language || "en").toLowerCase();
  if (raw.startsWith("fr")) return "fr";
  if (raw.startsWith("en")) return "en";
  if (raw.startsWith("de")) return "de";
  if (raw.startsWith("es")) return "es";
  if (raw.startsWith("zh")) return "zh";
  if (raw.startsWith("ja")) return "ja";
  if (raw.startsWith("ar")) return "ar";
  if (raw.startsWith("uk")) return "uk";
  return "en";
}

/**
 * Build a translator for the given locale. Unknown keys fall back to
 * the English bundle ; if a key is missing there too, the key itself
 * is returned so it shows up in the UI rather than silently rendering
 * an empty string.
 */
export function makeTranslator(locale: Locale) {
  return (key: TranslationKey) => translations[locale]?.[key] ?? translations.en[key] ?? key;
}

export function formatLocaleDate(locale: Locale, date: Date) {
  return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

export function getDirection(locale: Locale) {
  return locale === "ar" ? "rtl" : "ltr";
}
