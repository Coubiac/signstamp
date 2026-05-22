import type { Locale } from "./types";

/**
 * Localized labels for the canonical profile keys (see
 * `CANONICAL_PROFILE_KEYS` in `src/constants.ts`). Kept here instead
 * of in the main `Translations` bundle because the shape differs : a
 * per-locale `key → label` map, not a flat string lookup.
 *
 * Custom keys the user adds are not in this table — they fall through
 * to the key itself (so a custom "twitter" key is shown as "twitter").
 */
const PROFILE_LABELS: Record<Locale, Record<string, string>> = {
  en: {
    firstName: "First name",
    lastName: "Last name",
    email: "Email",
    phone: "Phone",
    address: "Address",
    city: "City",
    zip: "ZIP code",
    country: "Country",
    dateOfBirth: "Date of birth",
    iban: "IBAN"
  },
  fr: {
    firstName: "Prénom",
    lastName: "Nom",
    email: "Email",
    phone: "Téléphone",
    address: "Adresse",
    city: "Ville",
    zip: "Code postal",
    country: "Pays",
    dateOfBirth: "Date de naissance",
    iban: "IBAN"
  },
  de: {
    firstName: "Vorname",
    lastName: "Nachname",
    email: "E-Mail",
    phone: "Telefon",
    address: "Adresse",
    city: "Stadt",
    zip: "Postleitzahl",
    country: "Land",
    dateOfBirth: "Geburtsdatum",
    iban: "IBAN"
  },
  es: {
    firstName: "Nombre",
    lastName: "Apellido",
    email: "Correo",
    phone: "Teléfono",
    address: "Dirección",
    city: "Ciudad",
    zip: "Código postal",
    country: "País",
    dateOfBirth: "Fecha de nacimiento",
    iban: "IBAN"
  },
  zh: {
    firstName: "名字",
    lastName: "姓氏",
    email: "电子邮件",
    phone: "电话",
    address: "地址",
    city: "城市",
    zip: "邮政编码",
    country: "国家",
    dateOfBirth: "出生日期",
    iban: "IBAN"
  },
  ja: {
    firstName: "名",
    lastName: "姓",
    email: "メール",
    phone: "電話",
    address: "住所",
    city: "市区町村",
    zip: "郵便番号",
    country: "国",
    dateOfBirth: "生年月日",
    iban: "IBAN"
  },
  ar: {
    firstName: "الاسم الأول",
    lastName: "اسم العائلة",
    email: "البريد الإلكتروني",
    phone: "الهاتف",
    address: "العنوان",
    city: "المدينة",
    zip: "الرمز البريدي",
    country: "البلد",
    dateOfBirth: "تاريخ الميلاد",
    iban: "IBAN"
  },
  uk: {
    firstName: "Ім'я",
    lastName: "Прізвище",
    email: "Email",
    phone: "Телефон",
    address: "Адреса",
    city: "Місто",
    zip: "Поштовий індекс",
    country: "Країна",
    dateOfBirth: "Дата народження",
    iban: "IBAN"
  }
};

export function getProfileLabel(key: string, locale: Locale): string {
  return PROFILE_LABELS[locale]?.[key] ?? PROFILE_LABELS.en[key] ?? key;
}

/**
 * Native `<input type="...">` for the canonical keys that benefit
 * from a typed control (date picker, email keyboard on mobile, …).
 * Falls back to "text" for unknown keys.
 */
export function inputTypeForProfileKey(key: string): string {
  switch (key) {
    case "email": return "email";
    case "phone": return "tel";
    case "dateOfBirth": return "date";
    default: return "text";
  }
}
