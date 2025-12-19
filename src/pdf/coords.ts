import type { PdfRect } from "../types";
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
