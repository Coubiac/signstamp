import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";
import type { Item, SignatureAsset, Tool } from "./types";
import { exportFlattenedPdf } from "./pdf/exportPdf";
import { pdfRectToCss, pxDeltaToPdfDelta, pxSizeToPdfSize } from "./pdf/coords";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { detectLocale, formatLocaleDate, getDirection, makeTranslator } from "./i18n";
import {
  ArrowsOutCardinal,
  CalendarBlank,
  CheckSquareOffset,
  Eraser,
  FileArrowUp,
  FilePdf,
  FloppyDisk,
  Minus,
  Plus,
  Signature as SignatureIcon,
  TextT
} from "@phosphor-icons/react";

import { getDocument, GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf.mjs";
import workerSrc from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
import type { PDFDocumentProxy } from "pdfjs-dist/types/src/display/api";
import type { PageViewport } from "pdfjs-dist/types/src/display/display_utils";

GlobalWorkerOptions.workerSrc = workerSrc;

function uid() {
  return (globalThis.crypto?.randomUUID?.() ?? String(Date.now() + Math.random())).replace(/[^a-z0-9-]/gi, "");
}

async function fileToBytes(file: File): Promise<Uint8Array> {
  const buf = await file.arrayBuffer();
  return new Uint8Array(buf);
}

async function bytesToDataUrl(bytes: Uint8Array, mime: string): Promise<string> {
  const safeBytes = new Uint8Array(bytes);
  const blob = new Blob([safeBytes], { type: mime });
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function getImageNaturalSize(dataUrl: string): Promise<{ w: number; h: number }> {
  return await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = (e) => reject(e);
    img.src = dataUrl;
  });
}

type DragMode =
  | { kind: "none" }
  | { kind: "move"; id: string; page: number; startX: number; startY: number; startRect: { x: number; y: number; w: number; h: number } }
  | { kind: "resize"; id: string; page: number; startX: number; startY: number; startRect: { x: number; y: number; w: number; h: number } };

type StoredSignature = {
  id: string;
  name: string;
  mime: "image/png" | "image/jpeg";
  bytes: number[];
  naturalW: number;
  naturalH: number;
};

