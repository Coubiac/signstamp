import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { ItemOverlay, type TextEditingProps } from "./ItemOverlay";
import type {
  ArrowItem,
  CheckItem,
  EllipseItem,
  HighlightItem,
  Item,
  LineItem,
  SignatureAsset,
  SignatureItem,
  TextItem
} from "../../types";

// Minimal pdf.js PageViewport stub : the components only call
// scale, convertToViewportPoint and convertToPdfPoint (the latter
// is not used here but kept for completeness).
const viewport = {
  scale: 2,
  width: 800,
  height: 600,
  convertToViewportPoint: (x: number, y: number) => [x * 2, y * 2],
  convertToPdfPoint: (x: number, y: number) => [x / 2, y / 2]
} as any;

const noopMove = vi.fn();
const noopResize = vi.fn();

const defaultEditing: TextEditingProps = {
  isActive: false,
  value: "",
  placeholder: "Text...",
  title: "Double-click to edit",
  onStart: vi.fn(),
  onChange: vi.fn(),
  onCommit: vi.fn()
};

function renderItem(item: Item, options: { signatures?: SignatureAsset[]; editing?: Partial<TextEditingProps>; isSelected?: boolean } = {}) {
  return render(
    <ItemOverlay
      item={item}
      viewport={viewport}
      isSelected={options.isSelected ?? false}
      signatures={options.signatures ?? []}
      textEditing={{ ...defaultEditing, ...options.editing }}
      onStartMove={noopMove}
      onStartResize={noopResize}
    />
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ItemOverlay dispatcher", () => {
  it("renders a CheckOverlay for check items", () => {
    const item: CheckItem = {
      id: "1", type: "check", page: 1, rect: { x: 0, y: 0, w: 10, h: 10 },
      value: "X", fontSize: 16, color: "#000000"
    };
    const { container } = renderItem(item);
    expect(container.querySelector(".overlay-item.check")).not.toBeNull();
    expect(container.textContent).toContain("X");
  });

  it("renders an EllipseOverlay with the stored color and scaled stroke", () => {
    const item: EllipseItem = {
      id: "1", type: "ellipse", page: 1, rect: { x: 0, y: 0, w: 10, h: 10 },
      color: "#ff0000", strokeWidth: 3
    };
    const { container } = renderItem(item);
    const el = container.querySelector<HTMLDivElement>(".overlay-item.ellipse")!;
    expect(el.style.borderColor).toBe("rgb(255, 0, 0)");
    // viewport.scale = 2, so 3 PDF stroke -> 6 px on screen
    expect(el.style.borderWidth).toBe("6px");
  });

  it("renders a HighlightOverlay with rgba background", () => {
    const item: HighlightItem = {
      id: "1", type: "highlight", page: 1, rect: { x: 0, y: 0, w: 10, h: 10 },
      color: "#fde047"
    };
    const { container } = renderItem(item);
    const el = container.querySelector<HTMLDivElement>(".overlay-item.highlight")!;
    expect(el.style.background).toContain("rgba(253, 224, 71");
  });

  it("renders a SignatureOverlay with the resolved asset image", () => {
    const item: SignatureItem = {
      id: "1", type: "signature", page: 1, rect: { x: 0, y: 0, w: 10, h: 10 },
      signatureId: "sig-1"
    };
    const signatures: SignatureAsset[] = [{
      id: "sig-1", name: "John", mime: "image/png", bytes: new Uint8Array(),
      dataUrl: "data:image/png;base64,AAAA", naturalW: 200, naturalH: 80
    }];
    const { container } = renderItem(item, { signatures });
    const img = container.querySelector<HTMLImageElement>(".overlay-item.signature img")!;
    expect(img.src).toBe("data:image/png;base64,AAAA");
  });

  it("renders a placeholder when the signature asset has been deleted", () => {
    const item: SignatureItem = {
      id: "1", type: "signature", page: 1, rect: { x: 0, y: 0, w: 10, h: 10 },
      signatureId: "missing"
    };
    const { container } = renderItem(item, { signatures: [] });
    expect(container.querySelector(".overlay-item.signature .missing")).not.toBeNull();
    expect(container.querySelector(".overlay-item.signature img")).toBeNull();
  });

  it("positions the line handle on the end point, not the bounding box corner", () => {
    // Drawn from bottom-right to top-left in viewport space — handle
    // must sit on the visible end of the line.
    const item: LineItem = {
      id: "1", type: "line", page: 1, rect: { x: 0, y: 0, w: 1, h: 1 },
      start: { x: 30, y: 25 }, end: { x: 10, y: 5 },
      color: "#111111", strokeWidth: 2
    };
    const { container } = renderItem(item);
    const handle = container.querySelector<HTMLDivElement>(".overlay-item.line .handle")!;
    // viewport scales by 2, end (10, 5) projects to (20, 10);
    // bounding box starts at (20, 10) so end is at (0, 0) inside it.
    // HANDLE_HALF_PX = 7 → handle left/top should be -7.
    expect(handle.style.left).toBe("-7px");
    expect(handle.style.top).toBe("-7px");
    expect(handle.style.right).toBe("auto");
    expect(handle.style.bottom).toBe("auto");
  });

  it("renders an ArrowOverlay with a polygon arrowhead", () => {
    const item: ArrowItem = {
      id: "1", type: "arrow", page: 1, rect: { x: 0, y: 0, w: 10, h: 10 },
      start: { x: 0, y: 0 }, end: { x: 10, y: 10 },
      color: "#000000", strokeWidth: 2
    };
    const { container } = renderItem(item);
    expect(container.querySelector(".overlay-item.arrow polygon")).not.toBeNull();
  });

  it("renders a TextOverlay with the value when not editing", () => {
    const item: TextItem = {
      id: "1", type: "text", page: 1, rect: { x: 0, y: 0, w: 10, h: 10 },
      value: "Hello", fontSize: 14, color: "#000000",
      fontFamily: "sans", bold: false, underline: false, strike: false
    };
    const { container } = renderItem(item);
    expect(container.querySelector(".overlay-item.text")?.textContent).toContain("Hello");
    expect(container.querySelector("input")).toBeNull();
  });

  it("shows the editor input when text editing is active", () => {
    const item: TextItem = {
      id: "1", type: "text", page: 1, rect: { x: 0, y: 0, w: 10, h: 10 },
      value: "Hello", fontSize: 14, color: "#000000",
      fontFamily: "sans", bold: false, underline: false, strike: false
    };
    const { container } = renderItem(item, { editing: { isActive: true, value: "Hello" } });
    const input = container.querySelector<HTMLInputElement>(".overlay-item.text input")!;
    expect(input.value).toBe("Hello");
  });

  it("invokes onCommit(true) on Enter and onCommit(false) on Escape", () => {
    const onCommit = vi.fn();
    const item: TextItem = {
      id: "1", type: "text", page: 1, rect: { x: 0, y: 0, w: 10, h: 10 },
      value: "", fontSize: 14, color: "#000000",
      fontFamily: "sans", bold: false, underline: false, strike: false
    };
    const { container } = renderItem(item, { editing: { isActive: true, onCommit } });
    const input = container.querySelector<HTMLInputElement>(".overlay-item.text input")!;
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onCommit).toHaveBeenLastCalledWith(true);
    fireEvent.keyDown(input, { key: "Escape" });
    expect(onCommit).toHaveBeenLastCalledWith(false);
  });

  it("adds a .selected modifier when isSelected is true", () => {
    const item: CheckItem = {
      id: "1", type: "check", page: 1, rect: { x: 0, y: 0, w: 10, h: 10 },
      value: "X", fontSize: 16, color: "#000000"
    };
    const { container } = renderItem(item, { isSelected: true });
    expect(container.querySelector(".overlay-item.check.selected")).not.toBeNull();
  });
});
