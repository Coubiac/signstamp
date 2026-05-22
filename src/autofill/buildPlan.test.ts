import { describe, expect, it } from "vitest";
import { buildPlan } from "./buildPlan";
import type {
  CheckboxFieldDescriptor,
  ChoiceFieldDescriptor,
  FieldDescriptor,
  PushButtonDescriptor,
  RadioGroupDescriptor,
  SignatureFieldDescriptor,
  TextFieldDescriptor
} from "../hooks/useFormFields";
import type { TextItemLike } from "./matchByLabel";
import type { Profile, SignatureAsset } from "../types";

// --- Fixture helpers -------------------------------------------------------

function text(name: string, page: number, x = 100, y = 700, w = 200, h = 20): TextFieldDescriptor {
  return { type: "text", name, page, rect: { x, y, w, h }, defaultValue: "", maxLength: undefined };
}
function sig(name: string, page: number, x = 100, y = 100, w = 200, h = 40): SignatureFieldDescriptor {
  return { type: "signature-field", name, page, rect: { x, y, w, h } };
}
function checkbox(name: string, page: number): CheckboxFieldDescriptor {
  return { type: "checkbox", name, page, rect: { x: 0, y: 0, w: 12, h: 12 }, defaultValue: false };
}
function choice(name: string, options: string[], page = 1): ChoiceFieldDescriptor {
  return {
    type: "choice",
    name,
    page,
    rect: { x: 0, y: 0, w: 100, h: 20 },
    options: options.map((v) => ({ exportValue: v, displayValue: v })),
    combo: true,
    defaultValue: ""
  };
}
function button(name: string, page = 1): PushButtonDescriptor {
  return { type: "button", name, page, rect: { x: 0, y: 0, w: 60, h: 20 }, isReset: false, label: name };
}
function radio(name: string, options: string[]): RadioGroupDescriptor {
  return {
    type: "radio",
    name,
    options: options.map((v, i) => ({ value: v, page: 1, rect: { x: i * 20, y: 0, w: 12, h: 12 } })),
    defaultValue: null
  };
}

function txtItem(str: string, x: number, y: number, fontSize = 12): TextItemLike {
  return { str, transform: [fontSize, 0, 0, fontSize, x, y], width: str.length * fontSize * 0.5 };
}

const PROFILE: Profile = [
  { key: "firstName", value: "Jane" },
  { key: "lastName", value: "Doe" },
  { key: "email", value: "jane@example.com" },
  { key: "phone", value: "0612345678" },
  { key: "country", value: "FR" }
];

const SIGNATURE: SignatureAsset = {
  id: "sig-1",
  name: "sig.png",
  mime: "image/png",
  bytes: new Uint8Array([0]),
  dataUrl: "data:image/png;base64,",
  naturalW: 200,
  naturalH: 50
};

const PARAPH_ASSET: SignatureAsset = {
  id: "par-1",
  name: "initials.png",
  mime: "image/png",
  bytes: new Uint8Array([0]),
  dataUrl: "data:image/png;base64,",
  naturalW: 80,
  naturalH: 30
};

const NO_TEXT = new Map<number, TextItemLike[]>();

// --- Tests -----------------------------------------------------------------

