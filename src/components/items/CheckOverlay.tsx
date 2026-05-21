import type { PointerEvent as ReactPointerEvent } from "react";
import type { PageViewport } from "pdfjs-dist/types/src/display/display_utils";
import type { CheckItem } from "../../types";
import { pdfRectToCss } from "../../pdf/coords";

type Props = {
  item: CheckItem;
  viewport: PageViewport;
  isSelected: boolean;
  onStartMove: (e: ReactPointerEvent) => void;
  onStartResize: (e: ReactPointerEvent) => void;
};

export function CheckOverlay({ item, viewport, isSelected, onStartMove, onStartResize }: Props) {
  const css = pdfRectToCss(item.rect, viewport);

  return (
    <div
      className={"overlay-item check" + (isSelected ? " selected" : "")}
      style={{ left: css.left, top: css.top, width: css.width, height: css.height }}
      onPointerDown={onStartMove}
    >
      <span style={{ fontSize: item.fontSize, color: item.color }}>{item.value}</span>
      <div className="handle" onPointerDown={onStartResize} />
    </div>
  );
}
