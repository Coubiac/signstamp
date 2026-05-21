import { afterEach, describe, expect, it } from "vitest";
import { detectLocale, formatLocaleDate, getDirection, makeTranslator } from "./index";
import { en } from "./en";
import { fr } from "./fr";
import { de } from "./de";
import { es } from "./es";
import { zh } from "./zh";
import { ja } from "./ja";
import { ar } from "./ar";
import { uk } from "./uk";
import type { Locale } from "./types";

const ALL_LOCALES: Record<Locale, Record<string, string>> = { en, fr, de, es, zh, ja, ar, uk };

function setLang(value: string) {
  Object.defineProperty(navigator, "language", { value, configurable: true });
  Object.defineProperty(navigator, "languages", { value: [value], configurable: true });
}

afterEach(() => {
  setLang("en-US");
});

describe("i18n bundles", () => {
  it("every locale provides a value for every English key (no silent fallback)", () => {
    const enKeys = Object.keys(en);
    for (const [name, bundle] of Object.entries(ALL_LOCALES)) {
      const missing = enKeys.filter((k) => !(k in bundle));
      expect(missing, `${name} is missing keys: ${missing.join(", ")}`).toEqual([]);
    }
  });

  it("no locale defines extraneous keys outside the English contract", () => {
    const enKeys = new Set(Object.keys(en));
    for (const [name, bundle] of Object.entries(ALL_LOCALES)) {
      const extras = Object.keys(bundle).filter((k) => !enKeys.has(k));
      expect(extras, `${name} has unknown keys: ${extras.join(", ")}`).toEqual([]);
    }
  });
});

describe("detectLocale", () => {
  it("picks fr for any fr-* tag", () => {
    setLang("fr-CA");
    expect(detectLocale()).toBe("fr");
  });

  it("picks zh for zh-Hans-CN", () => {
    setLang("zh-Hans-CN");
    expect(detectLocale()).toBe("zh");
  });

  it("falls back to en for unknown languages", () => {
    setLang("xx-YY");
    expect(detectLocale()).toBe("en");
  });
});

describe("makeTranslator", () => {
  it("returns the translation for the active locale", () => {
    const t = makeTranslator("fr");
    expect(t("tool_pan")).toBe("Déplacer");
  });

  it("returns the key itself when called with an unknown one (after type casting)", () => {
    const t = makeTranslator("en");
    // Cast to bypass the strict key type at the test boundary.
    expect(t("does_not_exist" as any)).toBe("does_not_exist");
  });
});

describe("getDirection", () => {
  it("returns rtl for Arabic", () => {
    expect(getDirection("ar")).toBe("rtl");
  });

  it("returns ltr for every other locale", () => {
    for (const loc of ["en", "fr", "de", "es", "zh", "ja", "uk"] as const) {
      expect(getDirection(loc)).toBe("ltr");
    }
  });
});

describe("formatLocaleDate", () => {
  it("uses the locale's date order", () => {
    // 2026-05-21 — explicit to avoid timezone drift on the test machine.
    const d = new Date(Date.UTC(2026, 4, 21));
    expect(formatLocaleDate("fr", d)).toMatch(/21.05.2026/);
  });
});