describe("buildPlan", () => {
  it("returns an empty plan when there are no fields", () => {
    const plan = buildPlan({ fields: [], profile: PROFILE, signature: SIGNATURE, paraphAsset: PARAPH_ASSET, pageTextItems: NO_TEXT });
    expect(plan.formValues).toEqual({});
    expect(plan.newItems).toEqual([]);
    expect(plan.paraph).toBeNull();
    expect(plan.unmatched).toEqual([]);
  });

  it("fills a text field whose name matches the dictionary", () => {
    const fields: FieldDescriptor[] = [text("firstName", 1)];
    const plan = buildPlan({ fields, profile: PROFILE, signature: null, paraphAsset: null, pageTextItems: NO_TEXT });
    expect(plan.formValues).toEqual({ firstName: "Jane" });
    expect(plan.stats.matchedText).toBe(1);
    expect(plan.unmatched).toEqual([]);
  });

  it("falls back to label proximity when the field name is cryptic", () => {
    const fields: FieldDescriptor[] = [text("Text12", 1, 100, 700, 200, 20)];
    // Label "Email :" rendered to the left of the field at the same baseline
    const pageTextItems = new Map([
      [1, [txtItem("Email :", 50, 705)]]
    ]);
    const plan = buildPlan({ fields, profile: PROFILE, signature: null, paraphAsset: null, pageTextItems });
    // formValues is keyed by the PDF field's actual name (so pdf-lib
    // can write it back), not by the canonical profile key.
    expect(plan.formValues).toEqual({ Text12: "jane@example.com" });
    expect(plan.stats.matchedText).toBe(1);
  });

  it("marks a text field as unmatched when neither layer hits", () => {
    const fields: FieldDescriptor[] = [text("Text12", 1)];
    const plan = buildPlan({ fields, profile: PROFILE, signature: null, paraphAsset: null, pageTextItems: NO_TEXT });
    expect(plan.formValues).toEqual({});
    expect(plan.unmatched).toHaveLength(1);
    expect(plan.unmatched[0].name).toBe("Text12");
  });

  it("marks a matched field as unmatched when the profile has no value for that key", () => {
    // The profile here doesn't carry "iban" — engine matches the field
    // but has nothing to write, so the field surfaces in `unmatched`.
    const fields: FieldDescriptor[] = [text("iban", 1)];
    const plan = buildPlan({ fields, profile: PROFILE, signature: null, paraphAsset: null, pageTextItems: NO_TEXT });
    expect(plan.formValues).toEqual({});
    expect(plan.unmatched).toHaveLength(1);
  });

  it("fills a choice field only when the profile value matches one of the options", () => {
    const fields: FieldDescriptor[] = [choice("country", ["FR", "DE", "US"])];
    const plan = buildPlan({ fields, profile: PROFILE, signature: null, paraphAsset: null, pageTextItems: NO_TEXT });
    expect(plan.formValues).toEqual({ country: "FR" });
    expect(plan.stats.matchedChoice).toBe(1);
  });

  it("does not fill a choice field when the profile value is not a valid option", () => {
    const profile: Profile = [{ key: "country", value: "ZZ" }];
    const fields: FieldDescriptor[] = [choice("country", ["FR", "DE", "US"])];
    const plan = buildPlan({ fields, profile, signature: null, paraphAsset: null, pageTextItems: NO_TEXT });
    expect(plan.formValues).toEqual({});
    expect(plan.unmatched).toHaveLength(1);
  });

  it("stamps a SignatureItem on every signature widget when a signature is selected", () => {
    // Distinct rects so detectParaph does NOT see a spatial-repetition
    // paraph group — both fields stay regular signature widgets.
    const fields: FieldDescriptor[] = [
      sig("signature_p1", 1, 100, 100, 200, 40),
      sig("signature_p3", 3, 350, 600, 220, 50)
    ];
    const plan = buildPlan({ fields, profile: PROFILE, signature: SIGNATURE, paraphAsset: null, pageTextItems: NO_TEXT });
    expect(plan.newItems).toHaveLength(2);
    expect(plan.newItems.every((it) => it.type === "signature")).toBe(true);
    expect(plan.stats.matchedSignature).toBe(2);
  });

  it("leaves signature fields unmatched when no signature is selected", () => {
    const fields: FieldDescriptor[] = [sig("signature_p1", 1)];
    const plan = buildPlan({ fields, profile: PROFILE, signature: null, paraphAsset: null, pageTextItems: NO_TEXT });
    expect(plan.newItems).toEqual([]);
    expect(plan.unmatched).toHaveLength(1);
  });

  it("auto-applies a high-confidence paraph master when a paraph asset is selected", () => {
    // Three text fields named "paraph_*" at the same rect across three pages.
    const fields: FieldDescriptor[] = [
      text("paraph_1", 1, 500, 30, 60, 20),
      text("paraph_2", 2, 500, 30, 60, 20),
      text("paraph_3", 3, 500, 30, 60, 20)
    ];
    const plan = buildPlan({ fields, profile: PROFILE, signature: null, paraphAsset: PARAPH_ASSET, pageTextItems: NO_TEXT });
    expect(plan.paraph).toEqual({ assetId: PARAPH_ASSET.id, rect: { x: 500, y: 30, w: 60, h: 20 } });
    expect(plan.stats.matchedParaph).toBe(1);
  });

  it("does not auto-apply a medium-confidence paraph but exposes the candidate", () => {
    // Cryptic names, spatial repetition only → medium confidence.
    const fields: FieldDescriptor[] = [
      text("Text1", 1, 500, 30, 60, 20),
      text("Text2", 2, 500, 30, 60, 20)
    ];
    const plan = buildPlan({ fields, profile: PROFILE, signature: null, paraphAsset: PARAPH_ASSET, pageTextItems: NO_TEXT });
    expect(plan.paraph).toBeNull();
    expect(plan.paraphCandidate?.confidence).toBe("medium");
    expect(plan.stats.matchedParaph).toBe(0);
  });

  it("excludes paraph-group fields from per-field matching", () => {
    // The paraph fields would normally land in `unmatched` (no canonical
    // match), but they should be silently absorbed by the paraph master.
    const fields: FieldDescriptor[] = [
      text("paraph_1", 1, 500, 30, 60, 20),
      text("paraph_2", 2, 500, 30, 60, 20),
      text("paraph_3", 3, 500, 30, 60, 20),
      text("firstName", 1)  // a regular field that should still be matched
    ];
    const plan = buildPlan({ fields, profile: PROFILE, signature: null, paraphAsset: PARAPH_ASSET, pageTextItems: NO_TEXT });
    expect(plan.formValues).toEqual({ firstName: "Jane" });
    expect(plan.unmatched).toEqual([]);  // none of the paraph_* fields polluted unmatched
    expect(plan.paraph).not.toBeNull();
  });

  it("counts buttons as 'skipped' and never fills them", () => {
    const fields: FieldDescriptor[] = [button("submit"), button("reset")];
    const plan = buildPlan({ fields, profile: PROFILE, signature: SIGNATURE, paraphAsset: null, pageTextItems: NO_TEXT });
    expect(plan.formValues).toEqual({});
    expect(plan.stats.skipped).toBe(2);
    expect(plan.unmatched).toEqual([]);
  });

  it("does not fill checkbox / radio fields in v1 (no profile semantic)", () => {
    const fields: FieldDescriptor[] = [
      checkbox("agree", 1),
      radio("gender", ["Male", "Female"])
    ];
    const plan = buildPlan({ fields, profile: PROFILE, signature: null, paraphAsset: null, pageTextItems: NO_TEXT });
    expect(plan.formValues).toEqual({});
    expect(plan.unmatched).toHaveLength(2);
  });
});
