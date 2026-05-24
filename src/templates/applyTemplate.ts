import type { Item, Paraph } from "../types";
import type { Locale } from "../i18n/types";
import type { Template } from "./types";
import { formatLocaleDate } from "../i18n";
import { uid } from "../utils/uid";

export type ApplyTemplateArgs = {
  template: Template;
  /** Locale used to format the value of `autoDate` text items. */
  locale: Locale;
  /** Injection point for tests ; defaults to "now" at call time. */
  now?: Date;
};

export type ApplyResult = {
  /** Items ready to merge into the host's items state. IDs are fresh
   *  so re-applying the same template never collides. */
  items: Item[];
  /** Paraph master to push into state, or null if the template had none. */
  paraph: Paraph | null;
};

/**
 * Deep-clone every item via JSON round-trip — safe because items
 * only carry primitive / plain-object data. Cheaper than manually
 * walking each variant of the discriminated union, and removes the
 * risk of forgetting a nested field when a new item type is added.
 */
function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Materialize a template into items + paraph ready to be merged into
 * the live document. Pure function : same inputs → same outputs
 * (modulo the freshly-generated ids and, for `autoDate` items, the
 * `now` parameter).
 *
 * Append vs replace is the host's responsibility — the function
 * returns a fresh set without reading or touching the current state.
 */
export function applyTemplate(args: ApplyTemplateArgs): ApplyResult {
  const now = args.now ?? new Date();
  const dateStr = formatLocaleDate(args.locale, now);

  const items: Item[] = args.template.items.map((it) => {
    const cloned = deepClone(it);
    cloned.id = uid();
    if (cloned.type === "text" && cloned.autoDate) {
      cloned.value = dateStr;
    }
    return cloned;
  });

  const paraph: Paraph | null = args.template.paraph
    ? deepClone(args.template.paraph)
    : null;

  return { items, paraph };
}
