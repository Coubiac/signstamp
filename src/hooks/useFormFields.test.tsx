import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { useFormFields } from "./useFormFields";

type Annotation = {
  subtype?: string;
  fieldName?: string;
  fieldType?: string;
  fieldValue?: unknown;
  checkBox?: boolean;
  radioButton?: boolean;
  pushButton?: boolean;
  buttonValue?: unknown;
  exportValue?: unknown;
  combo?: boolean;
  options?: Array<{ exportValue: string; displayValue: string }>;
  rect?: [number, number, number, number];
  maxLen?: number;
  resetForm?: unknown;
  alternativeText?: unknown;
};

function fakeDoc(pages: Annotation[][]): any {
  return {
    numPages: pages.length,
    getPage: async (i: number) => ({
      getAnnotations: async () => pages[i - 1]
    })
  };
}

type Handle = ReturnType<typeof useFormFields>;

function renderHook(doc: any) {
  let latest: Handle | null = null;
  function Probe({ d }: { d: any }) {
    latest = useFormFields(d);
    return null;
  }
  const utils = render(<Probe d={doc} />);
  return { ...utils, get current() { return latest!; } };
}

afterEach(() => {
  cleanup();
});

describe("useFormFields", () => {
  it("returns empty state when pdfDoc is null", () => {
    const h = renderHook(null);
    expect(h.current.fields).toEqual([]);
    expect(h.current.values).toEqual({});
  });

  it("discovers a text field with its default value and rect", async () => {
    const doc = fakeDoc([[
      { subtype: "Widget", fieldType: "Tx", fieldName: "first_name", fieldValue: "Jane", rect: [10, 20, 110, 40] }
    ]]);
    const h = renderHook(doc);
    await waitFor(() => expect(h.current.fields).toHaveLength(1));
    const field = h.current.fields[0];
    expect(field).toEqual({
      type: "text",
      name: "first_name",
      page: 1,
      rect: { x: 10, y: 20, w: 100, h: 20 },
      defaultValue: "Jane",
      maxLength: undefined
    });
    expect(h.current.values).toEqual({ first_name: "Jane" });
  });

  it("captures a maxLen when the PDF provides one", async () => {
    const doc = fakeDoc([[
      { subtype: "Widget", fieldType: "Tx", fieldName: "code", rect: [0, 0, 50, 20], maxLen: 6 }
    ]]);
    const h = renderHook(doc);
    await waitFor(() => expect(h.current.fields).toHaveLength(1));
    expect((h.current.fields[0] as any).maxLength).toBe(6);
  });

  it("discovers a checkbox and treats 'Off' as unchecked", async () => {
    const doc = fakeDoc([[
      { subtype: "Widget", fieldType: "Btn", checkBox: true, fieldName: "agree", fieldValue: "Off", rect: [0, 0, 12, 12] },
      { subtype: "Widget", fieldType: "Btn", checkBox: true, fieldName: "newsletter", fieldValue: "Yes", rect: [0, 0, 12, 12] }
    ]]);
    const h = renderHook(doc);
    await waitFor(() => expect(h.current.fields).toHaveLength(2));
    expect(h.current.values).toEqual({ agree: false, newsletter: true });
  });

  it("surfaces both signature widgets and push buttons", async () => {
    const doc = fakeDoc([[
      { subtype: "Widget", fieldType: "Btn", pushButton: true, fieldName: "submit", rect: [0, 0, 12, 12] },
      { subtype: "Widget", fieldType: "Sig", fieldName: "sig", rect: [0, 0, 100, 20] }
    ]]);
    const h = renderHook(doc);
    await waitFor(() => expect(h.current.fields).toHaveLength(2));
    expect(h.current.fields.find((f) => f.type === "button")).toBeDefined();
    expect(h.current.fields.find((f) => f.type === "signature-field")).toBeDefined();
  });

  it("discovers a signature widget with its name, page and rect", async () => {
    const doc = fakeDoc([[
      { subtype: "Widget", fieldType: "Sig", fieldName: "applicantSignature", rect: [50, 50, 250, 90] }
    ]]);
    const h = renderHook(doc);
    await waitFor(() => expect(h.current.fields).toHaveLength(1));
    expect(h.current.fields[0]).toEqual({
      type: "signature-field",
      name: "applicantSignature",
      page: 1,
      rect: { x: 50, y: 50, w: 200, h: 40 }
    });
  });

  it("does not emit a placement for a signature widget", async () => {
    // Signature fields are surfaced in `fields` for the auto-fill engine
    // but produce no interactive overlay — placements stay empty.
    const doc = fakeDoc([[
      { subtype: "Widget", fieldType: "Sig", fieldName: "sig", rect: [0, 0, 100, 20] }
    ]]);
    const h = renderHook(doc);
    await waitFor(() => expect(h.current.fields).toHaveLength(1));
    expect(h.current.placements).toHaveLength(0);
  });

  it("does not allocate a value entry for a signature widget", async () => {
    const doc = fakeDoc([[
      { subtype: "Widget", fieldType: "Sig", fieldName: "sig", rect: [0, 0, 100, 20] },
      { subtype: "Widget", fieldType: "Tx", fieldName: "name", fieldValue: "Jane", rect: [0, 0, 10, 10] }
    ]]);
    const h = renderHook(doc);
    await waitFor(() => expect(h.current.fields).toHaveLength(2));
    expect(Object.keys(h.current.values)).toEqual(["name"]);
  });

  it("flags a push button with a ResetForm action as a Reset button", async () => {
    const doc = fakeDoc([[
      {
        subtype: "Widget", fieldType: "Btn", pushButton: true,
        fieldName: "btn.clear", buttonValue: "Effacer",
        resetForm: { fields: [], flags: 0 },
        rect: [10, 10, 80, 30]
      }
    ]]);
    const h = renderHook(doc);
    await waitFor(() => expect(h.current.fields).toHaveLength(1));
    const field = h.current.fields[0];
    if (field.type !== "button") throw new Error("type narrowing");
    expect(field.isReset).toBe(true);
    expect(field.label).toBe("Effacer");
  });

  it("treats a push button without a ResetForm action as inert", async () => {
    const doc = fakeDoc([[
      {
        subtype: "Widget", fieldType: "Btn", pushButton: true,
        fieldName: "btn.submit", buttonValue: "Envoyer",
        rect: [0, 0, 80, 30]
      }
    ]]);
    const h = renderHook(doc);
    await waitFor(() => expect(h.current.fields).toHaveLength(1));
    const field = h.current.fields[0];
    if (field.type !== "button") throw new Error("type narrowing");
    expect(field.isReset).toBe(false);
  });

  it("falls back to fieldName when neither alternativeText nor buttonValue is present", async () => {
    const doc = fakeDoc([[
      { subtype: "Widget", fieldType: "Btn", pushButton: true, fieldName: "reset_all", rect: [0, 0, 50, 20] }
    ]]);
    const h = renderHook(doc);
    await waitFor(() => expect(h.current.fields).toHaveLength(1));
    const field = h.current.fields[0];
    if (field.type !== "button") throw new Error("type narrowing");
    expect(field.label).toBe("reset_all");
  });

  it("does not allocate a value entry for a push button", async () => {
    const doc = fakeDoc([[
      { subtype: "Widget", fieldType: "Btn", pushButton: true, fieldName: "reset", resetForm: {}, rect: [0, 0, 10, 10] },
      { subtype: "Widget", fieldType: "Tx", fieldName: "name", fieldValue: "Jane", rect: [0, 0, 10, 10] }
    ]]);
    const h = renderHook(doc);
    await waitFor(() => expect(h.current.fields).toHaveLength(2));
    expect(Object.keys(h.current.values)).toEqual(["name"]);
  });

  it("groups radio-button widgets sharing a fieldName into a single descriptor", async () => {
    const doc = fakeDoc([[
      {
        subtype: "Widget", fieldType: "Btn", radioButton: true,
        fieldName: "gender", buttonValue: "Male",
        fieldValue: "Female", rect: [10, 10, 22, 22]
      },
      {
        subtype: "Widget", fieldType: "Btn", radioButton: true,
        fieldName: "gender", buttonValue: "Female",
        fieldValue: "Female", rect: [30, 10, 42, 22]
      }
    ]]);
    const h = renderHook(doc);
    await waitFor(() => expect(h.current.fields).toHaveLength(1));
    const field = h.current.fields[0];
    expect(field.type).toBe("radio");
    if (field.type !== "radio") throw new Error("type narrowing");
    expect(field.options.map((o) => o.value)).toEqual(["Male", "Female"]);
    expect(field.defaultValue).toBe("Female");
    expect(h.current.values.gender).toBe("Female");
  });

  it("uses exportValue as the radio on-value when buttonValue is absent", async () => {
    const doc = fakeDoc([[
      { subtype: "Widget", fieldType: "Btn", radioButton: true, fieldName: "color", exportValue: "Red", rect: [0, 0, 10, 10] }
    ]]);
    const h = renderHook(doc);
    await waitFor(() => expect(h.current.fields).toHaveLength(1));
    const field = h.current.fields[0];
    if (field.type !== "radio") throw new Error("type narrowing");
    expect(field.options[0].value).toBe("Red");
  });

  it("expands a radio group to one placement per option", async () => {
    const doc = fakeDoc([[
      { subtype: "Widget", fieldType: "Btn", radioButton: true, fieldName: "g", buttonValue: "A", rect: [0, 0, 10, 10] },
      { subtype: "Widget", fieldType: "Btn", radioButton: true, fieldName: "g", buttonValue: "B", rect: [20, 0, 30, 10] },
      { subtype: "Widget", fieldType: "Btn", radioButton: true, fieldName: "g", buttonValue: "C", rect: [40, 0, 50, 10] }
    ]]);
    const h = renderHook(doc);
    await waitFor(() => expect(h.current.placements).toHaveLength(3));
    expect(h.current.placements.every((p) => p.kind === "radio-option")).toBe(true);
  });

  it("discovers a choice field with its options and combo flag", async () => {
    const doc = fakeDoc([[
      {
        subtype: "Widget", fieldType: "Ch", fieldName: "country",
        combo: true,
        options: [
          { exportValue: "fr", displayValue: "France" },
          { exportValue: "de", displayValue: "Germany" }
        ],
        fieldValue: "fr", rect: [0, 0, 100, 20]
      }
    ]]);
    const h = renderHook(doc);
    await waitFor(() => expect(h.current.fields).toHaveLength(1));
    const field = h.current.fields[0];
    expect(field.type).toBe("choice");
    if (field.type !== "choice") throw new Error("type narrowing");
    expect(field.combo).toBe(true);
    expect(field.options).toHaveLength(2);
    expect(field.defaultValue).toBe("fr");
    expect(h.current.values.country).toBe("fr");
  });

  it("treats a list box (combo=false) the same way as a dropdown for state purposes", async () => {
    const doc = fakeDoc([[
      {
        subtype: "Widget", fieldType: "Ch", fieldName: "lang",
        combo: false,
        options: [{ exportValue: "en", displayValue: "English" }],
        rect: [0, 0, 100, 20]
      }
    ]]);
    const h = renderHook(doc);
    await waitFor(() => expect(h.current.fields).toHaveLength(1));
    const field = h.current.fields[0];
    if (field.type !== "choice") throw new Error("type narrowing");
    expect(field.combo).toBe(false);
  });

  it("walks every page", async () => {
    const doc = fakeDoc([
      [{ subtype: "Widget", fieldType: "Tx", fieldName: "a", rect: [0, 0, 10, 10] }],
      [{ subtype: "Widget", fieldType: "Tx", fieldName: "b", rect: [0, 0, 10, 10] }]
    ]);
    const h = renderHook(doc);
    await waitFor(() => expect(h.current.fields).toHaveLength(2));
    // Only non-radio descriptors carry a top-level page ; assert via
    // placements which always do.
    expect(h.current.placements.map((p) => p.page)).toEqual([1, 2]);
  });

  it("setValue updates a single entry without touching the others", async () => {
    const doc = fakeDoc([[
      { subtype: "Widget", fieldType: "Tx", fieldName: "a", rect: [0, 0, 10, 10] },
      { subtype: "Widget", fieldType: "Tx", fieldName: "b", rect: [0, 0, 10, 10] }
    ]]);
    const h = renderHook(doc);
    await waitFor(() => expect(h.current.fields).toHaveLength(2));

    act(() => { h.current.setValue("a", "hello"); });
    await waitFor(() => expect(h.current.values.a).toBe("hello"));
    expect(h.current.values.b).toBe("");
  });

  it("reset restores every value to its default", async () => {
    const doc = fakeDoc([[
      { subtype: "Widget", fieldType: "Tx", fieldName: "a", fieldValue: "seeded", rect: [0, 0, 10, 10] }
    ]]);
    const h = renderHook(doc);
    await waitFor(() => expect(h.current.values.a).toBe("seeded"));

    act(() => { h.current.setValue("a", "edited"); });
    expect(h.current.values.a).toBe("edited");

    act(() => { h.current.reset(); });
    expect(h.current.values.a).toBe("seeded");
  });
});
