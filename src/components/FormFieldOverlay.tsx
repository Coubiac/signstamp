import type { PageViewport } from "pdfjs-dist/types/src/display/display_utils";
import { pdfRectToCss } from "../pdf/coords";
import type { FieldDescriptor } from "../hooks/useFormFields";

type Props = {
  field: FieldDescriptor;
  viewport: PageViewport;
  value: string | boolean | undefined;
  onChange: (value: string | boolean) => void;
};

/**
 * Render a single native PDF form field as an editable DOM node
 * positioned over the rasterised page. Text fields become inputs,
 * checkboxes become a centered square — both write back into the
 * shared FormValues map via `onChange`.
 */
export function FormFieldOverlay({ field, viewport, value, onChange }: Props) {
  const css = pdfRectToCss(field.rect, viewport);

  if (field.type === "text") {
    return (
      <input
        type="text"
        className="form-field text"
        style={{
          left: css.left,
          top: css.top,
          width: css.width,
          height: css.height,
          // Scale the inline font to the page zoom so it stays legible.
          fontSize: Math.max(10, css.height * 0.6)
        }}
        value={typeof value === "string" ? value : ""}
        maxLength={field.maxLength}
        onChange={(e) => onChange(e.target.value)}
        // Pointer events should stay on the input, not bubble up to the
        // overlay's draw / pan handler, so the user can click and drag
        // a selection inside the field.
        onPointerDown={(e) => e.stopPropagation()}
      />
    );
  }

  return (
    <input
      type="checkbox"
      className="form-field checkbox"
      style={{
        left: css.left,
        top: css.top,
        width: css.width,
        height: css.height
      }}
      checked={Boolean(value)}
      onChange={(e) => onChange(e.target.checked)}
      onPointerDown={(e) => e.stopPropagation()}
    />
  );
}
