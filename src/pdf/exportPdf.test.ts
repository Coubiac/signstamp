import { describe, expect, it } from "vitest";
import { PDFCheckBox, PDFDocument, PDFDropdown, PDFOptionList, PDFRadioGroup, PDFTextField } from "pdf-lib";
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

  it("writes back AcroForm field values when formValues is provided", async () => {
    // Build a fresh document with a text field and a checkbox.
    const base = await PDFDocument.create();
    const page = base.addPage([400, 400]);
    const form = base.getForm();
    const name = form.createTextField("user.name");
    name.setText("");
    name.addToPage(page, { x: 50, y: 300, width: 200, height: 20 });
    const agree = form.createCheckBox("user.agree");
    agree.addToPage(page, { x: 50, y: 260, width: 14, height: 14 });
    const baseBytes = await base.save();

    const out = await exportFlattenedPdf({
      originalPdfBytes: baseBytes,
      items: [],
      signatures: [],
      formValues: {
        "user.name": "Jane Doe",
        "user.agree": true
      }
    });

    const loaded = await PDFDocument.load(out);
    const loadedForm = loaded.getForm();
    const reloadedName = loadedForm.getField("user.name");
    const reloadedAgree = loadedForm.getField("user.agree");
    expect(reloadedName).toBeInstanceOf(PDFTextField);
    expect((reloadedName as PDFTextField).getText()).toBe("Jane Doe");
    expect(reloadedAgree).toBeInstanceOf(PDFCheckBox);
    expect((reloadedAgree as PDFCheckBox).isChecked()).toBe(true);
  });

  it("selects a radio group's option and clears it when value is null", async () => {
    const base = await PDFDocument.create();
    const page = base.addPage([400, 400]);
    const form = base.getForm();
    const group = form.createRadioGroup("color");
    group.addOptionToPage("red", page, { x: 20, y: 300, width: 14, height: 14 });
    group.addOptionToPage("green", page, { x: 50, y: 300, width: 14, height: 14 });
    group.addOptionToPage("blue", page, { x: 80, y: 300, width: 14, height: 14 });
    const baseBytes = await base.save();

    // First export : select "green".
    const selected = await exportFlattenedPdf({
      originalPdfBytes: baseBytes,
      items: [],
      signatures: [],
      formValues: { color: "green" }
    });
    const loaded = await PDFDocument.load(selected);
    const reloadedGroup = loaded.getForm().getField("color");
    expect(reloadedGroup).toBeInstanceOf(PDFRadioGroup);
    expect((reloadedGroup as PDFRadioGroup).getSelected()).toBe("green");

    // Second export from the freshly-selected doc : null clears it.
    const cleared = await exportFlattenedPdf({
      originalPdfBytes: selected,
      items: [],
      signatures: [],
      formValues: { color: null }
    });
    const reloadedCleared = await PDFDocument.load(cleared);
    const clearedGroup = reloadedCleared.getForm().getField("color") as PDFRadioGroup;
    expect(clearedGroup.getSelected()).toBeUndefined();
  });

  it("writes the selected option for a dropdown and a list box", async () => {
    const base = await PDFDocument.create();
    const page = base.addPage([400, 400]);
    const form = base.getForm();

    const country = form.createDropdown("country");
    country.setOptions(["France", "Germany", "Spain"]);
    country.addToPage(page, { x: 20, y: 300, width: 120, height: 20 });

    const lang = form.createOptionList("lang");
    lang.setOptions(["en", "fr", "de"]);
    lang.addToPage(page, { x: 20, y: 250, width: 120, height: 60 });
    const baseBytes = await base.save();

    const out = await exportFlattenedPdf({
      originalPdfBytes: baseBytes,
      items: [],
      signatures: [],
      formValues: { country: "Germany", lang: "fr" }
    });
    const loaded = await PDFDocument.load(out);
    const reloadedCountry = loaded.getForm().getField("country");
    const reloadedLang = loaded.getForm().getField("lang");
    expect(reloadedCountry).toBeInstanceOf(PDFDropdown);
    expect(reloadedLang).toBeInstanceOf(PDFOptionList);
    expect((reloadedCountry as PDFDropdown).getSelected()).toEqual(["Germany"]);
    expect((reloadedLang as PDFOptionList).getSelected()).toEqual(["fr"]);
  });

  it("silently ignores unknown radio / choice options", async () => {
    const base = await PDFDocument.create();
    const page = base.addPage([400, 400]);
    const form = base.getForm();
    const group = form.createRadioGroup("color");
    group.addOptionToPage("red", page, { x: 0, y: 0, width: 10, height: 10 });
    const baseBytes = await base.save();

    // Should not throw despite "purple" not existing.
    const out = await exportFlattenedPdf({
      originalPdfBytes: baseBytes,
      items: [],
      signatures: [],
      formValues: { color: "purple" }
    });
    const loaded = await PDFDocument.load(out);
    expect(loaded.getPageCount()).toBe(1);
  });

  it("ignores stale form field names that do not exist in the document", async () => {
    // A document with no AcroForm at all — formValues must not crash the export.
    const base = await PDFDocument.create();
    base.addPage([400, 400]);
    const baseBytes = await base.save();

    const out = await exportFlattenedPdf({
      originalPdfBytes: baseBytes,
      items: [],
      signatures: [],
      formValues: { "ghost.field": "ignored" }
    });

    const loaded = await PDFDocument.load(out);
    expect(loaded.getPageCount()).toBe(1);
  });
});
