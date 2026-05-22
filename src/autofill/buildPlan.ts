import type { Item, Paraph, Profile, SignatureAsset } from "../types";
import type { FieldDescriptor, FormValues } from "../hooks/useFormFields";
import { uid } from "../utils/uid";
import { matchFieldName } from "./matchFieldName";
import { matchByLabel, type TextItemLike } from "./matchByLabel";
import { detectParaph, type ParaphCandidate } from "./detectParaph";
import { rectsApproxEqual } from "./geometry";

/**
 * Result of the auto-fill engine. Splits the work the host has to
 * apply into four buckets : AcroForm field values, fresh overlay
 * items (signature stamps), the paraph master, and the fields the
 * engine couldn't confidently fill — surfaced for the preview UI.
 */
export type AutoFillPlan = {
  formValues: FormValues;
  newItems: Item[];
  paraph: Paraph | null;
  /**
   * Raw detection output, kept around so the UI can render a
   * "detected paraph candidate" confirmation modal for medium-
   * confidence matches without re-running detection.
   */
  paraphCandidate: ParaphCandidate | null;
  unmatched: FieldDescriptor[];
  stats: {
    matchedText: number;
    matchedChoice: number;
    matchedSignature: number;
    matchedParaph: number;
    skipped: number;
  };
};

export type BuildPlanArgs = {
  fields: ReadonlyArray<FieldDescriptor>;
  profile: Profile;
  /** Currently selected signature asset, or null if none. */
  signature: SignatureAsset | null;
  /** Currently selected paraph asset, or null if none. */
  paraphAsset: SignatureAsset | null;
  /**
   * Pre-fetched `getTextContent()` output for the relevant pages.
   * The caller (App.tsx) is expected to fetch upfront and memoize ;
   * `buildPlan` stays synchronous and pdf.js-free.
   */
  pageTextItems: ReadonlyMap<number, ReadonlyArray<TextItemLike>>;
};

function getProfileValue(profile: Profile, key: string): string {
  return profile.find((e) => e.key === key)?.value ?? "";
}

/**
 * Compose every signal the engine knows about into a single
 * `AutoFillPlan`. The host applies it as-is :
 *
 *   setFormValues(prev => ({ ...prev, ...plan.formValues }))
 *   updateItems(prev => [...prev, ...plan.newItems])
 *   if (plan.paraph) setParaph(plan.paraph)
 *
 * The function is pure : same inputs → same plan. Async I/O (the
 * pdf.js text-content fetch) lives in the caller.
 */
export function buildPlan(args: BuildPlanArgs): AutoFillPlan {
  const { fields, profile, signature, paraphAsset, pageTextItems } = args;

  const plan: AutoFillPlan = {
    formValues: {},
    newItems: [],
    paraph: null,
    paraphCandidate: null,
    unmatched: [],
    stats: {
      matchedText: 0,
      matchedChoice: 0,
      matchedSignature: 0,
      matchedParaph: 0,
      skipped: 0
    }
  };

  // Detect the paraph candidate first so the per-field loop can skip
  // its constituent fields — else they'd be misclassified as unmatched
  // text inputs and pollute the preview.
  const paraphCandidate = detectParaph(fields);
  plan.paraphCandidate = paraphCandidate;

  const belongsToParaphGroup = (field: FieldDescriptor): boolean => {
    if (!paraphCandidate) return false;
    if (field.type !== "text" && field.type !== "signature-field") return false;
    return rectsApproxEqual(field.rect, paraphCandidate.rect);
  };

  for (const field of fields) {
    if (belongsToParaphGroup(field)) continue;

    switch (field.type) {
      case "button": {
        plan.stats.skipped += 1;
        break;
      }
      case "checkbox":
      case "radio": {
        // The profile has no checkbox / radio semantic in v1 ;
        // leave these for the user to handle manually.
        plan.unmatched.push(field);
        break;
      }
      case "signature-field": {
        if (!signature) {
          plan.unmatched.push(field);
          break;
        }
        plan.newItems.push({
          id: uid(),
          type: "signature",
          page: field.page,
          rect: field.rect,
          signatureId: signature.id
        });
        plan.stats.matchedSignature += 1;
        break;
      }
      case "text":
      case "choice": {
        // Layer 1 : dictionary lookup on the field name.
        let canonical = matchFieldName(field.name);
        // Layer 2 : visible label extracted from the page's text content.
        if (!canonical) {
          const items = pageTextItems.get(field.page);
          if (items) canonical = matchByLabel(items, field.rect);
        }

        if (!canonical) {
          plan.unmatched.push(field);
          break;
        }

        const value = getProfileValue(profile, canonical);
        if (!value) {
          // Engine matched but the user has not provided that data
          // yet — still "unmatched" from the writer's perspective.
          plan.unmatched.push(field);
          break;
        }

        if (field.type === "choice") {
          // pdf-lib's select() throws on unknown options ; pre-check
          // against the available list so we never feed it a value
          // that would silently abort the export branch.
          const isValidOption = field.options.some((o) => o.exportValue === value);
          if (!isValidOption) {
            plan.unmatched.push(field);
            break;
          }
          plan.formValues[field.name] = value;
          plan.stats.matchedChoice += 1;
        } else {
          plan.formValues[field.name] = value;
          plan.stats.matchedText += 1;
        }
        break;
      }
    }
  }

  // Auto-apply the paraph master only when both signals fire (high
  // confidence) and the user has a paraph asset selected. Medium-
  // confidence candidates are surfaced via `paraphCandidate` so the
  // UI can ask the user to confirm.
  if (paraphCandidate && paraphCandidate.confidence === "high" && paraphAsset) {
    plan.paraph = {
      assetId: paraphAsset.id,
      rect: paraphCandidate.rect
    };
    plan.stats.matchedParaph = 1;
  }

  return plan;
}
