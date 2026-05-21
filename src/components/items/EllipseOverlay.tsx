import type { PointerEvent as ReactPointerEvent } from "react";
import type { PageViewport } from "pdfjs-dist/types/src/display/display_utils";
import type { EllipseItem } from "../../types";
import { pdfRectToCss } from "../../pdf/coords";

type Props = {
  item: EllipseItem;
  viewport: PageViewport;
  isSelected: boolean;
  onStartMove: (e: ReactPointerEvent) => void;
  onStartResize: (e: ReactPointerEvent) => void;
};

export function EllipseOverlay({ item, viewport, isSelected, onStartMove, onStartResize }: Props) {
  const css = pdfRectToCss(item.rect, viewport);
  // The stored stroke width is in PDF units; multiply by the viewport
  // scale so the on-screen outline matches the exported PDF stroke.
  const strokePx = Math.max(1, item.strokeWidth * viewport.scale);

  return (
    <div
      className={"overlay-item ellipse" + (isSelected ? " selected" : "")}
      style={{
        left: css.left,
        top: css.top,
        width: css.width,
        height: css.height,
        borderColor: item.color,
        borderWidth: strokePx
      }}
      onPointerDown={onStartMove}
    >
      <div className="handle" onPointerDown={onStartResize} />
    </div>
  );
}
