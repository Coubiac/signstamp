import { useCallback, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { PageViewport } from "pdfjs-dist/types/src/display/display_utils";
import type { Item, PdfPoint, PdfRect } from "../types";
import { pxDeltaToPdfDelta } from "../pdf/coords";
import { MIN_RESIZE_PDF } from "../constants";

/**
 * Finite-state model for the on-page interaction. The state machine
 * lives in `useDragMachine` ; this type captures both the discriminator
 * (move / resize / draw / none) and the data each transition has to
 * remember to compute incremental updates.
 */
export type DragMode =
  | { kind: "none" }
  | {
      kind: "move";
      id: string;
      page: number;
      startX: number;
      startY: number;
      startRect: PdfRect;
      startLine?: { start: PdfPoint; end: PdfPoint };
    }
  | {
      kind: "resize";
      id: string;
      page: number;
      startX: number;
      startY: number;
      startRect: PdfRect;
      startLine?: { start: PdfPoint; end: PdfPoint };
    }
  | {
      kind: "draw";
      id: string;
      page: number;
      startX: number;
      startY: number;
      startPdf: PdfPoint;
      overlayRect: DOMRect;
    };

/** Bounding rect of two PDF points, with a 1-unit floor to avoid collapsing to zero. */
function rectFromPoints(start: PdfPoint, end: PdfPoint): PdfRect {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    w: Math.max(1, Math.abs(end.x - start.x)),
    h: Math.max(1, Math.abs(end.y - start.y))
  };
}

/**
 * Pure computation: given the current drag context, the item being
 * dragged, the latest pointer position (CSS pixels) and the viewport
 * of the relevant page, return the item with updated geometry.
 *
 * Returns the input item untouched when the drag does not apply
 * (kind "none", or the item id does not match — caller's responsibility
 * to filter, but the function defends in depth).
 */
export function applyDragToItem(
  drag: DragMode,
  item: Item,
  pointerX: number,
  pointerY: number,
  viewport: PageViewport
): Item {
  if (drag.kind === "none") return item;
  if ("id" in drag && drag.id !== item.id) return item;

  if (drag.kind === "move") {
    const { dxPdf, dyPdf } = pxDeltaToPdfDelta(pointerX - drag.startX, pointerY - drag.startY, viewport);
    if (item.type === "line" || item.type === "arrow") {
      const base = drag.startLine ?? { start: item.start, end: item.end };
      const start = { x: base.start.x + dxPdf, y: base.start.y + dyPdf };
      const end = { x: base.end.x + dxPdf, y: base.end.y + dyPdf };
      return { ...item, start, end, rect: rectFromPoints(start, end) };
    }
    return {
      ...item,
      rect: { ...item.rect, x: drag.startRect.x + dxPdf, y: drag.startRect.y + dyPdf }
    };
  }

  if (drag.kind === "resize") {
    const { dxPdf, dyPdf } = pxDeltaToPdfDelta(pointerX - drag.startX, pointerY - drag.startY, viewport);
    if ((item.type === "line" || item.type === "arrow") && drag.startLine) {
      const start = drag.startLine.start;
      const end = { x: drag.startLine.end.x + dxPdf, y: drag.startLine.end.y + dyPdf };
      return { ...item, start, end, rect: rectFromPoints(start, end) };
    }
    // Bottom-right corner handle: anchor the top edge (y + h) so the
    // bottom edge follows the mouse in screen coordinates.
    const newW = Math.max(MIN_RESIZE_PDF.width, drag.startRect.w + dxPdf);
    const newH = Math.max(MIN_RESIZE_PDF.height, drag.startRect.h - dyPdf);
    const topY = drag.startRect.y + drag.startRect.h;
    const newY = topY - newH;
    return { ...item, rect: { ...item.rect, y: newY, w: newW, h: newH } };
  }

  // drag.kind === "draw"
  const xPx = pointerX - drag.overlayRect.left;
  const yPx = pointerY - drag.overlayRect.top;
  const [xPdf, yPdf] = viewport.convertToPdfPoint(xPx, yPx);
  if (item.type === "line" || item.type === "arrow") {
    const start = { x: drag.startPdf.x, y: drag.startPdf.y };
    const end = { x: xPdf, y: yPdf };
    return { ...item, start, end, rect: rectFromPoints(start, end) };
  }
  const x = Math.min(drag.startPdf.x, xPdf);
  const y = Math.min(drag.startPdf.y, yPdf);
  const w = Math.max(1, Math.abs(xPdf - drag.startPdf.x));
  const h = Math.max(1, Math.abs(yPdf - drag.startPdf.y));
  return { ...item, rect: { ...item.rect, x, y, w, h } };
}

