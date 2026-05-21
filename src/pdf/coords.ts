import type { PdfPoint, PdfRect } from "../types";
import type { PageViewport } from "pdfjs-dist/types/src/display/display_utils";

export function pxDeltaToPdfDelta(dxPx: number, dyPx: number, viewport: PageViewport) {
  // écran: +y vers le bas, PDF: +y vers le haut
  return {
    dxPdf: dxPx / viewport.scale,
    dyPdf: -dyPx / viewport.scale
  };
}

export function pdfRectToCss(rect: PdfRect, viewport: PageViewport) {
  const p1 = viewport.convertToViewportPoint(rect.x, rect.y);
  const p2 = viewport.convertToViewportPoint(rect.x + rect.w, rect.y + rect.h);

  const left = Math.min(p1[0], p2[0]);
  const top = Math.min(p1[1], p2[1]);
  const width = Math.abs(p2[0] - p1[0]);
  const height = Math.abs(p2[1] - p1[1]);

  return { left, top, width, height };
}

export function pxSizeToPdfSize(wPx: number, hPx: number, viewport: PageViewport) {
  return {
    wPdf: wPx / viewport.scale,
    hPdf: hPx / viewport.scale
  };
}

/**
 * Project two PDF endpoints to viewport coordinates and return the
 * bounding box geometry needed to render a line or arrow overlay.
 *
 *   ┌─────────────────┐
 *   │ (x1,y1)         │  ← bounding box in CSS coords (left, top, w, h)
 *   │                 │
 *   │         (x2,y2) │  ← endpoints relative to the bounding box
 *   └─────────────────┘
 *
 * Width and height are clamped to 1 so a zero-length segment still
 * produces a non-degenerate overlay.
 */
export function lineGeometryFromPoints(start: PdfPoint, end: PdfPoint, viewport: PageViewport) {
  const s = viewport.convertToViewportPoint(start.x, start.y);
  const e = viewport.convertToViewportPoint(end.x, end.y);
  const left = Math.min(s[0], e[0]);
  const top = Math.min(s[1], e[1]);
  const width = Math.max(1, Math.abs(e[0] - s[0]));
  const height = Math.max(1, Math.abs(e[1] - s[1]));

  return {
    left,
    top,
    width,
    height,
    x1: s[0] - left,
    y1: s[1] - top,
    x2: e[0] - left,
    y2: e[1] - top
  };
}
