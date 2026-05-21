import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";
import type { Item, SignatureAsset, Tool, TextItem } from "./types";
import { exportFlattenedPdf } from "./pdf/exportPdf";
import { pxSizeToPdfSize } from "./pdf/coords";
import {
  CHECK_DEFAULTS,
  DATE_DEFAULTS,
  HISTORY_LIMIT,
  OBJECT_URL_REVOKE_MS,
  PATH_REOPEN_DEBOUNCE_MS,
  SIGNATURE_DEFAULTS,
  TEXT_DEFAULTS,
  ZOOM
} from "./constants";
import { bytesToDataUrl, fileToBytes, getImageNaturalSize } from "./utils/file";
import { uid } from "./utils/uid";
import { ItemOverlay } from "./components/items/ItemOverlay";
import { useSnippets } from "./hooks/useSnippets";
import { useSignatures } from "./hooks/useSignatures";
import { useDragMachine } from "./hooks/useDragMachine";
import { usePdfDocument } from "./hooks/usePdfDocument";
import { useTextStyle } from "./hooks/useTextStyle";
import { useFormFields } from "./hooks/useFormFields";
import { FormFieldOverlay } from "./components/FormFieldOverlay";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { detectLocale, formatLocaleDate, getDirection, makeTranslator } from "./i18n";
import {
  ArrowsOutCardinal,
  ArrowCounterClockwise,
  ArrowRight,
  CalendarBlank,
  CheckSquareOffset,
  Circle,
  Eraser,
  FileArrowUp,
  FilePdf,
  FloppyDisk,
  Highlighter,
  Minus,
  Moon,
  Plus,
  Printer,
  Signature as SignatureIcon,
  Sun,
  TextB,
  TextStrikethrough,
  TextUnderline,
  Trash,
  TextT
} from "@phosphor-icons/react";


