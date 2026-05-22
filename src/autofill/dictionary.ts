import { CANONICAL_PROFILE_KEYS } from "../constants";

/**
 * Canonical profile keys the auto-fill engine knows how to populate.
 * Derived from the runtime list so adding a new canonical key in
 * `constants.ts` immediately surfaces a TypeScript error here until
 * the dictionary entry is added.
 */
export type CanonicalProfileKey = typeof CANONICAL_PROFILE_KEYS[number];

/**
 * Multilingual aliases the auto-fill matcher checks PDF field names
 * (and alternativeText) against. Each alias is compared **after**
 * normalization (lowercase, diacritic-stripped, separator-free), so
 * each language only needs the bare lemma — "Téléphone", "telephone"
 * and "TELEPHONE" all match the single entry "telephone".
 *
 * The dictionary is exhaustive over `CANONICAL_PROFILE_KEYS` thanks
 * to the typed `Record` ; adding a canonical key without aliases
 * fails type-check.
 */
export const FIELD_DICTIONARY: Record<CanonicalProfileKey, readonly string[]> = {
  firstName: [
    "firstname", "givenname", "forename",  // en
    "prenom",                               // fr
    "vorname",                              // de
    "nombre",                               // es
    "imya", "im'ya",                        // uk transliterations users sometimes use
    "ім'я",                                 // uk
    "имя",                                  // ru (encountered in forms tagged ru-uk)
    "名前", "名"                             // ja
  ],
  lastName: [
    "lastname", "surname", "familyname",   // en
    "nom",                                  // fr (note: "nom" alone is ambiguous w/ "name", we accept the false-positive risk on raw names — alternativeText usually disambiguates)
    "nachname", "familienname",             // de
    "apellido", "apellidos",                // es
    "prizvyshche",                          // uk transliteration
    "прізвище",                             // uk
    "фамилия",                              // ru
    "姓", "苗字"                             // ja
  ],
  email: [
    "email", "emailaddress", "mail",        // en
    "courriel",                             // fr
    "epost",                                // de (E-Post is rare but used)
    "correo", "correoelectronico",          // es
    "メール", "メールアドレス",                 // ja
    "邮箱", "电子邮件",                       // zh
    "البريد", "البريدالإلكتروني",            // ar (after normalize: contiguous)
    "пошта", "електроннапошта"              // uk
  ],
  phone: [
    "phone", "tel", "telephone",            // en
    "phonenumber", "mobile", "cell",        // en variants
    "portable",                             // fr
    "telefon", "handy",                     // de
    "telefono", "movil",                    // es
    "電話", "電話番号", "携帯",                // ja
    "电话", "手机",                          // zh
    "هاتف", "جوال",                         // ar
    "телефон"                               // uk
  ],
  address: [
    "address", "addr", "streetaddress", "street",  // en
    "adresse", "rue",                       // fr
    "anschrift", "strasse",                 // de (de uses "straße" → after normalize "strasse")
    "direccion", "calle",                   // es
    "住所",                                  // ja
    "地址",                                  // zh
    "العنوان",                              // ar
    "адреса"                                // uk
  ],
  city: [
    "city", "town",                         // en
    "ville", "commune",                     // fr
    "stadt", "ort",                         // de
    "ciudad", "poblacion",                  // es
    "市", "市区町村",                         // ja
    "城市",                                  // zh
    "المدينة",                              // ar
    "місто"                                 // uk
  ],
  zip: [
    "zip", "zipcode", "postalcode", "postcode",  // en
    "cp", "codepostal",                     // fr
    "plz", "postleitzahl",                  // de
    "codigopostal",                         // es
    "郵便番号",                              // ja
    "邮政编码",                              // zh
    "الرمزالبريدي",                         // ar
    "поштовийіндекс"                        // uk
  ],
  country: [
    "country", "nation", "nationality",     // en
    "pays", "nationalite",                  // fr
    "land",                                 // de
    "pais", "nacionalidad",                 // es
    "国", "国籍",                            // ja
    "国家",                                  // zh
    "البلد", "بلد",                         // ar
    "країна"                                // uk
  ],
  dateOfBirth: [
    "dateofbirth", "dob", "birthdate", "birthday",  // en
    "datedenaissance", "naissance",         // fr
    "geburtsdatum", "geburtstag",           // de
    "fechadenacimiento", "nacimiento",      // es
    "生年月日", "誕生日",                     // ja
    "出生日期", "生日",                       // zh
    "تاريخالميلاد",                         // ar
    "датанародження", "деньнародження"      // uk
  ],
  iban: [
    "iban", "ibannumber",                   // universal
    "kontonummer",                          // de
    "numerodecuenta",                       // es
    "口座番号",                              // ja
    "银行账号",                              // zh
    "رقمالحساب",                            // ar
    "номеррахунку"                          // uk
  ]
};
