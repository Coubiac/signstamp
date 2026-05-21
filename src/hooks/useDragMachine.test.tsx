import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { applyDragToItem, useDragMachine, type DragMode } from "./useDragMachine";
import type {
  ArrowItem,
  EllipseItem,
  Item,
  LineItem,
  TextItem
} from "../types";

// Identity viewport with scale 1 keeps the math simple in tests:
// PDF coords are equal to viewport coords. PDF +y is up, viewport +y is down,
// which `pxDeltaToPdfDelta` already handles via the sign flip.
const viewport = {
  scale: 1,
  width: 100,
  height: 100,
  convertToViewportPoint: (x: number, y: number) => [x, y],
  convertToPdfPoint: (x: number, y: number) => [x, y]
} as any;

function textItem(rect: { x: number; y: number; w: number; h: number }, id = "t1"): TextItem {
  return {
    id, type: "text", page: 1, rect, value: "x",
    fontSize: 12, color: "#000", fontFamily: "sans", bold: false, underline: false, strike: false
  };
}

describe("applyDragToItem", () => {
  it("returns the item unchanged when drag.kind is 'none'", () => {
    const item = textItem({ x: 0, y: 0, w: 10, h: 10 });
    expect(applyDragToItem({ kind: "none" }, item, 5, 5, viewport)).toBe(item);
  });

  it("returns the item unchanged when the drag id does not match", () => {
    const item = textItem({ x: 0, y: 0, w: 10, h: 10 }, "match");
    const drag: DragMode = {
      kind: "move", id: "other", page: 1, startX: 0, startY: 0,
      startRect: { x: 0, y: 0, w: 10, h: 10 }
    };
    expect(applyDragToItem(drag, item, 50, 50, viewport)).toBe(item);
  });

  it("moves a text item by the pointer delta (screen → PDF y is flipped)", () => {
    const item = textItem({ x: 10, y: 20, w: 30, h: 5 });
    const drag: DragMode = {
      kind: "move", id: "t1", page: 1, startX: 0, startY: 0,
      startRect: { ...item.rect }
    };
    // Drag the pointer down-right by (5, 3) in screen px.
    const updated = applyDragToItem(drag, item, 5, 3, viewport);
    expect(updated.rect.x).toBe(15);
    // Screen +3 down → PDF -3 (page coords are inverted).
    expect(updated.rect.y).toBe(17);
    expect(updated.rect.w).toBe(30);
    expect(updated.rect.h).toBe(5);
  });

  it("moves a line item by translating both endpoints", () => {
    const item: LineItem = {
      id: "l1", type: "line", page: 1, rect: { x: 0, y: 0, w: 10, h: 10 },
      start: { x: 0, y: 0 }, end: { x: 10, y: 10 },
      color: "#000", strokeWidth: 1
    };
    const drag: DragMode = {
      kind: "move", id: "l1", page: 1, startX: 0, startY: 0,
      startRect: { ...item.rect },
      startLine: { start: { x: 0, y: 0 }, end: { x: 10, y: 10 } }
    };
    const updated = applyDragToItem(drag, item, 4, 2, viewport) as LineItem;
    expect(updated.start).toEqual({ x: 4, y: -2 });
    expect(updated.end).toEqual({ x: 14, y: 8 });
  });

  it("resizes a text item with the top edge anchored (bottom-right handle)", () => {
    // start with x=0,y=10,w=20,h=10 → top edge in PDF is y+h = 20
    const item = textItem({ x: 0, y: 10, w: 20, h: 10 });
    const drag: DragMode = {
      kind: "resize", id: "t1", page: 1, startX: 0, startY: 0,
      startRect: { ...item.rect }
    };
    // Drag pointer down-right by (4, 5): width +4, height +5, top stays at 20.
    const updated = applyDragToItem(drag, item, 4, 5, viewport);
    expect(updated.rect.w).toBe(24);
    expect(updated.rect.h).toBe(15);
    // top must stay anchored
    expect(updated.rect.y + updated.rect.h).toBe(20);
  });

  it("respects the MIN_RESIZE_PDF floor when shrinking", () => {
    const item = textItem({ x: 0, y: 0, w: 5, h: 5 });
    const drag: DragMode = {
      kind: "resize", id: "t1", page: 1, startX: 0, startY: 0,
      startRect: { ...item.rect }
    };
    // Drag far to the up-left to shrink past zero.
    const updated = applyDragToItem(drag, item, -100, -100, viewport);
    expect(updated.rect.w).toBeGreaterThanOrEqual(10);
    expect(updated.rect.h).toBeGreaterThanOrEqual(10);
  });

  it("resizes an arrow by moving only the end point", () => {
    const item: ArrowItem = {
      id: "a1", type: "arrow", page: 1, rect: { x: 0, y: 0, w: 10, h: 10 },
      start: { x: 0, y: 0 }, end: { x: 10, y: 10 },
      color: "#000", strokeWidth: 1
    };
    const drag: DragMode = {
      kind: "resize", id: "a1", page: 1, startX: 0, startY: 0,
      startRect: { ...item.rect },
      startLine: { start: { x: 0, y: 0 }, end: { x: 10, y: 10 } }
    };
    const updated = applyDragToItem(drag, item, 2, 4, viewport) as ArrowItem;
    expect(updated.start).toEqual({ x: 0, y: 0 });
    expect(updated.end).toEqual({ x: 12, y: 6 });
  });

  it("draws a rectangular item by spanning startPdf to the current pointer", () => {
    const item: EllipseItem = {
      id: "e1", type: "ellipse", page: 1, rect: { x: 5, y: 5, w: 1, h: 1 },
      color: "#000", strokeWidth: 1
    };
    const drag: DragMode = {
      kind: "draw", id: "e1", page: 1, startX: 0, startY: 0,
      startPdf: { x: 5, y: 5 },
      overlayRect: { left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100, x: 0, y: 0, toJSON: () => "" } as DOMRect
    };
    // Pointer at (15, 25) in CSS → PDF (15, 25) via identity viewport.
    const updated = applyDragToItem(drag, item, 15, 25, viewport);
    expect(updated.rect.x).toBe(5);
    expect(updated.rect.y).toBe(5);
    expect(updated.rect.w).toBe(10);
    expect(updated.rect.h).toBe(20);
  });

  it("draws a line by anchoring `start` at startPdf and updating `end`", () => {
    const item: LineItem = {
      id: "l1", type: "line", page: 1, rect: { x: 5, y: 5, w: 1, h: 1 },
      start: { x: 5, y: 5 }, end: { x: 5, y: 5 },
      color: "#000", strokeWidth: 1
    };
    const drag: DragMode = {
      kind: "draw", id: "l1", page: 1, startX: 0, startY: 0,
      startPdf: { x: 5, y: 5 },
      overlayRect: { left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100, x: 0, y: 0, toJSON: () => "" } as DOMRect
    };
    const updated = applyDragToItem(drag, item, 12, 9, viewport) as LineItem;
    expect(updated.start).toEqual({ x: 5, y: 5 });
    expect(updated.end).toEqual({ x: 12, y: 9 });
  });
});

