import type { PointerEvent as ReactPointerEvent } from "react";
import type { PageViewport } from "pdfjs-dist/types/src/display/display_utils";
import type { TextItem } from "../../types";
import { pdfRectToCss } from "../../pdf/coords";
import { FONT_STACK } from "../../constants";

type Props = {
  item: TextItem;
  viewport: PageViewport;
  isSelected: boolean;
  isEditing: boolean;
  editingValue: string;
  placeholder: string;
  /** Tooltip shown on the static (non-editing) view. */
  editTitle: string;
  onStartMove: (e: ReactPointerEvent) => void;
  onStartResize: (e: ReactPointerEvent) => void;
  onStartEdit: () => void;
  onEditChange: (value: string) => void;
  onCommit: (apply: boolean) => void;
};

export function TextOverlay({
  item,
  viewport,
  isSelected,
  isEditing,
  editingValue,
  placeholder,
  editTitle,
  onStartMove,
  onStartResize,
  onStartEdit,
  onEditChange,
  onCommit
}: Props) {
  const css = pdfRectToCss(item.rect, viewport);
  const fontFamily = item.fontFamily ?? "sans";
  const isBold = Boolean(item.bold);
  const isUnderline = Boolean(item.underline);
  const isStrike = Boolean(item.strike);
  const sharedStyle = {
    fontSize: item.fontSize,
    fontFamily: FONT_STACK[fontFamily],
    fontWeight: isBold ? 700 : 400,
    textDecoration: [isUnderline ? "underline" : "", isStrike ? "line-through" : ""].filter(Boolean).join(" ")
  };

  return (
    <div
      className={"overlay-item text" + (isSelected ? " selected" : "")}
      style={{ left: css.left, top: css.top, width: css.width, height: css.height }}
      // While editing, swallow pointer-down so it does not start a drag-move.
      onPointerDown={(e) => { if (!isEditing) onStartMove(e); }}
      onDoubleClick={onStartEdit}
      title={editTitle}
    >
      {isEditing ? (
        <input
          className="text-editor"
          style={{ ...sharedStyle, color: item.color }}
          value={editingValue}
          placeholder={placeholder}
          onChange={(e) => onEditChange(e.target.value)}
          onBlur={() => onCommit(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onCommit(true);
            }
            if (e.key === "Escape") {
              e.preventDefault();
              onCommit(false);
            }
          }}
          onPointerDown={(e) => e.stopPropagation()}
          autoFocus
        />
      ) : (
        <span style={{ ...sharedStyle, color: item.value ? item.color : "var(--muted)" }}>
          {item.value || placeholder}
        </span>
      )}
      <div className="handle" onPointerDown={onStartResize} />
    </div>
  );
}
