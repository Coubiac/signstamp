export type Tool = "pan" | "text" | "date" | "check" | "sign";

export type PdfRect = { x: number; y: number; w: number; h: number };

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
};

export type Item = TextItem | SignatureItem | CheckItem;