// --- useDragMachine hook smoke tests --------------------------------------

type HookHandle = ReturnType<typeof useDragMachine>;

function renderHook(initialDeps: Parameters<typeof useDragMachine>[0]) {
  let hookRef: HookHandle | null = null;
  let currentDeps = initialDeps;
  function Probe({ deps }: { deps: typeof initialDeps }) {
    hookRef = useDragMachine(deps);
    return null;
  }
  const utils = render(<Probe deps={initialDeps} />);
  return {
    ...utils,
    get current() { return hookRef!; },
    rerenderWith(next: typeof initialDeps) {
      currentDeps = next;
      utils.rerender(<Probe deps={currentDeps} />);
    }
  };
}

function fakePointerEvent(clientX: number, clientY: number, target = {}): any {
  return {
    clientX,
    clientY,
    pointerId: 1,
    currentTarget: { setPointerCapture: vi.fn(), ...target },
    preventDefault: vi.fn(),
    stopPropagation: vi.fn()
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("useDragMachine", () => {
  it("starts in the 'none' state", () => {
    const h = renderHook({
      items: [],
      pageViewports: [],
      pushHistory: vi.fn(),
      updateItemsNoRecord: vi.fn(),
      setSelectedId: vi.fn()
    });
    expect(h.current.drag.kind).toBe("none");
  });

  it("startMove transitions to 'move', pushes history and selects the item", () => {
    const item = textItem({ x: 1, y: 2, w: 3, h: 4 }, "the-id");
    const pushHistory = vi.fn();
    const setSelectedId = vi.fn();
    const h = renderHook({
      items: [item],
      pageViewports: [viewport],
      pushHistory,
      updateItemsNoRecord: vi.fn(),
      setSelectedId
    });
    act(() => { h.current.startMove("the-id", fakePointerEvent(10, 20)); });
    expect(h.current.drag.kind).toBe("move");
    expect(pushHistory).toHaveBeenCalledOnce();
    expect(setSelectedId).toHaveBeenCalledWith("the-id");
  });

  it("ignores startMove when the item id is unknown", () => {
    const setSelectedId = vi.fn();
    const h = renderHook({
      items: [],
      pageViewports: [viewport],
      pushHistory: vi.fn(),
      updateItemsNoRecord: vi.fn(),
      setSelectedId
    });
    act(() => { h.current.startMove("ghost", fakePointerEvent(0, 0)); });
    expect(h.current.drag.kind).toBe("none");
    expect(setSelectedId).not.toHaveBeenCalled();
  });

  it("onPointerUp returns the machine to 'none'", () => {
    const item = textItem({ x: 0, y: 0, w: 10, h: 10 });
    const h = renderHook({
      items: [item],
      pageViewports: [viewport],
      pushHistory: vi.fn(),
      updateItemsNoRecord: vi.fn(),
      setSelectedId: vi.fn()
    });
    act(() => { h.current.startMove(item.id, fakePointerEvent(0, 0)); });
    expect(h.current.drag.kind).toBe("move");
    act(() => { h.current.onPointerUp(); });
    expect(h.current.drag.kind).toBe("none");
  });

  it("onPointerMove applies the active drag transformation through updateItemsNoRecord", () => {
    const item = textItem({ x: 0, y: 10, w: 20, h: 10 });
    let nextItems: Item[] = [item];
    const updateItemsNoRecord = vi.fn((updater: (items: Item[]) => Item[]) => {
      nextItems = updater(nextItems);
    });
    const h = renderHook({
      items: [item],
      pageViewports: [viewport],
      pushHistory: vi.fn(),
      updateItemsNoRecord,
      setSelectedId: vi.fn()
    });

    act(() => { h.current.startMove(item.id, fakePointerEvent(0, 0)); });
    act(() => { h.current.onPointerMove(fakePointerEvent(5, 5)); });

    expect(updateItemsNoRecord).toHaveBeenCalledOnce();
    expect(nextItems[0].rect.x).toBe(5);
    // pointer +5 down (screen) → -5 in PDF y
    expect(nextItems[0].rect.y).toBe(5);
  });

  it("beginDraw enters 'draw' mode and selects the new item id", () => {
    const setSelectedId = vi.fn();
    const h = renderHook({
      items: [],
      pageViewports: [viewport],
      pushHistory: vi.fn(),
      updateItemsNoRecord: vi.fn(),
      setSelectedId
    });
    act(() => {
      h.current.beginDraw({
        id: "draw-id", page: 1, startX: 0, startY: 0,
        startPdf: { x: 5, y: 5 },
        overlayRect: { left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100, x: 0, y: 0, toJSON: () => "" } as DOMRect
      });
    });
    expect(h.current.drag.kind).toBe("draw");
    expect(setSelectedId).toHaveBeenCalledWith("draw-id");
  });
});
