/** Convert a browser File into a fresh Uint8Array. */
export async function fileToBytes(file: File): Promise<Uint8Array> {
  const buf = await file.arrayBuffer();
  return new Uint8Array(buf);
}

/**
 * Encode raw bytes as a data URL.
 *
 * Copies the input into a fresh Uint8Array before wrapping it in a Blob —
 * some downstream consumers (pdf.js workers) can "neuter" a transferred
 * ArrayBuffer, so we never hand the caller's buffer to a Blob directly.
 */
export async function bytesToDataUrl(bytes: Uint8Array, mime: string): Promise<string> {
  const safeBytes = new Uint8Array(bytes);
  const blob = new Blob([safeBytes], { type: mime });
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * Decode an image data URL just enough to read its natural pixel size.
 * The browser does the actual decoding; we only listen for load/error.
 */
export async function getImageNaturalSize(dataUrl: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = (e) => reject(e);
    img.src = dataUrl;
  });
}
