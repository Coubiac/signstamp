import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";
import type { Item, SignatureAsset } from "../types";

export async function exportFlattenedPdf(args: {
  originalPdfBytes: Uint8Array;
  items: Item[];
  signatures: SignatureAsset[];
}): Promise<Uint8Array> {
  const { originalPdfBytes, items, signatures } = args;

  const pdfDoc = await PDFDocument.load(originalPdfBytes);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // cache images par signatureId pour éviter de ré-embed 20 fois la même
  const imageCache = new Map<string, any>();

  for (const item of items) {
    const page = pdfDoc.getPage(item.page - 1);
    if (!page) continue;

    if (item.type === "text" || item.type === "check") {
      const { x, y, w, h } = item.rect;
      const fontSize = item.fontSize;

      // pdf-lib place le texte via la baseline; on approxime une "top-left" en décalant Y
      const yDraw = y + Math.max(0, h - fontSize);

      page.drawText(item.value || "", {
        x,
        y: yDraw,
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
        maxWidth: w
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
