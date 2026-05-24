import { describe, expect, it } from "vitest";
import { applyTemplate } from "./applyTemplate";
import type { Template } from "./types";
import type { Item, TextItem, SignatureItem, LineItem, Paraph } from "../types";

function txt(overrides: Partial<TextItem> = {}): TextItem {
  return {
    id: "tpl-text-1",
    type: "text",
    page: 1,
    rect: { x: 50, y: 700, w: 200, h: 16 },
    value: "Jane Doe",
    fontSize: 12,
    color: "#111111",
    fontFamily: "sans",
    bold: false,
    underline: false,
    strike: false,
    ...overrides
  };
}

function emptyTemplate(items: Item[] = [], paraph: Paraph | null = null): Template {
  return {
    id: "tpl-1",
    name: "Test template",
    updatedAt: "2026-01-01T00:00:00Z",
    items,
    paraph
  };
}

describe("applyTemplate", () => {
  it("returns an empty result when the template has no items and no paraph", () => {
    const result = applyTemplate({ template: emptyTemplate(), locale: "en" });
    expect(result.items).toEqual([]);
    expect(result.paraph).toBeNull();
  });

  it("regenerates ids so re-applying the same template never collides", () => {
    const template = emptyTemplate([
      txt({ id: "tpl-text-1" }),
      txt({ id: "tpl-text-2", value: "Other" })
    ]);
    const a = applyTemplate({ template, locale: "en" });
    const b = applyTemplate({ template, locale: "en" });
    expect(a.items[0].id).not.toBe(template.items[0].id);
    expect(b.items[0].id).not.toBe(a.items[0].id);
    expect(a.items[0].id).not.toBe(a.items[1].id);
  });

  it("deep-clones items so mutating the result leaves the template untouched", () => {
    const template = emptyTemplate([txt({ value: "Original" })]);
    const result = applyTemplate({ template, locale: "en" });
    const cloned = result.items[0];
    if (cloned.type !== "text") throw new Error("type narrowing");
    cloned.value = "Mutated";
    cloned.rect.x = 999;
    expect((template.items[0] as TextItem).value).toBe("Original");
    expect(template.items[0].rect.x).toBe(50);
  });

  it("refreshes autoDate text items with today's date in the active locale", () => {
    const template = emptyTemplate([
      txt({ value: "01/01/2020", autoDate: true })
    ]);
    const result = applyTemplate({
      template,
      locale: "fr",
      now: new Date("2026-05-23T10:00:00Z")
    });
    expect((result.items[0] as TextItem).value).toBe("23/05/2026");
  });

  it("leaves non-autoDate text items unchanged", () => {
    const template = emptyTemplate([
      txt({ value: "Some static text" })
    ]);
    const result = applyTemplate({
      template,
      locale: "fr",
      now: new Date("2026-05-23T10:00:00Z")
    });
    expect((result.items[0] as TextItem).value).toBe("Some static text");
  });

  it("locale switches the autoDate format", () => {
    const template = emptyTemplate([
      txt({ value: "placeholder", autoDate: true })
    ]);
    const fr = applyTemplate({ template, locale: "fr", now: new Date("2026-05-23T10:00:00Z") });
    const en = applyTemplate({ template, locale: "en", now: new Date("2026-05-23T10:00:00Z") });
    expect((fr.items[0] as TextItem).value).toBe("23/05/2026");
    expect((en.items[0] as TextItem).value).toBe("05/23/2026");
  });

  it("carries the paraph through with a cloned rect", () => {
    const paraph: Paraph = { assetId: "par-1", rect: { x: 500, y: 30, w: 60, h: 20 } };
    const template = emptyTemplate([], paraph);
    const result = applyTemplate({ template, locale: "en" });
    expect(result.paraph).toEqual(paraph);
    // Mutating the cloned paraph rect must not touch the template.
    result.paraph!.rect.x = 999;
    expect(template.paraph!.rect.x).toBe(500);
  });

  it("preserves nested fields of line/arrow items (start, end)", () => {
    const line: LineItem = {
      id: "tpl-line",
      type: "line",
      page: 1,
      rect: { x: 10, y: 10, w: 100, h: 0 },
      start: { x: 10, y: 10 },
      end: { x: 110, y: 10 },
      color: "#000000",
      strokeWidth: 2
    };
    const template = emptyTemplate([line]);
    const result = applyTemplate({ template, locale: "en" });
    const cloned = result.items[0];
    if (cloned.type !== "line") throw new Error("type narrowing");
    expect(cloned.start).toEqual({ x: 10, y: 10 });
    expect(cloned.end).toEqual({ x: 110, y: 10 });
    // Mutation isolation.
    cloned.start.x = 999;
    expect(line.start.x).toBe(10);
  });

  it("preserves signature items' signatureId reference", () => {
    const sig: SignatureItem = {
      id: "tpl-sig",
      type: "signature",
      page: 1,
      rect: { x: 100, y: 100, w: 200, h: 50 },
      signatureId: "user-sig-id"
    };
    const template = emptyTemplate([sig]);
    const result = applyTemplate({ template, locale: "en" });
    const cloned = result.items[0];
    if (cloned.type !== "signature") throw new Error("type narrowing");
    expect(cloned.signatureId).toBe("user-sig-id");
  });
});
