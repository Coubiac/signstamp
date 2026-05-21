import {
  PDFCheckBox,
  PDFDocument,
  PDFDropdown,
  PDFOptionList,
  PDFRadioGroup,
  PDFTextField,
  StandardFonts,
  rgb,
  degrees
} from "pdf-lib";
import type { Item, SignatureAsset } from "../types";
import { HIGHLIGHT_OPACITY } from "../constants";
import { parseHexColor } from "../utils/color";

/** pdf-lib accepts channels in the 0..1 range — black is the
 *  conservative fallback for items with a malformed color value. */
function hexToRgb(color: string) {
  const channels = parseHexColor(color);
  if (!channels) return rgb(0, 0, 0);
  return rgb(channels.r / 255, channels.g / 255, channels.b / 255);
}

/** Native AcroForm values keyed by field name. Null on a radio group
 *  clears the selection. */
export type FormValues = Record<string, string | boolean | null>;

export async function exportFlattenedPdf(args: {
  originalPdfBytes: Uint8Array;
  items: Item[];
  signatures: SignatureAsset[];
  /**
   * Native form field values to write back into the document's
   * AcroForm before the overlay items are stamped. Missing entries
   * leave the underlying field untouched.
   */
  formValues?: FormValues;
}): Promise<Uint8Array> {
  const { originalPdfBytes, items, signatures, formValues } = args;

  const pdfDoc = await PDFDocument.load(originalPdfBytes);

  // Write native form-field values first so the existing AcroForm
  // visuals are in sync before we draw our overlay items on top.
  // Skip when the caller has no values to write — pdf-lib's getForm()
  // would otherwise materialize an empty AcroForm dictionary on PDFs
  // that never had one.
  if (formValues && Object.keys(formValues).length > 0) {
    try {
      const form = pdfDoc.getForm();
      for (const [name, value] of Object.entries(formValues)) {
        // getField throws if the field does not exist ; we swallow
        // because the caller's value map may include stale entries
        // from a previously loaded PDF.
        let field;
        try {
          field = form.getField(name);
        } catch {
          continue;
        }
        if (field instanceof PDFTextField && typeof value === "string") {
          field.setText(value);
        } else if (field instanceof PDFCheckBox && typeof value === "boolean") {
          if (value) field.check();
          else field.uncheck();
        } else if (field instanceof PDFRadioGroup) {
          if (value === null || value === "") {
            field.clear();
          } else if (typeof value === "string") {
            // `select` throws if the option is not part of the group ;
            // swallow so stale state cannot abort the whole export.
            try { field.select(value); } catch { /* ignore unknown option */ }
          }
        } else if ((field instanceof PDFDropdown || field instanceof PDFOptionList) && typeof value === "string") {
          if (value === "") {
            field.clear();
          } else {
            try { field.select(value); } catch { /* ignore unknown option */ }
          }
        }
      }
    } catch (err) {
      // A document without an AcroForm dictionary raises here ; that
      // is the no-op case, not a failure to report.
      console.warn("Form export skipped:", err);
    }
  }
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
        opacity: HIGHLIGHT_OPACITY
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
