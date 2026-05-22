import type { PdfRect } from "../types";

/**
 * Two rects are "the same position" when every dimension differs by
 * at most `tolerance` PDF units. Used by both paraph detection
 * (grouping repeated rects across pages) and buildPlan (recognizing
 * a field as part of the paraph group).
 */
export function rectsApproxEqual(a: PdfRect, b: PdfRect, tolerance = 5): boolean {
  return Math.abs(a.x - b.x) <= tolerance
    && Math.abs(a.y - b.y) <= tolerance
    && Math.abs(a.w - b.w) <= tolerance
    && Math.abs(a.h - b.h) <= tolerance;
}
