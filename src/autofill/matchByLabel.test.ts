import { describe, expect, it } from "vitest";
import { extractLabelNearField, matchByLabel, type TextItemLike } from "./matchByLabel";

/** Helper : build a fake pdf.js TextItem at a given baseline. */
function txt(str: string, x: number, y: number, fontSize = 12): TextItemLike {
  // Rough heuristic for width — admin-form fonts are roughly 0.5 fontSize per char.
  const width = str.length * fontSize * 0.5;
  return {
    str,
    transform: [fontSize, 0, 0, fontSize, x, y],
    width
  };
}

describe("extractLabelNearField", () => {
  it("picks the label sitting just left of the field", () => {
    const items = [txt("Email", 50, 700)];
    // Field is right next to the label, vertically aligned on the same baseline.
    const field = { x: 90, y: 696, w: 200, h: 16 };
    expect(extractLabelNearField(items, field)).toBe("Email");
  });

  it("strips trailing colon and asterisks", () => {
    const items = [
      txt("Email :", 50, 700),
      txt("Phone *", 50, 670)
    ];
    expect(extractLabelNearField(items, { x: 90, y: 696, w: 200, h: 16 })).toBe("Email");
    expect(extractLabelNearField(items, { x: 90, y: 666, w: 200, h: 16 })).toBe("Phone");
  });

  it("ignores labels that are too far to the left", () => {
    const items = [txt("Email", 50, 700)];
    // Label ends around x=80 ; field starts way out at 200, gap > MAX_LEFT_GAP_PT.
    expect(extractLabelNearField(items, { x: 200, y: 696, w: 100, h: 16 })).toBeNull();
  });

  it("ignores labels that are vertically misaligned", () => {
    const items = [txt("Email", 50, 700)];
    // Label at y≈700, field at y≈600 — too far vertically.
    expect(extractLabelNearField(items, { x: 90, y: 600, w: 200, h: 16 })).toBeNull();
  });

  it("matches a label placed above the field", () => {
    const items = [txt("Date de naissance", 100, 720)];
    // Field below, horizontally overlapping with the label.
    const field = { x: 100, y: 690, w: 120, h: 16 };
    expect(extractLabelNearField(items, field)).toBe("Date de naissance");
  });

  it("merges adjacent text items that pdf.js emitted as separate runs", () => {
    const items = [
      txt("Date", 100, 720),
      txt(" ", 124, 720),
      txt("de", 130, 720),
      txt(" ", 142, 720),
      txt("naissance", 148, 720)
    ];
    const field = { x: 100, y: 690, w: 120, h: 16 };
    const label = extractLabelNearField(items, field);
    expect(label).toContain("Date");
    expect(label).toContain("naissance");
  });

  it("prefers a left-of candidate over an above one when both exist", () => {
    const items = [
      txt("Above label", 100, 720),  // above the field
      txt("Email", 50, 700)          // left of the field
    ];
    const field = { x: 90, y: 696, w: 100, h: 16 };
    expect(extractLabelNearField(items, field)).toBe("Email");
  });

  it("returns null when no text item is anywhere near the field", () => {
    const items = [txt("Far away", 10, 100)];
    expect(extractLabelNearField(items, { x: 400, y: 400, w: 80, h: 16 })).toBeNull();
  });

  it("returns null on empty input", () => {
    expect(extractLabelNearField([], { x: 0, y: 0, w: 10, h: 10 })).toBeNull();
  });

  it("ignores whitespace-only text items", () => {
    const items = [
      txt("   ", 50, 700),
      txt("Email", 80, 700)
    ];
    expect(extractLabelNearField(items, { x: 120, y: 696, w: 200, h: 16 })).toBe("Email");
  });
});

describe("matchByLabel", () => {
  it("returns the canonical key when the nearby label is in the dictionary", () => {
    const items = [txt("E-mail :", 50, 700)];
    const field = { x: 100, y: 696, w: 200, h: 16 };
    expect(matchByLabel(items, field)).toBe("email");
  });

  it("works for accented French labels", () => {
    const items = [txt("Téléphone", 50, 700)];
    const field = { x: 110, y: 696, w: 200, h: 16 };
    expect(matchByLabel(items, field)).toBe("phone");
  });

  it("works for German labels", () => {
    const items = [txt("Vorname", 50, 700)];
    const field = { x: 95, y: 696, w: 200, h: 16 };
    expect(matchByLabel(items, field)).toBe("firstName");
  });

  it("returns null when the label is found but not in the dictionary", () => {
    const items = [txt("Some random label", 50, 700)];
    const field = { x: 140, y: 696, w: 200, h: 16 };
    expect(matchByLabel(items, field)).toBeNull();
  });

  it("returns null when no nearby label is found", () => {
    const items = [txt("Email", 10, 100)];
    expect(matchByLabel(items, { x: 400, y: 400, w: 80, h: 16 })).toBeNull();
  });
});
