export type Tool = "pan" | "text" | "date" | "check" | "ellipse" | "line" | "arrow" | "highlight" | "sign";

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