export default function App() {
  const pdfInputRef = useRef<HTMLInputElement | null>(null);
  const sigInputRef = useRef<HTMLInputElement | null>(null);
  const signatureCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [tool, setTool] = useState<Tool>("pan");

  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [scale, setScale] = useState<number>(ZOOM.default);
  const [fileName, setFileName] = useState<string>("document.pdf");

  const canvasRefs = useRef(new Map<number, HTMLCanvasElement>());

  const { pdfDoc, numPages, pageViewports } = usePdfDocument({
    bytes: pdfBytes,
    scale,
    getCanvas: (pageNum) => canvasRefs.current.get(pageNum) ?? null
  });

  const { fields: formFields, values: formValues, setValue: setFormValue } = useFormFields(pdfDoc);

  const [selectedSignatureId, setSelectedSignatureId] = useState<string | null>(null);
  const [signatures, setSignatures] = useSignatures({
    onInitialLoad: (loaded) => setSelectedSignatureId(loaded[0]?.id ?? null)
  });

  const [items, setItems] = useState<Item[]>([]);
  const [history, setHistory] = useState<Item[][]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [snippets, setSnippets] = useSnippets();
  const [snippetInput, setSnippetInput] = useState("");
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [isDrawingSignature, setIsDrawingSignature] = useState(false);
  const lastSignaturePoint = useRef<{ x: number; y: number } | null>(null);
  const [editingSignatureId, setEditingSignatureId] = useState<string | null>(null);
  const [editingSignatureName, setEditingSignatureName] = useState("");
  const [themeChoice, setThemeChoice] = useState<"light" | "dark">(() => {
    try {
      const stored = localStorage.getItem("signstamp.theme");
      if (stored === "light" || stored === "dark") return stored;
    } catch {
      // ignore storage errors
    }
    return "light";
  });
  const openedPdfPaths = useRef(new Set<string>());
  const overlayRefs = useRef(new Map<number, HTMLDivElement>());
  const snippetDrag = useRef<{ value: string; pointerId: number; lastX: number; lastY: number } | null>(null);
  const isMac = useMemo(
    () => typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.platform),
    []
  );

  const itemsByPage = useMemo(() => {
    const map = new Map<number, Item[]>();
    for (const item of items) {
      const list = map.get(item.page) ?? [];
      list.push(item);
      map.set(item.page, list);
    }
    return map;
  }, [items]);

  const formFieldsByPage = useMemo(() => {
    const map = new Map<number, typeof formFields>();
    for (const field of formFields) {
      const list = map.get(field.page) ?? [];
      list.push(field);
      map.set(field.page, list);
    }
    return map;
  }, [formFields]);

  const lang = detectLocale();
  const t = makeTranslator(lang);
  const pagesLabel = (count: number) => `${count} ${count === 1 ? t("pages_singular") : t("pages_plural")}`;

  const toolLabels: Record<Tool, string> = {
    pan: t("tool_pan"),
    text: t("tool_text"),
    date: t("tool_date"),
    check: t("tool_check"),
    ellipse: t("tool_ellipse"),
    line: t("tool_line"),
    arrow: t("tool_arrow"),
    highlight: t("tool_highlight"),
    sign: t("tool_sign")
  };

  const [inkColor, setInkColor] = useState("#111111");
  const highlightDefault = "#fde047";
  const inkOptions = [
    { value: "#111111", label: t("color_black") },
    { value: "#1d4ed8", label: t("color_blue") },
    { value: "#dc2626", label: t("color_red") },
    { value: "#16a34a", label: t("color_green") }
  ];
  const [drawStrokeWidth, setDrawStrokeWidth] = useState(1.5);
  const [textStyle, updateTextStyle] = useTextStyle();

  const fontOptions = [
    { value: "sans" as const, label: t("font_sans") },
    { value: "serif" as const, label: t("font_serif") },
    { value: "mono" as const, label: t("font_mono") }
  ];

  const sizeOptions = [10, 12, 14, 16, 18, 22, 26, 32];
  const selectedItem = selectedId ? items.find(item => item.id === selectedId) : null;
  const selectedSupportsColor = Boolean(
    selectedItem && (selectedItem.type === "text" || selectedItem.type === "check" || selectedItem.type === "ellipse" || selectedItem.type === "line" || selectedItem.type === "arrow" || selectedItem.type === "highlight")
  );
  const selectedSupportsStroke = Boolean(
    selectedItem && (selectedItem.type === "ellipse" || selectedItem.type === "line" || selectedItem.type === "arrow")
  );
  const textControlsActive = tool === "text" || tool === "date" || (selectedItem?.type === "text");
  const strokeControlsActive = tool === "ellipse" || tool === "line" || tool === "arrow" || selectedSupportsStroke;

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = getDirection(lang);
  }, [lang]);

  useEffect(() => {
    try {
      localStorage.setItem("signstamp.theme", themeChoice);
    } catch {
      // ignore storage errors
    }
  }, [themeChoice]);

  useEffect(() => {
    document.documentElement.dataset.theme = themeChoice;
  }, [themeChoice]);

  useEffect(() => {
    if (!showSignaturePad) return;
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111111";
    ctx.lineWidth = 2;
    ctx.clearRect(0, 0, rect.width, rect.height);
  }, [showSignaturePad]);

  useEffect(() => {
    if (!selectedItem) return;
    if (selectedItem.type === "text") {
      updateTextStyle({
        fontSize: selectedItem.fontSize,
        fontFamily: selectedItem.fontFamily ?? "sans",
        bold: Boolean(selectedItem.bold),
        underline: Boolean(selectedItem.underline),
        strike: Boolean(selectedItem.strike)
      });
    }
    if (selectedItem.type === "ellipse" || selectedItem.type === "line" || selectedItem.type === "arrow") {
      setDrawStrokeWidth(selectedItem.strokeWidth);
    }
  }, [selectedItem, updateTextStyle]);

  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: (() => void) | null = null;
    let cancelled = false;

    async function initOpenListener() {
      try {
        unlisten = await listen<{ path: string }>("open-pdf", (event) => {
          if (!event.payload?.path) return;
          openPdfPathOnce(event.payload.path);
        });
      } catch (err) {
        console.error("Open PDF listener failed:", err);
      }

      try {
        const pending = await invoke<string[]>("take_pending_open_paths");
        if (!cancelled) {
          pending.forEach(openPdfPathOnce);
        }
      } catch (err) {
        console.error("Load pending open paths failed:", err);
      }
    }

    void initOpenListener();

    return () => {
      cancelled = true;
      if (unlisten) unlisten();
    };
  }, []);


  function pushHistory(snapshot: Item[]) {
    setHistory(prev => {
      const next = prev.concat([snapshot]);
      return next.length > HISTORY_LIMIT ? next.slice(next.length - HISTORY_LIMIT) : next;
    });
  }

  function updateItems(
    updater: Item[] | ((prev: Item[]) => Item[]),
    options: { record?: boolean } = {}
  ) {
    const { record = true } = options;
    setItems(prev => {
      if (record) pushHistory(prev);
      return typeof updater === "function" ? updater(prev) : updater;
    });
  }

  function appendItem(item: Item, record = true) {
    updateItems(prev => prev.concat([item]), { record });
  }

  const {
    drag,
    startMove,
    startResize,
    beginDraw,
    onPointerMove: handleDragPointerMove,
    onPointerUp: handleDragPointerUp,
    reset: resetDrag
  } = useDragMachine({
    items,
    pageViewports,
    pushHistory: () => pushHistory(items),
    updateItemsNoRecord: (updater) => updateItems(updater, { record: false }),
    setSelectedId
  });

  function undoLast() {
    setHistory(prev => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setItems(last);
      resetDrag();
      setEditingId(null);
      setEditingValue("");
      setSelectedId(null);
      return prev.slice(0, -1);
    });
  }

  function startEditingText(id: string) {
    const item = items.find((i): i is TextItem => i.id === id && i.type === "text");
    if (!item || item.type !== "text") return;
    setEditingId(id);
    setEditingValue(item.value);
  }

  function commitEditing(apply: boolean) {
    if (!editingId) return;
    const current = items.find((i): i is TextItem => i.id === editingId && i.type === "text");
    const trimmed = editingValue.trim();
    const shouldRemove = current && current.type === "text" && trimmed.length === 0 && current.value.trim().length === 0;

    if (shouldRemove) {
      updateItems(prev => prev.filter(i => i.id !== editingId), { record: true });
      setTool("pan");
      setSelectedId(null);
    } else if (apply && current && current.value !== editingValue) {
      updateItems(prev => prev.map(i => i.id === editingId && i.type === "text"
        ? { ...i, value: editingValue }
        : i), { record: true });
    }
    setEditingId(null);
    setEditingValue("");
  }

  function deleteSelected() {
    if (!selectedId) return;
    updateItems(prev => prev.filter(i => i.id !== selectedId), { record: true });
    if (editingId === selectedId) {
      setEditingId(null);
      setEditingValue("");
    }
    setSelectedId(null);
    resetDrag();
  }

  function openPdfBytes(bytes: Uint8Array, name: string) {
    // pdf.js can transfer the buffer to its worker thread and "neuter"
    // the source view ; keep a defensive copy for the export pipeline.
    setPdfBytes(bytes.slice(0));
    setFileName(name || "document.pdf");
    setItems([]);
    setHistory([]);
    setEditingId(null);
    setEditingValue("");
    setSelectedId(null);
    resetDrag();
  }

  async function openPdf(file: File) {
    const bytes = await fileToBytes(file);
    openPdfBytes(bytes, file.name || "document.pdf");
  }

  type LoadedPdfPayload = { bytes: number[]; name: string };

  async function openPdfFromPath(path: string) {
    const payload = await invoke<LoadedPdfPayload>("load_pdf_from_path", { path });
    const bytes = new Uint8Array(payload.bytes);
    openPdfBytes(bytes, payload.name);
  }

  function openPdfPathOnce(path: string) {
    const key = path.trim();
    if (!key) return;
    if (openedPdfPaths.current.has(key)) return;
    openedPdfPaths.current.add(key);
    window.setTimeout(() => openedPdfPaths.current.delete(key), PATH_REOPEN_DEBOUNCE_MS);
    void openPdfFromPath(path).catch((err) => {
      console.error("Open PDF from path failed:", err);
    });
  }

  function findOverlayAt(x: number, y: number) {
    for (const [pageNum, el] of overlayRefs.current.entries()) {
      const rect = el.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        return { pageNum, rect };
      }
    }
    return null;
  }

  function startSnippetDrag(e: ReactPointerEvent, value: string) {
    if (!isMac) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    snippetDrag.current = {
      value,
      pointerId: e.pointerId,
      lastX: e.clientX,
      lastY: e.clientY
    };
    document.body.style.cursor = "copy";
  }

  function finishSnippetDrag() {
    const active = snippetDrag.current;
    if (!active) return;
    snippetDrag.current = null;
    document.body.style.cursor = "";
    if (!canEdit) return;
    const hit = findOverlayAt(active.lastX, active.lastY);
    if (!hit) return;
    addTextAt(
      hit.pageNum,
      active.lastX - hit.rect.left,
      active.lastY - hit.rect.top,
      active.value,
      false
    );
  }

  function onOverlayClick(e: ReactMouseEvent, pageNum: number) {
    const viewport = pageViewports[pageNum - 1];
    if (!viewport) return;
    if (e.target !== e.currentTarget) return;

    if (tool === "ellipse" || tool === "line" || tool === "arrow" || tool === "highlight") return;

    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const xPx = e.clientX - rect.left;
    const yPx = e.clientY - rect.top;

    function addTextItem(value: string, widthPx: number, heightPx: number, fontSize: number, startEditing = false) {
      const [xPdf, yPdf] = viewport.convertToPdfPoint(xPx, yPx);
      const { wPdf, hPdf } = pxSizeToPdfSize(widthPx, heightPx, viewport);

      const id = uid();
      appendItem({
        id,
        type: "text",
        page: pageNum,
        rect: { x: xPdf, y: yPdf - hPdf, w: wPdf, h: hPdf }, // ancrage: haut-gauche approx
        value,
        fontSize,
        color: inkColor,
        fontFamily: textStyle.fontFamily,
        bold: textStyle.bold,
        underline: textStyle.underline,
        strike: textStyle.strike
      });
      if (startEditing) {
        setEditingId(id);
        setEditingValue(value);
      }
      setSelectedId(id);
    }

    function addCheckItem() {
      const [xPdf, yPdf] = viewport.convertToPdfPoint(xPx, yPx);
      const { wPdf, hPdf } = pxSizeToPdfSize(CHECK_DEFAULTS.sizePx, CHECK_DEFAULTS.sizePx, viewport);

      const id = uid();
      appendItem({
        id,
        type: "check",
        page: pageNum,
        rect: { x: xPdf, y: yPdf - hPdf, w: wPdf, h: hPdf },
        value: "X",
        fontSize: CHECK_DEFAULTS.fontSize,
        color: inkColor
      });
      setSelectedId(id);
    }

    // Outil texte
    if (tool === "text") {
      addTextItem("", TEXT_DEFAULTS.widthPx, TEXT_DEFAULTS.heightPx, textStyle.fontSize, true);
      return;
    }

    // Outil date
    if (tool === "date") {
      const now = new Date();
      addTextItem(formatLocaleDate(lang, now), DATE_DEFAULTS.widthPx, DATE_DEFAULTS.heightPx, textStyle.fontSize);
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
      const targetWPx = SIGNATURE_DEFAULTS.widthPx;
      const ratio = sig.naturalH > 0 ? sig.naturalW / sig.naturalH : 3;
      const targetHPx = Math.max(SIGNATURE_DEFAULTS.minHeightPx, Math.round(targetWPx / Math.max(1, ratio)));

      const { wPdf, hPdf } = pxSizeToPdfSize(targetWPx, targetHPx, viewport);

      const id = uid();
      appendItem({
        id,
        type: "signature",
        page: pageNum,
        rect: { x: xPdf - wPdf / 2, y: yPdf - hPdf / 2, w: wPdf, h: hPdf },
        signatureId: selectedSignatureId
      });
      setSelectedId(id);
      setTool("pan");
      return;
    }
  }

  function startDraw(e: ReactPointerEvent, pageNum: number) {
    if (!(tool === "ellipse" || tool === "line" || tool === "arrow" || tool === "highlight")) return;
    const viewport = pageViewports[pageNum - 1];
    if (!viewport) return;
    if (e.target !== e.currentTarget) return;

    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const xPx = e.clientX - rect.left;
    const yPx = e.clientY - rect.top;
    const [xPdf, yPdf] = viewport.convertToPdfPoint(xPx, yPx);
    const id = uid();
    const baseRect = { x: xPdf, y: yPdf, w: 1, h: 1 };

    if (tool === "ellipse") {
      appendItem({ id, type: "ellipse", page: pageNum, rect: baseRect, color: inkColor, strokeWidth: drawStrokeWidth });
    } else if (tool === "line") {
      const start = { x: xPdf, y: yPdf };
      appendItem({ id, type: "line", page: pageNum, rect: baseRect, start, end: start, color: inkColor, strokeWidth: drawStrokeWidth });
    } else if (tool === "arrow") {
      const start = { x: xPdf, y: yPdf };
      appendItem({ id, type: "arrow", page: pageNum, rect: baseRect, start, end: start, color: inkColor, strokeWidth: drawStrokeWidth });
    } else if (tool === "highlight") {
      appendItem({ id, type: "highlight", page: pageNum, rect: baseRect, color: highlightDefault });
    }

    beginDraw({
      id,
      page: pageNum,
      startX: e.clientX,
      startY: e.clientY,
      startPdf: { x: xPdf, y: yPdf },
      overlayRect: rect
    });
  }

  function onPointerMove(e: ReactPointerEvent) {
    if (snippetDrag.current) {
      snippetDrag.current.lastX = e.clientX;
      snippetDrag.current.lastY = e.clientY;
      return;
    }
    handleDragPointerMove(e);
  }

  function onPointerUp() {
    if (snippetDrag.current) {
      finishSnippetDrag();
      return;
    }
    handleDragPointerUp();
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

  async function addSignatureFromBytes(bytes: Uint8Array, name: string) {
    const mime = "image/png" as const;
    const dataUrl = await bytesToDataUrl(bytes, mime);
    const { w, h } = await getImageNaturalSize(dataUrl);

    const asset: SignatureAsset = {
      id: uid(),
      name,
      mime,
      bytes,
      dataUrl,
      naturalW: w,
      naturalH: h
    };

    setSignatures(prev => [asset, ...prev]);
    setSelectedSignatureId(asset.id);
  }

  function startRenameSignature(sig: SignatureAsset) {
    setEditingSignatureId(sig.id);
    setEditingSignatureName(sig.name);
  }

  function commitRenameSignature(apply: boolean) {
    if (!editingSignatureId) return;
    const trimmed = editingSignatureName.trim();
    if (apply && trimmed) {
      setSignatures(prev => prev.map(sig => sig.id === editingSignatureId ? { ...sig, name: trimmed } : sig));
    }
    setEditingSignatureId(null);
    setEditingSignatureName("");
  }

  function clearSignaturePad() {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  function isSignatureBlank(): boolean {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return true;
    const ctx = canvas.getContext("2d");
    if (!ctx) return true;
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 3; i < img.data.length; i += 4) {
      if (img.data[i] !== 0) return false;
    }
    return true;
  }

  function onSignaturePointerDown(e: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    lastSignaturePoint.current = { x, y };
    setIsDrawingSignature(true);
    ctx.beginPath();
    ctx.moveTo(x, y);
    (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
  }

  function onSignaturePointerMove(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (!isDrawingSignature) return;
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const last = lastSignaturePoint.current;
    if (!last) return;
    ctx.lineTo(x, y);
    ctx.stroke();
    lastSignaturePoint.current = { x, y };
  }

  function onSignaturePointerUp(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (!isDrawingSignature) return;
    e.preventDefault();
    setIsDrawingSignature(false);
    lastSignaturePoint.current = null;
    (e.currentTarget as HTMLCanvasElement).releasePointerCapture(e.pointerId);
  }

  async function saveSignatureDrawing() {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    if (isSignatureBlank()) {
      window.alert(t("signature_empty"));
      return;
    }

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) return;
    const buf = await blob.arrayBuffer();
    const bytes = new Uint8Array(buf);
    const name = `signature-drawn-${new Date().toISOString().slice(0, 10)}.png`;
    await addSignatureFromBytes(bytes, name);
    setShowSignaturePad(false);
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

      setTimeout(() => URL.revokeObjectURL(url), OBJECT_URL_REVOKE_MS);
    };

    let out: Uint8Array;
    try {
      out = await exportFlattenedPdf({
        originalPdfBytes: pdfBytes,
        items,
        signatures,
        formValues
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

  async function printPdf() {
    if (!pdfBytes) return;
    try {
      await Promise.resolve(window.print());
    } catch (err) {
      console.error("Print failed:", err);
      window.alert(t("print_failed"));
    }
  }

  function addSnippet(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (snippets.includes(trimmed)) return;
    setSnippets(prev => [trimmed, ...prev]);
  }

  function removeSnippet(value: string) {
    setSnippets(prev => prev.filter(entry => entry !== value));
  }


  function updateSelectedText(partial: Partial<TextItem>) {
    if (!selectedId || selectedItem?.type !== "text") return;
    updateItems(prev => prev.map(item => item.id === selectedId && item.type === "text"
      ? { ...item, ...partial }
      : item), { record: true });
  }

  function updateSelectedStroke(width: number) {
    if (!selectedId || !selectedSupportsStroke) return;
    updateItems(prev => prev.map(item => {
      if (item.id !== selectedId) return item;
      if (item.type === "ellipse" || item.type === "line" || item.type === "arrow") {
        return { ...item, strokeWidth: width };
      }
      return item;
    }), { record: true });
  }

  function addTextAt(pageNum: number, xPx: number, yPx: number, value: string, startEditing = false) {
    const viewport = pageViewports[pageNum - 1];
    if (!viewport) return;

    const [xPdf, yPdf] = viewport.convertToPdfPoint(xPx, yPx);
    const { wPdf, hPdf } = pxSizeToPdfSize(TEXT_DEFAULTS.widthPx, TEXT_DEFAULTS.heightPx, viewport);
    const id = uid();
    appendItem({
      id,
      type: "text",
      page: pageNum,
      rect: { x: xPdf, y: yPdf - hPdf, w: wPdf, h: hPdf },
      value,
      fontSize: textStyle.fontSize,
      color: inkColor,
      fontFamily: textStyle.fontFamily,
      bold: textStyle.bold,
      underline: textStyle.underline,
      strike: textStyle.strike
    });
    setSelectedId(id);
    if (startEditing) {
      setEditingId(id);
      setEditingValue(value);
    }
  }

  function onSnippetDrop(e: React.DragEvent<HTMLDivElement>, pageNum: number) {
    const text = (
      e.dataTransfer.getData("application/x-signstamp-snippet")
      || e.dataTransfer.getData("text/plain")
      || e.dataTransfer.getData("text")
    ).trim();
    if (!text) return;
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    addTextAt(pageNum, e.clientX - rect.left, e.clientY - rect.top, text, false);
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

          <button className="btn icon-btn" disabled={!canEdit} onClick={() => setScale(s => Math.max(ZOOM.min, Math.round((s - ZOOM.step) * 100) / 100))} title={t("zoom_out")} aria-label={t("zoom_out")}>
            <Minus size={18} weight="regular" />
          </button>
          <span className="meta">{canEdit ? `${Math.round(scale * 100)}%` : "--"}</span>
          <button className="btn icon-btn" disabled={!canEdit} onClick={() => setScale(s => Math.min(ZOOM.max, Math.round((s + ZOOM.step) * 100) / 100))} title={t("zoom_in")} aria-label={t("zoom_in")}>
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
            <button className={"btn tool-btn " + (tool === "ellipse" ? "active" : "")} disabled={!canEdit} onClick={() => setTool("ellipse")} title={t("tool_ellipse")} aria-label={t("tool_ellipse")}>
              <Circle size={18} weight="regular" />
            </button>
            <button className={"btn tool-btn " + (tool === "line" ? "active" : "")} disabled={!canEdit} onClick={() => setTool("line")} title={t("tool_line")} aria-label={t("tool_line")}>
              <Minus size={18} weight="regular" />
            </button>
            <button className={"btn tool-btn " + (tool === "arrow" ? "active" : "")} disabled={!canEdit} onClick={() => setTool("arrow")} title={t("tool_arrow")} aria-label={t("tool_arrow")}>
              <ArrowRight size={18} weight="regular" />
            </button>
            <button className={"btn tool-btn " + (tool === "highlight" ? "active" : "")} disabled={!canEdit} onClick={() => setTool("highlight")} title={t("tool_highlight")} aria-label={t("tool_highlight")}>
              <Highlighter size={18} weight="regular" />
            </button>
            <button className={"btn tool-btn " + (tool === "sign" ? "active" : "")} disabled={!canSign} onClick={() => setTool("sign")} title={t("tool_sign")} aria-label={t("tool_sign")}>
              <SignatureIcon size={18} weight="regular" />
            </button>
          </div>

          <div className="ink-group" role="group" aria-label={t("ink_label")}>
            {inkOptions.map(option => (
              <button
                key={option.value}
                className={"btn ink-btn " + (inkColor === option.value ? "active" : "")}
                style={{ color: option.value }}
                onClick={() => {
                  setInkColor(option.value);
                  if (selectedSupportsColor && selectedId) {
                    updateItems(prev => prev.map(item => item.id === selectedId && "color" in item
                      ? { ...item, color: option.value }
                      : item), { record: true });
                  }
                }}
                title={option.label}
                aria-label={option.label}
                disabled={!canEdit}
              >
                <span className="ink-dot" />
              </button>
            ))}
          </div>

          {strokeControlsActive && (
            <div className="stroke-group" role="group" aria-label={t("stroke_label")}>
              <span className="stroke-label">{t("stroke_label")}</span>
              <input
                type="range"
                min={1}
                max={10}
                step={0.5}
                value={drawStrokeWidth}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  setDrawStrokeWidth(next);
                  updateSelectedStroke(next);
                }}
                disabled={!canEdit}
              />
              <span className="stroke-value">{drawStrokeWidth.toFixed(1)}</span>
            </div>
          )}

          {textControlsActive && (
            <div className="text-group" role="group" aria-label={t("font_label")}>
              <select
                className="text-select"
                value={textStyle.fontFamily}
                onChange={(e) => {
                  const next = e.target.value as "sans" | "serif" | "mono";
                  updateTextStyle({ fontFamily: next });
                  updateSelectedText({ fontFamily: next });
                }}
                disabled={!canEdit}
                aria-label={t("font_label")}
              >
                {fontOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <select
                className="text-select"
                value={textStyle.fontSize}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  updateTextStyle({ fontSize: next });
                  updateSelectedText({ fontSize: next });
                }}
                disabled={!canEdit}
                aria-label={t("size_label")}
              >
                {sizeOptions.map(size => (
                  <option key={size} value={size}>{size}px</option>
                ))}
              </select>
              <button
                className={"btn icon-btn" + (textStyle.bold ? " active" : "")}
                onClick={() => {
                  const next = !textStyle.bold;
                  updateTextStyle({ bold: next });
                  updateSelectedText({ bold: next });
                }}
                title={t("bold")}
                aria-label={t("bold")}
                disabled={!canEdit}
              >
                <TextB size={18} weight="regular" />
              </button>
              <button
                className={"btn icon-btn" + (textStyle.underline ? " active" : "")}
                onClick={() => {
                  const next = !textStyle.underline;
                  updateTextStyle({ underline: next });
                  updateSelectedText({ underline: next });
                }}
                title={t("underline")}
                aria-label={t("underline")}
                disabled={!canEdit}
              >
                <TextUnderline size={18} weight="regular" />
              </button>
              <button
                className={"btn icon-btn" + (textStyle.strike ? " active" : "")}
                onClick={() => {
                  const next = !textStyle.strike;
                  updateTextStyle({ strike: next });
                  updateSelectedText({ strike: next });
                }}
                title={t("strike")}
                aria-label={t("strike")}
                disabled={!canEdit}
              >
                <TextStrikethrough size={18} weight="regular" />
              </button>
            </div>
          )}

          <button
            className="btn icon-btn"
            disabled={!canEdit || history.length === 0}
            onClick={undoLast}
            title={t("undo")}
            aria-label={t("undo")}
          >
            <ArrowCounterClockwise size={18} weight="regular" />
          </button>
          <button
            className="btn icon-btn"
            disabled={!canEdit || !selectedId}
            onClick={deleteSelected}
            title={t("delete")}
            aria-label={t("delete")}
          >
            <Eraser size={18} weight="regular" />
          </button>
          <button
            className="btn icon-btn danger"
            disabled={!canEdit || items.length === 0}
            onClick={() => updateItems([], { record: true })}
            title={t("clear_all")}
            aria-label={t("clear_all")}
          >
            <Trash size={18} weight="regular" />
          </button>
          <button
            className="btn icon-btn"
            onClick={() => {
              const next = themeChoice === "dark" ? "light" : "dark";
              setThemeChoice(next);
            }}
            title={themeChoice === "dark" ? t("theme_light") : t("theme_dark")}
            aria-label={themeChoice === "dark" ? t("theme_light") : t("theme_dark")}
          >
            {themeChoice === "dark" ? <Sun size={18} weight="regular" /> : <Moon size={18} weight="regular" />}
          </button>
          <button className="btn icon-btn" disabled={!canEdit} onClick={printPdf} title={t("print_pdf")} aria-label={t("print_pdf")}>
            <Printer size={18} weight="regular" />
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
                <div
                  key={sig.id}
                  className={"sigitem " + (sig.id === selectedSignatureId ? "selected" : "")}
                  title={sig.name}
                >
                  <button
                    className="sigitem-body"
                    onClick={() => setSelectedSignatureId(sig.id)}
                    onDoubleClick={() => startRenameSignature(sig)}
                  >
                    <img src={sig.dataUrl} alt={sig.name} />
                    {editingSignatureId === sig.id ? (
                      <input
                        className="sigitem-input"
                        value={editingSignatureName}
                        onChange={(e) => setEditingSignatureName(e.target.value)}
                        onBlur={() => commitRenameSignature(true)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            commitRenameSignature(true);
                          }
                          if (e.key === "Escape") {
                            e.preventDefault();
                            commitRenameSignature(false);
                          }
                        }}
                        autoFocus
                      />
                    ) : (
                      <span>{sig.name}</span>
                    )}
                  </button>
                  <button
                    className="sigitem-remove"
                    onClick={() => {
                      setSignatures(prev => prev.filter(s => s.id !== sig.id));
                      updateItems(prev => prev.filter(item => item.type !== "signature" || item.signatureId !== sig.id), { record: true });
                      if (selectedSignatureId === sig.id) {
                        setSelectedSignatureId(null);
                      }
                    }}
                    title={t("remove_signature")}
                    aria-label={t("remove_signature")}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          <button className="btn sig-import" onClick={() => sigInputRef.current?.click()}>
            <FileArrowUp size={16} weight="regular" />
            <span>{t("import_signature")}</span>
          </button>
          <button className="btn sig-import" onClick={() => setShowSignaturePad(true)}>
            <TextT size={16} weight="regular" />
            <span>{t("draw_signature")}</span>
          </button>

          <div className="panel snippets">
            <div className="snippets-head">
              <h4>{t("snippets_title")}</h4>
              <span className="snippets-meta">{toolLabels[tool]}</span>
            </div>
            <div className="snippets-input">
              <input
                type="text"
                value={snippetInput}
                placeholder={t("snippets_placeholder")}
                onChange={(e) => setSnippetInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addSnippet(snippetInput);
                    setSnippetInput("");
                  }
                }}
              />
              <button
                className="btn"
                onClick={() => {
                  addSnippet(snippetInput);
                  setSnippetInput("");
                }}
              >
                {t("snippets_add")}
              </button>
            </div>

            {snippets.length === 0 ? (
              <p className="hint">{t("snippets_empty")}</p>
            ) : (
              <div className="snippets-list">
                {snippets.map((entry) => (
                  <div key={entry} className="snippets-item">
                    <div
                      className="snippets-use"
                      role="button"
                      tabIndex={0}
                      draggable={!isMac}
                      onPointerDown={(e) => startSnippetDrag(e, entry)}
                      onDragStart={(e) => {
                        if (isMac) return;
                        e.dataTransfer.setData("application/x-signstamp-snippet", entry);
                        e.dataTransfer.setData("text/plain", entry);
                        e.dataTransfer.setData("text", entry);
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      title={t("snippets_use")}
                    >
                      <span>{entry}</span>
                    </div>
                    <button
                      className="snippets-remove"
                      onClick={() => removeSnippet(entry)}
                      title={t("snippets_remove")}
                      aria-label={t("snippets_remove")}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
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
                const formFieldsOnPage = formFieldsByPage.get(pageNum) ?? [];

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
                      className={"overlay " + (tool === "text" || tool === "date" ? "cursor-text" : tool === "sign" || tool === "check" || tool === "ellipse" || tool === "line" || tool === "arrow" || tool === "highlight" ? "cursor-sign" : "cursor-pan")}
                      ref={(el) => {
                        if (el) {
                          overlayRefs.current.set(pageNum, el);
                        } else {
                          overlayRefs.current.delete(pageNum);
                        }
                      }}
                      onClick={(e) => {
                        if (e.target === e.currentTarget) setSelectedId(null);
                        onOverlayClick(e, pageNum);
                      }}
                      onDragEnter={(e) => {
                        if (!canEdit) return;
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "copy";
                      }}
                      onDragOver={(e) => {
                        if (!canEdit) return;
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "copy";
                      }}
                      onDrop={(e) => {
                        if (!canEdit) return;
                        e.preventDefault();
                        onSnippetDrop(e, pageNum);
                      }}
                      onPointerDown={(e) => startDraw(e, pageNum)}
                      aria-label="overlay"
                    >
                      {viewport && formFieldsOnPage.map(field => (
                        <FormFieldOverlay
                          key={field.name}
                          field={field}
                          viewport={viewport}
                          value={formValues[field.name]}
                          onChange={(v) => setFormValue(field.name, v)}
                        />
                      ))}
                      {viewport && itemsOnPage.map(item => (
                        <ItemOverlay
                          key={item.id}
                          item={item}
                          viewport={viewport}
                          isSelected={item.id === selectedId}
                          signatures={signatures}
                          textEditing={{
                            isActive: editingId === item.id,
                            value: editingValue,
                            placeholder: t("text_placeholder"),
                            title: t("edit_title"),
                            onStart: () => startEditingText(item.id),
                            onChange: setEditingValue,
                            onCommit: commitEditing
                          }}
                          onStartMove={(e) => startMove(item.id, e)}
                          onStartResize={(e) => startResize(item.id, e)}
                        />
                      ))}
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

      {showSignaturePad && (
        <div className="modal-backdrop" onClick={() => setShowSignaturePad(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{t("draw_signature_title")}</h3>
              <button className="btn icon-btn" onClick={() => setShowSignaturePad(false)} aria-label={t("signature_cancel")}>
                ×
              </button>
            </div>
            <p className="hint">{t("draw_signature_hint")}</p>
            <div className="signature-pad">
              <canvas
                ref={signatureCanvasRef}
                onPointerDown={onSignaturePointerDown}
                onPointerMove={onSignaturePointerMove}
                onPointerUp={onSignaturePointerUp}
                onPointerLeave={onSignaturePointerUp}
              />
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={clearSignaturePad}>{t("signature_clear")}</button>
              <div className="modal-actions-right">
                <button className="btn" onClick={() => setShowSignaturePad(false)}>{t("signature_cancel")}</button>
                <button className="btn primary" onClick={saveSignatureDrawing}>{t("signature_save")}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
