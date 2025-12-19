import { describe, expect, it } from "vitest";
import { pdfRectToCss, pxDeltaToPdfDelta, pxSizeToPdfSize } from "./coords";

const viewport = {
  scale: 2,
  convertToViewportPoint: (x: number, y: number) => [x * 2, y * 2]
};

describe("coords helpers", () => {
  it("converts pixel deltas to pdf deltas", () => {
    const { dxPdf, dyPdf } = pxDeltaToPdfDelta(20, 10, viewport as any);
    expect(dxPdf).toBe(10);
    expect(dyPdf).toBe(-5);
  });

  it("converts pixel sizes to pdf sizes", () => {
    const { wPdf, hPdf } = pxSizeToPdfSize(200, 100, viewport as any);
    expect(wPdf).toBe(100);
    expect(hPdf).toBe(50);
  });

  it("converts pdf rect to css rect", () => {
    const css = pdfRectToCss({ x: 10, y: 20, w: 30, h: 40 }, viewport as any);
    expect(css).toEqual({ left: 20, top: 40, width: 60, height: 80 });
  });
});
