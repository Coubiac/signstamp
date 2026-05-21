import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { useState } from "react";
import { usePdfDocument } from "./usePdfDocument";

vi.mock("pdfjs-dist/legacy/build/pdf.mjs", () => ({
  getDocument: vi.fn(),
  GlobalWorkerOptions: {}
}));

vi.mock("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url", () => ({
  default: "fake-worker-url"
}));

// Re-import after the mock has been registered.
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

type FakeRenderTask = {
  promise: Promise<void>;
  cancel: ReturnType<typeof vi.fn>;
};

type FakePage = {
  getViewport: ReturnType<typeof vi.fn>;
  render: ReturnType<typeof vi.fn>;
  renderTasks: FakeRenderTask[];
};

function buildFakeDocument(numPages: number) {
  const pages: FakePage[] = [];
  for (let i = 0; i < numPages; i += 1) {
    const page: FakePage = {
      renderTasks: [],
      getViewport: vi.fn(({ scale }: { scale: number }) => ({
        width: 100 * scale,
        height: 200 * scale,
        scale
      })),
      render: vi.fn(() => {
        const task: FakeRenderTask = {
          promise: Promise.resolve(),
          cancel: vi.fn()
        };
        page.renderTasks.push(task);
        return task;
      })
    };
    pages.push(page);
  }
  return {
    numPages,
    pages,
    getPage: vi.fn(async (i: number) => pages[i - 1])
  };
}

type HostHandle = {
  pdfDoc: unknown;
  numPages: number;
  pageViewports: unknown[];
};

/**
 * Test harness that owns the canvas refs map exactly the way App.tsx
 * does in production, then exposes the hook's latest return value via
 * a ref so each test can assert against it.
 */
function renderHost(options: { initialBytes: Uint8Array | null; initialScale?: number }) {
  let latest: HostHandle = { pdfDoc: null, numPages: 0, pageViewports: [] };
  let setBytesFn: ((b: Uint8Array | null) => void) | null = null;
  let setScaleFn: ((n: number) => void) | null = null;

  function Probe() {
    const [bytes, setBytes] = useState<Uint8Array | null>(options.initialBytes);
    const [scale, setScale] = useState(options.initialScale ?? 1);
    setBytesFn = setBytes;
    setScaleFn = setScale;

    // Mounted canvas per page — keyed by 1-based page number to mimic App.tsx.
    // jsdom does not implement a 2D rendering context, so we stub it to a
    // truthy placeholder so the hook proceeds past its `if (!ctx) continue` guard.
    const [canvases] = useState<Map<number, HTMLCanvasElement>>(() => {
      const map = new Map<number, HTMLCanvasElement>();
      for (const pageNum of [1, 2, 3]) {
        const canvas = document.createElement("canvas");
        canvas.getContext = (() => ({})) as any;
        map.set(pageNum, canvas);
      }
      return map;
    });

    const result = usePdfDocument({
      bytes,
      scale,
      getCanvas: (pageNum) => canvases.get(pageNum) ?? null
    });
    latest = result;
    return null;
  }

  const utils = render(<Probe />);
  return {
    ...utils,
    get current() { return latest; },
    setBytes: (b: Uint8Array | null) => act(() => setBytesFn!(b)),
    setScale: (n: number) => act(() => setScaleFn!(n))
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  vi.mocked(getDocument).mockReset();
});

