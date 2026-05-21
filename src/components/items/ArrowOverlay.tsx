import type { PointerEvent as ReactPointerEvent } from "react";
import type { PageViewport } from "pdfjs-dist/types/src/display/display_utils";
import type { ArrowItem } from "../../types";
import { lineGeometryFromPoints } from "../../pdf/coords";
import { HANDLE_HALF_PX } from "../../constants";

type Props = {
  item: ArrowItem;
  viewport: PageViewport;
  isSelected: boolean;
  onStartMove: (e: ReactPointerEvent) => void;
  onStartResize: (e: ReactPointerEvent) => void;
};

export function ArrowOverlay({ item, viewport, isSelected, onStartMove, onStartResize }: Props) {
  const { left, top, width, height, x1, y1, x2, y2 } = lineGeometryFromPoints(item.start, item.end, viewport);
  const strokePx = Math.max(1, item.strokeWidth * viewport.scale);

  // Arrow-head geometry, scaled to the stroke width with a minimum
  // visible size. `(px, py)` is the half-width offset, perpendicular
  // to the direction of the segment, used to build the head polygon.
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const headLength = Math.max(8, strokePx * 4);
  const headWidth = headLength * 0.7;
  const hx = Math.cos(angle) * headLength;
  const hy = Math.sin(angle) * headLength;
  const px = -Math.sin(angle) * headWidth * 0.5;
  const py = Math.cos(angle) * headWidth * 0.5;
  const baseX = x2 - hx;
  const baseY = y2 - hy;
  const leftX = baseX + px;
  const leftY = baseY + py;
  const rightX = baseX - px;
  const rightY = baseY - py;

  return (
    <div
      className={"overlay-item arrow" + (isSelected ? " selected" : "")}
      style={{ left, top, width, height }}
      onPointerDown={onStartMove}
    >
      <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <line
          x1={x1}
          y1={y1}
          x2={baseX}
          y2={baseY}
          stroke={item.color}
          strokeWidth={strokePx}
          strokeLinecap="round"
        />
        <polygon points={`${x2},${y2} ${leftX},${leftY} ${rightX},${rightY}`} fill={item.color} />
      </svg>
      <div
        className="handle"
        // Handle sits on the arrow tip so the user grabs the visible end point.
        style={{ left: x2 - HANDLE_HALF_PX, top: y2 - HANDLE_HALF_PX, right: "auto", bottom: "auto" }}
        onPointerDown={onStartResize}
      />
    </div>
  );
}
