import type { PointerEvent as ReactPointerEvent } from "react";
import type { PageViewport } from "pdfjs-dist/types/src/display/display_utils";
import type { Paraph, SignatureAsset } from "../../types";
import { pdfRectToCss } from "../../pdf/coords";

type Props = {
  paraph: Paraph;
  viewport: PageViewport;
  /** Asset referenced by `paraph.assetId`, or null if it has been deleted. */
  asset: SignatureAsset | null;
  isSelected: boolean;
  onStartMove: (e: ReactPointerEvent) => void;
  onStartResize: (e: ReactPointerEvent) => void;
};

/**
 * Renders the paraph overlay on a single page. Every page draws its
 * own instance from the same master `paraph` state, so the image
 * appears identically on every page. Drag and resize update the
 * master rect, which causes every page to re-render together.
 */
export function ParaphOverlay({ paraph, viewport, asset, isSelected, onStartMove, onStartResize }: Props) {
  if (!asset) return null;
  const css = pdfRectToCss(paraph.rect, viewport);
  return (
    <div
      className={"overlay-item paraph" + (isSelected ? " selected" : "")}
      style={{ left: css.left, top: css.top, width: css.width, height: css.height }}
      onPointerDown={onStartMove}
    >
      <img src={asset.dataUrl} alt="paraph" draggable={false} />
      <div className="handle" onPointerDown={onStartResize} />
    </div>
  );
}
