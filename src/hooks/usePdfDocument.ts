import { useEffect, useRef, useState } from "react";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf.mjs";
import workerSrc from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
import type { PDFDocumentProxy } from "pdfjs-dist/types/src/display/api";
import type { PageViewport } from "pdfjs-dist/types/src/display/display_utils";

// pdf.js insists on a worker URL being configured before any document
// is opened. The hook owns this side effect so callers do not have to
// remember it ; the import is hoisted so the worker URL is set even
// when the hook itself has not been invoked yet.
GlobalWorkerOptions.workerSrc = workerSrc;

type Options = {
  /** Raw PDF bytes. When null, the hook releases any previously loaded document. */
  bytes: Uint8Array | null;
  /** Viewport scale used both for sizing the canvas and the overlay geometry. */
  scale: number;
  /**
   * Lookup function for the host's canvas refs. The hook calls this
   * during the render loop ; returning null skips rendering for that
   * page (e.g. when the canvas has not mounted yet — which never
   * happens in practice because React mounts all pages before our
   * useEffect runs, but we defend in depth).
   */
  getCanvas: (pageNum: number) => HTMLCanvasElement | null;
};

type Result = {
  pdfDoc: PDFDocumentProxy | null;
  numPages: number;
  /**
   * One viewport per page (1-indexed in PDF land, 0-indexed in the
   * array). Populated only after the corresponding render task has
   * resolved, so the array length grows from 0 to `numPages`.
   */
  pageViewports: PageViewport[];
};

/**
 * Manage the lifecycle of a pdf.js document: parse bytes, resolve a
 * `PDFDocumentProxy`, render every page to the host's canvases, and
 * publish per-page viewports for the overlay layer.
 *
 * Two effects keep the bookkeeping linear :
 *   1. `bytes` → load/unload the document.
 *   2. `pdfDoc` / `scale` → re-render the pages.
 *
 * Both effects cancel cleanly :
 *   - The bytes effect drops the document on unmount.
 *   - The render effect calls `.cancel()` on the in-flight pdf.js
 *     render task and walks out of the page loop between pages, so
 *     rapid zoom changes do not leave two render passes racing for
 *     the same canvas.
 */
export function usePdfDocument({ bytes, scale, getCanvas }: Options): Result {
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [pageViewports, setPageViewports] = useState<PageViewport[]>([]);

  // Keep the latest canvas lookup callable from the render effect
  // without making it a dependency (which would invalidate the
  // effect on every render and tear down in-flight render tasks).
  const getCanvasRef = useRef(getCanvas);
  getCanvasRef.current = getCanvas;

  useEffect(() => {
    if (!bytes) {
      setPdfDoc(null);
      setNumPages(0);
      setPageViewports([]);
      return;
    }
    let cancelled = false;

    (async () => {
      try {
        // Defense in depth : keep pdf.js from evaluating any embedded
        // JavaScript actions, fetching remote sub-resources or
        // expanding XFA forms. None of these are needed for our
        // "fill & sign" flow ; opting out shrinks the attack surface
        // a malicious PDF can exploit.
        const loadingTask = getDocument({
          data: bytes,
          isEvalSupported: false,
          disableAutoFetch: true,
          disableStream: true,
          enableXfa: false
        });
        const doc = await loadingTask.promise;
        if (cancelled) return;
        setPdfDoc(doc);
        setNumPages(doc.numPages);
      } catch (err) {
        console.error("PDF load failed:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [bytes]);

  useEffect(() => {
    const doc = pdfDoc;
    if (!doc) return;
    let cancelled = false;
    let activeRenderTask: { cancel: () => void } | null = null;

    async function renderAllPages() {
      const viewports: PageViewport[] = [];

      for (let i = 1; i <= doc!.numPages; i += 1) {
        if (cancelled) return;

        const page = await doc!.getPage(i);
        if (cancelled) return;

        const vp = page.getViewport({ scale });
        viewports[i - 1] = vp;

        const canvas = getCanvasRef.current(i);
        if (!canvas) continue;
        const ctx = canvas.getContext("2d");
        if (!ctx) continue;

        canvas.width = Math.floor(vp.width);
        canvas.height = Math.floor(vp.height);
        canvas.style.width = `${Math.floor(vp.width)}px`;
        canvas.style.height = `${Math.floor(vp.height)}px`;

        const task = page.render({ canvasContext: ctx, viewport: vp });
        activeRenderTask = task;
        try {
          await task.promise;
        } catch (err: any) {
          // pdf.js throws RenderingCancelledException when .cancel()
          // fires ; treat it as an expected unwind, not an error.
          if (err?.name === "RenderingCancelledException") return;
          throw err;
        } finally {
          if (activeRenderTask === task) activeRenderTask = null;
        }
      }

      if (!cancelled) setPageViewports(viewports);
    }

    void renderAllPages();

    return () => {
      cancelled = true;
      activeRenderTask?.cancel();
    };
  }, [pdfDoc, scale]);

  return { pdfDoc, numPages, pageViewports };
}
