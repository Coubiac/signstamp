import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { exportFlattenedPdf } from "./exportPdf";

describe("exportFlattenedPdf", () => {
  it("exports a valid PDF with text items", async () => {
    const base = await PDFDocument.create();
    base.addPage([400, 400]);
    const baseBytes = await base.save();

    const out = await exportFlattenedPdf({
      originalPdfBytes: baseBytes,
      items: [
        {
          id: "t1",
          type: "text",
          page: 1,
          rect: { x: 50, y: 300, w: 200, h: 24 },
          value: "Hello",
          fontSize: 12,
          color: "#111111",
          fontFamily: "sans",
          bold: false,
          underline: false,
          strike: false
        }
      ],
      signatures: []
    });

    const loaded = await PDFDocument.load(out);
    expect(loaded.getPageCount()).toBe(1);
  });

  it("exports a valid PDF with check items", async () => {
    const base = await PDFDocument.create();
    base.addPage([400, 400]);
    const baseBytes = await base.save();

    const out = await exportFlattenedPdf({
      originalPdfBytes: baseBytes,
      items: [
        {
          id: "c1",
          type: "check",
          page: 1,
          rect: { x: 100, y: 200, w: 20, h: 20 },
          value: "X",
          fontSize: 14,
          color: "#111111"
        }
      ],
      signatures: []
    });

    const loaded = await PDFDocument.load(out);
    expect(loaded.getPageCount()).toBe(1);
  });

  it("exports a valid PDF with signature items", async () => {
    const base = await PDFDocument.create();
    base.addPage([400, 400]);
    const baseBytes = await base.save();

    const base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/6XW1YkAAAAASUVORK5CYII=";
    const pngBytes = new Uint8Array(
      Array.from(atob(base64), (char) => char.charCodeAt(0))
    );

    const out = await exportFlattenedPdf({
      originalPdfBytes: baseBytes,
      items: [
        {
          id: "s1",
          type: "signature",
          page: 1,
          rect: { x: 50, y: 50, w: 100, h: 30 },
          signatureId: "sig-1"
        }
      ],
      signatures: [
        {
          id: "sig-1",
          name: "sig.png",
          mime: "image/png",
          bytes: pngBytes,
          dataUrl: "data:image/png;base64,",
          naturalW: 1,
          naturalH: 1
        }
      ]
    });

    const loaded = await PDFDocument.load(out);
    expect(loaded.getPageCount()).toBe(1);
  });

  it("exports a valid PDF with line, arrow, and highlight items", async () => {
    const base = await PDFDocument.create();
    base.addPage([400, 400]);
    const baseBytes = await base.save();

    const out = await exportFlattenedPdf({
      originalPdfBytes: baseBytes,
      items: [
        {
          id: "l1",
          type: "line",
          page: 1,
          rect: { x: 20, y: 200, w: 120, h: 10 },
          start: { x: 20, y: 205 },
          end: { x: 140, y: 230 },
          color: "#1d4ed8",
          strokeWidth: 2
        },
        {
          id: "a1",
          type: "arrow",
          page: 1,
          rect: { x: 20, y: 150, w: 140, h: 20 },
          start: { x: 20, y: 160 },
          end: { x: 160, y: 180 },
          color: "#dc2626",
          strokeWidth: 2
        },
        {
          id: "h1",
          type: "highlight",
          page: 1,
          rect: { x: 40, y: 120, w: 140, h: 18 },
          color: "#fde047"
        }
      ],
      signatures: []
    });

    const loaded = await PDFDocument.load(out);
    expect(loaded.getPageCount()).toBe(1);
  });
});
