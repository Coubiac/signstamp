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
  rect?: [number, number, number, number];
  maxLen?: number;
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

  it("skips radio buttons, push buttons, signatures and combo boxes", async () => {
    const doc = fakeDoc([[
      { subtype: "Widget", fieldType: "Btn", radioButton: true, fieldName: "gender_m", rect: [0, 0, 12, 12] },
      { subtype: "Widget", fieldType: "Btn", pushButton: true, fieldName: "submit", rect: [0, 0, 12, 12] },
      { subtype: "Widget", fieldType: "Sig", fieldName: "sig", rect: [0, 0, 100, 20] },
      { subtype: "Widget", fieldType: "Ch", fieldName: "country", rect: [0, 0, 100, 20] }
    ]]);
    const h = renderHook(doc);
    // Wait a microtask for the enumeration to settle, then assert nothing was discovered.
    await new Promise((r) => setTimeout(r, 0));
    expect(h.current.fields).toEqual([]);
  });

  it("walks every page", async () => {
    const doc = fakeDoc([
      [{ subtype: "Widget", fieldType: "Tx", fieldName: "a", rect: [0, 0, 10, 10] }],
      [{ subtype: "Widget", fieldType: "Tx", fieldName: "b", rect: [0, 0, 10, 10] }]
    ]);
    const h = renderHook(doc);
    await waitFor(() => expect(h.current.fields).toHaveLength(2));
    expect(h.current.fields.map((f) => f.page)).toEqual([1, 2]);
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
