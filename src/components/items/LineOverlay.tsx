import type { PointerEvent as ReactPointerEvent } from "react";
import type { PageViewport } from "pdfjs-dist/types/src/display/display_utils";
import type { LineItem } from "../../types";
import { lineGeometryFromPoints } from "../../pdf/coords";
import { HANDLE_HALF_PX } from "../../constants";

type Props = {
  item: LineItem;
  viewport: PageViewport;
  isSelected: boolean;
  onStartMove: (e: ReactPointerEvent) => void;
  onStartResize: (e: ReactPointerEvent) => void;
};

export function LineOverlay({ item, viewport, isSelected, onStartMove, onStartResize }: Props) {
  const { left, top, width, height, x1, y1, x2, y2 } = lineGeometryFromPoints(item.start, item.end, viewport);
  const strokePx = Math.max(1, item.strokeWidth * viewport.scale);

  return (
    <div
      className={"overlay-item line" + (isSelected ? " selected" : "")}
      style={{ left, top, width, height }}
      onPointerDown={onStartMove}
    >
      <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={item.color}
          strokeWidth={strokePx}
          strokeLinecap="round"
        />
      </svg>
      <div
        className="handle"
        // The handle moves the `end` point of the line; anchor it on (x2, y2)
        // and override the default bottom-right CSS positioning.
        style={{ left: x2 - HANDLE_HALF_PX, top: y2 - HANDLE_HALF_PX, right: "auto", bottom: "auto" }}
        onPointerDown={onStartResize}
      />
    </div>
  );
}
