import type { PdfRect } from "../types";
import { matchFieldName } from "./matchFieldName";
import type { CanonicalProfileKey } from "./dictionary";

/**
 * Minimal duck-typed shape for a pdf.js text item. Wrapping just the
 * fields we actually read keeps this module decoupled from pdf.js and
 * trivially mockable in tests.
 *
 * `transform` is the 6-element affine matrix pdf.js attaches to every
 * positioned text run : `[a, b, c, d, e, f]` where `(e, f)` is the
 * baseline anchor in PDF coords (bottom-left origin) and `|d|` is the
 * rendered font size when the text has no rotation.
 */
export type TextItemLike = {
  str: string;
  transform: readonly number[];
  width: number;
};

type TextBox = {
  str: string;
  /** Bottom-left x in PDF coords. */
  x: number;
  /** Bottom-left y in PDF coords (PDF y grows upward). */
  y: number;
  w: number;
  h: number;
};

/** Geometric tolerances tuned for ordinary admin forms at 12pt body text. */
const MAX_LEFT_GAP_PT = 32;       // label's right edge ↔ field's left edge
const MAX_VERTICAL_MISMATCH_PT = 6; // vertical center offset for "left-of"
const MAX_ABOVE_GAP_PT = 16;       // label's bottom ↔ field's top
const SAME_LINE_TOLERANCE_PT = 3;  // y delta below which two items share a line
const ADJACENT_GAP_PT = 6;         // x gap between two items still considered contiguous

function asTextBox(item: TextItemLike): TextBox | null {
  if (!item.str || !item.str.trim()) return null;
  const transform = item.transform;
  if (!transform || transform.length < 6) return null;
  const fontSize = Math.abs(transform[3]) || Math.abs(transform[0]) || 12;
  return {
    str: item.str,
    x: transform[4],
    y: transform[5],
    w: item.width,
    h: fontSize
  };
}

/**
 * Merge consecutive text items that share a baseline and are
 * horizontally adjacent — pdf.js often emits multi-word labels as
 * many small runs, and we want "Date de naissance" not "Date".
 */
function mergeAdjacentBoxes(boxes: TextBox[]): TextBox[] {
  const sorted = [...boxes].sort((a, b) => (b.y - a.y) || (a.x - b.x));
  const merged: TextBox[] = [];
  for (const box of sorted) {
    const last = merged[merged.length - 1];
    if (
      last
      && Math.abs(last.y - box.y) <= SAME_LINE_TOLERANCE_PT
      && box.x - (last.x + last.w) <= ADJACENT_GAP_PT
      && box.x - (last.x + last.w) >= -1  // tolerate tiny overlap from kerning
    ) {
      merged[merged.length - 1] = {
        str: last.str + box.str,
        x: last.x,
        y: last.y,
        w: (box.x + box.w) - last.x,
        h: Math.max(last.h, box.h)
      };
    } else {
      merged.push(box);
    }
  }
  return merged;
}

type Candidate = { box: TextBox; distance: number };

function leftOfCandidate(box: TextBox, field: PdfRect): Candidate | null {
  const labelRight = box.x + box.w;
  const gap = field.x - labelRight;
  // Tolerate a small negative gap : labels often butt up against the
  // field's left edge and our width estimate is approximate.
  if (gap < -5 || gap > MAX_LEFT_GAP_PT) return null;

  const labelCenterY = box.y + box.h / 2;
  const fieldCenterY = field.y + field.h / 2;
  if (Math.abs(labelCenterY - fieldCenterY) > MAX_VERTICAL_MISMATCH_PT) return null;

  return { box, distance: gap };
}

function aboveCandidate(box: TextBox, field: PdfRect): Candidate | null {
  const fieldTop = field.y + field.h;
  const gap = box.y - fieldTop;
  if (gap < 0 || gap > MAX_ABOVE_GAP_PT) return null;

  const overlap = !(box.x + box.w < field.x || box.x > field.x + field.w);
  if (!overlap) return null;

  return { box, distance: gap };
}

/**
 * Strip the punctuation form admins typically append to a label
 * ("Email :", "First name*", "Date de naissance：") so the matcher
 * receives a clean lemma.
 */
function stripLabelDecoration(s: string): string {
  return s.replace(/[\s:：*]+$/u, "").trim();
}

/**
 * Find the most likely visible label near `fieldRect` and return its
 * cleaned text. Looks left-of first (the standard layout for admin
 * forms) and falls back to above. Returns `null` if no candidate is
 * close enough.
 */
export function extractLabelNearField(
  textItems: ReadonlyArray<TextItemLike>,
  fieldRect: PdfRect
): string | null {
  const boxes = mergeAdjacentBoxes(
    textItems
      .map(asTextBox)
      .filter((b): b is TextBox => b !== null)
  );

  let bestLeft: Candidate | null = null;
  let bestAbove: Candidate | null = null;

  for (const box of boxes) {
    const left = leftOfCandidate(box, fieldRect);
    if (left && (!bestLeft || left.distance < bestLeft.distance)) {
      bestLeft = left;
    }
    const above = aboveCandidate(box, fieldRect);
    if (above && (!bestAbove || above.distance < bestAbove.distance)) {
      bestAbove = above;
    }
  }

  const chosen = bestLeft ?? bestAbove;
  if (!chosen) return null;
  const clean = stripLabelDecoration(chosen.box.str);
  return clean || null;
}

/**
 * Convenience wrapper : extract a nearby label then resolve it
 * against the canonical alias dictionary. Returns the canonical
 * profile key on success, `null` when no label or no match.
 */
export function matchByLabel(
  textItems: ReadonlyArray<TextItemLike>,
  fieldRect: PdfRect
): CanonicalProfileKey | null {
  const label = extractLabelNearField(textItems, fieldRect);
  if (!label) return null;
  return matchFieldName(label);
}
