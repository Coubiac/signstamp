// Unicode combining diacritical marks block (U+0300 to U+036F).
// Built from code points so the source file stays pure ASCII —
// editors and tools that mishandle multi-byte characters in the
// regex literal cannot break it.
const COMBINING_DIACRITICS = new RegExp(
  `[${String.fromCodePoint(0x0300)}-${String.fromCodePoint(0x036f)}]`,
  "g"
);

/**
 * Aggressive comparison-normalizer for field-name matching.
 *
 * Lowercases, strips combining diacritics (so the accented form of
 * "Prenom" matches the unaccented form), and collapses every
 * separator (space, dash, underscore, dot) to nothing. After
 * normalization, "First name", "first_name", "FIRST-NAME" and
 * "first.name" all collapse to "firstname".
 *
 * The function is intentionally lossy : it is only meant for matching
 * two strings, never for displaying them.
 */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(COMBINING_DIACRITICS, "")
    .replace(/[\s\-_.]/g, "");
}
