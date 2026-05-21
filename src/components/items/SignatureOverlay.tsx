import type { PointerEvent as ReactPointerEvent } from "react";
import type { PageViewport } from "pdfjs-dist/types/src/display/display_utils";
import type { SignatureAsset, SignatureItem } from "../../types";
import { pdfRectToCss } from "../../pdf/coords";

type Props = {
  item: SignatureItem;
  viewport: PageViewport;
  isSelected: boolean;
  /** The asset referenced by `item.signatureId`, or null if it has been deleted. */
  signature: SignatureAsset | null;
  onStartMove: (e: ReactPointerEvent) => void;
  onStartResize: (e: ReactPointerEvent) => void;
};

export function SignatureOverlay({ item, viewport, isSelected, signature, onStartMove, onStartResize }: Props) {
  const css = pdfRectToCss(item.rect, viewport);

  return (
    <div
      className={"overlay-item signature" + (isSelected ? " selected" : "")}
      style={{ left: css.left, top: css.top, width: css.width, height: css.height }}
      onPointerDown={onStartMove}
    >
      {signature
        ? <img src={signature.dataUrl} alt="signature" draggable={false} />
        : <div className="missing">?</div>}
      <div className="handle" onPointerDown={onStartResize} />
    </div>
  );
}
