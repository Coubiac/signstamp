import { describe, expect, it } from "vitest";
import { lineGeometryFromPoints, pdfRectToCss, pxDeltaToPdfDelta, pxSizeToPdfSize } from "./coords";

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

describe("lineGeometryFromPoints", () => {
  it("projects both endpoints and computes the bounding box", () => {
    const geo = lineGeometryFromPoints({ x: 10, y: 5 }, { x: 30, y: 25 }, viewport as any);
    expect(geo.left).toBe(20);
    expect(geo.top).toBe(10);
    expect(geo.width).toBe(40);
    expect(geo.height).toBe(40);
    expect(geo.x1).toBe(0);
    expect(geo.y1).toBe(0);
    expect(geo.x2).toBe(40);
    expect(geo.y2).toBe(40);
  });

  it("handles reversed endpoints (end above-left of start)", () => {
    const geo = lineGeometryFromPoints({ x: 30, y: 25 }, { x: 10, y: 5 }, viewport as any);
    expect(geo.left).toBe(20);
    expect(geo.top).toBe(10);
    expect(geo.width).toBe(40);
    expect(geo.height).toBe(40);
    // start is now the bottom-right, end the top-left
    expect(geo.x1).toBe(40);
    expect(geo.y1).toBe(40);
    expect(geo.x2).toBe(0);
    expect(geo.y2).toBe(0);
  });

  it("clamps width and height to 1 for a zero-length segment", () => {
    const geo = lineGeometryFromPoints({ x: 5, y: 5 }, { x: 5, y: 5 }, viewport as any);
    expect(geo.width).toBe(1);
    expect(geo.height).toBe(1);
  });
});
