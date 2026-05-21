import type { PageViewport } from "pdfjs-dist/types/src/display/display_utils";
import { pdfRectToCss } from "../pdf/coords";
import type { FieldPlacement, FormValues } from "../hooks/useFormFields";

type Props = {
  placement: FieldPlacement;
  viewport: PageViewport;
  values: FormValues;
  onChange: (fieldName: string, value: string | boolean | null) => void;
  /**
   * Invoked when the user activates a push-button widget. The host
   * decides what to do (e.g. call `reset()` for `isReset` buttons).
   */
  onButtonAction?: (button: { name: string; isReset: boolean }) => void;
};

/**
 * Render a single PDF form widget over the rasterised page. The four
 * placement kinds dispatch to distinct DOM controls : text input,
 * checkbox, radio circle and dropdown / list box.
 */
export function FormFieldOverlay({ placement, viewport, values, onChange, onButtonAction }: Props) {
  const css = pdfRectToCss(placement.rect, viewport);
  const baseStyle = {
    left: css.left,
    top: css.top,
    width: css.width,
    height: css.height
  };

  if (placement.kind === "text") {
    const value = values[placement.field.name];
    return (
      <input
        type="text"
        className="form-field text"
        style={{ ...baseStyle, fontSize: Math.max(10, css.height * 0.6) }}
        value={typeof value === "string" ? value : ""}
        maxLength={placement.field.maxLength}
        onChange={(e) => onChange(placement.field.name, e.target.value)}
        onPointerDown={(e) => e.stopPropagation()}
      />
    );
  }

  if (placement.kind === "checkbox") {
    const value = values[placement.field.name];
    return (
      <input
        type="checkbox"
        className="form-field checkbox"
        style={baseStyle}
        checked={Boolean(value)}
        onChange={(e) => onChange(placement.field.name, e.target.checked)}
        onPointerDown={(e) => e.stopPropagation()}
      />
    );
  }

  if (placement.kind === "button") {
    const { isReset, label, name } = placement.field;
    return (
      <button
        type="button"
        className={"form-field button" + (isReset ? " reset" : " inert")}
        style={baseStyle}
        disabled={!isReset}
        // No visible label : the PDF raster usually already paints the
        // caption ("Click to reset form", "Effacer", ...) and stacking
        // our metadata fieldName on top produces overlapping text.
        // Keep the caption in title / aria-label for accessibility.
        title={isReset ? `${label} (reset)` : `${label} (action not supported)`}
        aria-label={label}
        onClick={() => { if (isReset) onButtonAction?.({ name, isReset }); }}
        onPointerDown={(e) => e.stopPropagation()}
      />
    );
  }

  if (placement.kind === "radio-option") {
    const current = values[placement.field.name];
    return (
      <input
        type="radio"
        className="form-field radio"
        style={baseStyle}
        // `name` is shared across the group's options so the browser
        // enforces single-selection without us tracking it manually.
        name={placement.field.name}
        value={placement.option.value}
        checked={current === placement.option.value}
        onChange={(e) => {
          if (e.target.checked) onChange(placement.field.name, placement.option.value);
        }}
        onPointerDown={(e) => e.stopPropagation()}
      />
    );
  }

  // placement.kind === "choice"
  const value = values[placement.field.name];
  return (
    <select
      className={"form-field choice" + (placement.field.combo ? " combo" : " list")}
      style={{ ...baseStyle, fontSize: Math.max(10, css.height * 0.5) }}
      value={typeof value === "string" ? value : ""}
      onChange={(e) => onChange(placement.field.name, e.target.value)}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Render an empty option only when the current value is not in the list,
          so the dropdown can express "nothing selected" without losing the
          original choices. */}
      {!placement.field.options.some((o) => o.exportValue === value) && (
        <option value="" />
      )}
      {placement.field.options.map((opt) => (
        <option key={opt.exportValue} value={opt.exportValue}>
          {opt.displayValue}
        </option>
      ))}
    </select>
  );
}
