import { describe, expect, it } from "vitest";
import { detectParaph } from "./detectParaph";
import type {
  FieldDescriptor,
  SignatureFieldDescriptor,
  TextFieldDescriptor
} from "../hooks/useFormFields";

function text(name: string, page: number, x: number, y: number, w = 60, h = 18): TextFieldDescriptor {
  return {
    type: "text",
    name,
    page,
    rect: { x, y, w, h },
    defaultValue: "",
    maxLength: undefined
  };
}

function sig(name: string, page: number, x: number, y: number, w = 80, h = 20): SignatureFieldDescriptor {
  return {
    type: "signature-field",
    name,
    page,
    rect: { x, y, w, h }
  };
}

describe("detectParaph", () => {
  it("returns null when there are no fields", () => {
    expect(detectParaph([])).toBeNull();
  });

  it("returns null when no field matches name and no rect repeats", () => {
    const fields: FieldDescriptor[] = [
      text("full_name", 1, 100, 700),
      text("email", 1, 100, 670)
    ];
    expect(detectParaph(fields)).toBeNull();
  });

  it("flags a single field with a paraph-like name (medium confidence)", () => {
    const fields: FieldDescriptor[] = [
      text("paraph_signataire", 1, 480, 30, 70, 25)
    ];
    const result = detectParaph(fields);
    expect(result).not.toBeNull();
    expect(result?.confidence).toBe("medium");
    expect(result?.signals.nameMatch).toBe(true);
    expect(result?.signals.spatialRepetition).toBe(false);
    expect(result?.rect).toEqual({ x: 480, y: 30, w: 70, h: 25 });
  });

  it("flags a spatial repetition without name match (medium confidence)", () => {
    // Same anonymous rect on three pages = a paraph zone.
    const fields: FieldDescriptor[] = [
      text("Text12", 1, 500, 30, 60, 20),
      text("Text13", 2, 500, 30, 60, 20),
      text("Text14", 3, 500, 30, 60, 20)
    ];
    const result = detectParaph(fields);
    expect(result?.confidence).toBe("medium");
    expect(result?.signals.spatialRepetition).toBe(true);
    expect(result?.signals.nameMatch).toBe(false);
    expect(result?.signals.occurrences).toBe(3);
  });

  it("upgrades to high confidence when both signals agree", () => {
    const fields: FieldDescriptor[] = [
      text("paraph_1", 1, 500, 30, 60, 20),
      text("paraph_2", 2, 500, 30, 60, 20),
      text("paraph_3", 3, 500, 30, 60, 20)
    ];
    const result = detectParaph(fields);
    expect(result?.confidence).toBe("high");
    expect(result?.signals.nameMatch).toBe(true);
    expect(result?.signals.spatialRepetition).toBe(true);
  });

  it("treats signature fields the same way as text fields", () => {
    const fields: FieldDescriptor[] = [
      sig("initials_p1", 1, 480, 40, 70, 25),
      sig("initials_p2", 2, 480, 40, 70, 25),
      sig("initials_p3", 3, 480, 40, 70, 25)
    ];
    const result = detectParaph(fields);
    expect(result?.confidence).toBe("high");
    expect(result?.signals.occurrences).toBe(3);
  });

  it("groups rects that differ within the 5pt tolerance", () => {
    // Same paraph zone but each page nudges the rect by a few units
    // (very common in scanned-then-re-OCR'd PDFs).
    const fields: FieldDescriptor[] = [
      text("a", 1, 500, 30, 60, 20),
      text("b", 2, 503, 31, 62, 19),
      text("c", 3, 498, 32, 61, 21)
    ];
    const result = detectParaph(fields);
    expect(result?.signals.spatialRepetition).toBe(true);
    expect(result?.signals.occurrences).toBe(3);
  });

  it("does not group rects that differ by more than the tolerance", () => {
    const fields: FieldDescriptor[] = [
      text("a", 1, 500, 30, 60, 20),
      text("b", 2, 600, 30, 60, 20),  // ≠ x by 100pt
      text("c", 3, 100, 30, 60, 20)
    ];
    expect(detectParaph(fields)).toBeNull();
  });

  it("picks the candidate with more occurrences when several spatial groups qualify", () => {
    const fields: FieldDescriptor[] = [
      // Group A : 2 occurrences
      text("a1", 1, 100, 50, 60, 20),
      text("a2", 2, 100, 50, 60, 20),
      // Group B : 4 occurrences
      text("b1", 1, 500, 30, 60, 20),
      text("b2", 2, 500, 30, 60, 20),
      text("b3", 3, 500, 30, 60, 20),
      text("b4", 4, 500, 30, 60, 20)
    ];
    const result = detectParaph(fields);
    expect(result?.rect.x).toBe(500);
    expect(result?.signals.occurrences).toBe(4);
  });

  it("prefers a high-confidence candidate over a medium one with more occurrences", () => {
    const fields: FieldDescriptor[] = [
      // High confidence : name match + spatial repetition (2 pages)
      text("paraph_1", 1, 500, 30, 60, 20),
      text("paraph_2", 2, 500, 30, 60, 20),
      // Medium : spatial only (4 pages, anonymous names)
      text("x1", 1, 100, 50, 60, 20),
      text("x2", 2, 100, 50, 60, 20),
      text("x3", 3, 100, 50, 60, 20),
      text("x4", 4, 100, 50, 60, 20)
    ];
    const result = detectParaph(fields);
    expect(result?.confidence).toBe("high");
    expect(result?.rect.x).toBe(500);
  });

  it("ignores non-paraph field types (checkbox, radio, choice, button)", () => {
    // Only text + signature-field can be paraph candidates ; a
    // checkbox repeated on every page shouldn't be flagged.
    const fields: FieldDescriptor[] = [
      { type: "checkbox", name: "agree", page: 1, rect: { x: 500, y: 30, w: 12, h: 12 }, defaultValue: false },
      { type: "checkbox", name: "agree2", page: 2, rect: { x: 500, y: 30, w: 12, h: 12 }, defaultValue: false }
    ];
    expect(detectParaph(fields)).toBeNull();
  });
});