describe("usePdfDocument", () => {
  it("returns the null/empty state when bytes is null", async () => {
    const h = renderHost({ initialBytes: null });
    expect(h.current.pdfDoc).toBeNull();
    expect(h.current.numPages).toBe(0);
    expect(h.current.pageViewports).toEqual([]);
  });

  it("loads the document and publishes pdfDoc + numPages once bytes are provided", async () => {
    const fake = buildFakeDocument(3);
    vi.mocked(getDocument).mockReturnValue({ promise: Promise.resolve(fake) } as any);

    const h = renderHost({ initialBytes: new Uint8Array([1, 2, 3]) });
    await waitFor(() => expect(h.current.numPages).toBe(3));
    expect(h.current.pdfDoc).toBe(fake);
  });

  it("renders every page and populates pageViewports", async () => {
    const fake = buildFakeDocument(2);
    vi.mocked(getDocument).mockReturnValue({ promise: Promise.resolve(fake) } as any);

    const h = renderHost({ initialBytes: new Uint8Array([1, 2, 3]), initialScale: 2 });
    await waitFor(() => expect(h.current.pageViewports).toHaveLength(2));

    expect(fake.getPage).toHaveBeenCalledWith(1);
    expect(fake.getPage).toHaveBeenCalledWith(2);
    expect(fake.pages[0].render).toHaveBeenCalledOnce();
    expect(fake.pages[1].render).toHaveBeenCalledOnce();
    // viewport for scale 2 should report width 200 / height 400 per the fake getViewport
    const vp0 = h.current.pageViewports[0] as any;
    expect(vp0.width).toBe(200);
    expect(vp0.height).toBe(400);
  });

  it("re-renders the pages when scale changes and cancels the previous task", async () => {
    const fake = buildFakeDocument(1);
    // Make the first render task pending forever so we can observe the
    // cleanup's .cancel() call when scale changes. Subsequent calls
    // resolve normally.
    let callCount = 0;
    fake.pages[0].render = vi.fn(() => {
      callCount += 1;
      const task: FakeRenderTask = {
        promise: callCount === 1 ? new Promise(() => { /* never settles */ }) : Promise.resolve(),
        cancel: vi.fn()
      };
      fake.pages[0].renderTasks.push(task);
      return task;
    });
    vi.mocked(getDocument).mockReturnValue({ promise: Promise.resolve(fake) } as any);

    const h = renderHost({ initialBytes: new Uint8Array([1, 2, 3]), initialScale: 1 });
    await waitFor(() => expect(fake.pages[0].render).toHaveBeenCalledOnce());

    h.setScale(2);
    await waitFor(() => expect(fake.pages[0].render).toHaveBeenCalledTimes(2));
    // First task was still pending when scale changed → cleanup must have cancelled it.
    expect(fake.pages[0].renderTasks[0].cancel).toHaveBeenCalled();
  });

  it("swallows pdf.js RenderingCancelledException instead of surfacing it", async () => {
    const fake = buildFakeDocument(1);
    // First call : reject with a cancellation; second call (after re-render) : normal.
    let callCount = 0;
    fake.pages[0].render = vi.fn(() => {
      callCount += 1;
      if (callCount === 1) {
        const err = Object.assign(new Error("cancelled"), { name: "RenderingCancelledException" });
        return { promise: Promise.reject(err), cancel: vi.fn() };
      }
      return { promise: Promise.resolve(), cancel: vi.fn() };
    });
    vi.mocked(getDocument).mockReturnValue({ promise: Promise.resolve(fake) } as any);

    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const h = renderHost({ initialBytes: new Uint8Array([1, 2, 3]) });
    // Let the rejected render settle ; the effect must not blow up.
    await new Promise((r) => setTimeout(r, 10));
    expect(consoleError).not.toHaveBeenCalledWith(expect.stringContaining("PDF"), expect.anything());
    expect(h.current.pdfDoc).toBe(fake);
  });

  it("clears state when bytes go back to null", async () => {
    const fake = buildFakeDocument(2);
    vi.mocked(getDocument).mockReturnValue({ promise: Promise.resolve(fake) } as any);

    const h = renderHost({ initialBytes: new Uint8Array([1]) });
    await waitFor(() => expect(h.current.numPages).toBe(2));

    h.setBytes(null);
    await waitFor(() => expect(h.current.pdfDoc).toBeNull());
    expect(h.current.numPages).toBe(0);
    expect(h.current.pageViewports).toEqual([]);
  });

  it("logs (and recovers) when getDocument rejects", async () => {
    vi.mocked(getDocument).mockReturnValue({ promise: Promise.reject(new Error("boom")) } as any);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const h = renderHost({ initialBytes: new Uint8Array([1]) });
    await waitFor(() => expect(consoleError).toHaveBeenCalled());
    expect(h.current.pdfDoc).toBeNull();
  });
});
