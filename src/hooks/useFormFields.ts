import { useEffect, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist/types/src/display/api";
import type { PdfRect } from "../types";

/**
 * Native PDF form field discovered via pdf.js page annotations.
 * MVP scope : text fields (PDF subtype "Tx") and checkboxes (subtype
 * "Btn" with checkBox=true). Other widget kinds (radio, combo box,
 * signature) are skipped.
 */
export type TextFieldDescriptor = {
  type: "text";
  name: string;
  page: number;
  rect: PdfRect;
  defaultValue: string;
  maxLength?: number;
};

export type CheckboxFieldDescriptor = {
  type: "checkbox";
  name: string;
  page: number;
  rect: PdfRect;
  defaultValue: boolean;
};

export type FieldDescriptor = TextFieldDescriptor | CheckboxFieldDescriptor;

/** In-memory value map keyed by `fieldName`. */
export type FormValues = Record<string, string | boolean>;

/**
 * pdf.js shape for an annotation. We only need a subset of the keys
 * and pdf.js does not export a stable annotation type, so we describe
 * the bits we read here for type-safety at the boundary.
 */
type PdfJsAnnotation = {
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

function rectFromQuad(quad: [number, number, number, number]): PdfRect {
  const [x1, y1, x2, y2] = quad;
  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    w: Math.abs(x2 - x1),
    h: Math.abs(y2 - y1)
  };
}

async function enumerateFields(doc: PDFDocumentProxy): Promise<FieldDescriptor[]> {
  const fields: FieldDescriptor[] = [];

  for (let i = 1; i <= doc.numPages; i += 1) {
    const page = await doc.getPage(i);
    const annotations: PdfJsAnnotation[] = await page.getAnnotations();

    for (const ann of annotations) {
      if (ann.subtype !== "Widget") continue;
      if (!ann.fieldName || !ann.rect) continue;

      // Text field (PDF subtype "Tx").
      if (ann.fieldType === "Tx") {
        fields.push({
          type: "text",
          name: ann.fieldName,
          page: i,
          rect: rectFromQuad(ann.rect),
          defaultValue: typeof ann.fieldValue === "string" ? ann.fieldValue : "",
          maxLength: typeof ann.maxLen === "number" && ann.maxLen > 0 ? ann.maxLen : undefined
        });
        continue;
      }

      // Checkbox : subtype "Btn" with checkBox=true. Skip radio and push-button buttons.
      if (ann.fieldType === "Btn" && ann.checkBox && !ann.radioButton && !ann.pushButton) {
        // pdf.js reports the on-state value via fieldValue when the box is checked,
        // or "Off" / undefined otherwise. Anything non-"Off" counts as checked.
        const raw = ann.fieldValue;
        const defaultValue = typeof raw === "string" ? raw !== "Off" : Boolean(raw);
        fields.push({
          type: "checkbox",
          name: ann.fieldName,
          page: i,
          rect: rectFromQuad(ann.rect),
          defaultValue
        });
      }
    }
  }

  return fields;
}

/**
 * Discover form fields when a PDF document loads and manage the
 * in-memory values until the user exports. The hook intentionally
 * keeps the field descriptors immutable (they reflect the file's
 * structure) and only the `values` map changes over time.
 */
export function useFormFields(pdfDoc: PDFDocumentProxy | null) {
  const [fields, setFields] = useState<FieldDescriptor[]>([]);
  const [values, setValues] = useState<FormValues>({});

  useEffect(() => {
    if (!pdfDoc) {
      setFields([]);
      setValues({});
      return;
    }
    let cancelled = false;

    (async () => {
      try {
        const discovered = await enumerateFields(pdfDoc);
        if (cancelled) return;
        setFields(discovered);
        const initial: FormValues = {};
        for (const field of discovered) initial[field.name] = field.defaultValue;
        setValues(initial);
      } catch (err) {
        console.error("Form field enumeration failed:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pdfDoc]);

  function setValue(name: string, value: string | boolean) {
    setValues((prev) => ({ ...prev, [name]: value }));
  }

  function reset() {
    const cleared: FormValues = {};
    for (const field of fields) cleared[field.name] = field.defaultValue;
    setValues(cleared);
  }

  return { fields, values, setValue, reset };
}
