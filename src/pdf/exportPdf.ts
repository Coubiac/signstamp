import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";
import type { Item, SignatureAsset } from "../types";

function hexToRgb(color: string) {
  const value = color.replace("#", "").trim();
  if (value.length !== 6) return rgb(0, 0, 0);
  const r = parseInt(value.slice(0, 2), 16) / 255;
  const g = parseInt(value.slice(2, 4), 16) / 255;
  const b = parseInt(value.slice(4, 6), 16) / 255;
  return rgb(r, g, b);
}

export async function exportFlattenedPdf(args: {
  originalPdfBytes: Uint8Array;
  items: Item[];
  signatures: SignatureAsset[];
}): Promise<Uint8Array> {
  const { originalPdfBytes, items, signatures } = args;

  const pdfDoc = await PDFDocument.load(originalPdfBytes);
  const fontCache = new Map<string, Promise<any>>();

  function getFont(family: "sans" | "serif" | "mono", bold: boolean) {
    const key = `${family}:${bold ? "bold" : "regular"}`;
    const cached = fontCache.get(key);
    if (cached) return cached;
    let fontName = StandardFonts.Helvetica;
    if (family === "serif") fontName = bold ? StandardFonts.TimesRomanBold : StandardFonts.TimesRoman;
    if (family === "mono") fontName = bold ? StandardFonts.CourierBold : StandardFonts.Courier;
    if (family === "sans") fontName = bold ? StandardFonts.HelveticaBold : StandardFonts.Helvetica;
    const embedded = pdfDoc.embedFont(fontName);
    fontCache.set(key, embedded);
    return embedded;
  }

  // cache images par signatureId pour éviter de ré-embed 20 fois la même
  const imageCache = new Map<string, any>();

  for (const item of items) {
    const page = pdfDoc.getPage(item.page - 1);
    if (!page) continue;

    if (item.type === "text" || item.type === "check") {
      const { x, y, w, h } = item.rect;
      const fontSize = item.fontSize;
      const family = item.type === "text" ? (item.fontFamily ?? "sans") : "sans";
      const bold = item.type === "text" ? Boolean(item.bold) : false;
      const font = await getFont(family, bold);

      // pdf-lib place le texte via la baseline; on approxime une "top-left" en décalant Y
      const yDraw = y + Math.max(0, h - fontSize);
      const textValue = item.value || "";

      page.drawText(textValue, {
        x,
        y: yDraw,
        size: fontSize,
        font,
        color: hexToRgb(item.color),
        maxWidth: w
      });

      if (item.type === "text" && (item.underline || item.strike)) {
        const textWidth = Math.min(w, font.widthOfTextAtSize(textValue, fontSize));
        const thickness = Math.max(1, fontSize / 14);
        if (item.underline) {
          page.drawLine({
            start: { x, y: yDraw - fontSize * 0.15 },
            end: { x: x + textWidth, y: yDraw - fontSize * 0.15 },
            color: hexToRgb(item.color),
            thickness
          });
        }
        if (item.strike) {
          page.drawLine({
            start: { x, y: yDraw + fontSize * 0.3 },
            end: { x: x + textWidth, y: yDraw + fontSize * 0.3 },
            color: hexToRgb(item.color),
            thickness
          });
        }
      }
    }

    if (item.type === "ellipse") {
      const { x, y, w, h } = item.rect;
      page.drawEllipse({
        x: x + w / 2,
        y: y + h / 2,
        xScale: w / 2,
        yScale: h / 2,
        borderColor: hexToRgb(item.color),
        borderWidth: item.strokeWidth
      });
    }

    if (item.type === "line") {
      const start = (item as any).start ?? { x: item.rect.x, y: item.rect.y + item.rect.h / 2 };
      const end = (item as any).end ?? { x: item.rect.x + item.rect.w, y: item.rect.y + item.rect.h / 2 };
      page.drawLine({
        start,
        end,
        color: hexToRgb(item.color),
        thickness: item.strokeWidth
      });
    }

    if (item.type === "arrow") {
      const start = (item as any).start ?? { x: item.rect.x, y: item.rect.y + item.rect.h / 2 };
      const end = (item as any).end ?? { x: item.rect.x + item.rect.w, y: item.rect.y + item.rect.h / 2 };
      const angle = Math.atan2(end.y - start.y, end.x - start.x);
      const headLength = Math.max(6, item.strokeWidth * 3);
      const headWidth = headLength * 0.7;
      const hx = Math.cos(angle) * headLength;
      const hy = Math.sin(angle) * headLength;
      const px = -Math.sin(angle) * headWidth * 0.5;
      const py = Math.cos(angle) * headWidth * 0.5;
      const baseX = end.x - hx;
      const baseY = end.y - hy;

      page.drawLine({
        start,
        end: { x: baseX, y: baseY },
        color: hexToRgb(item.color),
        thickness: item.strokeWidth
      });

      page.drawLine({
        start: { x: end.x, y: end.y },
        end: { x: baseX + px, y: baseY + py },
        color: hexToRgb(item.color),
        thickness: item.strokeWidth
      });
      page.drawLine({
        start: { x: end.x, y: end.y },
        end: { x: baseX - px, y: baseY - py },
        color: hexToRgb(item.color),
        thickness: item.strokeWidth
      });
    }

    if (item.type === "highlight") {
      const { x, y, w, h } = item.rect;
      page.drawRectangle({
        x,
        y,
        width: w,
        height: h,
        color: hexToRgb(item.color),
        opacity: 0.35
      });
    }

    if (item.type === "signature") {
      const asset = signatures.find(s => s.id === item.signatureId);
      if (!asset) continue;

      let embedded = imageCache.get(asset.id);
      if (!embedded) {
        embedded = asset.mime === "image/png"
          ? await pdfDoc.embedPng(asset.bytes)
          : await pdfDoc.embedJpg(asset.bytes);
        imageCache.set(asset.id, embedded);
      }

      const { x, y, w, h } = item.rect;

      page.drawImage(embedded, {
        x,
        y,
        width: w,
        height: h,
        rotate: degrees(0)
      });
    }
  }

  return await pdfDoc.save();
}
