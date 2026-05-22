import { CanonicalProfileKey, FIELD_DICTIONARY } from "./dictionary";
import { normalize } from "./normalize";

/**
 * Pre-normalized lookup index built once at module load. Keys are the
 * normalized aliases ; values are the canonical profile key they
 * resolve to. First-write-wins, so if two canonical keys claim the
 * same normalized alias (which shouldn't happen) the dictionary's
 * declaration order decides — surfacing the conflict early.
 */
const NORMALIZED_INDEX: Map<string, CanonicalProfileKey> = (() => {
  const map = new Map<string, CanonicalProfileKey>();
  for (const key of Object.keys(FIELD_DICTIONARY) as CanonicalProfileKey[]) {
    for (const alias of FIELD_DICTIONARY[key]) {
      const n = normalize(alias);
      if (n && !map.has(n)) map.set(n, key);
    }
  }
  return map;
})();

/**
 * Layer-1 matcher : tries to map a PDF field name (and optional
 * `alternativeText` tooltip) to a canonical profile key by checking
 * against the multilingual alias dictionary. Returns the canonical
 * key on hit, `null` when nothing reasonable matches.
 *
 * The match is exact on normalized form — substring matching is
 * intentionally avoided to keep false positives off (e.g. "name"
 * matching both first and last name). Cryptic field names like
 * "Text12" will fall through here ; layer-2 (label proximity) is
 * meant to catch them.
 */
export function matchFieldName(
  fieldName: string,
  alternativeText?: string
): CanonicalProfileKey | null {
  for (const candidate of [fieldName, alternativeText]) {
    if (!candidate) continue;
    const hit = NORMALIZED_INDEX.get(normalize(candidate));
    if (hit) return hit;
  }
  return null;
}