export default function App() {
  const pdfInputRef = useRef<HTMLInputElement | null>(null);
  const sigInputRef = useRef<HTMLInputElement | null>(null);

  const [tool, setTool] = useState<Tool>("pan");

  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.25);
  const [pageViewports, setPageViewports] = useState<PageViewport[]>([]);
  const [fileName, setFileName] = useState<string>("document.pdf");

  const [signatures, setSignatures] = useState<SignatureAsset[]>([]);
  const [selectedSignatureId, setSelectedSignatureId] = useState<string | null>(null);
  const didLoadSignatures = useRef(false);

  const [items, setItems] = useState<Item[]>([]);
  const [drag, setDrag] = useState<DragMode>({ kind: "none" });

  const itemsByPage = useMemo(() => {
    const map = new Map<number, Item[]>();
    for (const item of items) {
      const list = map.get(item.page) ?? [];
      list.push(item);
      map.set(item.page, list);
    }
    return map;
  }, [items]);

  const canvasRefs = useRef(new Map<number, HTMLCanvasElement>());
  const lang = detectLocale();
  const t = makeTranslator(lang);
  const pagesLabel = (count: number) => `${count} ${count === 1 ? t("pages_singular") : t("pages_plural")}`;

  const toolLabels: Record<Tool, string> = {
    pan: t("tool_pan"),
    text: t("tool_text"),
    date: t("tool_date"),
    check: t("tool_check"),
    sign: t("tool_sign")
  };

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = getDirection(lang);
  }, [lang]);

  useEffect(() => {
    const doc = pdfDoc;
    if (!doc) return;
    let cancelled = false;

    async function renderAllPages() {
      const viewports: PageViewport[] = [];

      for (let i = 1; i <= doc!.numPages; i += 1) {
        const p = await doc!.getPage(i);
        const vp = p.getViewport({ scale });
        viewports[i - 1] = vp;

        const canvas = canvasRefs.current.get(i);
        if (!canvas) continue;

        const ctx = canvas.getContext("2d");
        if (!ctx) continue;

        canvas.width = Math.floor(vp.width);
        canvas.height = Math.floor(vp.height);
        canvas.style.width = `${Math.floor(vp.width)}px`;
        canvas.style.height = `${Math.floor(vp.height)}px`;

        const renderTask = p.render({ canvasContext: ctx, viewport: vp });
        await renderTask.promise;
      }

      if (!cancelled) {
        setPageViewports(viewports);
      }
    }

    void renderAllPages();

    return () => {
      cancelled = true;
    };
  }, [pdfDoc, scale]);

  useEffect(() => {
    if (!isTauri()) return;
    let cancelled = false;

    async function loadSignatures() {
      try {
        const stored = await invoke<StoredSignature[]>("load_signatures");
        const hydrated = await Promise.all(stored.map(async (sig) => {
          const bytes = new Uint8Array(sig.bytes);
          const dataUrl = await bytesToDataUrl(bytes, sig.mime);
          return {
            id: sig.id,
            name: sig.name,
            mime: sig.mime,
            bytes,
            dataUrl,
            naturalW: sig.naturalW,
            naturalH: sig.naturalH
          } satisfies SignatureAsset;
        }));

        if (!cancelled) {
          setSignatures(hydrated);
          setSelectedSignatureId(hydrated[0]?.id ?? null);
        }
      } catch (err) {
        console.error("Load signatures failed:", err);
      } finally {
        didLoadSignatures.current = true;
      }
    }

    void loadSignatures();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isTauri()) return;
    if (!didLoadSignatures.current) return;

    const payload: StoredSignature[] = signatures.map(sig => ({
      id: sig.id,
      name: sig.name,
      mime: sig.mime,
      bytes: Array.from(sig.bytes),
      naturalW: sig.naturalW,
      naturalH: sig.naturalH
    }));

    void invoke("save_signatures", { signatures: payload }).catch(err => {
      console.error("Save signatures failed:", err);
    });
  }, [signatures]);

  async function openPdf(file: File) {
    const bytes = await fileToBytes(file);
    // pdf.js peut transférer le buffer vers le worker et le "neuter"
    // on garde donc une copie pour l'export
    setPdfBytes(bytes.slice(0));
    setFileName(file.name || "document.pdf");

    const loadingTask = getDocument({ data: bytes });
    const doc = await loadingTask.promise;
    setPdfDoc(doc);
    setNumPages(doc.numPages);
    setItems([]); // reset pour MVP
  }

  function onOverlayClick(e: ReactMouseEvent, pageNum: number) {
    const viewport = pageViewports[pageNum - 1];
    if (!viewport) return;
    if (e.target !== e.currentTarget) return;

    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const xPx = e.clientX - rect.left;
    const yPx = e.clientY - rect.top;

    function addTextItem(value: string, widthPx: number, heightPx: number, fontSize: number) {
      const [xPdf, yPdf] = viewport.convertToPdfPoint(xPx, yPx);
      const { wPdf, hPdf } = pxSizeToPdfSize(widthPx, heightPx, viewport);

      const id = uid();
      setItems(prev => prev.concat([{
        id,
        type: "text",
        page: pageNum,
        rect: { x: xPdf, y: yPdf - hPdf, w: wPdf, h: hPdf }, // ancrage: haut-gauche approx
        value,
        fontSize
      }]));
    }

    function addCheckItem() {
      const [xPdf, yPdf] = viewport.convertToPdfPoint(xPx, yPx);
      const { wPdf, hPdf } = pxSizeToPdfSize(22, 22, viewport);

      const id = uid();
      setItems(prev => prev.concat([{
        id,
        type: "check",
        page: pageNum,
        rect: { x: xPdf, y: yPdf - hPdf, w: wPdf, h: hPdf },
        value: "X",
        fontSize: 16
      }]));
    }

    // Outil texte
    if (tool === "text") {
      addTextItem(t("text_placeholder"), 220, 28, 12);
      return;
    }

    // Outil date
    if (tool === "date") {
      const now = new Date();
      addTextItem(formatLocaleDate(lang, now), 160, 26, 12);
      return;
    }

    // Outil croix
    if (tool === "check") {
      addCheckItem();
      return;
    }

    // Outil signature
    if (tool === "sign") {
      if (!selectedSignatureId) return;

      const sig = signatures.find(s => s.id === selectedSignatureId);
      if (!sig) return;

      const [xPdf, yPdf] = viewport.convertToPdfPoint(xPx, yPx);

      // taille par défaut en pixels, puis conversion en PDF
      const targetWPx = 220;
      const ratio = sig.naturalH > 0 ? sig.naturalW / sig.naturalH : 3;
      const targetHPx = Math.max(50, Math.round(targetWPx / Math.max(1, ratio)));

      const { wPdf, hPdf } = pxSizeToPdfSize(targetWPx, targetHPx, viewport);

      const id = uid();
      setItems(prev => prev.concat([{
        id,
        type: "signature",
        page: pageNum,
        rect: { x: xPdf - wPdf / 2, y: yPdf - hPdf / 2, w: wPdf, h: hPdf },
        signatureId: selectedSignatureId
      }]));
      return;
    }
  }

  function startMove(id: string, e: ReactPointerEvent) {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    const item = items.find(i => i.id === id);
    if (!item) return;
    if (!pageViewports[item.page - 1]) return;

    setDrag({
      kind: "move",
      id,
      page: item.page,
      startX: e.clientX,
      startY: e.clientY,
      startRect: { ...item.rect }
    });
  }

  function startResize(id: string, e: ReactPointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    const item = items.find(i => i.id === id);
    if (!item) return;
    if (!pageViewports[item.page - 1]) return;

    setDrag({
      kind: "resize",
      id,
      page: item.page,
      startX: e.clientX,
      startY: e.clientY,
      startRect: { ...item.rect }
    });
  }

  function onPointerMove(e: ReactPointerEvent) {
    if (drag.kind === "none") return;

    const viewport = pageViewports[drag.page - 1];
    if (!viewport) return;

    const dxPx = e.clientX - drag.startX;
    const dyPx = e.clientY - drag.startY;
    const { dxPdf, dyPdf } = pxDeltaToPdfDelta(dxPx, dyPx, viewport);

    setItems(prev => prev.map(it => {
      if (it.id !== drag.id) return it;

      if (drag.kind === "move") {
        return { ...it, rect: { ...it.rect, x: drag.startRect.x + dxPdf, y: drag.startRect.y + dyPdf } };
      }

      if (drag.kind === "resize") {
        // resize depuis coin bas-droite (simple)
        const newW = Math.max(10, drag.startRect.w + dxPdf);
        const newH = Math.max(10, drag.startRect.h - dyPdf); // dyPdf inversé vs écran
        return { ...it, rect: { ...it.rect, w: newW, h: newH } };
      }

      return it;
    }));
  }

  function onPointerUp() {
    if (drag.kind !== "none") setDrag({ kind: "none" });
  }

  function onDoubleClickText(id: string) {
    const value = window.prompt(t("text_prompt"), (items.find(i => i.id === id && i.type === "text") as any)?.value ?? "");
    if (value == null) return;
    setItems(prev => prev.map(i => i.id === id && i.type === "text" ? { ...i, value } : i));
  }

  async function importSignature(file: File) {
    const bytes = await fileToBytes(file);
    const mime = (file.type === "image/png" ? "image/png" : "image/jpeg") as "image/png" | "image/jpeg";
    const dataUrl = await bytesToDataUrl(bytes, mime);
    const { w, h } = await getImageNaturalSize(dataUrl);

    const asset: SignatureAsset = {
      id: uid(),
      name: file.name || "signature",
      mime,
      bytes,
      dataUrl,
      naturalW: w,
      naturalH: h
    };

    setSignatures(prev => [asset, ...prev]);
    setSelectedSignatureId(asset.id);
  }

  async function exportPdf() {
    if (!pdfBytes) return;

    const suggestedName = fileName.replace(/\.pdf$/i, "") + "-signed.pdf";

    const downloadBlob = (bytes: Uint8Array) => {
      const safeBytes = new Uint8Array(bytes);
      const blob = new Blob([safeBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = suggestedName;
      document.body.appendChild(a);
      a.click();
      a.remove();

      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    };

    let out: Uint8Array;
    try {
      out = await exportFlattenedPdf({
        originalPdfBytes: pdfBytes,
        items,
        signatures
      });
    } catch (err) {
      console.error("Export PDF (render) failed:", err);
      window.alert(t("export_failed"));
      return;
    }

    if (isTauri()) {
      try {
        const { save } = await import("@tauri-apps/plugin-dialog");
        const pickedPath = await save({
          defaultPath: suggestedName,
          filters: [{ name: "PDF", extensions: ["pdf"] }]
        });
        if (!pickedPath) return;

        const savedPath = await invoke<string>("save_pdf_to_path", {
          bytes: Array.from(out),
          path: pickedPath
        });
        window.alert(t("export_success").replace("{path}", savedPath));
        return;
      } catch (err) {
        console.error("Export PDF (Tauri) failed:", err);
        window.alert(t("export_tauri_failed"));
      }
    }

    downloadBlob(out);
  }

  const canEdit = Boolean(pdfDoc);
  const canSign = canEdit && signatures.length > 0;

  return (
    <div className="app" onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
      <header className="toolbar">
        <div className="toolbar-left">
          <button className="btn icon-btn" onClick={() => pdfInputRef.current?.click()} title={t("open_pdf")} aria-label={t("open_pdf")}>
            <FilePdf size={18} weight="regular" />
          </button>
          <span className="meta">{canEdit ? pagesLabel(numPages) : t("pages_singular")}</span>

          <span className="sep" />

          <button className="btn icon-btn" disabled={!canEdit} onClick={() => setScale(s => Math.max(0.5, Math.round((s - 0.1) * 100) / 100))} title={t("zoom_out")} aria-label={t("zoom_out")}>
            <Minus size={18} weight="regular" />
          </button>
          <span className="meta">{canEdit ? `${Math.round(scale * 100)}%` : "--"}</span>
          <button className="btn icon-btn" disabled={!canEdit} onClick={() => setScale(s => Math.min(4, Math.round((s + 0.1) * 100) / 100))} title={t("zoom_in")} aria-label={t("zoom_in")}>
            <Plus size={18} weight="regular" />
          </button>
        </div>

        <div className="toolbar-right">
          <div className="toolgroup">
            <button className={"btn tool-btn " + (tool === "pan" ? "active" : "")} disabled={!canEdit} onClick={() => setTool("pan")} title={t("tool_pan")} aria-label={t("tool_pan")}>
              <ArrowsOutCardinal size={18} weight="regular" />
            </button>
            <button className={"btn tool-btn " + (tool === "text" ? "active" : "")} disabled={!canEdit} onClick={() => setTool("text")} title={t("tool_text")} aria-label={t("tool_text")}>
              <TextT size={18} weight="regular" />
            </button>
            <button className={"btn tool-btn " + (tool === "date" ? "active" : "")} disabled={!canEdit} onClick={() => setTool("date")} title={t("tool_date")} aria-label={t("tool_date")}>
              <CalendarBlank size={18} weight="regular" />
            </button>
            <button className={"btn tool-btn " + (tool === "check" ? "active" : "")} disabled={!canEdit} onClick={() => setTool("check")} title={t("tool_check")} aria-label={t("tool_check")}>
              <CheckSquareOffset size={18} weight="regular" />
            </button>
            <button className={"btn tool-btn " + (tool === "sign" ? "active" : "")} disabled={!canSign} onClick={() => setTool("sign")} title={t("tool_sign")} aria-label={t("tool_sign")}>
              <SignatureIcon size={18} weight="regular" />
            </button>
          </div>

          <button className="btn icon-btn" onClick={() => sigInputRef.current?.click()} title={t("import_signature")} aria-label={t("import_signature")}>
            <FileArrowUp size={18} weight="regular" />
          </button>
          <button className="btn icon-btn" disabled={!canEdit || items.length === 0} onClick={() => setItems([])} title={t("clear_all")} aria-label={t("clear_all")}>
            <Eraser size={18} weight="regular" />
          </button>
          <button className="btn icon-btn primary" disabled={!canEdit} onClick={exportPdf} title={t("export_pdf")} aria-label={t("export_pdf")}>
            <FloppyDisk size={18} weight="regular" />
          </button>
        </div>

        <input
          ref={pdfInputRef}
          type="file"
          accept="application/pdf"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void openPdf(f);
            e.currentTarget.value = "";
          }}
        />

        <input
          ref={sigInputRef}
          type="file"
          accept="image/png,image/jpeg"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void importSignature(f);
            e.currentTarget.value = "";
          }}
        />
      </header>

      <main className="main">
        <aside className="side">
          <h3>{t("signatures")}</h3>
          {signatures.length === 0 ? (
            <p className="hint">{t("signatures_hint")}</p>
          ) : (
            <div className="siglist">
              {signatures.map(sig => (
                <button
                  key={sig.id}
                  className={"sigitem " + (sig.id === selectedSignatureId ? "selected" : "")}
                  onClick={() => setSelectedSignatureId(sig.id)}
                  title={sig.name}
                >
                  <img src={sig.dataUrl} alt={sig.name} />
                  <span>{sig.name}</span>
                </button>
              ))}
            </div>
          )}

          <div className="panel">
            <div className="row">
              <span className="label">{t("label_tool")}</span>
              <span className="value">{toolLabels[tool]}</span>
            </div>
            <div className="row">
              <span className="label">{t("label_objects")}</span>
              <span className="value">{items.length}</span>
            </div>
            <p className="hint">
              {t("hint_line1")}<br />
              {t("hint_line2")} {t("hint_line3")}
            </p>
          </div>
        </aside>

        <section className="viewer">
          {!pdfDoc ? (
            <div className="empty">
              <div className="empty-card">
                <h2>{t("app_title")}</h2>
                <p>{t("empty_hint")}</p>
                <button className="btn" onClick={() => pdfInputRef.current?.click()}>{t("empty_action")}</button>
              </div>
            </div>
          ) : (
            <div className="page-wrap">
              {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => {
                const viewport = pageViewports[pageNum - 1];
                const itemsOnPage = itemsByPage.get(pageNum) ?? [];

                return (
                  <div className="page-stage" key={pageNum}>
                    <canvas
                      ref={(el) => {
                        if (el) {
                          canvasRefs.current.set(pageNum, el);
                        } else {
                          canvasRefs.current.delete(pageNum);
                        }
                      }}
                    />
                    <div
                      className={"overlay " + (tool === "text" || tool === "date" ? "cursor-text" : tool === "sign" || tool === "check" ? "cursor-sign" : "cursor-pan")}
                      onClick={(e) => onOverlayClick(e, pageNum)}
                      aria-label="overlay"
                    >
                      {viewport && itemsOnPage.map(item => {
                        const css = pdfRectToCss(item.rect, viewport);

                        if (item.type === "signature") {
                          const sig = signatures.find(s => s.id === item.signatureId);
                          return (
                            <div
                              key={item.id}
                              className="overlay-item signature"
                              style={{ left: css.left, top: css.top, width: css.width, height: css.height }}
                              onPointerDown={(e) => startMove(item.id, e)}
                            >
                              {sig ? <img src={sig.dataUrl} alt="signature" draggable={false} /> : <div className="missing">?</div>}
                              <div className="handle" onPointerDown={(e) => startResize(item.id, e)} />
                            </div>
                          );
                        }

                        if (item.type === "check") {
                          return (
                            <div
                              key={item.id}
                              className="overlay-item check"
                              style={{ left: css.left, top: css.top, width: css.width, height: css.height }}
                              onPointerDown={(e) => startMove(item.id, e)}
                            >
                              <span style={{ fontSize: item.fontSize }}>{item.value}</span>
                              <div className="handle" onPointerDown={(e) => startResize(item.id, e)} />
                            </div>
                          );
                        }

                        // text
                        return (
                          <div
                            key={item.id}
                            className="overlay-item text"
                            style={{ left: css.left, top: css.top, width: css.width, height: css.height }}
                            onPointerDown={(e) => startMove(item.id, e)}
                            onDoubleClick={() => onDoubleClickText(item.id)}
                            title={t("edit_title")}
                          >
                            <span style={{ fontSize: item.fontSize }}>{item.value}</span>
                            <div className="handle" onPointerDown={(e) => startResize(item.id, e)} />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      <footer className="status">
        <span>
          {pdfDoc ? t("file_label").replace("{name}", fileName) : t("no_pdf")}
        </span>
        <span className="right">
          {pdfDoc ? t("export_note") : ""}
        </span>
      </footer>
    </div>
  );
}
