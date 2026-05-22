export type Tool = "pan" | "text" | "date" | "check" | "ellipse" | "line" | "arrow" | "highlight" | "sign" | "paraph";

export type PdfRect = { x: number; y: number; w: number; h: number };
export type PdfPoint = { x: number; y: number };

export type SignatureAsset = {
  id: string;
  name: string;
  mime: "image/png" | "image/jpeg";
  bytes: Uint8Array;
  dataUrl: string; // preview
  naturalW: number;
  naturalH: number;
};

export type TextItem = {
  id: string;
  type: "text";
  page: number; // 1-indexed
  rect: PdfRect;
  value: string;
  fontSize: number;
  color: string;
  fontFamily: "sans" | "serif" | "mono";
  bold: boolean;
  underline: boolean;
  strike: boolean;
};

export type SignatureItem = {
  id: string;
  type: "signature";
  page: number; // 1-indexed
  rect: PdfRect;
  signatureId: string;
};

export type CheckItem = {
  id: string;
  type: "check";
  page: number; // 1-indexed
  rect: PdfRect;
  value: string;
  fontSize: number;
  color: string;
};

export type EllipseItem = {
  id: string;
  type: "ellipse";
  page: number;
  rect: PdfRect;
  color: string;
  strokeWidth: number;
};

export type LineItem = {
  id: string;
  type: "line";
  page: number;
  rect: PdfRect;
  start: PdfPoint;
  end: PdfPoint;
  color: string;
  strokeWidth: number;
};

export type ArrowItem = {
  id: string;
  type: "arrow";
  page: number;
  rect: PdfRect;
  start: PdfPoint;
  end: PdfPoint;
  color: string;
  strokeWidth: number;
};

export type HighlightItem = {
  id: string;
  type: "highlight";
  page: number;
  rect: PdfRect;
  color: string;
};

export type Item = TextItem | SignatureItem | CheckItem | EllipseItem | LineItem | ArrowItem | HighlightItem;

/**
 * A paraph is a single logical entity — an image projected onto every
 * page of the PDF at the same coordinates. Unlike `Item`, it has no
 * `page` field : the rect applies to every page, and editing it on any
 * page updates the master.
 */
export type Paraph = {
  /** Id of the `SignatureAsset` in the paraphs gallery. */
  assetId: string;
  rect: PdfRect;
};

/**
 * One row of the user profile. `key` is a stable identifier that the
 * auto-fill engine matches against form field names ; the label shown
 * in the UI is resolved from the key via i18n for canonical keys, and
 * falls back to the key itself for user-added custom entries.
 */
export type ProfileEntry = {
  key: string;
  value: string;
};

export type Profile = ProfileEntry[];
