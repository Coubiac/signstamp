import type { PdfRect } from "../types";
import type {
  FieldDescriptor,
  SignatureFieldDescriptor,
  TextFieldDescriptor
} from "../hooks/useFormFields";
import { rectsApproxEqual } from "./geometry";

/** Field types we treat as plausible paraph zones. */
type ParaphCandidateField = TextFieldDescriptor | SignatureFieldDescriptor;

/** Heuristic on the field's own name : matches the common multilingual
 *  flavours of "paraph" / "initials". The regex stays loose on purpose,
 *  the spatial signal disambiguates false positives. */
const PARAPH_NAME_REGEX = /paraph|paraf|initial|init|vise/i;

export type ParaphCandidate = {
  /** Rect to use as the paraph master — same rect projected to every page. */
  rect: PdfRect;
  /**
   * "high" when name **and** spatial repetition both fire ;
   * "medium" when only one of them does. Callers (UI) may decide to
   * auto-apply "high" candidates and ask the user to confirm "medium" ones.
   */
  confidence: "high" | "medium";
  signals: {
    nameMatch: boolean;
    spatialRepetition: boolean;
    /** Number of distinct pages where the same rect appears. */
    occurrences: number;
  };
};

type RectGroup = {
  rect: PdfRect;
  pages: Set<number>;
  nameMatched: boolean;
};

function isParaphCandidateField(field: FieldDescriptor): field is ParaphCandidateField {
  return field.type === "text" || field.type === "signature-field";
}

function nameMatchesParaph(field: ParaphCandidateField): boolean {
  return PARAPH_NAME_REGEX.test(field.name);
}

function groupByRect(fields: ParaphCandidateField[]): RectGroup[] {
  const groups: RectGroup[] = [];
  for (const field of fields) {
    const existing = groups.find((g) => rectsApproxEqual(g.rect, field.rect));
    if (existing) {
      existing.pages.add(field.page);
      if (!existing.nameMatched) existing.nameMatched = nameMatchesParaph(field);
    } else {
      groups.push({
        rect: { ...field.rect },
        pages: new Set([field.page]),
        nameMatched: nameMatchesParaph(field)
      });
    }
  }
  return groups;
}

/**
 * Heuristic detector for the master paraph zone in a PDF form.
 *
 * Combines two signals :
 *  1. **Name regex** : a field named "paraph", "initial", … is very
 *     likely a paraph regardless of position.
 *  2. **Spatial repetition** : the same rect across multiple pages
 *     is the classic paraph layout (initial every page in the footer).
 *
 * High confidence requires both signals to fire on the same field
 * group ; medium confidence is one signal alone (e.g. spatial
 * repetition on cryptically-named fields, or a single paraph field
 * on a single-page doc).
 *
 * Returns the best candidate, or `null` when no plausible zone exists.
 */
export function detectParaph(fields: ReadonlyArray<FieldDescriptor>): ParaphCandidate | null {
  const candidates = fields.filter(isParaphCandidateField);
  const groups = groupByRect(candidates);

  let best: ParaphCandidate | null = null;

  for (const group of groups) {
    const occurrences = group.pages.size;
    const spatialRepetition = occurrences >= 2;
    if (!spatialRepetition && !group.nameMatched) continue;

    const confidence: "high" | "medium" =
      spatialRepetition && group.nameMatched ? "high" : "medium";

    const candidate: ParaphCandidate = {
      rect: group.rect,
      confidence,
      signals: {
        nameMatch: group.nameMatched,
        spatialRepetition,
        occurrences
      }
    };

    if (!best) {
      best = candidate;
      continue;
    }
    // High > medium ; within the same confidence, more occurrences wins.
    const better = candidate.confidence === "high" && best.confidence === "medium";
    const sameLevel = candidate.confidence === best.confidence
      && candidate.signals.occurrences > best.signals.occurrences;
    if (better || sameLevel) best = candidate;
  }

  return best;
}