type Deps = {
  /** Latest items snapshot — used to look up the item being dragged. */
  items: Item[];
  pageViewports: PageViewport[];
  /** Snapshot `items` into the undo stack before the drag mutates them. */
  pushHistory: () => void;
  /** Apply an in-flight update without recording it in the undo stack. */
  updateItemsNoRecord: (updater: (items: Item[]) => Item[]) => void;
  /** Select the item being manipulated. */
  setSelectedId: (id: string | null) => void;
};

/**
 * Encapsulates the move / resize / draw state machine.
 *
 * `startMove` and `startResize` enter the corresponding mode on a
 * pointer-down — they snapshot the item's geometry so subsequent
 * pointer moves can compute deltas without re-querying state.
 *
 * `beginDraw` is invoked by the caller once it has created the new
 * item (the hook intentionally does not know about tools or item
 * creation, which keeps it focused on the geometry side of things).
 *
 * `onPointerMove` and `onPointerUp` are meant to be wired at the
 * document / app root level so they keep firing even when the cursor
 * leaves the originating element.
 */
export function useDragMachine(deps: Deps) {
  const [drag, setDrag] = useState<DragMode>({ kind: "none" });

  // Refs so the stable handlers below see the latest deps without
  // forcing a new identity (which would tear down pointer capture).
  const depsRef = useRef(deps);
  depsRef.current = deps;
  const dragRef = useRef(drag);
  dragRef.current = drag;

  const startMove = useCallback((id: string, e: ReactPointerEvent) => {
    const { items, pageViewports, pushHistory, setSelectedId } = depsRef.current;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    const item = items.find((i) => i.id === id);
    if (!item) return;
    if (!pageViewports[item.page - 1]) return;

    setSelectedId(id);
    pushHistory();
    setDrag({
      kind: "move",
      id,
      page: item.page,
      startX: e.clientX,
      startY: e.clientY,
      startRect: { ...item.rect },
      startLine:
        item.type === "line" || item.type === "arrow"
          ? { start: { ...item.start }, end: { ...item.end } }
          : undefined
    });
  }, []);

  const startResize = useCallback((id: string, e: ReactPointerEvent) => {
    const { items, pageViewports, pushHistory, setSelectedId } = depsRef.current;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    const item = items.find((i) => i.id === id);
    if (!item) return;
    if (!pageViewports[item.page - 1]) return;

    setSelectedId(id);
    pushHistory();
    setDrag({
      kind: "resize",
      id,
      page: item.page,
      startX: e.clientX,
      startY: e.clientY,
      startRect: { ...item.rect },
      startLine:
        item.type === "line" || item.type === "arrow"
          ? { start: { ...item.start }, end: { ...item.end } }
          : undefined
    });
  }, []);

  /**
   * Switch the machine to "draw" mode. The new item must already be
   * appended to the items list ; the hook only tracks its id so
   * subsequent pointer moves can resize it incrementally.
   */
  const beginDraw = useCallback(
    (payload: Omit<Extract<DragMode, { kind: "draw" }>, "kind">) => {
      depsRef.current.setSelectedId(payload.id);
      setDrag({ kind: "draw", ...payload });
    },
    []
  );

  const onPointerMove = useCallback((e: ReactPointerEvent) => {
    const current = dragRef.current;
    if (current.kind === "none") return;

    const { pageViewports, updateItemsNoRecord } = depsRef.current;
    const viewport = pageViewports[current.page - 1];
    if (!viewport) return;

    updateItemsNoRecord((prev) =>
      prev.map((item) => applyDragToItem(current, item, e.clientX, e.clientY, viewport))
    );
  }, []);

  const onPointerUp = useCallback(() => {
    if (dragRef.current.kind !== "none") {
      setDrag({ kind: "none" });
    }
  }, []);

  /** Force the machine back to idle (used when the host needs to clear state imperatively). */
  const reset = useCallback(() => {
    setDrag({ kind: "none" });
  }, []);

  return {
    drag,
    startMove,
    startResize,
    beginDraw,
    onPointerMove,
    onPointerUp,
    reset
  };
}
