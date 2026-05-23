import { useEffect, useMemo, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist/types/src/display/api";
import type { PdfRect } from "../types";

/**
 * Native PDF form fields surfaced via pdf.js page annotations.
 * Supported : text ("Tx"), checkbox ("Btn" + checkBox), radio group
 * ("Btn" + radioButton) and choice fields ("Ch", both combo and list).
 * Push buttons are skipped — their behaviour is typically tied to
 * JavaScript actions we cannot replay.
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

export type RadioOption = {
  /** Export value of this specific widget — the value written when the option is selected. */
  value: string;
  page: number;
  rect: PdfRect;
};

export type RadioGroupDescriptor = {
  type: "radio";
  name: string;
  options: RadioOption[];
  /** Selected option's export value, or null when nothing is selected. */
  defaultValue: string | null;
};

export type ChoiceOption = {
  exportValue: string;
  displayValue: string;
};

export type ChoiceFieldDescriptor = {
  type: "choice";
  name: string;
  page: number;
  rect: PdfRect;
  options: ChoiceOption[];
  /** True for an editable dropdown ; false for a static list box. */
  combo: boolean;
  defaultValue: string;
};

export type PushButtonDescriptor = {
  type: "button";
  name: string;
  page: number;
  rect: PdfRect;
  /** True when the button's PDF action is "ResetForm". Submit and
   *  JavaScript actions cannot be replayed reliably so they become
   *  inert overlays — flagged here for the renderer to decide. */
  isReset: boolean;
  /** Best-effort caption : alternativeText > buttonValue > fieldName. */
  label: string;
};

export type FieldDescriptor =
  | TextFieldDescriptor
  | CheckboxFieldDescriptor
  | RadioGroupDescriptor
  | ChoiceFieldDescriptor
  | PushButtonDescriptor;

/**
 * Renderable placement for the overlay layer. Text / checkbox / choice
 * map 1:1 to their descriptor, while a radio group expands to one
 * placement per option so each radio circle can be drawn independently.
 */
export type FieldPlacement =
  | { kind: "text"; page: number; rect: PdfRect; field: TextFieldDescriptor }
  | { kind: "checkbox"; page: number; rect: PdfRect; field: CheckboxFieldDescriptor }
  | { kind: "choice"; page: number; rect: PdfRect; field: ChoiceFieldDescriptor }
  | { kind: "radio-option"; page: number; rect: PdfRect; field: RadioGroupDescriptor; option: RadioOption }
  | { kind: "button"; page: number; rect: PdfRect; field: PushButtonDescriptor };

/** In-memory value map keyed by `fieldName`. */
export type FormValues = Record<string, string | boolean | null>;

/**
 * pdf.js shape for an annotation. We only describe the keys we read so
 * type-safety holds at the boundary even though pdf.js does not export
 * a public annotation type.
 */
