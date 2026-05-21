import { en } from "./en";

/** Set of locale codes the app ships translations for. */
export type Locale = "fr" | "en" | "de" | "es" | "zh" | "ja" | "ar" | "uk";

/**
 * The English bundle is the source of truth : every other locale is
 * typed as a record whose keys match exactly, so a missing or extra
 * key in a translation file becomes a TypeScript error.
 */
export type TranslationKey = keyof typeof en;
export type Translations = Record<TranslationKey, string>;
