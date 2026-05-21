import type { PointerEvent as ReactPointerEvent } from "react";
import type { PageViewport } from "pdfjs-dist/types/src/display/display_utils";
import type { HighlightItem } from "../../types";
import { pdfRectToCss } from "../../pdf/coords";
import { HIGHLIGHT_OPACITY } from "../../constants";
import { parseHexColor, toCssRgba } from "../../utils/color";

// Highlighter yellow (`#fde047`) parsed once at module load — used as
// a fallback when an item carries a malformed hex value.
const FALLBACK_CHANNELS = { r: 253, g: 224, b: 71 };

type Props = {
  item: HighlightItem;
  viewport: PageViewport;
  isSelected: boolean;
  onStartMove: (e: ReactPointerEvent) => void;
  onStartResize: (e: ReactPointerEvent) => void;
};

export function HighlightOverlay({ item, viewport, isSelected, onStartMove, onStartResize }: Props) {
  const css = pdfRectToCss(item.rect, viewport);
  const fill = toCssRgba(parseHexColor(item.color) ?? FALLBACK_CHANNELS, HIGHLIGHT_OPACITY);

  return (
    <div
      className={"overlay-item highlight" + (isSelected ? " selected" : "")}
      style={{ left: css.left, top: css.top, width: css.width, height: css.height, background: fill }}
      onPointerDown={onStartMove}
    >
      <div className="handle" onPointerDown={onStartResize} />
    </div>
  );
}