type PdfJsAnnotation = {
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
  /** pdf.js attaches a truthy `resetForm` payload on widgets whose
   *  action dictionary is `/S /ResetForm`. Shape is unstable across
   *  pdf.js versions, so the boundary stays loose. */
  resetForm?: unknown;
  alternativeText?: unknown;
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

/** Try the two property names pdf.js uses (across versions) for a radio's on-value. */
function radioOptionValue(ann: PdfJsAnnotation): string | null {
  if (typeof ann.buttonValue === "string") return ann.buttonValue;
  if (typeof ann.exportValue === "string") return ann.exportValue;
  return null;
}

async function enumerateFields(doc: PDFDocumentProxy): Promise<FieldDescriptor[]> {
  // First pass : collect everything by field name so radio groups can
  // be assembled across their multiple widgets (which may even live on
  // different pages in some forms).
  const radioByName = new Map<string, RadioGroupDescriptor>();
  const simpleFields: FieldDescriptor[] = [];

  for (let i = 1; i <= doc.numPages; i += 1) {
    const page = await doc.getPage(i);
    const annotations: PdfJsAnnotation[] = await page.getAnnotations();

    for (const ann of annotations) {
      if (ann.subtype !== "Widget") continue;
      if (!ann.fieldName || !ann.rect) continue;

      // Text field.
      if (ann.fieldType === "Tx") {
        simpleFields.push({
          type: "text",
          name: ann.fieldName,
          page: i,
          rect: rectFromQuad(ann.rect),
          defaultValue: typeof ann.fieldValue === "string" ? ann.fieldValue : "",
          maxLength: typeof ann.maxLen === "number" && ann.maxLen > 0 ? ann.maxLen : undefined
        });
        continue;
      }

      // Choice (dropdown / list box). Multi-select lists are flattened
      // to their first selected entry — adequate for admin PDFs.
      if (ann.fieldType === "Ch") {
        const raw = ann.fieldValue;
        const defaultValue = typeof raw === "string"
          ? raw
          : Array.isArray(raw) && typeof raw[0] === "string" ? raw[0] : "";
        simpleFields.push({
          type: "choice",
          name: ann.fieldName,
          page: i,
          rect: rectFromQuad(ann.rect),
          options: Array.isArray(ann.options) ? ann.options : [],
          combo: Boolean(ann.combo),
          defaultValue
        });
        continue;
      }

      // Button family : push buttons become descriptors (functional
       // only when they carry a ResetForm action), checkboxes route
       // to their own descriptor, radios accumulate into the per-name
       // group.
      if (ann.fieldType === "Btn") {
        if (ann.pushButton) {
          const label = typeof ann.alternativeText === "string" && ann.alternativeText.trim()
            ? ann.alternativeText
            : typeof ann.buttonValue === "string" && ann.buttonValue.trim()
              ? ann.buttonValue
              : ann.fieldName;
          simpleFields.push({
            type: "button",
            name: ann.fieldName,
            page: i,
            rect: rectFromQuad(ann.rect),
            isReset: Boolean(ann.resetForm),
            label
          });
          continue;
        }

        if (ann.checkBox) {
          const raw = ann.fieldValue;
          const defaultValue = typeof raw === "string" ? raw !== "Off" : Boolean(raw);
          simpleFields.push({
            type: "checkbox",
            name: ann.fieldName,
            page: i,
            rect: rectFromQuad(ann.rect),
            defaultValue
          });
          continue;
        }

        if (ann.radioButton) {
          const optionValue = radioOptionValue(ann);
          if (!optionValue) continue; // a radio widget without an on-value can't be selected meaningfully.
          const group = radioByName.get(ann.fieldName) ?? {
            type: "radio" as const,
            name: ann.fieldName,
            options: [] as RadioOption[],
            defaultValue: null as string | null
          };
          group.options.push({ value: optionValue, page: i, rect: rectFromQuad(ann.rect) });
          // The selected value lives on each widget's fieldValue ; capture
          // the first non-"Off" one we encounter (they should all agree).
          if (group.defaultValue === null && typeof ann.fieldValue === "string" && ann.fieldValue !== "Off") {
            group.defaultValue = ann.fieldValue;
          }
          radioByName.set(ann.fieldName, group);
        }
      }
    }
  }

  return [...simpleFields, ...radioByName.values()];
}

function placementsFromFields(fields: FieldDescriptor[]): FieldPlacement[] {
  const placements: FieldPlacement[] = [];
  for (const field of fields) {
    switch (field.type) {
      case "text":
        placements.push({ kind: "text", page: field.page, rect: field.rect, field });
        break;
      case "checkbox":
        placements.push({ kind: "checkbox", page: field.page, rect: field.rect, field });
        break;
      case "choice":
        placements.push({ kind: "choice", page: field.page, rect: field.rect, field });
        break;
      case "button":
        placements.push({ kind: "button", page: field.page, rect: field.rect, field });
        break;
      case "radio":
        for (const option of field.options) {
          placements.push({ kind: "radio-option", page: option.page, rect: option.rect, field, option });
        }
        break;
    }
  }
  return placements;
}

/**
 * Discover native form fields when a PDF document loads, manage the
 * in-memory values until the user exports, and expose a flat
 * `placements` list ready to be grouped by page for rendering.
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
        for (const field of discovered) {
          // Push buttons trigger actions and do not own a value.
          if (field.type === "button") continue;
          initial[field.name] = field.defaultValue;
        }
        setValues(initial);
      } catch (err) {
        console.error("Form field enumeration failed:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pdfDoc]);

  const placements = useMemo(() => placementsFromFields(fields), [fields]);

  function setValue(name: string, value: string | boolean | null) {
    setValues((prev) => ({ ...prev, [name]: value }));
  }

  function reset() {
    const cleared: FormValues = {};
    for (const field of fields) {
      if (field.type === "button") continue;
      cleared[field.name] = field.defaultValue;
    }
    setValues(cleared);
  }

  return { fields, placements, values, setValue, reset };
}
